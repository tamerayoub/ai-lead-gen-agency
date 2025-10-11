import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
// @ts-ignore - passport-apple doesn't have types
import AppleStrategy from "passport-apple";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Helper to get base URL
const getBaseUrl = () => {
  const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
  if (replitDomain) {
    const url = `https://${replitDomain}`;
    console.log('[OAuth] Base URL:', url);
    return url;
  }
  const fallback = process.env.BASE_URL || "http://localhost:5000";
  console.log('[OAuth] Base URL (fallback):', fallback);
  return fallback;
};

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${getBaseUrl()}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(null, false, { message: "No email provided by Google" });
          }

          // First check if user exists with this Google providerId
          let user = await db.query.users.findFirst({
            where: sql`${users.provider} = 'google' AND ${users.providerId} = ${profile.id}`,
          });

          if (!user) {
            // Check if email exists (could be password or other OAuth)
            const existingEmailUser = await db.query.users.findFirst({
              where: eq(users.email, email),
            });

            if (existingEmailUser) {
              // Email exists but with different provider - don't allow, inform user
              return done(null, false, { 
                message: `This email is already registered with ${existingEmailUser.provider}. Please sign in using ${existingEmailUser.provider}.` 
              });
            }

            // Create new user with Google
            const [newUser] = await db.insert(users).values({
              email,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              profileImageUrl: profile.photos?.[0]?.value,
              provider: "google",
              providerId: profile.id,
            }).returning();
            user = newUser;
          }

          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );
}

// Facebook OAuth Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: `${getBaseUrl()}/api/auth/facebook/callback`,
        profileFields: ["id", "emails", "name", "picture"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(null, false, { message: "No email provided by Facebook" });
          }

          // First check if user exists with this Facebook providerId
          let user = await db.query.users.findFirst({
            where: sql`${users.provider} = 'facebook' AND ${users.providerId} = ${profile.id}`,
          });

          if (!user) {
            const existingEmailUser = await db.query.users.findFirst({
              where: eq(users.email, email),
            });

            if (existingEmailUser) {
              return done(null, false, { 
                message: `This email is already registered with ${existingEmailUser.provider}. Please sign in using ${existingEmailUser.provider}.` 
              });
            }

            const [newUser] = await db.insert(users).values({
              email,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              profileImageUrl: profile.photos?.[0]?.value,
              provider: "facebook",
              providerId: profile.id,
            }).returning();
            user = newUser;
          }

          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );
}

// Microsoft OAuth Strategy
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: `${getBaseUrl()}/api/auth/microsoft/callback`,
        scope: ["user.read"],
      },
      // @ts-ignore - Microsoft strategy types are incomplete
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || profile._json.mail || profile._json.userPrincipalName;
          if (!email) {
            return done(null, false, { message: "No email provided by Microsoft" });
          }

          let user = await db.query.users.findFirst({
            where: sql`${users.provider} = 'microsoft' AND ${users.providerId} = ${profile.id}`,
          });

          if (!user) {
            const existingEmailUser = await db.query.users.findFirst({
              where: eq(users.email, email),
            });

            if (existingEmailUser) {
              return done(null, false, { 
                message: `This email is already registered with ${existingEmailUser.provider}. Please sign in using ${existingEmailUser.provider}.` 
              });
            }

            const [newUser] = await db.insert(users).values({
              email,
              firstName: profile.name?.givenName || profile._json.givenName,
              lastName: profile.name?.familyName || profile._json.surname,
              provider: "microsoft",
              providerId: profile.id,
            }).returning();
            user = newUser;
          }

          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );
}

// Apple OAuth Strategy
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY) {
  passport.use(
    new AppleStrategy(
      {
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        privateKeyString: process.env.APPLE_PRIVATE_KEY,
        callbackURL: `${getBaseUrl()}/api/auth/apple/callback`,
      },
      // @ts-ignore - Apple strategy types are incomplete
      async (accessToken, refreshToken, idToken, profile, done) => {
        try {
          // Apple only provides email on first authorization - use providerId as primary lookup
          let user = await db.query.users.findFirst({
            where: sql`${users.provider} = 'apple' AND ${users.providerId} = ${profile.id}`,
          });

          if (!user) {
            const email = profile.email || idToken.email;
            if (!email) {
              return done(null, false, { 
                message: "No email provided by Apple. This may be a subsequent login - email is only provided on first authorization." 
              });
            }

            const existingEmailUser = await db.query.users.findFirst({
              where: eq(users.email, email),
            });

            if (existingEmailUser) {
              return done(null, false, { 
                message: `This email is already registered with ${existingEmailUser.provider}. Please sign in using ${existingEmailUser.provider}.` 
              });
            }

            const [newUser] = await db.insert(users).values({
              email,
              firstName: profile.name?.firstName,
              lastName: profile.name?.lastName,
              provider: "apple",
              providerId: profile.id,
            }).returning();
            user = newUser;
          }

          done(null, user);
        } catch (error) {
          done(error);
        }
      }
    )
  );
}

// Local Strategy (Email/Password)
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (!user) {
          return done(null, false, { message: "Invalid email or password" });
        }

        // Only allow email/password auth for users registered with email
        if (user.provider !== "email" || !user.passwordHash) {
          return done(null, false, { 
            message: `This email is registered with ${user.provider}. Please sign in using ${user.provider}.` 
          });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return done(null, false, { message: "Invalid email or password" });
        }

        done(null, user);
      } catch (error) {
        done(error);
      }
    }
  )
);

export default passport;
