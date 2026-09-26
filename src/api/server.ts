import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';

import { candidateRoutes } from './routes/candidates.js';
import { jobRoutes } from './routes/jobs.js';
import { applicationRoutes } from './routes/applications.js';
import { documentRoutes } from './routes/documents.js';
import { pipelineRoutes } from './routes/pipeline.js';
import { analyticsRoutes } from './routes/analytics.js';
import { outreachRoutes } from './routes/outreach.js';
import { authRoutes } from './routes/auth.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : true,
  });

  // Enable CORS
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Enable multipart for file uploads
  await app.register(fastifyMultipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });

  // Healthcheck
  app.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'myjobapply-bff',
  }));

  // Register API Routes
  await app.register(authRoutes);
  await app.register(candidateRoutes);
  await app.register(jobRoutes);
  await app.register(applicationRoutes);
  await app.register(documentRoutes);
  await app.register(pipelineRoutes);
  await app.register(analyticsRoutes);
  await app.register(outreachRoutes);

  // Decoupled Pure REST API Root
  app.get('/', async () => ({
    service: 'myjobapply-api',
    status: 'ok',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      candidates: '/api/candidates',
      jobs: '/api/jobs',
      applications: '/api/applications',
      analytics: '/api/analytics/funnel',
    },
  }));

  // Clean JSON 404 handler for all unmatched routes
  app.setNotFoundHandler(async (_req, reply) => {
    return reply.code(404).send({ success: false, error: 'Endpoint not found' });
  });

  return app;
}

export async function startServer(port: number = 3000, host: string = '0.0.0.0') {
  const app = await buildApp();
  try {
    const address = await app.listen({ port, host });
    console.log(`\n🚀 Job Hunt Platform BFF & Web Dashboard running at: ${address}`);
    console.log(`📊 Open your browser at http://localhost:${port}\n`);
    return app;
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Start if executed directly
if (process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))) {
  const port = parseInt(process.env.PORT || '3000', 10);
  startServer(port);
}
