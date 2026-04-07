import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler.middleware';
import authRoutes from './modules/auth/auth.routes';
import lpoRoutes from './modules/lpo/lpo.routes';
import investmentRoutes from './modules/investment/investment.routes';
import settlementRoutes from './modules/settlement/settlement.routes';
import injectionRoutes from './modules/injection/injection.routes';
import darajaRoutes from './modules/daraja/daraja.routes';
import orderRoutes from './modules/order/order.routes';

const app: Application = express();

// ─── Security Middleware ──────────────────────────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin:
      env.NODE_ENV === 'production'
        ? ['https://admin.akripesa.com', 'https://app.akripesa.com']
        : 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

app.use(globalLimiter);
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
//
// MOUNT ORDER RULES — read before modifying:
//
// 1. More specific paths BEFORE less specific paths.
//    /api/v1/campaigns/investments must be mounted BEFORE /api/v1/campaigns
//    otherwise Express matches /api/v1/campaigns first and the investment
//    router is unreachable for paths starting with /campaigns/investments.
//
// 2. Daraja callbacks have no auth middleware — they use their own
//    validateDarajaCallback middleware internally. Mount them before
//    the global auth routes to avoid any accidental middleware interference.
//
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/v1/auth',                    authLimiter, authRoutes);
app.use('/api/v1/daraja',                  darajaRoutes);

// Investments MUST come before campaigns — more specific prefix first
// ✅ FIX: Add /campaigns to the mount path
app.use('/api/v1/campaigns/investments', investmentRoutes);

// Campaign sub-feature routers — all mounted under /api/v1/campaigns
// Each router owns its own path segment after the mount point
app.use('/api/v1/campaigns',               injectionRoutes);   // /:campaignId/inject
app.use('/api/v1/campaigns',               settlementRoutes);  // /:campaignId/settle
app.use('/api/v1/campaigns',               lpoRoutes);         // /admin/all, /:campaignId, etc.

app.use('/api/v1/orders',                  orderRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error Handler (must be last) ────────────────────────────────────────────

app.use(errorHandler);

export default app;