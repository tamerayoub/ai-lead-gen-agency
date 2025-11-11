import { Router } from "express";
import passport from "./passport";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "@shared/schema";
import { registerSchema, loginSchema } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

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
    }

    // Log user in
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: "Error logging in after registration" });
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
router.get("/user", (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user as any;
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      isAdmin: user.isAdmin || false,
    });
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

// Google OAuth
router.get(
  "/google",
  (req, res, next) => {
    // Store redirect path and onboarding token in session if provided
    const redirectPath = req.query.redirect as string;
    const onboardingToken = req.query.onboardingToken as string;
    console.log('[OAuth] Google init - redirect query param:', redirectPath);
    console.log('[OAuth] Google init - onboarding token:', onboardingToken);
    console.log('[OAuth] Google init - session ID:', req.sessionID);
    
    if (redirectPath || onboardingToken) {
      if (redirectPath) req.session.oauthRedirect = redirectPath;
      if (onboardingToken) req.session.onboardingToken = onboardingToken;
      console.log('[OAuth] Storing in session - redirect:', redirectPath, 'onboarding:', onboardingToken);
      // Save session before redirecting to OAuth provider
      req.session.save((err) => {
        if (err) {
          console.error('[OAuth] Error saving to session:', err);
        } else {
          console.log('[OAuth] Session saved successfully');
        }
        passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
      });
    } else {
      console.log('[OAuth] No redirect path or onboarding token provided, using defaults');
      passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
    }
  }
);

router.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", (err: any, user: any, info: any) => {
      if (err) {
        console.error('[OAuth] Google auth error:', err);
        return res.redirect("/login?error=" + encodeURIComponent("Authentication error occurred"));
      }
      
      if (!user) {
        console.log('[OAuth] Google auth failed:', info?.message);
        const errorMsg = info?.message || "Google authentication failed";
        return res.redirect("/login?error=" + encodeURIComponent(errorMsg));
      }
      
      console.log('[OAuth] Google callback - User authenticated:', user.id);
      console.log('[OAuth] Session ID before login:', req.sessionID);
      
      // Save redirect path and onboarding token BEFORE req.login() regenerates the session
      const savedRedirectPath = (req.session as any).oauthRedirect || "/";
      const savedOnboardingToken = (req.session as any).onboardingToken;
      console.log('[OAuth] Saved redirect path before login:', savedRedirectPath);
      console.log('[OAuth] Saved onboarding token before login:', savedOnboardingToken);
      
      req.login(user, async (loginErr) => {
        if (loginErr) {
          console.error('[OAuth] Login error:', loginErr);
          return res.redirect("/login?error=" + encodeURIComponent("Error creating session"));
        }
        
        console.log('[OAuth] Session ID after login:', req.sessionID);
        
        // Link onboarding intake if token was provided
        if (savedOnboardingToken) {
          try {
            const { storage } = await import("./storage");
            await storage.linkOnboardingIntakeToUser(savedOnboardingToken, user.id);
            console.log(`[OAuth] Linked onboarding intake ${savedOnboardingToken} to user ${user.id}`);
          } catch (error) {
            console.error("[OAuth] Failed to link onboarding intake:", error);
            // Don't fail login if linking fails
          }
        }
        
        // Check if trying to access admin routes
        if (savedRedirectPath.startsWith('/admin')) {
          if (!user.isAdmin) {
            console.log('[OAuth] Non-admin user attempted to access admin route:', user.email);
            return res.redirect("/admin?error=" + encodeURIComponent("Access denied. Admin privileges required."));
          }
        }
        
        console.log('[OAuth] Redirecting to', savedRedirectPath);
        res.redirect(savedRedirectPath);
      });
    })(req, res, next);
  }
);

// Facebook OAuth
router.get(
  "/facebook",
  (req, res, next) => {
    // Store redirect path and onboarding token in session if provided
    const redirectPath = req.query.redirect as string;
    const onboardingToken = req.query.onboardingToken as string;
    
    if (redirectPath || onboardingToken) {
      if (redirectPath) req.session.oauthRedirect = redirectPath;
      if (onboardingToken) req.session.onboardingToken = onboardingToken;
      // Save session before redirecting to OAuth provider
      req.session.save((err) => {
        if (err) {
          console.error('[OAuth] Error saving to session:', err);
        }
        passport.authenticate("facebook", { scope: ["email"] })(req, res, next);
      });
    } else {
      passport.authenticate("facebook", { scope: ["email"] })(req, res, next);
    }
  }
);

router.get(
  "/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/login?error=facebook_auth_failed" }),
  async (req, res) => {
    const redirectPath = (req.session as any).oauthRedirect || "/";
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

// Microsoft OAuth
router.get(
  "/microsoft",
  (req, res, next) => {
    // Store redirect path and onboarding token in session if provided
    const redirectPath = req.query.redirect as string;
    const onboardingToken = req.query.onboardingToken as string;
    
    if (redirectPath || onboardingToken) {
      if (redirectPath) req.session.oauthRedirect = redirectPath;
      if (onboardingToken) req.session.onboardingToken = onboardingToken;
      // Save session before redirecting to OAuth provider
      req.session.save((err) => {
        if (err) {
          console.error('[OAuth] Error saving to session:', err);
        }
        passport.authenticate("microsoft")(req, res, next);
      });
    } else {
      passport.authenticate("microsoft")(req, res, next);
    }
  }
);

router.get(
  "/microsoft/callback",
  passport.authenticate("microsoft", { failureRedirect: "/login?error=microsoft_auth_failed" }),
  async (req, res) => {
    const redirectPath = (req.session as any).oauthRedirect || "/";
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
    // Store redirect path and onboarding token in session if provided
    const redirectPath = req.query.redirect as string;
    const onboardingToken = req.query.onboardingToken as string;
    
    if (redirectPath || onboardingToken) {
      if (redirectPath) req.session.oauthRedirect = redirectPath;
      if (onboardingToken) req.session.onboardingToken = onboardingToken;
      // Save session before redirecting to OAuth provider
      req.session.save((err) => {
        if (err) {
          console.error('[OAuth] Error saving to session:', err);
        }
        passport.authenticate("apple")(req, res, next);
      });
    } else {
      passport.authenticate("apple")(req, res, next);
    }
  }
);

router.get(
  "/apple/callback",
  passport.authenticate("apple", { failureRedirect: "/login?error=apple_auth_failed" }),
  async (req, res) => {
    const redirectPath = (req.session as any).oauthRedirect || "/";
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
