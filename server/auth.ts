import { Router } from "express";
import passport from "./passport";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "@shared/schema";
import { registerSchema, loginSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Request } from "express";

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
  
  console.log('[OAuth] getCallbackUrl - requestHost:', requestHost, 'hostname:', req.hostname, 'isLocalhost:', isLocalhost);
  
  // If localhost, ALWAYS use localhost regardless of environment variables
  if (isLocalhost) {
    const protocol = 'http'; // Always HTTP for localhost
    const host = 'localhost:5000';
    const callbackUrl = `${protocol}://${host}${path}`;
    console.log('[OAuth] ✅ Localhost detected - using localhost callback URL:', callbackUrl);
    return callbackUrl;
  }
  
  // Not localhost - determine production vs other environments
  const isProduction = !!process.env.APP_DOMAIN || !!process.env.PRODUCTION_DOMAIN || process.env.NODE_ENV === "production";
  
  // Determine protocol - check x-forwarded-proto first (for proxies), then req.secure, then hostname
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto === 'https' || req.secure || req.hostname?.includes('lead2lease.ai') || isProduction ? 'https' : 'http';
  
  // Get host from request
  let host = requestHost || 'localhost:5000';
  
  // CRITICAL: For OAuth callbacks, use APP_DOMAIN (app.lead2lease.ai) to keep session cookies on the app subdomain
  // This fixes the cross-subdomain cookie issue where login happens on marketing site but app is on app subdomain
  if (isProduction && !isLocalhost) {
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

// Email/Password Registration
router.post("/register", async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const onboardingToken = req.body.onboardingToken;
    
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

    // Create user
    const [user] = await db.insert(users).values({
      email: validatedData.email,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      provider: "email",
      passwordHash,
      termsAccepted: validatedData.agreeTerms,
      emailSubscription: validatedData.agreeMarketing, // Required by schema validation
    }).returning();

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
    // Fetch fresh user data from database to ensure we have the latest info
    try {
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const user = req.user as any;
      const freshUser = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });
      
      if (freshUser) {
        res.json({
          id: freshUser.id,
          email: freshUser.email,
          firstName: freshUser.firstName,
          lastName: freshUser.lastName,
          phone: freshUser.phone,
          profileImageUrl: freshUser.profileImageUrl,
          isAdmin: freshUser.isAdmin || false,
        });
      } else {
        // Fallback to session user if database lookup fails
        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          profileImageUrl: user.profileImageUrl,
          isAdmin: user.isAdmin || false,
        });
      }
    } catch (error) {
      console.error('[Auth] Error fetching fresh user data:', error);
      // Fallback to session user on error
      const user = req.user as any;
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        isAdmin: user.isAdmin || false,
      });
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

