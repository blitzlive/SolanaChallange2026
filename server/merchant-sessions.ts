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
    if (mode !== 'demo') {
      const supplied = Buffer.from(tokenFrom(req.headers.authorization));
      const expected = Buffer.from(operatorToken ?? '');
      if (!expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
        throw new AppError(401, 'Bitte einen gültigen Betreiber-Schlüssel eingeben.');
    }
    prune();
    if (sessions.size >= 1000) throw new AppError(503, 'Zu viele Geschäftssitzungen. Bitte später erneut anmelden.');
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
    if (!session) return next(new AppError(401, 'Bitte im Geschäftsprofil anmelden. Deine Sitzung ist möglicherweise abgelaufen.'));
    if (req.body?.location !== session.location) return next(new AppError(403, 'Rückgaben müssen zum angemeldeten Geschäftsprofil gehören.'));
    next();
  };
}
