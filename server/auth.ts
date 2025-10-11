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
    
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Server error during login" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Error creating session" });
        }
        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
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
    });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

// Logout
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
  passport.authenticate("google", { scope: ["profile", "email"] })
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
      console.log('[OAuth] Session ID:', req.sessionID);
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('[OAuth] Login error:', loginErr);
          return res.redirect("/login?error=" + encodeURIComponent("Error creating session"));
        }
        
        // Manually save session to ensure it's persisted
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[OAuth] Session save error:', saveErr);
            return res.redirect("/login?error=" + encodeURIComponent("Error saving session"));
          }
          console.log('[OAuth] Session saved successfully, redirecting to /');
          res.redirect("/");
        });
      });
    })(req, res, next);
  }
);

// Facebook OAuth
router.get(
  "/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);

router.get(
  "/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/login?error=facebook_auth_failed" }),
  (req, res) => {
    res.redirect("/");
  }
);

// Microsoft OAuth
router.get(
  "/microsoft",
  passport.authenticate("microsoft")
);

router.get(
  "/microsoft/callback",
  passport.authenticate("microsoft", { failureRedirect: "/login?error=microsoft_auth_failed" }),
  (req, res) => {
    res.redirect("/");
  }
);

// Apple OAuth
router.get(
  "/apple",
  passport.authenticate("apple")
);

router.get(
  "/apple/callback",
  passport.authenticate("apple", { failureRedirect: "/login?error=apple_auth_failed" }),
  (req, res) => {
    res.redirect("/");
  }
);

export default router;
