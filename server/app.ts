import { timingSafeEqual } from 'node:crypto';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import { confirmSchema, cupIdSchema, loanIdSchema, locations, returnSchema } from '../shared/model';
import { AppError, LoanService } from './service';
import { receipt } from './store';

export function createApp(service: LoanService, options: { origin: string; merchantToken?: string; production?: boolean }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: options.production ? {
      directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"], upgradeInsecureRequests: null },
    } : false,
    strictTransportSecurity: false,
  }));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Zu viele Anfragen. Bitte in einer Minute erneut versuchen.' } }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '8kb' }));
  app.use('/api', (req, _res, next) => {
    if (req.method !== 'GET') {
      if (req.headers.origin && req.headers.origin !== options.origin)
        return next(new AppError(403, 'Anfrage von einer anderen Website abgewiesen.'));
      if (!req.is('application/json')) return next(new AppError(415, 'JSON erforderlich.'));
    }
    next();
  });
  const merchant: RequestHandler = (req, _res, next) => {
    if (service.mode === 'demo') return next();
    const supplied = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') ?? '');
    const expected = Buffer.from(options.merchantToken ?? '');
    if (!expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      return next(new AppError(401, 'Bitte einen gültigen Betreiber-Schlüssel eingeben.'));
    next();
  };
  app.get('/api/config', (_req, res) => res.json({ mode: service.mode, deposit: 3, cups: service.store.cups(), locations }));
  app.post('/api/loans', async (req, res) => res.status(201).json(await service.borrow(req.body)));
  app.get('/api/loans/:id', (req, res) => {
    const loan = service.get(loanIdSchema.parse(req.params.id));
    res.json({ receipt: receipt(loan), ...(loan.status === 'reserved' && loan.transaction ? { transaction: loan.transaction } : {}) });
  });
  app.post('/api/loans/:id/confirm', async (req, res) => {
    const { signature } = confirmSchema.parse(req.body);
    res.json(await service.confirm(loanIdSchema.parse(req.params.id), signature));
  });
  app.post('/api/returns/:cupId', merchant, async (req, res) => {
    const data = returnSchema.parse(req.body);
    res.json(await service.returnCup(cupIdSchema.parse(req.params.cupId), data.location));
  });
  app.post('/api/loans/:id/refund', merchant, async (req, res) => {
    const data = returnSchema.parse(req.body);
    res.json(await service.refund(loanIdSchema.parse(req.params.id), data.location));
  });
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'API-Endpunkt nicht gefunden.')));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ZodError) { res.status(400).json({ error: 'Eingaben prüfen: ' + error.issues.map(i => i.message).join(' ') }); return; }
    if (error instanceof AppError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof SyntaxError) { res.status(400).json({ error: 'Ungültiges JSON.' }); return; }
    // Do not echo RPC URLs, keys, SQL or third-party error bodies to the browser/log.
    res.status(503).json({ error: 'Der Vorgang konnte nicht abgeschlossen werden. Beleg behalten und Status erneut prüfen.' });
  };
  app.use(errors);
  return app;
}
