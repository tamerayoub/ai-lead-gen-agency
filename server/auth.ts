import { Router } from "express";
import passport from "./passport";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "@shared/schema";
import { registerSchema, loginSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { getStripeLookupKey } from "./stripeClient";

const router = Router();

// Helper function to get callback URL based on request hostname
function getCallbackUrl(req: Request, path: string): string {
  // CRITICAL: Check if request is from localhost FIRST - always use localhost if detected
  // This prevents production URLs from being used when developing locally
  const requestHost = req.get('host') || req.hostname || '';
  const isLocalhost = requestHost.includes('localhost') || 
                      requestHost.includes('127.0.0.1') || 
                      requestHost.includes(':5000') ||
                      req.hostname === 'localhost' ||
                      req.hostname === '127.0.0.1';
  
  // Check if this is a Replit dev environment
  const isReplitDev = requestHost.includes('.replit.dev') || 
                      requestHost.includes('.repl.co') ||
                      requestHost.includes('.riker.replit.dev');
  
  console.log('[OAuth] getCallbackUrl - requestHost:', requestHost, 'hostname:', req.hostname, 'isLocalhost:', isLocalhost, 'isReplitDev:', isReplitDev);
  
  // If localhost, ALWAYS use localhost regardless of environment variables
  if (isLocalhost) {
    const protocol = 'http'; // Always HTTP for localhost
    const host = 'localhost:5000';
    const callbackUrl = `${protocol}://${host}${path}`;
    console.log('[OAuth] ✅ Localhost detected - using localhost callback URL:', callbackUrl);
    return callbackUrl;
  }
  
  // If Replit dev, stay on the Replit dev domain (don't redirect to production)
  if (isReplitDev) {
    const protocol = 'https';
    const callbackUrl = `${protocol}://${requestHost}${path}`;
    console.log('[OAuth] ✅ Replit dev detected - staying on dev domain:', callbackUrl);
    return callbackUrl;
  }
  
  // Not localhost or Replit dev - this is production
  const isProduction = !!process.env.APP_DOMAIN || !!process.env.PRODUCTION_DOMAIN || process.env.NODE_ENV === "production";
  
  // Determine protocol - check x-forwarded-proto first (for proxies), then req.secure, then hostname
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto === 'https' || req.secure || req.hostname?.includes('lead2lease.ai') || isProduction ? 'https' : 'http';
  
  // Get host from request
  let host = requestHost || 'localhost:5000';
  
  // CRITICAL: For OAuth callbacks on production, use APP_DOMAIN (app.lead2lease.ai) to keep session cookies on the app subdomain
  // This fixes the cross-subdomain cookie issue where login happens on marketing site but app is on app subdomain
  if (isProduction) {
    // Prefer APP_DOMAIN for OAuth callbacks (ensures session cookie is set on app subdomain)
    if (process.env.APP_DOMAIN) {
      host = process.env.APP_DOMAIN.replace(/^https?:\/\//, '').split('/')[0];
      console.log('[OAuth] Using APP_DOMAIN env var for OAuth callback:', host);
    } else if (process.env.PRODUCTION_DOMAIN) {
      // Fallback to PRODUCTION_DOMAIN if APP_DOMAIN not set
      host = process.env.PRODUCTION_DOMAIN.replace(/^https?:\/\//, '').split('/')[0];
      console.log('[OAuth] Fallback to PRODUCTION_DOMAIN env var:', host);
    }
  }
  
  // Remove standard ports (443 for HTTPS, 80 for HTTP)
  if (protocol === 'https') {
    host = host.replace(/:443$/, '');
  } else {
    host = host.replace(/:80$/, '');
  }
  
  const callbackUrl = `${protocol}://${host}${path}`;
  console.log('[OAuth] Generated callback URL:', callbackUrl, 'from host:', requestHost, 'hostname:', req.hostname, 'protocol:', protocol, 'isProduction:', isProduction);
  
  return callbackUrl;
}

/** Apply acquisition context from session to user (first-touch only, never overwrite) */
async function applyAcquisitionFromSession(user: { id: string; initialOffer?: string | null } | null, req: Request): Promise<void> {
  if (!user) return;
  if (user.initialOffer) return; // First-touch only
  const acqCtx = (req.session as any)?.acquisitionContext;
  if (!acqCtx || typeof acqCtx !== "object") return;
  try {
    const { normalizeAcquisitionContext } = await import("./acquisition");
    const normalized = normalizeAcquisitionContext(acqCtx, undefined, undefined);
    if (!normalized) return;
    await db.update(users)
      .set({
        initialOffer: normalized.initialOffer,
        acquisitionContextJson: normalized.acquisitionContextJson,
        firstTouchTs: normalized.firstTouchTs,
        landingPage: normalized.landingPage,
        utmSource: normalized.utmSource,
        utmMedium: normalized.utmMedium,
        utmCampaign: normalized.utmCampaign,
        utmTerm: normalized.utmTerm,
        utmContent: normalized.utmContent,
      })
      .where(eq(users.id, user.id));
    console.log("[OAuth] Applied acquisition from session for user:", user.id);
    delete (req.session as any).acquisitionContext;
  } catch (e) {
    console.error("[OAuth] Error applying acquisition from session:", e);
  }
}

// Email/Password Registration
router.post("/register", async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const onboardingToken = req.body.onboardingToken;
    const acquisitionContext = req.body.acquisition_context;

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, validatedData.email),
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.provider === "email" 
          ? "Email already registered. Please log in." 
          : `This email is already registered with ${existingUser.provider}. Please sign in using ${existingUser.provider}.`
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 10);

    const { normalizeAcquisitionContext } = await import("./acquisition");
    const normalizedAcquisition = normalizeAcquisitionContext(
      acquisitionContext,
      {
        source: req.query.utm_source as string,
        medium: req.query.utm_medium as string,
        campaign: req.query.utm_campaign as string,
        term: req.query.utm_term as string,
        content: req.query.utm_content as string,
      },
      req.query.landing_page as string || req.path
    );

    const userValues: Record<string, unknown> = {
      email: validatedData.email,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      provider: "email",
      passwordHash,
      termsAccepted: validatedData.agreeTerms,
      emailSubscription: validatedData.agreeMarketing,
    };
    if (normalizedAcquisition) {
      userValues.initialOffer = normalizedAcquisition.initialOffer;
      userValues.acquisitionContextJson = normalizedAcquisition.acquisitionContextJson;
      userValues.firstTouchTs = normalizedAcquisition.firstTouchTs;
      userValues.landingPage = normalizedAcquisition.landingPage;
      userValues.utmSource = normalizedAcquisition.utmSource;
      userValues.utmMedium = normalizedAcquisition.utmMedium;
      userValues.utmCampaign = normalizedAcquisition.utmCampaign;
      userValues.utmTerm = normalizedAcquisition.utmTerm;
      userValues.utmContent = normalizedAcquisition.utmContent;
    }

    const [user] = await db.insert(users).values(userValues as any).returning();

        // Link onboarding intake if token provided
        if (onboardingToken) {
          try {
            const { storage } = await import("./storage");
            await storage.linkOnboardingIntakeToUser(onboardingToken, user.id);
            console.log(`[Auth] Linked onboarding intake ${onboardingToken} to user ${user.id}`);
          } catch (error) {
            console.error("[Auth] Failed to link onboarding intake:", error);
            // Don't fail registration if linking fails
          }
        } else {
          // Even without a token, check if user has a linked onboarding intake and ensure they have an org
          try {
            const { storage } = await import("./storage");
            await storage.ensureOrganizationFromOnboarding(user.id);
          } catch (error) {
            console.error("[Auth] Error ensuring organization from onboarding:", error);
          }
        }

        // Log user in
    req.login(user, async (err) => {
      if (err) {
        return res.status(500).json({ message: "Error logging in after registration" });
      }
      
      // Try to link any existing Stripe subscriptions to this user's organization
      try {
        const { linkSubscriptionToUser } = await import("./webhookHandlers");
        await linkSubscriptionToUser(user.email, user.id);
      } catch (error) {
        console.error("[Auth] Error linking subscription after registration:", error);
        // Don't fail registration if subscription linking fails
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin || false,
      });
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: "Server error during registration" });
  }
});

