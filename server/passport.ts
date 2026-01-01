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
    console.error('[Passport] Deserialize error:', error);
    done(error);
  }
});

// Helper to get base URL
const getBaseUrl = () => {
  // Check for production domain first (for lead2lease.ai)
  if (process.env.PRODUCTION_DOMAIN) {
    const url = `https://${process.env.PRODUCTION_DOMAIN}`;
    console.log('[OAuth] Base URL (production):', url);
    return url;
  }
  
  // Check for Replit domain
  const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
  if (replitDomain) {
    const url = `https://${replitDomain}`;
    console.log('[OAuth] Base URL (Replit):', url);
    return url;
  }
  
  // Check for BASE_URL env var
  if (process.env.BASE_URL) {
    console.log('[OAuth] Base URL (BASE_URL env):', process.env.BASE_URL);
    return process.env.BASE_URL;
  }
  
  // Fallback to localhost
  const fallback = "http://localhost:5000";
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
        console.log('[Google OAuth] Callback triggered with profile:', profile.id, profile.emails?.[0]?.value);
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            console.log('[Google OAuth] No email in profile');
            return done(null, false, { message: "No email provided by Google" });
          }

          // First check if user exists with this Google providerId
          let user = await db.query.users.findFirst({
            where: sql`${users.provider} = 'google' AND ${users.providerId} = ${profile.id}`,
          });
          console.log('[Google OAuth] Existing user found by providerId:', !!user);

          // If not found by providerId, check by email (for users who linked OAuth to email/password account)
          if (!user) {
            const existingEmailUser = await db.query.users.findFirst({
              where: eq(users.email, email),
            });

            if (existingEmailUser) {
              // Email exists - link Google OAuth to existing account
              console.log('[Google OAuth] Email exists with provider:', existingEmailUser.provider, '- linking Google OAuth to existing account');
              
              // If user has passwordHash, keep provider as "email" so they can use both methods
              // Otherwise, switch to Google as the provider
              const shouldKeepEmailProvider = existingEmailUser.provider === 'email' && existingEmailUser.passwordHash;
              const updatedUser = await db.update(users)
                .set({
                  provider: shouldKeepEmailProvider ? "email" : "google", // Keep email provider if they have password
                  providerId: profile.id, // Store Google providerId for OAuth login
                  // Update profile image if not already set
                  profileImageUrl: existingEmailUser.profileImageUrl || profile.photos?.[0]?.value,
                  // Update name if not already set
                  firstName: existingEmailUser.firstName || profile.name?.givenName,
                  lastName: existingEmailUser.lastName || profile.name?.familyName,
                })
                .where(eq(users.id, existingEmailUser.id))
                .returning();
              
              user = updatedUser[0];
              console.log('[Google OAuth] Linked Google OAuth to existing account:', user.id, '- provider:', user.provider);
            } else {
            // Create new user with Google
            console.log('[Google OAuth] Creating new user');
            // Note: Consent will be set from session in the callback route handler
            const [newUser] = await db.insert(users).values({
              email,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              profileImageUrl: profile.photos?.[0]?.value,
              provider: "google",
              providerId: profile.id,
              termsAccepted: true, // Will be updated from session in callback if available
              emailSubscription: false, // Will be updated from session in callback if available
            }).returning();
            user = newUser;
            console.log('[Google OAuth] New user created:', user.id);
            }
          }

          console.log('[Google OAuth] Calling done with user:', user.id);
          done(null, user);
        } catch (error) {
          console.error('[Google OAuth] Error:', error);
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
              const providerDisplay = existingEmailUser.provider === 'email' 
                ? 'email/password' 
                : existingEmailUser.provider;
              return done(null, false, { 
                message: `This email is already registered using ${providerDisplay}. Please sign in with ${providerDisplay} instead.` 
              });
            }

            const [newUser] = await db.insert(users).values({
              email,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              profileImageUrl: profile.photos?.[0]?.value,
              provider: "facebook",
              providerId: profile.id,
              termsAccepted: true, // OAuth users implicitly accept terms by using OAuth
              emailSubscription: false, // Default to false, can be updated later
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

          // First check if user exists with this Microsoft providerId
          let user = await db.query.users.findFirst({
            where: sql`${users.provider} = 'microsoft' AND ${users.providerId} = ${profile.id}`,
          });

          // If not found by providerId, check by email (for users who linked OAuth to email/password account)
          if (!user) {
            const existingEmailUser = await db.query.users.findFirst({
              where: eq(users.email, email),
            });

            if (existingEmailUser) {
              // Email exists but with different provider - link Microsoft OAuth to existing account
              console.log('[Microsoft OAuth] Email exists with different provider:', existingEmailUser.provider, '- linking Microsoft OAuth to existing account');
              
              // If user has passwordHash, keep provider as "email" so they can use both methods
              const shouldKeepEmailProvider = existingEmailUser.provider === 'email' && existingEmailUser.passwordHash;
              const updatedUser = await db.update(users)
                .set({
                  provider: shouldKeepEmailProvider ? "email" : "microsoft",
                  providerId: profile.id,
                  profileImageUrl: existingEmailUser.profileImageUrl || undefined,
                  firstName: existingEmailUser.firstName || profile.name?.givenName || profile._json.givenName,
                  lastName: existingEmailUser.lastName || profile.name?.familyName || profile._json.surname,
                })
                .where(eq(users.id, existingEmailUser.id))
                .returning();
              
              user = updatedUser[0];
              console.log('[Microsoft OAuth] Linked Microsoft OAuth to existing account:', user.id, '- provider:', user.provider);
            } else {
            const [newUser] = await db.insert(users).values({
              email,
              firstName: profile.name?.givenName || profile._json.givenName,
              lastName: profile.name?.familyName || profile._json.surname,
              provider: "microsoft",
              providerId: profile.id,
              termsAccepted: true, // OAuth users implicitly accept terms by using OAuth
              emailSubscription: false, // Default to false, can be updated later
            }).returning();
            user = newUser;
            }
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

            // If not found by providerId, check by email (for users who linked OAuth to email/password account)
            const existingEmailUser = await db.query.users.findFirst({
              where: eq(users.email, email),
            });

            if (existingEmailUser) {
              // Email exists but with different provider - link Apple OAuth to existing account
              console.log('[Apple OAuth] Email exists with different provider:', existingEmailUser.provider, '- linking Apple OAuth to existing account');
              
              // If user has passwordHash, keep provider as "email" so they can use both methods
              const shouldKeepEmailProvider = existingEmailUser.provider === 'email' && existingEmailUser.passwordHash;
              const updatedUser = await db.update(users)
                .set({
                  provider: shouldKeepEmailProvider ? "email" : "apple",
                  providerId: profile.id,
                  firstName: existingEmailUser.firstName || profile.name?.firstName,
                  lastName: existingEmailUser.lastName || profile.name?.lastName,
                })
                .where(eq(users.id, existingEmailUser.id))
                .returning();
              
              user = updatedUser[0];
              console.log('[Apple OAuth] Linked Apple OAuth to existing account:', user.id, '- provider:', user.provider);
            } else {
            const [newUser] = await db.insert(users).values({
              email,
              firstName: profile.name?.firstName,
              lastName: profile.name?.lastName,
              provider: "apple",
              providerId: profile.id,
              termsAccepted: true, // OAuth users implicitly accept terms by using OAuth
              emailSubscription: false, // Default to false, can be updated later
            }).returning();
            user = newUser;
            }
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
          return done(null, false, { message: "You do not have an account. Please contact support to create an account." });
        }

        // Only allow email/password auth for users registered with email
        if (user.provider !== "email" || !user.passwordHash) {
          const providerDisplay = user.provider === 'email' 
            ? 'email/password' 
            : user.provider;
          return done(null, false, { 
            message: `This email is registered with ${providerDisplay}. Please sign in using ${providerDisplay}.` 
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
