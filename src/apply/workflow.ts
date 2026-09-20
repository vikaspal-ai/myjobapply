import { sql, emitOutboxEvent } from '../db/index.js';
import type {
  ApplicationRecord,
  ApplicationRunPath,
  ApplicationRunRecord,
  ApplicationRunResult,
  ApplicationStatus,
  AutoFillResult,
  BrowserAutomationDriver,
} from './types.js';

const db = sql!;

export class ApplicationWorkflowEngine {
  /**
   * Creates a draft application for a candidate and a canonical job.
   * Idempotent: returns existing draft if one already exists.
   */
  async createDraft(params: {
    candidateId: string;
    jobId: string;
    resumeVersionId?: string;
    coverLetterVersionId?: string;
    notes?: string;
  }): Promise<ApplicationRecord> {
    const existing = await db`
      SELECT * FROM apply.applications
      WHERE candidate_id = ${params.candidateId} AND job_id = ${params.jobId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      const row = existing[0];
      return this.mapApplicationRow(row);
    }

    const [inserted] = await db`
      INSERT INTO apply.applications (
        candidate_id,
        job_id,
        resume_version_id,
        cover_letter_version_id,
        status,
        notes
      ) VALUES (
        ${params.candidateId},
        ${params.jobId},
        ${params.resumeVersionId ?? null},
        ${params.coverLetterVersionId ?? null},
        'DRAFT',
        ${params.notes ?? null}
      )
      RETURNING *
    `;

    await emitOutboxEvent(db, {
      type: 'ApplicationCreated',
      producer: 'application-workflow',
      idempotencyKey: `application:${inserted.id}:created`,
      correlationId: inserted.id,
      entityRefs: {
        applicationId: inserted.id,
        candidateId: inserted.candidate_id,
        jobId: inserted.job_id,
      },
      payload: {
        status: 'DRAFT',
        resumeVersionId: inserted.resume_version_id,
        coverLetterVersionId: inserted.cover_letter_version_id,
      },
    });

    return this.mapApplicationRow(inserted);
  }

  /**
   * Prepares the application with auto-fill inspection results.
   * If auto-fill requires human attention, pauses application.
   * If fully resolved, places application in PENDING_APPROVAL.
   */
  async prepareApplication(
    applicationId: string,
    autoFill: AutoFillResult,
  ): Promise<ApplicationRecord> {
    const app = await this.getApplication(applicationId);
    if (!app) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    if (!autoFill.canSubmit) {
      const pauseNote = `Paused during preparation: ${autoFill.pauseReason ?? 'Unresolved fields'}`;
      const [updated] = await db`
        UPDATE apply.applications
        SET status = 'PAUSED',
            notes = ${pauseNote},
            updated_at = now()
        WHERE id = ${applicationId}
        RETURNING *
      `;

      await emitOutboxEvent(db, {
        type: 'ApplicationPaused',
        producer: 'application-workflow',
        idempotencyKey: `application:${applicationId}:paused:${Date.now()}`,
        correlationId: applicationId,
        entityRefs: {
          applicationId,
          candidateId: app.candidateId,
          jobId: app.jobId,
        },
        payload: {
          previousStatus: app.status,
          pauseReason: autoFill.pauseReason,
          unresolvedCount: autoFill.unresolvedFields.length,
        },
      });

      return this.mapApplicationRow(updated);
    }

    const [updated] = await db`
      UPDATE apply.applications
      SET status = 'PENDING_APPROVAL',
          updated_at = now()
      WHERE id = ${applicationId}
      RETURNING *
    `;

    await emitOutboxEvent(db, {
      type: 'ApplicationPrepared',
      producer: 'application-workflow',
      idempotencyKey: `application:${applicationId}:prepared:${Date.now()}`,
      correlationId: applicationId,
      entityRefs: {
        applicationId,
        candidateId: app.candidateId,
        jobId: app.jobId,
      },
      payload: {
        filledFieldCount: autoFill.filledFields.length,
        status: 'PENDING_APPROVAL',
      },
    });

    return this.mapApplicationRow(updated);
  }

  /**
   * Human-in-the-Loop Review Gate:
   * Explicitly approves the prepared application for automated submission.
   */
  async approveApplication(
    applicationId: string,
    options?: {
      approvedBy?: string;
      notes?: string;
    },
  ): Promise<ApplicationRecord> {
    const app = await this.getApplication(applicationId);
    if (!app) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    const approvableStates: ApplicationStatus[] = ['PENDING_APPROVAL', 'PREPARED', 'PAUSED'];
    if (!approvableStates.includes(app.status)) {
      throw new Error(
        `Cannot approve application ${applicationId} with status '${app.status}'. Must be in PENDING_APPROVAL, PREPARED, or PAUSED.`,
      );
    }

    const note = options?.notes ?? `Approved by candidate ${options?.approvedBy ?? 'user'}`;

    const [updated] = await db`
      UPDATE apply.applications
      SET status = 'APPROVED',
          notes = ${note},
          updated_at = now()
      WHERE id = ${applicationId}
      RETURNING *
    `;

    await emitOutboxEvent(db, {
      type: 'ApplicationApproved',
      producer: 'application-workflow',
      idempotencyKey: `application:${applicationId}:approved:${Date.now()}`,
      correlationId: applicationId,
      entityRefs: {
        applicationId,
        candidateId: app.candidateId,
        jobId: app.jobId,
      },
      payload: {
        status: 'APPROVED',
        approvedBy: options?.approvedBy ?? 'user',
      },
    });

    return this.mapApplicationRow(updated);
  }

  /**
   * Pauses an active application.
   */
  async pauseApplication(
    applicationId: string,
    reason: string,
  ): Promise<ApplicationRecord> {
    const app = await this.getApplication(applicationId);
    if (!app) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    const [updated] = await db`
      UPDATE apply.applications
      SET status = 'PAUSED',
          notes = ${reason},
          updated_at = now()
      WHERE id = ${applicationId}
      RETURNING *
    `;

    await emitOutboxEvent(db, {
      type: 'ApplicationPaused',
      producer: 'application-workflow',
      idempotencyKey: `application:${applicationId}:paused:${Date.now()}`,
      correlationId: applicationId,
      entityRefs: {
        applicationId,
        candidateId: app.candidateId,
        jobId: app.jobId,
      },
      payload: {
        reason,
      },
    });

    return this.mapApplicationRow(updated);
  }

  /**
   * Cancels or rejects an application.
   */
  async cancelApplication(
    applicationId: string,
    reason: string,
  ): Promise<ApplicationRecord> {
    const app = await this.getApplication(applicationId);
    if (!app) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    const [updated] = await db`
      UPDATE apply.applications
      SET status = 'CANCELLED',
          notes = ${reason},
          updated_at = now()
      WHERE id = ${applicationId}
      RETURNING *
    `;

    await emitOutboxEvent(db, {
      type: 'ApplicationCancelled',
      producer: 'application-workflow',
      idempotencyKey: `application:${applicationId}:cancelled`,
      correlationId: applicationId,
      entityRefs: {
        applicationId,
        candidateId: app.candidateId,
        jobId: app.jobId,
      },
      payload: {
        reason,
      },
    });

    return this.mapApplicationRow(updated);
  }

  /**
   * Executes automated application submission via Playwright Sandbox or extension runner.
   *
   * STRICT INVARIANT (HLD §11 & §12):
   * Application status MUST be 'APPROVED' prior to running submission.
   * Unapproved submissions throw an invariant violation error immediately.
   */
  async executeApplicationRun(
    applicationId: string,
    options: {
      path?: ApplicationRunPath;
      autoFillResult: AutoFillResult;
      driver?: BrowserAutomationDriver;
      applyUrl?: string;
      simulateCaptcha?: boolean;
      simulateNetworkFailure?: boolean;
    },
  ): Promise<ApplicationRunResult> {
    const app = await this.getApplication(applicationId);
    if (!app) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    // Safety Approval Gate Check
    if (app.status !== 'APPROVED') {
      throw new Error(
        `Invariant violation: Application ${applicationId} cannot be submitted because it is in '${app.status}' status. Human approval is strictly required prior to automated submission.`,
      );
    }

    const path: ApplicationRunPath = options.path ?? 'PLAYWRIGHT';

    // Serialize filled form data for audit trail
    const formDataSummary = options.autoFillResult.filledFields.reduce<Record<string, string>>(
      (acc, f) => {
        acc[f.field.name] = f.value;
        return acc;
      },
      {},
    );

    // 1. Record starting run in database
    const [run] = await db`
      INSERT INTO apply.application_runs (
        application_id,
        path,
        status,
        form_data
      ) VALUES (
        ${applicationId},
        ${path},
        'RUNNING',
        ${db.json(formDataSummary)}
      )
      RETURNING *
    `;

    // 2. Transition application to SUBMITTING
    await db`
      UPDATE apply.applications
      SET status = 'SUBMITTING',
          updated_at = now()
      WHERE id = ${applicationId}
    `;

    // 3. Execution (via custom driver or default sandbox simulator)
    let outcome: {
      success: boolean;
      paused?: boolean;
      pauseReason?: 'CAPTCHA_DETECTED' | 'LOGIN_WALL_DETECTED' | 'LAYOUT_CHANGED';
      error?: string;
      receipt?: string;
    };

    if (options.driver) {
      outcome = await options.driver.fillAndSubmit(
        options.autoFillResult.filledFields,
        options.applyUrl,
      );
    } else {
      // Sandbox Simulation
      if (options.simulateCaptcha) {
        outcome = {
          success: false,
          paused: true,
          pauseReason: 'CAPTCHA_DETECTED',
        };
      } else if (options.simulateNetworkFailure) {
        outcome = {
          success: false,
          error: 'Connection timeout during form submission',
        };
      } else {
        outcome = {
          success: true,
          receipt: `CONF-${Date.now().toString(36).toUpperCase()}`,
        };
      }
    }

    // 4. Handle Result & State Transitions
    if (outcome.paused) {
      const pauseReason = outcome.pauseReason ?? 'CAPTCHA_DETECTED';

      await db`
        UPDATE apply.application_runs
        SET status = 'PAUSED',
            pause_reason = ${pauseReason},
            updated_at = now()
        WHERE id = ${run.id}
      `;

      await db`
        UPDATE apply.applications
        SET status = 'PAUSED',
            notes = ${`Submission paused: ${pauseReason}`},
            updated_at = now()
        WHERE id = ${applicationId}
      `;

      await emitOutboxEvent(db, {
        type: 'ApplicationPaused',
        producer: 'application-workflow',
        idempotencyKey: `application_run:${run.id}:paused`,
        correlationId: applicationId,
        entityRefs: {
          applicationId,
          runId: run.id,
          candidateId: app.candidateId,
          jobId: app.jobId,
        },
        payload: {
          pauseReason,
          path,
        },
      });

      return {
        runId: run.id,
        success: false,
        status: 'PAUSED',
        pauseReason,
      };
    }

    if (!outcome.success) {
      const errorMessage = outcome.error ?? 'Unknown submission error';

      await db`
        UPDATE apply.application_runs
        SET status = 'FAILED',
            updated_at = now()
        WHERE id = ${run.id}
      `;

      await db`
        UPDATE apply.applications
        SET status = 'FAILED',
            notes = ${`Submission failed: ${errorMessage}`},
            updated_at = now()
        WHERE id = ${applicationId}
      `;

      await emitOutboxEvent(db, {
        type: 'ApplicationFailed',
        producer: 'application-workflow',
        idempotencyKey: `application_run:${run.id}:failed`,
        correlationId: applicationId,
        entityRefs: {
          applicationId,
          runId: run.id,
          candidateId: app.candidateId,
          jobId: app.jobId,
        },
        payload: {
          error: errorMessage,
          path,
        },
      });

      return {
        runId: run.id,
        success: false,
        status: 'FAILED',
        error: errorMessage,
      };
    }

    // 5. Success
    await db`
      UPDATE apply.application_runs
      SET status = 'SUBMITTED',
          submitted_at = now(),
          updated_at = now()
      WHERE id = ${run.id}
    `;

    await db`
      UPDATE apply.applications
      SET status = 'SUBMITTED',
          notes = ${outcome.receipt ? `Receipt: ${outcome.receipt}` : null},
          updated_at = now()
      WHERE id = ${applicationId}
    `;

    await emitOutboxEvent(db, {
      type: 'ApplicationSubmitted',
      producer: 'application-workflow',
      idempotencyKey: `application_run:${run.id}:submitted`,
      correlationId: applicationId,
      entityRefs: {
        applicationId,
        runId: run.id,
        candidateId: app.candidateId,
        jobId: app.jobId,
      },
      payload: {
        path,
        confirmationReceipt: outcome.receipt,
      },
    });

    return {
      runId: run.id,
      success: true,
      status: 'SUBMITTED',
      confirmationReceipt: outcome.receipt,
    };
  }

  /**
   * Retrieves an application by ID.
   */
  async getApplication(applicationId: string): Promise<ApplicationRecord | null> {
    const rows = await db`
      SELECT * FROM apply.applications
      WHERE id = ${applicationId}
      LIMIT 1
    `;

    if (rows.length === 0) return null;
    return this.mapApplicationRow(rows[0]);
  }

  /**
   * Retrieves runs for an application.
   */
  async getApplicationRuns(applicationId: string): Promise<ApplicationRunRecord[]> {
    const rows = await db`
      SELECT * FROM apply.application_runs
      WHERE application_id = ${applicationId}
      ORDER BY created_at DESC
    `;

    return rows.map((r: any) => ({
      id: r.id,
      applicationId: r.application_id,
      path: r.path,
      status: r.status,
      formData: r.form_data,
      pauseReason: r.pause_reason ?? undefined,
      approvedAt: r.approved_at ? new Date(r.approved_at) : undefined,
      submittedAt: r.submitted_at ? new Date(r.submitted_at) : undefined,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }));
  }

  private mapApplicationRow(row: any): ApplicationRecord {
    return {
      id: row.id,
      candidateId: row.candidate_id,
      jobId: row.job_id,
      resumeVersionId: row.resume_version_id ?? undefined,
      coverLetterVersionId: row.cover_letter_version_id ?? undefined,
      status: row.status as ApplicationStatus,
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