// Email/Password Login
router.post("/login", (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const onboardingToken = req.body.onboardingToken;
    
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Server error during login" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      req.login(user, async (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Error creating session" });
        }
        
        // Clear membership status cache on login to ensure fresh status is fetched
        if (req.session) {
          delete (req.session as any).membershipStatus;
          req.session.save(() => {}); // Save session to persist cache clear
        }
        
        // Link onboarding intake if token provided
        if (onboardingToken) {
          try {
            const { storage } = await import("./storage");
            await storage.linkOnboardingIntakeToUser(onboardingToken, user.id);
            console.log(`[Auth] Linked onboarding intake ${onboardingToken} to user ${user.id} during login`);
          } catch (error) {
            console.error("[Auth] Failed to link onboarding intake during login:", error);
            // Don't fail login if linking fails
          }
        } else {
          // Even without a token, check if user has a linked onboarding intake and ensure they have an org
          try {
            const { storage } = await import("./storage");
            await storage.ensureOrganizationFromOnboarding(user.id);
          } catch (error) {
            console.error("[Auth] Error ensuring organization from onboarding:", error);
          }
        }
        
        // Try to link any existing Stripe subscriptions to this user's organization
        try {
          const { linkSubscriptionToUser } = await import("./webhookHandlers");
          await linkSubscriptionToUser(user.email, user.id);
        } catch (error) {
          console.error("[Auth] Error linking subscription during login:", error);
          // Don't fail login if subscription linking fails
        }
        
        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin || false,
        });
      });
    })(req, res, next);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: "Server error during login" });
  }
});

// Get current user
router.get("/user", async (req, res) => {
  if (req.isAuthenticated()) {
    // OPTIMIZED: Return user from session directly (no database query needed)
    // The session user is already loaded by Passport and is sufficient for most cases
    // Only query DB if we need fresh data (which we don't for basic user info)
    try {
      const user = req.user as any;
      
      // Return session user directly (fast path - no DB query)
      // Include acquisition attribution for analytics/admin
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        company: user.company,
        profileCompleted: user.profileCompleted,
        provider: user.provider,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        termsAccepted: user.termsAccepted,
        emailSubscription: user.emailSubscription,
        currentOrgId: user.currentOrgId,
        isAdmin: user.isAdmin || false,
        initialOffer: user.initialOffer ?? undefined,
        landingPage: user.landingPage ?? undefined,
        utmSource: user.utmSource ?? undefined,
        utmMedium: user.utmMedium ?? undefined,
        utmCampaign: user.utmCampaign ?? undefined,
        utmTerm: user.utmTerm ?? undefined,
        utmContent: user.utmContent ?? undefined,
      });
    } catch (error) {
      console.error('[Auth] Error returning user data:', error);
      res.status(500).json({ error: "Failed to get user data" });
    }
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

// Logout (support both GET and POST for navigation compatibility)
router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('[Auth] Logout error:', err);
      return res.redirect("/login?error=" + encodeURIComponent("Error logging out"));
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error('[Auth] Session destroy error:', destroyErr);
      }
      res.clearCookie("connect.sid");
      res.redirect("/login");
    });
  });
});

router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: "Error logging out" });
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        return res.status(500).json({ message: "Error destroying session" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });
});

