import { sql } from '../db/index.js';

const db = sql!;

export interface OutboxEventRecord {
  id: string;
  type: string;
  version: number;
  occurredAt: Date;
  producer: string;
  correlationId: string;
  causationId?: string;
  idempotencyKey: string;
  entityRefs: Record<string, any>;
  payload: Record<string, any>;
  publishedAt?: Date;
  createdAt: Date;
}

export type EventHandler = (event: OutboxEventRecord) => Promise<void>;

/**
 * At-least-once outbox event consumer with idempotency tracking via platform.processed_events.
 */
export class OutboxConsumer {
  private consumerName: string;
  private handlers = new Map<string, EventHandler[]>();

  constructor(consumerName: string = 'pipeline-worker') {
    this.consumerName = consumerName;
  }

  /**
   * Subscribes a handler function to a domain event type.
   */
  subscribe(eventType: string, handler: EventHandler): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  async processBatch(options?: {
    batchSize?: number;
    newerThan?: Date;
  }): Promise<{
    processed: number;
    errors: Array<{ eventId: string; error: string }>;
  }> {
    if (!db) throw new Error('Database client not initialized');

    const subscribedTypes = Array.from(this.handlers.keys());
    if (subscribedTypes.length === 0) {
      return { processed: 0, errors: [] };
    }

    const limit = options?.batchSize ?? 10;
    const newerThan = options?.newerThan ?? null;

    const events = await db`
      SELECT *
      FROM platform.outbox_events
      WHERE published_at IS NULL
        AND type = ANY(${subscribedTypes})
        ${newerThan ? db`AND occurred_at >= ${newerThan}` : db``}
      ORDER BY occurred_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    let processed = 0;
    const errors: Array<{ eventId: string; error: string }> = [];

    for (const raw of events) {
      const event: OutboxEventRecord = {
        id: raw.id,
        type: raw.type,
        version: raw.version,
        occurredAt: new Date(raw.occurred_at),
        producer: raw.producer,
        correlationId: raw.correlation_id,
        causationId: raw.causation_id ?? undefined,
        idempotencyKey: raw.idempotency_key,
        entityRefs: raw.entity_refs ?? {},
        payload: raw.payload ?? {},
        publishedAt: raw.published_at ? new Date(raw.published_at) : undefined,
        createdAt: new Date(raw.created_at),
      };

      // 1. Idempotency Check: Already processed by this consumer?
      const alreadyProcessed = await db`
        SELECT 1 FROM platform.processed_events
        WHERE consumer = ${this.consumerName} AND event_id = ${event.id}
        LIMIT 1
      `;

      if (alreadyProcessed.length > 0) {
        await db`
          UPDATE platform.outbox_events
          SET published_at = now()
          WHERE id = ${event.id}
        `;
        processed++;
        continue;
      }

      // 2. Dispatch to registered handlers
      const handlers = this.handlers.get(event.type) ?? [];
      let success = true;

      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (err: any) {
          success = false;
          errors.push({ eventId: event.id, error: err.message });

          // 3. Record failure in platform.dead_letters
          await db`
            INSERT INTO platform.dead_letters (
              queue, event_id, reason, payload
            ) VALUES (
              ${this.consumerName},
              ${event.id},
              ${err.message || 'Handler execution error'},
              ${db.json(event.payload)}
            )
          `;
          break;
        }
      }

      // 4. Mark processed & published (or quarantined on unrecoverable failure)
      if (success) {
        await db`
          INSERT INTO platform.processed_events (
            consumer, event_id, processed_at
          ) VALUES (
            ${this.consumerName}, ${event.id}, now()
          ) ON CONFLICT (consumer, event_id) DO NOTHING
        `;

        await db`
          UPDATE platform.outbox_events
          SET published_at = now()
          WHERE id = ${event.id}
        `;

        processed++;
      } else {
        // Poison pill quarantine: Acknowledge event so outbox queue progresses to subsequent valid events
        await db`
          INSERT INTO platform.processed_events (
            consumer, event_id, processed_at
          ) VALUES (
            ${this.consumerName}, ${event.id}, now()
          ) ON CONFLICT (consumer, event_id) DO NOTHING
        `;

        await db`
          UPDATE platform.outbox_events
          SET published_at = now()
          WHERE id = ${event.id}
        `;
      }
    }

    return { processed, errors };
  }
}
