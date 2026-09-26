import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import { candidateRoutes } from './routes/candidates.js';
import { jobRoutes } from './routes/jobs.js';
import { applicationRoutes } from './routes/applications.js';
import { documentRoutes } from './routes/documents.js';
import { pipelineRoutes } from './routes/pipeline.js';
import { analyticsRoutes } from './routes/analytics.js';
import { outreachRoutes } from './routes/outreach.js';
import { authRoutes } from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Serve static UI: Prefer modern compiled React build, fallback to dashboard public dir
  const reactDistDir = path.resolve(__dirname, '../../dist/client');
  const fallbackDir = path.resolve(__dirname, '../dashboard/public');
  const staticDir = fs.existsSync(reactDistDir) ? reactDistDir : fallbackDir;

  await app.register(fastifyStatic, {
    root: staticDir,
    prefix: '/',
  });

  // Fallback route for SPA navigation
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api')) {
      return reply.code(404).send({ success: false, error: 'Endpoint not found' });
    }
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ success: false, error: 'Page not found' });
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