// Store OAuth consent and acquisition context in session
router.post("/store-oauth-consent", (req, res) => {
  try {
    const { agreeTerms, agreeMarketing, acquisitionContext } = req.body;
    if (!agreeTerms) {
      return res.status(400).json({ message: "Terms acceptance is required" });
    }
    if (!agreeMarketing) {
      return res.status(400).json({ message: "Marketing consent is required" });
    }
    (req.session as any).oauthConsent = {
      agreeTerms: agreeTerms === true,
      agreeMarketing: agreeMarketing === true,
    };
    if (acquisitionContext && typeof acquisitionContext === "object") {
      (req.session as any).acquisitionContext = acquisitionContext;
    }
    req.session.save((err) => {
      if (err) {
        console.error('[OAuth] Error saving consent to session:', err);
        return res.status(500).json({ message: "Failed to store consent" });
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error('[OAuth] Error storing consent:', error);
    res.status(500).json({ message: "Failed to store consent" });
  }
});

// Google OAuth
router.get(
  "/google",
  (req, res, next) => {
    // Check if this is coming from login page (skip consent check for login)
    const fromLogin = req.query.from === "login";
    
    // Only require consent if NOT coming from login page (i.e., from register page)
    if (!fromLogin) {
      const consent = (req.session as any)?.oauthConsent;
      if (!consent || !consent.agreeTerms) {
        return res.redirect("/register?error=" + encodeURIComponent("Please accept the terms of service and privacy notice to continue."));
      }
    }
    
    // Store redirect path (returnTo or redirect) and onboarding token in session if provided
    const redirectPath = (req.query.returnTo || req.query.redirect) as string;
    const onboardingToken = req.query.onboardingToken as string;
    const fromParam = req.query.from as string;
    console.log('[OAuth] Google init - redirect query param:', redirectPath);
    console.log('[OAuth] Google init - onboarding token:', onboardingToken);
    console.log('[OAuth] Google init - from param:', fromParam, '(type:', typeof fromParam, ')');
    console.log('[OAuth] Google init - session ID:', req.sessionID);
    
    console.log('[OAuth] ===== GOOGLE OAUTH INIT =====');
    console.log('[OAuth] fromParam value:', fromParam, '(type:', typeof fromParam, ')');
    console.log('[OAuth] redirectPath:', redirectPath);
    console.log('[OAuth] onboardingToken:', onboardingToken ? 'present' : 'not present');
    console.log('[OAuth] Session ID before storing:', req.sessionID);
    
    if (redirectPath || onboardingToken || fromParam) {
      if (redirectPath) {
        req.session.oauthRedirect = redirectPath;
        console.log('[OAuth] ✅ Stored oauthRedirect in session:', redirectPath);
      }
      if (onboardingToken) {
        req.session.onboardingToken = onboardingToken;
        console.log('[OAuth] ✅ Stored onboardingToken in session');
      }
      if (fromParam) {
        (req.session as any).oauthFrom = fromParam;
        console.log('[OAuth] ✅ Stored oauthFrom in session:', fromParam);
      }
      
      // Also store fromParam even if redirectPath/onboardingToken aren't present
      if (fromParam && !redirectPath && !onboardingToken) {
        (req.session as any).oauthFrom = fromParam;
        console.log('[OAuth] ✅ Stored oauthFrom in session (fromParam only):', fromParam);
      }
      
      console.log('[OAuth] Storing in session - redirect:', redirectPath, 'onboarding:', onboardingToken, 'from:', fromParam);
      console.log('[OAuth] Session object before save:', {
        oauthRedirect: (req.session as any).oauthRedirect,
        onboardingToken: (req.session as any).onboardingToken,
        oauthFrom: (req.session as any).oauthFrom,
        sessionID: req.sessionID
      });
      
      // Save session before redirecting to OAuth provider
      req.session.save((err) => {
        if (err) {
          console.error('[OAuth] ❌ Error saving to session:', err);
        } else {
          console.log('[OAuth] ✅ Session saved successfully, sessionID:', req.sessionID);
          // Verify what was saved
          console.log('[OAuth] Verifying session after save:', {
            oauthRedirect: (req.session as any).oauthRedirect,
            onboardingToken: (req.session as any).onboardingToken ? 'present' : 'missing',
            oauthFrom: (req.session as any).oauthFrom,
          });
        }
        // Always override callback URL based on request hostname to support both local and production
        const callbackURL = getCallbackUrl(req, "/api/auth/google/callback");
        
        const authOptions: any = { 
          scope: ["profile", "email"],
          callbackURL: callbackURL,
          prompt: "select_account" // Force account selection screen
        };
        console.log('[OAuth] Google using dynamic callback URL:', callbackURL);
        
        passport.authenticate("google", authOptions)(req, res, next);
      });
    } else {
      console.log('[OAuth] ⚠️ No redirect path, onboarding token, or from param provided');
      
      // Even if no redirectPath or onboardingToken, still save fromParam if it exists
      if (fromParam) {
        (req.session as any).oauthFrom = fromParam;
        console.log('[OAuth] ✅ Storing fromParam only:', fromParam);
        req.session.save((err) => {
          if (err) {
            console.error('[OAuth] Error saving fromParam to session:', err);
          } else {
            console.log('[OAuth] ✅ Session saved with fromParam');
          }
          
          const callbackURL = getCallbackUrl(req, "/api/auth/google/callback");
          
          const authOptions: any = { 
            scope: ["profile", "email"],
            callbackURL: callbackURL,
            prompt: "select_account"
          };
          console.log('[OAuth] Google using dynamic callback URL:', callbackURL);
          
          passport.authenticate("google", authOptions)(req, res, next);
        });
        return; // Return early to prevent double execution
      }
      
      console.log('[OAuth] No redirect path, onboarding token, or from param provided, using defaults');
      // Always override callback URL based on request hostname to support both local and production
      const callbackURL = getCallbackUrl(req, "/api/auth/google/callback");
      
      const authOptions: any = { 
        scope: ["profile", "email"],
        callbackURL: callbackURL,
        prompt: "select_account" // Force account selection screen
      };
      console.log('[OAuth] Google using dynamic callback URL:', callbackURL);
      
      passport.authenticate("google", authOptions)(req, res, next);
    }
  }
);

router.get(
  "/google/callback",
  async (req, res, next) => {
    // Log callback details for debugging
    console.log('[OAuth] Google callback received');
    console.log('[OAuth] Request URL:', req.url);
    console.log('[OAuth] Request host:', req.get('host'));
    console.log('[OAuth] Query params:', req.query);
    
    // Use the same dynamic callback URL for verification
    const callbackURL = getCallbackUrl(req, "/api/auth/google/callback");
    const authOptions: any = {
      callbackURL: callbackURL
    };
    console.log('[OAuth] Google callback using dynamic callback URL:', callbackURL);
    
    passport.authenticate("google", authOptions, async (err: any, user: any, info: any) => {
      if (err) {
        console.error('[OAuth] Google auth error:', err);
        console.error('[OAuth] Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
        console.error('[OAuth] Error message:', err?.message);
        console.error('[OAuth] Error stack:', err?.stack);
        // Include more specific error message
        const errorMessage = err?.message || err?.toString() || "Authentication error occurred";
        return res.redirect("/login?error=" + encodeURIComponent(errorMessage));
      }
      
      // If user was just created, update consent from session
      if (user && (req.session as any)?.oauthConsent) {
        const consent = (req.session as any).oauthConsent;
        try {
          await db.update(users)
            .set({
              termsAccepted: consent.agreeTerms,
              emailSubscription: consent.agreeMarketing,
            })
            .where(eq(users.id, user.id));
          console.log('[OAuth] Updated user consent from session:', user.id);
          // Clear consent from session after use
          delete (req.session as any).oauthConsent;
        } catch (updateError) {
          console.error('[OAuth] Error updating user consent:', updateError);
        }
      }
      
      if (!user) {
        console.log('[OAuth] Google auth failed:', info?.message);
        const errorMsg = info?.message || "Google authentication failed";
        return res.redirect("/login?error=" + encodeURIComponent(errorMsg));
      }
      
      console.log('[OAuth] Google callback - User authenticated:', user.id);
      console.log('[OAuth] Session ID before login:', req.sessionID);
      console.log('[OAuth] Session cookie before login:', req.headers.cookie);
      
      // Note: We don't reload the session here because Passport hasn't logged in yet
      // The session reload happens after req.login() when Passport might regenerate the session
      
      // Save redirect path, onboarding token, consent, and from param AFTER session reload
      const savedRedirectPath = (req.session as any)?.oauthRedirect;
      const savedOnboardingToken = (req.session as any)?.onboardingToken;
      const savedConsent = (req.session as any)?.oauthConsent;
      const savedFrom = (req.session as any)?.oauthFrom;
      console.log('[OAuth] ===== READING SESSION DATA AFTER RELOAD =====');
      console.log('[OAuth] Session ID after reload:', req.sessionID);
      console.log('[OAuth] Saved redirect path after reload:', savedRedirectPath);
      console.log('[OAuth] Saved onboarding token after reload:', savedOnboardingToken);
      console.log('[OAuth] Saved consent after reload:', savedConsent);
      console.log('[OAuth] Saved from param after reload:', savedFrom);
      console.log('[OAuth] Full session object keys:', Object.keys(req.session));
      
      // Update user consent from session if available
      if (savedConsent) {
        try {
          await db.update(users)
            .set({
              termsAccepted: savedConsent.agreeTerms,
              emailSubscription: savedConsent.agreeMarketing,
            })
            .where(eq(users.id, user.id));
          console.log('[OAuth] Updated user consent from session:', user.id);
          // Clear consent from session after use
          delete (req.session as any).oauthConsent;
        } catch (updateError) {
          console.error('[OAuth] Error updating user consent:', updateError);
        }
      }

      // Apply acquisition context from session (first-touch only)
      await applyAcquisitionFromSession(user, req);
      
      req.login(user, async (loginErr) => {
        if (loginErr) {
          console.error('[OAuth] Login error:', loginErr);
          return res.redirect("/login?error=" + encodeURIComponent("Error creating session"));
        }
        
        console.log('[OAuth] Session ID after login:', req.sessionID);
        console.log('[OAuth] User authenticated in session:', req.isAuthenticated());
        
        // CRITICAL: Save session immediately after login to ensure it's persisted
        // Passport might have regenerated the session, so we need to save it
        await new Promise<void>((resolve) => {
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error('[OAuth] Error saving session after login:', saveErr);
            } else {
              console.log('[OAuth] ✅ Session saved after login, sessionID:', req.sessionID);
            }
            resolve();
          });
        });
        
        // Link onboarding intake if token was provided
        if (savedOnboardingToken) {
          try {
            const { storage } = await import("./storage");
            await storage.linkOnboardingIntakeToUser(savedOnboardingToken, user.id);
            console.log(`[OAuth] Linked onboarding intake ${savedOnboardingToken} to user ${user.id}`);
          } catch (error) {
            console.error("[OAuth] Failed to link onboarding intake:", error);
          }
        } else {
          // Even without a token, check if user has a linked onboarding intake and ensure they have an org
          try {
            const { storage } = await import("./storage");
            await storage.ensureOrganizationFromOnboarding(user.id);
          } catch (error) {
            console.error("[OAuth] Error ensuring organization from onboarding:", error);
          }
        }
        
        // Try to link any existing Stripe subscriptions to this user's organization
        try {
          const { linkSubscriptionToUser } = await import("./webhookHandlers");
          await linkSubscriptionToUser(user.email, user.id);
        } catch (error) {
          console.error("[OAuth] Error linking subscription:", error);
        }
        
        // Determine redirect path based on context
        let redirectPath = savedRedirectPath;
        
        console.log('[OAuth] ===== STARTING REDIRECT LOGIC =====');
        console.log('[OAuth] savedFrom:', savedFrom);
        console.log('[OAuth] savedRedirectPath:', savedRedirectPath);
        console.log('[OAuth] Request hostname:', req.get('host'));
        console.log('[OAuth] Request origin:', req.get('origin'));
        console.log('[OAuth] User ID:', user.id);
        console.log('[OAuth] User email:', user.email);
        
        // CRITICAL: Set a timeout to ensure redirect happens even if membership check hangs
        const redirectTimeout = setTimeout(() => {
          if (!redirectPath) {
            console.log('[OAuth] ⚠️ Redirect timeout - defaulting to /app');
            redirectPath = "/app";
          }
        }, 5000); // 5 second max wait
        
        try {
          // CRITICAL: Check membership FIRST, before checking redirect path
          // If user has active membership (one-time payment or subscription), they should go to /app
          // Only redirect to checkout if they DON'T have active membership
          {
            // CRITICAL: Check if user has membership REGARDLESS of savedFrom
            // If user has an organization with active membership, they should go to /app
            // This is a fallback in case savedFrom is lost due to session regeneration
            let shouldCheckMembership = savedFrom === "login";
            
            // If savedFrom is undefined but user has no savedRedirectPath and no savedConsent,
            // they likely came from login page (registration would have consent)
            if (!savedFrom && !savedRedirectPath && !savedConsent) {
              console.log('[OAuth] ⚠️ savedFrom is undefined but no consent/redirectPath - likely from login page, checking membership anyway');
              shouldCheckMembership = true;
            }
            
            if (shouldCheckMembership) {
              console.log('[OAuth] ✅ Coming from login page - checking membership status (OPTIMIZED)');
              // OPTIMIZED: Quick database check first, then minimal Stripe verification if needed
              try {
                const { storage } = await import("./storage");
                
                // Quick database check - get user and orgs
                const refreshedUser = await storage.getUser(user.id);
                if (!refreshedUser) {
                  console.log(`[OAuth] ❌ User ${user.id} not found`);
                  redirectPath = "/waitlist";
                } else {
                  const userOrgs = await storage.getUserOrganizations(user.id);
                  console.log(`[OAuth] User has ${userOrgs.length} organization(s)`);
                  
                  if (userOrgs.length === 0) {
                    console.log('[OAuth] ❌ User has no organizations, redirecting to waitlist');
                    redirectPath = "/waitlist";
                  } else {
                    let orgHasActiveSubscription = false;
                    let activeOrgId: string | null = null;
                    
                    // FAST PATH: Check database status first (no API calls)
                    for (const userOrg of userOrgs) {
                      const org = await storage.getOrganization(userOrg.orgId);
                      if (!org) continue;
                      
                      // Quick check - if DB says active, trust it and redirect immediately
                      if (org.foundingPartnerStatus === 'active') {
                        orgHasActiveSubscription = true;
                        activeOrgId = userOrg.orgId;
                        console.log(`[OAuth] ✅ Found active org ${userOrg.orgId} in database (fast path)`);
                        break;
                      }
                    }
                    
                    // SLOW PATH: Only if fast path didn't find active membership, do quick Stripe check with timeout
                    if (!orgHasActiveSubscription) {
                      console.log('[OAuth] Fast path found no active membership, doing quick Stripe verification (max 1s timeout)');
                      
                      // Quick Stripe check with strict timeout - only check subscription IDs, skip line items
                      const stripeCheckPromise = (async () => {
                        try {
                          const { getUncachableStripeClient } = await import("./stripeClient");
                          const stripe = await getUncachableStripeClient();
                          
                          for (const userOrg of userOrgs) {
                            const org = await storage.getOrganization(userOrg.orgId);
                            if (!org) continue;
                            
                            // Quick subscription check only (fastest API call)
                            if (org.stripeSubscriptionId) {
                              try {
                                const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
                                if (sub.status === 'active' || sub.status === 'trialing') {
                                  orgHasActiveSubscription = true;
                                  activeOrgId = userOrg.orgId;
                                  // Update DB for next time
                                  await storage.updateOrganization(userOrg.orgId, {
                                    foundingPartnerStatus: 'active',
                                  });
                                  console.log(`[OAuth] ✅ Found active subscription for org ${userOrg.orgId} (quick check)`);
                                  break;
                                }
                              } catch (err) {
                                // Skip errors, continue to next org
                              }
                            }
                          }
                        } catch (error) {
                          console.error('[OAuth] Stripe check error:', error);
                        }
                      })();
                      
                      // Wait max 1 second for Stripe check (reduced from 2s for faster redirect)
                      try {
                        await Promise.race([
                          stripeCheckPromise,
                          new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Stripe check timeout')), 1000)
                          )
                        ]);
                      } catch (timeoutError) {
                        console.log('[OAuth] Stripe check timed out or failed, using database status');
                      }
                      
                      // Background: Do full verification after redirect (fire and forget)
                      setImmediate(async () => {
                        try {
                          console.log('[OAuth] Background: Starting full membership verification');
                          const { getUncachableStripeClient } = await import("./stripeClient");
                          const stripe = await getUncachableStripeClient();
                          const expectedLookupKey = getStripeLookupKey();
                          
                          for (const userOrg of userOrgs) {
                            const org = await storage.getOrganization(userOrg.orgId);
                            if (!org || org.foundingPartnerStatus === 'active') continue;
                            
                            // Check one-time payments if customer ID exists
                            if (org.stripeCustomerId && expectedLookupKey) {
                              try {
                                const checkoutSessions = await stripe.checkout.sessions.list({
                                  customer: org.stripeCustomerId,
                                  limit: 10, // Only check recent sessions
                                });
                                
                                const successfulPayments = checkoutSessions.data.filter(s => 
                                  s.mode === 'payment' && s.payment_status === 'paid'
                                );
                                
                                for (const session of successfulPayments.slice(0, 3)) { // Only check first 3
                                  try {
                                    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
                                    for (const item of lineItems.data) {
                                      if (item.price?.lookup_key === expectedLookupKey) {
                                        await storage.updateOrganization(userOrg.orgId, {
                                          foundingPartnerStatus: 'active',
                                        });
                                        console.log(`[OAuth] Background: Updated org ${userOrg.orgId} to active`);
                                        break;
                                      }
                                    }
                                  } catch (err) {
                                    // Skip errors
                                  }
                                }
                              } catch (err) {
                                // Skip errors
                              }
                            }
                          }
                        } catch (error) {
                          console.error('[OAuth] Background verification error:', error);
                        }
                      });
                    }
                    
                    // Determine redirect path - only admin/owner roles can access the app
                    const hasAdminRole = userOrgs.some((o: { role?: string }) => o.role === 'admin' || o.role === 'owner');
                    if (orgHasActiveSubscription && activeOrgId && hasAdminRole) {
                      // Update currentOrgId if needed (non-blocking)
                      if (refreshedUser.currentOrgId !== activeOrgId) {
                        storage.updateUser(user.id, { currentOrgId: activeOrgId }).catch(err => 
                          console.error('[OAuth] Error updating currentOrgId:', err)
                        );
                      }
                      
                      const hostname = req.get('host') || req.hostname || '';
                      const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes(':5000');
                      const isProduction = !isLocalhost && (hostname.includes('lead2lease.ai') || process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production');
                      
                      if (savedRedirectPath && savedRedirectPath !== '/founding-partner-checkout' && !savedRedirectPath.includes('founding-partner-checkout')) {
                        redirectPath = savedRedirectPath;
                      } else if (isLocalhost) {
                        redirectPath = "/app";
                      } else if (isProduction) {
                        redirectPath = "https://app.lead2lease.ai";
                      } else {
                        redirectPath = "/app";
                      }
                      console.log('[OAuth] ✅ User has active membership and admin role, redirecting to:', redirectPath);
                    } else if (orgHasActiveSubscription && !hasAdminRole) {
                      redirectPath = "/waitlist";
                      console.log('[OAuth] User has membership but no admin role, redirecting to waitlist');
                    } else {
                      redirectPath = "/waitlist";
                      console.log(`[OAuth] ❌ No active membership found, redirecting to waitlist`);
                    }
                  }
                }
              } catch (error) {
                console.error("[OAuth] ❌ Error checking membership status:", error);
                redirectPath = "/app"; // Default to app instead of checkout on error
              }
            } else {
              console.log('[OAuth] ⚠️ Membership check not triggered (savedFrom:', savedFrom, ')');
              // If not checking membership, default to app
              if (!redirectPath) {
                const hostname = req.get('host') || req.hostname || '';
                const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes(':5000');
                redirectPath = isLocalhost ? "/app" : (hostname.includes('lead2lease.ai') ? "https://app.lead2lease.ai" : "/app");
              }
            }
          }
        } finally {
          clearTimeout(redirectTimeout);
        }
        
        // Handle other redirect scenarios
        if (!redirectPath) {
          if (savedConsent) {
            // Has consent in session = coming from register page (new registration)
            redirectPath = savedRedirectPath || "/waitlist";
            console.log('[OAuth] New user registration (has consent), redirecting to waitlist:', redirectPath);
          } else {
            // Default: if no saved redirect path, go to waitlist (new registration)
            redirectPath = savedRedirectPath || "/waitlist";
            console.log('[OAuth] Default redirect (likely new registration) to:', redirectPath);
          }
        }
        
        // OLD CODE REMOVED - replaced with new logic above
        /*
        if (savedFrom === "login") {
          // Coming from login page - check membership status
          // BEST PRACTICE: Check organization's subscription status directly (works for ALL users in org)
          try {
            const { storage } = await import("./storage");
            const membership = await storage.getUserOrganization(user.id);
            
            if (membership) {
              // User has an organization - check if it has active subscription
              const org = await storage.getOrganization(membership.orgId);
              
              // BEST PRACTICE: Check organization's subscription directly, not by user email
              // This works for ALL users (owner, admin, members) since subscription belongs to org
              let orgHasActiveSubscription = false;
              
              if (org?.stripeSubscriptionId) {
                // Org has subscription ID - verify it's active in Stripe
                try {
                  const { getUncachableStripeClient } = await import("./stripeClient");
                  const stripe = await getUncachableStripeClient();
                  const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
                  
                  if (sub.status === 'active' || sub.status === 'trialing') {
                    orgHasActiveSubscription = true;
                    // Update org status if needed
                    if (org.foundingPartnerStatus !== 'active') {
                      await storage.updateOrganization(membership.orgId, {
                        foundingPartnerStatus: 'active',
                        subscriptionCurrentPeriodEnd: new Date((sub as any).current_period_end * 1000),
                      });
                    }
                    console.log(`[OAuth] Org ${membership.orgId} has active subscription ${org.stripeSubscriptionId} (verified in Stripe)`);
                  } else {
                    console.log(`[OAuth] Org ${membership.orgId} subscription ${org.stripeSubscriptionId} is ${sub.status} (not active)`);
                  }
                } catch (stripeError) {
                  console.error(`[OAuth] Error verifying subscription:`, stripeError);
                  // Fall back to database status
                  orgHasActiveSubscription = org?.foundingPartnerStatus === 'active';
                }
              } else if (org?.stripeCustomerId) {
                // Org has customer ID but no subscription ID - search for active subscription
                try {
                  const { getUncachableStripeClient } = await import("./stripeClient");
                  const stripe = await getUncachableStripeClient();
                  const activeSubscriptions = await stripe.subscriptions.list({
                    customer: org.stripeCustomerId,
                    status: 'active',
                    limit: 10,
                  });
                  
                  // Find founding partner subscription
                  for (const sub of activeSubscriptions.data) {
                    const hasFoundingPartnerMetadata = sub.metadata?.membershipType === 'founding_partner' || sub.metadata?.organization_id === membership.orgId;
                    const is149Price = sub.items.data.some(item => 
                      item.price.unit_amount === 14999 && item.price.recurring?.interval === 'month'
                    );
                    
                    if (hasFoundingPartnerMetadata || is149Price) {
                      // Found active subscription - link it to org
                      await storage.updateOrganization(membership.orgId, {
                        foundingPartnerStatus: 'active',
                        stripeSubscriptionId: sub.id,
                        subscriptionCurrentPeriodEnd: new Date((sub as any).current_period_end * 1000),
                      });
                      orgHasActiveSubscription = true;
                      console.log(`[OAuth] ✅ Found and linked active subscription ${sub.id} to org ${membership.orgId}`);
                      break;
                    }
                  }
                } catch (stripeError) {
                  console.error(`[OAuth] Error searching for subscription:`, stripeError);
                  // Fall back to database status
                  orgHasActiveSubscription = org?.foundingPartnerStatus === 'active';
                }
              } else {
                // No subscription ID or customer ID - check database status
                orgHasActiveSubscription = org?.foundingPartnerStatus === 'active';
              }
              
              console.log(`[OAuth] User ${user.email} (role: ${membership.role}) - Org ${membership.orgId} has active subscription: ${orgHasActiveSubscription}`);
              
              if (orgHasActiveSubscription) {
                // User's organization has active membership - redirect to app (works for ALL users in org)
                // Check if we're in production by request hostname
                const hostname = req.get('host') || req.hostname || '';
                const isProduction = hostname.includes('lead2lease.ai') || process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
                
                if (savedRedirectPath) {
                  redirectPath = savedRedirectPath;
                } else if (isProduction) {
                  // In production, redirect to app.lead2lease.ai
                  redirectPath = "https://app.lead2lease.ai";
                } else {
                  // Local or test dev - use /app
                  redirectPath = "/app";
                }
                console.log('[OAuth] ✅ Organization has active membership, redirecting to:', redirectPath, '(production:', isProduction, ')');
              } else {
                // Organization does not have active subscription - redirect to checkout
                redirectPath = "/founding-partner-checkout";
                console.log(`[OAuth] Organization does not have active subscription, redirecting to checkout`);
              }
            } else {
              // User has no organization, redirect to checkout
              redirectPath = "/founding-partner-checkout";
              console.log('[OAuth] User has no organization, redirecting to checkout');
            }
          } catch (error) {
            console.error("[OAuth] Error checking membership status:", error);
            // On error, use saved redirect path or default to checkout
            redirectPath = savedRedirectPath || "/founding-partner-checkout";
          }
        }
        */
        
        // Validate and sanitize redirect path to prevent open redirects
        if (redirectPath && typeof redirectPath === 'string') {
          try {
            // Decode if it was URL encoded
            try {
              redirectPath = decodeURIComponent(redirectPath);
            } catch (e) {
              // If decoding fails, use as-is (might not be encoded)
              console.log('[OAuth] Redirect path not URL encoded, using as-is');
            }
            
            // Check if we're on localhost - if so, ensure we use relative paths
            const requestHost = req.get('host') || req.hostname || '';
            const isLocalhost = requestHost.includes('localhost') || 
                               requestHost.includes('127.0.0.1') || 
                               requestHost.includes(':5000') ||
                               req.hostname === 'localhost' ||
                               req.hostname === '127.0.0.1';
            
            console.log('[OAuth] Final redirect validation - requestHost:', requestHost, 'isLocalhost:', isLocalhost);
            console.log('[OAuth] redirectPath before sanitization:', redirectPath);
            
            // If redirectPath is a full URL and we're on localhost, convert to relative path
            if (redirectPath.startsWith('http') && isLocalhost) {
              console.log('[OAuth] ⚠️ Full URL detected on localhost, converting to relative path');
              const urlMatch = redirectPath.match(/https?:\/\/[^\/]+(\/.*)$/);
              if (urlMatch) {
                redirectPath = urlMatch[1];
                console.log('[OAuth] Converted to relative path:', redirectPath);
              }
            }
            
            // Allow specific trusted domains (app.lead2lease.ai) or relative paths
            const isTrustedDomain = redirectPath.startsWith('https://app.lead2lease.ai') || 
                                   redirectPath.startsWith('https://lead2lease.ai');
            
            if (!isTrustedDomain && !redirectPath.startsWith('/') && redirectPath !== '') {
              console.warn('[OAuth] Invalid redirect path (not relative or trusted domain), using default:', redirectPath);
              redirectPath = '/';
            }
            
            // Only sanitize non-trusted external URLs
            if (!isTrustedDomain) {
              // Remove any protocol or domain to prevent open redirects
              redirectPath = redirectPath.replace(/^https?:\/\/[^\/]+/, '');
              if (!redirectPath.startsWith('/')) {
                redirectPath = '/' + redirectPath;
              }
            }
            
            // Preserve query parameters but validate the base path
            const urlParts = redirectPath.split('?');
            const basePath = urlParts[0];
            const queryString = urlParts.length > 1 ? '?' + urlParts.slice(1).join('?') : '';
            
            // Ensure base path is valid (no null bytes, etc.)
            if (basePath.includes('\0') || basePath.length > 2048) {
              console.warn('[OAuth] Redirect path contains invalid characters or too long, using default');
              redirectPath = '/';
            } else {
              redirectPath = basePath + queryString;
            }
          } catch (error) {
            console.error('[OAuth] Error processing redirect path:', error);
            redirectPath = '/';
          }
        } else {
          redirectPath = '/';
        }
        
        // Clear oauthFrom from session after use
        if ((req.session as any).oauthFrom) {
          delete (req.session as any).oauthFrom;
        }
        
        // CRITICAL: Ensure redirectPath is always set
        if (!redirectPath) {
          const hostname = req.get('host') || req.hostname || '';
          const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes(':5000');
          redirectPath = isLocalhost ? "/app" : (hostname.includes('lead2lease.ai') ? "https://app.lead2lease.ai" : "/app");
          console.log('[OAuth] ⚠️ No redirect path set, defaulting to:', redirectPath);
        }
        
        console.log('[OAuth] ===== FINAL REDIRECT =====');
        console.log('[OAuth] Final redirectPath:', redirectPath);
        console.log('[OAuth] Request hostname:', req.get('host'));
        console.log('[OAuth] Request origin:', req.get('origin'));
        console.log('[OAuth] Full redirect URL will be:', redirectPath.startsWith('http') ? redirectPath : (req.protocol + '://' + req.get('host') + redirectPath));
        
        // Verify session is authenticated
        if (!req.isAuthenticated()) {
          console.error('[OAuth] ⚠️ WARNING: Session not authenticated before redirect!');
          return res.redirect("/login?error=" + encodeURIComponent("Session was not properly created"));
        }
        
        // Save session before redirecting to ensure session is persisted
        // Use a timeout to ensure redirect happens even if session save hangs
        const sessionSaveTimeout = setTimeout(() => {
          console.log('[OAuth] ⚠️ Session save timeout - redirecting anyway');
          res.redirect(302, redirectPath);
        }, 2000); // 2 second max wait for session save
        
        req.session.save((saveErr) => {
          clearTimeout(sessionSaveTimeout);
          
          if (saveErr) {
            console.error('[OAuth] Error saving session before redirect:', saveErr);
            // Still redirect even if session save fails
          } else {
            console.log('[OAuth] ✅ Session saved before redirect, sessionID:', req.sessionID);
            console.log('[OAuth] Session authenticated:', req.isAuthenticated());
            console.log('[OAuth] Session cookie settings:', {
              name: req.session?.cookie?.name || 'connect.sid',
              httpOnly: req.session?.cookie?.httpOnly,
              secure: req.session?.cookie?.secure,
              sameSite: req.session?.cookie?.sameSite,
              path: req.session?.cookie?.path,
            });
          }
          
          // Set redirect header explicitly after ensuring session is saved
          // The session cookie should be in the response headers now
          // Use a 302 redirect (temporary) to ensure cookie is sent
          res.redirect(302, redirectPath);
        });
      });
    })(req, res, next);
  }
);

// Microsoft OAuth
router.get(
  "/microsoft",
  (req, res, next) => {
    // Store redirect path (returnTo or redirect) and onboarding token in session if provided
    const redirectPath = (req.query.returnTo || req.query.redirect) as string;
    const onboardingToken = req.query.onboardingToken as string;
    
    // Always override callback URL based on request hostname to support both local and production
    const callbackURL = getCallbackUrl(req, "/api/auth/microsoft/callback");
    const authOptions: any = {
      callbackURL: callbackURL
    };
    console.log('[OAuth] Microsoft using dynamic callback URL:', callbackURL);
    
    if (redirectPath || onboardingToken) {
      if (redirectPath) req.session.oauthRedirect = redirectPath;
      if (onboardingToken) req.session.onboardingToken = onboardingToken;
      // Save session before redirecting to OAuth provider
      req.session.save((err) => {
        if (err) {
          console.error('[OAuth] Error saving to session:', err);
        }
        passport.authenticate("microsoft", authOptions)(req, res, next);
      });
    } else {
      passport.authenticate("microsoft", authOptions)(req, res, next);
    }
  }
);

router.get(
  "/microsoft/callback",
  passport.authenticate("microsoft", { failureRedirect: "/login?error=microsoft_auth_failed" }),
  async (req, res) => {
    let redirectPath = (req.session as any).oauthRedirect || "/";
    const onboardingToken = (req.session as any).onboardingToken;
    delete (req.session as any).oauthRedirect;
    delete (req.session as any).onboardingToken;
    
    const user = req.user as any;

    // Apply acquisition context from session (first-touch only)
    await applyAcquisitionFromSession(user, req);
    
    // Link onboarding intake if token was provided
    if (onboardingToken && user) {
      try {
        const { storage } = await import("./storage");
        await storage.linkOnboardingIntakeToUser(onboardingToken, user.id);
        console.log(`[OAuth] Linked onboarding intake ${onboardingToken} to user ${user.id}`);
      } catch (error) {
        console.error("[OAuth] Failed to link onboarding intake:", error);
      }
    } else if (user) {
      // Even without a token, check if user has a linked onboarding intake and ensure they have an org
      try {
        const { storage } = await import("./storage");
        await storage.ensureOrganizationFromOnboarding(user.id);
      } catch (error) {
        console.error("[OAuth] Error ensuring organization from onboarding:", error);
      }
    }
    
    // Try to link any existing Stripe subscriptions to this user's organization
    try {
      const { linkSubscriptionToUser } = await import("./webhookHandlers");
      await linkSubscriptionToUser(user.email, user.id);
    } catch (error) {
      console.error("[OAuth] Error linking subscription:", error);
    }
    
    // Check if user is part of an organization with active membership
    if (user) {
      try {
        const { storage } = await import("./storage");
        const userOrgs = await storage.getUserOrganizations(user.id);
        
        if (userOrgs.length > 0) {
          let orgHasActiveSubscription = false;
          
          // Check each organization for active subscription
          for (const userOrg of userOrgs) {
            const org = await storage.getOrganization(userOrg.orgId);
            if (!org) continue;
            
            if (org.foundingPartnerStatus === 'active') {
              orgHasActiveSubscription = true;
              break;
            } else if (org.stripeSubscriptionId) {
              try {
                const { getUncachableStripeClient } = await import("./stripeClient");
                const stripe = await getUncachableStripeClient();
                const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
                
                if (sub.status === 'active' || sub.status === 'trialing') {
                  orgHasActiveSubscription = true;
                  break;
                }
              } catch (stripeError) {
                console.error(`[OAuth] Error verifying subscription for org ${userOrg.orgId}:`, stripeError);
              }
            }
          }
          
          if (orgHasActiveSubscription) {
            // User has active membership - redirect to app (unless redirectPath is not checkout)
            if (redirectPath === '/founding-partner-checkout' || redirectPath.includes('founding-partner-checkout')) {
              const hostname = req.get('host') || req.hostname || '';
              const isProduction = hostname.includes('lead2lease.ai') || process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
              redirectPath = isProduction ? "https://app.lead2lease.ai" : "/app";
              console.log('[OAuth Microsoft] ✅ Organization has active membership, redirecting to app instead of checkout');
            }
          }
        }
      } catch (error) {
        console.error("[OAuth Microsoft] Error checking membership status:", error);
      }
    }
    
    res.redirect(redirectPath);
  }
);

// Facebook OAuth
router.get(
  "/facebook",
  (req, res, next) => {
    // Check if this is coming from login page (skip consent check for login)
    const fromLogin = req.query.from === "login";
    
    // Only require consent if NOT coming from login page (i.e., from register page)
    if (!fromLogin) {
      const consent = (req.session as any)?.oauthConsent;
      if (!consent || !consent.agreeTerms) {
        return res.redirect("/register?error=" + encodeURIComponent("Please accept the terms of service and privacy notice to continue."));
      }
    }
    
    // Store redirect path (returnTo or redirect) and onboarding token in session if provided
    const redirectPath = (req.query.returnTo || req.query.redirect) as string;
    const onboardingToken = req.query.onboardingToken as string;
    
    // Always override callback URL based on request hostname to support both local and production
    const callbackURL = getCallbackUrl(req, "/api/auth/facebook/callback");
    const authOptions: any = { 
      scope: ["email"],
      callbackURL: callbackURL
    };
    console.log('[OAuth] Facebook using dynamic callback URL:', callbackURL);
    
    if (redirectPath || onboardingToken) {
      if (redirectPath) req.session.oauthRedirect = redirectPath;
      if (onboardingToken) req.session.onboardingToken = onboardingToken;
      // Save session before redirecting to OAuth provider
      req.session.save((err) => {
        if (err) {
          console.error('[OAuth] Error saving to session:', err);
        }
        passport.authenticate("facebook", authOptions)(req, res, next);
      });
    } else {
      passport.authenticate("facebook", authOptions)(req, res, next);
    }
  }
);

router.get(
  "/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/login?error=facebook_auth_failed" }),
  async (req, res) => {
    let redirectPath = (req.session as any).oauthRedirect || "/";
    const onboardingToken = (req.session as any).onboardingToken;
    const savedConsent = (req.session as any).oauthConsent;
    delete (req.session as any).oauthRedirect;
    delete (req.session as any).onboardingToken;
    
    const user = req.user as any;
    
    // Update user consent from session if available
    if (user && savedConsent) {
      try {
        await db.update(users)
          .set({
            termsAccepted: savedConsent.agreeTerms,
            emailSubscription: savedConsent.agreeMarketing,
          })
          .where(eq(users.id, user.id));
        console.log('[OAuth] Updated Facebook user consent from session:', user.id);
        delete (req.session as any).oauthConsent;
      } catch (updateError) {
        console.error('[OAuth] Error updating Facebook user consent:', updateError);
      }
    }

    // Apply acquisition context from session (first-touch only)
    await applyAcquisitionFromSession(user, req);
    
    // Link onboarding intake if token was provided
    if (onboardingToken && user) {
      try {
        const { storage } = await import("./storage");
        await storage.linkOnboardingIntakeToUser(onboardingToken, user.id);
        console.log(`[OAuth] Linked onboarding intake ${onboardingToken} to user ${user.id}`);
      } catch (error) {
        console.error("[OAuth] Failed to link onboarding intake:", error);
      }
    } else if (user) {
      // Even without a token, check if user has a linked onboarding intake and ensure they have an org
      try {
        const { storage } = await import("./storage");
        await storage.ensureOrganizationFromOnboarding(user.id);
      } catch (error) {
        console.error("[OAuth] Error ensuring organization from onboarding:", error);
      }
    }
    
    // Try to link any existing Stripe subscriptions to this user's organization
    if (user) {
      try {
        const { linkSubscriptionToUser } = await import("./webhookHandlers");
        await linkSubscriptionToUser(user.email, user.id);
      } catch (error) {
        console.error("[OAuth] Error linking subscription:", error);
      }
    }
    
    // Check if user is part of an organization with active membership
    if (user) {
      try {
        const { storage } = await import("./storage");
        const userOrgs = await storage.getUserOrganizations(user.id);
        
        if (userOrgs.length > 0) {
          let orgHasActiveSubscription = false;
          
          // Check each organization for active subscription
          for (const userOrg of userOrgs) {
            const org = await storage.getOrganization(userOrg.orgId);
            if (!org) continue;
            
            if (org.foundingPartnerStatus === 'active') {
              orgHasActiveSubscription = true;
              break;
            } else if (org.stripeSubscriptionId) {
              try {
                const { getUncachableStripeClient } = await import("./stripeClient");
                const stripe = await getUncachableStripeClient();
                const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
                
                if (sub.status === 'active' || sub.status === 'trialing') {
                  orgHasActiveSubscription = true;
                  break;
                }
              } catch (stripeError) {
                console.error(`[OAuth] Error verifying subscription for org ${userOrg.orgId}:`, stripeError);
              }
            }
          }
          
          // Only admin/owner roles can access the app
          const hasAdminRole = userOrgs.some((o: { role?: string }) => o.role === 'admin' || o.role === 'owner');
          if (orgHasActiveSubscription && hasAdminRole) {
            // PRIORITY: If returnTo is explicitly set to checkout, always respect it
            const decodedRedirectPath = redirectPath ? decodeURIComponent(redirectPath) : null;
            if (decodedRedirectPath === '/founding-partner-checkout' || redirectPath === '/founding-partner-checkout' || redirectPath?.includes('founding-partner-checkout')) {
              redirectPath = "/founding-partner-checkout";
              console.log('[OAuth Facebook] ✅ returnTo is checkout page - redirecting to checkout regardless of existing membership');
            } else {
              const hostname = req.get('host') || req.hostname || '';
              const isProduction = hostname.includes('lead2lease.ai') || process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
              redirectPath = isProduction ? "https://app.lead2lease.ai" : "/app";
              console.log('[OAuth Facebook] ✅ Organization has active membership and admin role, redirecting to app');
            }
          } else if (orgHasActiveSubscription && !hasAdminRole) {
            redirectPath = "/waitlist";
            console.log('[OAuth Facebook] User has membership but no admin role, redirecting to waitlist');
          } else {
            redirectPath = "/waitlist";
            console.log('[OAuth Facebook] No active membership, redirecting to waitlist');
          }
        } else {
          redirectPath = "/waitlist";
          console.log('[OAuth Facebook] User has no organizations, redirecting to waitlist');
        }
      } catch (error) {
        console.error("[OAuth Facebook] Error checking membership status:", error);
      }
    }
    
    // Check if trying to access admin routes
    if (redirectPath.startsWith('/admin')) {
      if (!user?.isAdmin) {
        console.log('[OAuth] Non-admin user attempted to access admin route:', user?.email);
        return res.redirect("/admin?error=" + encodeURIComponent("Access denied. Admin privileges required."));
      }
    }
    
    res.redirect(redirectPath);
  }
);

