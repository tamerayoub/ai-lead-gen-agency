import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";
import passport from "./passport";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { gmailScanner } from "./gmailScanner";
import { calendarAutoSync } from "./calendarAutoSync";
import { reminderScheduler } from "./reminderScheduler";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import { hostRoutingMiddleware } from "./hostRoutingMiddleware";

// Validate required environment variables
if (!process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET must be set. Generate a strong secret with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

const app = express();

// Stripe webhook route MUST be registered BEFORE express.json()
// This is critical - webhook needs raw Buffer, not parsed JSON
app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Now apply JSON middleware for all other routes
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Session store setup
const PgSession = connectPgSimple(session);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Configure session with proper cookie settings for production
app.set("trust proxy", 1); // Trust first proxy (needed for HTTPS behind proxy)

// Determine if we should use secure cookies
// NEVER use secure cookies on localhost - check NODE_ENV and whether we're likely on localhost
// If PRODUCTION_DOMAIN is set but NODE_ENV is not "production", we're likely in local dev
const isLikelyLocalhost = !process.env.NODE_ENV || process.env.NODE_ENV !== "production";
const useSecureCookies = !isLikelyLocalhost && (process.env.NODE_ENV === "production" || !!process.env.PRODUCTION_DOMAIN);

console.log('[Session] Cookie configuration:', {
  NODE_ENV: process.env.NODE_ENV,
  PRODUCTION_DOMAIN: process.env.PRODUCTION_DOMAIN ? 'set' : 'not set',
  isLikelyLocalhost,
  useSecureCookies,
  sameSite: useSecureCookies ? 'lax' : false
});

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "sessions",
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      // CRITICAL: Only use secure cookies if NOT on localhost
      // If NODE_ENV is not "production", we're on localhost - use insecure cookies
      secure: useSecureCookies,
      sameSite: useSecureCookies ? "lax" : false, // SameSite for CSRF protection
      // Don't set domain explicitly - let it default to the request domain
      // This ensures cookies work across subdomains and exact domain matches
    },
  }),
);

// Middleware to override cookie settings per-request for localhost detection
app.use((req, res, next) => {
  // Check if this request is actually from localhost (more reliable than env vars)
  const hostname = req.get('host') || req.hostname || '';
  const isLocalhost = hostname.includes('localhost') || 
                     hostname.includes('127.0.0.1') || 
                     hostname.includes(':5000') ||
                     req.hostname === 'localhost' ||
                     req.hostname === '127.0.0.1';
  
  // If we detect localhost in the request, override the session cookie settings
  if (isLocalhost && req.session && req.session.cookie) {
    req.session.cookie.secure = false;
    req.session.cookie.sameSite = false;
  }
  
  next();
});

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Host-based routing middleware for multi-domain support
app.use(hostRoutingMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  // Log booking requests immediately
  if (
    path.includes("/api/public/units") &&
    path.includes("/book") &&
    req.method === "POST"
  ) {
    console.log("🔔 [MIDDLEWARE] Booking request detected:", req.method, path);
    console.log(
      "🔔 [MIDDLEWARE] Request body:",
      JSON.stringify(req.body, null, 2),
    );
  }

  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Only log response body for small responses to avoid performance overhead
      if (capturedJsonResponse) {
        try {
          const responseStr = JSON.stringify(capturedJsonResponse);
          // Only include response in log if it's small (under 200 chars) to avoid performance hit
          if (responseStr.length < 200) {
            logLine += ` :: ${responseStr}`;
          } else {
            // For large responses, just show a summary
            const responseType = Array.isArray(capturedJsonResponse) 
              ? `[Array(${capturedJsonResponse.length})]`
              : typeof capturedJsonResponse === 'object'
              ? `[Object]`
              : `[${typeof capturedJsonResponse}]`;
            logLine += ` :: ${responseType}`;
          }
        } catch (e) {
          // If stringify fails, skip it
        }
      }

      // Truncate very long paths
      if (logLine.length > 150) {
        logLine = logLine.slice(0, 149) + "…";
      }

      // Only log slow requests or errors to reduce log noise
      if (duration > 1000 || res.statusCode >= 400) {
        log(logLine);
      }
    }
  });

  next();
});

