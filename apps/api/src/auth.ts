import { Request, Response, NextFunction } from 'express';
import { supabaseAnon } from './supabase';

export type AuthedRequest = Request & {
  user?: { id: string; email?: string | null };
};

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'missing_bearer_token' });

    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'invalid_token' });

    req.user = { id: data.user.id, email: data.user.email };
    return next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'auth_error' });
  }
}