// Microsoft OAuth (duplicate route - keeping for compatibility)
router.get(
  "/microsoft",
  (req, res, next) => {
    // Check if consent is stored in session
    const consent = (req.session as any)?.oauthConsent;
    if (!consent || !consent.agreeTerms) {
      return res.redirect("/register?error=" + encodeURIComponent("Please accept the terms of service and privacy notice to continue."));
    }
    
    // Store redirect path (returnTo or redirect) and onboarding token in session if provided
    const redirectPath = (req.query.returnTo || req.query.redirect) as string;
    const onboardingToken = req.query.onboardingToken as string;
    
    // Always override callback URL based on request hostname to support both local and production
    const callbackURL = getCallbackUrl(req, "/api/auth/microsoft/callback");
    const authOptions: any = {
      callbackURL: callbackURL
    };
    console.log('[OAuth] Microsoft using dynamic callback URL:', callbackURL);
    
    if (redirectPath || onboardingToken) {
      if (redirectPath) req.session.oauthRedirect = redirectPath;
      if (onboardingToken) req.session.onboardingToken = onboardingToken;
      // Save session before redirecting to OAuth provider
      req.session.save((err) => {
        if (err) {
          console.error('[OAuth] Error saving to session:', err);
        }
        passport.authenticate("microsoft", authOptions)(req, res, next);
      });
    } else {
      passport.authenticate("microsoft", authOptions)(req, res, next);
    }
  }
);