// Initialize Stripe schema and sync data on startup
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[Stripe] DATABASE_URL not found, skipping Stripe initialization');
    return;
  }

  try {
    console.log('[Stripe] Initializing schema...');
    await runMigrations({ databaseUrl, schema: 'stripe' });
    console.log('[Stripe] Schema ready');

    const stripeSync = await getStripeSync();

    console.log('[Stripe] Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      { enabled_events: ['*'], description: 'Lead2Lease Stripe webhook' }
    );
    console.log(`[Stripe] Webhook configured: ${webhook.url} (UUID: ${uuid})`);

    // Run data sync in background with better error handling for missing resources
    // Delay sync to not impact startup performance
    setTimeout(() => {
      console.log('[Stripe] Syncing data in background...');
      stripeSync.syncBackfill()
        .then(() => console.log('[Stripe] Data sync complete'))
        .catch((err: any) => {
          // OPTIMIZED: Only log non-critical errors (missing customers/subscriptions are expected in test mode)
          const errorMessage = err?.message || '';
          const errorCode = err?.code || '';
          const isResourceMissing = errorMessage.includes('No such customer') || 
                                   errorMessage.includes('No such subscription') ||
                                   errorCode === 'resource_missing';
          
          if (isResourceMissing) {
            // These are expected errors (test mode data in live mode, deleted resources, etc.)
            // Only log in development to reduce noise
            if (process.env.NODE_ENV === 'development') {
              console.log(`[Stripe] Sync skipped missing resource: ${errorMessage}`);
            }
          } else {
            // Log actual errors
            console.error('[Stripe] Sync error:', err?.message || err);
          }
        });
    }, 10000); // Delay 10 seconds after startup to reduce resource contention
  } catch (error) {
    console.error('[Stripe] Initialization error:', error);
  }
}

(async () => {
  try {
    // Initialize Stripe in background (non-blocking) so server starts faster
    // This prevents slow startup times from Stripe webhook setup and migrations
    initStripe().catch((err) => {
      console.error('[Server] Stripe initialization error (non-blocking):', err);
    });

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("[Error Handler]", err);

      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        res.status(status).json({ message });
      }

      // Don't re-throw - it causes process crashes
      // Log the error instead
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || "5000", 10);
    const host = "0.0.0.0"; // Bind to all network interfaces to allow access from other devices

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `[Server] Port ${port} is already in use. Please stop the existing server or use a different port.`,
        );
        console.error(
          "[Server] To find and kill the process using port 5000, run:",
        );
        console.error("  Windows: netstat -ano | findstr :5000");
        console.error("  Then: taskkill /PID <PID> /F");
        process.exit(1);
      } else {
        console.error("[Server] Server error:", err);
        process.exit(1);
      }
    });

    server.listen(
      {
        port,
        host,
        reusePort: process.platform !== "win32",
      },
      () => {
        log(`serving on port ${port}`);

        // Start Gmail scanner for periodic lead detection
        // TEMPORARILY DISABLED: Commented out to reduce server load
        // Gmail Scanner was running every 5 minutes, scanning 4 organizations,
        // processing 50 messages per org (200 total), causing heavy CPU and database load
        // To re-enable: Uncomment the code below
        /*
        try {
          gmailScanner.start();
        } catch (error) {
          console.error("[Server] Error starting Gmail scanner:", error);
        }
        */
        console.log("[Server] Gmail Scanner is currently disabled (commented out)");

        // Start calendar auto-sync for periodic calendar syncing
        try {
          calendarAutoSync.start();
        } catch (error) {
          console.error("[Server] Error starting calendar auto-sync:", error);
        }

        // Start reminder scheduler for sending showing reminders
        try {
          reminderScheduler.start();
        } catch (error) {
          console.error("[Server] Error starting reminder scheduler:", error);
        }
      },
    );

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error(
        "[Server] Unhandled Rejection at:",
        promise,
        "reason:",
        reason,
      );
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("[Server] Uncaught Exception:", error);
      // Exit on port conflicts
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EADDRINUSE"
      ) {
        console.error("[Server] Port is already in use. Exiting...");
        process.exit(1);
      }
      // Don't exit immediately for other errors - let the error handler deal with it
    });
  } catch (error) {
    console.error("[Server] Fatal error during startup:", error);
    process.exit(1);
  }
})();
