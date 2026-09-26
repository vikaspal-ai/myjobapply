import type { FastifyInstance } from 'fastify';
import { supabase } from '../../db/index.js';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/signup - Email/password signup via Supabase
  app.post<{
    Body: { email: string; password: string; fullName?: string };
  }>('/api/auth/signup', async (req, reply) => {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return reply.code(400).send({ success: false, error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || '' },
    });

    if (error) {
      return reply.code(400).send({ success: false, error: error.message });
    }

    return reply.code(201).send({
      success: true,
      data: {
        user: data.user,
        session: null,
      },
    });
  });

  // POST /api/auth/login - Email/password login via Supabase
  app.post<{
    Body: { email: string; password: string };
  }>('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return reply.code(400).send({ success: false, error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return reply.code(401).send({ success: false, error: error.message });
    }

    return reply.send({
      success: true,
      data: {
        user: data.user,
        session: data.session ?? null,
      },
    });
  });

  // POST /api/auth/google - Initiate Google OAuth (returns redirect URL)
  app.post<{
    Body: { redirectTo?: string };
  }>('/api/auth/google', async (req, reply) => {
    const { redirectTo } = req.body;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback`,
        scopes: 'email profile',
      },
    });

    if (error) {
      return reply.code(400).send({ success: false, error: error.message });
    }

    return reply.send({
      success: true,
      data: { url: data.url },
    });
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', async (_req, reply) => {
    await supabase.auth.signOut();
    return reply.send({ success: true });
  });

  // GET /api/auth/me - Get current user from session (requires valid JWT in Authorization header)
  app.get('/api/auth/me', async (req, reply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ success: false, error: 'No authorization header' });
    }

    const token = authHeader.slice(7);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return reply.code(401).send({ success: false, error: 'Invalid or expired token' });
    }

    return reply.send({
      success: true,
      data: { user: data.user },
    });
  });

  // POST /api/auth/callback - Handle OAuth callback (exchange code for session)
  app.post<{
    Body: { code: string };
  }>('/api/auth/callback', async (req, reply) => {
    const { code } = req.body;

    if (!code) {
      return reply.code(400).send({ success: false, error: 'Auth code is required' });
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return reply.code(400).send({ success: false, error: error.message });
    }

    return reply.send({
      success: true,
      data: {
        user: data.user,
        session: data.session ?? null,
      },
    });
  });
}