router.get(
  "/microsoft/callback",
  passport.authenticate("microsoft", { failureRedirect: "/login?error=microsoft_auth_failed" }),
  async (req, res) => {
    let redirectPath = (req.session as any).oauthRedirect || "/";
    const onboardingToken = (req.session as any).onboardingToken;
    const savedConsent = (req.session as any).oauthConsent;
    delete (req.session as any).oauthRedirect;
    delete (req.session as any).onboardingToken;
    
    const user = req.user as any;
    
    // Update user consent from session if available
    if (user && savedConsent) {
      try {
        await db.update(users)
          .set({
            termsAccepted: savedConsent.agreeTerms,
            emailSubscription: savedConsent.agreeMarketing,
          })
          .where(eq(users.id, user.id));
        console.log('[OAuth] Updated Microsoft user consent from session:', user.id);
        delete (req.session as any).oauthConsent;
      } catch (updateError) {
        console.error('[OAuth] Error updating Microsoft user consent:', updateError);
      }
    }
    
    // Link onboarding intake if token was provided
    if (onboardingToken && user) {
      try {
        const { storage } = await import("./storage");
        await storage.linkOnboardingIntakeToUser(onboardingToken, user.id);
        console.log(`[OAuth] Linked onboarding intake ${onboardingToken} to user ${user.id}`);
      } catch (error) {
        console.error("[OAuth] Failed to link onboarding intake:", error);
      }
    }
    
    // Check if user is part of an organization with active membership
    if (user) {
      try {
        const { storage } = await import("./storage");
        const userOrgs = await storage.getUserOrganizations(user.id);
        
        if (userOrgs.length > 0) {
          let orgHasActiveSubscription = false;
          
          // Check each organization for active subscription
          for (const userOrg of userOrgs) {
            const org = await storage.getOrganization(userOrg.orgId);
            if (!org) continue;
            
            if (org.foundingPartnerStatus === 'active') {
              orgHasActiveSubscription = true;
              break;
            } else if (org.stripeSubscriptionId) {
              try {
                const { getUncachableStripeClient } = await import("./stripeClient");
                const stripe = await getUncachableStripeClient();
                const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
                
                if (sub.status === 'active' || sub.status === 'trialing') {
                  orgHasActiveSubscription = true;
                  break;
                }
              } catch (stripeError) {
                console.error(`[OAuth] Error verifying subscription for org ${userOrg.orgId}:`, stripeError);
              }
            }
          }
          
          // Only admin/owner roles can access the app
          const hasAdminRole = userOrgs.some((o: { role?: string }) => o.role === 'admin' || o.role === 'owner');
          if (orgHasActiveSubscription && hasAdminRole) {
            const decodedRedirectPath = redirectPath ? decodeURIComponent(redirectPath) : null;
            if (decodedRedirectPath === '/founding-partner-checkout' || redirectPath === '/founding-partner-checkout' || redirectPath?.includes('founding-partner-checkout')) {
              redirectPath = "/founding-partner-checkout";
              console.log('[OAuth Microsoft] ✅ returnTo is checkout page - redirecting to checkout regardless of existing membership');
            } else {
              const hostname = req.get('host') || req.hostname || '';
              const isProduction = hostname.includes('lead2lease.ai') || process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
              redirectPath = isProduction ? "https://app.lead2lease.ai" : "/app";
              console.log('[OAuth Microsoft] ✅ Organization has active membership and admin role, redirecting to app');
            }
          } else if (orgHasActiveSubscription && !hasAdminRole) {
            redirectPath = "/waitlist";
            console.log('[OAuth Microsoft] User has membership but no admin role, redirecting to waitlist');
          } else {
            redirectPath = "/waitlist";
            console.log('[OAuth Microsoft] No active membership, redirecting to waitlist');
          }
        } else {
          redirectPath = "/waitlist";
          console.log('[OAuth Microsoft] User has no organizations, redirecting to waitlist');
        }
      } catch (error) {
        console.error("[OAuth Microsoft] Error checking membership status:", error);
      }
    }
    
    // Check if trying to access admin routes
    if (redirectPath.startsWith('/admin')) {
      if (!user?.isAdmin) {
        console.log('[OAuth] Non-admin user attempted to access admin route:', user?.email);
        return res.redirect("/admin?error=" + encodeURIComponent("Access denied. Admin privileges required."));
      }
    }
    
    res.redirect(redirectPath);
  }
);