// Store OAuth consent in session
router.post("/store-oauth-consent", (req, res) => {
  try {
    const { agreeTerms, agreeMarketing } = req.body;
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
              console.log('[OAuth] Session cookie name:', req.session?.cookie?.name || 'connect.sid');
            }
            resolve();
          });
        });
        
        // Reload session after save to ensure we have the latest data
        await new Promise<void>((resolve) => {
          req.session.reload((reloadErr) => {
            if (reloadErr) {
              console.error('[OAuth] Error reloading session after save:', reloadErr);
            } else {
              console.log('[OAuth] ✅ Session reloaded after save, sessionID:', req.sessionID);
              console.log('[OAuth] User still authenticated after reload:', req.isAuthenticated());
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
            console.log('[OAuth] ✅ Coming from login page - checking membership status');
            // Coming from login page - check membership status
            // BEST PRACTICE: Check ALL user's organizations for active subscription (works for ALL users in org)
            try {
              const { storage } = await import("./storage");
              
              // Refresh user to get updated currentOrgId after subscription linking
              const refreshedUser = await storage.getUser(user.id);
              if (!refreshedUser) {
                console.log(`[OAuth] ❌ User ${user.id} not found after refresh`);
                redirectPath = "/founding-partner-checkout";
              } else {
                console.log('[OAuth] User refreshed, currentOrgId:', refreshedUser.currentOrgId);
                // Get ALL of the user's organizations to check for active subscriptions
                const userOrgs = await storage.getUserOrganizations(user.id);
                console.log(`[OAuth] User has ${userOrgs.length} organization(s):`, userOrgs.map(o => ({ orgId: o.orgId, orgName: o.orgName })));
                
                if (userOrgs.length === 0) {
                  console.log('[OAuth] ❌ User has no organizations, redirecting to checkout');
                  redirectPath = "/founding-partner-checkout";
                } else {
                  let orgHasActiveSubscription = false;
                  let activeOrgId: string | null = null;
                  
                  // Check each organization for active subscription
                  for (const userOrg of userOrgs) {
                    console.log(`[OAuth] Checking org ${userOrg.orgId} (${userOrg.orgName}) for active subscription...`);
                    const org = await storage.getOrganization(userOrg.orgId);
                    if (!org) {
                      console.log(`[OAuth] ⚠️ Org ${userOrg.orgId} not found in database, skipping`);
                      continue;
                    }
                    
                    console.log(`[OAuth] Org ${userOrg.orgId} details:`, {
                      foundingPartnerStatus: org.foundingPartnerStatus,
                      stripeSubscriptionId: org.stripeSubscriptionId ? 'present' : 'missing'
                    });
                    
                    // Check if org has active subscription or one-time payment
                    if (org.foundingPartnerStatus === 'active') {
                      // Quick check - org is marked as active in DB
                      orgHasActiveSubscription = true;
                      activeOrgId = userOrg.orgId;
                      console.log(`[OAuth] ✅ Found active org ${userOrg.orgId} (${userOrg.orgName}) in database - STATUS: active`);
                      break;
                    }
                    
                    // Always check for one-time payment if org has a customer ID (regardless of current status)
                    // This handles cases where status might be 'expired' or 'cancelled' but one-time payment exists
                    if (org.stripeCustomerId) {
                      // Check for one-time payment with the configured lookup key
                      try {
                        const { getUncachableStripeClient } = await import("./stripeClient");
                        const stripe = await getUncachableStripeClient();
                        console.log(`[OAuth] Checking for one-time payment for org ${userOrg.orgId} (customer: ${org.stripeCustomerId}, current status: ${org.foundingPartnerStatus})`);
                        
                        // Search for successful checkout sessions (one-time payments) for this customer
                        const checkoutSessions = await stripe.checkout.sessions.list({
                          customer: org.stripeCustomerId,
                          limit: 100,
                        });
                        
                        // Filter for successful one-time payments
                        // Check all paid one-time payments for this customer (metadata might not always match)
                        const successfulOneTimePayments = checkoutSessions.data.filter(session => 
                          session.mode === 'payment' && 
                          session.payment_status === 'paid'
                        );
                        
                        console.log(`[OAuth] Found ${successfulOneTimePayments.length} successful one-time payment(s) for customer ${org.stripeCustomerId}`);
                        console.log(`[OAuth] Checking sessions for org ${userOrg.orgId} - will verify lookup key and metadata`);
                        
                        if (successfulOneTimePayments.length === 0) {
                          console.log(`[OAuth] ⚠️ No successful one-time payments found for customer ${org.stripeCustomerId}`);
                        }
                        
                        // Check if any of these sessions used the configured lookup key
                        for (const session of successfulOneTimePayments) {
                          try {
                            console.log(`[OAuth] Processing session ${session.id} - mode: ${session.mode}, payment_status: ${session.payment_status}, metadata:`, session.metadata);
                            
                            // Retrieve the line items to check the price lookup key
                            // Wrap in try-catch with timeout to prevent hanging
                            let lineItems;
                            try {
                              lineItems = await Promise.race([
                                stripe.checkout.sessions.listLineItems(session.id, { limit: 100 }),
                                new Promise((_, reject) => 
                                  setTimeout(() => reject(new Error('listLineItems timeout after 10 seconds')), 10000)
                                )
                              ]) as any;
                              console.log(`[OAuth] Retrieved ${lineItems.data.length} line item(s) for session ${session.id}`);
                            } catch (lineItemFetchError: any) {
                              console.error(`[OAuth] ⚠️ Failed to retrieve line items for session ${session.id}:`, {
                                error: lineItemFetchError?.message || lineItemFetchError,
                                code: lineItemFetchError?.code,
                                type: lineItemFetchError?.type,
                              });
                              continue; // Skip this session and try the next one
                            }
                            
                            if (!lineItems || !lineItems.data || lineItems.data.length === 0) {
                              console.log(`[OAuth] ⚠️ No line items found for session ${session.id}`);
                              continue;
                            }
                            
                            for (const item of lineItems.data) {
                              const price = item.price;
                              const lookupKey = price?.lookup_key;
                              console.log(`[OAuth] Checking session ${session.id} - price ID: ${price?.id}, lookup_key: ${lookupKey}, metadata orgId: ${session.metadata?.orgId}, organization_id: ${session.metadata?.organization_id}`);
                              
                              if (lookupKey === expectedLookupKey) {
                                console.log(`[OAuth] ✅ MATCH! Found '${expectedLookupKey}' lookup key for session ${session.id}`);
                                
                                // Verify metadata matches this org (or if metadata is missing, assume it's for this org if customer matches)
                                const metadataMatches = (!session.metadata?.orgId && !session.metadata?.organization_id) || 
                                                       session.metadata?.orgId === userOrg.orgId || 
                                                       session.metadata?.organization_id === userOrg.orgId;
                                
                                console.log(`[OAuth] Metadata check - orgId: ${userOrg.orgId}, session orgId: ${session.metadata?.orgId}, session organization_id: ${session.metadata?.organization_id}, matches: ${metadataMatches}`);
                                
                                if (metadataMatches) {
                                  console.log(`[OAuth] ✅ Found one-time payment with '${expectedLookupKey}' lookup key for org ${userOrg.orgId} (session: ${session.id})`);
                                  
                                  // Update org status to active (one-time payment grants access)
                                  await storage.updateOrganization(userOrg.orgId, {
                                    foundingPartnerStatus: 'active',
                                  });
                                  
                                  orgHasActiveSubscription = true;
                                  activeOrgId = userOrg.orgId;
                                  console.log(`[OAuth] ✅ Org ${userOrg.orgId} has one-time payment - granting access`);
                                  break;
                                } else {
                                  console.log(`[OAuth] ⚠️ Found one-time payment with correct lookup key but metadata doesn't match org ${userOrg.orgId} - session metadata:`, session.metadata);
                                }
                              } else {
                                console.log(`[OAuth] Lookup key mismatch - expected '${expectedLookupKey}', got: ${lookupKey}`);
                              }
                            }
                            if (orgHasActiveSubscription) {
                              console.log(`[OAuth] ✅ Breaking out of session loop - found one-time payment`);
                              break;
                            }
                          } catch (lineItemError: any) {
                            console.error(`[OAuth] Error checking line items for session ${session.id}:`, lineItemError);
                            console.error(`[OAuth] Error details:`, {
                              message: lineItemError?.message,
                              code: lineItemError?.code,
                              type: lineItemError?.type,
                              stack: lineItemError?.stack,
                            });
                          }
                        }
                        
                        // Log summary after checking all sessions
                        console.log(`[OAuth] Finished checking ${successfulOneTimePayments.length} session(s) for org ${userOrg.orgId} - orgHasActiveSubscription: ${orgHasActiveSubscription}`);
                        
                        // If we found a one-time payment and set orgHasActiveSubscription, break out of org loop
                        if (orgHasActiveSubscription) {
                          console.log(`[OAuth] ✅ Breaking out of org loop - found one-time payment for org ${userOrg.orgId}`);
                          break;
                        }
                      } catch (oneTimePaymentError: any) {
                        // Check if this is a "No such customer" error (test mode customer in live mode)
                        // Stripe errors can have type 'StripeInvalidRequestError' or code 'resource_missing'
                        const errorMessage = oneTimePaymentError?.message || '';
                        const errorCode = oneTimePaymentError?.code || '';
                        const isNoSuchCustomer = errorMessage.includes('No such customer') || errorCode === 'resource_missing';
                        
                        if (isNoSuchCustomer) {
                          console.log(`[OAuth] ⚠️ Customer ${org.stripeCustomerId} doesn't exist in Stripe (likely test-mode ID in live mode) - clearing stale data for org ${userOrg.orgId}`);
                          // Clear the stale test-mode customer ID so user can start fresh
                          try {
                            await storage.updateOrganization(userOrg.orgId, {
                              stripeCustomerId: null,
                              stripeSubscriptionId: null,
                            });
                            console.log(`[OAuth] ✅ Cleared stale Stripe data for org ${userOrg.orgId}`);
                          } catch (updateError) {
                            console.error(`[OAuth] Failed to clear stale Stripe data for org ${userOrg.orgId}:`, updateError);
                          }
                        } else {
                          console.error(`[OAuth] Error checking one-time payments for org ${userOrg.orgId}:`, oneTimePaymentError?.message || oneTimePaymentError);
                        }
                        // Continue to next org in the loop
                      }
                    }
                    
                    // CRITICAL: If we found a one-time payment, break out of org loop immediately
                    // Don't check for subscriptions if we already found a one-time payment
                    if (orgHasActiveSubscription) {
                      console.log(`[OAuth] ✅ Found active membership (one-time payment) for org ${userOrg.orgId} - breaking out of org loop immediately`);
                      break;
                    }
                    
                    // If still no active membership found, check for subscription
                    if (!orgHasActiveSubscription && org.stripeSubscriptionId) {
                      // Verify subscription is still active in Stripe
                      try {
                        console.log(`[OAuth] Org has subscription ID, verifying in Stripe: ${org.stripeSubscriptionId}`);
                        const { getUncachableStripeClient } = await import("./stripeClient");
                        const stripe = await getUncachableStripeClient();
                        const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
                        
                        console.log(`[OAuth] Stripe subscription status: ${sub.status}`);
                        
                        if (sub.status === 'active' || sub.status === 'trialing') {
                          orgHasActiveSubscription = true;
                          activeOrgId = userOrg.orgId;
                          console.log(`[OAuth] ✅ Found active subscription ${org.stripeSubscriptionId} for org ${userOrg.orgId} (${userOrg.orgName}) - STATUS: ${sub.status}`);
                          break;
                        } else {
                          console.log(`[OAuth] ⚠️ Subscription ${org.stripeSubscriptionId} exists but status is ${sub.status} (not active/trialing)`);
                        }
                      } catch (stripeError: any) {
                        // Check if this is a "No such subscription" error (test mode subscription in live mode)
                        const errorMessage = stripeError?.message || '';
                        const errorCode = stripeError?.code || '';
                        const isNoSuchSubscription = errorMessage.includes('No such subscription') || errorCode === 'resource_missing';
                        
                        if (isNoSuchSubscription) {
                          console.log(`[OAuth] ⚠️ Subscription ${org.stripeSubscriptionId} doesn't exist in Stripe (likely test-mode ID in live mode) - clearing stale data for org ${userOrg.orgId}`);
                          try {
                            await storage.updateOrganization(userOrg.orgId, {
                              stripeSubscriptionId: null,
                            });
                            console.log(`[OAuth] ✅ Cleared stale subscription data for org ${userOrg.orgId}`);
                          } catch (updateError) {
                            console.error(`[OAuth] Failed to clear stale subscription data for org ${userOrg.orgId}:`, updateError);
                          }
                        } else {
                          console.error(`[OAuth] ❌ Error verifying subscription for org ${userOrg.orgId}:`, stripeError?.message || stripeError);
                        }
                        // Continue to next org in the loop
                      }
                    } else if (!orgHasActiveSubscription) {
                      console.log(`[OAuth] ⚠️ Org ${userOrg.orgId} has no subscription ID and status is not active - continuing to next org`);
                    }
                  }
                  
                  console.log('[OAuth] ===== MEMBERSHIP CHECK RESULTS =====');
                  console.log('[OAuth] orgHasActiveSubscription:', orgHasActiveSubscription);
                  console.log('[OAuth] activeOrgId:', activeOrgId);
                  
                  if (orgHasActiveSubscription && activeOrgId) {
                    // Update user's currentOrgId to the org with active subscription
                    if (refreshedUser.currentOrgId !== activeOrgId) {
                      await storage.updateUser(user.id, { currentOrgId: activeOrgId });
                      console.log(`[OAuth] Updated user's currentOrgId from ${refreshedUser.currentOrgId} to ${activeOrgId}`);
                    } else {
                      console.log(`[OAuth] User's currentOrgId already set to active org: ${activeOrgId}`);
                    }
                    
                    // User has active membership - ALWAYS redirect to app, ignore checkout redirect
                    // Users with active memberships should not be sent back to checkout
                    const hostname = req.get('host') || req.hostname || '';
                    const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes(':5000');
                    const isProduction = !isLocalhost && (hostname.includes('lead2lease.ai') || process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production');
                    
                    console.log('[OAuth] ===== DETERMINING APP REDIRECT PATH =====');
                    console.log('[OAuth] hostname:', hostname);
                    console.log('[OAuth] isLocalhost:', isLocalhost);
                    console.log('[OAuth] isProduction:', isProduction);
                    console.log('[OAuth] savedRedirectPath:', savedRedirectPath);
                    console.log('[OAuth] ⚠️ User has active membership - ignoring checkout redirect, sending to app');
                    
                    // Only use savedRedirectPath if it's not the checkout page
                    if (savedRedirectPath && savedRedirectPath !== '/founding-partner-checkout' && !savedRedirectPath.includes('founding-partner-checkout')) {
                      redirectPath = savedRedirectPath;
                      console.log('[OAuth] ✅ Organization has active membership, using savedRedirectPath:', redirectPath);
                    } else if (isLocalhost) {
                      // CRITICAL: Always use relative path for localhost
                      redirectPath = "/app";
                      console.log('[OAuth] ✅ Organization has active membership, redirecting to /app (localhost detected)');
                    } else if (isProduction) {
                      redirectPath = "https://app.lead2lease.ai";
                      console.log('[OAuth] ✅ Organization has active membership, redirecting to app (production):', redirectPath);
                    } else {
                      redirectPath = "/app";
                      console.log('[OAuth] ✅ Organization has active membership, redirecting to /app (default)');
                    }
                  } else {
                    // No active subscription found in any org
                    // Only redirect to checkout if user has no orgs OR orgs don't have membership
                    redirectPath = "/founding-partner-checkout";
                    console.log(`[OAuth] ❌ No active subscription found in any of user's ${userOrgs.length} organization(s), redirecting to checkout`);
                  }
                }
              }
            } catch (error) {
              console.error("[OAuth] ❌ Error checking membership status:", error);
              console.error("[OAuth] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
              redirectPath = "/founding-partner-checkout";
            }
          } else {
            console.log('[OAuth] ⚠️ Membership check not triggered (savedFrom:', savedFrom, ')');
            console.log('[OAuth] Fallback: Checking if user has membership anyway...');
          
          // PRIORITY: Check if returnTo is checkout BEFORE checking membership
          // This ensures users coming from checkout always go to checkout
          const fallbackDecodedRedirectPath = savedRedirectPath ? decodeURIComponent(savedRedirectPath) : null;
          if (fallbackDecodedRedirectPath === '/founding-partner-checkout' || savedRedirectPath === '/founding-partner-checkout' || savedRedirectPath?.includes('founding-partner-checkout')) {
            redirectPath = "/founding-partner-checkout";
            console.log('[OAuth] Fallback - ✅ returnTo is checkout page - redirecting to checkout regardless of existing membership');
          } else {
            // FALLBACK: Always check membership if user might have one
            // This ensures users with existing memberships get redirected to /app
            try {
              const { storage } = await import("./storage");
              const refreshedUser = await storage.getUser(user.id);
              
              if (refreshedUser) {
                const userOrgs = await storage.getUserOrganizations(user.id);
                console.log(`[OAuth] Fallback check - User has ${userOrgs.length} organization(s)`);
                
                if (userOrgs.length > 0) {
                  // Check if any org has active membership
                  let orgHasActiveSubscription = false;
                  let activeOrgId: string | null = null;
                  
                  for (const userOrg of userOrgs) {
                    const org = await storage.getOrganization(userOrg.orgId);
                    if (!org) continue;
                    
                    if (org.foundingPartnerStatus === 'active') {
                      orgHasActiveSubscription = true;
                      activeOrgId = userOrg.orgId;
                      console.log(`[OAuth] Fallback - ✅ Found active org ${userOrg.orgId}`);
                      break;
                    }
                    
                    // Always check for one-time payment if org has a customer ID (regardless of current status)
                    if (org.stripeCustomerId) {
                      // Check for one-time payment with the configured lookup key
                      try {
                        const { getUncachableStripeClient } = await import("./stripeClient");
                        const stripe = await getUncachableStripeClient();
                        console.log(`[OAuth] Fallback - Checking for one-time payment for org ${userOrg.orgId} (customer: ${org.stripeCustomerId}, current status: ${org.foundingPartnerStatus})`);
                        
                        // Search for successful checkout sessions (one-time payments) for this customer
                        const checkoutSessions = await stripe.checkout.sessions.list({
                          customer: org.stripeCustomerId,
                          limit: 100,
                        });
                        
                        // Filter for successful one-time payments
                        // Check all paid one-time payments for this customer (metadata might not always match)
                        const successfulOneTimePayments = checkoutSessions.data.filter(session => 
                          session.mode === 'payment' && 
                          session.payment_status === 'paid'
                        );
                        
                        console.log(`[OAuth] Fallback - Found ${successfulOneTimePayments.length} successful one-time payment(s) for customer ${org.stripeCustomerId}`);
                        console.log(`[OAuth] Fallback - Checking sessions for org ${userOrg.orgId} - will verify lookup key and metadata`);
                        
                        // Check if any of these sessions used the configured lookup key
                        for (const session of successfulOneTimePayments) {
                          try {
                            // Retrieve the line items to check the price lookup key
                            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
                            
                            for (const item of lineItems.data) {
                              const price = item.price;
                              console.log(`[OAuth] Fallback - Checking session ${session.id} - price lookup_key: ${price?.lookup_key}, metadata orgId: ${session.metadata?.orgId}, organization_id: ${session.metadata?.organization_id}`);
                              
                              if (price?.lookup_key === expectedLookupKey) {
                                // Verify metadata matches this org (or if metadata is missing, assume it's for this org if customer matches)
                                const metadataMatches = !session.metadata?.orgId && !session.metadata?.organization_id || 
                                                       session.metadata?.orgId === userOrg.orgId || 
                                                       session.metadata?.organization_id === userOrg.orgId;
                                
                                if (metadataMatches) {
                                  console.log(`[OAuth] Fallback - ✅ Found one-time payment with '${expectedLookupKey}' lookup key for org ${userOrg.orgId} (session: ${session.id})`);
                                  
                                  // Update org status to active (one-time payment grants access)
                                  await storage.updateOrganization(userOrg.orgId, {
                                    foundingPartnerStatus: 'active',
                                  });
                                  
                                  orgHasActiveSubscription = true;
                                  activeOrgId = userOrg.orgId;
                                  console.log(`[OAuth] Fallback - ✅ Org ${userOrg.orgId} has one-time payment - granting access`);
                                  break;
                                } else {
                                  console.log(`[OAuth] Fallback - ⚠️ Found one-time payment with correct lookup key but metadata doesn't match org ${userOrg.orgId} - session metadata:`, session.metadata);
                                }
                              }
                            }
                            if (orgHasActiveSubscription) break;
                          } catch (lineItemError) {
                            console.error(`[OAuth] Fallback - Error checking line items for session ${session.id}:`, lineItemError);
                          }
                        }
                        // If we found a one-time payment and set orgHasActiveSubscription, break out of org loop
                        if (orgHasActiveSubscription) {
                          console.log(`[OAuth] Fallback - ✅ Breaking out of org loop - found one-time payment for org ${userOrg.orgId}`);
                          break;
                        }
                      } catch (oneTimePaymentError: any) {
                        // Check if this is a "No such customer" error (test mode customer in live mode)
                        const errorMessage = oneTimePaymentError?.message || '';
                        const errorCode = oneTimePaymentError?.code || '';
                        const isNoSuchCustomer = errorMessage.includes('No such customer') || errorCode === 'resource_missing';
                        
                        if (isNoSuchCustomer) {
                          console.log(`[OAuth] Fallback - ⚠️ Customer ${org.stripeCustomerId} doesn't exist in Stripe (likely test-mode ID in live mode) - clearing stale data for org ${userOrg.orgId}`);
                          try {
                            await storage.updateOrganization(userOrg.orgId, {
                              stripeCustomerId: null,
                              stripeSubscriptionId: null,
                            });
                            console.log(`[OAuth] Fallback - ✅ Cleared stale Stripe data for org ${userOrg.orgId}`);
                          } catch (updateError) {
                            console.error(`[OAuth] Fallback - Failed to clear stale Stripe data:`, updateError);
                          }
                        } else {
                          console.error(`[OAuth] Fallback - Error checking one-time payments for org ${userOrg.orgId}:`, oneTimePaymentError?.message || oneTimePaymentError);
                        }
                      }
                      
                      // CRITICAL: If we found a one-time payment, break out of org loop immediately
                      // Don't check for subscriptions if we already found a one-time payment
                      if (orgHasActiveSubscription) {
                        console.log(`[OAuth] Fallback - ✅ Found active membership (one-time payment) for org ${userOrg.orgId} - breaking out of org loop immediately`);
                        break;
                      }
                    }
                    
                    // If still no active membership found, check for subscription
                    if (!orgHasActiveSubscription && org.stripeSubscriptionId) {
                      try {
                        const { getUncachableStripeClient } = await import("./stripeClient");
                        const stripe = await getUncachableStripeClient();
                        const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
                        
                        if (sub.status === 'active' || sub.status === 'trialing') {
                          orgHasActiveSubscription = true;
                          activeOrgId = userOrg.orgId;
                          console.log(`[OAuth] Fallback - ✅ Found active subscription for org ${userOrg.orgId}`);
                          break;
                        }
                      } catch (stripeError: any) {
                        // Check if this is a "No such subscription" error (test mode subscription in live mode)
                        const errorMessage = stripeError?.message || '';
                        const errorCode = stripeError?.code || '';
                        const isNoSuchSubscription = errorMessage.includes('No such subscription') || errorCode === 'resource_missing';
                        
                        if (isNoSuchSubscription) {
                          console.log(`[OAuth] Fallback - ⚠️ Subscription ${org.stripeSubscriptionId} doesn't exist in Stripe (likely test-mode ID in live mode) - clearing stale data for org ${userOrg.orgId}`);
                          try {
                            await storage.updateOrganization(userOrg.orgId, {
                              stripeSubscriptionId: null,
                            });
                          } catch (updateError) {
                            console.error(`[OAuth] Fallback - Failed to clear stale subscription data:`, updateError);
                          }
                        } else {
                          console.error(`[OAuth] Fallback - Error verifying subscription:`, stripeError?.message || stripeError);
                        }
                      }
                    }
                  }
                  
                  if (orgHasActiveSubscription && activeOrgId) {
                    // User has active membership - redirect to app
                    const hostname = req.get('host') || req.hostname || '';
                    const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes(':5000');
                    
                    if (isLocalhost) {
                      redirectPath = "/app";
                      console.log('[OAuth] Fallback - ✅ User has membership, redirecting to /app (localhost)');
                    } else if (hostname.includes('lead2lease.ai')) {
                      redirectPath = "https://app.lead2lease.ai";
                      console.log('[OAuth] Fallback - ✅ User has membership, redirecting to app (production)');
                    } else {
                      redirectPath = "/app";
                      console.log('[OAuth] Fallback - ✅ User has membership, redirecting to /app');
                    }
                  } else {
                    console.log('[OAuth] Fallback - ❌ No active membership found, will use default redirect');
                    if (!redirectPath) {
                      redirectPath = "/founding-partner-checkout";
                    }
                  }
                } else {
                  console.log('[OAuth] Fallback - User has no organizations');
                  if (!redirectPath) {
                    redirectPath = "/founding-partner-checkout";
                  }
                }
              } else {
                console.log('[OAuth] Fallback - User not found');
                if (!redirectPath) {
                  redirectPath = "/founding-partner-checkout";
                }
              }
            } catch (error) {
              console.error('[OAuth] Fallback - Error checking membership:', error);
              if (!redirectPath) {
                redirectPath = "/founding-partner-checkout";
              }
            }
          }
          
          // If still no redirect path, use default
          if (!redirectPath) {
            redirectPath = "/founding-partner-checkout";
            console.log('[OAuth] No redirect path determined, defaulting to checkout');
          }
          }
        }
        
        // Handle other redirect scenarios
        if (!redirectPath) {
          if (savedConsent) {
            // Has consent in session = coming from register page (new registration)
            redirectPath = savedRedirectPath || "/founding-partner-checkout";
            console.log('[OAuth] New user registration (has consent), redirecting to checkout:', redirectPath);
          } else {
            // Default: if no saved redirect path, go to checkout (new registration)
            redirectPath = savedRedirectPath || "/founding-partner-checkout";
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
        
        // Save session before redirecting to ensure session is persisted
        // Note: Session was already saved after req.login(), but save again to be safe
        // This ensures the session cookie is set in the response headers
        req.session.save((saveErr) => {
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
          
          // Verify session is still authenticated before redirect
          if (!req.isAuthenticated()) {
            console.error('[OAuth] ⚠️ WARNING: Session not authenticated before redirect!');
            return res.redirect("/login?error=" + encodeURIComponent("Session was not properly created"));
          }
          
          console.log('[OAuth] ===== FINAL REDIRECT =====');
          console.log('[OAuth] Final redirectPath:', redirectPath);
          console.log('[OAuth] Request hostname:', req.get('host'));
          console.log('[OAuth] Request origin:', req.get('origin'));
          console.log('[OAuth] Full redirect URL will be:', redirectPath.startsWith('http') ? redirectPath : (req.protocol + '://' + req.get('host') + redirectPath));
          
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
          
          if (orgHasActiveSubscription) {
            // PRIORITY: If returnTo is explicitly set to checkout, always respect it
            // Users might want to purchase additional memberships for new organizations
            const decodedRedirectPath = redirectPath ? decodeURIComponent(redirectPath) : null;
            if (decodedRedirectPath === '/founding-partner-checkout' || redirectPath === '/founding-partner-checkout' || redirectPath?.includes('founding-partner-checkout')) {
              redirectPath = "/founding-partner-checkout";
              console.log('[OAuth Facebook] ✅ returnTo is checkout page - redirecting to checkout regardless of existing membership');
            } else {
              // User has active membership - redirect to app (only if returnTo is NOT checkout)
              const hostname = req.get('host') || req.hostname || '';
              const isProduction = hostname.includes('lead2lease.ai') || process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
              redirectPath = isProduction ? "https://app.lead2lease.ai" : "/app";
              console.log('[OAuth Facebook] ✅ Organization has active membership, redirecting to app');
            }
          }
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
          
          if (orgHasActiveSubscription) {
            // PRIORITY: If returnTo is explicitly set to checkout, always respect it
            // Users might want to purchase additional memberships for new organizations
            const decodedRedirectPath = redirectPath ? decodeURIComponent(redirectPath) : null;
            if (decodedRedirectPath === '/founding-partner-checkout' || redirectPath === '/founding-partner-checkout' || redirectPath?.includes('founding-partner-checkout')) {
              redirectPath = "/founding-partner-checkout";
              console.log('[OAuth Microsoft] ✅ returnTo is checkout page - redirecting to checkout regardless of existing membership');
            } else {
              // User has active membership - redirect to app (only if returnTo is NOT checkout)
              const hostname = req.get('host') || req.hostname || '';
              const isProduction = hostname.includes('lead2lease.ai') || process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
              redirectPath = isProduction ? "https://app.lead2lease.ai" : "/app";
              console.log('[OAuth Microsoft] ✅ Organization has active membership, redirecting to app');
            }
          }
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

