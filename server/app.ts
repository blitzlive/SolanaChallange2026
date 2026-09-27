import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import { confirmSchema, cupIdSchema, demoWalletIdSchema, isCupAllowedForLocation, loanIdSchema, locations, MVP_USERS, returnSchema, userLoginSchema } from '../shared/model';
import { randomBytes } from 'node:crypto';
import { AppError, LoanService } from './service';
import { receipt } from './store';
import { merchantSessions } from './merchant-sessions';
import { walletCsv } from './wallet-csv';
import { getSolPriceEur } from './solana-price';

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
    message: { error: 'Too many requests. Please try again in one minute.' } }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '8kb' }));
  app.use('/api', (req, _res, next) => {
    if (req.method !== 'GET') {
      if (req.headers.origin && req.headers.origin !== options.origin)
        return next(new AppError(403, 'Cross-origin request rejected.'));
      if (!req.is('application/json')) return next(new AppError(415, 'JSON required.'));
    }
    next();
  });
  const merchant = merchantSessions(app, service.mode, options.merchantToken);

  app.post('/api/user/session', (req, res) => {
    const creds = userLoginSchema.parse(req.body);
    const matchedUser = MVP_USERS.find(u => u.username === creds.username || u.id === creds.username);
    if ((creds.username !== 'user-demo' && !matchedUser) || creds.password !== '123456') {
      throw new AppError(401, 'Invalid user credentials. Please use username "user-demo" or member username (alex.sol, sam.sol, taylor.sol) with password "123456".');
    }
    const user = matchedUser ?? MVP_USERS[0];
    res.status(201).json({
      token: randomBytes(32).toString('base64url'),
      user,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });
  });

  app.get('/api/config', async (_req, res) => {
    const priceInfo = await getSolPriceEur();
    res.json({
      mode: service.mode,
      cups: service.store.cups(),
      locations,
      users: MVP_USERS,
      solPriceEur: priceInfo.priceEur,
      solPriceLive: priceInfo.isLive,
    });
  });
  app.get('/api/solana-price', async (_req, res) => res.json(await getSolPriceEur()));
  app.get(['/api/demo-wallet', '/api/mvp-wallet', '/api/demo-wallet/export.csv', '/api/mvp-wallet/export.csv'], (req, res) => {
    if (service.mode !== 'demo') throw new AppError(404, 'The MVP wallet is only available in MVP mode.');
    const parsed = demoWalletIdSchema.safeParse(req.headers.authorization?.replace(/^Bearer /, ''));
    if (!parsed.success) throw new AppError(401, 'MVP wallet not recognized. Please open via the wallet selector.');
    const wallet = service.store.demoWallet(parsed.data);
    if (req.path.endsWith('/export.csv')) {
      res.setHeader('Content-Disposition', 'attachment; filename="pfandloop-cup-history.csv"');
      res.type('text/csv').send(walletCsv(wallet));
    } else res.json(wallet);
  });
  app.post('/api/loans', async (req, res) => {
    const body = req.body;
    if (body?.cupId && body?.location && typeof body.cupId === 'string' && (body.location === 'cafe' || body.location === 'festival')) {
      if (!isCupAllowedForLocation(body.cupId, body.location)) {
        throw new AppError(400, body.location === 'cafe'
          ? 'Café Morgenrot cannot issue festival cups (LOOP-002). Only Coffee To-Go Cups and Lunch Bowls are permitted.'
          : 'Wiesenklang Festival cannot issue normal coffee cups or lunch bowls. Only Festival Cups (LOOP-002) are permitted.'
        );
      }
    }
    res.status(201).json(await service.borrow(req.body));
  });
  app.get('/api/loans/active', (_req, res) => {
    res.json(service.store.activeLoans().map(loan => receipt(loan)));
  });
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
    res.json(await service.returnCup(cupIdSchema.parse(req.params.cupId), data.location, data.userId));
  });
  app.post('/api/loans/:id/refund', merchant, async (req, res) => {
    const data = returnSchema.parse(req.body);
    res.json(await service.refund(loanIdSchema.parse(req.params.id), data.location));
  });
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'API endpoint not found.')));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error('[PfandLoop API Error]', error);
    if (error instanceof ZodError) { res.status(400).json({ error: 'Validation error: ' + error.issues.map(i => i.message).join(' ') }); return; }
    if (error instanceof AppError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof SyntaxError) { res.status(400).json({ error: 'Invalid JSON.' }); return; }
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `The operation could not be completed: ${message}` });
  };
  app.use(errors);
  return app;
}