// Apple OAuth
router.get(
  "/apple",
  (req, res, next) => {
    // Check if this is coming from login page (skip consent check for login)
    const fromLogin = req.query.from === "login";
    
    // Only require consent if NOT coming from login page (i.e., from register page)
    if (!fromLogin) {
      const consent = (req.session as any)?.oauthConsent;
      if (!consent || !consent.agreeTerms) {
        return res.redirect("/register?error=" + encodeURIComponent("Please accept the terms of service and privacy notice to continue."));
      }
    }
    
    // Store redirect path (returnTo or redirect) and onboarding token in session if provided
    const redirectPath = (req.query.returnTo || req.query.redirect) as string;
    const onboardingToken = req.query.onboardingToken as string;
    
    // Always override callback URL based on request hostname to support both local and production
    const callbackURL = getCallbackUrl(req, "/api/auth/apple/callback");
    const authOptions: any = {
      callbackURL: callbackURL
    };
    console.log('[OAuth] Apple using dynamic callback URL:', callbackURL);
    
    if (redirectPath || onboardingToken) {
      if (redirectPath) req.session.oauthRedirect = redirectPath;
      if (onboardingToken) req.session.onboardingToken = onboardingToken;
      // Save session before redirecting to OAuth provider
      req.session.save((err) => {
        if (err) {
          console.error('[OAuth] Error saving to session:', err);
        }
        passport.authenticate("apple", authOptions)(req, res, next);
      });
    } else {
      passport.authenticate("apple", authOptions)(req, res, next);
    }
  }
);

