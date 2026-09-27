import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler, Router } from 'express';
import { merchantLoginSchema, type MerchantSession, type Mode } from '../shared/model';
import { AppError } from './service';

export function merchantSessions(app: Router, mode: Mode, operatorToken?: string): RequestHandler {
  const sessions = new Map<string, MerchantSession>();
  const tokenFrom = (authorization?: string) => authorization?.replace(/^Bearer /, '') ?? '';
  const prune = () => { for (const [token, session] of sessions) if (session.expiresAt <= Date.now()) sessions.delete(token); };

  app.post('/api/merchant/session', (req, res) => {
    const data = merchantLoginSchema.parse(req.body);
    if (mode === 'demo') {
      if (data.username !== undefined || data.password !== undefined) {
        if (data.username !== 'demo' || data.password !== '123456') {
          throw new AppError(401, 'Invalid merchant credentials. Please use username "demo" and password "123456".');
        }
      }
    } else {
      const supplied = Buffer.from(tokenFrom(req.headers.authorization));
      const expected = Buffer.from(operatorToken ?? '');
      if (!expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
        throw new AppError(401, 'Please enter a valid operator token.');
    }
    prune();
    if (sessions.size >= 1000) throw new AppError(503, 'Too many active merchant sessions. Please sign in again later.');
    const session: MerchantSession = { token: randomBytes(32).toString('base64url'), location: data.location, expiresAt: Date.now() + 8 * 60 * 60 * 1000 };
    sessions.set(session.token, session);
    res.status(201).json(session);
  });
  app.post('/api/merchant/logout', (req, res) => {
    sessions.delete(tokenFrom(req.headers.authorization));
    res.json({ ok: true });
  });
  return (req, _res, next) => {
    prune();
    const session = sessions.get(tokenFrom(req.headers.authorization));
    if (!session) return next(new AppError(401, 'Please sign in to the merchant station. Your session may have expired.'));
    if (req.body?.location !== session.location) return next(new AppError(403, 'Returns must be processed for the signed-in store location.'));
    next();
  };
}