router.get(
  "/apple/callback",
  passport.authenticate("apple", { failureRedirect: "/login?error=apple_auth_failed" }),
  async (req, res) => {
    const redirectPath = (req.session as any).oauthRedirect || "/";
    const onboardingToken = (req.session as any).onboardingToken;
    const savedConsent = (req.session as any).oauthConsent;
    delete (req.session as any).oauthRedirect;
    delete (req.session as any).onboardingToken;
    
    const user = req.user as any;
    
    // Update user consent from session if available
    if (user && savedConsent) {
      try {
        await db.update(users)
          .set({
            termsAccepted: savedConsent.agreeTerms,
            emailSubscription: savedConsent.agreeMarketing,
          })
          .where(eq(users.id, user.id));
        console.log('[OAuth] Updated Apple user consent from session:', user.id);
        delete (req.session as any).oauthConsent;
      } catch (updateError) {
        console.error('[OAuth] Error updating Apple user consent:', updateError);
      }
    }

    // Apply acquisition context from session (first-touch only)
    await applyAcquisitionFromSession(user, req);
    
    // Link onboarding intake if token was provided
    if (onboardingToken && user) {
      try {
        const { storage } = await import("./storage");
        await storage.linkOnboardingIntakeToUser(onboardingToken, user.id);
        console.log(`[OAuth] Linked onboarding intake ${onboardingToken} to user ${user.id}`);
      } catch (error) {
        console.error("[OAuth] Failed to link onboarding intake:", error);
      }
    } else if (user) {
      // Even without a token, check if user has a linked onboarding intake and ensure they have an org
      try {
        const { storage } = await import("./storage");
        await storage.ensureOrganizationFromOnboarding(user.id);
      } catch (error) {
        console.error("[OAuth] Error ensuring organization from onboarding:", error);
      }
    }
    
    // Try to link any existing Stripe subscriptions to this user's organization
    if (user) {
      try {
        const { linkSubscriptionToUser } = await import("./webhookHandlers");
        await linkSubscriptionToUser(user.email, user.id);
      } catch (error) {
        console.error("[OAuth] Error linking subscription:", error);
      }
    }
    
    // Check if trying to access admin routes
    if (redirectPath.startsWith('/admin')) {
      if (!user?.isAdmin) {
        console.log('[OAuth] Non-admin user attempted to access admin route:', user?.email);
        return res.redirect("/admin?error=" + encodeURIComponent("Access denied. Admin privileges required."));
      }
    }
    
    res.redirect(redirectPath);
  }
);

export default router;

