import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import { insertLeadSchema, insertPropertySchema, insertPropertyUnitSchema, insertConversationSchema, insertNoteSchema, insertAISettingSchema, insertIntegrationConfigSchema, insertPendingReplySchema, insertCalendarConnectionSchema, insertSchedulePreferenceSchema, insertZillowIntegrationSchema, insertZillowListingSchema, insertDemoRequestSchema, insertAppointmentSchema, insertShowingSchema, insertPropertySchedulingSettingsSchema, assignedMemberSchema, insertListingSchema, insertQualificationTemplateSchema, insertLeadQualificationSchema, insertQualificationSettingsSchema, qualificationQuestionSchema, type User, type Showing, type QualificationQuestion, type QualificationTemplate } from "@shared/schema";
import { getGmailAuthUrl, getGmailTokensFromCode, listMessages, getMessage, sendReply, getGmailUserEmail } from "./gmail";
import { getOutlookAuthUrl, getOutlookTokensFromCode, listOutlookMessages, getOutlookMessage, sendOutlookReply, sendOutlookEmail, getUserProfile, refreshOutlookToken } from "./outlook";
import { parseMessengerWebhook, sendMessengerMessage, getMessengerUserProfile } from "./messenger";
import { getFacebookAuthUrl, getFacebookTokensFromCode, getFacebookPages, getLongLivedPageAccessToken, subscribePage } from "./facebook";
import { getCalendarAuthUrl, getCalendarTokensFromCode, listCalendars, listCalendarEvents, refreshCalendarToken, registerCalendarWebhook, stopCalendarWebhook, createOrUpdateCalendarEvent } from "./googleCalendar";
import { getAvailabilityContext } from "./calendarAvailability";
import { cleanEmailBody, cleanEmailSubject } from "./emailUtils";
import { normalizeEmailSubject } from "@shared/emailUtils";
import { sendInvitationEmail } from "./emailService";
import { sendDemoRequestNotification } from "./email";
import OpenAI from "openai";
import authRouter from "./auth";
import { gmailScanner } from "./gmailScanner";
import { db } from "./db";
import { generateAIReplyV2 } from "./aiReplyGeneratorV2";
import { zillowListings, properties, organizations, conversations, onboardingIntakes, showings, propertyUnits, leads, schedulePreferences, pendingSubscriptions, memberships, users, integrationConfig, autopilotActivityLogs } from "@shared/schema";
import { eq, and, isNull, isNotNull, desc, sql, or, gte } from "drizzle-orm";
import { z } from "zod";
import { getUncachableStripeClient, getStripePublishableKey, getStripeLookupKey, getPriceByLookupKey } from "./stripeClient";
import { getBaseUrlForBookingLink } from "./domainConfig";
import { v1Router, createInternalRoutes } from "./integrations/apiConnector";

console.log("🔥🔥🔥 ROUTES.TS LOADED AT:", new Date().toISOString(), "🔥🔥🔥");

// Middleware to check if user is authenticated
function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Cache for org context (keyed by userId:sessionId to handle org switches)
const orgContextCache = new Map<string, { orgId: string; role: string; expiresAt: number }>();
const ORG_CONTEXT_CACHE_TTL = 300000; // 5 minutes cache (increased from 60 seconds for better performance)

// Middleware to attach organization context to request
async function attachOrgContext(req: any, res: any, next: any) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Check cache first
    const cacheKey = `${req.user.id}:${req.sessionID || 'no-session'}`;
    const cached = orgContextCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      req.orgId = cached.orgId;
      req.role = cached.role;
      console.log(`[Org Context] Using cached orgId: ${cached.orgId} for user ${req.user.id}`);
      return next();
    }
    
    // OPTIMIZED: Try to get membership directly first (faster path)
    // Only fetch user if we need currentOrgId
    let membership;
    
    // Try user's preferred org first if we can get it from session/cache
    // Otherwise fetch user to check currentOrgId
    const user = await storage.getUser(req.user.id);
    
    // Use user's preferred org if set AND user is an active member of that org
    if (user?.currentOrgId) {
      // Get full membership to check status
      const fullMembership = await storage.getMembershipFull(req.user.id, user.currentOrgId);
      if (fullMembership && fullMembership.status === 'active') {
        // Use the simplified membership format
        membership = {
          orgId: fullMembership.orgId,
          role: fullMembership.role
        };
        console.log(`[Org Context] User ${req.user.id} using currentOrgId: ${user.currentOrgId} (active membership)`);
      } else if (fullMembership && fullMembership.status !== 'active') {
        console.log(`[Org Context] User ${req.user.id} has currentOrgId ${user.currentOrgId} but membership is ${fullMembership.status}, falling back to first active membership`);
        membership = undefined; // Fall back to first active membership
      } else {
        console.log(`[Org Context] User ${req.user.id} has currentOrgId ${user.currentOrgId} but is not a member, falling back to first active membership`);
      }
    }
    
    // Fallback to first active membership if no preference or membership not found/not active
    if (!membership) {
      membership = await storage.getUserOrganization(req.user.id);
      if (membership) {
        console.log(`[Org Context] User ${req.user.id} using fallback orgId: ${membership.orgId} (first active membership)`);
      }
    }
    
    if (!membership) {
      console.error(`[Org Context] User ${req.user.id} has no active organization memberships`);
      return res.status(403).json({ message: "User not assigned to any organization" });
    }
    
    // Cache the result
    orgContextCache.set(cacheKey, {
      orgId: membership.orgId,
      role: membership.role,
      expiresAt: Date.now() + ORG_CONTEXT_CACHE_TTL
    });
    
    // Clean up old cache entries periodically (keep last 1000)
    if (orgContextCache.size > 1000) {
      const entries = Array.from(orgContextCache.entries());
      entries.slice(0, 500).forEach(([key]) => orgContextCache.delete(key));
    }
    
    req.orgId = membership.orgId;
    req.role = membership.role;
    console.log(`[Org Context] ✅ Attached orgId: ${membership.orgId}, role: ${membership.role} to request for user ${req.user.id}`);
    next();
  } catch (error) {
    console.error("[Org Context] Error attaching org context:", error);
    res.status(500).json({ message: "Failed to load organization context" });
  }
}

// Zod validation schemas for AI scheduling endpoints
const analyzeConflictsSchema = z.object({
  propertyId: z.string().min(1, "Property ID is required"),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  durationMinutes: z.number().int().positive().optional().default(30),
  showingId: z.string().optional()
});

const suggestTimesSchema = z.object({
  propertyId: z.string().min(1, "Property ID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
});

// Store running Facebook polling processes by orgId
const facebookPollingProcesses = new Map<string, { process: any; pid: number; startedAt: Date }>();

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ===== AUTH ROUTES =====
  app.use('/api/auth', authRouter);

  // ===== STRIPE CHECKOUT ROUTES =====
  // Get Stripe publishable key (public endpoint)
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      console.error("[Stripe] Failed to get publishable key:", error);
      res.status(500).json({ error: "Failed to get Stripe configuration" });
    }
  });

  // Get Founding Partner product price from Stripe (public endpoint)
  app.get("/api/stripe/founding-partner-price", async (req, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      
      // Look for a product named "Founding Partner Membership" or with metadata
      const products = await stripe.products.list({
        limit: 100,
        active: true,
      });
      
      // Find founding partner product
      let foundingPartnerProduct = products.data.find(
        p => p.name === 'Founding Partner Membership' || 
        p.metadata?.membershipType === 'founding_partner' ||
        p.description?.toLowerCase().includes('founding partner')
      );
      
      // If not found, create it (or use the first product if only one exists)
      if (!foundingPartnerProduct) {
        // Try to find by price amount (14999 cents)
        const prices = await stripe.prices.list({
          limit: 100,
          active: true,
        });
        
        const foundingPartnerPrice = prices.data.find(
          p => p.unit_amount === 14999 && 
          p.recurring?.interval === 'month' &&
          (p.metadata?.membershipType === 'founding_partner' || 
           p.product === foundingPartnerProduct?.id)
        );
        
        if (foundingPartnerPrice) {
          foundingPartnerProduct = await stripe.products.retrieve(foundingPartnerPrice.product as string);
        } else {
          // Create the product if it doesn't exist
          foundingPartnerProduct = await stripe.products.create({
            name: 'Founding Partner Membership',
            description: 'Full access to Lead2Lease AI Leasing Agent, Smart Scheduling, Lead Management, and all premium features. Exclusive founding partner discount.',
            metadata: {
              membershipType: 'founding_partner',
            },
          });
        }
      }
      
      // Get the price for this product
      const prices = await stripe.prices.list({
        product: foundingPartnerProduct.id,
        active: true,
        limit: 10,
      });
      
      // Find monthly recurring price
      const monthlyPrice = prices.data.find(
        p => p.recurring?.interval === 'month' && p.active
      );
      
      if (!monthlyPrice) {
        // Create the price if it doesn't exist
        const newPrice = await stripe.prices.create({
          product: foundingPartnerProduct.id,
          unit_amount: 14999, // $149.99 in cents
          currency: 'usd',
          recurring: {
            interval: 'month',
          },
          metadata: {
            membershipType: 'founding_partner',
          },
        });
        
        return res.json({
          productId: foundingPartnerProduct.id,
          priceId: newPrice.id,
          amount: newPrice.unit_amount,
          currency: newPrice.currency,
          interval: newPrice.recurring?.interval,
          formattedAmount: (newPrice.unit_amount! / 100).toFixed(2),
        });
      }
      
      res.json({
        productId: foundingPartnerProduct.id,
        priceId: monthlyPrice.id,
        amount: monthlyPrice.unit_amount,
        currency: monthlyPrice.currency,
        interval: monthlyPrice.recurring?.interval,
        formattedAmount: (monthlyPrice.unit_amount! / 100).toFixed(2),
      });
    } catch (error: any) {
      console.error("[Stripe] Error fetching founding partner price:", error);
      // Fallback to default price
      res.json({
        productId: null,
        priceId: null,
        amount: 14999,
        currency: 'usd',
        interval: 'month',
        formattedAmount: '149.99',
      });
    }
  });

  // Create Founding Partner checkout session
  // REQUIRES authentication to identify the user
  // orgId is optional - if missing, subscription will be stored as pending and linked during post-purchase onboarding
  app.post("/api/stripe/founding-partner-checkout", isAuthenticated, async (req: any, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      const { name, orgId: providedOrgId, organizationName } = req.body;
      
      // Use authenticated user's email - don't trust client-provided email
      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.status(400).json({ error: "User email not found. Please complete your profile." });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(400).json({ error: "User not found. Please sign in again." });
      }

      // Get orgId from request body (explicitly provided by user)
      // Don't auto-detect - let user explicitly choose or create a new org
      let orgId = providedOrgId || null;

      // Cleanup orphaned organizations: Delete orgs created for checkout that have no subscription
      // Only cleanup if user is creating a new org (indicates they abandoned previous attempt)
      // This prevents accidental deletion of orgs the user might still want
      if (userId && organizationName) {
        try {
          const userOrgs = await storage.getUserOrganizations(userId);
          const now = new Date();
          const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

          for (const userOrg of userOrgs) {
            const org = await storage.getOrganization(userOrg.orgId);
            if (org && 
                !org.stripeSubscriptionId && 
                org.foundingPartnerStatus === 'none' &&
                org.createdAt && 
                new Date(org.createdAt) > twentyFourHoursAgo) {
              // This org was created recently but has no subscription - likely orphaned from incomplete checkout
              // Only clean up if user is owner (they created it for checkout)
              const membership = await storage.getMembership(userId, org.id);
              if (membership && membership.role === 'owner') {
                console.log(`[Stripe Checkout] Cleaning up orphaned organization ${org.id} created ${org.createdAt} with no subscription`);
                await storage.deleteOrganization(org.id, userId);
                console.log(`[Stripe Checkout] ✅ Deleted orphaned organization ${org.id}`);
                
                // If this was the current org, clear it
                const user = await storage.getUser(userId);
                if (user?.currentOrgId === org.id) {
                  const remainingOrgs = userOrgs.filter(o => o.orgId !== org.id);
                  if (remainingOrgs.length > 0) {
                    await storage.updateUser(userId, { currentOrgId: remainingOrgs[0].orgId });
                  } else {
                    await storage.updateUser(userId, { currentOrgId: null });
                  }
                }
              }
            }
          }
        } catch (cleanupError) {
          console.error("[Stripe Checkout] Error cleaning up orphaned orgs (non-fatal):", cleanupError);
          // Don't fail checkout if cleanup fails
        }
      }

      // If organizationName is provided, create a new organization (user wants to start fresh)
      // This allows non-owners to create their own organization and start a membership
      // Store the orgId before creating checkout session so we can track it
      let orgCreatedForCheckout = false;
      if (organizationName && organizationName.trim()) {
        // Create the organization with the provided name
        const newOrg = await storage.createOrganization(organizationName.trim(), userId);
        orgId = newOrg.id;
        orgCreatedForCheckout = true;
        
        // Update user's currentOrgId to the newly created organization
        await storage.updateUser(userId, { currentOrgId: orgId });
        
        console.log(`[Stripe Checkout] Created new organization ${orgId} (${organizationName.trim()}) for user ${userId} and set as current org`);
      }
      
      // orgId is optional - if not present, subscription will be linked during onboarding
      const hasOrg = !!orgId;
      const isCreatingNewOrg = !!organizationName && organizationName.trim();
      console.log(`[Stripe Checkout] User ${userId} checkout - hasOrg: ${hasOrg}, orgId: ${orgId || 'none'}, isCreatingNewOrg: ${isCreatingNewOrg}`);
      
      // Get the org object - either the newly created one or existing one
      let org = null;
      let orgNameForMetadata: string | null = null; // Store org name separately for metadata
      
      if (orgId) {
        org = await storage.getOrganization(orgId);
        if (org) {
          orgNameForMetadata = org.name;
          console.log(`[Stripe Checkout] Retrieved org: ${org.name} (${orgId})`);
        } else if (isCreatingNewOrg && organizationName) {
          // If org was just created but not found, use the provided name
          orgNameForMetadata = organizationName.trim();
          console.log(`[Stripe Checkout] Using provided org name for metadata: ${orgNameForMetadata}`);
        }
      } else if (isCreatingNewOrg && organizationName) {
        // If creating new org but orgId not set yet, use provided name
        orgNameForMetadata = organizationName.trim();
        console.log(`[Stripe Checkout] Using provided org name for metadata (org not created yet): ${orgNameForMetadata}`);
      }
      
      // Check for existing pending subscriptions for this user
      if (!hasOrg) {
        const existingPending = await db.select().from(pendingSubscriptions)
          .where(and(
            eq(pendingSubscriptions.userId, userId),
            eq(pendingSubscriptions.status, 'pending')
          ))
          .limit(1);
        
        if (existingPending.length > 0) {
          console.log(`[Stripe Checkout] User ${userId} has pending subscription ${existingPending[0].id}`);
          // Redirect to onboarding to complete their purchase
          return res.status(400).json({ 
            error: "You have a pending membership. Please complete your company setup to activate it.",
            redirectTo: "/founding-partner-onboarding"
          });
        }
      }

      // CHECK 1: Check if organization already has an active subscription (only if org exists and not creating new)
      // Only check owner status if orgId was explicitly provided (not auto-detected)
      // If user is creating a new org, they automatically become the owner, so no check needed
      if (orgId && !isCreatingNewOrg && org) {
        
        // Only check owner status if orgId was explicitly provided by the user
        // This means they selected an existing organization to apply membership to
        if (providedOrgId) {
          // Verify user is an owner of this organization (only owners can apply membership to existing orgs)
          const membership = await storage.getMembership(userId, orgId);
          if (!membership) {
            return res.status(403).json({ error: "You are not a member of this organization" });
          }
          
          if (membership.role !== 'owner') {
            return res.status(403).json({ 
              error: "Only organization owners can apply a membership to an existing organization. Please contact your organization owner or create a new organization." 
            });
          }
        }
      }
      if (org?.stripeSubscriptionId) {
        // Verify subscription is still active in Stripe
        try {
          const existingSub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
          if (existingSub.status === 'active' || existingSub.status === 'trialing') {
            console.log(`[Stripe Checkout] Organization ${orgId} already has active subscription ${org.stripeSubscriptionId}`);
            return res.status(400).json({ 
              error: "Your organization already has an active Founding Partner membership. You can manage it in Settings > Billing." 
            });
          }
        } catch (subError: any) {
          // Subscription might not exist in Stripe anymore
          if (subError.code === 'resource_missing') {
            console.log(`[Stripe Checkout] Org subscription ${org.stripeSubscriptionId} not found in Stripe, clearing DB reference`);
            // Clear the stale subscription reference
            await db.update(organizations)
              .set({ 
                stripeSubscriptionId: null, 
                foundingPartnerStatus: 'none',
                updatedAt: new Date() 
              })
              .where(eq(organizations.id, orgId));
          } else {
            console.log(`[Stripe Checkout] Could not verify existing subscription: ${subError.message}`);
          }
        }
      } else if (org?.foundingPartnerStatus === 'active') {
        // Org shows active but no subscription ID - likely stale, search Stripe by customer ID
        if (org.stripeCustomerId) {
          try {
            const activeSubscriptions = await stripe.subscriptions.list({
              customer: org.stripeCustomerId,
              status: 'active',
              limit: 5,
            });
            if (activeSubscriptions.data.length > 0) {
              console.log(`[Stripe Checkout] Organization ${orgId} has active subscription via customer ID ${org.stripeCustomerId}`);
              return res.status(400).json({ 
                error: "Your organization already has an active membership. You can manage it in Settings > Billing." 
              });
            }
          } catch (e) {
            console.log(`[Stripe Checkout] Could not check customer subscriptions, allowing new purchase`);
          }
        }
      }

      // CHECK 2: Quick check if user's email has active Founding Partner subscriptions
      // Only check if NOT creating a new organization (when creating new org, allow multiple subscriptions)
      // When applying to existing org, prevent duplicates
      if (!isCreatingNewOrg && orgId) {
        try {
          const existingCustomers = await stripe.customers.list({
            email: userEmail,
            limit: 5, // Limit to avoid excessive API calls
          });

          for (const customer of existingCustomers.data) {
            // Fetch ALL subscription statuses to check for cancelled/incomplete ones
            const allSubscriptions = await stripe.subscriptions.list({
              customer: customer.id,
              limit: 10, // Get more subscriptions to check all statuses
            });

            for (const sub of allSubscriptions.data) {
              // Check if this is a Founding Partner subscription
              const isFoundingPartner = sub.metadata?.membershipType === 'founding_partner' ||
                sub.items.data.some(item => item.price.unit_amount === 14999 && item.price.recurring?.interval === 'month');
              
              if (isFoundingPartner) {
                const subOrgId = sub.metadata?.orgId || sub.metadata?.organization_id;
                
                // Only consider subscriptions that are truly active (not cancelled, incomplete, incomplete_expired, etc.)
                const isActiveSub = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
                const isCancelledOrInactive = sub.status === 'canceled' || sub.status === 'incomplete' || 
                                             sub.status === 'incomplete_expired' || sub.status === 'unpaid';

                console.log(`[Stripe Checkout] Checking subscription ${sub.id} - status: ${sub.status}, orgId: ${subOrgId}, target orgId: ${orgId}, isActive: ${isActiveSub}, isCancelled: ${isCancelledOrInactive}`);

                if (subOrgId === orgId && isActiveSub && !isCancelledOrInactive) {
                  // Only block if the subscription for this org is truly active
                  console.log(`[Stripe Checkout] Found existing ACTIVE subscription ${sub.id} (status: ${sub.status}) for this org via email lookup`);
                  return res.status(400).json({ 
                    error: "Your organization already has an active Founding Partner membership. You can manage it in Settings > Billing." 
                  });
                } else if (subOrgId === orgId && isCancelledOrInactive) {
                  // Subscription exists but is cancelled/inactive - allow new purchase
                  console.log(`[Stripe Checkout] Found cancelled/inactive subscription ${sub.id} (status: ${sub.status}) for this org. Allowing new purchase.`);
                  // Continue - don't block
                } else if (subOrgId && subOrgId !== orgId) {
                  // This subscription is linked to a DIFFERENT org
                  // Allow this - users can have multiple memberships for different organizations
                  console.log(`[Stripe Checkout] Email ${userEmail} has active Founding Partner subscription ${sub.id} linked to different org ${subOrgId}. Allowing new subscription for org ${orgId} - users can have multiple memberships.`);
                  // Continue with checkout - don't block
                } else {
                  // Subscription has no orgId in metadata - legacy or malformed
                  // Attempt to link it to current org first
                  console.log(`[Stripe Checkout] Found unlinked Founding Partner subscription ${sub.id} for email ${userEmail}. Attempting to link to org ${orgId}...`);
                  
                  // Try to link this orphaned subscription to the current org
                  try {
                    await stripe.subscriptions.update(sub.id, {
                      metadata: {
                        ...sub.metadata,
                        orgId: orgId,
                        organization_id: orgId,
                        membershipType: 'founding_partner',
                        linkedAt: new Date().toISOString(),
                      },
                    });
                    
                    // Update org in database
                    await db.update(organizations)
                      .set({
                        foundingPartnerStatus: 'active',
                        stripeCustomerId: customer.id,
                        stripeSubscriptionId: sub.id,
                        subscriptionCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
                        subscriptionCancelledAt: null,
                        updatedAt: new Date(),
                      })
                      .where(eq(organizations.id, orgId));
                    
                    console.log(`[Stripe Checkout] ✅ Linked orphaned subscription ${sub.id} to org ${orgId}`);
                    return res.status(400).json({ 
                      error: "Good news! We found your existing membership and linked it to your organization. You can manage it in Settings > Billing." 
                    });
                  } catch (linkError) {
                    console.error(`[Stripe Checkout] Failed to link orphaned subscription:`, linkError);
                    // Don't block - allow checkout to proceed even if linking fails
                    console.log(`[Stripe Checkout] Continuing with checkout despite unlinkable subscription`);
                  }
                }
              }
            }
          }
        } catch (stripeError) {
          // Don't block checkout if email check fails - org-level check is the primary guard
          console.log(`[Stripe Checkout] Email subscription check failed, continuing with checkout`);
        }
      } else if (isCreatingNewOrg) {
        // When creating a new organization, allow purchase even if user has subscriptions for other orgs
        console.log(`[Stripe Checkout] Creating new organization, allowing purchase even if user has other subscriptions`);
      }

      // Get the base URL for redirects
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5000';
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
      const protocol = req.headers['x-forwarded-proto'] || (isLocalhost ? 'http' : 'https');
      const baseUrl = `${protocol}://${host}`;

      // Determine success URL based on whether user has an org
      // Users with org go to success page, users without org go to onboarding
      const successUrl = hasOrg 
        ? `${baseUrl}/founding-partner-success?session_id={CHECKOUT_SESSION_ID}`
        : `${baseUrl}/founding-partner-onboarding?session_id={CHECKOUT_SESSION_ID}`;

      // Get the founding partner price from Stripe using lookup key
      let priceId: string | null = null;
      let priceType: 'subscription' | 'payment' = 'subscription'; // Default to subscription mode
      try {
        // First, try to use lookup key from environment variable
        const lookupKey = getStripeLookupKey();
        if (lookupKey) {
          console.log(`[Stripe Checkout] Using lookup key from environment: ${lookupKey}`);
          const priceData = await getPriceByLookupKey(lookupKey);
          
          if (priceData) {
            const { price, product } = priceData;
            priceId = price.id;
            // Use the price type as-is from the lookup key
            // Pre-launch: lookup key points to one-time payment -> mode: 'payment'
            // Post-launch: lookup key points to recurring price -> mode: 'subscription'
            priceType = price.recurring ? 'subscription' : 'payment';
            
            console.log(`[Stripe Checkout] ✅ Found price via lookup key "${lookupKey}":`, {
              priceId: price.id,
              productId: product.id,
              productName: product.name,
              amount: price.unit_amount,
              currency: price.currency,
              type: price.type,
              interval: price.recurring?.interval || 'one_time',
              checkoutMode: priceType,
            });
          } else {
            console.error(`[Stripe Checkout] ❌ Lookup key "${lookupKey}" not found in Stripe`);
            // Don't fall back - lookup key must be valid
            throw new Error(`Price with lookup key "${lookupKey}" not found in Stripe. Please verify the lookup key is correct.`);
          }
        } else {
          console.log(`[Stripe Checkout] No STRIPE_LOOKUP_KEY environment variable set, using legacy product lookup`);
        }
        
        // Fallback to legacy lookup ONLY if no lookup key is set
        // If lookup key is set, we must use it (error already thrown above if not found)
        if (!priceId && !lookupKey) {
          // Look for a product named "Founding Partner Membership" or with metadata
          const products = await stripe.products.list({
            limit: 100,
            active: true,
          });
          
          // Find founding partner product
          let foundingPartnerProduct = products.data.find(
            p => p.name === 'Founding Partner Membership' || 
            p.metadata?.membershipType === 'founding_partner' ||
            p.description?.toLowerCase().includes('founding partner')
          );
          
          if (foundingPartnerProduct) {
            // Get the price for this product
            const prices = await stripe.prices.list({
              product: foundingPartnerProduct.id,
              active: true,
              limit: 10,
            });
            
            // Find monthly recurring price
            const monthlyPrice = prices.data.find(
              p => p.recurring?.interval === 'month' && p.active
            );
            
            if (monthlyPrice) {
              priceId = monthlyPrice.id;
              priceType = 'subscription';
              console.log(`[Stripe Checkout] Using existing price ID from legacy lookup: ${priceId}`);
            }
          }
          
          // If no price found, create product and price
          if (!priceId) {
            if (!foundingPartnerProduct) {
              foundingPartnerProduct = await stripe.products.create({
                name: 'Founding Partner Membership',
                description: 'Full access to Lead2Lease AI Leasing Agent, Smart Scheduling, Lead Management, and all premium features. Exclusive founding partner discount.',
                metadata: {
                  membershipType: 'founding_partner',
                },
              });
            }
            
            const newPrice = await stripe.prices.create({
              product: foundingPartnerProduct.id,
              unit_amount: 14999, // $149.99 in cents
              currency: 'usd',
              recurring: {
                interval: 'month',
              },
              metadata: {
                membershipType: 'founding_partner',
              },
            });
            
            priceId = newPrice.id;
            priceType = 'subscription';
            console.log(`[Stripe Checkout] Created new price ID: ${priceId}`);
          }
        }
      } catch (error: any) {
        console.error("[Stripe Checkout] Error fetching/creating price:", error);
        // If lookup key was set but price not found, return error to user
        if (getStripeLookupKey() && error.message?.includes('lookup key')) {
          return res.status(500).json({ 
            error: error.message || "Failed to create checkout session. The configured price could not be found in Stripe." 
          });
        }
        // For other errors, log and continue (will use inline price_data as fallback)
        console.error("[Stripe Checkout] Will attempt to create checkout with inline price_data as fallback");
      }

      // BEST PRACTICE: Create/find Stripe Customer tied to Organization (not User)
      // Organization is the billing entity, Owner is the billing contact
      let stripeCustomerId: string | null = null;
      
      // Get owner's email (billing contact) - owner is the billing admin
      let ownerEmail = userEmail; // Default to current user
      let ownerUserId = userId;
      let ownerName = name || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim();
      
      if (hasOrg && org) {
        // Find the organization owner (role = 'owner') - they are the billing contact
        try {
          const orgMembers = await db
            .select({
              user: users,
              role: memberships.role,
            })
            .from(users)
            .innerJoin(memberships, eq(users.id, memberships.userId))
            .where(and(
              eq(memberships.orgId, orgId),
              eq(memberships.role, 'owner')
            ))
            .limit(1);
          
          if (orgMembers.length > 0 && orgMembers[0].user) {
            ownerEmail = orgMembers[0].user.email;
            ownerUserId = orgMembers[0].user.id;
            ownerName = `${orgMembers[0].user.firstName || ''} ${orgMembers[0].user.lastName || ''}`.trim() || ownerEmail;
            console.log(`[Stripe Checkout] Using owner email ${ownerEmail} for billing contact (org: ${orgId})`);
          } else {
            console.log(`[Stripe Checkout] No owner found for org ${orgId}, using current user ${userEmail} as billing contact`);
          }
        } catch (error) {
          console.error(`[Stripe Checkout] Error finding owner, using current user:`, error);
        }
        
        // Organization exists - use existing customer or create one
        if (org.stripeCustomerId) {
          // Verify customer still exists in Stripe
          try {
            const existingCustomer = await stripe.customers.retrieve(org.stripeCustomerId);
            
            // Check if customer was deleted
            if (existingCustomer.deleted) {
              console.log(`[Stripe Checkout] Customer ${org.stripeCustomerId} was deleted in Stripe, will create new one`);
            } else {
              stripeCustomerId = org.stripeCustomerId;
              console.log(`[Stripe Checkout] Using existing Stripe customer ${stripeCustomerId} for org ${orgId}`);
              
              // Update customer email if owner changed (for receipts)
              const customerEmail = (existingCustomer as any).email;
              if (customerEmail && customerEmail !== ownerEmail) {
                await stripe.customers.update(stripeCustomerId, {
                  email: ownerEmail, // Owner email (billing contact for receipts)
                  metadata: {
                    ...((existingCustomer as any).metadata || {}),
                    billing_contact_email: ownerEmail,
                    billing_contact_user_id: ownerUserId,
                  },
                });
                console.log(`[Stripe Checkout] Updated customer email to ${ownerEmail} (owner changed)`);
              }
            }
          } catch (error: any) {
            if (error.code === 'resource_missing') {
              console.log(`[Stripe Checkout] Customer ${org.stripeCustomerId} not found in Stripe, will create new one`);
              // Customer doesn't exist, will create new one below
            } else {
              throw error;
            }
          }
        }
        
        // Create new customer if we don't have one
        if (!stripeCustomerId) {
          const newCustomer = await stripe.customers.create({
            name: org.name, // Organization name (billing entity)
            email: ownerEmail, // Owner email (billing contact for receipts)
            phone: org.phone || undefined,
            address: org.address ? {
              line1: org.address, // You may want to parse this better
            } : undefined,
            metadata: {
              organization_id: orgId,
              organization_name: org.name,
              billing_contact_user_id: ownerUserId,
              billing_contact_email: ownerEmail,
              billing_contact_name: ownerName,
              app_env: process.env.NODE_ENV || 'development',
            },
          });
          stripeCustomerId = newCustomer.id;
          console.log(`[Stripe Checkout] Created new Stripe customer ${stripeCustomerId} for org ${orgId} (${org.name}), owner: ${ownerEmail}`);
          
          // Update org with customer ID
          await db.update(organizations)
            .set({ stripeCustomerId: stripeCustomerId, updatedAt: new Date() })
            .where(eq(organizations.id, orgId));
        }
      }

      // Create a checkout session with proper organization linking
      // Use the price type determined from lookup key or fallback
      // IMPORTANT: If using lookup key, we MUST have a priceId - never use inline price_data
      if (getStripeLookupKey() && !priceId) {
        console.error(`[Stripe Checkout] ❌ Lookup key is set but priceId is null - cannot create checkout`);
        return res.status(500).json({ 
          error: "Failed to create checkout session. The configured price could not be found in Stripe." 
        });
      }
      
      // If no priceId at this point, use fallback inline price_data (only when lookup key is not set)
      const lineItems = priceId ? [{
        price: priceId, // Stripe will automatically use product name/description from this price
        quantity: 1,
      }] : [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Founding Partner Membership',
            description: 'Full access to Lead2Lease AI Leasing Agent, Smart Scheduling, Lead Management, and all premium features. Exclusive founding partner discount.',
          },
          unit_amount: 14999, // $149.99 in cents (fallback)
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      }];
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: priceType, // Use 'subscription' or 'payment' based on price type from lookup key
        // If org exists, use customer ID (tied to org). Otherwise, use owner email (will create customer during checkout)
        ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_email: ownerEmail }),
        // For one-time payments, save the payment method for future use (to convert to recurring later)
        // Only set customer_creation if we don't already have a customer (can't use both customer and customer_creation)
        ...(priceType === 'payment' ? {
          payment_intent_data: {
            setup_future_usage: 'off_session', // Save card for future charges (converting to subscription later)
          },
          // Only set customer_creation if we don't have an existing customer
          ...(!stripeCustomerId ? { customer_creation: 'always' } : {}),
        } : {}),
        // Use orgId as client_reference_id when org exists
        client_reference_id: hasOrg ? orgId : `user:${userId}`,
        metadata: {
          membershipType: 'founding_partner',
          orgId: orgId || '', // May be empty if user has no org yet
          organization_name: orgNameForMetadata || org?.name || '', // Use stored org name or org object name
          userId: ownerUserId, // Owner user ID (billing contact)
          customerEmail: ownerEmail, // Owner email (billing contact)
          billing_contact_user_id: ownerUserId,
          billing_contact_email: ownerEmail,
          billing_contact_name: ownerName,
          signupSource: hasOrg ? 'authenticated_with_org' : 'authenticated_pending_org',
          needsOnboarding: hasOrg ? 'false' : 'true',
          orgCreatedForCheckout: orgCreatedForCheckout ? 'true' : 'false', // Track if org was created for this checkout
          app_env: process.env.NODE_ENV || 'development',
        },
        // Only include subscription_data if mode is 'subscription'
        ...(priceType === 'subscription' ? {
          subscription_data: {
            metadata: {
              membershipType: 'founding_partner',
              organization_id: orgId || '', // Primary key for linking
              organization_name: orgNameForMetadata || org?.name || '', // Use stored org name or org object name
              billing_contact_user_id: ownerUserId, // Owner manages billing
              billing_contact_email: ownerEmail, // Owner email (receipts go here)
              billing_contact_name: ownerName,
              signupSource: hasOrg ? 'authenticated_with_org' : 'authenticated_pending_org',
              app_env: process.env.NODE_ENV || 'development',
            },
          },
        } : {}),
        success_url: successUrl,
        cancel_url: `${baseUrl}/founding-partner-checkout`,
      });

      // If org was created for checkout, store the session ID for cleanup tracking
      if (orgCreatedForCheckout && orgId) {
        try {
          // Store session ID in organization email field temporarily (or we could add a metadata field)
          // For now, we'll track it via session metadata and check on expiration
          // The webhook handler will use the session metadata to find and clean up the org
          console.log(`[Stripe Checkout] Tracking org ${orgId} created for checkout session ${session.id}`);
        } catch (trackError) {
          console.error(`[Stripe Checkout] Failed to track org for cleanup (non-fatal):`, trackError);
        }
      }

      console.log(`[Stripe Checkout] Created checkout session ${session.id} for ${hasOrg ? 'org ' + orgId : 'user ' + userId + ' (pending org)'}, email ${userEmail}`);
      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error("[Stripe] Checkout session creation failed:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Verify checkout session (public endpoint)
  app.get("/api/stripe/session/:sessionId", async (req: any, res) => {
    // This endpoint can be called by authenticated or unauthenticated users
    // If authenticated, we'll try to link the subscription
    const isAuth = req.isAuthenticated && req.user;
    try {
      const stripe = await getUncachableStripeClient();
      const { sessionId } = req.params;

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      // If user is authenticated and session is paid, try to link subscription
      if (isAuth && req.user?.email && session.payment_status === 'paid' && session.mode === 'subscription') {
        try {
          console.log(`[Session Verify] User authenticated, attempting to link subscription for ${req.user.email}`);
          const { linkSubscriptionToUser } = await import("./webhookHandlers");
          await linkSubscriptionToUser(req.user.email, req.user.id);
        } catch (linkError) {
          console.error("[Session Verify] Error linking subscription:", linkError);
          // Don't fail the request if linking fails
        }
      }
      
      // Get orgId from session metadata or subscription metadata
      let orgId: string | null = null;
      if (session.metadata?.orgId) {
        orgId = session.metadata.orgId;
      } else if (session.subscription) {
        try {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          orgId = subscription.metadata?.organization_id || subscription.metadata?.orgId || null;
        } catch (error) {
          console.error("[Session Verify] Error retrieving subscription metadata:", error);
        }
      }
      
      // Check if organization was created during checkout (new org indicator)
      const orgCreatedForCheckout = session.metadata?.orgCreatedForCheckout === 'true';
      
      res.json({
        status: session.payment_status,
        customerEmail: session.customer_email,
        customerName: session.metadata?.customerName,
        amount: session.amount_total,
        orgId: orgId,
        orgCreatedForCheckout: orgCreatedForCheckout,
      });
    } catch (error: any) {
      console.error("[Stripe] Session retrieval failed:", error);
      res.status(500).json({ error: "Failed to retrieve session" });
    }
  });

  // Check if user has any Stripe subscriptions
  app.get("/api/stripe/user-subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      const email = req.user?.email;

      if (!email) {
        return res.json({ hasSubscriptions: false, subscriptions: [] });
      }

      // Find all customers with this email
      const customers = await stripe.customers.list({
        email: email,
        limit: 100,
      });

      if (customers.data.length === 0) {
        return res.json({ hasSubscriptions: false, subscriptions: [] });
      }

      // Get all subscriptions for all customers
      const allSubscriptions: any[] = [];
      for (const customer of customers.data) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          limit: 100,
        });
        allSubscriptions.push(...subscriptions.data);
      }

      // Filter to active subscriptions (including those set to cancel at period end - they're still active until period ends)
      // We need to include subscriptions with cancel_at_period_end=true so we can filter them out in the UI
      const activeSubscriptions = allSubscriptions.filter(
        sub => sub.status === 'active' || sub.status === 'trialing' || (sub.status === 'canceled' && sub.cancel_at_period_end === false)
      );
      
      // Also include subscriptions that are active but set to cancel at period end
      // This allows us to identify them in the UI and filter them out
      const subscriptionsSetToCancel = allSubscriptions.filter(
        sub => (sub.status === 'active' || sub.status === 'trialing') && sub.cancel_at_period_end === true
      );
      
      // Combine both lists (avoid duplicates)
      const allRelevantSubscriptions = [...activeSubscriptions, ...subscriptionsSetToCancel.filter(
        sub => !activeSubscriptions.some(active => active.id === sub.id)
      )];

      // Get all organizations to match customer IDs (exclude deleted organizations)
      const { organizations } = await import("@shared/schema");
      const { db } = await import("./db");
      const allOrgs = await db.select()
        .from(organizations)
        .where(isNull(organizations.deletedAt)); // Exclude deleted organizations
      
      // Map subscriptions with organization info
      const subscriptionsWithOrg = allRelevantSubscriptions.map((sub) => {
        // Find organization that has this customer ID
        const org = allOrgs.find(o => o.stripeCustomerId === sub.customer);
        return {
          id: sub.id,
          status: sub.status,
          customerId: sub.customer,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end || false,
          orgId: org?.id || null,
          orgName: org?.name || null,
        };
      });

      return res.json({
        hasSubscriptions: subscriptionsWithOrg.length > 0,
        subscriptions: subscriptionsWithOrg,
      });
    } catch (error: any) {
      console.error("[Stripe] Error checking user subscriptions:", error);
      res.status(500).json({ error: "Failed to check subscriptions" });
    }
  });

  // Create Stripe Customer Portal session for subscription management (authenticated)
  app.post("/api/stripe/customer-portal", isAuthenticated, async (req: any, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      // Use authenticated user's email for security - don't accept email from body
      const email = req.user?.email;
      const { orgId, customerId, returnUrl } = req.body; // Optional: specific org or customer to manage, and return URL

      if (!email) {
        return res.status(400).json({ error: "User email not found" });
      }

      // Get the base URL for redirects
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5000';
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
      const protocol = req.headers['x-forwarded-proto'] || (isLocalhost ? 'http' : 'https');
      const baseUrl = `${protocol}://${host}`;
      
      // Use provided returnUrl or default to settings billing tab
      // Always return to /app/settings?tab=billing if no returnUrl provided (since this is accessed from settings)
      let finalReturnUrl: string;
      if (returnUrl) {
        // If returnUrl is already a full URL, use it; otherwise construct it from baseUrl
        if (returnUrl.startsWith('http://') || returnUrl.startsWith('https://')) {
          finalReturnUrl = returnUrl;
        } else {
          finalReturnUrl = `${baseUrl}${returnUrl.startsWith('/') ? returnUrl : `/${returnUrl}`}`;
        }
      } else {
        finalReturnUrl = `${baseUrl}/app/settings?tab=billing`;
      }

      // If orgId is provided, use that org's subscription
      if (orgId) {
        const org = await storage.getOrganization(orgId);
        if (!org) {
          return res.status(404).json({ error: "Organization not found" });
        }
        
        // Verify user is an owner of this org (only owners can manage billing)
        const membership = await storage.getMembership(req.user.id, orgId);
        if (!membership) {
          return res.status(403).json({ error: "You are not a member of this organization" });
        }
        
        if (membership.role !== 'owner') {
          return res.status(403).json({ error: "Only organization owners can manage billing" });
        }

        if (org.stripeCustomerId) {
          const session = await stripe.billingPortal.sessions.create({
            customer: org.stripeCustomerId,
            return_url: finalReturnUrl,
          });
          return res.json({ url: session.url });
        } else {
          // Org doesn't have a Stripe customer ID - this shouldn't happen if they have a subscription
          // But if it does, return an error rather than falling back to email lookup (which might find wrong org)
          return res.status(404).json({ error: "No subscription found for this organization. Please contact support." });
        }
      }

      // If customerId is provided directly, use it
      if (customerId) {
        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: finalReturnUrl,
        });
        return res.json({ url: session.url });
      }

      // Find the customer by email (fallback to email lookup)
      const customers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (customers.data.length === 0) {
        return res.status(404).json({ error: "No subscription found for this email" });
      }

      const customer = customers.data[0];
      
      // Create a portal session (finalReturnUrl already defined above)
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customer.id,
        return_url: finalReturnUrl,
      });

      res.json({ url: portalSession.url });
    } catch (error: any) {
      console.error("[Stripe] Customer portal session failed:", error);
      res.status(500).json({ error: "Failed to create customer portal session" });
    }
  });

  // Public customer portal access - DISABLED: Membership management should only be accessible from /app
  // Only purchasing can happen outside of /app. Users must sign in and access from Settings > Billing
  app.post("/api/stripe/customer-portal-public", async (req, res) => {
    return res.status(403).json({ 
      error: "Membership management is only available from within the application. Please sign in and go to Settings > Billing to manage your subscription." 
    });
  });

  // NOTE: Welcome emails are now sent via Stripe webhook (checkout.session.completed)
  // in webhookHandlers.ts for reliable delivery with proper deduplication

  // Get organization membership status (from database - fast, cached from webhooks)
  // CACHED: Membership status is cached in session after first check to avoid repeated Stripe calls
  app.get("/api/membership/status", isAuthenticated, async (req: any, res) => {
    try {
      // REDUCED LOGGING: Only log errors and critical status changes to reduce I/O overhead
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      const user = req.user;

      // Only admin/owner roles can access the app - check across all user's orgs
      let hasAdminRole = false;
      try {
        const userOrgs = await storage.getUserOrganizations(user.id);
        hasAdminRole = userOrgs.some((o) => o.role === 'admin' || o.role === 'owner');
      } catch (err) {
        console.error("[Membership Status] Error checking admin role:", err);
      }
      
      // Check if we have cached membership status in session
      // Cache key includes orgId to handle org switches
      let orgId = user?.currentOrgId;
      
      // If we have cached status for this org, return it immediately
      if (req.session && req.session.membershipStatus && req.session.membershipStatus.orgId === orgId) {
        const cachedStatus = req.session.membershipStatus;
        const cacheAge = Date.now() - (cachedStatus.cachedAt || 0);
        const cacheMaxAge = 30 * 60 * 1000; // 30 minutes cache
        
        // Only use cache if it's less than 30 minutes old
        if (cacheAge < cacheMaxAge) {
          if (isDevelopment) {
            console.log(`[Membership Status] ✅ Using cached status for org ${orgId} (age: ${Math.round(cacheAge / 1000)}s)`);
          }
          return res.json({
            isFoundingPartner: cachedStatus.isFoundingPartner,
            status: cachedStatus.status,
            currentPeriodEnd: cachedStatus.currentPeriodEnd,
            isCancelled: cachedStatus.isCancelled,
            orgName: cachedStatus.orgName,
            orgImage: cachedStatus.orgImage,
            hasCompletedOnboarding: cachedStatus.hasCompletedOnboarding,
            hasAdminRole: cachedStatus.hasAdminRole ?? hasAdminRole,
          });
        } else {
          // Cache expired, clear it
          if (isDevelopment) {
            console.log(`[Membership Status] ⏰ Cache expired for org ${orgId}, refreshing...`);
          }
          delete req.session.membershipStatus;
        }
      }
      
      // No valid cache, proceed with full check
      if (isDevelopment) {
        console.log(`[Membership Status] 🔍 Fetching fresh status for org ${orgId || 'none'}`);
      }

      // If currentOrgId is not set, check if user has a membership and fix it
      if (!orgId) {
        // First check if user is already part of an organization via memberships table
        const existingMembership = await storage.getUserOrganization(user.id);
        if (existingMembership) {
          // User has a membership but currentOrgId wasn't set - fix it
          if (isDevelopment) {
          console.log(`[Membership Status] User ${user.id} has membership in org ${existingMembership.orgId} but currentOrgId was null, fixing...`);
          }
          await storage.updateUser(user.id, { currentOrgId: existingMembership.orgId });
          orgId = existingMembership.orgId;
        } else if (user?.email) {
          // No existing membership - try to link subscription (will create org if needed)
          try {
            const { linkSubscriptionToUser } = await import("./webhookHandlers");
            await linkSubscriptionToUser(user.email, user.id);
            // Retry getting org after linking
            const userOrg = await storage.getUserOrganization(user.id);
            if (userOrg) {
              // Update user's currentOrgId if not set
              await storage.updateUser(user.id, { currentOrgId: userOrg.orgId });
              orgId = userOrg.orgId;
            }
          } catch (error) {
            console.error("[Membership Status] Error linking subscription:", error);
          }
        }
        
        // If still no org, return no membership
        if (!orgId) {
          // Check if user has completed general onboarding even without org
          let hasCompletedOnboarding = false;
          try {
            const allIntakes = await storage.getAllOnboardingIntakes();
            hasCompletedOnboarding = allIntakes.some(intake => intake.linkedUserId === user.id && (intake.status === 'completed' || intake.status === 'linked'));
          } catch (error) {
            console.error("[Membership] Error checking onboarding status:", error);
          }

          const noMembershipResponse = {
            isFoundingPartner: false,
            status: 'none' as const,
            currentPeriodEnd: null,
            isCancelled: false,
            hasCompletedOnboarding,
            hasAdminRole,
          };
          
          // Cache the result in session
          if (req.session) {
            req.session.membershipStatus = {
              ...noMembershipResponse,
              orgId: null,
              cachedAt: Date.now(),
            };
          }
          
          return res.json(noMembershipResponse);
        }
      }

      // Get organization with membership info (exclude deleted organizations)
      const [org] = await db.select()
        .from(organizations)
        .where(and(
          eq(organizations.id, orgId),
          isNull(organizations.deletedAt) // Exclude deleted organizations
        ))
        .limit(1);

      if (!org) {
        // Check if user has completed general onboarding even without org
        let hasCompletedOnboarding = false;
        try {
          const allIntakes = await storage.getAllOnboardingIntakes();
          hasCompletedOnboarding = allIntakes.some(intake => intake.linkedUserId === user.id && (intake.status === 'completed' || intake.status === 'linked'));
        } catch (error) {
          console.error("[Membership] Error checking onboarding status:", error);
        }

        const noOrgResponse = {
          isFoundingPartner: false,
          status: 'none' as const,
          currentPeriodEnd: null,
          isCancelled: false,
          hasCompletedOnboarding,
          hasAdminRole,
        };
        
        // Cache the result in session
        if (req.session) {
          req.session.membershipStatus = {
            ...noOrgResponse,
            orgId: null,
            cachedAt: Date.now(),
          };
        }
        
        return res.json(noOrgResponse);
      }

      // BEST PRACTICE: Check organization's subscription status directly from database FIRST
      // This works for ALL users in the organization (owner, admin, members) since subscription belongs to org
      // If org.foundingPartnerStatus === 'active' in database, user has membership - no Stripe call needed
      
      // Quick check: if org already has active status in DB, trust it immediately
      if (org.foundingPartnerStatus === 'active') {
        // Only log in development mode
        if (isDevelopment) {
          console.log(`[Membership Status] ✅ Org ${orgId} has active status in database`);
        }
        
        let hasCompletedOnboarding = false;
        try {
          const allIntakes = await storage.getAllOnboardingIntakes();
          hasCompletedOnboarding = allIntakes.some(intake => intake.linkedUserId === user.id && (intake.status === 'completed' || intake.status === 'linked'));
        } catch (error) {
          console.error("[Membership] Error checking onboarding status:", error);
        }
        
        const activeResponse = {
          isFoundingPartner: true,
          status: 'active' as const,
          currentPeriodEnd: org.subscriptionCurrentPeriodEnd ? new Date(org.subscriptionCurrentPeriodEnd).toISOString() : null,
          isCancelled: false,
          orgName: org.name,
          orgImage: org.profileImage,
          hasCompletedOnboarding,
          hasAdminRole,
        };
        
        // Cache the result in session
        if (req.session) {
          req.session.membershipStatus = {
            ...activeResponse,
            orgId,
            cachedAt: Date.now(),
          };
        }
        
        return res.json(activeResponse);
      }
      
      // Check for one-time payment with the configured lookup key
      // Organizations that paid upfront should have access even without a subscription
      // Always check (even if status is already active) to ensure it's still valid
      if (org.stripeCustomerId) {
        try {
          const stripe = await getUncachableStripeClient();
          const expectedLookupKey = getStripeLookupKey();
          
          if (!expectedLookupKey) {
            // Continue to normal membership check if no lookup key is configured
          } else {
          // Search for successful checkout sessions (one-time payments) for this customer
          const checkoutSessions = await stripe.checkout.sessions.list({
            customer: org.stripeCustomerId,
            limit: 100,
          });
          
          // Filter for successful one-time payments
          // Check all paid one-time payments for this customer (metadata might not always match)
          // We'll verify the lookup key and metadata inside the loop
          const successfulOneTimePayments = checkoutSessions.data.filter(session => 
            session.mode === 'payment' && 
            session.payment_status === 'paid'
          );
          
          // Check if any of these sessions used the configured lookup key
          for (const session of successfulOneTimePayments) {
            try {
              
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
              } catch (lineItemFetchError: any) {
                // Only log errors, not every fetch attempt
                if (isDevelopment) {
                  console.error(`[Membership Status] ⚠️ Failed to retrieve line items for session ${session.id}:`, lineItemFetchError?.message);
                }
                continue; // Skip this session and try the next one
              }
              
              if (!lineItems || !lineItems.data || lineItems.data.length === 0) {
                continue;
              }
              
              for (const item of lineItems.data) {
                const price = item.price;
                const lookupKey = price?.lookup_key;
                
                if (lookupKey === expectedLookupKey) {
                  // Verify metadata matches this org (or if metadata is missing, assume it's for this org if customer matches)
                  const metadataMatches = (!session.metadata?.orgId && !session.metadata?.organization_id) || 
                                         session.metadata?.orgId === orgId || 
                                         session.metadata?.organization_id === orgId;
                  
                  if (metadataMatches) {
                    if (isDevelopment) {
                      console.log(`[Membership Status] ✅ Found one-time payment for org ${orgId}`);
                    }
                    
                    // Update org status to active (one-time payment grants access)
                    await db.update(organizations)
                      .set({
                        foundingPartnerStatus: 'active',
                        updatedAt: new Date(),
                      })
                      .where(eq(organizations.id, orgId));
                    
                    org.foundingPartnerStatus = 'active';
                    
                    // Grant access - return early with active status
                    let hasCompletedOnboarding = false;
                    try {
                      const allIntakes = await storage.getAllOnboardingIntakes();
                      hasCompletedOnboarding = allIntakes.some(intake => intake.linkedUserId === user.id && (intake.status === 'completed' || intake.status === 'linked'));
                    } catch (error) {
                      console.error("[Membership] Error checking onboarding status:", error);
                    }
                    
                    const oneTimePaymentResponse = {
                      isFoundingPartner: true,
                      status: 'active' as const,
                      currentPeriodEnd: null, // One-time payments don't have a period end
                      isCancelled: false,
                      orgName: org.name,
                      orgImage: org.profileImage,
                      hasCompletedOnboarding,
                      hasAdminRole,
                    };
                    
                    // Cache the result in session
                    if (req.session) {
                      req.session.membershipStatus = {
                        ...oneTimePaymentResponse,
                        orgId,
                        cachedAt: Date.now(),
                      };
                    }
                    
                    return res.json(oneTimePaymentResponse);
                  }
                }
              }
            } catch (lineItemError: any) {
              // Only log errors
              console.error(`[Membership Status] Error checking line items for session ${session.id}:`, lineItemError?.message);
            }
          }
          }
        } catch (oneTimePaymentError: any) {
          // Check if this is a "No such customer" error (test mode customer in live mode)
          const errorMessage = oneTimePaymentError?.message || '';
          const errorCode = oneTimePaymentError?.code || '';
          const isNoSuchCustomer = errorMessage.includes('No such customer') || errorCode === 'resource_missing';
          
          if (isNoSuchCustomer) {
            // Clear the stale test-mode customer ID so user can start fresh
            try {
              await db.update(organizations)
                .set({
                  stripeCustomerId: null,
                  stripeSubscriptionId: null,
                  updatedAt: new Date(),
                })
                .where(eq(organizations.id, orgId));
              org.stripeCustomerId = null;
              org.stripeSubscriptionId = null;
            } catch (updateError) {
              console.error(`[Membership Status] Failed to clear stale Stripe data for org ${orgId}:`, updateError);
            }
          } else {
            console.error(`[Membership Status] Error checking one-time payments for org ${orgId}:`, oneTimePaymentError?.message || oneTimePaymentError);
          }
          // Continue to subscription check if one-time payment check fails
        }
      }
      
      // Only try Stripe verification if org doesn't have active status yet
      let stripe: any = null;
      try {
        stripe = await getUncachableStripeClient();
      } catch (stripeInitError) {
        console.error("[Membership Status] Stripe client initialization failed, using database status:", stripeInitError);
        // Stripe unavailable - just use database status
        let hasCompletedOnboarding = false;
        try {
          const allIntakes = await storage.getAllOnboardingIntakes();
          hasCompletedOnboarding = allIntakes.some(intake => intake.linkedUserId === user.id && (intake.status === 'completed' || intake.status === 'linked'));
        } catch (error) {
          console.error("[Membership] Error checking onboarding status:", error);
        }
        
        const stripeUnavailableResponse = {
          isFoundingPartner: org.foundingPartnerStatus === 'active',
          status: (org.foundingPartnerStatus || 'none') as string,
          currentPeriodEnd: org.subscriptionCurrentPeriodEnd ? new Date(org.subscriptionCurrentPeriodEnd).toISOString() : null,
          isCancelled: org.foundingPartnerStatus === 'cancelled',
          orgName: org.name,
          orgImage: org.profileImage,
          hasCompletedOnboarding,
          hasAdminRole,
        };
        
        // Cache the result in session
        if (req.session) {
          req.session.membershipStatus = {
            ...stripeUnavailableResponse,
            orgId,
            cachedAt: Date.now(),
          };
        }
        
        return res.json(stripeUnavailableResponse);
      }
      
      // First, if org has a subscription ID, verify it's active in Stripe
      if (org.stripeSubscriptionId) {
        try {
          const existingSub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
          
          if (existingSub.status === 'active' || existingSub.status === 'trialing') {
            // Subscription is active - ensure org status is updated
            if (org.foundingPartnerStatus !== 'active') {
              // Validate current_period_end before converting
              const periodEndValue = (existingSub as any).current_period_end;
              let periodEndDate: Date | null = null;
              if (periodEndValue && typeof periodEndValue === 'number' && periodEndValue > 0) {
                try {
                  periodEndDate = new Date(periodEndValue * 1000);
                  if (isNaN(periodEndDate.getTime())) {
                    periodEndDate = null;
                  }
                } catch (e) {
                  console.error(`[Membership Status] Error converting current_period_end:`, e);
                  periodEndDate = null;
                }
              }
              
              await db.update(organizations)
                .set({
                  foundingPartnerStatus: 'active',
                  subscriptionCurrentPeriodEnd: periodEndDate,
                  subscriptionCancelledAt: null,
                  updatedAt: new Date(),
                })
                .where(eq(organizations.id, orgId));
              org.foundingPartnerStatus = 'active';
              org.subscriptionCurrentPeriodEnd = periodEndDate;
            }
          } else {
            // Subscription exists but is not active - search for active subscription
            org.stripeSubscriptionId = null; // Clear so we search for a new one
          }
        } catch (e: any) {
          // Subscription not found or error - search for active subscription
          org.stripeSubscriptionId = null; // Clear so we search for a new one
        }
      }
      
      // If org doesn't have an active subscription ID, search for one
      if (!org.stripeSubscriptionId || org.foundingPartnerStatus !== 'active') {
        // Try to find and link subscription
        // First, try by organization's customer ID (if exists)
        if (org.stripeCustomerId) {
          try {
            const activeSubscriptions = await stripe.subscriptions.list({
              customer: org.stripeCustomerId,
              status: 'active',
              limit: 10,
            });
            
            // Find founding partner subscription
            for (const sub of activeSubscriptions.data) {
              const hasFoundingPartnerMetadata = sub.metadata?.membershipType === 'founding_partner' || 
                                                 sub.metadata?.organization_id === orgId ||
                                                 sub.metadata?.orgId === orgId;
              const is149Price = sub.items.data.some(item => 
                item.price.unit_amount === 14999 && item.price.recurring?.interval === 'month'
              );
              
              if (hasFoundingPartnerMetadata || is149Price) {
                // Validate current_period_end before converting
                const periodEnd = (sub as any).current_period_end;
                let periodEndDate: Date | null = null;
                if (periodEnd && typeof periodEnd === 'number' && periodEnd > 0) {
                  try {
                    periodEndDate = new Date(periodEnd * 1000);
                    if (isNaN(periodEndDate.getTime())) {
                      periodEndDate = null;
                    }
                  } catch (e) {
                    console.error(`[Membership Status] Error converting current_period_end:`, e);
                    periodEndDate = null;
                  }
                }
                
                // Found active subscription for this org - link it
                await db.update(organizations)
                  .set({
                    foundingPartnerStatus: 'active',
                    stripeSubscriptionId: sub.id,
                    subscriptionCurrentPeriodEnd: periodEndDate,
                    subscriptionCancelledAt: null,
                    updatedAt: new Date(),
                  })
                  .where(eq(organizations.id, orgId));
                
                // Update org object for rest of function
                org.stripeSubscriptionId = sub.id;
                org.foundingPartnerStatus = 'active';
                org.subscriptionCurrentPeriodEnd = periodEndDate;
                
                if (isDevelopment) {
                  console.log(`[Membership Status] ✅ Linked subscription ${sub.id} to org ${orgId}`);
                }
                break;
              }
            }
          } catch (error) {
            console.error("[Membership Status] Error searching by customer ID:", error);
          }
        }
        
        // If still no subscription found, also search by organization_id in metadata (as additional fallback)
        if (!org.stripeSubscriptionId) {
          try {
            // Search for subscriptions with this organization_id in metadata
            const allSubscriptions = await stripe.subscriptions.search({
              query: `metadata['organization_id']:'${orgId}' OR metadata['orgId']:'${orgId}'`,
              limit: 10,
            });
            
            for (const sub of allSubscriptions.data) {
              if (sub.status === 'active' || sub.status === 'trialing') {
                // Found active subscription for this org - link it
                await db.update(organizations)
                  .set({
                    foundingPartnerStatus: 'active',
                    stripeSubscriptionId: sub.id,
                    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : (typeof sub.customer === 'object' && sub.customer && 'id' in sub.customer ? sub.customer.id : org.stripeCustomerId),
                    subscriptionCurrentPeriodEnd: new Date((sub as any).current_period_end * 1000),
                    subscriptionCancelledAt: null,
                    updatedAt: new Date(),
                  })
                  .where(eq(organizations.id, orgId));
                
                // Update org object
                org.stripeSubscriptionId = sub.id;
                org.foundingPartnerStatus = 'active';
                org.subscriptionCurrentPeriodEnd = new Date((sub as any).current_period_end * 1000);
                if (!org.stripeCustomerId) {
                  if (typeof sub.customer === 'string') {
                    org.stripeCustomerId = sub.customer;
                  } else if (typeof sub.customer === 'object' && sub.customer && 'id' in sub.customer) {
                    org.stripeCustomerId = sub.customer.id;
                  }
                }
                
                if (isDevelopment) {
                  console.log(`[Membership Status] ✅ Linked subscription ${sub.id} to org ${orgId}`);
                }
                break;
              }
            }
          } catch (error) {
            console.error("[Membership Status] Error searching by metadata:", error);
          }
        }
        
        // If still no subscription, try linking by user email (as last resort - might work if user is owner)
        // This is a fallback since subscription belongs to org, not user
        if (!org.stripeSubscriptionId && user?.email) {
          try {
            const { linkSubscriptionToUser } = await import("./webhookHandlers");
            await linkSubscriptionToUser(user.email, user.id);
            // Refresh org data after linking attempt (exclude deleted organizations)
            const [updatedOrg] = await db.select()
              .from(organizations)
              .where(and(
                eq(organizations.id, orgId),
                isNull(organizations.deletedAt) // Exclude deleted organizations
              ))
              .limit(1);
            if (updatedOrg) {
              Object.assign(org, updatedOrg);
            }
          } catch (error) {
            console.error("[Membership Status] Error linking subscription by user email:", error);
          }
        }
      }

      // Refresh org data one more time to get latest status after any linking operations (exclude deleted organizations)
      const [freshOrg] = await db.select()
        .from(organizations)
        .where(and(
          eq(organizations.id, orgId),
          isNull(organizations.deletedAt) // Exclude deleted organizations
        ))
        .limit(1);
      
      if (freshOrg) {
        Object.assign(org, freshOrg);
      }
      
      let status = org.foundingPartnerStatus || 'none';
      let currentPeriodEnd = org.subscriptionCurrentPeriodEnd;
      let isCancelled = status === 'cancelled';
      
      // ALWAYS verify subscription status in Stripe if we have a subscription ID
      // This ensures we catch cases where the database status is stale
      let isActive = false;
      let verifiedStatus = status;
      
      if (org.stripeSubscriptionId) {
        try {
          const stripe = await getUncachableStripeClient();
          const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
          
          const periodEnd = (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000) : null;
          const periodStart = (sub as any).current_period_start ? new Date((sub as any).current_period_start * 1000) : null;
          
          // Handle subscription status
          if (sub.status === 'active' || sub.status === 'trialing') {
            isActive = true;
            verifiedStatus = 'active';
            // ALWAYS update org status to 'active' if Stripe says it's active
            if (org.foundingPartnerStatus !== 'active') {
              // Validate periodEnd before using
              const validPeriodEnd = periodEnd && !isNaN(periodEnd.getTime()) ? periodEnd : null;
              await db.update(organizations)
                .set({ 
                  foundingPartnerStatus: 'active',
                  subscriptionCurrentPeriodEnd: validPeriodEnd,
                  updatedAt: new Date() 
                })
                .where(eq(organizations.id, orgId));
              status = 'active';
              currentPeriodEnd = validPeriodEnd;
              // Refresh org object
              org.foundingPartnerStatus = 'active';
              org.subscriptionCurrentPeriodEnd = validPeriodEnd;
            } else {
              status = 'active';
              // Validate periodEnd before using
              const validPeriodEnd = periodEnd && !isNaN(periodEnd.getTime()) ? periodEnd : null;
              if (validPeriodEnd) currentPeriodEnd = validPeriodEnd;
            }
          } else if (sub.status === 'canceled' || (sub as any).cancel_at_period_end) {
            // Subscription is cancelled - NOT active, regardless of period end
            verifiedStatus = 'cancelled';
            isActive = false; // Cancelled subscriptions are NOT active
            currentPeriodEnd = periodEnd;
            // Update org status
            if (org.foundingPartnerStatus !== verifiedStatus) {
              await db.update(organizations)
                .set({ 
                  foundingPartnerStatus: verifiedStatus,
                  subscriptionCurrentPeriodEnd: periodEnd,
                  updatedAt: new Date() 
                })
                .where(eq(organizations.id, orgId));
              status = verifiedStatus;
            } else {
              status = verifiedStatus;
            }
          } else {
            // Subscription exists but is not active (past_due, unpaid, etc.)
            verifiedStatus = sub.status;
            isActive = false;
            if (org.foundingPartnerStatus !== verifiedStatus) {
              await db.update(organizations)
                .set({ 
                  foundingPartnerStatus: verifiedStatus,
                  updatedAt: new Date() 
                })
                .where(eq(organizations.id, orgId));
              status = verifiedStatus;
            } else {
              status = verifiedStatus;
            }
          }
        } catch (e: any) {
          console.error(`[Membership Status] ❌ Error verifying subscription ${org.stripeSubscriptionId} for org ${orgId}:`, e.message);
          // If we can't verify, fall back to database status
          // ONLY treat as active if status is explicitly 'active' (not cancelled)
          isActive = status === 'active';
          // Cancelled subscriptions are NEVER active, even if within period
        }
      } else if (org.stripeCustomerId) {
        // No subscription ID but we have customer ID - try one more search
        try {
          const stripe = await getUncachableStripeClient();
          const activeSubscriptions = await stripe.subscriptions.list({
            customer: org.stripeCustomerId,
            status: 'active',
            limit: 10,
          });
          
          for (const sub of activeSubscriptions.data) {
            const hasFoundingPartnerMetadata = sub.metadata?.membershipType === 'founding_partner' || 
                                               sub.metadata?.organization_id === orgId ||
                                               sub.metadata?.orgId === orgId;
            const is149Price = sub.items.data.some(item => 
              item.price.unit_amount === 14999 && item.price.recurring?.interval === 'month'
            );
            
            if (hasFoundingPartnerMetadata || is149Price) {
              // Validate current_period_end before converting
              const periodEnd = (sub as any).current_period_end;
              let periodEndDate: Date | null = null;
              if (periodEnd && typeof periodEnd === 'number' && periodEnd > 0) {
                try {
                  periodEndDate = new Date(periodEnd * 1000);
                  if (isNaN(periodEndDate.getTime())) {
                    periodEndDate = null;
                  }
                } catch (e) {
                  console.error(`[Membership Status] Error converting current_period_end:`, e);
                  periodEndDate = null;
                }
              }
              
              // Found it! Update org
              await db.update(organizations)
                .set({
                  foundingPartnerStatus: 'active',
                  stripeSubscriptionId: sub.id,
                  subscriptionCurrentPeriodEnd: periodEndDate,
                  subscriptionCancelledAt: null,
                  updatedAt: new Date(),
                })
                .where(eq(organizations.id, orgId));
              
              org.stripeSubscriptionId = sub.id;
              org.foundingPartnerStatus = 'active';
              org.subscriptionCurrentPeriodEnd = periodEndDate;
              status = 'active';
              isActive = true;
              currentPeriodEnd = periodEndDate;
              
              if (isDevelopment) {
                console.log(`[Membership Status] ✅ Found and linked subscription ${sub.id} for org ${orgId}`);
              }
              break;
            }
          }
        } catch (error) {
          console.error(`[Membership Status] Error in final customer ID search:`, error);
        }
      } else {
        // No subscription ID and no customer ID - check database status
        // ONLY treat as active if status is explicitly 'active' (not cancelled)
        isActive = status === 'active';
        // Cancelled subscriptions are NEVER active, even if within period
        if (!isActive && status === 'cancelled' && currentPeriodEnd) {
          // Period has ended for cancelled subscription, update status to expired
          if (new Date() >= new Date(currentPeriodEnd)) {
            await db.update(organizations)
              .set({ foundingPartnerStatus: 'expired', updatedAt: new Date() })
              .where(eq(organizations.id, orgId));
            status = 'expired';
          }
        }
      }
      
      // Final check: if status is 'active' but isActive is false, set it to true
      if (status === 'active' && !isActive) {
        isActive = true;
      }
      
      // Cancelled subscriptions are NEVER active, regardless of period end

      // Check if user has completed general onboarding (has linked onboarding intake)
      let hasCompletedOnboarding = false;
      try {
        const allIntakes = await storage.getAllOnboardingIntakes();
        hasCompletedOnboarding = allIntakes.some(intake => intake.linkedUserId === user.id && (intake.status === 'completed' || intake.status === 'linked'));
      } catch (error) {
        console.error("[Membership] Error checking onboarding status:", error);
        // Default to false if we can't check
      }

      const response = {
        isFoundingPartner: isActive,
        status,
        currentPeriodEnd: currentPeriodEnd instanceof Date ? currentPeriodEnd.toISOString() : (currentPeriodEnd ? new Date(currentPeriodEnd).toISOString() : null),
        isCancelled,
        orgName: org.name,
        orgImage: org.profileImage,
        hasCompletedOnboarding,
        hasAdminRole,
      };
      
      // Cache the result in session for 30 minutes
      if (req.session) {
        req.session.membershipStatus = {
          ...response,
          orgId,
          cachedAt: Date.now(),
        };
        // Save session to persist cache (non-blocking)
        req.session.save((err) => {
          if (err && isDevelopment) {
            console.error("[Membership Status] Error saving session cache:", err);
          }
        });
      }
      
      res.json(response);
    } catch (error: any) {
      console.error("[Membership] Failed to get status:", error);
      res.status(500).json({ error: "Failed to get membership status" });
    }
  });

  // Manual endpoint to force-link subscription (useful for troubleshooting)
  app.post("/api/membership/link-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user?.email) {
        return res.status(400).json({ error: "User email not found" });
      }

      const { linkSubscriptionToUser } = await import("./webhookHandlers");
      await linkSubscriptionToUser(user.email, user.id);

      // Get updated org status
      const userOrg = await storage.getUserOrganization(user.id);
      if (userOrg) {
        const org = await storage.getOrganization(userOrg.orgId);
        if (org) {
          return res.json({
            success: true,
            message: "Subscription linked successfully",
            isFoundingPartner: org.foundingPartnerStatus === 'active',
            status: org.foundingPartnerStatus || 'none',
            stripeSubscriptionId: org.stripeSubscriptionId,
            stripeCustomerId: org.stripeCustomerId,
          });
        }
      }

      return res.json({
        success: false,
        message: "No subscription found or organization not found",
      });
    } catch (error: any) {
      console.error("[Membership] Failed to link subscription:", error);
      res.status(500).json({ error: "Failed to link subscription", details: error.message });
    }
  });

  // Check if user has a pending subscription (purchased but org not yet created)
  app.get("/api/pending-subscription/check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;
      
      if (!userId) {
        return res.json({ hasPending: false });
      }

      // Check for pending subscription in database
      const [pending] = await db.select()
        .from(pendingSubscriptions)
        .where(and(
          eq(pendingSubscriptions.userId, userId),
          eq(pendingSubscriptions.status, 'pending')
        ))
        .limit(1);

      if (pending) {
        return res.json({
          hasPending: true,
          email: pending.userEmail,
          name: '',
          subscriptionId: pending.stripeSubscriptionId,
        });
      }

      // Also check Stripe directly for any subscriptions that might not be in pending table
      if (userEmail) {
        try {
          const stripe = await getUncachableStripeClient();
          const customers = await stripe.customers.list({ email: userEmail, limit: 5 });
          
          for (const customer of customers.data) {
            const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'active', limit: 5 });
            
            for (const sub of subs.data) {
              const isFoundingPartner = sub.metadata?.membershipType === 'founding_partner' ||
                sub.items.data.some(item => item.price.unit_amount === 14999 && item.price.recurring?.interval === 'month');
              
              // Check if this subscription needs onboarding (no org linked)
              if (isFoundingPartner && (!sub.metadata?.orgId || sub.metadata.needsOnboarding === 'true')) {
                return res.json({
                  hasPending: true,
                  email: userEmail,
                  name: sub.metadata?.customerName || '',
                  subscriptionId: sub.id,
                  customerId: customer.id,
                });
              }
            }
          }
        } catch (stripeError) {
          console.error("[Pending Check] Stripe error:", stripeError);
        }
      }

      return res.json({ hasPending: false });
    } catch (error: any) {
      console.error("[Pending Check] Error:", error);
      res.status(500).json({ error: "Failed to check pending subscription" });
    }
  });

  // Complete founding partner onboarding - creates org and links subscription
  app.post("/api/founding-partner/complete-onboarding", isAuthenticated, async (req: any, res) => {
    try {
      const { companyName, sessionId } = req.body;
      const userId = req.user?.id;
      const userEmail = req.user?.email;

      if (!userId || !userEmail) {
        return res.status(400).json({ error: "User not authenticated" });
      }

      if (!companyName?.trim()) {
        return res.status(400).json({ error: "Company name is required" });
      }

      // Check if user already has an organization
      const existingOrg = await storage.getUserOrganization(userId);
      if (existingOrg) {
        // User already has an org - try to link subscription to existing org
        const { linkSubscriptionToUser } = await import("./webhookHandlers");
        await linkSubscriptionToUser(userEmail, userId);
        return res.json({ 
          success: true, 
          message: "Your existing organization has been linked to your subscription.",
          orgId: existingOrg.orgId,
        });
      }

      // Find the subscription to link
      let subscriptionId: string | null = null;
      let customerId: string | null = null;
      let currentPeriodEnd: Date | null = null;

      // First check pending subscriptions table
      const [pending] = await db.select()
        .from(pendingSubscriptions)
        .where(and(
          eq(pendingSubscriptions.userId, userId),
          eq(pendingSubscriptions.status, 'pending')
        ))
        .limit(1);

      if (pending) {
        subscriptionId = pending.stripeSubscriptionId;
        customerId = pending.stripeCustomerId;
        currentPeriodEnd = pending.currentPeriodEnd;
      } else if (sessionId) {
        // Verify session and get subscription info
        try {
          const stripe = await getUncachableStripeClient();
          const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['subscription'],
          });
          
          if (session.subscription) {
            const sub = typeof session.subscription === 'string' 
              ? await stripe.subscriptions.retrieve(session.subscription)
              : session.subscription;
            
            subscriptionId = sub.id;
            customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
            currentPeriodEnd = new Date(sub.current_period_end * 1000);
          }
        } catch (e) {
          console.error("[Complete Onboarding] Session verification failed:", e);
        }
      }

      // If still no subscription found, search Stripe directly
      if (!subscriptionId) {
        try {
          const stripe = await getUncachableStripeClient();
          const customers = await stripe.customers.list({ email: userEmail, limit: 5 });
          
          for (const customer of customers.data) {
            const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'active', limit: 5 });
            
            for (const sub of subs.data) {
              const isFoundingPartner = sub.metadata?.membershipType === 'founding_partner' ||
                sub.items.data.some(item => item.price.unit_amount === 14999 && item.price.recurring?.interval === 'month');
              
              if (isFoundingPartner) {
                subscriptionId = sub.id;
                customerId = customer.id;
                currentPeriodEnd = new Date(sub.current_period_end * 1000);
                break;
              }
            }
            if (subscriptionId) break;
          }
        } catch (e) {
          console.error("[Complete Onboarding] Stripe search failed:", e);
        }
      }

      if (!subscriptionId) {
        return res.status(400).json({ 
          error: "No subscription found. Please complete your purchase first.",
          redirectTo: "/founding-partner-checkout"
        });
      }

      // Create the organization
      const newOrg = await storage.createOrganization(companyName.trim(), userId);
      
      // Update organization with subscription details
      await db.update(organizations)
        .set({
          email: userEmail,
          foundingPartnerStatus: 'active',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionCurrentPeriodEnd: currentPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, newOrg.id));
      
      // Refresh org data (exclude deleted organizations)
      const [updatedOrg] = await db.select()
        .from(organizations)
        .where(and(
          eq(organizations.id, newOrg.id),
          isNull(organizations.deletedAt) // Exclude deleted organizations
        ))
        .limit(1);
      
      if (!updatedOrg) {
        throw new Error("Failed to create organization");
      }

      console.log(`[Complete Onboarding] Created org ${updatedOrg.id} for user ${userId} with active subscription`);

      // Create membership linking user to org as admin
      await storage.createMembership({
        userId,
        orgId: updatedOrg.id,
        role: 'admin',
        status: 'active',
      });

      // Update user's current org
      await storage.updateUser(userId, { currentOrgId: updatedOrg.id });

      // Update Stripe subscription metadata with orgId
      if (subscriptionId) {
        try {
          const stripe = await getUncachableStripeClient();
          await stripe.subscriptions.update(subscriptionId, {
            metadata: {
              orgId: newOrg.id,
              membershipType: 'founding_partner',
              linkedAt: new Date().toISOString(),
              needsOnboarding: 'false',
            },
          });
          console.log(`[Complete Onboarding] Updated Stripe subscription ${subscriptionId} with orgId ${newOrg.id}`);
        } catch (e) {
          console.error("[Complete Onboarding] Failed to update Stripe metadata:", e);
        }
      }

      // Mark pending subscription as linked
      if (pending) {
        await db.update(pendingSubscriptions)
          .set({
            status: 'linked',
            linkedOrgId: newOrg.id,
            linkedAt: new Date(),
          })
          .where(eq(pendingSubscriptions.id, pending.id));
      }

      console.log(`[Complete Onboarding] ✅ Onboarding complete for user ${userId}, org ${newOrg.id}`);

      // Send welcome email for this new organization membership
      // Track by orgId:subscriptionId to ensure each new organization gets an email
      // ALWAYS sends, even if user has multiple organizations with memberships
      if (subscriptionId) {
        try {
          console.log(`[Membership] Sending welcome email for org ${updatedOrg.id} subscription ${subscriptionId}`);
          const { sendWelcomeEmailForOrgMembership } = await import("./webhookHandlers");
          
          // Get user info for email
          const user = await storage.getUser(userId);
          const userEmailForEmail = user?.email || userEmail;
          const userName = user?.fullName || undefined;
          
          console.log(`[Membership] User email for welcome email: ${userEmailForEmail}, user name: ${userName || 'N/A'}`);
          
          // Send welcome email using the shared helper function
          // This will deduplicate based on orgId:subscriptionId
          await sendWelcomeEmailForOrgMembership(
            updatedOrg.id,
            subscriptionId,
            userEmailForEmail,
            userName
          );
          console.log(`[Membership] ✅ Welcome email sent successfully for org ${updatedOrg.id}`);
        } catch (emailError) {
          // If email sending fails, log but don't fail the request
          console.error(`[Membership] ❌ Failed to send welcome email (non-fatal):`, emailError);
          console.error(`[Membership] Error details:`, emailError instanceof Error ? emailError.message : emailError);
        }
      }

      res.json({
        success: true,
        message: "Organization created and subscription linked!",
        orgId: updatedOrg.id,
        orgName: updatedOrg.name,
      });
    } catch (error: any) {
      console.error("[Complete Onboarding] Error:", error);
      res.status(500).json({ error: "Failed to complete onboarding", details: error.message });
    }
  });

  // Debug endpoint to check what subscriptions exist for a user
  app.get("/api/membership/debug-subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user?.email) {
        return res.status(400).json({ error: "User email not found" });
      }

      const stripe = await getUncachableStripeClient();
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 100,
      });

      const subscriptionsInfo = [];
      for (const customer of customers.data) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          limit: 100,
        });

        for (const subscription of subscriptions.data) {
          const items = subscription.items.data;
          const productInfo = [];
          for (const item of items) {
            const productId = typeof item.price.product === 'string' ? item.price.product : item.price.product?.id;
            let productName = 'Unknown';
            let productDescription = '';
            if (productId) {
              try {
                const product = await stripe.products.retrieve(productId);
                productName = product.name || 'Unknown';
                productDescription = product.description || '';
              } catch (e) {
                // Ignore
              }
            }

            productInfo.push({
              priceId: item.price.id,
              amount: item.price.unit_amount,
              currency: item.price.currency,
              interval: item.price.recurring?.interval,
              productName,
              productDescription,
            });
          }

          subscriptionsInfo.push({
            subscriptionId: subscription.id,
            customerId: customer.id,
            status: subscription.status,
            created: new Date(subscription.created * 1000).toISOString(),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            metadata: subscription.metadata,
            items: productInfo,
            isActive: subscription.status === 'active',
          });
        }
      }

      // Get org info
      const userOrg = await storage.getUserOrganization(user.id);
      let orgInfo = null;
      if (userOrg) {
        const org = await storage.getOrganization(userOrg.orgId);
        if (org) {
          orgInfo = {
            orgId: org.id,
            orgName: org.name,
            foundingPartnerStatus: org.foundingPartnerStatus,
            stripeCustomerId: org.stripeCustomerId,
            stripeSubscriptionId: org.stripeSubscriptionId,
            subscriptionCurrentPeriodEnd: org.subscriptionCurrentPeriodEnd?.toISOString() || null,
          };
        }
      }

      return res.json({
        userEmail: user.email,
        userId: user.id,
        customersFound: customers.data.length,
        subscriptionsFound: subscriptionsInfo.length,
        activeSubscriptions: subscriptionsInfo.filter(s => s.isActive).length,
        subscriptions: subscriptionsInfo,
        organization: orgInfo,
      });
    } catch (error: any) {
      console.error("[Membership Debug] Failed to get subscription info:", error);
      res.status(500).json({ error: "Failed to get subscription info", details: error.message });
    }
  });

  // Get subscription status for authenticated user
  app.get("/api/stripe/subscription-status", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const userEmail = user?.email;

      if (!userEmail) {
        return res.status(400).json({ error: "User email not found" });
      }

      // First check if user's organization has an active subscription
      const userOrg = await storage.getUserOrganization(user.id);
      console.log('[Subscription Status] User org:', userOrg);
      if (userOrg) {
        const org = await storage.getOrganization(userOrg.orgId);
        console.log('[Subscription Status] Organization:', {
          orgId: org?.id,
          stripeSubscriptionId: org?.stripeSubscriptionId,
          foundingPartnerStatus: org?.foundingPartnerStatus,
          subscriptionCurrentPeriodEnd: org?.subscriptionCurrentPeriodEnd,
        });
        if (org && org.stripeSubscriptionId && (org.foundingPartnerStatus === 'active' || org.foundingPartnerStatus === 'cancelled')) {
          // Verify subscription is still active in Stripe
          try {
            const stripe = await getUncachableStripeClient();
            // Retrieve subscription with expanded fields to ensure we get all period information
            // Note: items are included by default, but we expand invoice and customer for metadata
            const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId, {
              expand: ['latest_invoice', 'customer', 'items.data.price.product']
            });
            
            // Log full subscription object to debug
            console.log('[Subscription Status] Full Stripe subscription object keys:', Object.keys(sub));
            console.log('[Subscription Status] Full Stripe subscription object:', JSON.stringify(sub, null, 2));
            
            console.log('[Subscription Status] Stripe subscription retrieved:', {
              id: sub.id,
              status: sub.status,
              cancel_at_period_end: sub.cancel_at_period_end,
              cancel_at_period_end_type: typeof sub.cancel_at_period_end,
              current_period_end: sub.current_period_end,
              current_period_start: sub.current_period_start,
              current_period_end_type: typeof sub.current_period_end,
              current_period_start_type: typeof sub.current_period_start,
              cancel_at: (sub as any).cancel_at,
              canceled_at: (sub as any).canceled_at,
              billing_cycle_anchor: (sub as any).billing_cycle_anchor,
            });
            
            // Safely get period end date - prefer DB, then Stripe, with proper null checks
            let currentPeriodEnd: string | null = null;
            if (org.subscriptionCurrentPeriodEnd) {
              currentPeriodEnd = org.subscriptionCurrentPeriodEnd.toISOString();
              console.log('[Subscription Status] Using period end from DB:', currentPeriodEnd);
            } else {
              // Try to get from Stripe - check subscription items first (where period dates are stored)
              let periodEndTimestamp: number | null = null;
              let periodStartTimestamp: number | null = null;
              
              // Check subscription items for period dates (this is where they're stored in Stripe API)
              if ((sub as any).items && Array.isArray((sub as any).items?.data) && (sub as any).items.data.length > 0) {
                const firstItem = (sub as any).items.data[0];
                console.log('[Subscription Status] Checking first subscription item:', {
                  hasCurrentPeriodEnd: !!firstItem.current_period_end,
                  currentPeriodEndType: typeof firstItem.current_period_end,
                  currentPeriodEndValue: firstItem.current_period_end,
                  hasCurrentPeriodStart: !!firstItem.current_period_start,
                  currentPeriodStartType: typeof firstItem.current_period_start,
                  currentPeriodStartValue: firstItem.current_period_start,
                });
                
                if (firstItem.current_period_end && typeof firstItem.current_period_end === 'number') {
                  periodEndTimestamp = firstItem.current_period_end;
                  console.log('[Subscription Status] ✅ Found current_period_end in subscription item:', periodEndTimestamp, '=', new Date(periodEndTimestamp * 1000).toISOString());
                } else {
                  console.log('[Subscription Status] ❌ First item does not have valid current_period_end');
                }
                
                if (firstItem.current_period_start && typeof firstItem.current_period_start === 'number') {
                  periodStartTimestamp = firstItem.current_period_start;
                  console.log('[Subscription Status] ✅ Found current_period_start in subscription item:', periodStartTimestamp, '=', new Date(periodStartTimestamp * 1000).toISOString());
                } else {
                  console.log('[Subscription Status] ❌ First item does not have valid current_period_start');
                }
              } else {
                console.log('[Subscription Status] ❌ No subscription items found or items.data is not an array');
              }
              
              // Fallback: Check top-level subscription object
              if (!periodEndTimestamp) {
                if (sub.current_period_end && typeof sub.current_period_end === 'number') {
                  periodEndTimestamp = sub.current_period_end;
                  console.log('[Subscription Status] Found current_period_end on subscription object:', periodEndTimestamp);
                } else if ((sub as any).cancel_at && typeof (sub as any).cancel_at === 'number' && sub.cancel_at_period_end) {
                  // If cancel_at_period_end is true, cancel_at is the period end date
                  periodEndTimestamp = (sub as any).cancel_at;
                  console.log('[Subscription Status] Using cancel_at as period end (cancel_at_period_end is true):', periodEndTimestamp);
                }
              }
              
              if (!periodStartTimestamp && sub.current_period_start && typeof sub.current_period_start === 'number') {
                periodStartTimestamp = sub.current_period_start;
                console.log('[Subscription Status] Found current_period_start on subscription object:', periodStartTimestamp);
              }
              
              console.log('[Subscription Status] Period end extraction summary:', {
                periodEndTimestamp,
                periodEndTimestampType: typeof periodEndTimestamp,
                hasPeriodEndTimestamp: !!periodEndTimestamp,
              });
              
              if (periodEndTimestamp) {
                currentPeriodEnd = new Date(periodEndTimestamp * 1000).toISOString();
                console.log('[Subscription Status] ✅ Using period end from Stripe:', currentPeriodEnd);
                
                // Update database with period end if it's missing
                try {
                  const { db } = await import("./db");
                  const { organizations } = await import("@shared/schema");
                  const periodEndDate = new Date(periodEndTimestamp * 1000);
                  await db.update(organizations)
                    .set({
                      subscriptionCurrentPeriodEnd: periodEndDate,
                    })
                    .where(eq(organizations.id, org.id));
                  console.log('[Subscription Status] ✅ Updated missing subscriptionCurrentPeriodEnd in DB to', periodEndDate.toISOString());
                } catch (updateError) {
                  console.error('[Subscription Status] ⚠️ Failed to update subscriptionCurrentPeriodEnd in DB:', updateError);
                }
              } else {
                console.warn('[Subscription Status] ⚠️ No valid current_period_end found in DB or Stripe');
                console.warn('[Subscription Status] Debug info:', {
                  hasItems: !!(sub as any).items,
                  itemsIsArray: Array.isArray((sub as any).items?.data),
                  itemsLength: (sub as any).items?.data?.length || 0,
                  hasCancelAt: !!(sub as any).cancel_at,
                  cancelAtValue: (sub as any).cancel_at,
                  cancelAtPeriodEnd: sub.cancel_at_period_end,
                });
              }
              
              if (periodStartTimestamp) {
                currentPeriodStart = new Date(periodStartTimestamp * 1000).toISOString();
                console.log('[Subscription Status] Using period start from Stripe:', currentPeriodStart);
              } else {
                console.warn('[Subscription Status] ⚠️ No valid current_period_start found in Stripe');
              }
            }
            
            // Period start is now handled in the period end section above
            
            const subscriptionData = {
              hasSubscription: true,
              subscription: {
                id: sub.id,
                status: sub.status,
                currentPeriodEnd: currentPeriodEnd,
                currentPeriodStart: currentPeriodStart,
                cancelAtPeriodEnd: sub.cancel_at_period_end === true, // Explicitly convert to boolean
                plan: 'Founding Partner',
                amount: 14999, // $149.99
              }
            };
            
            console.log('[Subscription Status] Returning subscription data:', JSON.stringify(subscriptionData, null, 2));
            console.log('[Subscription Status] cancelAtPeriodEnd value:', subscriptionData.subscription.cancelAtPeriodEnd, 'type:', typeof subscriptionData.subscription.cancelAtPeriodEnd);
            return res.json(subscriptionData);
          } catch (e) {
            console.error("[Stripe] Error retrieving subscription:", e);
            // Fall through to email lookup
          }
        }
      }

      // Fallback: Find the customer by email in Stripe
      const stripe = await getUncachableStripeClient();
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });

      if (customers.data.length === 0) {
        // Check for one-time payment before returning no subscription
        // If org has foundingPartnerStatus === 'active' but no subscription, it's likely a one-time payment
        if (userOrg) {
          const org = await storage.getOrganization(userOrg.orgId);
          if (org && org.foundingPartnerStatus === 'active' && !org.stripeSubscriptionId && org.stripeCustomerId) {
            const expectedLookupKey = getStripeLookupKey();
            if (expectedLookupKey) {
              console.log(`[Subscription Status] Org has active status but no subscription - checking for one-time payment (lookup key: ${expectedLookupKey})`);
              try {
                const stripe = await getUncachableStripeClient();
                // Check for one-time payment checkout sessions
                const checkoutSessions = await stripe.checkout.sessions.list({
                  customer: org.stripeCustomerId,
                  limit: 100,
                });
                
                const successfulOneTimePayments = checkoutSessions.data.filter(session => 
                  session.mode === 'payment' && 
                  session.payment_status === 'paid'
                );
                
                for (const session of successfulOneTimePayments) {
                  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
                  for (const item of lineItems.data) {
                    const price = item.price;
                    if (price?.lookup_key === expectedLookupKey) {
                      console.log(`[Subscription Status] ✅ Found one-time payment with '${expectedLookupKey}' - returning null subscription (expected for one-time payments)`);
                      // Return null subscription (this is correct for one-time payments)
                      return res.json({ hasSubscription: false, subscription: null });
                    }
                  }
                }
              } catch (oneTimeError) {
                console.error('[Subscription Status] Error checking one-time payment:', oneTimeError);
              }
            }
          }
        }
        return res.json({ hasSubscription: false, subscription: null });
      }

      const customer = customers.data[0];

      // Get active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        // Check for any subscription (including canceled, past_due, etc.)
        const allSubscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          limit: 1,
        });

        if (allSubscriptions.data.length > 0) {
          const sub = allSubscriptions.data[0];
          console.log('[Subscription Status] Fallback (no active) - subscription:', {
            id: sub.id,
            status: sub.status,
            cancel_at_period_end: sub.cancel_at_period_end,
            cancel_at_period_end_type: typeof sub.cancel_at_period_end,
            current_period_end: sub.current_period_end,
          });
          const subscriptionData = {
            hasSubscription: true,
            subscription: {
              id: sub.id,
              status: sub.status,
              currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
              currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
              cancelAtPeriodEnd: sub.cancel_at_period_end === true, // Explicitly convert to boolean
              plan: 'Founding Partner',
              amount: 14999, // $149.99
            }
          };
          console.log('[Subscription Status] Fallback (no active) - Returning:', JSON.stringify(subscriptionData, null, 2));
          return res.json(subscriptionData);
        }

        // Check for one-time payment before returning no subscription
        // If org has foundingPartnerStatus === 'active' but no subscription, it's likely a one-time payment
        if (userOrg) {
          const org = await storage.getOrganization(userOrg.orgId);
          if (org && org.foundingPartnerStatus === 'active' && !org.stripeSubscriptionId && org.stripeCustomerId) {
            const expectedLookupKey = getStripeLookupKey();
            if (expectedLookupKey) {
              console.log(`[Subscription Status] Fallback - Org has active status but no subscription - checking for one-time payment (lookup key: ${expectedLookupKey})`);
              try {
                const stripe = await getUncachableStripeClient();
                // Check for one-time payment checkout sessions
                const checkoutSessions = await stripe.checkout.sessions.list({
                  customer: org.stripeCustomerId,
                  limit: 100,
                });
                
                const successfulOneTimePayments = checkoutSessions.data.filter(session => 
                  session.mode === 'payment' && 
                  session.payment_status === 'paid'
                );
                
                for (const session of successfulOneTimePayments) {
                  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
                  for (const item of lineItems.data) {
                    const price = item.price;
                    if (price?.lookup_key === expectedLookupKey) {
                      console.log(`[Subscription Status] Fallback - ✅ Found one-time payment with '${expectedLookupKey}' - returning null subscription (expected for one-time payments)`);
                      // Return null subscription (this is correct for one-time payments)
                      return res.json({ hasSubscription: false, subscription: null });
                    }
                  }
                }
              } catch (oneTimeError) {
                console.error('[Subscription Status] Fallback - Error checking one-time payment:', oneTimeError);
              }
            }
          }
        }

        return res.json({ hasSubscription: false, subscription: null });
      }

      const subscription = subscriptions.data[0];
      console.log('[Subscription Status] Fallback (email lookup active) - subscription:', {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        cancel_at_period_end_type: typeof subscription.cancel_at_period_end,
        current_period_end: subscription.current_period_end,
        current_period_start: subscription.current_period_start,
      });
      
      // Safely get period dates with null checks
      let currentPeriodEnd: string | null = null;
      if (subscription.current_period_end && typeof subscription.current_period_end === 'number') {
        currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
      }
      
      let currentPeriodStart: string | null = null;
      if (subscription.current_period_start && typeof subscription.current_period_start === 'number') {
        currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
      }
      
      const subscriptionData = {
        hasSubscription: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: currentPeriodEnd,
          currentPeriodStart: currentPeriodStart,
          cancelAtPeriodEnd: subscription.cancel_at_period_end === true, // Explicitly convert to boolean
          plan: 'Founding Partner',
          amount: 14999, // $149.99
        }
      };
      console.log('[Subscription Status] Fallback (email lookup active) - Returning:', JSON.stringify(subscriptionData, null, 2));
      res.json(subscriptionData);
    } catch (error: any) {
      console.error("[Stripe] Failed to get subscription status:", error);
      res.status(500).json({ error: "Failed to get subscription status" });
    }
  });

  // ===== ORGANIZATION ROUTES =====
  // Get all organizations the user is a member of
  app.get("/api/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const orgs = await storage.getUserOrganizations(req.user.id);
      res.json(orgs);
    } catch (error) {
      console.error("[Orgs] Failed to fetch organizations:", error);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // Get current organization (from user preference or first membership)
  app.get("/api/organizations/current", isAuthenticated, async (req: any, res) => {
    try {
      // OPTIMIZED: Use cached org context if available (from attachOrgContext middleware)
      // This avoids duplicate database queries
      if (req.orgId && req.role) {
        return res.json({ orgId: req.orgId, role: req.role });
      }
      
      // Fallback: If org context not available, do minimal queries
      const user = await storage.getUser(req.user.id);
      
      // Check if user has a preferred org
      if (user?.currentOrgId) {
        // Try membership first (faster - single query with join)
        const membership = await storage.getMembership(req.user.id, user.currentOrgId);
        if (membership) {
          return res.json(membership);
        } else {
          // Membership not found - clear currentOrgId (non-blocking)
          storage.updateUser(req.user.id, { currentOrgId: null }).catch(err => 
            console.error(`[Orgs] Error clearing currentOrgId:`, err)
          );
        }
      }
      
      // Fallback to first membership (single query)
      const membership = await storage.getUserOrganization(req.user.id);
      if (!membership) {
        return res.status(404).json({ error: "No organization found" });
      }
      
      // No need to verify org exists - getUserOrganization already joins with organizations table
      
      // Update user's preference to this org
      await storage.updateUser(req.user.id, { currentOrgId: membership.orgId });
      res.json(membership);
    } catch (error) {
      console.error("[Orgs] Failed to fetch current org:", error);
      res.status(500).json({ error: "Failed to fetch current organization" });
    }
  });

  // Create a new organization
  app.post("/api/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Organization name is required" });
      }

      // REQUIREMENT: User must have an active subscription before creating an organization
      // Check if user has any organization with an active subscription
      const userOrgs = await storage.getUserOrganizations(req.user.id);
      let hasActiveSubscription = false;
      
      for (const userOrg of userOrgs) {
        const org = await storage.getOrganization(userOrg.orgId);
        if (org && org.foundingPartnerStatus === 'active') {
          hasActiveSubscription = true;
          break;
        }
      }
      
      // If user has no active subscription, they must purchase one first
      if (!hasActiveSubscription) {
        return res.status(403).json({ 
          error: "You must have an active subscription before creating an organization. Please purchase a Founding Partner membership first.",
          requiresSubscription: true
        });
      }

      const org = await storage.createOrganization(name, req.user.id);
      
      // Best practice: After creating org, check for any pending Stripe subscriptions
      // This handles the case where user paid before creating account
      try {
        const user = await storage.getUser(req.user.id);
        if (user?.email) {
          const { linkSubscriptionToUser } = await import("./webhookHandlers");
          await linkSubscriptionToUser(user.email, req.user.id);
        }
      } catch (error) {
        console.error("[Organizations] Error linking subscription after org creation:", error);
        // Don't fail org creation if subscription linking fails
      }
      
      res.json(org);
    } catch (error) {
      console.error("[Orgs] Failed to create organization:", error);
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  // Switch to a different organization (update user's active org)
  // CACHE INVALIDATION: Clears membership status cache when switching orgs
  app.post("/api/organizations/switch", isAuthenticated, async (req: any, res) => {
    try {
      const { orgId } = req.body;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID is required" });
      }

      // Verify user is a member of this org
      const membership = await storage.getMembership(req.user.id, orgId);
      if (!membership) {
        return res.status(403).json({ error: "You are not a member of this organization" });
      }

      // Check if organization is deleted
      const org = await storage.getOrganization(orgId);
      if (org?.deletedAt) {
        return res.status(403).json({ error: "Cannot switch to a deactivated organization. Please reactivate it first." });
      }

      // Update user's current organization preference in database
      await storage.updateUser(req.user.id, { currentOrgId: orgId });
      
      // CRITICAL: Clear org context cache for this user to force fresh lookup with new orgId
      // This ensures all subsequent requests use the new organization context
      const cacheKey = `${req.user.id}:${req.sessionID || 'no-session'}`;
      orgContextCache.delete(cacheKey);
      
      // Also clear all cache entries for this user (in case they have multiple sessions)
      const entries = Array.from(orgContextCache.entries());
      for (const [key] of entries) {
        if (key.startsWith(`${req.user.id}:`)) {
          orgContextCache.delete(key);
        }
      }
      
      // Clear membership status cache when switching orgs (different org = different membership status)
      if (req.session) {
        delete (req.session as any).membershipStatus;
        req.session.save(() => {}); // Save session to persist cache clear
      }
      
      console.log(`[Orgs] Switched user ${req.user.id} to org ${orgId} - cleared org context cache`);
      res.json(membership);
    } catch (error) {
      console.error("[Orgs] Failed to switch organization:", error);
      res.status(500).json({ error: "Failed to switch organization" });
    }
  });

  // Get organization details by ID
  app.get("/api/organizations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Verify user is a member of this org
      const membership = await storage.getMembership(req.user.id, id);
      if (!membership) {
        return res.status(403).json({ error: "You are not a member of this organization" });
      }

      const org = await storage.getOrganization(id);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      res.json(org);
    } catch (error) {
      console.error("[Orgs] Failed to fetch organization:", error);
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  // Update organization details
  app.delete("/api/organizations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const orgId = req.params.id;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID is required" });
      }

      // Verify user is owner of this organization
      const membership = await storage.getMembership(userId, orgId);
      if (!membership || membership.role !== 'owner') {
        return res.status(403).json({ error: "Only organization owners can delete organizations" });
      }

      // Get organization to check for subscription
      const org = await storage.getOrganization(orgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      console.log(`[Delete Organization] Organization ${orgId} deletion initiated by user ${userId}`);
      console.log(`[Delete Organization] Has Stripe subscription: ${!!org.stripeSubscriptionId}`);
      if (org.stripeSubscriptionId) {
        console.log(`[Delete Organization] Subscription ID: ${org.stripeSubscriptionId}`);
      }

      // Permanently delete the organization immediately (hard delete)
      // This will cancel the subscription immediately and delete all related data
      const deleted = await storage.permanentlyDeleteOrganization(orgId, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Organization not found" });
      }

      console.log(`[Delete Organization] ✅ Organization ${orgId} permanently deleted by user ${userId}`);
      
      // Update user's currentOrgId if it was pointing to the deleted org
      const user = await storage.getUser(userId);
      let remainingOrgs: Array<{ orgId: string; orgName: string; role: string }> = [];
      try {
        remainingOrgs = await storage.getUserOrganizations(userId);
      } catch (error) {
        console.error(`[Delete Organization] Error getting user organizations:`, error);
      }
      
      // Check which remaining organizations have active memberships
      let orgWithMembership: { orgId: string; orgName: string } | null = null;
      let orgToSwitchTo: { orgId: string; orgName: string } | null = null;
      
      if (remainingOrgs.length > 0) {
        // Check each remaining org for active membership
        for (const remainingOrg of remainingOrgs) {
          try {
            const org = await storage.getOrganization(remainingOrg.orgId);
            if (org && org.foundingPartnerStatus === 'active' && org.stripeSubscriptionId) {
              // Verify subscription is still active in Stripe
              try {
                const { getUncachableStripeClient } = await import("./stripeClient");
                const stripe = await getUncachableStripeClient();
                const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
                
                if (sub.status === 'active' || sub.status === 'trialing') {
                  orgWithMembership = { orgId: org.id, orgName: org.name };
                  orgToSwitchTo = orgWithMembership; // Prioritize org with membership
                  console.log(`[Delete Organization] Found org with active membership: ${org.name} (${org.id})`);
                  break; // Found one with membership, use it
                }
              } catch (stripeError) {
                console.error(`[Delete Organization] Error checking subscription for org ${remainingOrg.orgId}:`, stripeError);
              }
            }
          } catch (orgError) {
            console.error(`[Delete Organization] Error checking org ${remainingOrg.orgId}:`, orgError);
          }
        }
        
        // If no org with membership found, use first available org
        if (!orgToSwitchTo && remainingOrgs.length > 0) {
          orgToSwitchTo = { orgId: remainingOrgs[0].orgId, orgName: remainingOrgs[0].orgName };
          console.log(`[Delete Organization] No org with membership found, using first org: ${orgToSwitchTo.orgName}`);
        }
      }
      
      if (user?.currentOrgId === orgId) {
        if (orgToSwitchTo) {
          // Switch to org with membership (if found) or first available org
          await storage.updateUser(userId, { currentOrgId: orgToSwitchTo.orgId });
          console.log(`[Delete Organization] Switched user ${userId} to organization ${orgToSwitchTo.orgId} (${orgToSwitchTo.orgName})`);
        } else {
          // No other orgs - clear current org
          await storage.updateUser(userId, { currentOrgId: null });
          console.log(`[Delete Organization] Cleared currentOrgId for user ${userId}`);
        }
      }
      
      return res.json({ 
        success: true, 
        message: "Organization permanently deleted. Your subscription has been cancelled immediately and all data has been permanently removed. This action cannot be undone.",
        permanentlyDeleted: true,
        hasOtherOrgs: remainingOrgs.length > 0,
        switchedToOrgId: orgToSwitchTo?.orgId || null,
        orgWithMembership: orgWithMembership ? { orgId: orgWithMembership.orgId, orgName: orgWithMembership.orgName } : null,
      });
    } catch (error: any) {
      console.error("[Delete Organization] Error:", error);
      return res.status(500).json({ error: error.message || "Failed to delete organization" });
    }
  });

  // Restore organization (within 30-day grace period)
  app.post("/api/organizations/:id/restore", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const orgId = req.params.id;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID is required" });
      }

      // Verify user is owner of this organization
      const membership = await storage.getMembership(userId, orgId);
      if (!membership || membership.role !== 'owner') {
        return res.status(403).json({ error: "Only organization owners can restore organizations" });
      }

      console.log(`[Restore Organization] Organization ${orgId} restoration initiated by user ${userId}`);

      // Restore the organization
      const restored = await storage.restoreOrganization(orgId, userId);
      
      if (!restored) {
        return res.status(404).json({ error: "Organization not found or cannot be restored" });
      }

      console.log(`[Restore Organization] ✅ Organization ${orgId} restored by user ${userId}`);
      
      return res.json({ 
        success: true, 
        message: "Organization restored successfully",
      });
    } catch (error: any) {
      console.error("[Restore Organization] Error:", error);
      return res.status(500).json({ error: error.message || "Failed to restore organization" });
    }
  });

  // Cleanup endpoint to permanently delete organizations after 30 days (admin only or scheduled job)
  app.post("/api/organizations/cleanup-deleted", async (req: any, res) => {
    try {
      // Optional: Add authentication check for admin users
      // For now, this can be called by a scheduled job or admin
      const deletedCount = await storage.cleanupDeletedOrganizations();
      
      return res.json({ 
        success: true, 
        message: `Cleanup complete: ${deletedCount} organizations permanently deleted`,
        deletedCount,
      });
    } catch (error: any) {
      console.error("[Cleanup Organizations] Error:", error);
      return res.status(500).json({ error: error.message || "Failed to cleanup deleted organizations" });
    }
  });

  app.patch("/api/organizations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      console.log("[Orgs] Update organization request:", { id, body: req.body });
      
      // Verify user is a member of this org (and ideally an admin/owner, but for now just check membership)
      const membership = await storage.getMembership(req.user.id, id);
      if (!membership) {
        console.log("[Orgs] User is not a member of organization:", id);
        return res.status(403).json({ error: "You are not a member of this organization" });
      }

      // Only allow owners/admins to update (optional: add role check)
      // For now, we'll allow any member to update - you can add role checking later
      // if (membership.role !== 'owner' && membership.role !== 'admin') {
      //   return res.status(403).json({ error: "Only owners and admins can update organization details" });
      // }

      const updates = req.body;
      console.log("[Orgs] Updating organization with:", updates);
      
      // Validate that name is provided and is a string
      if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim().length === 0)) {
        return res.status(400).json({ error: "Organization name is required and must be a non-empty string" });
      }

      // Explicitly filter out 'logo' field - it doesn't exist in the database
      const { logo, ...safeUpdates } = updates;
      if (logo !== undefined) {
        console.log("[Orgs] Filtered out 'logo' field from updates (column doesn't exist in DB)");
      }

      // Get organization before update to check for Stripe customer ID
      const orgBeforeUpdate = await storage.getOrganization(id);
      if (!orgBeforeUpdate) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const updatedOrg = await storage.updateOrganization(id, safeUpdates);
      
      if (!updatedOrg) {
        console.log("[Orgs] Organization not found after update:", id);
        return res.status(404).json({ error: "Organization not found" });
      }

      // If organization name was updated and org has a Stripe customer, update Stripe customer name
      if (safeUpdates.name && orgBeforeUpdate.stripeCustomerId) {
        try {
          const stripe = await getUncachableStripeClient();
          
          // Retrieve current customer to preserve existing metadata
          const currentCustomer = await stripe.customers.retrieve(orgBeforeUpdate.stripeCustomerId);
          const existingMetadata = (currentCustomer as any).metadata || {};
          
          // Update customer name and metadata
          await stripe.customers.update(orgBeforeUpdate.stripeCustomerId, {
            name: safeUpdates.name,
            metadata: {
              ...existingMetadata,
              organization_name: safeUpdates.name,
            },
          });
          console.log(`[Orgs] ✅ Updated Stripe customer ${orgBeforeUpdate.stripeCustomerId} name to "${safeUpdates.name}"`);
        } catch (stripeError: any) {
          // Log error but don't fail the organization update
          console.error(`[Orgs] ⚠️ Failed to update Stripe customer name:`, stripeError);
          // If customer was deleted in Stripe, that's okay - we'll create a new one on next checkout
          if (stripeError.code !== 'resource_missing') {
            console.error(`[Orgs] Stripe customer update error details:`, {
              code: stripeError.code,
              message: stripeError.message,
            });
          }
        }
      }

      console.log("[Orgs] Organization updated successfully:", updatedOrg);
      res.json(updatedOrg);
    } catch (error: any) {
      console.error("[Orgs] Failed to update organization:", error);
      console.error("[Orgs] Error stack:", error.stack);
      
      // Ensure we always return JSON, not HTML
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Failed to update organization",
          message: error.message || "An unexpected error occurred"
        });
      }
    }
  });

  // ===== USER PROFILE ROUTES =====
  
  // Update user profile (first/last name, phone, profile image)
  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const { updateProfileSchema } = await import("@shared/schema");
      const validatedProfile = updateProfileSchema.parse(req.body);
      
      const updatedUser = await storage.updateProfile(req.user.id, validatedProfile);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid profile data", details: error.errors });
      }
      console.error("[Profile] Failed to update profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Delete user account
  app.delete("/api/user/account", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log(`[Delete Account] User ${userId} (${req.user.email}) account deletion initiated`);

      // Prevent deletion of platform admin accounts
      const user = await storage.getUser(userId);
      if (user?.isAdmin) {
        return res.status(403).json({ error: "Cannot delete platform administrator account" });
      }

      // Check if user is the only owner of any organization
      const userMemberships = await storage.getUserOrganizations(userId);
      for (const membership of userMemberships) {
        if (membership.role === 'owner') {
          const org = await storage.getOrganization(membership.orgId);
          if (org) {
            // Check if there are other owners
            const allMembers = await storage.getOrganizationMembers(membership.orgId);
            const ownerCount = allMembers.filter(m => m.role === 'owner').length;
            
            if (ownerCount <= 1) {
              return res.status(400).json({ 
                error: "Cannot delete account. You are the only owner of an organization. Please transfer ownership or delete the organization first.",
                orgId: membership.orgId,
                orgName: membership.orgName,
              });
            }
          }
        }
      }

      // Delete the user account (this will cascade delete memberships, property assignments, etc.)
      const deleted = await storage.deleteUserAccount(userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log(`[Delete Account] ✅ User ${userId} account deleted successfully`);

      // Logout the user
      req.logout((err: any) => {
        if (err) {
          console.error('[Delete Account] Logout error:', err);
        }
        req.session.destroy((destroyErr: any) => {
          if (destroyErr) {
            console.error('[Delete Account] Session destroy error:', destroyErr);
          }
          res.clearCookie("connect.sid");
          res.json({ 
            success: true, 
            message: "Account deleted successfully",
            redirectTo: "/login"
          });
        });
      });
    } catch (error: any) {
      console.error("[Delete Account] Failed to delete account:", error);
      res.status(500).json({ error: "Failed to delete account", details: error.message });
    }
  });
  
  // Get organization members with profiles (for calendar filtering)
  app.get("/api/org/members", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const members = await storage.getOrgMembersWithProfiles(req.orgId);
      res.json(members);
    } catch (error) {
      console.error("[Org] Failed to fetch members:", error);
      res.status(500).json({ error: "Failed to fetch organization members" });
    }
  });

  // ===== TEAM MANAGEMENT ROUTES (RBAC) =====
  
  // Get all team members for the organization
  app.get("/api/team/members", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const members = await storage.getOrganizationMembers(req.orgId);
      res.json(members);
    } catch (error) {
      console.error("[Team] Failed to fetch members:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  // Get all invitations for the organization
  app.get("/api/team/invitations", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const invitations = await storage.getInvitations(req.orgId);
      res.json(invitations);
    } catch (error) {
      console.error("[Team] Failed to fetch invitations:", error);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });

  // Send an invitation to join the organization (Owner and Admin only)
  app.post("/api/team/invitations", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // RBAC: Only owners and admins can invite members (owners have maximum permissions)
      // Normalize role to lowercase for comparison
      const userRole = req.role?.toLowerCase();
      console.log(`[Team Invitations] User ${req.user?.id} attempting to invite - role: ${req.role}, normalized: ${userRole}`);
      
      if (userRole !== 'owner' && userRole !== 'admin') {
        console.log(`[Team Invitations] Access denied - user role: ${req.role}, required: owner or admin`);
        return res.status(403).json({ error: "Only organization owners and administrators can invite team members" });
      }

      const { email, role } = req.body;
      
      if (!email || !role) {
        return res.status(400).json({ error: "Email and role are required" });
      }

      // Validate role
      const validRoles = ['admin', 'property_manager', 'leasing_agent', 'owner_portal'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      // Check if user is already a member
      const existingMember = await storage.getUsersByOrg(req.orgId);
      const isAlreadyMember = existingMember.some(m => m.email === email);
      if (isAlreadyMember) {
        return res.status(409).json({ error: "This user is already a member of the organization" });
      }

      // Generate a secure token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Create invitation with 7-day expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Store ONLY the hashed token in database
      const invitation = await storage.createInvitation({
        email,
        role,
        token: tokenHash, // Store hashed token only
        invitedBy: req.user.id,
        expiresAt,
        orgId: req.orgId,
      });

      // Send invitation email via centralized Lead2Lease email
      console.log(`[Team] [Invitation] ===== STARTING EMAIL SEND PROCESS =====`);
      console.log(`[Team] [Invitation] Timestamp: ${new Date().toISOString()}`);
      console.log(`[Team] [Invitation] Organization ID: ${req.orgId}`);
      console.log(`[Team] [Invitation] Inviter User ID: ${req.user.id}`);
      console.log(`[Team] [Invitation] Recipient email: ${email}`);
      console.log(`[Team] [Invitation] Role: ${role}`);
      console.log(`[Team] [Invitation] Token (first 8 chars): ${token.substring(0, 8)}...`);
      
      try {
        console.log(`[Team] [Invitation] Step 1: Fetching organization and inviter details`);
        // Get organization and inviter details
        const org = await storage.getOrganization(req.orgId);
        console.log(`[Team] [Invitation] Organization found: ${org ? 'YES' : 'NO'}`);
        if (org) {
          console.log(`[Team] [Invitation] Organization name: ${org.name}`);
          console.log(`[Team] [Invitation] Organization email: ${org.email || 'N/A'}`);
        }
        
        const inviter = await storage.getUser(req.user.id);
        console.log(`[Team] [Invitation] Inviter found: ${inviter ? 'YES' : 'NO'}`);
        if (inviter) {
          console.log(`[Team] [Invitation] Inviter email: ${inviter.email}`);
          console.log(`[Team] [Invitation] Inviter firstName: ${inviter.firstName || 'N/A'}`);
          console.log(`[Team] [Invitation] Inviter lastName: ${inviter.lastName || 'N/A'}`);
        }
        
        const inviterName = inviter 
          ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email 
          : 'A team member';
        const orgName = org?.name || 'the organization';
        
        console.log(`[Team] [Invitation] Step 2: Preparing email data`);
        console.log(`[Team] [Invitation] Inviter name: ${inviterName}`);
        console.log(`[Team] [Invitation] Organization name: ${orgName}`);
        console.log(`[Team] [Invitation] Expires at: ${expiresAt.toISOString()}`);
        
        const emailData = {
          email,
          inviterName,
          organizationName: orgName,
          role,
          invitationToken: token, // Use the unhashed token for the email link
          expiresAt,
        };
        console.log(`[Team] [Invitation] Email data prepared:`, {
          email: emailData.email,
          inviterName: emailData.inviterName,
          organizationName: emailData.organizationName,
          role: emailData.role,
          tokenLength: emailData.invitationToken.length,
          expiresAt: emailData.expiresAt.toISOString(),
        });
        
        console.log(`[Team] [Invitation] Step 3: Calling sendInvitationEmail function`);
        // Send the invitation email using centralized account
        await sendInvitationEmail(emailData);
        
        console.log(`[Team] [Invitation] ===== EMAIL SEND COMPLETED SUCCESSFULLY =====`);
        console.log(`[Team] ✅ Invitation email sent successfully to ${email}`);
      } catch (emailError) {
        console.error(`[Team] [Invitation] ===== EMAIL SEND FAILED =====`);
        console.error('[Team] ❌ Failed to send invitation email');
        console.error('[Team] [Invitation] Error type:', emailError instanceof Error ? emailError.constructor.name : typeof emailError);
        
        if (emailError instanceof Error) {
          console.error('[Team] [Invitation] Error message:', emailError.message);
          console.error('[Team] [Invitation] Error stack:', emailError.stack);
          
          // Check for specific error properties
          if ('code' in emailError) {
            console.error('[Team] [Invitation] Error code:', (emailError as any).code);
          }
          if ('command' in emailError) {
            console.error('[Team] [Invitation] Error command:', (emailError as any).command);
          }
          if ('response' in emailError) {
            console.error('[Team] [Invitation] Error response:', JSON.stringify((emailError as any).response));
          }
          if ('responseCode' in emailError) {
            console.error('[Team] [Invitation] Error response code:', (emailError as any).responseCode);
          }
        } else {
          console.error('[Team] [Invitation] Unknown error object:', emailError);
        }
        
        // Invitation still created, just without email notification
        // Continue to return success response with warning
        console.log(`[Team] [Invitation] Continuing despite email error - invitation created in database`);
      }

      res.status(201).json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        invitationLink: `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/accept-invitation/${token}`
      });
    } catch (error) {
      console.error("[Team] Failed to create invitation:", error);
      res.status(500).json({ error: "Failed to send invitation" });
    }
  });

  // Verify invitation token (check if valid before accepting)
  app.get("/api/team/invitations/verify/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      
      // Hash the token to look up in database
      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      const invitation = await storage.getInvitationByToken(tokenHash);
      
      if (!invitation || invitation.status !== 'pending') {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }

      // Check if expired
      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(404).json({ error: "Invitation has expired" });
      }

      // Get organization details
      const org = await storage.getOrganization(invitation.orgId);
      const inviter = await storage.getUser(invitation.invitedBy || '');

      // Check if the organization has an active membership
      const hasMembership = org?.foundingPartnerStatus === 'active' || 
                           (org?.stripeSubscriptionId && org?.foundingPartnerStatus !== 'none');

      res.json({
        email: invitation.email,
        role: invitation.role,
        orgId: invitation.orgId,
        orgName: org?.name || 'Unknown Organization',
        inviterName: inviter?.fullName || inviter?.email || 'Someone',
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        orgHasMembership: hasMembership || false,
      });
    } catch (error) {
      console.error("[Team] Failed to verify invitation:", error);
      res.status(500).json({ error: "Failed to verify invitation" });
    }
  });

  // Accept invitation (Requires authentication)
  app.post("/api/team/invitations/accept/:token", isAuthenticated, async (req: any, res) => {
    try {
      const { token } = req.params;
      
      // Hash the token to look up in database
      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      const membership = await storage.acceptInvitation(tokenHash, req.user.id);
      
      if (!membership) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }

      // Check if the organization has an active membership
      const org = await storage.getOrganization(membership.orgId);
      const hasMembership = org?.foundingPartnerStatus === 'active' || (org?.stripeSubscriptionId && org?.foundingPartnerStatus !== 'none');

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        orgId: membership.orgId,
        userRole: membership.role,
        action: 'accept_invitation',
        resource: 'memberships',
        resourceId: membership.id,
        allowed: true,
        statusCode: 200,
        details: { email: req.user.email, role: membership.role },
      });

      res.json({ 
        message: "Invitation accepted successfully", 
        membership,
        orgHasMembership: hasMembership || false,
      });
    } catch (error) {
      console.error("[Team] Failed to accept invitation:", error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // Revoke/cancel invitation (Owner and Admin only)
  app.delete("/api/team/invitations/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // RBAC: Only owners and admins can revoke invitations
      const userRole = req.role?.toLowerCase();
      if (userRole !== 'owner' && userRole !== 'admin') {
        console.log(`[Team] Access denied for revoke invitation - user role: ${req.role}, required: owner or admin`);
        return res.status(403).json({ error: "Only organization owners and administrators can revoke invitations" });
      }

      const success = await storage.revokeInvitation(req.params.id, req.orgId);
      
      if (!success) {
        return res.status(404).json({ error: "Invitation not found" });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        orgId: req.orgId,
        userRole: req.role,
        action: 'revoke_invitation',
        resource: 'invitations',
        resourceId: req.params.id,
        allowed: true,
        statusCode: 200,
      });

      res.json({ message: "Invitation revoked successfully" });
    } catch (error) {
      console.error("[Team] Failed to revoke invitation:", error);
      res.status(500).json({ error: "Failed to revoke invitation" });
    }
  });

  // Update member role
  app.patch("/api/team/members/:userId/role", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { role } = req.body;
      const { userId } = req.params;

      // Validate role
      const validRoles = ['admin', 'property_manager', 'leasing_agent', 'owner_portal', 'owner'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      // Get current membership to log old role
      const currentMembership = await storage.getMembershipFull(userId, req.orgId);
      if (!currentMembership) {
        return res.status(404).json({ error: "Member not found" });
      }

      const oldRole = currentMembership.role;
      const isChangingToOwner = role === 'owner';
      const isChangingFromOwner = oldRole === 'owner';
      const isChangingToAdmin = role === 'admin';
      const isChangingSelf = req.user.id === userId;

      // RBAC: Property managers and leasing agents cannot change their own role to admin
      if (isChangingSelf && isChangingToAdmin && (req.role === 'property_manager' || req.role === 'leasing_agent')) {
        return res.status(403).json({ error: "Property managers and leasing agents cannot change their own role to admin" });
      }

      // RBAC: Only owners can assign owner role
      if (isChangingToOwner && req.role !== 'owner') {
        return res.status(403).json({ error: "Only organization owners can assign the owner role" });
      }

      // RBAC: Admins cannot change the role of an owner - only owners can modify owner roles
      if (isChangingFromOwner && req.role !== 'owner') {
        return res.status(403).json({ error: "Only organization owners can change the role of an owner" });
      }

      // RBAC: Admins can change roles (except owner), owners can change any role
      if (!isChangingToOwner && !isChangingFromOwner && req.role !== 'admin' && req.role !== 'owner') {
        return res.status(403).json({ error: "Only administrators and owners can change member roles" });
      }

      // Prevent owner from removing themselves unless another owner exists
      if (isChangingSelf && isChangingFromOwner && !isChangingToOwner) {
        // Count how many owners exist in this organization
        const allMembers = await storage.getOrgMembersWithProfiles(req.orgId);
        const ownerCount = allMembers.filter(m => m.role === 'owner').length;
        
        if (ownerCount <= 1) {
          return res.status(400).json({ 
            error: "Cannot remove yourself as owner. You must assign another user as owner first." 
          });
        }
      }

      // Prevent removing owner role from someone if they're the only owner
      if (isChangingFromOwner && !isChangingToOwner && !isChangingSelf) {
        const allMembers = await storage.getOrgMembersWithProfiles(req.orgId);
        const ownerCount = allMembers.filter(m => m.role === 'owner').length;
        
        if (ownerCount <= 1) {
          return res.status(400).json({ 
            error: "Cannot remove the only owner. You must assign another user as owner first." 
          });
        }
      }

      // If assigning owner role, demote all previous owners to admin
      if (isChangingToOwner) {
        try {
          // Find all current owners (excluding the user being made owner)
          const allMembers = await storage.getOrganizationMembers(req.orgId);
          const previousOwners = allMembers.filter(
            m => m.role === 'owner' && m.userId !== userId
          );
          
          // Demote all previous owners to admin
          for (const previousOwner of previousOwners) {
            await storage.updateMembershipRole(previousOwner.userId, req.orgId, 'admin');
            console.log(`[Team] ✅ Demoted previous owner ${previousOwner.userId} to admin (new owner: ${userId})`);
            
            // Create audit log for demotion
            await storage.createAuditLog({
              userId: req.user.id,
              orgId: req.orgId,
              userRole: req.role,
              action: 'update_member_role',
              resource: 'memberships',
              resourceId: previousOwner.id,
              allowed: true,
              statusCode: 200,
              details: { 
                targetUserId: previousOwner.userId, 
                oldRole: 'owner', 
                newRole: 'admin',
                reason: 'Demoted due to new owner assignment'
              },
            });
          }
        } catch (demoteError) {
          console.error(`[Team] Failed to demote previous owners (non-fatal):`, demoteError);
          // Continue with role update even if demotion fails
        }
      }

      const membership = await storage.updateMembershipRole(userId, req.orgId, role);
      
      if (!membership) {
        return res.status(404).json({ error: "Member not found" });
      }

      // If owner role changed, update Stripe customer email to new owner's email
      // Owner is the billing contact - their email receives receipts
      if (role === 'owner' || oldRole === 'owner') {
        try {
          const org = await storage.getOrganization(req.orgId);
          if (org?.stripeCustomerId) {
            // Get the new owner's email (whoever has role='owner' now)
            let newOwner: User | undefined;
            
            // Always get the new owner (whoever has role='owner' now after the update)
            const ownerResult = await db
              .select({ user: users })
              .from(users)
              .innerJoin(memberships, eq(users.id, memberships.userId))
              .where(and(
                eq(memberships.orgId, req.orgId),
                eq(memberships.role, 'owner')
              ))
              .limit(1);
            
            newOwner = ownerResult[0]?.user;
            
            // Fallback: if no owner found but we just assigned owner role, use the user being assigned
            if (!newOwner && role === 'owner') {
              newOwner = await storage.getUser(userId);
            }
            
            if (newOwner?.email) {
              const stripe = await getUncachableStripeClient();
              await stripe.customers.update(org.stripeCustomerId, {
                email: newOwner.email, // Update to new owner's email (billing contact)
                metadata: {
                  organization_id: req.orgId,
                  organization_name: org.name,
                  billing_contact_user_id: newOwner.id,
                  billing_contact_email: newOwner.email,
                  app_env: process.env.NODE_ENV || 'development',
                },
              });
              
              // Also update subscription metadata if subscription exists
              if (org.stripeSubscriptionId) {
                try {
                  await stripe.subscriptions.update(org.stripeSubscriptionId, {
                    metadata: {
                      organization_id: req.orgId,
                      organization_name: org.name,
                      billing_contact_user_id: newOwner.id,
                      billing_contact_email: newOwner.email,
                      app_env: process.env.NODE_ENV || 'development',
                    },
                  });
                } catch (subError) {
                  console.error(`[Team] Failed to update subscription metadata:`, subError);
                }
              }
              
              console.log(`[Team] ✅ Updated Stripe customer email to ${newOwner.email} (new owner: ${newOwner.id})`);
            }
          }
        } catch (stripeError) {
          console.error(`[Team] Failed to update Stripe customer email (non-fatal):`, stripeError);
          // Don't fail the role update if Stripe update fails
        }
      }

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        orgId: req.orgId,
        userRole: req.role,
        action: 'update_member_role',
        resource: 'memberships',
        resourceId: membership.id,
        allowed: true,
        statusCode: 200,
        details: { targetUserId: userId, oldRole: oldRole, newRole: role },
      });

      res.json(membership);
    } catch (error) {
      console.error("[Team] Failed to update member role:", error);
      res.status(500).json({ error: "Failed to update member role" });
    }
  });

  // Update member status (activate/suspend) (Admin and Owner only)
  app.patch("/api/team/members/:userId/status", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // RBAC: Only admins and owners can suspend/activate members
      if (req.role !== 'admin' && req.role !== 'owner') {
        return res.status(403).json({ error: "Only administrators and owners can change member status" });
      }

      const { status } = req.body;
      const { userId } = req.params;

      // Validate status
      const validStatuses = ['active', 'suspended'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      // Get current membership to log old status
      const currentMembership = await storage.getMembershipFull(userId, req.orgId);
      if (!currentMembership) {
        return res.status(404).json({ error: "Member not found" });
      }

      const membership = await storage.updateMembershipStatus(userId, req.orgId, status);
      
      if (!membership) {
        return res.status(404).json({ error: "Member not found" });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        orgId: req.orgId,
        userRole: req.role,
        action: 'update_member_status',
        resource: 'memberships',
        resourceId: membership.id,
        allowed: true,
        statusCode: 200,
        details: { targetUserId: userId, oldStatus: currentMembership.status, newStatus: status },
      });

      res.json(membership);
    } catch (error) {
      console.error("[Team] Failed to update member status:", error);
      res.status(500).json({ error: "Failed to update member status" });
    }
  });

  // Leave organization (self-service)
  app.post("/api/team/leave", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { newOwnerId } = req.body; // Optional: for owners to transfer ownership

      // Get current membership
      const currentMembership = await storage.getMembershipFull(userId, req.orgId);
      if (!currentMembership) {
        return res.status(404).json({ error: "Membership not found" });
      }

      const isOwner = currentMembership.role === 'owner';
      const allMembers = await storage.getOrganizationMembers(req.orgId);
      const memberCount = allMembers.length;
      const isOnlyMember = memberCount === 1;
      const ownerCount = allMembers.filter(m => m.role === 'owner').length;

      // If user is the only member, allow leaving without transfer and permanently delete the organization
      if (isOnlyMember) {
        console.log(`[Team] [Leave Org] ===== STARTING LEAVE ORG FOR SOLE MEMBER =====`);
        console.log(`[Team] [Leave Org] User ${userId} is leaving organization ${req.orgId}`);
        console.log(`[Team] [Leave Org] Member count: ${memberCount}, Owner count: ${ownerCount}`);
        
        // Get user's current state BEFORE deletion
        const userBeforeDeletion = await storage.getUser(userId);
        console.log(`[Team] [Leave Org] User currentOrgId before deletion: ${userBeforeDeletion?.currentOrgId}`);
        
        // Get all user's orgs BEFORE deletion
        let userOrgsBeforeDeletion: Array<{ orgId: string; orgName: string; role: string }> = [];
        try {
          userOrgsBeforeDeletion = await storage.getUserOrganizations(userId);
          console.log(`[Team] [Leave Org] User has ${userOrgsBeforeDeletion.length} org(s) before deletion:`, userOrgsBeforeDeletion.map(o => ({ orgId: o.orgId, name: o.orgName })));
        } catch (error) {
          console.error(`[Team] [Leave Org] Error getting user orgs before deletion:`, error);
        }

        // Verify organization exists before deletion
        const orgBeforeDeletion = await storage.getOrganization(req.orgId);
        if (!orgBeforeDeletion) {
          console.error(`[Team] [Leave Org] ❌ Organization ${req.orgId} does not exist!`);
          return res.status(404).json({ error: "Organization not found" });
        }
        console.log(`[Team] [Leave Org] Organization exists: ${orgBeforeDeletion.name} (${req.orgId})`);

        // Check for any remaining memberships (should be 1 - the leaving user)
        const allMemberships = await storage.getOrganizationMembers(req.orgId);
        console.log(`[Team] [Leave Org] Memberships in org before deletion: ${allMemberships.length}`, allMemberships.map(m => ({ userId: m.userId, role: m.role })));

        // Create audit log BEFORE deleting organization (so orgId reference is valid)
        await storage.createAuditLog({
          userId: userId,
          orgId: req.orgId,
          userRole: currentMembership.role,
          action: 'leave_organization',
          resource: 'memberships',
          resourceId: currentMembership.id,
          allowed: true,
          statusCode: 200,
          details: { 
            leftBy: userId, 
            role: currentMembership.role,
            wasOnlyMember: true,
            organizationDeleted: true,
            permanentlyDeleted: true
          },
        });
        console.log(`[Team] [Leave Org] Audit log created`);

        // IMPORTANT: Delete membership FIRST, then delete organization
        // This ensures the membership is removed before the cascade delete
        console.log(`[Team] [Leave Org] Step 1: Deleting membership for user ${userId} in org ${req.orgId}`);
        const membershipDeleted = await storage.deleteMembership(userId, req.orgId);
        console.log(`[Team] [Leave Org] Membership deleted: ${membershipDeleted}`);

        // Verify membership is deleted
        const membershipAfterDelete = await storage.getMembership(userId, req.orgId);
        if (membershipAfterDelete) {
          console.error(`[Team] [Leave Org] ❌ WARNING: Membership still exists after deletion!`);
        } else {
          console.log(`[Team] [Leave Org] ✅ Membership confirmed deleted`);
        }

        // Now verify no memberships remain
        const membershipsAfterUserLeave = await storage.getOrganizationMembers(req.orgId);
        console.log(`[Team] [Leave Org] Memberships remaining after user left: ${membershipsAfterUserLeave.length}`);
        if (membershipsAfterUserLeave.length > 0) {
          console.error(`[Team] [Leave Org] ❌ WARNING: ${membershipsAfterUserLeave.length} membership(s) still exist:`, membershipsAfterUserLeave.map(m => ({ userId: m.userId, role: m.role })));
        }

        // Permanently delete the organization immediately (hard delete)
        // This will cancel the subscription immediately and delete all related data
        // Skip ownership check since this is the last member leaving
        console.log(`[Team] [Leave Org] Step 2: Permanently deleting organization ${req.orgId}`);
        try {
          const deleted = await storage.permanentlyDeleteOrganization(req.orgId, userId, true); // skipOwnershipCheck = true
          console.log(`[Team] [Leave Org] permanentlyDeleteOrganization returned: ${deleted}`);
          
          if (!deleted) {
            console.error(`[Team] [Leave Org] ❌ Failed to delete organization ${req.orgId} - function returned false`);
            // Still continue, but log the error
          } else {
            console.log(`[Team] [Leave Org] ✅ Organization ${req.orgId} deletion function returned true`);
            
            // Verify deletion succeeded by checking if org still exists
            const verifyOrg = await storage.getOrganization(req.orgId);
            if (verifyOrg) {
              console.error(`[Team] [Leave Org] ❌ WARNING: Organization ${req.orgId} still exists after deletion attempt!`);
              console.error(`[Team] [Leave Org] Organization details:`, { id: verifyOrg.id, name: verifyOrg.name });
              
              // Try one more time to delete directly from database
              try {
                console.log(`[Team] [Leave Org] Retry: Attempting direct database deletion`);
                const deleteResult = await db.delete(organizations).where(eq(organizations.id, req.orgId)).returning();
                console.log(`[Team] [Leave Org] Direct delete returned ${deleteResult.length} row(s)`);
                
                if (deleteResult.length > 0) {
                  console.log(`[Team] [Leave Org] ✅ Second deletion attempt succeeded for organization ${req.orgId}`);
                  
                  // Verify again after second attempt
                  const verifyAgain = await storage.getOrganization(req.orgId);
                  if (!verifyAgain) {
                    console.log(`[Team] [Leave Org] ✅ Verified: Organization ${req.orgId} successfully deleted after second attempt`);
                  } else {
                    console.error(`[Team] [Leave Org] ❌ CRITICAL: Organization ${req.orgId} still exists after second deletion attempt!`);
                  }
                } else {
                  console.error(`[Team] [Leave Org] ❌ Second deletion attempt returned no rows for organization ${req.orgId}`);
                }
              } catch (retryError: any) {
                console.error(`[Team] [Leave Org] ❌ Second deletion attempt also failed:`, retryError);
                console.error(`[Team] [Leave Org] Error message:`, retryError.message);
                console.error(`[Team] [Leave Org] Error stack:`, retryError.stack);
              }
            } else {
              console.log(`[Team] [Leave Org] ✅ Verified: Organization ${req.orgId} successfully deleted from database`);
            }
          }
        } catch (deleteError: any) {
          // If delete fails, log error and try to continue
          console.error(`[Team] [Leave Org] ❌ Exception during permanent delete:`, deleteError);
          console.error(`[Team] [Leave Org] Error type:`, deleteError.constructor.name);
          console.error(`[Team] [Leave Org] Error message:`, deleteError.message);
          console.error(`[Team] [Leave Org] Error stack:`, deleteError.stack);
          
          // Attempt direct database deletion as fallback
          try {
            console.log(`[Team] [Leave Org] Fallback: Attempting direct database deletion for organization ${req.orgId}`);
            const fallbackResult = await db.delete(organizations).where(eq(organizations.id, req.orgId)).returning();
            console.log(`[Team] [Leave Org] Fallback delete returned ${fallbackResult.length} row(s)`);
            
            if (fallbackResult.length > 0) {
              console.log(`[Team] [Leave Org] ✅ Direct database deletion succeeded for organization ${req.orgId}`);
            }
            
            // Verify deletion
            const verifyOrgAfterFallback = await storage.getOrganization(req.orgId);
            if (!verifyOrgAfterFallback) {
              console.log(`[Team] [Leave Org] ✅ Verified: Organization ${req.orgId} successfully deleted via fallback method`);
            } else {
              console.error(`[Team] [Leave Org] ❌ WARNING: Organization ${req.orgId} still exists after fallback deletion attempt!`);
            }
          } catch (fallbackError: any) {
            console.error(`[Team] [Leave Org] ❌ Direct database deletion also failed:`, fallbackError);
            console.error(`[Team] [Leave Org] Fallback error message:`, fallbackError.message);
            console.error(`[Team] [Leave Org] Fallback error stack:`, fallbackError.stack);
          }
        }

        // Step 3: Update user's currentOrgId
        console.log(`[Team] [Leave Org] Step 3: Updating user's currentOrgId`);
        const userAfterDeletion = await storage.getUser(userId);
        console.log(`[Team] [Leave Org] User currentOrgId after deletion: ${userAfterDeletion?.currentOrgId}`);
        
        let remainingOrgs: Array<{ orgId: string; orgName: string; role: string }> = [];
        try {
          const userOrgsAfterDeletion = await storage.getUserOrganizations(userId);
          remainingOrgs = userOrgsAfterDeletion.filter(org => org.orgId !== req.orgId);
          console.log(`[Team] [Leave Org] User has ${remainingOrgs.length} remaining org(s):`, remainingOrgs.map(o => ({ orgId: o.orgId, name: o.orgName })));
        } catch (getOrgsError: any) {
          // If getting user orgs fails (e.g., because org was deleted), just assume no other orgs
          console.log(`[Team] [Leave Org] Could not get user organizations (org may already be deleted):`, getOrgsError.message);
          remainingOrgs = [];
        }
        
        // Ensure user's currentOrgId is cleared or switched
        const currentOrgIdNeedsUpdate = userAfterDeletion?.currentOrgId === req.orgId;
        console.log(`[Team] [Leave Org] User currentOrgId needs update: ${currentOrgIdNeedsUpdate}`);
        
        if (currentOrgIdNeedsUpdate) {
          if (remainingOrgs.length > 0) {
            // Switch to first remaining org
            console.log(`[Team] [Leave Org] Switching user ${userId} to organization ${remainingOrgs[0].orgId}`);
            await storage.updateUser(userId, { currentOrgId: remainingOrgs[0].orgId });
            
            // Verify the update
            const userAfterSwitch = await storage.getUser(userId);
            console.log(`[Team] [Leave Org] User currentOrgId after switch: ${userAfterSwitch?.currentOrgId}`);
            console.log(`[Team] [Leave Org] ✅ Switched user ${userId} to organization ${remainingOrgs[0].orgId} after leaving ${req.orgId}`);
          } else {
            // No other orgs - clear current org
            console.log(`[Team] [Leave Org] Clearing user ${userId} currentOrgId (no other orgs)`);
            await storage.updateUser(userId, { currentOrgId: null });
            
            // Verify the update
            const userAfterClear = await storage.getUser(userId);
            console.log(`[Team] [Leave Org] User currentOrgId after clear: ${userAfterClear?.currentOrgId}`);
            console.log(`[Team] [Leave Org] ✅ Cleared user ${userId} currentOrgId`);
          }
        } else {
          console.log(`[Team] [Leave Org] User currentOrgId already updated (possibly by permanentlyDeleteOrganization)`);
        }

        // Final verification
        console.log(`[Team] [Leave Org] Final verification:`);
        const finalOrgCheck = await storage.getOrganization(req.orgId);
        const finalUserCheck = await storage.getUser(userId);
        console.log(`[Team] [Leave Org] Organization ${req.orgId} exists: ${!!finalOrgCheck}`);
        console.log(`[Team] [Leave Org] User ${userId} currentOrgId: ${finalUserCheck?.currentOrgId}`);
        console.log(`[Team] [Leave Org] ===== END LEAVE ORG FOR SOLE MEMBER =====`);

        return res.json({ 
          success: true, 
          message: "Successfully left organization. The organization has been permanently deleted.",
          hasOtherOrgs: remainingOrgs.length > 0,
          switchedToOrgId: remainingOrgs.length > 0 ? remainingOrgs[0].orgId : null,
          wasOnlyMember: true,
          organizationDeleted: true,
          permanentlyDeleted: true
        });
      }

      // If user is owner and there are other members, check if they're the only owner
      if (isOwner && ownerCount <= 1) {
        // Only owner but there are other members - must transfer ownership first
        if (!newOwnerId) {
          return res.status(400).json({ 
            error: "You are the only owner of this organization. Please select a new owner to transfer ownership before leaving.",
            requiresOwnerTransfer: true
          });
        }

        // Validate new owner exists and is a member
        const newOwnerMembership = await storage.getMembershipFull(newOwnerId, req.orgId);
        if (!newOwnerMembership) {
          return res.status(404).json({ error: "Selected new owner is not a member of this organization" });
        }

        // Transfer ownership to new owner
        // Demote all previous owners to admin
        const previousOwners = allMembers.filter(
          m => m.role === 'owner' && m.userId !== newOwnerId
        );
        for (const previousOwner of previousOwners) {
          await storage.updateMembershipRole(previousOwner.userId, req.orgId, 'admin');
        }

        // Promote new owner
        await storage.updateMembershipRole(newOwnerId, req.orgId, 'owner');

        // Update Stripe customer email to new owner's email if org has subscription
        const org = await storage.getOrganization(req.orgId);
        if (org?.stripeCustomerId) {
          try {
            const newOwner = await storage.getUser(newOwnerId);
            if (newOwner?.email) {
              const { getUncachableStripeClient } = await import("./stripeClient");
              const stripe = await getUncachableStripeClient();
              await stripe.customers.update(org.stripeCustomerId, {
                email: newOwner.email,
                metadata: {
                  organization_id: req.orgId,
                  organization_name: org.name,
                  billing_contact_user_id: newOwner.id,
                  billing_contact_email: newOwner.email,
                  app_env: process.env.NODE_ENV || 'development',
                },
              });

              // Also update subscription metadata if subscription exists
              if (org.stripeSubscriptionId) {
                await stripe.subscriptions.update(org.stripeSubscriptionId, {
                  metadata: {
                    organization_id: req.orgId,
                    organization_name: org.name,
                    billing_contact_user_id: newOwner.id,
                    billing_contact_email: newOwner.email,
                    app_env: process.env.NODE_ENV || 'development',
                  },
                });
              }
            }
          } catch (stripeError) {
            console.error("[Team] Failed to update Stripe customer email (non-fatal):", stripeError);
          }
        }

        console.log(`[Team] ✅ Ownership transferred from ${userId} to ${newOwnerId} before leaving`);
      }

      // Delete the membership
      const deleted = await storage.deleteMembership(userId, req.orgId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Membership not found" });
      }

      // If this was the user's current org, switch to another org or clear it
      const user = await storage.getUser(userId);
      const userOrgs = await storage.getUserOrganizations(userId);
      const remainingOrgs = userOrgs.filter(org => org.orgId !== req.orgId);
      
      if (user?.currentOrgId === req.orgId) {
        if (remainingOrgs.length > 0) {
          // Switch to first remaining org
          await storage.updateUser(userId, { currentOrgId: remainingOrgs[0].orgId });
        } else {
          // No other orgs - clear current org
          await storage.updateUser(userId, { currentOrgId: null });
        }
      }

      // Create audit log
      await storage.createAuditLog({
        userId: userId,
        orgId: req.orgId,
        userRole: currentMembership.role,
        action: 'leave_organization',
        resource: 'memberships',
        resourceId: currentMembership.id,
        allowed: true,
        statusCode: 200,
        details: { 
          leftBy: userId, 
          role: currentMembership.role,
          newOwnerId: isOwner && newOwnerId ? newOwnerId : undefined
        },
      });

      res.json({ 
        success: true, 
        message: "Successfully left organization",
        hasOtherOrgs: remainingOrgs.length > 0,
        switchedToOrgId: remainingOrgs.length > 0 ? remainingOrgs[0].orgId : null
      });
    } catch (error: any) {
      console.error("[Team] Failed to leave organization:", error);
      res.status(500).json({ error: "Failed to leave organization", details: error.message });
    }
  });

  // Remove member from organization (Admin and Owner only)
  app.delete("/api/team/members/:userId", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // RBAC: Only admins and owners can remove members
      if (req.role !== 'admin' && req.role !== 'owner') {
        return res.status(403).json({ error: "Only administrators and owners can remove members" });
      }

      const { userId } = req.params;

      // Prevent removing yourself
      if (userId === req.user.id) {
        return res.status(400).json({ error: "You cannot remove yourself from the organization. Use the 'Leave Organization' option instead." });
      }

      // Get current membership to log details and check if removing owner
      const currentMembership = await storage.getMembershipFull(userId, req.orgId);
      if (!currentMembership) {
        return res.status(404).json({ error: "Member not found" });
      }

      // Prevent removing owner if they're the only owner
      if (currentMembership.role === 'owner') {
        const allMembers = await storage.getOrgMembersWithProfiles(req.orgId);
        const ownerCount = allMembers.filter(m => m.role === 'owner').length;
        
        if (ownerCount <= 1) {
          return res.status(400).json({ 
            error: "Cannot remove the only owner. You must assign another user as owner first." 
          });
        }
      }

      const targetUser = await storage.getUser(userId);
      const deleted = await storage.deleteMembership(userId, req.orgId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Failed to remove member" });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        orgId: req.orgId,
        userRole: req.role,
        action: 'remove_member',
        resource: 'memberships',
        resourceId: currentMembership.id,
        allowed: true,
        statusCode: 200,
        details: { 
          targetUserId: userId, 
          targetUserEmail: targetUser?.email,
          role: currentMembership.role 
        },
      });

      res.json({ message: "Member removed successfully" });
    } catch (error: any) {
      console.error("[Team] Failed to remove member:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  // ===== LEAD ROUTES =====
  app.get("/api/leads", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { status } = req.query;
      const leads = status 
        ? await storage.getLeadsByStatus(status as string, req.orgId)
        : await storage.getAllLeads(req.orgId);
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Sync progress route must come before :id route to avoid matching "sync-progress" as an id
  app.get("/api/leads/sync-progress", isAuthenticated, async (req, res) => {
    const { syncProgressTracker } = await import("./syncProgress");
    res.json(syncProgressTracker.getProgress());
  });

  // Cancel sync route
  app.post("/api/leads/cancel-sync", isAuthenticated, async (req, res) => {
    const { syncProgressTracker } = await import("./syncProgress");
    syncProgressTracker.cancel();
    res.json({ message: "Sync cancelled" });
  });

  // Get leads with unread messages
  app.get("/api/leads/unread", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const leadsWithUnread = await storage.getLeadsWithUnreadMessages(req.orgId);
      res.json(leadsWithUnread);
    } catch (error) {
      console.error("[Leads] Failed to fetch leads with unread messages:", error);
      res.status(500).json({ error: "Failed to fetch leads with unread messages" });
    }
  });

  app.get("/api/leads/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const lead = await storage.getLead(req.params.id, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const conversations = await storage.getConversationsByLeadId(lead.id, req.orgId);
      const notes = await storage.getNotesByLeadId(lead.id);
      
      // Map createdAt to timestamp for frontend compatibility
      // Note: createdAt is already in ISO UTC format from the database query
      const conversationsWithTimestamp = conversations.map(c => ({
        ...c,
        timestamp: c.createdAt
      }));
      
      const notesWithTimestamp = notes.map(n => ({
        ...n,
        timestamp: new Date(n.createdAt).toISOString()
      }));
      
      res.json({ ...lead, conversations: conversationsWithTimestamp, notes: notesWithTimestamp });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead({ ...validatedData, orgId: req.orgId });
      res.status(201).json(lead);
    } catch (error) {
      res.status(400).json({ error: "Invalid lead data" });
    }
  });

  app.patch("/api/leads/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const partialSchema = insertLeadSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      // Check for duplicate email if email is being updated
      if (validatedData.email) {
        const existingLead = await storage.getLeadByEmail(validatedData.email, req.orgId);
        if (existingLead && existingLead.id !== req.params.id) {
          return res.status(409).json({ error: "A lead with this email already exists" });
        }
      }
      
      // Handle profileData merging - if profileData is provided, merge with existing data
      if (validatedData.profileData && typeof validatedData.profileData === 'object') {
        const existingLead = await storage.getLead(req.params.id, req.orgId);
        if (existingLead && existingLead.profileData) {
          // Merge new profileData with existing profileData
          validatedData.profileData = {
            ...(existingLead.profileData as any),
            ...validatedData.profileData,
          };
        }
      }
      
      const lead = await storage.updateLead(req.params.id, validatedData, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(400).json({ error: "Failed to update lead" });
    }
  });

  // IMPORTANT: Specific routes must come BEFORE parameterized routes
  app.delete("/api/leads/gmail-sourced", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { leadIds } = req.body;
      let count: number;
      
      // ONLY delete specific lead IDs if provided, never delete all Gmail leads
      // This prevents accidental deletion of all leads when disconnecting
      if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
        count = await storage.deleteLeadsByIds(leadIds);
        console.log(`[Delete Gmail Leads] Deleted ${count} specific leads from current sync session`);
      } else {
        count = 0;
        console.log("[Delete Gmail Leads] No lead IDs provided, skipping deletion");
      }

      // SECURITY: All showings are created with property.orgId to maintain tenant isolation
      // This prevents cross-org showing creation - the showing belongs to the property's org

      // Create or find lead first
      let lead = await storage.getLeadByEmail(email, property.orgId);
      if (!lead) {
        lead = await storage.createLead({
          name,
          email,
          phone,
          propertyId,
          propertyName: property.name,
          status: "new",
          source: "website",
          orgId: property.orgId,
        });
      }

      // ATOMICALLY re-check conflicts right before creating showing (prevent race condition)
      const { detectConflicts } = await import("./ai-scheduling");
      // Get all showings for the selected date (needed for member-level conflict checking)
      const freshShowings = await storage.getShowingsByDateRange(date, date, property.orgId);
      const schedulePrefs = await storage.getSchedulePreferences();

      // Get property scheduling settings to find assigned members and event duration
      const propertySettings = await storage.getPropertySchedulingSettings(propertyId, property.orgId);
      
      res.json({ 
        message: leadIds?.length > 0 ? "Gmail-sourced leads deleted" : "No leads to delete", 
        count 
      });
    } catch (error) {
      console.error("[Delete Gmail Leads] Error:", error);
      res.status(500).json({ error: "Failed to delete Gmail-sourced leads" });
    }
  });

  app.delete("/api/leads/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    const leadId = req.params.id;
    const start = Date.now();
    try {
      console.log(`[Delete Lead] Starting delete for lead ${leadId}, org ${req.orgId}`);
      const lead = await storage.getLead(leadId, req.orgId);
      if (!lead) {
        console.log(`[Delete Lead] Lead ${leadId} not found`);
        return res.status(404).json({ error: "Lead not found" });
      }

      const conversations = await storage.getConversationsByLeadId(lead.id, req.orgId);
      const lastMessageDate = conversations.length > 0
        ? new Date(Math.max(...conversations.map(c => new Date(c.createdAt).getTime())))
        : new Date();

      await storage.createDeletedLead({
        orgId: req.orgId,
        email: lead.email || null,
        phone: lead.phone || null,
        gmailThreadId: lead.gmailThreadId || null,
        outlookConversationId: null,
        lastMessageDate,
      });

      const deleted = await storage.deleteLead(leadId, req.orgId);
      if (!deleted) {
        console.log(`[Delete Lead] deleteLead returned false for ${leadId}`);
        return res.status(404).json({ error: "Lead not found" });
      }

      const duration = Date.now() - start;
      console.log(`[Delete Lead] Successfully deleted ${lead.email || lead.phone || lead.id} in ${duration}ms`);
      res.status(204).send();
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`[Delete Lead] Error deleting ${leadId} after ${duration}ms:`, error);
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // Send a manual reply to a lead
  app.post("/api/leads/:id/reply", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const leadId = req.params.id;
      const { message } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Get lead details
      const lead = await storage.getLead(leadId, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      // Get all conversations to build proper threading
      const conversations = await storage.getConversationsByLeadId(leadId, req.orgId);

      // Determine channel based on lead source
      const channel = lead.source === 'gmail' || lead.source === 'outlook' ? 'email' : 
                     lead.source === 'twilio' ? 'sms' : 'email';

      // Send the reply based on channel
      if (channel === 'email') {
        // Check for Gmail integration
        const gmailConfig = await storage.getIntegrationConfig('gmail', req.orgId);
        if (gmailConfig?.isConnected && lead.gmailThreadId) {
          // Build threading headers from conversations
          const messageIds = conversations
            .filter((c: any) => c.emailMessageId)
            .map((c: any) => c.emailMessageId);
          
          const inReplyTo = messageIds.length > 0 ? messageIds[messageIds.length - 1] : undefined;
          const references = messageIds.join(' ');

          // Send via Gmail
          await sendReply(gmailConfig.tokens, {
            to: lead.email,
            subject: lead.subject || `Re: Inquiry about ${lead.propertyName || 'property'}`,
            body: message.trim(),
            threadId: lead.gmailThreadId,
            inReplyTo,
            references: references || undefined
          });

          console.log(`[Send Reply] Sent Gmail reply to ${lead.email}`);
        } else {
          // Check for Outlook integration
          const outlookConfig = await storage.getIntegrationConfig('outlook', req.orgId);
          if (outlookConfig?.isConnected && lead.outlookConversationId) {
            // Get the original message ID
            const originalMessage = conversations.find((c: any) => c.externalId);
            if (!originalMessage?.externalId) {
              return res.status(400).json({ 
                error: "Cannot find original message to reply to" 
              });
            }

            // Send via Outlook
            await sendOutlookReply(
              outlookConfig.tokens.access_token,
              originalMessage.externalId,
              message.trim(),
              { name: lead.name, email: lead.email }
            );

            console.log(`[Send Reply] Sent Outlook reply to ${lead.email}`);
          } else {
            return res.status(400).json({ 
              error: "No email integration configured for this lead" 
            });
          }
        }
      } else if (channel === 'sms') {
        // Send via Twilio SMS
        const twilioConfig = await storage.getIntegrationConfig('twilio', req.orgId);
        if (!twilioConfig?.isConnected) {
          return res.status(400).json({ error: "Twilio integration not configured" });
        }
        // TODO: Implement Twilio SMS sending
        return res.status(501).json({ error: "SMS sending not yet implemented" });
      }

      // Store the conversation
      await storage.createConversation({
        leadId: lead.id,
        type: 'outgoing',
        channel,
        message: message.trim(),
        subject: lead.subject || `Re: Inquiry about ${lead.propertyName || 'property'}`,
      });

      // Update lead's last contact time
      await storage.updateLead(leadId, { 
        lastContactAt: new Date().toISOString() 
      }, req.orgId);

      // Mark all notifications for this lead as read since the user has replied
      const markedCount = await storage.markAllLeadNotificationsAsRead(leadId, req.orgId);
      console.log(`[Send Reply] Marked ${markedCount} notifications as read for lead ${leadId}`);

      res.json({ success: true, message: "Reply sent successfully" });
    } catch (error) {
      console.error("[Send Reply] Error:", error);
      res.status(500).json({ error: "Failed to send reply" });
    }
  });

  // ===== PROPERTY ROUTES =====
  app.get("/api/properties", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const properties = await storage.getAllProperties(req.orgId);
      
      // OPTIMIZED: Only fetch leads if we have properties (avoid unnecessary query)
      let propertiesWithStats = properties;
      if (properties.length > 0) {
        // Fetch all leads once (instead of filtering in memory for each property)
        const leads = await storage.getAllLeads(req.orgId);
        
        // Create a map of propertyId -> lead counts for O(1) lookup
        const leadStatsMap = new Map<string, { active: number; approved: number; total: number }>();
        
        for (const lead of leads) {
          if (!lead.propertyId) continue;
          
          const stats = leadStatsMap.get(lead.propertyId) || { active: 0, approved: 0, total: 0 };
          stats.total++;
          
          if (lead.status === 'approved') {
            stats.approved++;
          }
          if (!['approved', 'rejected'].includes(lead.status)) {
            stats.active++;
          }
          
          leadStatsMap.set(lead.propertyId, stats);
        }
        
        // Map properties with stats from the map (much faster than filtering for each property)
        propertiesWithStats = properties.map(property => {
          const stats = leadStatsMap.get(property.id) || { active: 0, approved: 0, total: 0 };
          const conversionRate = stats.total > 0 
            ? Math.round((stats.approved / stats.total) * 100) 
            : 0;
          
          return {
            ...property,
            activeLeads: stats.active,
            conversionRate: `${conversionRate}%`,
          };
        });
      }
      
      res.json(propertiesWithStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });

  // Get properties with units (for booking settings and creation)
  app.get("/api/properties/with-listed-units", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const includeAll = req.query.includeAll === 'true';
      const properties = await storage.getPropertiesWithListedUnits(req.orgId, { includeAll });
      res.json(properties);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch properties with units" });
    }
  });

  app.get("/api/properties/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const property = await storage.getProperty(req.params.id, req.orgId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property" });
    }
  });

  app.post("/api/properties", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validatedData = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty({ ...validatedData, orgId: req.orgId });
      res.status(201).json(property);
    } catch (error) {
      res.status(400).json({ error: "Invalid property data" });
    }
  });

  // Batch update property display orders (for drag-and-drop reordering)
  // IMPORTANT: This route must be defined BEFORE /api/properties/:id to avoid route conflicts
  app.patch("/api/properties/display-orders", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { orders } = req.body;
      const orgId = req.orgId;
      
      console.log("[DisplayOrder] Properties batch request - orgId:", orgId, "orders:", JSON.stringify(orders));

      if (!Array.isArray(orders) || orders.length === 0) {
        console.log("[DisplayOrder] Invalid orders array");
        return res.status(400).json({ error: "orders must be a non-empty array" });
      }

      for (const order of orders) {
        const { id, displayOrder } = order;
        console.log("[DisplayOrder] Updating property:", id, "to displayOrder:", displayOrder);
        
        try {
          await db.update(properties)
            .set({ displayOrder })
            .where(eq(properties.id, id));
          console.log("[DisplayOrder] Property update successful:", id);
        } catch (err: any) {
          console.error("[DisplayOrder] Property update failed:", id, err.message);
        }
      }

      console.log("[DisplayOrder] All property updates complete");
      res.json({ success: true });
    } catch (error: any) {
      console.error("[DisplayOrder] Properties error:", error);
      res.status(500).json({ error: error.message || "Failed to update property display orders" });
    }
  });

  app.patch("/api/properties/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const partialSchema = insertPropertySchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const property = await storage.updateProperty(req.params.id, validatedData, req.orgId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      res.status(400).json({ error: "Failed to update property" });
    }
  });

  app.delete("/api/properties/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      console.log("[Delete Property] Attempting to delete property:", req.params.id, "for org:", req.orgId);
      
      // First, check if property exists
      const property = await storage.getProperty(req.params.id, req.orgId);
      if (!property) {
        console.log("[Delete Property] Property not found");
        return res.status(404).json({ error: "Property not found" });
      }

      // Delete related data first to avoid foreign key constraint issues
      // Note: Units, assignments, showings, and scheduling settings have cascade delete
      // But leads and preferred times don't, so we need to handle them manually
      
      // Clear propertyId from leads (set to null)
      try {
        await db.update(leads)
          .set({ propertyId: null, propertyName: null })
          .where(and(eq(leads.propertyId, req.params.id), eq(leads.orgId, req.orgId)));
        console.log("[Delete Property] Cleared property references from leads");
      } catch (err) {
        console.warn("[Delete Property] Error clearing leads (may not exist):", err);
      }

      // Delete property schedule preferences
      try {
        await db.delete(schedulePreferences)
          .where(eq(schedulePreferences.propertyId, req.params.id));
        console.log("[Delete Property] Deleted schedule preferences");
      } catch (err) {
        console.warn("[Delete Property] Error deleting schedule preferences (may not exist):", err);
      }

      // Delete property scheduling settings
      try {
        await storage.deletePropertySchedulingSettings(req.params.id, req.orgId);
        console.log("[Delete Property] Deleted scheduling settings");
      } catch (err) {
        console.warn("[Delete Property] Error deleting scheduling settings (may not exist):", err);
      }

      // Delete the property (cascade will handle units, assignments, and showings)
      const deleted = await storage.deleteProperty(req.params.id, req.orgId);
      if (!deleted) {
        console.log("[Delete Property] Delete operation returned false");
        return res.status(404).json({ error: "Property not found" });
      }
      
      console.log("[Delete Property] Property deleted successfully");
      res.status(204).send();
    } catch (error: any) {
      console.error("[Delete Property] Error:", error);
      console.error("[Delete Property] Error details:", error.message, error.stack);
      res.status(500).json({ error: error.message || "Failed to delete property" });
    }
  });

  // ===== PROPERTY UNIT ROUTES =====
  app.get("/api/properties/:propertyId/units", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const units = await storage.getAllUnitsByProperty(req.params.propertyId, req.orgId);
      res.json(units);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch units" });
    }
  });

  app.get("/api/units/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const unit = await storage.getPropertyUnit(req.params.id, req.orgId);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }
      res.json(unit);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unit" });
    }
  });

  app.post("/api/properties/:propertyId/units", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // Validate without propertyId and orgId (they're added from URL params and middleware)
      const bodySchema = insertPropertyUnitSchema.omit({ propertyId: true, orgId: true });
      const validatedData = bodySchema.parse(req.body);
      
      console.log("[Create Unit] Request params:", { propertyId: req.params.propertyId, orgId: req.orgId });
      console.log("[Create Unit] Validated data:", validatedData);
      
      // Only enable booking if isListed is explicitly set to true
      // Otherwise, set bookingEnabled to false to prevent automatic booking type creation
      const shouldEnableBooking = validatedData.isListed === true;
      
      const unitData = { 
        ...validatedData, 
        propertyId: req.params.propertyId,
        orgId: req.orgId,
        bookingEnabled: shouldEnableBooking ? true : false // Explicitly set based on isListed
      };
      
      console.log("[Create Unit] Final unit data being inserted:", unitData);
      console.log("[Create Unit] Booking enabled:", unitData.bookingEnabled, "isListed:", unitData.isListed);
      
      const unit = await storage.createPropertyUnit(unitData);
      
      console.log("[Create Unit] Unit created successfully:", unit);
      console.log("[Create Unit] Unit type check - has propertyId:", !!unit.propertyId, "has unitNumber:", !!unit.unitNumber);
      
      res.status(201).json(unit);
    } catch (error) {
      console.error("[Create Unit] Error:", error);
      res.status(400).json({ error: "Invalid unit data" });
    }
  });

  // Batch update unit display orders (for drag-and-drop reordering)
  // IMPORTANT: This route must be defined BEFORE /api/units/:id to avoid route conflicts
  app.patch("/api/units/display-orders", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { orders } = req.body;
      const orgId = req.orgId;
      
      console.log("[DisplayOrder] Units batch request - orgId:", orgId, "orders:", JSON.stringify(orders));

      if (!Array.isArray(orders) || orders.length === 0) {
        console.log("[DisplayOrder] Invalid orders array");
        return res.status(400).json({ error: "orders must be a non-empty array" });
      }

      for (const order of orders) {
        const { id, displayOrder } = order;
        console.log("[DisplayOrder] Updating unit:", id, "to displayOrder:", displayOrder);
        
        try {
          await db.update(propertyUnits)
            .set({ displayOrder })
            .where(eq(propertyUnits.id, id));
          console.log("[DisplayOrder] Unit update successful:", id);
        } catch (err: any) {
          console.error("[DisplayOrder] Unit update failed:", id, err.message);
        }
      }

      console.log("[DisplayOrder] All unit updates complete");
      res.json({ success: true });
    } catch (error: any) {
      console.error("[DisplayOrder] Units error:", error);
      res.status(500).json({ error: error.message || "Failed to update unit display orders" });
    }
  });

  app.patch("/api/units/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // Debug: Log the incoming request body
      console.log(`[Update Unit] Received update request for unit ${req.params.id}:`, JSON.stringify(req.body, null, 2));
      console.log(`[Update Unit] Amenity fields in request:`, {
        laundryType: req.body.laundryType,
        parkingType: req.body.parkingType,
        airConditioningType: req.body.airConditioningType,
        heatingType: req.body.heatingType,
      });
      
      const partialSchema = insertPropertyUnitSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      // Debug: Log validated data
      console.log(`[Update Unit] Validated data:`, JSON.stringify(validatedData, null, 2));
      console.log(`[Update Unit] Amenity fields in validated data:`, {
        laundryType: validatedData.laundryType,
        parkingType: validatedData.parkingType,
        airConditioningType: validatedData.airConditioningType,
        heatingType: validatedData.heatingType,
      });
      
      // Get the current unit to check if isListed is being changed
      const currentUnit = await storage.getPropertyUnit(req.params.id, req.orgId);
      if (!currentUnit) {
        return res.status(404).json({ error: "Unit not found" });
      }
      
      // If isListed is being set to true and it wasn't true before
      // AND the unit doesn't already have custom booking settings
      // Automatically enable booking so it inherits from property-level settings
      if (validatedData.isListed === true && !currentUnit.isListed) {
        // Check if unit already has custom booking settings
        const hasCustomSettings = currentUnit.customEventName !== null || 
                                  currentUnit.customBookingMode !== null ||
                                  currentUnit.customEventDuration !== null ||
                                  currentUnit.bookingEnabled === true;
        
        if (!hasCustomSettings) {
          // Enable booking so it inherits from property-level settings
          validatedData.bookingEnabled = true;
          console.log(`[Update Unit] Unit ${req.params.id} is now listed - enabling booking to inherit from property-level settings`);
        } else {
          console.log(`[Update Unit] Unit ${req.params.id} is now listed but already has custom booking settings`);
        }
      }
      
      const unit = await storage.updatePropertyUnit(req.params.id, validatedData, req.orgId);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }
      
      // Debug: Log the returned unit
      console.log(`[Update Unit] Updated unit returned:`, {
        id: unit.id,
        laundryType: unit.laundryType,
        parkingType: unit.parkingType,
        airConditioningType: unit.airConditioningType,
        heatingType: unit.heatingType,
      });
      
      res.json(unit);
    } catch (error: any) {
      console.error("[Update Unit] Error:", error);
      console.error("[Update Unit] Error details:", error.message, error.stack);
      res.status(400).json({ error: "Failed to update unit", details: error.message });
    }
  });

  app.delete("/api/units/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      console.log("[Delete Unit] Attempting to delete unit:", req.params.id, "for org:", req.orgId);
      
      // First, check if unit exists
      const unit = await storage.getPropertyUnit(req.params.id, req.orgId);
      if (!unit) {
        console.log("[Delete Unit] Unit not found");
        return res.status(404).json({ error: "Unit not found" });
      }

      // Delete unit scheduling settings if they exist
      try {
        await storage.deleteUnitSchedulingSettings(req.params.id, req.orgId);
        console.log("[Delete Unit] Deleted scheduling settings");
      } catch (err) {
        console.warn("[Delete Unit] Error deleting scheduling settings (may not exist):", err);
      }

      const deleted = await storage.deletePropertyUnit(req.params.id, req.orgId);
      if (!deleted) {
        console.log("[Delete Unit] Delete operation returned false");
        return res.status(404).json({ error: "Unit not found" });
      }
      
      console.log("[Delete Unit] Unit deleted successfully");
      res.status(204).send();
    } catch (error: any) {
      console.error("[Delete Unit] Error:", error);
      console.error("[Delete Unit] Error details:", error.message, error.stack);
      res.status(500).json({ error: error.message || "Failed to delete unit" });
    }
  });

  // ===== UNIFIED MESSAGES INBOX =====
  app.get("/api/messages/inbox", isAuthenticated, attachOrgContext, async (req: any, res) => {
    const requestStartTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    try {
      console.log(`[Messages Inbox ${requestId}] 📥 Request started for org ${req.orgId}`);
      
      // Diagnostic: Check if there are any conversations/leads for this org
      try {
        const diagnosticResult = await db.execute(sql`
          SELECT 
            (SELECT COUNT(*) FROM leads WHERE org_id = ${req.orgId}) as total_leads,
            (SELECT COUNT(*) FROM conversations c 
             INNER JOIN leads l ON c.lead_id = l.id 
             WHERE l.org_id = ${req.orgId}) as total_conversations,
            (SELECT COUNT(*) FROM conversations c 
             INNER JOIN leads l ON c.lead_id = l.id 
             WHERE l.org_id = ${req.orgId} AND c.channel = 'facebook') as facebook_conversations
        `);
        const diag = diagnosticResult.rows[0];
        console.log(`[Messages Inbox ${requestId}] 🔍 Diagnostic:`, {
          totalLeads: diag.total_leads,
          totalConversations: diag.total_conversations,
          facebookConversations: diag.facebook_conversations,
        });
      } catch (diagError) {
        console.warn(`[Messages Inbox ${requestId}] ⚠️  Diagnostic query failed:`, diagError);
      }
      
      // OPTIMIZED: Simplified query with window functions, pagination, and better indexing
      // Get pagination parameters (default: 25 items for faster initial load, page 0)
      const limit = parseInt(req.query.limit as string) || 25;
      const offset = parseInt(req.query.offset as string) || 0;
      const maxLimit = 200; // Cap at 200 to prevent excessive load
      const safeLimit = Math.min(limit, maxLimit);
      
      console.log(`[Messages Inbox ${requestId}] 📊 Query params: limit=${safeLimit}, offset=${offset}`);
      
      // OPTIMIZED QUERY: Uses window functions instead of DISTINCT ON and correlated subqueries
      // This is much faster because:
      // 1. Window functions are more efficient than DISTINCT ON for large datasets
      // 2. Single pass through conversations table instead of multiple scans
      // 3. Simplified unread count calculation using window functions
      // 4. Added pagination to limit results
      const queryStartTime = Date.now();
      console.log(`[Messages Inbox ${requestId}] 🔍 Executing SQL query...`);
      console.log(`[Messages Inbox ${requestId}] 🔍 SQL query will filter by org_id: ${req.orgId}`);
      
      let result;
      try {
        result = await db.execute(sql`
        WITH ranked_conversations AS (
          SELECT 
            c.lead_id,
            c.id as conversation_id,
            c.type,
            c.channel,
            c.message,
            c.ai_generated,
            c.created_at,
            to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at_formatted,
            c.email_subject,
            c.source_integration,
            ROW_NUMBER() OVER (PARTITION BY c.lead_id ORDER BY c.created_at DESC) as rn
          FROM conversations c
          INNER JOIN leads l ON c.lead_id = l.id
          WHERE l.org_id = ${req.orgId}
        ),
        latest_conversations AS (
          SELECT 
            lead_id,
            conversation_id,
            type,
            channel,
            message,
            ai_generated,
            created_at_formatted as created_at,
            created_at as created_at_timestamp,
            email_subject,
            source_integration
          FROM ranked_conversations
          WHERE rn = 1
        ),
        last_outgoing_messages AS (
          SELECT 
            lead_id,
            MAX(created_at) as last_outgoing_at
          FROM conversations
          WHERE type IN ('outgoing', 'sent')
          GROUP BY lead_id
        ),
        unread_counts AS (
          SELECT 
            c.lead_id,
            COUNT(*) as unread_count
          FROM conversations c
          INNER JOIN leads l ON c.lead_id = l.id
          LEFT JOIN last_outgoing_messages lom ON c.lead_id = lom.lead_id
          WHERE l.org_id = ${req.orgId}
            AND (c.type = 'received' OR c.type = 'incoming')
            AND c.created_at > COALESCE(lom.last_outgoing_at, '1970-01-01'::timestamp)
          GROUP BY c.lead_id
        )
        SELECT 
          l.id,
          l.name,
          l.email,
          l.phone,
          l.status,
          l.source,
          l.property_name,
          l.created_at as lead_created_at,
          l.last_contact_at,
          l.metadata,
          COALESCE(uc.unread_count, 0)::int as unread_count,
          lc.conversation_id,
          lc.type as last_message_type,
          lc.channel as last_message_channel,
          lc.message as last_message,
          lc.ai_generated as last_message_ai_generated,
          lc.created_at as last_message_at,
          lc.email_subject,
          lc.source_integration
        FROM leads l
        INNER JOIN latest_conversations lc ON l.id = lc.lead_id
        LEFT JOIN unread_counts uc ON l.id = uc.lead_id
        WHERE l.org_id = ${req.orgId}
        ORDER BY lc.created_at_timestamp DESC
        LIMIT ${safeLimit}
        OFFSET ${offset}
      `);
      } catch (sqlError: any) {
        const queryTime = Date.now() - queryStartTime;
        console.error(`[Messages Inbox ${requestId}] ❌ SQL query failed after ${queryTime}ms:`, sqlError);
        console.error(`[Messages Inbox ${requestId}] ❌ SQL error details:`, {
          message: sqlError.message,
          code: sqlError.code,
          detail: sqlError.detail,
          hint: sqlError.hint,
          position: sqlError.position,
        });
        throw sqlError; // Re-throw to be caught by outer try-catch
      }
      
      const queryTime = Date.now() - queryStartTime;
      console.log(`[Messages Inbox ${requestId}] ✅ Query completed in ${queryTime}ms, returned ${result.rows.length} rows`);

      // Transform the results to camelCase
      const transformStartTime = Date.now();
      const inboxItems = result.rows.map((row: any) => ({
        lead: {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          status: row.status,
          source: row.source,
          propertyName: row.property_name,
          createdAt: row.lead_created_at,
          lastContactAt: row.last_contact_at,
          metadata: row.metadata,
        },
        unreadCount: row.unread_count || 0,
        lastMessage: {
          id: row.conversation_id,
          type: row.last_message_type,
          channel: row.last_message_channel,
          message: row.last_message,
          aiGenerated: row.last_message_ai_generated,
          createdAt: row.last_message_at ? new Date(row.last_message_at).toISOString() : null,
          emailSubject: row.email_subject,
          sourceIntegration: row.source_integration,
        },
      }));

      const transformTime = Date.now() - transformStartTime;
      console.log(`[Messages Inbox ${requestId}] ✅ Transformation completed in ${transformTime}ms`);

      // Debug logging for Facebook leads
      const facebookLeads = inboxItems.filter(item => item.lead.source === 'facebook' || item.lastMessage.channel === 'facebook');
      if (facebookLeads.length > 0) {
        console.log(`[Messages Inbox ${requestId}] 📘 Found ${facebookLeads.length} Facebook leads in inbox for org ${req.orgId}`);
      }
      
      const totalTime = Date.now() - requestStartTime;
      console.log(`[Messages Inbox ${requestId}] ✅ Request completed in ${totalTime}ms (query: ${queryTime}ms, transform: ${transformTime}ms)`);

      // Return array format for backward compatibility with existing frontend
      // Frontend expects an array, not an object with items/pagination
      // TODO: Update frontend to use pagination in future optimization
      res.json(inboxItems);
    } catch (error: any) {
      const totalTime = Date.now() - requestStartTime;
      console.error(`[Messages Inbox ${requestId}] ❌ Failed to fetch unified inbox after ${totalTime}ms:`, error);
      console.error(`[Messages Inbox ${requestId}] ❌ Error details:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
      });
      res.status(500).json({ 
        error: "Failed to fetch unified inbox",
        requestId,
        errorMessage: error.message 
      });
    }
  });

  // ===== CONVERSATION ROUTES =====
  app.get("/api/conversations/:leadId", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // CRITICAL: Verify lead belongs to this organization before fetching conversations
      const lead = await storage.getLead(req.params.leadId, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const conversations = await storage.getConversationsByLeadId(req.params.leadId, req.orgId);
      
      // Debug logging for Facebook messages
      const facebookMessages = conversations.filter(c => c.channel === 'facebook');
      if (facebookMessages.length > 0) {
        console.log(`[Conversations API] Found ${facebookMessages.length} Facebook messages for lead ${req.params.leadId}`);
      }
      
      res.json(conversations);
    } catch (error) {
      console.error("[Conversations API] Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      console.log('[Create Conversation] Request body:', JSON.stringify(req.body, null, 2));
      const validatedData = insertConversationSchema.parse(req.body);
      console.log('[Create Conversation] Validated data:', JSON.stringify(validatedData, null, 2));
      
      // Get lead details to send email
      const lead = await storage.getLead(validatedData.leadId, req.orgId);
      if (!lead) {
        console.error('[Create Conversation] Lead not found:', validatedData.leadId, 'orgId:', req.orgId);
        return res.status(404).json({ error: "Lead not found" });
      }
      
      let emailSendStatus: { sent: boolean; error?: string } = { sent: false };
      
      // For email conversations, ensure metadata is always set (even if sending fails)
      if (validatedData.channel === "email") {
        const integrationToUse = validatedData.sourceIntegration || 'gmail';
        const emailSubject = validatedData.emailSubject || `Message from ${req.user.name || 'Property Manager'}`;
        validatedData.emailSubject = emailSubject;
        validatedData.sourceIntegration = integrationToUse;
      }
      
      // For Facebook conversations, set sourceIntegration and mark as pending
      if (validatedData.channel === "facebook") {
        validatedData.sourceIntegration = validatedData.sourceIntegration || 'facebook';
        // Facebook messages need to be sent via the polling script, so mark as pending
        if (validatedData.type === "outgoing" || validatedData.type === "sent") {
          (validatedData as any).deliveryStatus = 'pending';
        }
      }
      
      // If channel is email and type is outgoing, send actual email
      if (validatedData.channel === "email" && (validatedData.type === "outgoing" || validatedData.type === "sent") && lead.email) {
        try {
          // Use the integration specified in the request (default to gmail)
          const integrationToUse = validatedData.sourceIntegration || 'gmail';
          
          console.log(`[Send Email] Attempting to send email via ${integrationToUse} to ${lead.email}`);
          console.log(`[Send Email] Lead has email: ${lead.email}`);
          console.log(`[Send Email] Message type: ${validatedData.type}`);
          console.log(`[Send Email] Looking up integration with service="${integrationToUse}" and orgId="${req.orgId}"`);
          
          // Get the specified integration
          const integration = await storage.getIntegrationConfig(integrationToUse, req.orgId);
          
          console.log(`[Send Email] Integration lookup result:`, integration ? 'FOUND' : 'NOT FOUND');
          if (integration) {
            console.log(`[Send Email] Integration ID: ${integration.id}, has access_token:`, !!integration.config?.access_token);
          }
          
          if (!integration) {
            console.error('[Send Email] Integration not found for service:', integrationToUse, 'orgId:', req.orgId);
            emailSendStatus = { sent: false, error: `${integrationToUse} integration not configured` };
            (validatedData as any).deliveryStatus = 'failed';
            (validatedData as any).deliveryError = emailSendStatus.error;
          } else if (!integration.config?.access_token) {
            console.error('[Send Email] No access_token found for integration:', integrationToUse);
            emailSendStatus = { sent: false, error: `${integrationToUse} is not connected` };
            (validatedData as any).deliveryStatus = 'failed';
            (validatedData as any).deliveryError = emailSendStatus.error;
          } else {
            // Use the email subject from the request, or generate a default
            const emailSubject = validatedData.emailSubject || `Message from ${req.user.name || 'Property Manager'}`;
            
            // Fetch conversation history to build proper email threading headers
            // Note: By design, each lead maps to exactly ONE email thread per integration
            // The import logic ensures this by creating new leads for new threads
            const conversationHistory = await storage.getConversationsByLeadId(lead.id, req.orgId);
            
            // Filter to only emails from the SAME integration (Gmail, Outlook, etc.)
            // This ensures we're looking at conversations from the correct email account
            let threadEmails = conversationHistory
              .filter(c => 
                c.channel === 'email' && 
                c.sourceIntegration === integrationToUse
              )
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Chronological order
            
            // Check if this subject matches any existing conversation subjects
            // If it does, the user is replying to an existing thread
            // If it doesn't, they're starting a new conversation
            // IMPORTANT: Normalize subjects to strip "Re:", "Fwd:" prefixes
            // This ensures "Hi" and "Re: Hi" are treated as the same thread
            const normalizedRequestSubject = normalizeEmailSubject(emailSubject);
            const existingNormalizedSubjects = new Set(
              threadEmails
                .filter(c => c.emailSubject)
                .map(c => normalizeEmailSubject(c.emailSubject!))
            );
            const isNewSubject = !existingNormalizedSubjects.has(normalizedRequestSubject);
            
            console.log('[Send Email] Thread detection:', {
              requestedSubject: emailSubject,
              normalizedRequestSubject,
              existingNormalizedSubjects: Array.from(existingNormalizedSubjects),
              isNewSubject,
              totalConversations: threadEmails.length
            });
            
            // Backfill missing Message-IDs on-demand
            for (const conv of threadEmails) {
              if (!conv.emailMessageId && conv.externalId) {
                try {
                  console.log('[Send Email] Fetching missing Message-ID for conversation', conv.id);
                  const gmailMessage = await getMessage(integration.config, conv.externalId);
                  const headers = gmailMessage.payload?.headers || [];
                  const messageId = headers.find((h: any) => h.name === "Message-ID")?.value;
                  
                  if (messageId) {
                    // Update the conversation with the Message-ID
                    await db
                      .update(conversations)
                      .set({ emailMessageId: messageId })
                      .where(eq(conversations.id, conv.id));
                    conv.emailMessageId = messageId; // Update in-memory too
                    console.log('[Send Email] Backfilled Message-ID:', messageId);
                  }
                } catch (error: any) {
                  console.error('[Send Email] Failed to backfill Message-ID:', error.message);
                }
              }
            }
            
            // Filter to only emails with Message-IDs (after backfill)
            threadEmails = threadEmails.filter(c => c.emailMessageId);
            
            // Determine if we should use threading:
            // 1. If subject doesn't match any existing conversation subjects, start a new thread
            // 2. If subject matches an existing one, ALWAYS use the lead's gmailThreadId
            //    (even if there's no recent incoming message - the thread ID itself is enough)
            
            let threadId: string | undefined;
            let inReplyTo: string | undefined;
            let references: string | undefined;
            
            if (!isNewSubject && lead.gmailThreadId) {
              // User selected "Reply to existing thread" - use the lead's Gmail thread ID
              threadId = lead.gmailThreadId;
              
              // Get messages from the same normalized subject for References/In-Reply-To headers
              // This ensures we include all messages regardless of Re:/Fwd: prefixes
              const sameSubjectEmails = threadEmails.filter(c => 
                c.emailSubject && normalizeEmailSubject(c.emailSubject) === normalizedRequestSubject
              );
              const lastIncomingMessage = sameSubjectEmails
                .filter(c => c.type === 'received')
                .reverse()[0]; // Last received message with the same normalized subject
              
              // Include In-Reply-To and References if we have a recent incoming message
              if (lastIncomingMessage) {
                const emailMessageIds = sameSubjectEmails.map(c => c.emailMessageId).filter(Boolean) as string[];
                inReplyTo = lastIncomingMessage.emailMessageId;
                references = emailMessageIds.length > 0 ? emailMessageIds.join(' ') : undefined;
              }
              
              console.log('[Send Email] Replying to existing thread:', {
                threadId,
                inReplyTo: inReplyTo || '(none - no recent incoming)',
                referencesCount: references ? references.split(' ').length : 0,
                subject: emailSubject
              });
            } else {
              // Start a new thread
              const reason = isNewSubject ? 'new subject' : 'no gmailThreadId on lead';
              console.log(`[Send Email] Starting new thread (${reason})`);
            }
            
            // Send email using Gmail API
            console.log('[Send Email] Sending email...');
            const sentEmailResponse = await sendReply(integration.config, {
              to: lead.email,
              subject: emailSubject,
              body: validatedData.message,
              threadId,
              inReplyTo,
              references,
            });
            
            console.log('[Send Email] Email sent successfully');
            emailSendStatus = { sent: true };
            (validatedData as any).deliveryStatus = 'sent';
            
            // Extract and store the sent message's Message-ID for future threading
            if (sentEmailResponse && sentEmailResponse.id) {
              try {
                const sentMessage = await getMessage(integration.config, sentEmailResponse.id);
                const sentHeaders = sentMessage.payload?.headers || [];
                const sentMessageId = sentHeaders.find((h: any) => h.name === "Message-ID")?.value;
                if (sentMessageId) {
                  (validatedData as any).emailMessageId = sentMessageId;
                  console.log('[Send Email] Captured outgoing Message-ID for threading:', sentMessageId);
                }
                
                // If we started a new thread (threadId was undefined), capture the new threadId Gmail assigned
                if (!threadId && sentEmailResponse.threadId) {
                  console.log('[Send Email] New thread created by Gmail. Updating lead threadId from', lead.gmailThreadId, 'to', sentEmailResponse.threadId);
                  await storage.updateLead(lead.id, { gmailThreadId: sentEmailResponse.threadId } as any, req.orgId);
                  console.log('[Send Email] Lead gmailThreadId updated successfully');
                }
              } catch (error) {
                console.error('[Send Email] Failed to capture sent Message-ID:', error);
              }
            }
          }
        } catch (emailError: any) {
          console.error('[Send Email] Failed to send email:', emailError);
          emailSendStatus = { sent: false, error: emailError.message || 'Failed to send email' };
          (validatedData as any).deliveryStatus = 'failed';
          (validatedData as any).deliveryError = emailSendStatus.error;
        }
      }
      
      const conversation = await storage.createConversation(validatedData);
      
      // Log manual message if not AI-generated
      if (!validatedData.aiGenerated) {
        const { logAIAction } = await import("./auditLogging");
        await logAIAction(req, {
          actionType: "manual_message",
          leadId: validatedData.leadId,
          leadName: lead.name,
          conversationId: conversation.id,
          channel: validatedData.channel || 'email',
        });
      }
      
      // Update lead's lastContactAt
      await storage.updateLead(validatedData.leadId, { lastContactAt: new Date() } as any, req.orgId);
      
      // If this is an outgoing message, mark all notifications for this lead as read
      if (validatedData.type === 'outgoing' || validatedData.type === 'sent') {
        const markedCount = await storage.markAllLeadNotificationsAsRead(validatedData.leadId, req.orgId);
        console.log(`[Send Message] Marked ${markedCount} notifications as read for lead ${validatedData.leadId}`);
      }
      
      res.status(201).json({ 
        ...conversation, 
        emailStatus: emailSendStatus 
      });
    } catch (error: any) {
      console.error('[Create Conversation] Error:', error);
      
      // If it's a Zod validation error, show the actual validation errors
      if (error.errors && Array.isArray(error.errors)) {
        return res.status(400).json({ 
          error: "Invalid conversation data", 
          details: error.errors 
        });
      }
      
      res.status(400).json({ error: error.message || "Invalid conversation data" });
    }
  });

  // Retry sending a failed email
  app.post("/api/conversations/:conversationId/retry", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const conversationId = req.params.conversationId;
      
      // Get all conversations for the org to find this specific one
      // (we don't have a getConversationById method in storage interface)
      const allConversations = await db.select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      
      if (!allConversations || allConversations.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const conv = allConversations[0];
      
      // Only retry failed email messages
      if (conv.channel !== 'email' || conv.deliveryStatus !== 'failed') {
        return res.status(400).json({ error: "Only failed email messages can be retried" });
      }
      
      // Get lead details
      const lead = await storage.getLead(conv.leadId, req.orgId);
      if (!lead || !lead.email) {
        return res.status(404).json({ error: "Lead not found or has no email" });
      }
      
      let emailSendStatus: { sent: boolean; error?: string } = { sent: false };
      
      try {
        const integrationToUse = conv.sourceIntegration || 'gmail';
        
        console.log(`[Retry Email] Attempting to resend email via ${integrationToUse} to ${lead.email}`);
        
        const integration = await storage.getIntegrationConfig(integrationToUse, req.orgId);
        
        if (!integration) {
          emailSendStatus = { sent: false, error: `${integrationToUse} integration not configured` };
        } else if (!integration.config?.access_token) {
          emailSendStatus = { sent: false, error: `${integrationToUse} is not connected` };
        } else {
          const emailSubject = conv.emailSubject || `Message from ${req.user.name || 'Property Manager'}`;
          
          // Fetch conversation history to build proper email threading headers
          // Note: By design, each lead maps to exactly ONE Gmail thread (lead.gmailThreadId)
          // The import logic ensures this by creating new leads for new threads
          const conversationHistory = await storage.getConversationsByLeadId(lead.id, req.orgId);
          
          // Filter to only Gmail emails (conversations for this lead are already from the same thread)
          // We filter by sourceIntegration to ensure we're only looking at Gmail messages
          let threadEmails = conversationHistory
            .filter(c => 
              c.channel === 'email' && 
              c.sourceIntegration === 'gmail'
            )
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Chronological order
          
          // Check if this subject matches any existing conversation subjects
          const existingSubjects = new Set(
            threadEmails
              .filter(c => c.emailSubject)
              .map(c => c.emailSubject)
          );
          const isNewSubject = !existingSubjects.has(emailSubject);
          
          // Backfill missing Message-IDs on-demand
          for (const conv of threadEmails) {
            if (!conv.emailMessageId && conv.externalId) {
              try {
                console.log('[Retry Email] Fetching missing Message-ID for conversation', conv.id);
                const gmailMessage = await getMessage(integration.config, conv.externalId);
                const headers = gmailMessage.payload?.headers || [];
                const messageId = headers.find((h: any) => h.name === "Message-ID")?.value;
                
                if (messageId) {
                  // Update the conversation with the Message-ID
                  await db
                    .update(conversations)
                    .set({ emailMessageId: messageId })
                    .where(eq(conversations.id, conv.id));
                  conv.emailMessageId = messageId; // Update in-memory too
                  console.log('[Retry Email] Backfilled Message-ID:', messageId);
                }
              } catch (error: any) {
                console.error('[Retry Email] Failed to backfill Message-ID:', error.message);
              }
            }
          }
          
          // Filter to only emails with Message-IDs (after backfill)
          threadEmails = threadEmails.filter(c => c.emailMessageId);
          
          // Determine if we should use threading:
          // 1. If subject doesn't match any existing conversation subjects, start a new thread
          // 2. If subject matches an existing one, thread if there's a recent incoming message WITH THE SAME SUBJECT
          
          // IMPORTANT: Only look at emails with the SAME subject when replying to an existing conversation
          // This prevents us from using Message-IDs from a different thread
          const sameSubjectEmails = !isNewSubject 
            ? threadEmails.filter(c => c.emailSubject === emailSubject)
            : [];
          
          const lastIncomingMessage = sameSubjectEmails
            .filter(c => c.type === 'received')
            .reverse()[0]; // Last received message with the same subject
          
          const shouldUseThreading = !isNewSubject && !!lastIncomingMessage;
          
          let threadId: string | undefined;
          let inReplyTo: string | undefined;
          let references: string | undefined;
          
          if (shouldUseThreading) {
            // This is a reply to an existing conversation - use threading
            // IMPORTANT: Only use Message-IDs from emails with the SAME subject for proper threading
            const emailMessageIds = sameSubjectEmails.map(c => c.emailMessageId).filter(Boolean) as string[];
            threadId = lead.gmailThreadId || undefined;
            inReplyTo = lastIncomingMessage.emailMessageId;
            references = emailMessageIds.length > 0 ? emailMessageIds.join(' ') : undefined;
            
            console.log('[Retry Email] Replying to existing thread:', {
              threadId,
              inReplyTo,
              referencesCount: emailMessageIds.length,
              subject: emailSubject
            });
          } else {
            // Start a new thread (either new subject or no recent incoming)
            const reason = isNewSubject ? 'new subject' : 'no recent incoming messages';
            console.log(`[Retry Email] Starting new thread (${reason})`);
          }
          
          console.log('[Retry Email] Sending email...');
          const sentEmailResponse = await sendReply(integration.config, {
            to: lead.email,
            subject: emailSubject,
            body: conv.message,
            threadId,
            inReplyTo,
            references,
          });
          
          console.log('[Retry Email] Email sent successfully');
          emailSendStatus = { sent: true };
          
          // Extract and store the sent message's Message-ID for future threading
          if (sentEmailResponse && sentEmailResponse.id) {
            try {
              const sentMessage = await getMessage(integration.config, sentEmailResponse.id);
              const sentHeaders = sentMessage.payload?.headers || [];
              const sentMessageId = sentHeaders.find((h: any) => h.name === "Message-ID")?.value;
              if (sentMessageId) {
                // Update the conversation with the sent Message-ID
                await db
                  .update(conversations)
                  .set({ emailMessageId: sentMessageId })
                  .where(eq(conversations.id, conversationId));
                console.log('[Retry Email] Captured outgoing Message-ID for threading:', sentMessageId);
              }
              
              // If we started a new thread (threadId was undefined), capture the new threadId Gmail assigned
              if (!threadId && sentEmailResponse.threadId) {
                console.log('[Retry Email] New thread created by Gmail. Updating lead threadId from', lead.gmailThreadId, 'to', sentEmailResponse.threadId);
                await storage.updateLead(lead.id, { gmailThreadId: sentEmailResponse.threadId } as any, req.orgId);
                console.log('[Retry Email] Lead gmailThreadId updated successfully');
              }
            } catch (error) {
              console.error('[Retry Email] Failed to capture sent Message-ID:', error);
            }
          }
          
          // Update conversation status
          await db
            .update(conversations)
            .set({ 
              deliveryStatus: 'sent',
              deliveryError: null
            })
            .where(eq(conversations.id, conversationId));
        }
      } catch (emailError: any) {
        console.error('[Retry Email] Failed to send email:', emailError);
        emailSendStatus = { sent: false, error: emailError.message || 'Failed to send email' };
        
        // Update error message
        await db
          .update(conversations)
          .set({ 
            deliveryError: emailSendStatus.error
          })
          .where(eq(conversations.id, conversationId));
      }
      
      res.json({ 
        success: emailSendStatus.sent,
        error: emailSendStatus.error 
      });
    } catch (error) {
      console.error('[Retry Email] Error:', error);
      res.status(500).json({ error: "Failed to retry email" });
    }
  });

  // Delete a conversation message
  app.delete("/api/conversations/:conversationId", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const conversationId = req.params.conversationId;
      
      // Get the conversation to verify it belongs to this org
      const allConversations = await db.select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      
      if (!allConversations || allConversations.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const conv = allConversations[0];
      
      // Verify the lead belongs to this org
      const lead = await storage.getLead(conv.leadId, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Delete autopilot_activity_logs that reference this conversation first (foreign key)
      await db.delete(autopilotActivityLogs).where(eq(autopilotActivityLogs.conversationId, conversationId));
      
      // Delete the conversation
      await db.delete(conversations).where(eq(conversations.id, conversationId));
      
      console.log(`[Delete Conversation] Deleted conversation ${conversationId} from lead ${conv.leadId}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[Delete Conversation] Error:', error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Generate AI reply for a specific lead
  app.post("/api/leads/:leadId/ai-reply", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const leadId = req.params.leadId;
      
      // Get lead details
      const lead = await storage.getLead(leadId, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      // Check if AI is enabled for this lead
      if (lead.aiEnabled === false) {
        return res.status(403).json({ 
          error: "AI is disabled for this lead",
          aiEnabled: false 
        });
      }

      // Get user information
      const user = req.user;
      const userName = user?.name || user?.email?.split('@')[0] || 'Property Manager';
      const userEmail = user?.email || '';
      
      // Get organization information
      const organization = await storage.getOrganization(req.orgId);
      const orgName = organization?.name || 'Our Property Management';

      // Get conversations for this lead
      const conversations = await storage.getConversationsByLeadId(leadId, req.orgId);
      
      // Find the most recent incoming message
      const incomingMessage = conversations
        .filter((c: any) => c.type === 'incoming' || c.type === 'received')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      if (!incomingMessage) {
        return res.status(400).json({ error: "No incoming message to reply to" });
      }

      // Analyze conversation for intelligence and context awareness
      const { analyzeConversation, buildConversationContext, buildAntiRepetitionInstructions } = await import("./conversationIntelligence");
      const conversationAnalysis = await analyzeConversation(
        conversations.map((c: any) => ({
          type: c.type,
          message: c.message,
          createdAt: c.createdAt,
          channel: c.channel,
        })),
        openai
      );

      // Check if escalation is required
      if (conversationAnalysis.requiresEscalation) {
        // Use fallback email for Facebook leads that don't have an email
        const leadEmail = lead.email || (lead.source === 'facebook' 
          ? `facebook-${lead.externalId || lead.id}@facebook.local` 
          : `lead-${lead.id}@local`);
        
        // Create pending reply with escalation flag
        const pendingReply = await storage.createPendingReply({
          orgId: req.orgId,
          leadId: lead.id,
          leadName: lead.name,
          leadEmail: leadEmail,
          subject: `[ESCALATION REQUIRED] Re: Inquiry about ${lead.propertyName || 'our property'}`,
          content: `This conversation requires human review.\n\nReason: ${conversationAnalysis.escalationReason || 'Complex case'}\n\nLead's latest message: ${incomingMessage.message}`,
          originalMessage: incomingMessage.message,
          channel: incomingMessage.channel || 'email',
          status: 'pending',
          threadId: (incomingMessage as any).threadId,
          inReplyTo: incomingMessage.externalId,
          references: incomingMessage.externalId,
          metadata: {
            requiresEscalation: true,
            escalationReason: conversationAnalysis.escalationReason,
            leadIntent: conversationAnalysis.leadIntent,
          } as any,
        });

        return res.status(201).json({
          message: "Conversation requires human escalation",
          pendingReply,
          escalation: {
            required: true,
            reason: conversationAnalysis.escalationReason,
          },
        });
      }

      // Detect if this is a showing request using AI
      const showingRequestAnalysis = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Analyze this message and determine if the person is requesting a property showing/tour/viewing.

Message: ${incomingMessage.message}

Respond with a JSON object:
{
  "isShowingRequest": true/false,
  "confidence": "high"/"medium"/"low"
}

Examples:
- "I'd love to see the property" → {"isShowingRequest": true, "confidence": "high"}
- "Can I schedule a tour?" → {"isShowingRequest": true, "confidence": "high"}
- "When are you available to show the apartment?" → {"isShowingRequest": true, "confidence": "high"}
- "What's the monthly rent?" → {"isShowingRequest": false, "confidence": "high"}`
        }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const analysisResult = JSON.parse(showingRequestAnalysis.choices[0].message.content || '{"isShowingRequest": false}');
      const isShowingRequest = analysisResult.isShowingRequest && analysisResult.confidence !== 'low';
      
      console.log("[AI Reply] Showing request analysis:", { isShowingRequest, confidence: analysisResult.confidence, leadId: lead.id });

      // Detect if message is asking about available properties
      const messageLower = incomingMessage.message.toLowerCase();
      const isAskingAboutAvailableProperties = 
        messageLower.includes('other properties') ||
        messageLower.includes('other property') ||
        messageLower.includes('any other') ||
        messageLower.includes('what properties') ||
        messageLower.includes('which properties') ||
        messageLower.includes('available properties') ||
        messageLower.includes('available property') ||
        messageLower.includes('what listings') ||
        messageLower.includes('which listings') ||
        messageLower.includes('other listings') ||
        messageLower.includes('more properties') ||
        messageLower.includes('more property') ||
        messageLower.includes('do you have') && (messageLower.includes('property') || messageLower.includes('listing'));

      // Get property details if lead has one
      let property = null;
      let propertyUnits: any[] = [];
      let allPropertiesWithUnits: any[] = [];
      let suggestedTimeSlots: any[] = [];
      let bookingLink = '';

      console.log("[AI Reply] Lead property check:", { leadId: lead.id, propertyId: lead.propertyId, propertyName: lead.propertyName, isAskingAboutAvailableProperties });

      if (isAskingAboutAvailableProperties) {
        // Fetch ALL properties with listed units when asking about available properties
        console.log("[AI Reply] Message asks about available properties - fetching all properties with units");
        allPropertiesWithUnits = await storage.getPropertiesWithListedUnits(req.orgId, { includeAll: false });
        // Filter to only properties with listed/available units WITH booking enabled
        allPropertiesWithUnits = allPropertiesWithUnits
          .map(prop => ({
            ...prop,
            listedUnits: prop.listedUnits.filter((unit: any) => 
              unit.isListed && 
              unit.status === 'not_occupied' && 
              unit.bookingEnabled === true
            )
          }))
          .filter(prop => prop.listedUnits.length > 0);
        console.log(`[AI Reply] Found ${allPropertiesWithUnits.length} properties with available units (listed + available + booking enabled)`);
      } else if (lead.propertyId) {
        property = await storage.getProperty(lead.propertyId, req.orgId);
        console.log("[AI Reply] Property fetched:", property ? { id: property.id, name: property.name } : 'NOT FOUND');
        
        // Get all listed units for this property (for availability, rent, details)
        if (property) {
          propertyUnits = await storage.getAllUnitsByProperty(property.id, req.orgId);
          // Filter to only listed/available units WITH booking enabled
          propertyUnits = propertyUnits.filter(unit => 
            unit.isListed && 
            unit.status === 'not_occupied' && 
            unit.bookingEnabled === true
          );
          console.log("[AI Reply] Property units fetched (listed + available + booking enabled):", propertyUnits.length);
        }
        
        // ALWAYS generate booking link if property exists (env-appropriate: localhost in dev, canonical in prod)
        if (property) {
          const baseUrl = getBaseUrlForBookingLink();
          bookingLink = `${baseUrl}/book-showing/property/${property.id}`;
          console.log("[AI Reply] Generated booking link:", bookingLink);
        }
        
        // If this is a showing request, try to get AI-optimized time slots
        if (isShowingRequest && property) {
          console.log("[AI Reply] Generating time slots for showing request...");
          try {
            const { suggestTimeSlots } = await import("./ai-scheduling");
            
            // Get property scheduling settings (includes assigned members)
            const propertySettings = await storage.getPropertySchedulingSettings(property.id, req.orgId);
            
            // Get unit scheduling settings if we have a specific unit (use first available unit with booking enabled)
            // This ensures we check member availability for the specific unit's assigned members
            let unitSettings = null;
            let unitIdForSlots: string | undefined = undefined;
            if (propertyUnits.length > 0) {
              // Use the first unit with booking enabled for time slot generation
              const firstBookableUnit = propertyUnits.find((u: any) => u.bookingEnabled === true);
              if (firstBookableUnit) {
                unitIdForSlots = firstBookableUnit.id;
                unitSettings = await storage.getUnitSchedulingSettings(firstBookableUnit.id, req.orgId);
                console.log("[AI Reply] Using unit-specific settings for time slots:", { unitId: unitIdForSlots });
              }
            }
            
            // Merge unit settings with property settings (unit overrides property)
            const effectiveSettings = unitSettings ? {
              ...propertySettings,
              assignedMembers: unitSettings.customAssignedMembers || propertySettings?.assignedMembers,
              eventDuration: unitSettings.customEventDuration ?? propertySettings?.eventDuration,
              bufferTime: unitSettings.customBufferTime ?? propertySettings?.bufferTime,
              leadTime: unitSettings.customLeadTime ?? propertySettings?.leadTime,
            } : propertySettings;
            
            // Check booking configuration for logging
            const isBookingEnabled = unitSettings?.bookingEnabled ?? propertySettings?.bookingEnabled ?? false;
            const assignedMembers = effectiveSettings?.assignedMembers || [];
            const hasAssignedMembers = Array.isArray(assignedMembers) && assignedMembers.length > 0;
            
            console.log("[AI Reply] Booking availability check:", {
              isBookingEnabled,
              hasAssignedMembers,
              assignedMembersCount: assignedMembers.length,
              hasUnitSettings: !!unitSettings,
              hasPropertySettings: !!propertySettings,
            });
            
            // Always try to generate time slots - let suggestTimeSlots determine actual availability
            // This ensures we check real member availability even if settings aren't perfectly configured
            // Get all showings for next 7 days
            const startDate = new Date().toISOString().split('T')[0];
            const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const allShowings = await storage.getShowingsByDateRange(startDate, endDate, req.orgId);
            
            // Get schedule preferences - if assigned members exist, filter to them; otherwise use all
            let schedulePrefs = await storage.getSchedulePreferences();
            if (effectiveSettings?.assignedMembers && Array.isArray(effectiveSettings.assignedMembers) && effectiveSettings.assignedMembers.length > 0) {
              const assignedMemberIds = effectiveSettings.assignedMembers.map((m: any) => 
                typeof m === 'string' ? m : (m?.userId || m)
              ).filter(Boolean);
              schedulePrefs = schedulePrefs.filter(pref => assignedMemberIds.includes(pref.userId));
              console.log("[AI Reply] Filtered schedule preferences to assigned members:", assignedMemberIds.length, "members");
            } else {
              // If no assigned members specified, use all schedule preferences (property might have general availability)
              console.log("[AI Reply] No assigned members specified, using all schedule preferences");
            }
            
            // Get all properties for route optimization
            const allPropertiesArray = await storage.getAllProperties(req.orgId);
            const allPropertiesMap = new Map(allPropertiesArray.map(p => [p.id, p]));
            
            // Get lead preferred times if available (from metadata)
            const leadMetadata = lead?.metadata as any;
            const leadPreferredTimes = leadMetadata?.preferredTimes || leadMetadata?.preferred_time || null;
            
            // Get suggestions for next 7 days - collect all time slots across all days
            const allSuggestions: any[] = [];
            for (let daysAhead = 0; daysAhead < 7; daysAhead++) {
              const targetDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
              const dateStr = targetDate.toISOString().split('T')[0];
              
              const daySuggestions = suggestTimeSlots(
                dateStr,
                property,
                allShowings,
                schedulePrefs,
                allPropertiesMap,
                effectiveSettings as any,
                unitIdForSlots
              );
              
              // If lead has preferred times, prioritize slots around those times
              if (leadPreferredTimes && daySuggestions.length > 0) {
                // Boost scores for slots near preferred times
                daySuggestions.forEach(slot => {
                  // Check if slot time is close to any preferred time
                  // This is a simple implementation - could be enhanced
                  const slotTime = slot.time;
                  // Add score boost for preferred times (simple implementation)
                  if (leadPreferredTimes) {
                    slot.score += 10; // Boost score for any slot when lead has preferences
                  }
                });
              }
              
              allSuggestions.push(...daySuggestions);
            }
            
            // Sort by score and take top 5 - only include slots with actual availability
            suggestedTimeSlots = allSuggestions
              .filter(slot => slot.score > 0) // Only include slots with positive scores (available)
              .sort((a, b) => b.score - a.score)
              .slice(0, 5);
            
            console.log("[AI Reply] Generated scheduling data:", { 
              timeSlotsCount: suggestedTimeSlots.length, 
              bookingLink,
              firstSlot: suggestedTimeSlots[0],
              hasUnitSettings: !!unitSettings,
              hasAssignedMembers: !!(effectiveSettings?.assignedMembers?.length),
              isBookingEnabled,
              totalSuggestionsBeforeFilter: allSuggestions.length,
              schedulePrefsCount: schedulePrefs.length
            });
            
            // If no time slots were generated, log why
            if (suggestedTimeSlots.length === 0) {
              console.log("[AI Reply] ⚠️ No available time slots generated - this could be due to:");
              console.log("  - No schedule preferences configured");
              console.log("  - All assigned members are fully booked");
              console.log("  - Booking not enabled at property/unit level");
              console.log("  - No available time windows in the next 7 days");
            }
          } catch (schedulingError: any) {
            console.error("[AI Reply] Failed to fetch AI scheduling suggestions:", schedulingError.message);
            console.error("[AI Reply] Stack trace:", schedulingError.stack);
            // Booking link already generated above, continue without time slots
            console.log("[AI Reply] Continuing with booking link only (no time slots)");
          }
        } else {
          console.log("[AI Reply] Skipping time slots:", { isShowingRequest, hasProperty: !!property });
        }
      } else {
        console.log("[AI Reply] No property linked to lead - cannot generate booking link");
      }

      // Get organization AI settings (brand voice, policies)
      const orgAISettings = await storage.getAISettings('organization', req.orgId);
      const brandVoice = orgAISettings.find(s => s.key === 'brand_voice')?.value;
      const policies = orgAISettings.find(s => s.key === 'policies')?.value;

      // Get personality/tone settings (for training content generation - not used in V2)
      const personalitySettingsTraining = await storage.getAISettings('personality', req.orgId);
      const friendliness = personalitySettingsTraining.find(s => s.key === 'friendliness')?.value || 'professional'; // friendly, professional
      const formality = personalitySettingsTraining.find(s => s.key === 'formality')?.value || 'professional'; // formal, conversational
      const responseLength = personalitySettingsTraining.find(s => s.key === 'response_length')?.value || 'detailed'; // short, detailed
      const urgency = personalitySettingsTraining.find(s => s.key === 'urgency')?.value || 'moderate'; // low, moderate, high
      const warmth = personalitySettingsTraining.find(s => s.key === 'warmth')?.value || 'moderate'; // low, moderate, high
      const communicationStyle = personalitySettingsTraining.find(s => s.key === 'communication_style')?.value || 'informational'; // sales-assist, informational

      // Get training content (auto-generated from historical conversations)
      const trainingSettings = await storage.getAISettings('training', req.orgId);
      const trainingContentRaw = trainingSettings.find(s => s.key === 'auto_training_content')?.value;
      
      // Limit training content length to avoid overly long prompts (keep first 2000 chars)
      const trainingContent = trainingContentRaw ? trainingContentRaw.substring(0, 2000) : null;
      
      if (trainingContentRaw) {
        console.log(`[AI Reply] Using training content (${trainingContentRaw.length} chars, truncated to ${trainingContent?.length || 0} chars)`);
      } else {
        console.log(`[AI Reply] No training content found - AI will use default behavior`);
      }

      // Get corrections (examples of correct responses from interactive training)
      const correctionsSettings = await storage.getAISettings('training_corrections', req.orgId);
      const correctionsData = correctionsSettings.find(s => s.key === 'corrections')?.value;
      let correctionsContext = '';
      if (correctionsData) {
        try {
          const corrections = JSON.parse(correctionsData);
          if (Array.isArray(corrections) && corrections.length > 0) {
            correctionsContext = '\n\nCORRECTED EXAMPLES (learn from these - these are the RIGHT way to respond):\n';
            corrections.slice(-20).forEach((correction: any, idx: number) => {
              correctionsContext += `\nExample ${idx + 1}:\n`;
              correctionsContext += `Lead said: "${correction.leadMessage}"\n`;
              correctionsContext += `Wrong response: "${correction.originalMessage}"\n`;
              correctionsContext += `Correct response: "${correction.correctedMessage}"\n`;
            });
          }
        } catch (e) {
          console.error('[AI Reply] Error parsing corrections:', e);
        }
      }

      // Get lead notes for context
      const leadNotes = await storage.getNotesByLeadId(leadId);

      // Get leasing rules (qualification settings) - ALWAYS fetch org-level, property-level overrides if lead has property
      // This ensures qualifications are always available for the AI to reference
      let qualificationSettings = await storage.getOrgQualificationSettings(req.orgId);
      if (lead.propertyId) {
        // Property-level settings override org-level
        const propertyQualificationSettings = await storage.getPropertyQualificationSettings(lead.propertyId, req.orgId);
        if (propertyQualificationSettings) {
          qualificationSettings = propertyQualificationSettings;
        }
      }
      // Debug logging for qualifications
      if (qualificationSettings) {
        console.log(`[AI Reply] Qualification settings found:`, {
          orgId: req.orgId,
          propertyId: lead.propertyId,
          hasQualifications: !!qualificationSettings.qualifications,
          qualificationsCount: Array.isArray(qualificationSettings.qualifications) ? qualificationSettings.qualifications.length : 0,
          qualifications: qualificationSettings.qualifications
        });
      } else {
        console.log(`[AI Reply] No qualification settings found for orgId: ${req.orgId}`);
      }

      // Build property context
      let propertyContext = '';
      if (property) {
        propertyContext = `\n\nPROPERTY INFORMATION (use accurate information from database):
Property: ${property.name}
Address: ${property.address}
${property.description ? `Description: ${property.description}` : ''}
${property.amenities && property.amenities.length > 0 ? `Amenities: ${property.amenities.join(', ')}` : ''}`;

        // Add available units information - format as: "{bedrooms} bed/{bathrooms} bath, {address} Apartment Unit {unitNumber}"
        if (propertyUnits.length > 0) {
          propertyContext += `\n\nAVAILABLE UNITS (current database values - format as: "{bedrooms} bed/{bathrooms} bath, {property address} Apartment Unit {unitNumber}"):`;
          propertyUnits.slice(0, 5).forEach((unit, idx) => {
            const bedBath = unit.bedrooms && unit.bathrooms 
              ? `${unit.bedrooms} bed/${unit.bathrooms} bath`
              : unit.bedrooms 
                ? `${unit.bedrooms} bed`
                : unit.bathrooms
                  ? `${unit.bathrooms} bath`
                  : '';
            propertyContext += `\n${bedBath ? bedBath + ', ' : ''}${property.address} Apartment Unit ${unit.unitNumber}`;
            if (unit.monthlyRent) propertyContext += ` - $${parseFloat(unit.monthlyRent).toLocaleString()}/month`;
            if (unit.leaseStartDate) propertyContext += ` - Available: ${unit.leaseStartDate}`;
          });
          if (propertyUnits.length > 5) {
            propertyContext += `\n...and ${propertyUnits.length - 5} more available units`;
          }
        } else {
          propertyContext += `\n\nAVAILABLE UNITS: Please check availability or contact for current listings.`;
        }
      } else if (allPropertiesWithUnits.length > 0) {
        // Build context for ALL available properties when question is about available properties
        propertyContext = `\n\nALL AVAILABLE PROPERTIES AND UNITS (current database values - use these exact details):\nFormat each unit as: "{bedrooms} bed/{bathrooms} bath, {property address} Apartment Unit {unitNumber}"\n\n`;
        allPropertiesWithUnits.forEach((prop, propIdx) => {
          if (prop.listedUnits && prop.listedUnits.length > 0) {
            prop.listedUnits.slice(0, 10).forEach((unit: any, unitIdx: number) => {
              const bedBath = unit.bedrooms && unit.bathrooms 
                ? `${unit.bedrooms} bed/${unit.bathrooms} bath`
                : unit.bedrooms 
                  ? `${unit.bedrooms} bed`
                  : unit.bathrooms
                    ? `${unit.bathrooms} bath`
                    : '';
              propertyContext += `${bedBath ? bedBath + ', ' : ''}${prop.address} Apartment Unit ${unit.unitNumber}`;
              if (unit.monthlyRent) propertyContext += ` - $${parseFloat(unit.monthlyRent).toLocaleString()}/month`;
              if (unit.leaseStartDate) propertyContext += ` - Available: ${unit.leaseStartDate}`;
              propertyContext += `\n`;
            });
            if (prop.listedUnits.length > 10) {
              propertyContext += `...and ${prop.listedUnits.length - 10} more available units\n`;
            }
          }
        });
        propertyContext += `\nIMPORTANT: Use only the property and unit information provided above from the database. Format responses as: "{bedrooms} bed/{bathrooms} bath, {address} Apartment Unit {unitNumber}". Do not make up details.`;
      }

      // Build leasing rules context - ALWAYS include if qualifications exist
      let leasingRulesContext = '';
      if (qualificationSettings && qualificationSettings.qualifications) {
        const quals = qualificationSettings.qualifications as any[];
        if (quals.length > 0) {
          leasingRulesContext = `\n\nLEASING REQUIREMENTS / QUALIFICATIONS (CRITICAL: Always use these EXACT criteria when asked about qualifications, requirements, or policies):
`;
          quals.forEach((qual: any) => {
            if (qual.type === 'income') {
              leasingRulesContext += `- Income Requirement: ${qual.value} (e.g., ${qual.value}x monthly rent)\n`;
            } else if (qual.type === 'credit_score') {
              leasingRulesContext += `- Minimum Credit Score: ${qual.value}\n`;
            } else if (qual.type === 'pet_policy') {
              leasingRulesContext += `- Pet Policy: ${qual.value}\n`;
            } else if (qual.type === 'move_in_date') {
              leasingRulesContext += `- Move-in Date Policy: ${qual.value}\n`;
            } else {
              leasingRulesContext += `- ${qual.label || qual.type}: ${qual.value}\n`;
            }
          });
          leasingRulesContext += `\nIMPORTANT: If the lead asks about qualifications, requirements, or policies, you MUST provide the exact information listed above. Do not make up or guess qualification requirements.`;
        }
      } else {
        // Even if no qualifications are set, let the AI know
        leasingRulesContext = `\n\nLEASING REQUIREMENTS: No specific qualification requirements have been set for this organization.`;
      }

      // Get calendar availability context
      const availabilityContext = await getAvailabilityContext();

      // Build time slots text for prompt
      let timeSlotsText = '';
      if (suggestedTimeSlots.length > 0) {
        timeSlotsText = '\n\nSUGGESTED SHOWING TIMES (AI-optimized for this property):';
        suggestedTimeSlots.forEach((slot, idx) => {
          timeSlotsText += `\n${idx + 1}. ${slot.date} at ${slot.time} (Score: ${slot.score}/100 - ${slot.reason})`;
        });
        timeSlotsText += `\n\nPublic Booking Link: ${bookingLink}`;
      } else if (bookingLink) {
        // Even without time slots, include the booking link if we have one
        timeSlotsText = `\n\nPublic Booking Link (for self-service scheduling): ${bookingLink}`;
      }

      // Build organization context
      let orgContext = '';
      if (brandVoice) {
        orgContext += `\n- Brand Voice/Tone: ${brandVoice}`;
      }
      if (policies) {
        orgContext += `\n- Organization Policies: ${policies}`;
      }
      if (organization?.email) {
        orgContext += `\n- Organization Email: ${organization.email}`;
      }
      if (organization?.phone) {
        orgContext += `\n- Organization Phone: ${organization.phone}`;
      }
      if (organization?.address) {
        orgContext += `\n- Organization Address: ${organization.address}`;
      }

      // Build conversation context and anti-repetition instructions
      const conversationContext = buildConversationContext(
        conversations.map((c: any) => ({
          type: c.type,
          message: c.message,
          createdAt: c.createdAt,
          channel: c.channel,
        })),
        conversationAnalysis
      );
      const antiRepetitionInstructions = buildAntiRepetitionInstructions(conversationAnalysis);

      // Build personality/tone instructions
      let personalityInstructions = '';
      
      // Friendliness level
      if (friendliness === 'friendly') {
        personalityInstructions += 'Write in a warm, approachable, and friendly tone. Use casual language and show enthusiasm. ';
      } else {
        personalityInstructions += 'Write in a professional and businesslike tone. Maintain a respectful and courteous demeanor. ';
      }
      
      // Formality level
      if (formality === 'conversational') {
        personalityInstructions += 'Use conversational language with contractions and a more relaxed style. ';
      } else {
        personalityInstructions += 'Use formal language with proper grammar and structure. Avoid contractions. ';
      }
      
      // Response length
      if (responseLength === 'short') {
        personalityInstructions += 'Keep responses concise (2-3 short paragraphs maximum). Get to the point quickly. ';
      } else {
        personalityInstructions += 'Provide detailed, thorough responses (3-4 paragraphs). Include comprehensive information. ';
      }
      
      // Urgency level
      if (urgency === 'high') {
        personalityInstructions += 'Create a sense of urgency and timeliness. Encourage quick action. Use phrases like "limited availability" or "act soon". ';
      } else if (urgency === 'low') {
        personalityInstructions += 'Maintain a relaxed, no-pressure approach. Avoid creating urgency. ';
      } else {
        personalityInstructions += 'Balance urgency with professionalism. Mention availability naturally without being pushy. ';
      }
      
      // Warmth level
      if (warmth === 'high') {
        personalityInstructions += 'Show genuine warmth and care. Use empathetic language and show personal interest. ';
      } else if (warmth === 'low') {
        personalityInstructions += 'Keep responses factual and straightforward. Maintain professional distance. ';
      } else {
        personalityInstructions += 'Show appropriate warmth while remaining professional. Be personable but not overly casual. ';
      }
      
      // Communication style
      if (communicationStyle === 'sales-assist') {
        personalityInstructions += 'Adopt a sales-assist approach: highlight benefits, create excitement, guide toward application/showing, and overcome objections. ';
      } else {
        personalityInstructions += 'Adopt an informational approach: provide clear information, answer questions thoroughly, and let the lead decide without pressure. ';
      }

      // CRITICAL: Check if auto-pilot already sent a reply to this message
      // If auto-pilot already sent, don't create a pending reply - just return the sent status
      console.log(`[AI Reply] [Manual Endpoint] 🔍 Checking for auto-pilot replies for lead ${leadId}`);
      console.log(`[AI Reply] [Manual Endpoint] Incoming message ID: ${incomingMessage.id}, createdAt: ${incomingMessage.createdAt}, channel: ${incomingMessage.channel || 'email'}`);
      
      // Get auto-pilot settings to check if it's enabled
      const autoPilotSettings = await storage.getAISettings("automation", req.orgId);
      const autoPilotMode = autoPilotSettings.find(s => s.key === "auto_pilot_mode")?.value === "true";
      
      // Check if there's already a sent conversation for this incoming message (auto-pilot may have already sent)
      // Look for outgoing conversations created AFTER this incoming message that are AI-generated and marked as sent
      const recentOutgoingConversations = conversations
        .filter((c: any) => {
          const isOutgoing = c.type === 'outgoing' || c.type === 'sent';
          const isAIGenerated = c.aiGenerated === true;
          const isSent = c.deliveryStatus === 'sent';
          const isAfterIncoming = new Date(c.createdAt).getTime() > new Date(incomingMessage.createdAt).getTime();
          const isRecent = (new Date().getTime() - new Date(c.createdAt).getTime()) < 10 * 60 * 1000; // Within last 10 minutes
          
          return isOutgoing && isAIGenerated && isSent && isAfterIncoming && isRecent;
        });
      
      console.log(`[AI Reply] [Manual Endpoint] Found ${recentOutgoingConversations.length} recent auto-pilot sent conversations:`, 
        recentOutgoingConversations.map((c: any) => ({
          id: c.id,
          type: c.type,
          createdAt: c.createdAt,
          deliveryStatus: c.deliveryStatus,
          aiGenerated: c.aiGenerated,
          channel: c.channel,
          timeSinceIncoming: Math.round((new Date(c.createdAt).getTime() - new Date(incomingMessage.createdAt).getTime()) / 1000) + 's'
        }))
      );
      
      if (recentOutgoingConversations.length > 0) {
        console.log(`[AI Reply] [Manual Endpoint] ⚠️ BLOCKING pending reply creation - auto-pilot already sent a reply to this message`);
        console.log(`[AI Reply] [Manual Endpoint] Blocking reason: Found ${recentOutgoingConversations.length} sent conversation(s) after incoming message`);
        return res.status(200).json({
          message: "Auto-pilot already sent a reply to this message",
          conversationId: recentOutgoingConversations[0].id,
          alreadySent: true,
        });
      }
      
      console.log(`[AI Reply] [Manual Endpoint] ✅ No auto-pilot reply found - proceeding with pending reply creation`);

      // Get personality settings
      const personalitySettings = await storage.getAISettings('personality', req.orgId);
      
      // Use V2 AI reply generator (RAG + Tools + Structured Outputs)
      const structuredResponse = await generateAIReplyV2(openai, {
        orgId: req.orgId,
        leadMessage: incomingMessage.message,
        leadId: lead.id,
        lead: {
          id: lead.id,
          name: lead.name,
          propertyId: lead.propertyId,
          propertyName: lead.propertyName,
          source: lead.source,
          status: lead.status,
        },
        conversations,
        isPracticeMode: false,
        personalitySettings: {
          friendliness: personalitySettings.find(s => s.key === 'friendliness')?.value,
          formality: personalitySettings.find(s => s.key === 'formality')?.value,
          responseLength: personalitySettings.find(s => s.key === 'response_length')?.value,
          urgency: personalitySettings.find(s => s.key === 'urgency')?.value,
          warmth: personalitySettings.find(s => s.key === 'warmth')?.value,
          communicationStyle: personalitySettings.find(s => s.key === 'communication_style')?.value,
        }
      });
      
      const aiReplyContent = structuredResponse.answer;
      
      // Log structured response metadata
      console.log('[AI Reply] V2 Response:', {
        confidence: structuredResponse.confidence,
        needsHuman: structuredResponse.needsHuman,
        sourcesCount: structuredResponse.sources.length,
        toolResultsCount: structuredResponse.toolResults?.length || 0
      });
      
      // If needs human escalation, flag it in metadata
      if (structuredResponse.needsHuman) {
        console.log('[AI Reply] ⚠️ Response flagged for human escalation');
      }

      // Check auto-pilot settings and rules
      let shouldAutoSend = false;
      let autoPilotDecision: { shouldAutoSend: boolean; reason: string; confidence: string } | null = null;
      let messageAnalysis: { questionType: string; confidence: string; reasoning: string } | null = null;
      
      if (autoPilotMode) {
        // Import auto-pilot rules
        const { analyzeMessageForAutoPilot, shouldAutoSend: shouldAutoSendCheck } = await import("./autoPilotRules");
        
        // Analyze the incoming message
        messageAnalysis = await analyzeMessageForAutoPilot(incomingMessage.message, openai);
        
        // Build auto-pilot settings object
        const autoPilotConfig: any = {
          enabled: true,
          businessHoursOnly: autoPilotSettings.find(s => s.key === "auto_pilot_business_hours_enabled")?.value === "true",
          businessHoursStart: autoPilotSettings.find(s => s.key === "auto_pilot_business_hours_start")?.value || "09:00",
          businessHoursEnd: autoPilotSettings.find(s => s.key === "auto_pilot_business_hours_end")?.value || "17:00",
          businessDays: parseArraySetting(
            autoPilotSettings.find(s => s.key === "auto_pilot_business_days")?.value,
            ["monday", "tuesday", "wednesday", "thursday", "friday"]
          ),
          allowedQuestionTypes: parseArraySetting(
            autoPilotSettings.find(s => s.key === "auto_pilot_question_types")?.value,
            ["availability", "pricing", "general"]
          ),
          minConfidenceLevel: (autoPilotSettings.find(s => s.key === "auto_pilot_min_confidence")?.value || "high") as "high" | "medium" | "low",
          timezone: organization?.timezone || "America/Chicago",
        };
        
        // Check if should auto-send
        autoPilotDecision = shouldAutoSendCheck(autoPilotConfig, messageAnalysis);
        shouldAutoSend = autoPilotDecision.shouldAutoSend;
      }

      // If auto-pilot should send, send immediately
      if (shouldAutoSend && autoPilotDecision) {
        // Send the email
        const gmailConfig = await storage.getIntegrationConfig("gmail", req.orgId);
        const outlookConfig = await storage.getIntegrationConfig("outlook", req.orgId);
        
        const gmailTokens = gmailConfig?.config as any;
        const outlookTokens = outlookConfig?.config as any;
        
        let emailSent = false;
        if (gmailTokens?.access_token) {
          const { sendReply } = await import("./gmail");
          await sendReply(gmailTokens, {
            to: lead.email!,
            subject: `Re: Inquiry about ${lead.propertyName || 'our property'}`,
            body: aiReplyContent,
            threadId: (incomingMessage as any).threadId || undefined,
            inReplyTo: incomingMessage.externalId || undefined,
            references: incomingMessage.externalId || undefined,
          });
          emailSent = true;
        } else if (outlookTokens?.access_token) {
          const { sendOutlookEmail } = await import("./outlook");
          await sendOutlookEmail(outlookTokens.access_token, {
            to: lead.email!,
            subject: `Re: Inquiry about ${lead.propertyName || 'our property'}`,
            body: aiReplyContent,
            inReplyTo: incomingMessage.externalId || undefined,
            references: incomingMessage.externalId || undefined,
          });
          emailSent = true;
        }
        
        if (emailSent) {
          // Record conversation - NO pending reply creation for auto-pilot
          const conversation = await storage.createConversation({
            leadId: lead.id,
            type: 'outgoing',
            channel: incomingMessage.channel || 'email',
            message: aiReplyContent,
            aiGenerated: true,
          });
          
          // Log AI reply sent via auto-pilot (no pending reply needed)
          const { logAIAction } = await import("./auditLogging");
          await logAIAction(req, {
            actionType: "ai_reply_sent",
            leadId: lead.id,
            leadName: lead.name,
            conversationId: conversation.id,
            channel: incomingMessage.channel || 'email',
            sentViaAutoPilot: true,
            autoPilotReason: autoPilotDecision.reason,
            confidenceLevel: messageAnalysis?.confidence || "medium",
          });
          
          return res.status(201).json({
            message: "AI reply sent automatically via auto-pilot",
            conversationId: conversation.id,
            autoPilot: {
              enabled: true,
              sent: true,
              reason: autoPilotDecision.reason,
              confidence: messageAnalysis?.confidence || "medium",
              questionType: messageAnalysis?.questionType || "general",
            },
          });
        }
      }

      // Use fallback email for Facebook leads that don't have an email
      const leadEmail = lead.email || (lead.source === 'facebook' 
        ? `facebook-${lead.externalId || lead.id}@facebook.local` 
        : `lead-${lead.id}@local`);

      // Create pending reply for review (co-pilot mode or auto-pilot blocked)
      console.log(`[AI Reply] [Manual Endpoint] 📝 Creating pending reply for lead ${leadId} (${lead.name})`);
      console.log(`[AI Reply] [Manual Endpoint] Pending reply details:`, {
        leadId: lead.id,
        leadName: lead.name,
        channel: incomingMessage.channel || 'email',
        incomingMessageId: incomingMessage.id,
        incomingMessageCreatedAt: incomingMessage.createdAt,
        aiReplyLength: aiReplyContent.length,
      });
      
      const pendingReply = await storage.createPendingReply({
        orgId: req.orgId,
        leadId: lead.id,
        leadName: lead.name,
        leadEmail: leadEmail,
        subject: `Re: Inquiry about ${lead.propertyName || 'our property'}`,
        content: aiReplyContent,
        originalMessage: incomingMessage.message,
        channel: incomingMessage.channel || 'email',
        status: 'pending',
        threadId: (incomingMessage as any).threadId,
        inReplyTo: incomingMessage.externalId,
        references: incomingMessage.externalId,
        metadata: {
          originalContent: aiReplyContent, // Store original AI-generated content
          editedByUser: false,
          sentViaAutoPilot: false,
          autoPilotBlocked: autoPilotMode && !shouldAutoSend,
          autoPilotReason: autoPilotDecision?.reason,
          confidenceLevel: messageAnalysis?.confidence,
          questionType: messageAnalysis?.questionType,
        } as any,
      });
      
      console.log(`[AI Reply] [Manual Endpoint] ✅ Created pending reply ID: ${pendingReply.id}`);
      console.log(`[AI Reply] [Manual Endpoint] ⚠️ WARNING: This pending reply was created even though auto-pilot may have already sent a message. Check logs above for why the check didn't block it.`);

      // Log AI draft creation
      const { logAIAction } = await import("./auditLogging");
      await logAIAction(req, {
        actionType: "ai_draft_created",
        leadId: lead.id,
        leadName: lead.name,
        pendingReplyId: pendingReply.id,
        channel: incomingMessage.channel || 'email',
      });

      res.status(201).json({ 
        message: "AI reply generated successfully",
        pendingReply 
      });
    } catch (error) {
      console.error("Error generating AI reply:", error);
      res.status(500).json({ error: "Failed to generate AI reply" });
    }
  });

  // Toggle AI for a lead
  app.patch("/api/leads/:leadId/ai-toggle", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const leadId = req.params.leadId;
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }
      
      const lead = await storage.getLead(leadId, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Update lead AI enabled status
      await storage.updateLead(leadId, { aiEnabled: enabled } as any, req.orgId);
      
      // Log AI toggle action
      const { logAIAction } = await import("./auditLogging");
      await logAIAction(req, {
        actionType: enabled ? "ai_enabled" : "ai_disabled",
        leadId: leadId,
        leadName: lead.name,
      });
      
      res.json({ 
        success: true, 
        aiEnabled: enabled,
        message: enabled ? "AI enabled for this lead" : "AI disabled for this lead"
      });
    } catch (error) {
      console.error("Error toggling AI for lead:", error);
      res.status(500).json({ error: "Failed to toggle AI for lead" });
    }
  });

  // ===== NOTE ROUTES =====
  app.get("/api/notes/:leadId", isAuthenticated, async (req, res) => {
    try {
      const notes = await storage.getNotesByLeadId(req.params.leadId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertNoteSchema.parse(req.body);
      const note = await storage.createNote(validatedData);
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid note data" });
    }
  });

  app.delete("/api/notes/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteNote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  // ===== PUBLIC ROUTES =====
  // Public endpoint to get launch date for countdown
  app.get("/api/launch-date", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { aiSettings } = await import("@shared/schema");
      const { eq, and, isNull } = await import("drizzle-orm");
      
      const result = await db.select()
        .from(aiSettings)
        .where(
          and(
            eq(aiSettings.category, 'landing_page'),
            eq(aiSettings.key, 'launch_date'),
            isNull(aiSettings.orgId)
          )
        )
        .limit(1);
      
      if (result.length > 0 && result[0].value) {
        try {
          const launchDate = new Date(result[0].value);
          // Validate the date
          if (isNaN(launchDate.getTime())) {
            throw new Error("Invalid date format");
          }
          res.json({ launchDate: launchDate.toISOString() });
        } catch (dateError) {
          console.error("[Launch Date] Invalid date format in database:", result[0].value);
          // Default to 1 month from now if date is invalid
          const defaultDate = new Date();
          defaultDate.setMonth(defaultDate.getMonth() + 1);
          res.json({ launchDate: defaultDate.toISOString() });
        }
      } else {
        // Default to 1 month from now if not set
        const defaultDate = new Date();
        defaultDate.setMonth(defaultDate.getMonth() + 1);
        res.json({ launchDate: defaultDate.toISOString() });
      }
    } catch (error) {
      console.error("[Launch Date] Error fetching launch date:", error);
      // Default to 1 month from now on error
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 1);
      res.json({ launchDate: defaultDate.toISOString() });
    }
  });

  app.get("/api/ai-settings/:category", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const settings = await storage.getAISettings(req.params.category, req.orgId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI settings" });
    }
  });

  app.post("/api/ai-settings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validatedData = insertAISettingSchema.parse(req.body);
      const setting = await storage.upsertAISetting({ ...validatedData, orgId: req.orgId });
      res.status(201).json(setting);
    } catch (error) {
      res.status(400).json({ error: "Invalid AI setting data" });
    }
  });

  // Auto Train AI - Generate training content from historical conversations
  app.post("/api/ai-training/auto-train", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const { propertyId, windowDays = 90, dryRun = false } = req.body;

      console.log(`[Auto Train API] Training request for org ${req.orgId}${propertyId ? `, property ${propertyId}` : ''}`);

      const { trainAI } = await import("./aiAutoTrain");
      const result = await trainAI(openai, req.orgId, {
        propertyId,
        windowDays,
        dryRun
      });

      res.json({
        success: true,
        styleProfile: result.styleProfile,
        intentPlaybook: result.intentPlaybook,
        messageCount: result.messageCount,
        saved: result.saved
      });
    } catch (error: any) {
      console.error('[Auto Train API] Error:', error);
      res.status(500).json({
        error: "Failed to train AI",
        message: error.message
      });
    }
  });

  // Legacy auto-train endpoint (keeping for backward compatibility)
  app.post("/api/ai-training/auto-train-legacy", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Get all leads for this organization
      const allLeads = await storage.getAllLeads(req.orgId);
      
      // Get conversations for all leads, ordered by lead and timestamp
      const allConversations: Array<{
        leadId: string;
        leadName: string;
        type: string;
        message: string;
        createdAt: string;
        channel: string;
      }> = [];
      
      for (const lead of allLeads) {
        const conversations = await storage.getConversationsByLeadId(lead.id, req.orgId);
        for (const conv of conversations) {
          allConversations.push({
            leadId: lead.id,
            leadName: lead.name || 'Unknown',
            type: conv.type,
            message: conv.message,
            createdAt: conv.createdAt,
            channel: conv.channel || 'email',
          });
        }
      }
      
      if (allConversations.length === 0) {
        return res.status(400).json({ 
          error: "No conversations found. You need at least some conversation history to train the AI." 
        });
      }
      
      // Group conversations by lead and order by timestamp
      const conversationsByLead = new Map<string, typeof allConversations>();
      for (const conv of allConversations) {
        if (!conversationsByLead.has(conv.leadId)) {
          conversationsByLead.set(conv.leadId, []);
        }
        conversationsByLead.get(conv.leadId)!.push(conv);
      }
      
      // Sort conversations within each lead by timestamp
      conversationsByLead.forEach((convs) => {
        convs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
      
      // Build conversation threads for analysis (limit to most recent 50 leads to avoid token limits)
      const leadIds = Array.from(conversationsByLead.keys()).slice(0, 50);
      const conversationThreads: string[] = [];
      
      for (const leadId of leadIds) {
        const convs = conversationsByLead.get(leadId)!;
        const leadName = convs[0]?.leadName || 'Lead';
        
        let thread = `\n=== Conversation with ${leadName} ===\n`;
        for (const conv of convs) {
          const sender = (conv.type === 'incoming' || conv.type === 'received') ? 'Lead' : 'You';
          thread += `${sender}: ${conv.message}\n`;
        }
        conversationThreads.push(thread);
      }
      
      const conversationsText = conversationThreads.join('\n');
      
      // Use OpenAI to analyze conversations and generate training content
      const trainingPrompt = `Analyze the following historical conversations between property managers/leasing agents and leads. Extract common patterns, questions leads ask, and how the property manager responds.

Your task is to create a CONCISE training content script (500-1000 words maximum) that will help an AI assistant learn:
1. Common questions/requests from leads (e.g., "Is this available?", "What's the rent?", "Can I schedule a tour?")
2. How the property manager typically responds to these questions (tone, style, information provided)
3. The personality and communication style of the property manager

CRITICAL: Keep responses SHORT and CONCISE. The property manager's responses should be 2-4 paragraphs maximum. Extract only the most important patterns.

Format the output as a structured training script with:
- Common lead questions/patterns (brief list, 5-10 examples max)
- Example responses that match the property manager's style (2-3 short examples, each 2-3 sentences)
- Communication guidelines based on the observed patterns (concise bullet points)

Conversations:
${conversationsText.substring(0, 15000)} ${conversationsText.length > 15000 ? '...(truncated)' : ''}

Generate a CONCISE training script (500-1000 words) that captures the key communication patterns, tone, and response style. Emphasize brevity - responses should be short and to the point.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: trainingPrompt }],
        temperature: 0.7,
        max_tokens: 1000, // Reduced to encourage more concise training content
      });
      
      const trainingContent = completion.choices[0].message.content || '';
      
      // Save the training content to ai_settings
      const trainingSetting = await storage.upsertAISetting({
        category: 'training',
        key: 'auto_training_content',
        value: trainingContent,
        orgId: req.orgId,
      });
      
      res.json({
        success: true,
        trainingContent,
        conversationsAnalyzed: allConversations.length,
        leadsAnalyzed: leadIds.length,
        setting: trainingSetting,
      });
    } catch (error: any) {
      console.error("[AI Training] Error generating training content:", error);
      res.status(500).json({ error: "Failed to generate training content", message: error.message });
    }
  });

  // ===== INTERACTIVE AI TRAINING ROUTES =====
  
  // Generate AI response for practice (interactive training)
  // Uses the SAME AI Leasing Agent logic as real lead replies
  app.post("/api/ai-training/practice", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const { leadMessage, conversationHistory = [], propertyId = null } = req.body;
      
      if (!leadMessage || !leadMessage.trim()) {
        return res.status(400).json({ error: "Lead message is required" });
      }

      // Get user information (same as real AI reply)
      const user = req.user;
      const userName = user?.name || user?.email?.split('@')[0] || 'Property Manager';
      const userEmail = user?.email || '';
      
      // Get organization information (same as real AI reply) - CRITICAL: Use req.orgId
      console.log(`[AI Training Practice] Using orgId: ${req.orgId} for practice session`);
      const organization = await storage.getOrganization(req.orgId);
      const orgName = organization?.name || 'Our Property Management';
      console.log(`[AI Training Practice] Organization: ${orgName} (orgId: ${req.orgId})`);

      // Detect if message is asking about available properties
      const messageLower = leadMessage.toLowerCase();
      const isAskingAboutAvailableProperties = 
        messageLower.includes('other properties') ||
        messageLower.includes('other property') ||
        messageLower.includes('any other') ||
        messageLower.includes('what properties') ||
        messageLower.includes('which properties') ||
        messageLower.includes('available properties') ||
        messageLower.includes('available property') ||
        messageLower.includes('what listings') ||
        messageLower.includes('which listings') ||
        messageLower.includes('other listings') ||
        messageLower.includes('more properties') ||
        messageLower.includes('more property') ||
        messageLower.includes('do you have') && (messageLower.includes('property') || messageLower.includes('listing'));

      // Detect if message is asking about tours/showings
      const isShowingRequest = 
        messageLower.includes('tour') ||
        messageLower.includes('showing') ||
        messageLower.includes('viewing') ||
        messageLower.includes('visit') ||
        messageLower.includes('see the property') ||
        messageLower.includes('schedule') ||
        messageLower.includes('available time') ||
        messageLower.includes('opening') ||
        messageLower.includes('when can') ||
        messageLower.includes('what time');

      // Get property details - detect property mentions in message if propertyId not provided
      let property = null;
      let propertyUnits: any[] = [];
      let allPropertiesWithUnits: any[] = [];
      let suggestedTimeSlots: any[] = [];
      let bookingLink = '';
      
      // Helper function to normalize addresses (same as in aiReplyGenerator)
      const normalizeAddress = (address: string): string => {
        if (!address) return '';
        let normalized = address.toLowerCase().trim();
        const abbreviations: Record<string, string> = {
          '\\bst\\b': 'street',
          '\\bave\\b': 'avenue',
          '\\brd\\b': 'road',
          '\\bdr\\b': 'drive',
          '\\bln\\b': 'lane',
          '\\bblvd\\b': 'boulevard',
          '\\bct\\b': 'court',
          '\\bpl\\b': 'place',
        };
        for (const [abbrev, full] of Object.entries(abbreviations)) {
          normalized = normalized.replace(new RegExp(abbrev, 'gi'), full);
        }
        normalized = normalized.replace(/[.,;:!?]/g, '').replace(/\s+/g, ' ').trim();
        return normalized;
      };
      
      // Detect property mention in message if propertyId not provided
      // Skip detection for slot selection ("1", "2", "3. 2026-02-02 at 09:15", etc.) - these are not property addresses
      let detectedPropertyId = propertyId;
      const trimmedMsg = String(leadMessage || '').trim();
      const isSlotSelectionOnly = /^[1-4]\s*$/i.test(trimmedMsg) || /^[1-4][.)\s\-].*at\s+\d{1,2}:\d{2}/i.test(trimmedMsg) || /^\d{4}-\d{2}-\d{2}\s+at\s+\d{1,2}:\d{2}/.test(trimmedMsg);
      if (!propertyId && leadMessage && !isSlotSelectionOnly) {
        const patterns = [
          /(?:is|are|this|that)\s+([A-Z0-9][^?.,!]*?)(?:\s+available|\?|$)/i,
          /(?:for|at|about|of)\s+([A-Z0-9][^?.,!]*?)(?:\s+available|\?|\.|,|!|$)/i,
          /([0-9]+\s+[A-Z][^?.,!]*?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl))(?:\s+available|\?|\.|,|!|$)/i,
          /^([0-9]{2,})(?:\s+available|\?|$)/i,  // Require 2+ digits to avoid matching "1", "2", "3", "4" (slot selections)
        ];
        
        let propertyMention: string | null = null;
        for (const pattern of patterns) {
          const match = leadMessage.match(pattern);
          if (match) {
            propertyMention = match[1].trim();
            break;
          }
        }
        
        if (propertyMention) {
          const allProperties = await storage.getAllProperties(req.orgId);
          const normalizedMention = normalizeAddress(propertyMention);
          const matchedProperty = allProperties.find((p: any) => {
            const propAddress = (p.address || '').toLowerCase();
            const normalizedPropAddress = normalizeAddress(propAddress);
            return normalizedPropAddress.includes(normalizedMention) ||
                   normalizedMention.includes(normalizedPropAddress) ||
                   (normalizedMention.match(/^\d+/) && normalizedPropAddress.match(new RegExp(normalizedMention.replace(/\s+/g, '.*'), 'i')));
          });
          
          if (matchedProperty) {
            detectedPropertyId = matchedProperty.id;
            console.log('[AI Training] Detected property mention:', propertyMention, '→', matchedProperty.name || matchedProperty.address);
          }
        }
      }
      
      if (isAskingAboutAvailableProperties) {
        // Fetch ALL properties with listed units when asking about available properties
        console.log('[AI Training] Message asks about available properties - fetching all properties with units');
        allPropertiesWithUnits = await storage.getPropertiesWithListedUnits(req.orgId, { includeAll: false });
        // Filter to only properties with listed/available units WITH booking enabled
        allPropertiesWithUnits = allPropertiesWithUnits
          .map(prop => ({
            ...prop,
            listedUnits: prop.listedUnits.filter((unit: any) => 
              unit.isListed && 
              unit.status === 'not_occupied' && 
              unit.bookingEnabled === true
            )
          }))
          .filter(prop => prop.listedUnits.length > 0);
        console.log(`[AI Training] Found ${allPropertiesWithUnits.length} properties with available units (listed + available + booking enabled)`);
      } else if (detectedPropertyId) {
        property = await storage.getProperty(detectedPropertyId, req.orgId);
        if (property) {
          propertyUnits = await storage.getAllUnitsByProperty(property.id, req.orgId);
          propertyUnits = propertyUnits.filter(unit => 
            unit.isListed && 
            unit.status === 'not_occupied' && 
            unit.bookingEnabled === true
          );
          
          // Generate booking link (env-appropriate: localhost in dev, canonical in prod)
          const baseUrl = getBaseUrlForBookingLink();
          bookingLink = `${baseUrl}/book-showing/property/${property.id}`;
          
          // Generate time slots if this is a showing request
          if (isShowingRequest && property) {
            try {
              const { suggestTimeSlots } = await import("./ai-scheduling");
              
              // Get property scheduling settings
              const propertySettings = await storage.getPropertySchedulingSettings(property.id, req.orgId);
              
              // Get unit scheduling settings if we have a specific unit
              let unitSettings = null;
              let unitIdForSlots: string | undefined = undefined;
              if (propertyUnits.length > 0) {
                const firstBookableUnit = propertyUnits.find((u: any) => u.bookingEnabled === true);
                if (firstBookableUnit) {
                  unitIdForSlots = firstBookableUnit.id;
                  unitSettings = await storage.getUnitSchedulingSettings(firstBookableUnit.id, req.orgId);
                }
              }
              
              // Merge settings
              const effectiveSettings = unitSettings ? {
                ...propertySettings,
                assignedMembers: unitSettings.customAssignedMembers || propertySettings?.assignedMembers,
                eventDuration: unitSettings.customEventDuration ?? propertySettings?.eventDuration,
                bufferTime: unitSettings.customBufferTime ?? propertySettings?.bufferTime,
                leadTime: unitSettings.customLeadTime ?? propertySettings?.leadTime,
              } : propertySettings;
              
              // Check booking configuration for logging
              const isBookingEnabled = unitSettings?.bookingEnabled ?? propertySettings?.bookingEnabled ?? false;
              const assignedMembers = effectiveSettings?.assignedMembers || [];
              const hasAssignedMembers = Array.isArray(assignedMembers) && assignedMembers.length > 0;
              
              console.log('[AI Training] Booking availability check:', {
                isBookingEnabled,
                hasAssignedMembers,
                assignedMembersCount: assignedMembers.length,
              });
              
              // Always try to generate time slots - let suggestTimeSlots determine actual availability
              // This ensures we check real member availability even if settings aren't perfectly configured
              // Get all showings for next 7 days
              const startDate = new Date().toISOString().split('T')[0];
              const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              const allShowings = await storage.getShowingsByDateRange(startDate, endDate, req.orgId);
              
              // Get schedule preferences - if assigned members exist, filter to them; otherwise use all
              let schedulePrefs = await storage.getSchedulePreferences();
              if (assignedMembers.length > 0) {
                const assignedMemberIds = assignedMembers.map((m: any) => 
                  typeof m === 'string' ? m : (m?.userId || m)
                ).filter(Boolean);
                schedulePrefs = schedulePrefs.filter(pref => assignedMemberIds.includes(pref.userId));
                console.log('[AI Training] Filtered schedule preferences to assigned members:', assignedMemberIds.length, "members");
              } else {
                // If no assigned members specified, use all schedule preferences (property might have general availability)
                console.log('[AI Training] No assigned members specified, using all schedule preferences');
              }
              
              // Get all properties for route optimization
              const allPropertiesArray = await storage.getAllProperties(req.orgId);
              const allPropertiesMap = new Map(allPropertiesArray.map(p => [p.id, p]));
              
              // Get suggestions for next 7 days
              const allSuggestions: any[] = [];
              for (let daysAhead = 0; daysAhead < 7; daysAhead++) {
                const targetDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
                const dateStr = targetDate.toISOString().split('T')[0];
                
                const daySuggestions = suggestTimeSlots(
                  dateStr,
                  property,
                  allShowings,
                  schedulePrefs,
                  allPropertiesMap,
                  effectiveSettings as any,
                  unitIdForSlots
                );
                
                allSuggestions.push(...daySuggestions);
              }
              
              // Only include slots with actual availability
              suggestedTimeSlots = allSuggestions
                .filter(slot => slot.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);
              
              console.log('[AI Training] Generated time slots:', {
                timeSlotsCount: suggestedTimeSlots.length,
                isBookingEnabled,
                hasAssignedMembers,
                totalSuggestionsBeforeFilter: allSuggestions.length,
                schedulePrefsCount: schedulePrefs.length
              });
              
              // If no time slots were generated, log why
              if (suggestedTimeSlots.length === 0) {
                console.log('[AI Training] ⚠️ No available time slots generated - this could be due to:');
                console.log('  - No schedule preferences configured');
                console.log('  - All assigned members are fully booked');
                console.log('  - Booking not enabled at property/unit level');
                console.log('  - No available time windows in the next 7 days');
              }
            } catch (schedulingError: any) {
              console.error('[AI Training] Failed to generate time slots:', schedulingError.message);
            }
          }
        }
      }

      // Get or create a practice lead so in-chat booking flow can create real bookings during practice
      let practiceLead = null;
      const existingLeads = await storage.getLeadsByStatus('new', req.orgId);
      practiceLead = existingLeads.find((l: any) => l.source === 'ai_training_practice');
      if (!practiceLead) {
        practiceLead = await storage.createLead({
          orgId: req.orgId,
          name: 'Practice Lead',
          source: 'ai_training_practice',
          status: 'new',
        });
      }

      // Get personality settings
      const personalitySettingsPractice = await storage.getAISettings('personality', req.orgId);
      
      // Use V2 AI reply generator (RAG + Tools + Structured Outputs)
      const structuredResponse = await generateAIReplyV2(openai, {
        orgId: req.orgId,
        leadMessage,
        leadId: practiceLead?.id,
        lead: practiceLead ? {
          id: practiceLead.id,
          name: practiceLead.name,
          email: practiceLead.email,
          phone: practiceLead.phone,
          propertyId: detectedPropertyId || practiceLead.propertyId,
        } : undefined,
        conversations: conversationHistory.map((msg: any) => ({
          type: msg.role === 'lead' ? 'incoming' : 'outgoing',
          message: msg.message,
          createdAt: msg.createdAt || new Date().toISOString(),
          channel: 'email'
        })),
        isPracticeMode: true,
        personalitySettings: {
          friendliness: personalitySettingsPractice.find(s => s.key === 'friendliness')?.value,
          formality: personalitySettingsPractice.find(s => s.key === 'formality')?.value,
          responseLength: personalitySettingsPractice.find(s => s.key === 'response_length')?.value,
          urgency: personalitySettingsPractice.find(s => s.key === 'urgency')?.value,
          warmth: personalitySettingsPractice.find(s => s.key === 'warmth')?.value,
          communicationStyle: personalitySettingsPractice.find(s => s.key === 'communication_style')?.value,
        }
      });

      res.json({
        success: true,
        response: structuredResponse.answer,
        metadata: {
          confidence: structuredResponse.confidence,
          needsHuman: structuredResponse.needsHuman,
          sources: structuredResponse.sources,
          toolResults: structuredResponse.toolResults
        }
      });
    } catch (error: any) {
      console.error("[AI Training] Error generating practice response:", error);
      res.status(500).json({ error: "Failed to generate AI response", message: error.message });
    }
  });

  // Save a correction
  app.post("/api/ai-training/correction", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { aiMessageId, originalMessage, correctedMessage, leadMessage } = req.body;

      // CRITICAL: Ensure corrections are saved to the current organization only
      console.log(`[AI Training] Received correction request for orgId: ${req.orgId}`, {
        orgId: req.orgId,
        hasOriginalMessage: !!originalMessage,
        hasCorrectedMessage: !!correctedMessage,
        hasLeadMessage: !!leadMessage,
        leadMessageLength: leadMessage?.length || 0,
      });

      if (!originalMessage || !correctedMessage) {
        return res.status(400).json({ error: "Missing required fields: originalMessage and correctedMessage are required" });
      }
      
      // leadMessage is optional, use a default if not provided
      const finalLeadMessage = leadMessage?.trim() || 'Practice message';

      // Get existing corrections
      const correctionsSettings = await storage.getAISettings('training_corrections', req.orgId);
      const existingCorrectionsData = correctionsSettings.find(s => s.key === 'corrections')?.value;
      
      let corrections: Array<{
        id: string;
        leadMessage: string;
        originalMessage: string;
        correctedMessage: string;
        createdAt: string;
      }> = [];

      if (existingCorrectionsData) {
        try {
          corrections = JSON.parse(existingCorrectionsData);
          console.log(`[AI Training] Loaded ${corrections.length} existing corrections`);
        } catch (e) {
          console.error('[AI Training] Error parsing existing corrections:', e);
        }
      }

      // Add new correction
      const newCorrection = {
        id: `correction-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        leadMessage: finalLeadMessage,
        originalMessage: originalMessage.trim(),
        correctedMessage: correctedMessage.trim(),
        createdAt: new Date().toISOString(),
      };

      corrections.push(newCorrection);

      // Limit to last 100 corrections to avoid storage issues
      if (corrections.length > 100) {
        corrections = corrections.slice(-100);
      }

      // Save corrections
      console.log(`[AI Training] Saving correction for orgId: ${req.orgId}`);
      console.log(`[AI Training] Total corrections to save: ${corrections.length}`);
      console.log(`[AI Training] New correction:`, newCorrection);
      
      const setting = await storage.upsertAISetting({
        category: 'training_corrections',
        key: 'corrections',
        value: JSON.stringify(corrections),
        orgId: req.orgId,
      });

      console.log(`[AI Training] ✅ Correction saved successfully. Setting ID: ${setting.id}`);
      console.log(`[AI Training] Setting value length: ${setting.value.length} characters`);

      res.json({
        success: true,
        correction: newCorrection,
        totalCorrections: corrections.length,
        setting,
      });
    } catch (error: any) {
      console.error("[AI Training] ❌ Error saving correction:", error);
      console.error("[AI Training] Error stack:", error.stack);
      res.status(500).json({ error: "Failed to save correction", message: error.message });
    }
  });

  // Get all corrections
  app.get("/api/ai-training/corrections", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // CRITICAL: Ensure corrections are scoped to the current organization
      console.log(`[AI Training] Fetching corrections for orgId: ${req.orgId}`);
      const correctionsSettings = await storage.getAISettings('training_corrections', req.orgId);
      const correctionsData = correctionsSettings.find(s => s.key === 'corrections')?.value;
      
      let corrections: any[] = [];
      if (correctionsData) {
        try {
          corrections = JSON.parse(correctionsData);
          console.log(`[AI Training] Loaded ${corrections.length} corrections for orgId: ${req.orgId}`);
        } catch (e) {
          console.error('[AI Training] Error parsing corrections:', e);
        }
      } else {
        console.log(`[AI Training] No corrections found for orgId: ${req.orgId}`);
      }

      res.json(corrections);
    } catch (error: any) {
      console.error("[AI Training] Error fetching corrections:", error);
      res.status(500).json({ error: "Failed to fetch corrections", message: error.message });
    }
  });

  // ===== AUTO-PILOT ROUTES =====

  // Parse array setting: supports both JSON arrays and comma-separated strings (as saved by AIAgentSettings)
  const parseArraySetting = (value: string | undefined, defaultVal: string[]): string[] => {
    if (!value || typeof value !== "string") return defaultVal;
    const trimmed = value.trim();
    if (!trimmed) return defaultVal;
    if (trimmed.startsWith("[")) {
      try { return JSON.parse(trimmed); } catch { return trimmed.split(",").map(s => s.trim()).filter(Boolean); }
    }
    return trimmed.split(",").map(s => s.trim()).filter(Boolean);
  };

  // Get auto-pilot status
  app.get("/api/ai-autopilot/status", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const autoPilotSettings = await storage.getAISettings("automation", req.orgId);
      const autoPilotMode = autoPilotSettings.find(s => s.key === "auto_pilot_mode")?.value === "true";
      
      res.json({
        enabled: autoPilotMode,
        settings: {
          businessHoursOnly: autoPilotSettings.find(s => s.key === "auto_pilot_business_hours_enabled")?.value === "true",
          businessHoursStart: autoPilotSettings.find(s => s.key === "auto_pilot_business_hours_start")?.value || "09:00",
          businessHoursEnd: autoPilotSettings.find(s => s.key === "auto_pilot_business_hours_end")?.value || "17:00",
          businessDays: parseArraySetting(
            autoPilotSettings.find(s => s.key === "auto_pilot_business_days")?.value,
            ["monday", "tuesday", "wednesday", "thursday", "friday"]
          ),
          allowedQuestionTypes: parseArraySetting(
            autoPilotSettings.find(s => s.key === "auto_pilot_question_types")?.value,
            ["availability", "pricing", "general"]
          ),
          minConfidenceLevel: autoPilotSettings.find(s => s.key === "auto_pilot_min_confidence")?.value || "high",
        }
      });
    } catch (error: any) {
      console.error("[Auto-Pilot] Error fetching status:", error);
      res.status(500).json({ error: "Failed to fetch auto-pilot status", message: error.message });
    }
  });

  // Toggle auto-pilot on/off
  app.post("/api/ai-autopilot/toggle", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { enabled } = req.body;
      await storage.upsertAISetting({
        category: "automation",
        key: "auto_pilot_mode",
        value: enabled ? "true" : "false",
        orgId: req.orgId,
      });
      
      res.json({ enabled, message: `Auto-pilot ${enabled ? 'enabled' : 'disabled'}` });
    } catch (error: any) {
      console.error("[Auto-Pilot] Error toggling:", error);
      res.status(500).json({ error: "Failed to toggle auto-pilot", message: error.message });
    }
  });

  // Get unreplied leads (leads with incoming messages that haven't been replied to)
  app.get("/api/ai-autopilot/unreplied-leads", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const result = await db.execute(sql`
        WITH latest_incoming AS (
          SELECT DISTINCT ON (c.lead_id)
            c.lead_id,
            c.id as conversation_id,
            c.message,
            c.created_at,
            c.channel,
            c.external_id
          FROM conversations c
          INNER JOIN leads l ON c.lead_id = l.id
          WHERE l.org_id = ${req.orgId}
            AND (c.type = 'received' OR c.type = 'incoming')
          ORDER BY c.lead_id, c.created_at DESC
        ),
        latest_outgoing AS (
          SELECT DISTINCT ON (c.lead_id)
            c.lead_id,
            c.created_at
          FROM conversations c
          INNER JOIN leads l ON c.lead_id = l.id
          WHERE l.org_id = ${req.orgId}
            AND (c.type = 'outgoing' OR c.type = 'sent')
          ORDER BY c.lead_id, c.created_at DESC
        )
        SELECT 
          l.*,
          li.conversation_id,
          li.message as last_incoming_message,
          li.created_at as last_incoming_at,
          li.channel,
          li.external_id,
          CASE 
            WHEN lo.created_at IS NULL THEN true
            WHEN li.created_at > lo.created_at THEN true
            ELSE false
          END as needs_reply
        FROM leads l
        INNER JOIN latest_incoming li ON l.id = li.lead_id
        LEFT JOIN latest_outgoing lo ON l.id = lo.lead_id
        WHERE l.org_id = ${req.orgId}
          AND (lo.created_at IS NULL OR li.created_at > lo.created_at)
          AND (l.ai_enabled IS NULL OR l.ai_enabled = true)
        ORDER BY li.created_at DESC
        LIMIT 50
      `);
      
      const leads = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        source: row.source,
        propertyId: row.property_id,
        propertyName: row.property_name,
        lastIncomingMessage: row.last_incoming_message,
        lastIncomingAt: row.last_incoming_at,
        channel: row.channel,
        conversationId: row.conversation_id,
        externalId: row.external_id,
        metadata: row.metadata,
      }));
      
      res.json(leads);
    } catch (error: any) {
      console.error("[Auto-Pilot] Error fetching unreplied leads:", error);
      res.status(500).json({ error: "Failed to fetch unreplied leads", message: error.message });
    }
  });

  // Process one unreplied lead (generate and send AI reply)
  app.post("/api/ai-autopilot/process-lead/:leadId", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const leadId = req.params.leadId;
      
      // Get lead details
      const lead = await storage.getLead(leadId, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      // Check if AI is enabled for this lead
      if (lead.aiEnabled === false) {
        return res.status(403).json({ 
          error: "AI is disabled for this lead",
          aiEnabled: false 
        });
      }

      // Get conversations for this lead
      const conversations = await storage.getConversationsByLeadId(leadId, req.orgId);
      
      // Find the most recent incoming message
      const incomingMessage = conversations
        .filter((c: any) => c.type === 'incoming' || c.type === 'received')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      if (!incomingMessage) {
        return res.status(400).json({ error: "No incoming message to reply to" });
      }

      // Get user and organization information
      const user = req.user;
      const userName = user?.name || user?.email?.split('@')[0] || 'Property Manager';
      const userEmail = user?.email || '';
      const organization = await storage.getOrganization(req.orgId);
      const orgName = organization?.name || 'Our Property Management';

      // Get property details if lead has one
      let property = null;
      let propertyUnits: any[] = [];
      let allPropertiesWithUnits: any[] = [];
      
      const messageLower = incomingMessage.message.toLowerCase();
      const isAskingAboutAvailableProperties = 
        messageLower.includes('other properties') ||
        messageLower.includes('other property') ||
        messageLower.includes('any other') ||
        messageLower.includes('what properties') ||
        messageLower.includes('which properties') ||
        messageLower.includes('available properties') ||
        messageLower.includes('available property') ||
        messageLower.includes('what listings') ||
        messageLower.includes('which listings') ||
        messageLower.includes('other listings') ||
        messageLower.includes('more properties') ||
        messageLower.includes('more property') ||
        messageLower.includes('do you have') && (messageLower.includes('property') || messageLower.includes('listing'));

      if (isAskingAboutAvailableProperties) {
        allPropertiesWithUnits = await storage.getPropertiesWithListedUnits(req.orgId, { includeAll: false });
        allPropertiesWithUnits = allPropertiesWithUnits
          .map(prop => ({
            ...prop,
            listedUnits: prop.listedUnits.filter((unit: any) => unit.isListed && unit.status === 'not_occupied')
          }))
          .filter(prop => prop.listedUnits.length > 0);
      } else if (lead.propertyId) {
        property = await storage.getProperty(lead.propertyId, req.orgId);
        if (property) {
          propertyUnits = await storage.getAllUnitsByProperty(property.id, req.orgId);
          propertyUnits = propertyUnits.filter(unit => 
            unit.isListed && 
            unit.status === 'not_occupied' && 
            unit.bookingEnabled === true
          );
        }
      }

      // Get lead notes
      const leadNotes = await storage.getNotesByLeadId(leadId);

      // Get personality settings
      const personalitySettingsAutoPilot = await storage.getAISettings('personality', req.orgId);
      
      // Use V2 AI reply generator (RAG + Tools + Structured Outputs)
      const structuredResponse = await generateAIReplyV2(openai, {
        orgId: req.orgId,
        leadMessage: incomingMessage.message,
        leadId: lead.id,
        lead: {
          id: lead.id,
          name: lead.name,
          propertyId: lead.propertyId,
          propertyName: lead.propertyName,
          source: lead.source,
          status: lead.status,
        },
        conversations,
        isPracticeMode: false,
        personalitySettings: {
          friendliness: personalitySettingsAutoPilot.find(s => s.key === 'friendliness')?.value,
          formality: personalitySettingsAutoPilot.find(s => s.key === 'formality')?.value,
          responseLength: personalitySettingsAutoPilot.find(s => s.key === 'response_length')?.value,
          urgency: personalitySettingsAutoPilot.find(s => s.key === 'urgency')?.value,
          warmth: personalitySettingsAutoPilot.find(s => s.key === 'warmth')?.value,
          communicationStyle: personalitySettingsAutoPilot.find(s => s.key === 'communication_style')?.value,
        }
      });
      
      const aiReplyContent = structuredResponse.answer;
      
      // Log structured response metadata
      console.log('[Auto-Pilot] V2 Response:', {
        confidence: structuredResponse.confidence,
        needsHuman: structuredResponse.needsHuman,
        sourcesCount: structuredResponse.sources.length,
        toolResultsCount: structuredResponse.toolResults?.length || 0
      });

      // Send the reply based on channel
      console.log(`[Auto-Pilot] [Process Lead] Starting message send for lead ${leadId} (${lead.name}), channel: ${incomingMessage.channel || 'email'}`);
      let sent = false;
      let conversation: any = null;

      if (incomingMessage.channel === 'facebook') {
        // For Facebook, create message as pending - timed job will send it
        console.log(`[Auto-Pilot] [Process Lead] Creating Facebook message as pending (timed job will send it)...`);
        conversation = await storage.createConversation({
          leadId: lead.id,
          type: 'outgoing',
          channel: 'facebook',
          message: aiReplyContent,
          aiGenerated: true,
          sourceIntegration: 'facebook',
          deliveryStatus: 'pending',
        });
        console.log(`[Auto-Pilot] [Process Lead] ✅ Created conversation ID: ${conversation.id} with deliveryStatus: 'pending'`);
        
        // Mark as sent for activity log purposes (message will be sent by timed job)
        sent = true;
      } else if (incomingMessage.channel === 'email' || !incomingMessage.channel) {
        // For email, try to send via Gmail or Outlook
        console.log(`[Auto-Pilot] [Process Lead] Attempting to send email message...`);
        const gmailConfig = await storage.getIntegrationConfig("gmail", req.orgId);
        const outlookConfig = await storage.getIntegrationConfig("outlook", req.orgId);
        
        const gmailTokens = gmailConfig?.config as any;
        const outlookTokens = outlookConfig?.config as any;
        
        if (gmailTokens?.access_token && lead.email) {
          console.log(`[Auto-Pilot] [Process Lead] Sending via Gmail...`);
          const { sendReply } = await import("./gmail");
          await sendReply(gmailTokens, {
            to: lead.email,
            subject: `Re: Inquiry about ${lead.propertyName || 'our property'}`,
            body: aiReplyContent,
            threadId: (incomingMessage as any).threadId || undefined,
            inReplyTo: incomingMessage.externalId || undefined,
            references: incomingMessage.externalId || undefined,
          });
          sent = true;
          console.log(`[Auto-Pilot] [Process Lead] ✅ Gmail message sent successfully`);
        } else if (outlookTokens?.access_token && lead.email) {
          console.log(`[Auto-Pilot] [Process Lead] Sending via Outlook...`);
          const { sendOutlookEmail } = await import("./outlook");
          await sendOutlookEmail(outlookTokens.access_token, {
            to: lead.email,
            subject: `Re: Inquiry about ${lead.propertyName || 'our property'}`,
            body: aiReplyContent,
            inReplyTo: incomingMessage.externalId || undefined,
            references: incomingMessage.externalId || undefined,
          });
          sent = true;
          console.log(`[Auto-Pilot] [Process Lead] ✅ Outlook message sent successfully`);
        } else {
          console.warn(`[Auto-Pilot] [Process Lead] ⚠️ Cannot send email: missing access token or lead email`);
        }

        if (sent) {
          // Record conversation - NO pending reply creation for auto-pilot
          console.log(`[Auto-Pilot] [Process Lead] ✅ Email sent successfully - creating conversation with deliveryStatus: 'sent'`);
          conversation = await storage.createConversation({
            leadId: lead.id,
            type: 'outgoing',
            channel: 'email',
            message: aiReplyContent,
            aiGenerated: true,
            deliveryStatus: 'sent',
          });
          console.log(`[Auto-Pilot] [Process Lead] ✅ Created conversation ID: ${conversation.id} with deliveryStatus: 'sent'`);
        }
      }

      // For non-Facebook channels, if sending failed, create a pending reply for manual review
      // Facebook messages are always created as pending and will be sent by the timed job
      if (!sent && incomingMessage.channel !== 'facebook') {
        // If we couldn't send, still create the conversation and pending reply for manual review
        console.log(`[Auto-Pilot] [Process Lead] ⚠️ Message send FAILED - creating conversation and pending reply for manual review`);
        conversation = await storage.createConversation({
          leadId: lead.id,
          type: 'outgoing',
          channel: incomingMessage.channel || 'email',
          message: aiReplyContent,
          aiGenerated: true,
        });

        const leadEmail = lead.email || (lead.source === 'facebook' 
          ? `facebook-${lead.externalId || lead.id}@facebook.local` 
          : `lead-${lead.id}@local`);
        
        console.log(`[Auto-Pilot] [Process Lead] 📝 Creating pending reply because send failed (conversation ID: ${conversation.id})`);
        const pendingReply = await storage.createPendingReply({
          orgId: req.orgId,
          leadId: lead.id,
          leadName: lead.name,
          leadEmail: leadEmail,
          subject: `Re: Inquiry about ${lead.propertyName || 'our property'}`,
          content: aiReplyContent,
          originalMessage: incomingMessage.message,
          channel: incomingMessage.channel || 'email',
          status: 'pending',
          metadata: {
            sentViaAutoPilot: true,
            conversationId: conversation.id,
            sendFailed: true,
          } as any,
        });
        console.log(`[Auto-Pilot] [Process Lead] ✅ Created pending reply ID: ${pendingReply.id} (send failed)`);
      } else {
        const statusMessage = incomingMessage.channel === 'facebook' 
          ? 'Message queued as pending (will be sent by timed job)' 
          : 'Message sent successfully';
        console.log(`[Auto-Pilot] [Process Lead] ✅ ${statusMessage} - NO pending reply created (conversation ID: ${conversation?.id})`);
      }

      // Save activity log to database (this endpoint is always auto-pilot)
      // Gracefully handle if table doesn't exist yet
      try {
        await storage.createAutopilotActivityLog(req.orgId, {
          leadId: lead.id,
          leadName: lead.name,
          leadMessage: incomingMessage.message,
          aiReply: aiReplyContent,
          sent,
          channel: incomingMessage.channel || 'email',
          conversationId: conversation?.id || undefined,
          metadata: {
            sentViaAutoPilot: true,
            sendFailed: !sent && incomingMessage.channel !== 'facebook', // Facebook messages are queued, not failed
          } as any,
        });
      } catch (logError: any) {
        // Don't fail the request if activity log save fails
        console.warn("[Auto-Pilot] Failed to save activity log (non-critical):", logError.message);
      }

      res.json({
        success: true,
        leadId: lead.id,
        leadName: lead.name,
        leadMessage: incomingMessage.message,
        aiReply: aiReplyContent,
        sent,
        channel: incomingMessage.channel || 'email',
        conversationId: conversation?.id,
      });
    } catch (error: any) {
      console.error("[Auto-Pilot] Error processing lead:", error);
      res.status(500).json({ error: "Failed to process lead", message: error.message });
    }
  });

  // Get auto-pilot activity logs
  app.get("/api/ai-autopilot/activity-logs", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAutopilotActivityLogs(req.orgId, limit);
      res.json(logs);
    } catch (error: any) {
      // Gracefully handle if table doesn't exist yet
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        console.warn("[Auto-Pilot] autopilot_activity_logs table does not exist yet, returning empty array");
        return res.json([]);
      }
      console.error("[Auto-Pilot] Error fetching activity logs:", error);
      res.status(500).json({ error: "Failed to fetch activity logs", message: error.message });
    }
  });

  // Get auto-pilot metrics/KPIs
  app.get("/api/ai-autopilot/metrics", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // Get all activity logs for this org
      const allLogs = await storage.getAutopilotActivityLogs(req.orgId, 10000); // Get a large number to calculate metrics
      
      console.log(`[Auto-Pilot Metrics] Fetched ${allLogs.length} activity logs for org ${req.orgId}`);
      
      // Filter to only sent messages
      const sentLogs = allLogs.filter(log => log.sent === true);
      const failedLogs = allLogs.filter(log => log.sent === false);
      
      console.log(`[Auto-Pilot Metrics] Found ${sentLogs.length} sent messages, ${failedLogs.length} failed messages`);
      
      // Log breakdown by channel for debugging
      const sentByChannel = sentLogs.reduce((acc: any, log) => {
        acc[log.channel] = (acc[log.channel] || 0) + 1;
        return acc;
      }, {});
      const failedByChannel = failedLogs.reduce((acc: any, log) => {
        acc[log.channel] = (acc[log.channel] || 0) + 1;
        return acc;
      }, {});
      
      console.log(`[Auto-Pilot Metrics] Sent by channel:`, sentByChannel);
      console.log(`[Auto-Pilot Metrics] Failed by channel:`, failedByChannel);
      
      // Calculate total messages sent
      const totalMessagesSent = sentLogs.length;
      
      // Calculate messages sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const messagesSentToday = sentLogs.filter(log => {
        const logDate = new Date(log.createdAt);
        logDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === today.getTime();
      }).length;
      
      console.log(`[Auto-Pilot Metrics] Messages sent today: ${messagesSentToday}`);
      
      // Calculate average response time (time from lead message to AI reply)
      // We need to get the conversation timestamps for this
      let totalResponseTime = 0;
      let responseTimeCount = 0;
      
      for (const log of sentLogs.slice(0, 100)) { // Limit to last 100 for performance
        try {
          // Get conversations for this lead to find the incoming message timestamp
          const conversations = await storage.getConversationsByLeadId(log.leadId, req.orgId);
          
          // Find the incoming message that matches this log's lead message
          const incomingMessage = conversations
            .filter((c: any) => (c.type === 'incoming' || c.type === 'received') && c.message === log.leadMessage)
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          
          if (incomingMessage && log.createdAt) {
            const messageTime = new Date(incomingMessage.createdAt).getTime();
            const replyTime = new Date(log.createdAt).getTime();
            const responseTime = replyTime - messageTime; // milliseconds
            
            if (responseTime > 0 && responseTime < 7 * 24 * 60 * 60 * 1000) { // Valid response time (less than 7 days)
              totalResponseTime += responseTime;
              responseTimeCount++;
            }
          }
        } catch (err) {
          // Skip if we can't get conversations for this lead
          continue;
        }
      }
      
      const avgResponseTimeMinutes = responseTimeCount > 0 
        ? Math.round(totalResponseTime / responseTimeCount / (1000 * 60)) 
        : 0;
      
      // Calculate average inquiry to tour time
      // Get all leads that have both an inquiry and a scheduled tour
      let totalInquiryToTourTime = 0;
      let inquiryToTourCount = 0;
      
      try {
        const allLeads = await storage.getAllLeads(req.orgId);
        
        for (const lead of allLeads.slice(0, 100)) { // Limit to last 100 for performance
          try {
            // Get first conversation (inquiry)
            const conversations = await storage.getConversationsByLeadId(lead.id, req.orgId);
            const firstInquiry = conversations
              .filter((c: any) => c.type === 'incoming' || c.type === 'received')
              .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
            
            if (firstInquiry) {
              // Get first scheduled showing for this lead
              const showings = await storage.getShowingsByLead(lead.id, req.orgId);
              const firstScheduledShowing = showings
                .filter((s: any) => s.status === 'scheduled' || s.status === 'confirmed')
                .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
              
              if (firstScheduledShowing && firstScheduledShowing.scheduledDate) {
                const inquiryTime = new Date(firstInquiry.createdAt).getTime();
                const showingDate = new Date(firstScheduledShowing.scheduledDate).getTime();
                const inquiryToTourTime = showingDate - inquiryTime; // milliseconds
                
                if (inquiryToTourTime > 0 && inquiryToTourTime < 90 * 24 * 60 * 60 * 1000) { // Valid time (less than 90 days)
                  totalInquiryToTourTime += inquiryToTourTime;
                  inquiryToTourCount++;
                }
              }
            }
          } catch (err) {
            // Skip if we can't get data for this lead
            continue;
          }
        }
      } catch (err) {
        console.error("[Auto-Pilot] Error calculating inquiry to tour time:", err);
      }
      
      const avgInquiryToTourDays = inquiryToTourCount > 0
        ? Math.round((totalInquiryToTourTime / inquiryToTourCount) / (1000 * 60 * 60 * 24) * 10) / 10 // Round to 1 decimal
        : 0;
      
      res.json({
        totalMessagesSent,
        messagesSentToday,
        avgResponseTimeMinutes,
        avgInquiryToTourDays,
        totalMessagesAttempted: allLogs.length,
        totalMessagesFailed: failedLogs.length,
        sentByChannel,
        failedByChannel,
      });
    } catch (error: any) {
      // Gracefully handle if table doesn't exist yet
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        console.warn("[Auto-Pilot] autopilot_activity_logs table does not exist yet, returning zero metrics");
        return res.json({
          totalMessagesSent: 0,
          messagesSentToday: 0,
          avgResponseTimeMinutes: 0,
          avgInquiryToTourDays: 0,
        });
      }
      console.error("[Auto-Pilot] Error fetching metrics:", error);
      res.status(500).json({ error: "Failed to fetch metrics", message: error.message });
    }
  });

  // ===== INTEGRATION CONFIG ROUTES =====
  
  // Middleware to prevent ETag caching
  const noCache = (req: any, res: any, next: any) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.removeHeader('ETag');
    res.set('ETag', undefined);
    next();
  };

  // Get Outlook integration status - MUST be before generic :service route
  app.get("/api/integrations/outlook", isAuthenticated, noCache, attachOrgContext, async (req: any, res) => {
    console.log("🚨🚨🚨 [v2] OUTLOOK STATUS CHECK for org:", req.orgId);
    
    try {
      const config = await storage.getIntegrationConfig("outlook", req.orgId);
      console.log("==> Config found:", config ? "YES" : "NO");
      
      if (!config || !config.isActive) {
        console.log("==> Returning: NOT CONNECTED");
        return res.json({ connected: false, _ts: Date.now() });
      }

      let tokens = config.config as any;
      
      // Try to get profile with current access token
      try {
        console.log("==> Fetching Outlook user profile...");
        const profile = await getUserProfile(tokens.access_token);
        console.log("==> Profile email:", profile.email);
        
        const result = {
          connected: true,
          email: profile.email,
          displayName: profile.displayName,
          id: config.id,
          config: { scope: tokens.scope },
          isActive: config.isActive,
          _ts: Date.now(),
        };
        
        console.log("==> Returning CONNECTED state for:", profile.email);
        return res.json(result);
      } catch (profileError: any) {
        // If 403 Forbidden, token is expired - refresh it
        if (profileError.response?.status === 403 || profileError.response?.status === 401) {
          console.log("==> Access token expired, refreshing...");
          
          try {
            const refreshedTokens = await refreshOutlookToken(tokens.refresh_token);
            console.log("==> Token refreshed successfully");
            
            // Update database with new tokens
            await storage.upsertIntegrationConfig({
              service: "outlook",
              config: refreshedTokens,
              isActive: true,
              orgId: req.orgId,
            });
            
            // Retry profile fetch with new token
            const profile = await getUserProfile(refreshedTokens.access_token);
            console.log("==> Profile fetched with refreshed token:", profile.email);
            
            return res.json({
              connected: true,
              email: profile.email,
              displayName: profile.displayName,
              id: config.id,
              config: { scope: refreshedTokens.scope },
              isActive: config.isActive,
              _ts: Date.now(),
            });
          } catch (refreshError) {
            console.error("==> Token refresh failed:", refreshError);
            return res.json({ connected: false, error: "token_refresh_failed", _ts: Date.now() });
          }
        } else {
          throw profileError;
        }
      }
    } catch (err) {
      console.error("==> ERROR in Outlook status:", err);
      return res.json({ connected: false, _ts: Date.now() });
    }
  });

  // Generic integration config route - catches other services
  app.get("/api/integrations/:service", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const config = await storage.getIntegrationConfig(req.params.service, req.orgId);
      
      if (!config) {
        return res.json(null);
      }

      // Filter out sensitive tokens/credentials before sending to frontend
      const safeConfig = {
        id: config.id,
        service: config.service,
        isActive: config.isActive,
        updatedAt: config.updatedAt,
        // Only include non-sensitive metadata from config
        metadata: {} as any
      };

      // Add service-specific safe metadata
      const fullConfig = config.config as any;
      if (config.service === 'gmail' || config.service === 'outlook') {
        safeConfig.metadata.email = fullConfig.email || 'connected';
        safeConfig.metadata.connected = true;
      } else if (config.service === 'messenger') {
        safeConfig.metadata.pageName = fullConfig.pageName;
        safeConfig.metadata.pageId = fullConfig.pageId;
        safeConfig.metadata.pageCategory = fullConfig.pageCategory;
        safeConfig.metadata.connected = true;
        safeConfig.metadata.connectedViaOAuth = fullConfig.connectedViaOAuth || false;
      } else if (config.service === 'twilio') {
        safeConfig.metadata.phoneNumber = fullConfig.phoneNumber;
        safeConfig.metadata.connected = true;
      }

      res.json(safeConfig);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch integration config" });
    }
  });

  // Clear Gmail sync progress without touching OAuth tokens
  app.post("/api/integrations/gmail/clear-sync-progress", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const config = await storage.getIntegrationConfig("gmail", req.orgId);
      
      if (!config) {
        return res.status(404).json({ error: "Gmail integration not found" });
      }

      // Preserve all existing config but clear only sync progress fields
      const updatedConfig = {
        ...config.config,
        lastHistoryId: null,
        pageToken: null,
      };

      await storage.upsertIntegrationConfig({
        service: "gmail",
        config: updatedConfig,
        isActive: config.isActive,
        orgId: req.orgId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("[Clear Gmail Sync Progress] Error:", error);
      res.status(500).json({ error: "Failed to clear sync progress" });
    }
  });

  app.post("/api/integrations", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validatedData = insertIntegrationConfigSchema.parse(req.body);
      
      // Fetch existing config to preserve OAuth tokens if config is empty
      const existing = await storage.getIntegrationConfig(validatedData.service, req.orgId);
      
      let finalConfig = validatedData.config;
      
      // If config is empty object and we have existing config, preserve the existing one
      if (Object.keys(validatedData.config || {}).length === 0 && existing) {
        finalConfig = existing.config;
      }
      
      const config = await storage.upsertIntegrationConfig({ 
        ...validatedData, 
        config: finalConfig,
        orgId: req.orgId 
      });
      res.status(201).json(config);
    } catch (error) {
      console.error("[Update Integration] Error:", error);
      res.status(400).json({ error: "Invalid integration config data" });
    }
  });

  // ===== CALENDAR ROUTES =====
  
  // Google Calendar OAuth
  app.get("/api/auth/google-calendar", isAuthenticated, async (req, res) => {
    try {
      const authUrl = getCalendarAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating Google Calendar auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.get("/api/auth/google-calendar/callback", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== 'string') {
        return res.status(400).send("Missing authorization code");
      }

      const tokens = await getCalendarTokensFromCode(code);
      
      // Get calendar list to get primary calendar info
      const calendars = await listCalendars(tokens.access_token!);
      const primaryCalendar = calendars.find(cal => cal.primary) || calendars[0];

      // Store calendar connection linked to authenticated user
      await storage.createCalendarConnection({
        userId: req.user.id,
        provider: 'google',
        email: primaryCalendar?.id || 'unknown',
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        calendarId: primaryCalendar?.id || 'primary',
        calendarName: primaryCalendar?.summary || 'Google Calendar',
        isActive: true,
      });

      res.redirect('/schedule?connected=google');
    } catch (error) {
      console.error("Error in Google Calendar callback:", error);
      res.status(500).send("Failed to connect Google Calendar");
    }
  });

  // Calendar connections (organization-scoped with user names)
  app.get("/api/calendar/connections", isAuthenticated, attachOrgContext, async (req, res) => {
    try {
      const connections = await storage.getCalendarConnectionsWithUsers(req.orgId);
      // Don't expose tokens in response
      const safeConnections = connections.map(conn => ({
        id: conn.id,
        userId: conn.userId,
        userName: conn.userName,
        provider: conn.provider,
        email: conn.email,
        calendarName: conn.calendarName,
        isActive: conn.isActive,
        autoSync: conn.autoSync,
        lastSyncedAt: conn.lastSyncedAt,
        createdAt: conn.createdAt,
      }));
      res.json(safeConnections);
    } catch (error) {
      console.error("Error fetching calendar connections:", error);
      res.status(500).json({ error: "Failed to fetch calendar connections" });
    }
  });

  app.delete("/api/calendar/connections/:id", isAuthenticated, async (req, res) => {
    try {
      const success = await storage.deleteCalendarConnection(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting calendar connection:", error);
      res.status(500).json({ error: "Failed to delete connection" });
    }
  });

  // Toggle auto-sync for calendar connection
  app.patch("/api/calendar/connections/:id/auto-sync", isAuthenticated, async (req, res) => {
    try {
      const { autoSync } = req.body;
      if (typeof autoSync !== 'boolean') {
        return res.status(400).json({ error: "autoSync must be a boolean" });
      }

      const connection = await storage.getCalendarConnection(req.params.id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // If enabling auto-sync, register webhook with Google Calendar
      if (autoSync && connection.provider === 'google') {
        try {
          let accessToken = connection.accessToken!;
          
          // Refresh token if expired
          if (connection.expiresAt && connection.expiresAt < new Date() && connection.refreshToken) {
            const newTokens = await refreshCalendarToken(connection.refreshToken);
            accessToken = newTokens.access_token!;
            await storage.updateCalendarConnection(connection.id, {
              accessToken: newTokens.access_token || connection.accessToken,
              expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : connection.expiresAt,
            });
          }

          // Stop existing webhook if any
          if (connection.webhookId && connection.webhookResourceId) {
            try {
              await stopCalendarWebhook(accessToken, connection.webhookId, connection.webhookResourceId);
            } catch (error) {
              console.log("Failed to stop existing webhook (might already be expired):", error);
            }
          }

          // Register new webhook with secret token
          const channelId = `calendar_${connection.id}_${Date.now()}`;
          const webhookToken = crypto.randomBytes(32).toString('hex');
          
          console.log(`[Auto-Sync] Registering webhook for ${connection.email}, channel: ${channelId}`);
          
          const webhookData = await registerCalendarWebhook(
            accessToken,
            connection.calendarId || 'primary',
            channelId,
            webhookToken
          );

          console.log(`[Auto-Sync] ✅ Webhook registered successfully for ${connection.email}`);
          console.log(`[Auto-Sync] Channel ID: ${webhookData.channelId}, Resource ID: ${webhookData.resourceId}`);
          console.log(`[Auto-Sync] Webhook expires: ${webhookData.expiration}`);

          // Update connection with webhook data and auto-sync enabled
          const updatedConnection = await storage.updateCalendarConnection(req.params.id, {
            autoSync: true,
            webhookId: webhookData.channelId,
            webhookResourceId: webhookData.resourceId,
            webhookToken,
            webhookExpiration: webhookData.expiration,
          });

          return res.json({ 
            success: true,
            autoSync: true,
            webhookExpiration: webhookData.expiration,
          });
        } catch (webhookError: any) {
          console.error(`[Auto-Sync] ❌ Webhook registration FAILED for ${connection.email}`);
          console.error("[Auto-Sync] Error details:", {
            message: webhookError.message,
            code: webhookError.code,
            errors: webhookError.errors,
            response: webhookError.response?.data,
          });
          
          // Still enable auto-sync but log the error
          await storage.updateCalendarConnection(req.params.id, { autoSync: true });
          return res.json({ 
            success: true,
            autoSync: true,
            warning: "Auto-sync enabled but real-time updates may not work. Manual sync is still available.",
            error: webhookError.message,
          });
        }
      }
      
      // If disabling auto-sync, stop the webhook
      if (!autoSync && connection.webhookId && connection.webhookResourceId) {
        try {
          let accessToken = connection.accessToken!;
          
          // Refresh token if expired
          if (connection.expiresAt && connection.expiresAt < new Date() && connection.refreshToken) {
            const newTokens = await refreshCalendarToken(connection.refreshToken);
            accessToken = newTokens.access_token!;
          }

          await stopCalendarWebhook(accessToken, connection.webhookId, connection.webhookResourceId);
        } catch (error) {
          console.log("Failed to stop webhook (might already be expired):", error);
        }
      }

      // Update auto-sync status and clear webhook data if disabling
      const updatedConnection = await storage.updateCalendarConnection(req.params.id, {
        autoSync,
        ...(autoSync === false && {
          webhookId: null,
          webhookResourceId: null,
          webhookToken: null,
          webhookExpiration: null,
        }),
      });

      res.json({ 
        success: true,
        autoSync: updatedConnection!.autoSync,
      });
    } catch (error) {
      console.error("Error toggling auto-sync:", error);
      res.status(500).json({ error: "Failed to toggle auto-sync" });
    }
  });

  // Google Calendar webhook endpoint (receives push notifications)
  app.post("/api/calendar/webhook", async (req, res) => {
    try {
      // Get notification headers
      const channelId = req.headers['x-goog-channel-id'] as string;
      const resourceId = req.headers['x-goog-resource-id'] as string;
      const resourceState = req.headers['x-goog-resource-state'] as string;
      const channelToken = req.headers['x-goog-channel-token'] as string;

      console.log(`[Calendar Webhook] Received ${resourceState} notification for channel ${channelId}`);

      // Ignore sync messages (initial handshake)
      if (resourceState === 'sync') {
        res.status(200).send();
        return;
      }

      // Find connection by webhook ID, resource ID, and validate token
      const connections = await storage.getCalendarConnections();
      const connection = connections.find(
        c => c.webhookId === channelId && 
             c.webhookResourceId === resourceId &&
             c.webhookToken === channelToken
      );

      if (!connection) {
        console.log(`[Calendar Webhook] Invalid webhook: channel=${channelId}, resource=${resourceId}, token_match=${!!channelToken}`);
        res.status(200).send(); // Still acknowledge to prevent retries
        return;
      }

      // Validate all security headers are present
      if (!channelId || !resourceId || !channelToken) {
        console.log(`[Calendar Webhook] Missing required headers`);
        res.status(200).send();
        return;
      }

      // Acknowledge receipt immediately (Google requires 200 response within seconds)
      res.status(200).send();

      // Calendar sync/import is disabled - we only send events TO calendars, not import FROM them
      console.log(`[Calendar Webhook] Webhook received for ${connection.email} - import disabled (only sending events to calendar)`);
    } catch (error) {
      console.error("[Calendar Webhook] Error processing webhook:", error);
      // Don't throw - we already sent 200 response
    }
  });

  // Sync calendar events - syncs showings assigned to the user to their Google Calendar
  app.post("/api/calendar/sync/:connectionId", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const connection = await storage.getCalendarConnection(req.params.connectionId);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      if (!connection.userId) {
        return res.status(400).json({ error: "Calendar connection is not associated with a user" });
      }

      // Verify the connection's user is a member of the current organization
      const user = await storage.getUser(connection.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user is a member of the current organization
      const membership = await storage.getMembership(connection.userId, req.orgId);
      if (!membership) {
        return res.status(403).json({ error: "User is not a member of this organization" });
      }

      if (connection.provider === 'google') {
        if (!connection.accessToken) {
          return res.status(400).json({ error: "No access token found. Please reconnect your calendar." });
        }

        let accessToken = connection.accessToken;
        
        // Check if token is expired and refresh if needed
        if (connection.expiresAt && connection.expiresAt < new Date()) {
          if (connection.refreshToken) {
            try {
              const newTokens = await refreshCalendarToken(connection.refreshToken);
              if (!newTokens.access_token) {
                return res.status(401).json({ error: "Token refresh failed: No access token returned. Please reconnect your calendar." });
              }
              accessToken = newTokens.access_token;
              
              // Update connection with new tokens
              await storage.updateCalendarConnection(connection.id, {
                accessToken: newTokens.access_token,
                expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : connection.expiresAt,
              });
            } catch (refreshError: any) {
              console.error("Error refreshing token:", refreshError);
              const errorMessage = refreshError?.message || "Unknown error";
              return res.status(401).json({ error: `Token expired and refresh failed: ${errorMessage}. Please reconnect your calendar.` });
            }
          } else {
            return res.status(401).json({ error: "Token expired. Please reconnect your calendar." });
          }
        }

        // Get showings assigned to this user
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);

        // Format dates as YYYY-MM-DD for the query
        const startDateStr = now.toISOString().split('T')[0];
        const endDateStr = futureDate.toISOString().split('T')[0];

        // Get all showings in the date range for the current organization
        let allShowings;
        try {
          allShowings = await storage.getShowingsByDateRange(startDateStr, endDateStr, req.orgId);
        } catch (error: any) {
          console.error("Error fetching showings:", error);
          return res.status(500).json({ error: `Failed to fetch showings: ${error?.message || "Unknown error"}` });
        }
        
        // Filter showings assigned to this user
        const assignedShowings = allShowings.filter(showing => showing.assignedTo === connection.userId);

        let syncedCount = 0;
        const errors: string[] = [];
        
        for (const showing of assignedShowings) {
          try {
            // Parse scheduled date and time
            if (!showing.scheduledDate || !showing.scheduledTime) {
              errors.push(`Showing ${showing.id} is missing date or time`);
              continue;
            }

            const [year, month, day] = showing.scheduledDate.split('-').map(Number);
            const [hours, minutes] = showing.scheduledTime.split(':').map(Number);
            
            if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
              errors.push(`Showing ${showing.id} has invalid date or time format`);
              continue;
            }
            
            const startTime = new Date(year, month - 1, day, hours, minutes);
            const endTime = new Date(startTime.getTime() + (showing.durationMinutes || 30) * 60 * 1000);

            // Get property and lead info for description
            const property = await storage.getProperty(showing.propertyId, user.orgId);
            const lead = showing.leadId ? await storage.getLead(showing.leadId, user.orgId) : null;
            
            let description = showing.description || '';
            if (property) {
              description += description ? '\n\n' : '';
              description += `Property: ${property.name}`;
              if (property.address) {
                description += `\nAddress: ${property.address}`;
              }
            }
            if (lead) {
              description += description ? '\n\n' : '';
              description += `Lead: ${lead.name || lead.email}`;
              if (lead.phone) {
                description += `\nPhone: ${lead.phone}`;
              }
            }
            if (showing.location) {
              description += description ? '\n\n' : '';
              description += `Location: ${showing.location}`;
            }
            if (showing.specialInstructions) {
              description += description ? '\n\n' : '';
              description += `Special Instructions: ${showing.specialInstructions}`;
            }

            // Check if we already have a calendar event for this showing
            // We use a prefix to identify showing-based events
            const showingExternalId = `showing-${showing.id}`;
            let existingCalendarEvent = await storage.getCalendarEventByExternalId(
              connection.id,
              showingExternalId
            );

            // Also check if we have an event with the Google Calendar ID (in case externalId was updated)
            // We'll search by matching title and startTime to find existing events
            // Query events in a small window around the showing time
            const searchStartTime = new Date(startTime.getTime() - 24 * 60 * 60 * 1000); // 1 day before
            const searchEndTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000); // 1 day after
            const allConnectionEvents = await storage.getCalendarEvents(connection.id, searchStartTime, searchEndTime);
            const matchingEvent = allConnectionEvents.find(e => {
              const eventStart = new Date(e.startTime);
              return e.title === showing.title && 
                     Math.abs(eventStart.getTime() - startTime.getTime()) < 60000; // Within 1 minute
            });
            
            // Use the matching event if found and it has a real Google Calendar ID
            if (matchingEvent && !matchingEvent.externalId.startsWith('showing-')) {
              existingCalendarEvent = matchingEvent;
            }

            // Parse attendees if they exist
            let parsedAttendees: Array<{ email: string; displayName?: string }> | null = null;
            if (showing.attendees) {
              try {
                const attendeesData = typeof showing.attendees === 'string' 
                  ? JSON.parse(showing.attendees) 
                  : showing.attendees;
                
                if (Array.isArray(attendeesData)) {
                  parsedAttendees = attendeesData.map((a: any) => ({
                    email: a.email || a,
                    displayName: a.name || a.displayName || a.email || a,
                  }));
                }
              } catch (e) {
                console.warn(`Failed to parse attendees for showing ${showing.id}:`, e);
              }
            }

            // Create or update the event in Google Calendar
            // If we have an existing calendar event with a real Google Calendar ID, use that for updates
            const googleEventId = existingCalendarEvent && !existingCalendarEvent.externalId.startsWith('showing-')
              ? existingCalendarEvent.externalId
              : undefined;
            
            const googleEvent = await createOrUpdateCalendarEvent(
              accessToken,
              connection.calendarId || 'primary',
              {
                id: googleEventId,
                title: showing.title,
                description: description || null,
                startTime,
                endTime,
                location: showing.location || property?.address || null,
                attendees: parsedAttendees,
              }
            );

            // Store the mapping in our database
            // Use the Google Calendar event ID as the externalId (this is what Google Calendar uses)
            // If we had a placeholder externalId, this will update it to the real Google Calendar ID
          await storage.upsertCalendarEvent({
            connectionId: connection.id,
              externalId: googleEvent.id || showingExternalId,
              title: showing.title,
              description: description || null,
              startTime,
              endTime,
              location: showing.location || property?.address || null,
              attendees: parsedAttendees,
              isAllDay: false,
              status: 'confirmed',
            });

          syncedCount++;
          } catch (error: any) {
            const errorMessage = error?.message || "Unknown error";
            console.error(`Error syncing showing ${showing.id}:`, error);
            errors.push(`Failed to sync showing "${showing.title || showing.id}": ${errorMessage}`);
            // Continue with other showings even if one fails
          }
        }

        // If we have errors but also some successes, return partial success
        if (errors.length > 0 && syncedCount > 0) {
          return res.json({ 
            success: true, 
            syncedCount,
            warnings: errors,
            message: `Synced ${syncedCount} events, but ${errors.length} failed`
          });
        }

        // If all failed
        if (errors.length > 0 && syncedCount === 0) {
          return res.status(500).json({ 
            error: `Failed to sync any events. Errors: ${errors.join('; ')}`,
            details: errors
          });
        }

        res.json({ success: true, syncedCount });
      } else {
        res.status(400).json({ error: "Provider not supported for sync yet" });
      }
    } catch (error: any) {
      console.error("Error syncing calendar:", error);
      const errorMessage = error?.message || "Unknown error";
      const errorDetails = error?.response?.data || error?.body || error;
      res.status(500).json({ 
        error: `Failed to sync calendar: ${errorMessage}`,
        details: errorDetails
      });
    }
  });

  // Get calendar events (with optional date range and member filter)
  app.get("/api/calendar/events", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { startTime, endTime, memberId } = req.query;
      
      const start = startTime ? new Date(startTime as string) : undefined;
      const end = endTime ? new Date(endTime as string) : undefined;
      const memberFilter = memberId && memberId !== "all" ? memberId as string : undefined;

      const events = await storage.getAllCalendarEvents(req.orgId, start, end, memberFilter);
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // Schedule preferences
  app.get("/api/schedule/preferences", isAuthenticated, async (req, res) => {
    try {
      const preferences = await storage.getSchedulePreferences();
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching schedule preferences:", error);
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.post("/api/schedule/preferences", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertSchedulePreferenceSchema.parse(req.body);
      const preference = await storage.createSchedulePreference(validatedData);
      res.status(201).json(preference);
    } catch (error) {
      console.error("Error creating schedule preference:", error);
      res.status(400).json({ error: "Invalid preference data" });
    }
  });

  app.delete("/api/schedule/preferences/:id", isAuthenticated, async (req, res) => {
    try {
      const success = await storage.deleteSchedulePreference(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Preference not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting schedule preference:", error);
      res.status(500).json({ error: "Failed to delete preference" });
    }
  });

  // Bulk operations for schedule preferences
  /**
   * REBUILT FROM SCRATCH - Bulk fetch schedule preferences
   * 
   * This endpoint fetches preferences for multiple users at a specific level:
   * - If unitId is provided: Returns unit-level preferences for that unit
   * - If only propertyId is provided: Returns property-level preferences (for inheritance)
   * - If neither: Returns user-level preferences
   */
  app.post("/api/schedule/preferences/bulk", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { userIds, propertyId, unitId } = req.body;
      
      console.log("[API] /api/schedule/preferences/bulk REQUEST:", { 
        userIds, 
        propertyId: propertyId || 'null', 
        unitId: unitId || 'null',
        level: unitId ? 'unit-level' : propertyId ? 'property-level' : 'user-level'
      });
      
      // Validation
      if (!Array.isArray(userIds)) {
        return res.status(400).json({ error: "userIds must be an array" });
      }

      if (userIds.length === 0) {
        return res.json([]); // Return empty array if no users
      }

      if (!userIds.every(id => typeof id === 'string')) {
        return res.status(400).json({ error: "All user IDs must be strings" });
      }

      // Security: Verify all requested user IDs belong to the current organization
      const orgMembers = await storage.getOrgMembersWithProfiles(req.orgId);
      const validMemberIds = new Set(orgMembers.map((m: any) => m.id));
      
      const invalidIds = userIds.filter(id => !validMemberIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(403).json({ 
          error: "Forbidden", 
          message: "Some user IDs do not belong to your organization" 
        });
      }

      // If unitId is provided, propertyId is also required
      if (unitId && !propertyId) {
        return res.status(400).json({ error: "propertyId is required when unitId is provided" });
      }

      // Fetch preferences at the specified level
      const preferences = await storage.getSchedulePreferencesForUsers(userIds, propertyId, unitId);
      
      console.log("[API] /api/schedule/preferences/bulk RESPONSE:", { 
        count: preferences.length,
        level: unitId ? 'unit-level' : propertyId ? 'property-level' : 'user-level',
        preferences: preferences.map(p => ({
          userId: p.userId,
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
          propertyId: p.propertyId,
          unitId: p.unitId
        }))
      });
      
      res.json(preferences);
    } catch (error) {
      console.error("[API] Error fetching bulk schedule preferences:", error);
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  /**
   * REBUILT FROM SCRATCH - Save/update schedule preferences for a user
   * 
   * This endpoint saves preferences at a specific level:
   * - If unitId is provided: Saves as unit-level preferences (overrides property-level)
   * - If only propertyId is provided: Saves as property-level preferences (inherited by units)
   * 
   * IMPORTANT: This replaces ALL existing preferences at the specified level for this user.
   */
  app.put("/api/schedule/preferences/user/:userId", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { preferences, propertyId, unitId } = req.body;
      
      console.log("[API] PUT /api/schedule/preferences/user/:userId REQUEST:", { 
        userId, 
        propertyId: propertyId || 'null', 
        unitId: unitId || 'null',
        level: unitId ? 'unit-level' : propertyId ? 'property-level' : 'invalid',
        prefsCount: preferences?.length 
      });
      
      // Permission check: admins and property managers can edit anyone's preferences
      // Leasing agents can only edit their own
      const role = req.role;
      if (role !== 'admin' && role !== 'property_manager' && req.user.id !== userId) {
        return res.status(403).json({ 
          error: "Forbidden", 
          message: "You can only edit your own preferences" 
        });
      }

      // Verify user belongs to current organization
      const orgMembers = await storage.getOrgMembersWithProfiles(req.orgId);
      const isMemberOfOrg = orgMembers.some((m: any) => m.id === userId);
      if (!isMemberOfOrg) {
        return res.status(403).json({ 
          error: "Forbidden", 
          message: "User does not belong to your organization" 
        });
      }

      // Validation
      if (!Array.isArray(preferences)) {
        return res.status(400).json({ error: "preferences must be an array" });
      }

      if (!propertyId) {
        return res.status(400).json({ error: "propertyId is required" });
      }

      // If unitId is provided, verify the unit exists and belongs to the property
      if (unitId) {
        const unit = await storage.getPropertyUnit(unitId, req.orgId);
        if (!unit || unit.propertyId !== propertyId) {
          return res.status(400).json({ error: "Unit not found or does not belong to the specified property" });
        }
      }

      // Validate and prepare preferences
      const validatedPreferences = [];
      const level = unitId ? 'unit-level' : 'property-level';
      
      for (const pref of preferences) {
        try {
          // Build preference data - enforce all fields from server side
          const prefData = {
            dayOfWeek: String(pref.dayOfWeek).toLowerCase(),
            startTime: String(pref.startTime),
            endTime: String(pref.endTime),
            isActive: pref.isActive !== false, // Default to true
            userId, // Enforced from route param
            propertyId, // Enforced from request body
            unitId: unitId || null, // Enforced from request body (null for property-level)
          };
          
          // Validate against schema
          const validated = insertSchedulePreferenceSchema.parse(prefData);
          validatedPreferences.push(validated);
        } catch (validationError: any) {
          console.error("[API] Preference validation error:", validationError);
          return res.status(400).json({ 
            error: "Invalid preference data", 
            details: validationError.errors || validationError.message 
          });
        }
      }

      // Delete ALL existing preferences for this user at this level
      // This ensures we replace, not merge
      const existing = await storage.getSchedulePreferencesForUsers([userId], propertyId, unitId || undefined);
      console.log("[API] Deleting existing preferences:", { 
        count: existing.length, 
        level,
        unitId: unitId || 'null (property-level)',
        existing: existing.map(p => ({ id: p.id, dayOfWeek: p.dayOfWeek }))
      });
      
      await Promise.all(existing.map(p => storage.deleteSchedulePreference(p.id)));

      // Create new preferences
      console.log("[API] Creating new preferences:", { 
        count: validatedPreferences.length,
        level,
        preferences: validatedPreferences.map(p => ({ dayOfWeek: p.dayOfWeek, startTime: p.startTime, endTime: p.endTime }))
      });
      
      const created = await Promise.all(
        validatedPreferences.map((pref) => storage.createSchedulePreference(pref))
      );

      console.log("[API] PUT /api/schedule/preferences/user/:userId SUCCESS:", { 
        userId,
        level,
        count: created.length,
        created: created.map(p => ({ 
          id: p.id, 
          userId: p.userId,
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
          propertyId: p.propertyId, 
          unitId: p.unitId 
        }))
      });

      res.json(created);
    } catch (error: any) {
      console.error("[API] Error updating schedule preferences:", error);
      res.status(500).json({ 
        error: "Failed to update preferences",
        message: error.message 
      });
    }
  });

  /**
   * REBUILT FROM SCRATCH - Reset units to inherit from property-level preferences
   * 
   * This endpoint deletes ALL unit-level preferences for the specified units,
   * forcing them to inherit from property-level preferences instead.
   * 
   * This is called when property-level settings are applied to units.
   */
  app.post("/api/schedule/preferences/copy-to-units", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { propertyId, unitIds } = req.body;
      
      console.log("[API] POST /api/schedule/preferences/copy-to-units REQUEST:", { 
        propertyId, 
        unitIds,
        unitCount: unitIds?.length 
      });
      
      // Validation
      if (!propertyId) {
        return res.status(400).json({ error: "propertyId is required" });
      }
      
      if (!unitIds || !Array.isArray(unitIds) || unitIds.length === 0) {
        return res.status(400).json({ error: "unitIds must be a non-empty array" });
      }
      
      // Verify property belongs to org
      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        return res.status(403).json({ error: "Property not found or access denied" });
      }
      
      let totalDeleted = 0;
      const deletedByUnit: Record<string, number> = {};
      
      // For each unit, DELETE ALL unit-level preferences
      // This forces the unit to inherit from property-level preferences
      for (const unitId of unitIds) {
        // Verify unit belongs to property and org
        const unit = await storage.getPropertyUnit(unitId, req.orgId);
        if (!unit || unit.propertyId !== propertyId) {
          console.log(`[API] Skipping unit ${unitId} - not found or doesn't belong to property/org`);
          continue;
        }
        
        // Get ALL unit-level preferences for this unit (for all users)
        // We need to get all preferences where unitId matches, regardless of userId
        const existingUnitPrefs = await db.select().from(schedulePreferences)
          .where(and(
            eq(schedulePreferences.unitId, unitId),
            eq(schedulePreferences.propertyId, propertyId),
            eq(schedulePreferences.isActive, true)
          ));
        
        console.log(`[API] Found ${existingUnitPrefs.length} unit-level preferences for unit ${unitId}`);
        
        // Delete all unit-level preferences for this unit
        for (const pref of existingUnitPrefs) {
          await storage.deleteSchedulePreference(pref.id);
          totalDeleted++;
        }
        
        deletedByUnit[unitId] = existingUnitPrefs.length;
      }
      
      console.log("[API] POST /api/schedule/preferences/copy-to-units SUCCESS:", { 
        propertyId,
        unitCount: unitIds.length,
        totalDeleted,
        deletedByUnit
      });
      
      res.json({ 
        message: `Reset ${totalDeleted} unit-level preferences across ${unitIds.length} unit(s). Units will now inherit from property-level preferences.`,
        deletedCount: totalDeleted,
        unitCount: unitIds.length,
        deletedByUnit
      });
    } catch (error: any) {
      console.error("[API] Error resetting unit preferences:", error);
      res.status(500).json({ 
        error: "Failed to reset unit preferences",
        message: error.message 
      });
    }
  });

  // Get availability (free/busy times)
  app.get("/api/calendar/availability", isAuthenticated, async (req, res) => {
    try {
      const { date } = req.query;
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ error: "Date parameter required" });
      }

      const targetDate = new Date(date);
      const dayStart = new Date(targetDate.setHours(0, 0, 0, 0));
      const dayEnd = new Date(targetDate.setHours(23, 59, 59, 999));

      // Get all events for the day
      const events = await storage.getAllCalendarEvents(dayStart, dayEnd);

      // Get schedule preferences for this day
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[targetDate.getDay()];
      const preferences = await storage.getSchedulePreferences();
      const dayPreference = preferences.find(p => p.dayOfWeek.toLowerCase() === dayOfWeek);

      res.json({
        date,
        events,
        preferredTimes: dayPreference ? {
          startTime: dayPreference.startTime,
          endTime: dayPreference.endTime,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching availability:", error);
      res.status(500).json({ error: "Failed to fetch availability" });
    }
  });

  // ===== ANALYTICS ROUTES =====
  app.get("/api/analytics/stats", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const stats = await storage.getLeadStats(req.orgId);
      
      // Calculate additional metrics
      const allLeads = await storage.getAllLeads(req.orgId);
      const totalLeads = stats.total;
      const approvedLeads = stats.byStatus.approved || 0;
      const conversionRate = totalLeads > 0 ? Math.round((approvedLeads / totalLeads) * 100) : 0;
      
      // New leads (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const newLeads = allLeads.filter(lead => {
        if (!lead.createdAt) return false;
        const createdAt = new Date(lead.createdAt);
        return createdAt >= thirtyDaysAgo;
      }).length;
      
      // Leads by property (inquired about each property)
      const propMap = new Map<string, { name: string; count: number }>();
      const propertiesList = await storage.getAllProperties(req.orgId);
      for (const p of propertiesList) propMap.set(p.id, { name: p.name, count: 0 });
      propMap.set("unassigned", { name: "Unassigned", count: 0 });
      for (const lead of allLeads) {
        const pid = lead.propertyId || "unassigned";
        let entry = propMap.get(pid);
        if (!entry) {
          entry = { name: lead.propertyName || (pid === "unassigned" ? "Unassigned" : "Unknown"), count: 0 };
          propMap.set(pid, entry);
        }
        entry.count += 1;
      }
      const leadsByProperty = Array.from(propMap.entries())
        .map(([propertyId, v]) => ({ propertyId, propertyName: v.name, leadCount: v.count }))
        .filter(x => x.leadCount > 0)
        .sort((a, b) => b.leadCount - a.leadCount);

      // Response rate (outgoing / incoming messages)
      const [incomingRes, outgoingRes] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` })
          .from(conversations)
          .innerJoin(leads, eq(conversations.leadId, leads.id))
          .where(and(eq(leads.orgId, req.orgId), or(eq(conversations.type, 'incoming'), eq(conversations.type, 'received')))),
        db.select({ count: sql<number>`count(*)::int` })
          .from(conversations)
          .innerJoin(leads, eq(conversations.leadId, leads.id))
          .where(and(eq(leads.orgId, req.orgId), or(eq(conversations.type, 'outgoing'), eq(conversations.type, 'sent')))),
      ]);
      const totalIncoming = incomingRes[0]?.count ?? 0;
      const totalOutgoing = outgoingRes[0]?.count ?? 0;
      const responseRate = totalIncoming > 0 ? Math.round((totalOutgoing / totalIncoming) * 100) : 0;

      // Booked tours (confirmed/approved/completed showings)
      const bookedRes = await db.select({ count: sql<number>`count(*)::int` })
        .from(showings)
        .where(and(
          eq(showings.orgId, req.orgId),
          or(eq(showings.status, 'confirmed'), eq(showings.status, 'approved'), eq(showings.status, 'completed'))
        ));
      const bookedTours = bookedRes[0]?.count ?? 0;

      // Lead to Tour rate (unique leads with booked showing / total leads)
      const tourLeads = await db.selectDistinct({ leadId: showings.leadId })
        .from(showings)
        .innerJoin(leads, eq(showings.leadId, leads.id))
        .where(and(
          eq(leads.orgId, req.orgId),
          isNotNull(showings.leadId),
          or(eq(showings.status, 'confirmed'), eq(showings.status, 'approved'), eq(showings.status, 'completed'))
        ));
      const leadsWithTourCount = tourLeads.length;
      const leadToTourRate = totalLeads > 0 ? Math.round((leadsWithTourCount / totalLeads) * 100) : 0;

      res.json({
        totalLeads,
        conversionRate: `${conversionRate}%`,
        newLeads,
        leadsByProperty,
        responseRate,
        bookedTours,
        leadToTourRate: `${leadToTourRate}%`,
        byStatus: stats.byStatus,
        bySource: stats.bySource,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/analytics/trends", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const period = (req.query.period as string) || "month";
      const orgId = req.orgId;
      if (!orgId) return res.status(401).json({ error: "Unauthorized" });

      const getStartOfWeek = (d: Date) => {
        const copy = new Date(d);
        const day = copy.getDay();
        const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
        copy.setDate(diff);
        copy.setHours(0, 0, 0, 0);
        return copy;
      };

      const getWeekKey = (d: Date) => {
        const start = getStartOfWeek(new Date(d));
        return `Week of ${start.toLocaleString("default", { month: "short", day: "numeric", year: "2-digit" })}`;
      };

      let bucketKeys: string[] = [];
      let startDate: Date;

      if (period === "week") {
        const weeksBack = 12;
        startDate = new Date();
        startDate.setDate(startDate.getDate() - weeksBack * 7);
        startDate = getStartOfWeek(startDate);

        for (let i = 0; i < weeksBack; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i * 7);
          bucketKeys.push(getWeekKey(d));
        }
      } else {
        const monthsBack = period === "year" ? 12 : 6;
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        for (let i = 0; i < monthsBack; i++) {
          const d = new Date(startDate);
          d.setMonth(d.getMonth() + i);
          bucketKeys.push(d.toLocaleString("default", { month: "short", year: "2-digit" }));
        }
      }

      const leadBuckets: Record<string, number> = {};
      const tourBuckets: Record<string, number> = {};
      bucketKeys.forEach(k => { leadBuckets[k] = 0; tourBuckets[k] = 0; });

      const leadsRows = await db.select({ createdAt: leads.createdAt })
        .from(leads)
        .where(and(eq(leads.orgId, orgId), gte(leads.createdAt, startDate)));

      for (const row of leadsRows) {
        const d = new Date(row.createdAt as any);
        const key = period === "week" ? getWeekKey(d) : d.toLocaleString("default", { month: "short", year: "2-digit" });
        if (leadBuckets[key] !== undefined) leadBuckets[key]++;
      }

      const startDateStr = startDate.toISOString().slice(0, 10);
      const showingsRows = await db.select({ scheduledDate: showings.scheduledDate })
        .from(showings)
        .innerJoin(leads, eq(showings.leadId, leads.id))
        .where(and(
          eq(leads.orgId, orgId),
          sql`${showings.scheduledDate} >= ${startDateStr}`,
          or(eq(showings.status, 'confirmed'), eq(showings.status, 'approved'), eq(showings.status, 'completed'))
        ));

      for (const row of showingsRows) {
        const sd = row.scheduledDate as string;
        if (!sd) continue;
        const d = new Date(sd + "T12:00:00");
        const key = period === "week" ? getWeekKey(d) : d.toLocaleString("default", { month: "short", year: "2-digit" });
        if (tourBuckets[key] !== undefined) tourBuckets[key]++;
      }

      const trends = bucketKeys.map(p => ({
        period: p,
        leads: leadBuckets[p] ?? 0,
        tours: tourBuckets[p] ?? 0,
      }));

      res.json(trends);
    } catch (error) {
      console.error("[Analytics Trends] Error:", error);
      res.json([]);
    }
  });

  // ===== AI ACTIVITY FEED =====
  app.get("/api/ai-activity", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const conversations = await storage.getAllLeads(req.orgId);
      
      // Get recent AI-generated conversations
      const activities = [];
      for (const lead of conversations.slice(0, 5)) {
        const convos = await storage.getConversationsByLeadId(lead.id, req.orgId);
        const aiConvos = convos.filter(c => c.aiGenerated).slice(0, 1);
        
        for (const convo of aiConvos) {
          activities.push({
            id: convo.id,
            type: "response",
            channel: convo.channel,
            leadName: lead.name,
            action: convo.message.substring(0, 100) + "...",
            timestamp: new Date(convo.createdAt).toLocaleString(),
            status: "success",
          });
        }
      }
      
      res.json(activities.slice(0, 4));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI activity" });
    }
  });

  // ===== GMAIL OAUTH ROUTES =====
  app.get("/api/integrations/gmail/auth", isAuthenticated, async (req: any, res) => {
    try {
      // Use the authenticated user's ID for Gmail OAuth
      const userId = req.user.id;
      
      // Store the return URL and user ID in session so we can redirect back after OAuth
      // This ensures we can still identify the user even if session is lost during OAuth redirect
      const returnUrl = req.query.returnUrl || '/integrations';
      if (req.session) {
        (req.session as any).gmailOAuthReturnUrl = returnUrl;
        (req.session as any).gmailOAuthUserId = userId;
        req.session.save((err) => {
          if (err) {
            console.error("[Gmail OAuth] Error saving session:", err);
          }
        });
      }
      console.log("[Gmail OAuth] Storing return URL in session:", returnUrl);
      console.log("[Gmail OAuth] Storing user ID in session:", userId);
      
      console.log("[Gmail OAuth] Generating auth URL for user:", userId);
      const authUrl = getGmailAuthUrl(userId);
      console.log("[Gmail OAuth] Generated auth URL:", authUrl);
      const response = { url: authUrl };
      console.log("[Gmail OAuth] Sending response:", response);
      res.json(response);
    } catch (error) {
      console.error("[Gmail OAuth] Failed to generate auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.get("/api/integrations/gmail/callback", async (req, res) => {
    try {
      const { code, state: userId } = req.query;
      
      if (!code) {
        const host = req.get('host') || '';
        const isProduction = host.includes('lead2lease.ai');
        const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes(':5000');
        
        let redirectUrl: string;
        if (isLocalhost) {
          const protocol = req.protocol || 'http';
          redirectUrl = `${protocol}://${host}/app/integrations?gmail=error&reason=no_code`;
        } else if (isProduction) {
          redirectUrl = `https://app.lead2lease.ai/integrations?gmail=error&reason=no_code`;
        } else {
          const protocol = req.protocol || 'https';
          redirectUrl = `${protocol}://${host}/integrations?gmail=error&reason=no_code`;
        }
        return res.redirect(redirectUrl);
      }

      // Get user ID from state parameter, session, or authenticated user
      let authenticatedUserId = null;
      if (req.isAuthenticated() && req.user) {
        authenticatedUserId = req.user.id;
      } else if (userId) {
        authenticatedUserId = userId as string;
      } else if (req.session && (req.session as any).gmailOAuthUserId) {
        authenticatedUserId = (req.session as any).gmailOAuthUserId;
      }

      if (!authenticatedUserId) {
        console.error("[Gmail OAuth] No user ID found in state, session, or authenticated user");
        const host = req.get('host') || '';
        const isProduction = host.includes('lead2lease.ai');
        const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes(':5000');
        
        let redirectUrl: string;
        if (isLocalhost) {
          const protocol = req.protocol || 'http';
          redirectUrl = `${protocol}://${host}/app/integrations?gmail=error&reason=not_authenticated`;
        } else if (isProduction) {
          redirectUrl = `https://app.lead2lease.ai/integrations?gmail=error&reason=not_authenticated`;
        } else {
          const protocol = req.protocol || 'https';
          redirectUrl = `${protocol}://${host}/integrations?gmail=error&reason=not_authenticated`;
        }
        return res.redirect(redirectUrl);
      }

      // Exchange code for tokens
      const tokens = await getGmailTokensFromCode(code as string);

      // Get the user's orgId
      const membership = await storage.getUserOrganization(authenticatedUserId);
      if (!membership) {
        // Get the return URL from session for error case
        let returnPath = '/integrations?gmail=error&reason=no_org';
        if (req.session && (req.session as any).gmailOAuthReturnUrl) {
          returnPath = (req.session as any).gmailOAuthReturnUrl;
          if (!returnPath.includes('gmail=')) {
            returnPath += (returnPath.includes('?') ? '&' : '?') + 'gmail=error&reason=no_org';
          }
          delete (req.session as any).gmailOAuthReturnUrl;
        }
        
        // Construct redirect URL for no org error - ALWAYS redirect to app domain
        const host = req.get('host') || '';
        const isProduction = host.includes('lead2lease.ai');
        const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes(':5000');
        
        let baseUrl: string;
        if (isLocalhost) {
          const protocol = req.protocol || 'http';
          baseUrl = `${protocol}://${host}`;
          if (!returnPath.startsWith('/app')) {
            returnPath = '/app' + (returnPath.startsWith('/') ? returnPath : '/' + returnPath);
          }
        } else if (isProduction) {
          baseUrl = 'https://app.lead2lease.ai';
          if (returnPath.startsWith('/app')) {
            returnPath = returnPath.replace('/app', '');
          }
        } else {
          const protocol = req.protocol || 'https';
          baseUrl = `${protocol}://${host}`;
        }
        
        if (!returnPath.startsWith('/')) {
          returnPath = '/' + returnPath;
        }
        
        const redirectUrl = `${baseUrl}${returnPath}`;
        return res.redirect(redirectUrl);
      }
      
      // Store tokens in integrationConfig
      await storage.upsertIntegrationConfig({
        service: "gmail",
        config: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
          scope: tokens.scope,
          token_type: tokens.token_type,
        },
        isActive: true,
        orgId: membership.orgId,
      });

      // Get the return URL from session, or default to /integrations
      let returnPath = '/integrations?gmail=connected';
      if (req.session && (req.session as any).gmailOAuthReturnUrl) {
        returnPath = (req.session as any).gmailOAuthReturnUrl;
        // Add the gmail=connected query param if not already present
        if (!returnPath.includes('gmail=')) {
          returnPath += (returnPath.includes('?') ? '&' : '?') + 'gmail=connected';
        }
        // Clear it from session after use
        delete (req.session as any).gmailOAuthReturnUrl;
        delete (req.session as any).gmailOAuthUserId;
      }
      
      // Construct full redirect URL - ALWAYS redirect to app domain, never marketing domain
      const host = req.get('host') || '';
      const isProduction = host.includes('lead2lease.ai');
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes(':5000');
      
      let baseUrl: string;
      if (isLocalhost) {
        // Local development - use localhost with /app prefix
        const protocol = req.protocol || 'http';
        baseUrl = `${protocol}://${host}`;
        // Ensure returnPath has /app prefix for localhost
        if (!returnPath.startsWith('/app')) {
          returnPath = '/app' + (returnPath.startsWith('/') ? returnPath : '/' + returnPath);
        }
      } else if (isProduction) {
        // Production - ALWAYS use app.lead2lease.ai, never the marketing domain
        baseUrl = 'https://app.lead2lease.ai';
        // Remove /app prefix if present since app.lead2lease.ai is already the app domain
        if (returnPath.startsWith('/app')) {
          returnPath = returnPath.replace('/app', '');
        }
      } else {
        // Other environments - use request host
        const protocol = req.protocol || 'https';
        baseUrl = `${protocol}://${host}`;
      }
      
      // Ensure the path starts with /
      if (!returnPath.startsWith('/')) {
        returnPath = '/' + returnPath;
      }
      
      const redirectUrl = `${baseUrl}${returnPath}`;
      console.log("[Gmail OAuth] Successfully connected, redirecting to:", redirectUrl);
      res.redirect(redirectUrl);
    } catch (error) {
      console.error("Gmail OAuth error:", error);
      // Get the return URL from session for error case
      let returnPath = '/integrations?gmail=error';
      if (req.session && (req.session as any).gmailOAuthReturnUrl) {
        returnPath = (req.session as any).gmailOAuthReturnUrl;
        if (!returnPath.includes('gmail=')) {
          returnPath += (returnPath.includes('?') ? '&' : '?') + 'gmail=error';
        }
        delete (req.session as any).gmailOAuthReturnUrl;
        delete (req.session as any).gmailOAuthUserId;
      }
      
      // Construct redirect URL for error - ALWAYS redirect to app domain
      const host = req.get('host') || '';
      const isProduction = host.includes('lead2lease.ai');
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes(':5000');
      
      let baseUrl: string;
      if (isLocalhost) {
        const protocol = req.protocol || 'http';
        baseUrl = `${protocol}://${host}`;
        if (!returnPath.startsWith('/app')) {
          returnPath = '/app' + (returnPath.startsWith('/') ? returnPath : '/' + returnPath);
        }
      } else if (isProduction) {
        baseUrl = 'https://app.lead2lease.ai';
        if (returnPath.startsWith('/app')) {
          returnPath = returnPath.replace('/app', '');
        }
      } else {
        const protocol = req.protocol || 'https';
        baseUrl = `${protocol}://${host}`;
      }
      
      if (!returnPath.startsWith('/')) {
        returnPath = '/' + returnPath;
      }
      
      const redirectUrl = `${baseUrl}${returnPath}`;
      console.log("[Gmail OAuth] Error occurred, redirecting to:", redirectUrl);
      res.redirect(redirectUrl);
    }
  });

  // ===== FACEBOOK OAUTH ROUTES =====
  app.get("/api/integrations/facebook/auth", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("[Facebook OAuth] Generating auth URL for user:", userId);
      const authUrl = getFacebookAuthUrl(userId);
      console.log("[Facebook OAuth] Generated auth URL:", authUrl);
      res.json({ url: authUrl });
    } catch (error: any) {
      console.error("[Facebook OAuth] Failed to generate auth URL:", error);
      res.status(500).json({ error: error.message || "Failed to generate auth URL" });
    }
  });

  app.get("/api/integrations/facebook/callback", isAuthenticated, async (req, res) => {
    try {
      const { code, state: userId } = req.query;
      
      if (!code) {
        return res.redirect("/settings?facebook=error&reason=no_code");
      }

      // Validate state parameter for CSRF protection
      if (!userId || userId !== req.user.id) {
        console.error("[Facebook OAuth] State validation failed - potential CSRF attack");
        return res.redirect("/settings?facebook=error&reason=invalid_state");
      }

      console.log("[Facebook OAuth] Callback received, state validated, exchanging code for token");

      // Exchange code for user access token
      const tokens = await getFacebookTokensFromCode(code as string);
      
      // Get user's organization
      const membership = await storage.getUserOrganization(req.user.id);
      if (!membership) {
        return res.redirect("/settings?facebook=error&reason=no_org");
      }

      console.log("[Facebook OAuth] Fetching user's Facebook pages...");
      
      // Get user's Facebook pages
      const pages = await getFacebookPages(tokens.access_token);
      
      if (pages.length === 0) {
        console.log("[Facebook OAuth] No pages found for user");
        return res.redirect("/settings?facebook=error&reason=no_pages");
      }

      console.log(`[Facebook OAuth] Found ${pages.length} pages`);

      // For now, use the first page (in future, let user select)
      const selectedPage = pages[0];
      
      // Page access tokens from the /me/accounts endpoint are already long-lived
      // but we can exchange them again to ensure they're long-lived
      let pageAccessToken = selectedPage.access_token;
      
      try {
        const longLivedToken = await getLongLivedPageAccessToken(pageAccessToken);
        pageAccessToken = longLivedToken.access_token;
        console.log("[Facebook OAuth] Exchanged for long-lived page access token");
      } catch (error) {
        console.log("[Facebook OAuth] Page token already long-lived or exchange failed, using existing token");
      }

      // Subscribe the page to webhook events
      try {
        await subscribePage(selectedPage.id, pageAccessToken);
        console.log("[Facebook OAuth] Page subscribed to webhooks");
      } catch (error) {
        console.error("[Facebook OAuth] Failed to subscribe page to webhooks:", error);
        // Continue anyway - admin can manually subscribe in Facebook Developer Console
      }

      // Store the page access token in integration config
      await storage.upsertIntegrationConfig({
        service: "messenger",
        config: {
          pageAccessToken: pageAccessToken,
          pageId: selectedPage.id,
          pageName: selectedPage.name,
          pageCategory: selectedPage.category,
          verifyToken: process.env.MESSENGER_VERIFY_TOKEN || 'leaseloopai_messenger_verify_2024',
          connectedViaOAuth: true
        },
        isActive: true,
        orgId: membership.orgId,
      });

      console.log("[Facebook OAuth] Successfully configured Messenger integration");
      res.redirect("/settings?facebook=connected");
    } catch (error: any) {
      console.error("[Facebook OAuth] Error:", error);
      res.redirect(`/settings?facebook=error&reason=${encodeURIComponent(error.message || 'unknown')}`);
    }
  });

  // ===== GMAIL LEAD SYNC =====
  app.post("/api/leads/sync-from-gmail", isAuthenticated, attachOrgContext, async (req: any, res) => {
    const { syncProgressTracker } = await import("./syncProgress");
    
    try {
      // Reset tracker at the start to clear any stale state
      syncProgressTracker.reset();
      
      // Start with placeholder count (will update once we know total emails)
      syncProgressTracker.start(0);
      syncProgressTracker.updateStep('Initializing sync...');
      
      // Note: We don't return early on cancellation - let it complete with current state
      
      // Get Gmail integration config
      const gmailConfig = await storage.getIntegrationConfig("gmail", req.orgId);
      const tokens = gmailConfig?.config as any;
      if (!gmailConfig || !tokens?.access_token) {
        syncProgressTracker.fail("Gmail not connected");
        return res.status(400).json({ error: "Gmail not connected" });
      }

      syncProgressTracker.addLog('info', '✓ Gmail credentials verified');

      // Get the property manager's Gmail email address to identify outgoing messages
      const propertyManagerEmail = await getGmailUserEmail(tokens);
      syncProgressTracker.addLog('info', `📧 Property manager email: ${propertyManagerEmail}`);

      // Note: We don't return early on cancellation - let it complete with current state

      // Get all properties to match against
      const properties = await storage.getAllProperties(req.orgId);
      syncProgressTracker.addLog('info', `✓ Loaded ${properties.length} properties`);

      // Note: We don't return early on cancellation - let it complete with current state

      // Fetch comprehensive email history (up to 5000 emails)
      syncProgressTracker.addLog('info', '📧 Fetching emails from Gmail...');
      syncProgressTracker.updateStep('Fetching emails from Gmail...');
      const messages = await listMessages(tokens, 5000, () => syncProgressTracker.isCancelled());
      
      // Note: We don't return early on cancellation - let it complete with current state

      // Update total count now that we know how many emails we have (without resetting logs)
      syncProgressTracker.setTotal(messages.length);
      syncProgressTracker.addLog('success', `✓ Fetched ${messages.length} emails`);
      
      // Check if sync was cancelled during fetch and notify user
      if (syncProgressTracker.isCancelled()) {
        syncProgressTracker.addLog('warning', `⚠️ Sync cancelled - processing ${messages.length} fetched emails before stopping...`);
      }
      
      syncProgressTracker.updateStep(`Analyzing ${messages.length} emails with AI...`);
      
      const createdLeads = [];
      const duplicates = [];
      const parseErrors = [];
      const skipped = [];
      const processingLogs = [];
      const leadsWithNewMessages = new Set<string>(); // Track leads that got new messages (new or existing)
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Track threadId -> leadId mapping to ensure all emails in a thread go to same lead
      const threadLeadMap = new Map<string, string>();
      
      // Track email -> leadId mapping to prevent duplicate leads from same email across different threads
      const emailLeadMap = new Map<string, string>();
      
      // Track processed message IDs in this session to prevent duplicates within the same batch
      const processedMessageIds = new Set<string>();

      for (const msg of messages) {
        // Check if sync was cancelled by user
        if (syncProgressTracker.isCancelled()) {
          syncProgressTracker.addLog('warning', '⚠️ Sync cancelled by user');
          break;
        }
        
        if (!msg.id) {
          syncProgressTracker.incrementProcessed();
          continue;
        }
        
        syncProgressTracker.incrementProcessed();
        const current = syncProgressTracker.getProgress().processedEmails;
        
        if (current % 10 === 0 || current === 1) {
          syncProgressTracker.updateStep(`Processing email ${current}/${messages.length}...`);
        }

        // Get full message content first to extract sender/subject for logging
        const fullMessage = await getMessage(tokens, msg.id);
        const headers = fullMessage.payload?.headers || [];
        const from = headers.find((h: any) => h.name === "From")?.value || "";
        const to = headers.find((h: any) => h.name === "To")?.value || "";
        const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
        const threadId = fullMessage.threadId;
        
        // Get the actual email timestamp (Gmail's internalDate is milliseconds since epoch)
        const emailTimestamp = fullMessage.internalDate 
          ? new Date(parseInt(fullMessage.internalDate))
          : new Date();
        
        // Get email body - recursively search for text/plain or text/html in nested parts
        const findBodyPart = (parts: any[], mimeType: string): any => {
          for (const part of parts) {
            if (part.mimeType === mimeType && part.body?.data) {
              return part;
            }
            if (part.parts) {
              const found = findBodyPart(part.parts, mimeType);
              if (found) return found;
            }
          }
          return null;
        };

        let emailBody = "";
        if (fullMessage.payload?.parts) {
          // Prefer text/plain, fallback to text/html
          const textPart = findBodyPart(fullMessage.payload.parts, "text/plain");
          const htmlPart = findBodyPart(fullMessage.payload.parts, "text/html");
          
          if (textPart?.body?.data) {
            emailBody = Buffer.from(textPart.body.data, "base64").toString();
          } else if (htmlPart?.body?.data) {
            // Decode HTML and strip tags for preview
            const htmlContent = Buffer.from(htmlPart.body.data, "base64").toString();
            emailBody = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          }
        } else if (fullMessage.payload?.body?.data) {
          emailBody = Buffer.from(fullMessage.payload.body.data, "base64").toString();
        }

        const emailPreview = emailBody.substring(0, 150).replace(/\n/g, ' ').trim();

        // Check if we already processed this message in this sync session
        if (processedMessageIds.has(msg.id)) {
          duplicates.push({ messageId: msg.id, reason: "Already processed in this session" });
          syncProgressTracker.addLog('warning', `⏭️  Skipped duplicate: "${subject.substring(0, 50)}..."`);
          processingLogs.push({
            status: "duplicate",
            from,
            subject,
            preview: emailPreview,
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        // Mark this message as being processed immediately to prevent duplicates within this batch
        processedMessageIds.add(msg.id);

        // Check if this exact message was already processed in database by externalId (message ID)
        const existingConversation = await storage.getConversationByExternalId(msg.id);
        if (existingConversation) {
          duplicates.push({ messageId: msg.id, reason: "Already processed" });
          syncProgressTracker.addLog('warning', `⏭️  Skipped duplicate: "${subject.substring(0, 50)}..."`);
          processingLogs.push({
            status: "duplicate",
            from,
            subject,
            preview: emailPreview,
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        // Check if this is a reply in an existing thread (new message in existing conversation)
        let threadLead = null;
        if (threadId) {
          threadLead = await storage.getLeadByGmailThreadId(threadId, req.orgId);
          
          if (threadLead) {
            // This is a reply to an existing thread - add it as a new conversation
            // Check if the message is from the property manager (outgoing) or the lead (incoming)
            const isFromPropertyManager = from.toLowerCase().includes(propertyManagerEmail.toLowerCase());
            const conversationType = isFromPropertyManager ? "outgoing" : "received";
            
            console.log(`[Gmail Sender Check] From: "${from}" | Property Manager: "${propertyManagerEmail}" | Match: ${isFromPropertyManager} | Type: ${conversationType}`);
            syncProgressTracker.addLog('info', `💬 Thread reply: Adding ${conversationType} message to lead "${threadLead.name}" (From: ${from.substring(0, 30)}...)`);
            
            // Store the raw email body as-is (including metadata)
            console.log('[Gmail] Raw email body length:', emailBody.length);
            console.log('[Gmail] Body preview:', emailBody.substring(0, 100));
            
            // Extract Message-ID header for email threading
            const messageId = headers.find((h: any) => h.name === "Message-ID")?.value;
            
            // Create conversation record with raw email body
            await storage.createConversation({
              leadId: threadLead.id,
              type: conversationType,
              message: emailBody,
              channel: "email",
              aiGenerated: false,
              externalId: msg.id,
              emailMessageId: messageId,
              emailSubject: cleanEmailSubject(subject),
              sourceIntegration: "gmail",
              createdAt: emailTimestamp,
            });
            
            syncProgressTracker.addLog('success', `✅ Added ${conversationType} reply to conversation for ${threadLead.name}`);
            processingLogs.push({
              status: "thread_reply",
              from,
              subject,
              preview: emailPreview,
              leadName: threadLead.name,
              direction: conversationType,
              timestamp: new Date().toISOString(),
            });
            
            // Skip to next message (no need to create new lead)
            continue;
          }
        }

        try {

          // First, use AI to check if this is a real estate rental inquiry
          const filterPrompt = `Analyze this email and determine if it's a real estate rental/property inquiry from a potential tenant.

Consider it a rental inquiry ONLY if:
- Someone is asking about renting/leasing a property
- Expressing interest in viewing/applying for a rental unit
- Asking about rental availability, pricing, or lease terms
- Responding to a rental listing

DO NOT consider these as rental inquiries:
- Newsletters, marketing emails, promotional content
- Property management software/service emails
- Financial services, loans, credit scores
- Job recruiting, social media notifications
- Any automated/system emails
- Sales/purchase inquiries (buying property)

Email From: ${from}
Subject: ${subject}
Body: ${emailBody.substring(0, 1000)}

Respond with ONLY "YES" if this is a rental inquiry, or "NO" if it's not.`;

          const filterCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: filterPrompt }],
            temperature: 0.1,
          });

          const isRentalInquiry = filterCompletion.choices[0].message.content?.trim().toUpperCase() === "YES";
          
          if (!isRentalInquiry) {
            skipped.push({ messageId: msg.id, reason: "Not a rental inquiry" });
            syncProgressTracker.addLog('info', `⏭️  Skipped: "${subject.substring(0, 50)}..." (not rental)`);
            processingLogs.push({
              status: "skipped",
              from,
              subject,
              preview: emailPreview,
              reason: "Not a rental inquiry",
              timestamp: new Date().toISOString(),
            });
            continue;
          }

          // Now extract detailed lead information
          const parsePrompt = `Extract comprehensive lead information from this rental property inquiry email. Return a JSON object with:

REQUIRED FIELDS:
- firstName (string) - first name of the person
- lastName (string) - last name of the person
- email (string) - extract from sender email address

OPTIONAL CONTACT INFO:
- phone (string) - phone number ONLY if explicitly mentioned in the email body. DO NOT generate or infer phone numbers. If no phone is mentioned, set to null.
- currentAddress (string) - where they currently live
- location (string) - city/area they want to rent in

RENTAL PREFERENCES:
- propertyName (string) - specific property they're asking about
- message (string) - their main inquiry/questions
- moveInDate (string) - when they want to move in
- budget (string) - their monthly rent budget/range
- bedrooms (number) - number of bedrooms needed
- petPolicy (string) - if they mention pets

PROFILE INFORMATION:
- occupation (string) - their job/profession
- employer (string) - company they work for
- income (string) - annual or monthly income if mentioned
- creditScore (string) - credit score if mentioned
- education (string) - education level/degree if mentioned
- householdSize (number) - number of people moving in
- background (string) - any other relevant background info (smoker/non-smoker, lifestyle, etc)

Email From: ${from}
Subject: ${subject}
Body: ${emailBody}

Return ONLY valid JSON. Leave fields empty string "" or null if not found in the email.`;

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: parsePrompt }],
            temperature: 0.3,
          });

          // Strip markdown code blocks if present
          let rawContent = completion.choices[0].message.content || "{}";
          rawContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          
          let parsedData;
          try {
            parsedData = JSON.parse(rawContent);
          } catch (parseError) {
            // If JSON parsing fails, use fallback data (common for reply emails)
            syncProgressTracker.addLog('warning', `⚠️  AI parsing failed, using fallback for "${subject.substring(0, 50)}..."`);
            
            // Determine if this is an outgoing email (from property manager) for fallback
            const isFromPropertyManagerFallback = from.toLowerCase().includes(propertyManagerEmail.toLowerCase());
            const emailSource = isFromPropertyManagerFallback ? to : from;
            
            const extractedEmail = emailSource.match(/<(.+)>/)?.[1] || emailSource;
            const nameParts = emailSource.split('<')[0].trim().replace(/"/g, '').split(' ');
            const fallbackCleanedBody = cleanEmailBody(emailBody);
            parsedData = {
              firstName: nameParts[0] || 'Unknown',
              lastName: nameParts.slice(1).join(' ') || '',
              email: extractedEmail,
              message: fallbackCleanedBody.substring(0, 500),
              phone: null,
              propertyName: null,
              moveInDate: null,
              budget: null,
              bedrooms: null,
              petPolicy: null,
              currentAddress: null,
              location: null,
              occupation: null,
              employer: null,
              income: null,
              creditScore: null,
              education: null,
              householdSize: null,
              background: null
            };
          }
          
          // Determine if this is an outgoing email (from property manager)
          const isFromPropertyManager = from.toLowerCase().includes(propertyManagerEmail.toLowerCase());
          
          // Extract lead email: use "To" for outgoing emails, "From" for incoming
          let leadEmail;
          if (isFromPropertyManager) {
            // Outgoing email - the lead is the recipient
            leadEmail = (to.match(/<(.+)>/)?.[1] || to).toLowerCase().trim();
          } else {
            // Incoming email - the lead is the sender
            leadEmail = (parsedData.email || from.match(/<(.+)>/)?.[1] || from).toLowerCase().trim();
          }
          
          const leadPhone = parsedData.phone?.trim() || "";

          // First check if this thread already has an associated lead
          let existingLead = null;
          if (threadId && threadLeadMap.has(threadId)) {
            const leadId = threadLeadMap.get(threadId)!;
            existingLead = await storage.getLead(leadId, req.orgId);
            syncProgressTracker.addLog('info', `🔗 Thread match: Using existing lead from thread`);
          }
          
          // If not in thread map, check if we've already seen this email in this sync session
          if (!existingLead && emailLeadMap.has(leadEmail)) {
            const leadId = emailLeadMap.get(leadEmail)!;
            existingLead = await storage.getLead(leadId, req.orgId);
            syncProgressTracker.addLog('info', `📧 Email match: Using existing lead from earlier in sync`);
          }
          
          // If not in session maps, check if lead already exists in database by email or phone
          if (!existingLead) {
            existingLead = await storage.getLeadByEmail(leadEmail, req.orgId);
            if (!existingLead && leadPhone) {
              existingLead = await storage.getLeadByPhone(leadPhone, req.orgId);
            }
          }

          let leadToUse;
          if (existingLead) {
            // Update existing lead with any new information
            leadToUse = existingLead;
            syncProgressTracker.addLog('info', `📋 Found existing lead: ${existingLead.name}`);
            
            // Update lead if we have additional information
            const updates: Partial<any> = {};
            if (parsedData.phone && !existingLead.phone) updates.phone = parsedData.phone;
            if (parsedData.income && !existingLead.income) updates.income = parsedData.income;
            if (parsedData.moveInDate && !existingLead.moveInDate) updates.moveInDate = parsedData.moveInDate;
            if (threadId && !existingLead.gmailThreadId) updates.gmailThreadId = threadId;
            
            // Merge profile data
            if (existingLead.profileData) {
              const existingProfile = existingLead.profileData as any;
              const mergedProfile = {
                ...existingProfile,
                ...(parsedData.currentAddress && !existingProfile.currentAddress && { currentAddress: parsedData.currentAddress }),
                ...(parsedData.location && !existingProfile.location && { location: parsedData.location }),
                ...(parsedData.occupation && !existingProfile.occupation && { occupation: parsedData.occupation }),
                ...(parsedData.employer && !existingProfile.employer && { employer: parsedData.employer }),
                ...(parsedData.creditScore && !existingProfile.creditScore && { creditScore: parsedData.creditScore }),
                ...(parsedData.education && !existingProfile.education && { education: parsedData.education }),
                ...(parsedData.householdSize && !existingProfile.householdSize && { householdSize: parsedData.householdSize }),
                ...(parsedData.background && !existingProfile.background && { background: parsedData.background }),
                ...(parsedData.budget && !existingProfile.budget && { budget: parsedData.budget }),
                ...(parsedData.bedrooms && !existingProfile.bedrooms && { bedrooms: parsedData.bedrooms }),
                ...(parsedData.petPolicy && !existingProfile.petPolicy && { petPolicy: parsedData.petPolicy }),
              };
              updates.profileData = mergedProfile;
            }
            
            if (Object.keys(updates).length > 0) {
              await storage.updateLead(existingLead.id, updates, req.orgId);
              syncProgressTracker.addLog('info', `✏️  Updated lead info for ${existingLead.name}`);
            }
          } else {
            // Match property if mentioned
            let matchedProperty = null;
            if (parsedData.propertyName) {
              matchedProperty = properties.find(p => 
                p.name.toLowerCase().includes(parsedData.propertyName.toLowerCase()) ||
                parsedData.propertyName.toLowerCase().includes(p.name.toLowerCase())
              );
            }

            // Create new lead with comprehensive profile data and gmailThreadId
            leadToUse = await storage.createLead({
              name: `${parsedData.firstName} ${parsedData.lastName}`.trim(),
              email: leadEmail,
              phone: leadPhone,
              propertyId: matchedProperty?.id || properties[0]?.id || null,
              propertyName: matchedProperty?.name || parsedData.propertyName || "Not specified",
              status: "new",
              source: "gmail",
              gmailThreadId: threadId || null,
              income: parsedData.income || null,
              moveInDate: parsedData.moveInDate || null,
              profileData: {
                currentAddress: parsedData.currentAddress || null,
                location: parsedData.location || null,
                occupation: parsedData.occupation || null,
                employer: parsedData.employer || null,
                creditScore: parsedData.creditScore || null,
                education: parsedData.education || null,
                householdSize: parsedData.householdSize || null,
                background: parsedData.background || null,
                budget: parsedData.budget || null,
                bedrooms: parsedData.bedrooms || null,
                petPolicy: parsedData.petPolicy || null,
              },
              orgId: req.orgId,
            });
            syncProgressTracker.addLog('success', `✅ Created new lead: ${leadToUse.name}`);
            syncProgressTracker.addCreatedLeadId(leadToUse.id); // Track this lead for current sync
          }

          // Store threadId -> leadId mapping for future emails in this thread
          if (threadId) {
            threadLeadMap.set(threadId, leadToUse.id);
          }
          
          // Store email -> leadId mapping to prevent duplicate leads from same email
          if (leadEmail) {
            emailLeadMap.set(leadEmail, leadToUse.id);
          }

          // Store the raw email body as-is (including metadata)
          console.log('[Gmail Initial] Raw body length:', emailBody.length);
          console.log('[Gmail Initial] Body preview:', emailBody.substring(0, 100));
          
          // Detect if the initial message is from the property manager (outgoing) or lead (received)
          const initialIsFromPM = from.toLowerCase().includes(propertyManagerEmail.toLowerCase());
          const initialMessageType = initialIsFromPM ? "outgoing" : "received";
          console.log(`[Gmail Initial Sender] From: "${from}" | Property Manager: "${propertyManagerEmail}" | Match: ${initialIsFromPM} | Type: ${initialMessageType}`);
          
          // Extract Message-ID header for email threading
          const messageId = headers.find((h: any) => h.name === "Message-ID")?.value;
          
          // Create conversation record with raw email body
          await storage.createConversation({
            leadId: leadToUse.id,
            type: initialMessageType,
            message: emailBody,
            channel: "email",
            aiGenerated: false,
            externalId: msg.id,
            emailMessageId: messageId,
            emailSubject: cleanEmailSubject(subject),
            sourceIntegration: "gmail",
            createdAt: emailTimestamp,
          });

          // Generate AI reply for all leads
          syncProgressTracker.addLog('info', `🤖 Generating AI reply for ${leadToUse.name}...`);
            
            // Get thread ID for proper email threading
            const threadId = fullMessage.threadId;

            // Get calendar availability context
            const availabilityContext = await getAvailabilityContext();

            // Generate AI reply based on the lead's inquiry
            const replyPrompt = `You are a professional property manager responding to a rental inquiry. 
            
Lead Information:
- Name: ${leadToUse.name}
- Property Interested In: ${leadToUse.propertyName}
- Move-in Date: ${parsedData.moveInDate || 'Not specified'}
- Budget: ${parsedData.budget || 'Not specified'}
- Their Message: ${parsedData.message || emailBody.substring(0, 500)}

${availabilityContext}

Write a friendly, professional email response that:
1. Thanks them for their interest
2. Confirms receipt of their inquiry
3. Briefly addresses their specific questions or needs
4. If they're asking about viewing/showing times, suggest specific available times based on the calendar above
5. Mentions next steps (viewing, application, etc.)
6. Signs off warmly

Keep it concise (3-4 paragraphs). Write only the email body, no subject line.`;

            const replyCompletion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: replyPrompt }],
              temperature: 0.7,
            });

            const aiReplyContent = replyCompletion.choices[0].message.content || "";

            // Check if auto-pilot mode is enabled and apply rules
            const autoPilotSettings = await storage.getAISettings("automation", req.orgId);
            const autoPilotMode = autoPilotSettings.find(s => s.key === "auto_pilot_mode")?.value === "true";
            
            let shouldAutoSend = false;
            let autoPilotDecision: { shouldAutoSend: boolean; reason: string; confidence: string } | null = null;
            let messageAnalysis: { questionType: string; confidence: string; reasoning: string } | null = null;
            
            if (autoPilotMode) {
              // Import auto-pilot rules
              const { analyzeMessageForAutoPilot, shouldAutoSend: shouldAutoSendCheck } = await import("./autoPilotRules");
              
              // Analyze the incoming message
              messageAnalysis = await analyzeMessageForAutoPilot(emailBody, openai);
              
              // Get organization for timezone
              const organization = await storage.getOrganization(req.orgId);
              
              // Build auto-pilot settings object
              const autoPilotConfig: any = {
                enabled: true,
                businessHoursOnly: autoPilotSettings.find(s => s.key === "auto_pilot_business_hours_enabled")?.value === "true",
                businessHoursStart: autoPilotSettings.find(s => s.key === "auto_pilot_business_hours_start")?.value || "09:00",
                businessHoursEnd: autoPilotSettings.find(s => s.key === "auto_pilot_business_hours_end")?.value || "17:00",
                businessDays: parseArraySetting(
                  autoPilotSettings.find(s => s.key === "auto_pilot_business_days")?.value,
                  ["monday", "tuesday", "wednesday", "thursday", "friday"]
                ),
                allowedQuestionTypes: parseArraySetting(
                  autoPilotSettings.find(s => s.key === "auto_pilot_question_types")?.value,
                  ["availability", "pricing", "general"]
                ),
                minConfidenceLevel: (autoPilotSettings.find(s => s.key === "auto_pilot_min_confidence")?.value || "high") as "high" | "medium" | "low",
                timezone: organization?.timezone || "America/Chicago",
              };
              
              // Check if should auto-send
              autoPilotDecision = shouldAutoSendCheck(autoPilotConfig, messageAnalysis);
              shouldAutoSend = autoPilotDecision.shouldAutoSend;
            }

            if (shouldAutoSend && autoPilotDecision) {
              // Auto-pilot: Send email immediately (rules passed)
              syncProgressTracker.addLog('info', `✈️ Auto-pilot mode: Sending reply to ${leadToUse.name}...`);
              syncProgressTracker.addLog('info', `   Reason: ${autoPilotDecision.reason}`);
              syncProgressTracker.addLog('info', `   Confidence: ${messageAnalysis?.confidence || "medium"}`);
              
              await sendReply(tokens, {
                to: leadToUse.email,
                subject: subject,
                body: aiReplyContent,
                threadId: threadId || undefined,
                inReplyTo: messageId || undefined,
                references: messageId || undefined,
              });

              // Record conversation - NO pending reply creation for auto-pilot
              await storage.createConversation({
                leadId: leadToUse.id,
                type: 'outgoing',
                channel: 'email',
                message: aiReplyContent,
                aiGenerated: true,
                deliveryStatus: 'sent',
              });

              syncProgressTracker.addLog('success', `✅ AI reply sent automatically to ${leadToUse.name} (${autoPilotDecision.reason})`);
            } else {
              // Manual approval mode (co-pilot) or auto-pilot blocked: Create pending reply
              const blockedReason = autoPilotMode && !shouldAutoSend 
                ? `Auto-pilot blocked: ${autoPilotDecision?.reason || "Rules not met"}` 
                : "Co-pilot mode (requires approval)";
              syncProgressTracker.addLog('info', `📋 ${blockedReason} - Creating pending reply for ${leadToUse.name}`);
              
              // Use fallback email for Facebook leads that don't have an email
              const leadEmailForPending = leadToUse.email || (leadToUse.source === 'facebook' 
                ? `facebook-${leadToUse.externalId || leadToUse.id}@facebook.local` 
                : `lead-${leadToUse.id}@local`);
              
              await storage.createPendingReply({
                orgId: req.orgId,
                leadId: leadToUse.id,
                leadName: leadToUse.name,
                leadEmail: leadEmailForPending,
                subject: subject,
                content: aiReplyContent,
                originalMessage: emailBody,
                channel: 'email',
                status: 'pending',
                threadId: threadId || undefined,
                inReplyTo: messageId || undefined,
                references: messageId || undefined,
                metadata: {
                  originalContent: aiReplyContent,
                  editedByUser: false,
                  sentViaAutoPilot: false,
                  autoPilotBlocked: autoPilotMode && !shouldAutoSend,
                  autoPilotReason: autoPilotDecision?.reason,
                  confidenceLevel: messageAnalysis?.confidence,
                  questionType: messageAnalysis?.questionType,
                } as any,
              });

              syncProgressTracker.addLog('success', `✅ AI reply generated for ${leadToUse.name} (pending approval)`);
            }

          // Track created/updated leads
          if (!existingLead) {
            createdLeads.push({
              leadId: leadToUse.id,
              name: leadToUse.name,
              email: leadToUse.email,
              subject,
            });
            syncProgressTracker.addLog('success', `✅ Processed: ${leadToUse.name} - "${subject.substring(0, 40)}..."`);
          } else {
            syncProgressTracker.addLog('success', `✅ Added message to existing lead: ${leadToUse.name} - "${subject.substring(0, 40)}..."`);
          }
          
          // Track all leads that got new messages (both new and existing)
          leadsWithNewMessages.add(leadToUse.id);

          processingLogs.push({
            status: "success",
            from,
            subject,
            preview: emailPreview,
            leadName: leadToUse.name,
            timestamp: new Date().toISOString(),
          });

        } catch (processingError: any) {
          const errorMsg = processingError.message || String(processingError);
          parseErrors.push({ messageId: msg.id, error: errorMsg });
          syncProgressTracker.addLog('error', `❌ Failed to process: "${subject.substring(0, 40)}..." - ${errorMsg.substring(0, 100)}`);
          console.error(`[Gmail Sync] Error processing email "${subject}":`, processingError);
          processingLogs.push({
            status: "error",
            from,
            subject,
            preview: emailPreview,
            error: errorMsg,
            timestamp: new Date().toISOString(),
          });
          // Continue processing remaining messages
        }
      }

      // Log the raw counts before computing summary
      console.log(`[Gmail Sync Summary] createdLeads.length: ${createdLeads.length}`);
      console.log(`[Gmail Sync Summary] leadsWithNewMessages.size: ${leadsWithNewMessages.size}`);
      console.log(`[Gmail Sync Summary] createdLeads:`, createdLeads.map(l => ({ name: l.name, email: l.email })));
      console.log(`[Gmail Sync Summary] leadsWithNewMessages IDs:`, Array.from(leadsWithNewMessages));

      const summary = {
        created: createdLeads.length,
        updated: leadsWithNewMessages.size - createdLeads.length, // Leads that got new messages but weren't newly created
        total: leadsWithNewMessages.size, // Total leads affected (new + updated)
        duplicates: duplicates.length,
        skipped: skipped.length,
        errors: parseErrors.length,
      };

      console.log(`[Gmail Sync Summary] Final summary:`, summary);

      syncProgressTracker.complete(summary);
      syncProgressTracker.addLog('success', `✅ Sync complete! ${summary.total} leads imported (${summary.created} new, ${summary.updated} updated) from ${messages.length} emails`);

      // Clear notified threads for ALL synced leads (both new and updated)
      const syncedLeadIds = Array.from(leadsWithNewMessages);
      const syncedThreadIds: string[] = [];
      
      for (const leadId of syncedLeadIds) {
        const lead = await storage.getLead(leadId, req.orgId);
        if (lead?.gmailThreadId) {
          syncedThreadIds.push(lead.gmailThreadId);
        }
      }
      
      if (syncedThreadIds.length > 0) {
        await gmailScanner.clearNotifiedThreads(req.orgId, syncedThreadIds);
      }

      // Mark all gmail_new_leads notifications for this org as read
      const gmailNotifications = await storage.getUserNotifications(req.user.id, req.orgId);
      const gmailNewLeadsNotifications = gmailNotifications.filter(n => n.type === 'gmail_new_leads' && !n.read);
      
      for (const notification of gmailNewLeadsNotifications) {
        await storage.markNotificationAsRead(notification.id, req.user.id);
      }

      const responseData = {
        success: true,
        createdLeads,
        duplicates,
        skipped,
        parseErrors,
        processingLogs,
        total: messages.length,
        summary,
        isCancelled: syncProgressTracker.isCancelled(),
      };
      
      console.log('[Gmail Sync Response] Sending response:', {
        isCancelled: responseData.isCancelled,
        summary: responseData.summary,
        total: responseData.total,
      });
      
      res.json(responseData);

    } catch (error) {
      syncProgressTracker.fail(String(error));
      console.error("Gmail sync error:", error);
      res.status(500).json({ error: "Failed to sync Gmail messages" });
    }
  });

  // ===== OUTLOOK OAUTH ROUTES =====
  app.get("/api/integrations/outlook/auth", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("[Outlook OAuth] Generating auth URL for user:", userId);
      const authUrl = getOutlookAuthUrl(userId);
      console.log("[Outlook OAuth] Generated auth URL:", authUrl);
      res.json({ url: authUrl });
    } catch (error) {
      console.error("[Outlook OAuth] Failed to generate auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.get("/api/integrations/outlook/callback", async (req, res) => {
    try {
      console.log("[Outlook Callback] Received callback with query:", req.query);
      const { code, state: userId, error, error_description } = req.query;
      
      if (error) {
        console.error("[Outlook Callback] OAuth error:", error, error_description);
        return res.redirect("/integrations?outlook=error&reason=" + error);
      }
      
      if (!code) {
        console.error("[Outlook Callback] No authorization code provided");
        return res.status(400).send("Authorization code missing");
      }

      if (!userId) {
        console.error("[Outlook Callback] No user ID in state parameter");
        return res.redirect("/integrations?outlook=error&reason=no_user");
      }

      console.log("[Outlook Callback] Exchanging code for tokens for user:", userId);
      // Exchange code for tokens
      const tokens = await getOutlookTokensFromCode(code as string);
      console.log("[Outlook Callback] Received tokens, scopes:", tokens.scope);

      // Get user's organization
      const membership = await storage.getUserOrganization(userId as string);
      if (!membership) {
        console.error("[Outlook Callback] No organization found for user:", userId);
        return res.redirect("/integrations?outlook=error&reason=no_org");
      }
      
      console.log("[Outlook Callback] Storing tokens for org:", membership.orgId);
      // Store tokens in integrationConfig
      await storage.upsertIntegrationConfig({
        service: "outlook",
        config: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type,
          scope: tokens.scope,
        },
        isActive: true,
        orgId: membership.orgId,
      });

      console.log("[Outlook Callback] Successfully stored Outlook integration");
      // Redirect back to integrations page with success message
      res.redirect("/integrations?outlook=connected");
    } catch (error) {
      console.error("[Outlook Callback] Error:", error);
      res.redirect("/integrations?outlook=error");
    }
  });

  // Disconnect Outlook integration
  app.post("/api/integrations/outlook/disconnect", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { deleteLeads } = req.body;
      
      // Deactivate the integration
      const outlookConfig = await storage.getIntegrationConfig("outlook", req.orgId);
      if (outlookConfig) {
        await storage.upsertIntegrationConfig({
          service: "outlook",
          config: outlookConfig.config as any,
          isActive: false,
          orgId: req.orgId,
        });
      }

      // Optionally delete Outlook-sourced leads
      if (deleteLeads) {
        const leads = await storage.getAllLeads(req.orgId);
        const outlookLeads = leads.filter(l => l.source === 'outlook');
        
        for (const lead of outlookLeads) {
          await storage.deleteLead(lead.id, req.orgId);
        }
        
        console.log(`[Outlook] Deleted ${outlookLeads.length} Outlook-sourced leads for org ${req.orgId}`);
      }

      res.json({ success: true, message: "Outlook disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting Outlook:", error);
      res.status(500).json({ error: "Failed to disconnect Outlook" });
    }
  });

  // ===== FACEBOOK MESSENGER WEBHOOK =====
  // Webhook verification (GET) - Facebook will call this to verify your webhook
  app.get("/api/integrations/messenger/webhook", async (req: any, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    console.log('[Messenger Webhook] Verification request:', { mode, token, challenge: challenge ? 'present' : 'missing' });
    
    // Use a static verify token from environment or default
    // Users must use THIS EXACT TOKEN when setting up webhook in Facebook Developer Console
    const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN || 'leaseloopai_messenger_verify_2024';
    
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Messenger Webhook] ✅ Verification successful');
      res.status(200).send(challenge);
    } else {
      console.log('[Messenger Webhook] ❌ Verification failed');
      res.sendStatus(403);
    }
  });

  // Webhook event receiver (POST) - Facebook sends messages here
  app.post("/api/integrations/messenger/webhook", async (req: any, res) => {
    console.log('[Messenger Webhook] Received event:', JSON.stringify(req.body, null, 2));
    
    try {
      const messages = parseMessengerWebhook(req.body);
      
      for (const msg of messages) {
        console.log('[Messenger] Processing message:', msg);
        
        // Get page access token from integration config
        // For now, we'll need to match by recipient ID (page ID)
        const allConfigs = await storage.getAllMessengerIntegrations();
        const config = allConfigs.find((c: any) => c.config?.pageId === msg.recipientId);
        
        if (!config || !config.isActive) {
          console.log('[Messenger] No active config found for page:', msg.recipientId);
          continue;
        }
        
        const pageAccessToken = config.config.pageAccessToken;
        
        // Get or create lead
        let lead = await storage.getLeadByExternalId(`messenger_${msg.senderId}`, config.orgId);
        
        if (!lead) {
          // Get user profile from Messenger
          try {
            const profile = await getMessengerUserProfile(msg.senderId, pageAccessToken);
            
            lead = await storage.createLead({
              name: `${profile.first_name} ${profile.last_name}`.trim() || 'Unknown',
              email: null,
              phone: null,
              source: 'messenger',
              status: 'new',
              externalId: `messenger_${msg.senderId}`,
              metadata: {
                messenger_id: msg.senderId,
                profile_pic: profile.profile_pic
              },
              orgId: config.orgId,
            });
            
            console.log('[Messenger] Created new lead:', lead.id);
          } catch (profileError) {
            console.error('[Messenger] Failed to get profile, creating basic lead:', profileError);
            
            lead = await storage.createLead({
              name: 'Facebook User',
              email: null,
              phone: null,
              source: 'messenger',
              status: 'new',
              externalId: `messenger_${msg.senderId}`,
              metadata: { messenger_id: msg.senderId },
              orgId: config.orgId,
            });
          }
        }
        
        // Store conversation
        await storage.createConversation({
          leadId: lead.id,
          type: 'incoming',
          channel: 'messenger',
          message: msg.text,
          externalId: msg.messageId,
        });
        
        console.log('[Messenger] Stored conversation for lead:', lead.id);
        
        // Load AI training/settings before responding (must be read prior to any reply)
        const aiTrainingSettings = await storage.getAISettings(
          "ai_training",
          config.orgId
        );
        console.log("[Messenger] Loaded AI training settings:", aiTrainingSettings);

        // TODO: Generate AI response if auto-respond enabled (use aiTrainingSettings for prompt/context)
        // For now, just acknowledge receipt
      }
      
      // CRITICAL: Must return 200 within 20 seconds
      res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('[Messenger Webhook] Error processing event:', error);
      // Still return 200 to prevent Facebook from retrying
      res.status(200).send('EVENT_RECEIVED');
    }
  });

  // Get Messenger integration status
  app.get("/api/integrations/messenger", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const config = await storage.getIntegrationConfig("messenger", req.orgId);
      
      if (!config || !config.isActive) {
        return res.json({ connected: false });
      }
      
      const messengerConfig = config.config as any;
      return res.json({
        connected: true,
        pageName: messengerConfig.pageName,
        pageId: messengerConfig.pageId,
        id: config.id,
        isActive: config.isActive,
      });
    } catch (err) {
      console.error('[Messenger] Error fetching status:', err);
      return res.json({ connected: false });
    }
  });

  // Configure Messenger integration
  app.post("/api/integrations/messenger/configure", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { pageAccessToken, verifyToken, pageName, pageId } = req.body;
      
      if (!pageAccessToken || !verifyToken) {
        return res.status(400).json({ error: 'Page access token and verify token are required' });
      }
      
      await storage.upsertIntegrationConfig({
        service: 'messenger',
        config: {
          pageAccessToken,
          verifyToken,
          pageName: pageName || 'Facebook Page',
          pageId: pageId || 'unknown'
        },
        isActive: true,
        orgId: req.orgId,
      });
      
      res.json({ success: true, message: 'Messenger configured successfully' });
    } catch (error) {
      console.error('[Messenger] Configuration error:', error);
      res.status(500).json({ error: 'Failed to configure Messenger' });
    }
  });

  // Disconnect Messenger integration
  app.post("/api/integrations/messenger/disconnect", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { deleteLeads } = req.body;
      
      const config = await storage.getIntegrationConfig("messenger", req.orgId);
      if (config) {
        await storage.upsertIntegrationConfig({
          service: "messenger",
          config: config.config as any,
          isActive: false,
          orgId: req.orgId,
        });
      }

      if (deleteLeads) {
        const leads = await storage.getAllLeads(req.orgId);
        const messengerLeads = leads.filter(l => l.source === 'messenger');
        
        for (const lead of messengerLeads) {
          await storage.deleteLead(lead.id, req.orgId);
        }
        
        console.log(`[Messenger] Deleted ${messengerLeads.length} Messenger leads for org ${req.orgId}`);
      }

      res.json({ success: true, message: "Messenger disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting Messenger:", error);
      res.status(500).json({ error: "Failed to disconnect Messenger" });
    }
  });

  // ===== FACEBOOK MARKETPLACE INTEGRATION (PERSISTENT SESSION) =====
  
  /**
   * GET /api/integrations/facebook/status
   * Get Facebook Marketplace integration status (server-persisted)
   * Returns: { connected: boolean, lastVerifiedAt?: string, lastError?: string, accountIdentifier?: string }
   */
  app.get("/api/integrations/facebook/status", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      console.log('[Facebook Status NEW] ===== GET STATUS REQUEST =====');
      console.log('[Facebook Status NEW] OrgId:', req.orgId);
      console.log('[Facebook Status NEW] User:', req.user?.id);
      
      if (!req.orgId) {
        console.error('[Facebook Status NEW] ❌ No orgId');
        return res.status(400).json({ error: 'No organization context' });
      }
      
      const { getFacebookMarketplaceStatus } = await import('./facebookMarketplaceService');
      const status = await getFacebookMarketplaceStatus(req.orgId);
      
      console.log('[Facebook Status NEW] ✅ Status result:', JSON.stringify(status, null, 2));
      console.log('[Facebook Status NEW] ===== END GET STATUS =====');
      
      res.json(status);
    } catch (error: any) {
      console.error('[Facebook Status NEW] ❌ Error:', error);
      res.status(500).json({ error: 'Failed to get status', message: error.message });
    }
  });

  /**
   * POST /api/integrations/facebook/connect
   * Connect to Facebook Marketplace (runs Playwright login and saves session)
   * Body: { email: string, password: string }
   * Returns: { success: boolean, error?: string, accountIdentifier?: string }
   */
  app.post("/api/integrations/facebook/connect", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      console.log('[Facebook Connect NEW] ===== CONNECT REQUEST =====');
      console.log('[Facebook Connect NEW] OrgId:', req.orgId);
      console.log('[Facebook Connect NEW] User:', req.user?.id);
      console.log('[Facebook Connect NEW] Email:', req.body.email);
      
      if (!req.orgId) {
        console.error('[Facebook Connect NEW] ❌ No orgId');
        return res.status(400).json({ error: 'No organization context' });
      }
      
      let email = req.body.email;
      let password = req.body.password;

      if (!email || !password) {
        console.error('[Facebook Connect NEW] ❌ Missing credentials');
        return res.status(400).json({ error: 'Email and password are required' });
      }
      
      // Password validation
      if (password.length < 6) {
        console.error('[Facebook Connect NEW] ❌ Password too short');
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      
      console.log('[Facebook Connect NEW] Starting Playwright connection...');
      const { connectFacebookMarketplace } = await import('./facebookMarketplaceService');
      const result = await connectFacebookMarketplace(req.orgId, email, password);
      
      console.log('[Facebook Connect NEW] Connection result:', JSON.stringify(result, null, 2));
      
      if (result.success) {
        let credentialsInKeyVault = false;
        try {
          const { storeFacebookCredentials } = await import('./facebookAuthSecrets.service');
          if (req.user?.id) {
            await storeFacebookCredentials(req.user.id, req.orgId, email, password);
            credentialsInKeyVault = true;
          }
        } catch (kvErr: any) {
          console.error('[Facebook Connect NEW] Key Vault store failed:', kvErr?.message);
        }
        await storage.upsertIntegrationConfig({
          service: 'facebook-marketplace',
          orgId: req.orgId,
          config: {
            connected: true,
            accountIdentifier: result.accountIdentifier,
            lastVerifiedAt: new Date().toISOString(),
            credentialsInKeyVault,
          },
          isActive: true,
        });
        // Zero out credentials in-memory after use (never return to client or logs)
        email = '';
        password = '';
        console.log('[Facebook Connect NEW] ✅ Connection successful');
        console.log('[Facebook Connect NEW] ===== END CONNECT =====');
        res.json({ success: true, accountIdentifier: result.accountIdentifier });
      } else {
        console.error('[Facebook Connect NEW] ❌ Connection failed:', result.error);
        console.log('[Facebook Connect NEW] ===== END CONNECT =====');
        res.status(401).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error('[Facebook Connect NEW] ❌ Exception:', error);
      console.log('[Facebook Connect NEW] ===== END CONNECT =====');
      res.status(500).json({ error: 'Connection failed', message: error.message });
    }
  });

  /**
   * POST /api/integrations/facebook/verify
   * Verify Facebook Marketplace session (checks if storageState is still valid)
   * Returns: { success: boolean, error?: string }
   */
  app.post("/api/integrations/facebook/verify", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      if (!req.orgId) {
        return res.status(400).json({ error: 'No organization context' });
      }
      
      const { verifyFacebookMarketplace } = await import('./facebookMarketplaceService');
      const result = await verifyFacebookMarketplace(req.orgId);
      
      res.json(result);
    } catch (error: any) {
      console.error('[Facebook Verify] Error:', error);
      res.status(500).json({ error: 'Verification failed', message: error.message });
    }
  });

  /**
   * POST /api/integrations/facebook/disconnect
   * Disconnect Facebook Marketplace (deletes storageState and updates status)
   * Returns: { success: boolean }
   */
  app.post("/api/integrations/facebook/disconnect", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      if (!req.orgId) {
        return res.status(400).json({ error: 'No organization context' });
      }
      const { deleteFacebookCredentials } = await import('./facebookAuthSecrets.service');
      if (req.user?.id) {
        await deleteFacebookCredentials(req.user.id, req.orgId);
      }
      const { disconnectFacebookMarketplace } = await import('./facebookMarketplaceService');
      await disconnectFacebookMarketplace(req.orgId);
      await storage.upsertIntegrationConfig({
        service: 'facebook-marketplace',
        orgId: req.orgId,
        config: {},
        isActive: false,
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Facebook Disconnect] Error:', error);
      res.status(500).json({ error: 'Disconnect failed', message: error.message });
    }
  });
  
  // ===== LEGACY FACEBOOK MARKETPLACE ROUTES (deprecated, kept for backward compatibility) =====
  
  // Get Facebook Marketplace integration status (LEGACY)
  app.get("/api/integrations/facebook-marketplace", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      console.log('[Facebook Marketplace GET LEGACY] ===== Fetching config =====');
      console.log('[Facebook Marketplace GET LEGACY] ⚠️  WARNING: Using LEGACY endpoint. Use /api/integrations/facebook/status for persistent sessions.');
      console.log('[Facebook Marketplace GET LEGACY] User ID:', req.user?.id);
      console.log('[Facebook Marketplace GET LEGACY] Org ID from context:', req.orgId);
      console.log('[Facebook Marketplace GET LEGACY] User currentOrgId:', req.user?.currentOrgId);
      
      // Ensure we have an orgId
      if (!req.orgId) {
        console.error('[Facebook Marketplace GET] ❌ No orgId in request context');
        return res.json({ connected: false, isActive: false, error: 'No organization context' });
      }
      
      const config = await storage.getIntegrationConfig("facebook-marketplace", req.orgId);
      
      console.log('[Facebook Marketplace GET] Config found:', !!config);
      if (config) {
        console.log('[Facebook Marketplace GET] Config details:', {
          id: config.id,
          service: config.service,
          orgId: config.orgId,
          isActive: config.isActive,
          hasEmail: !!(config.config as any)?.email,
          hasPassword: !!(config.config as any)?.password,
          updatedAt: config.updatedAt,
        });
        
        // Verify orgId matches
        if (config.orgId !== req.orgId) {
          console.error('[Facebook Marketplace GET] ❌ OrgId mismatch! Config orgId:', config.orgId, 'Request orgId:', req.orgId);
          return res.json({ connected: false, isActive: false, error: 'Organization mismatch' });
        }
      } else {
        console.log('[Facebook Marketplace GET] No config found for orgId:', req.orgId);
        // Debug: Check if config exists for other orgs
        const allConfigs = await db.select().from(integrationConfig).where(eq(integrationConfig.service, "facebook-marketplace"));
        console.log('[Facebook Marketplace GET] All facebook-marketplace configs in DB:', allConfigs.map(c => ({ id: c.id, orgId: c.orgId, isActive: c.isActive })));
      }
      
      // Check if config exists and is active
      if (!config) {
        console.log('[Facebook Marketplace GET] No config found - returning: { connected: false, isActive: false }');
        return res.json({ connected: false, isActive: false });
      }
      
      console.log('[Facebook Marketplace GET] Config found - isActive:', config.isActive);
      
      if (!config.isActive) {
        console.log('[Facebook Marketplace GET] Config exists but isActive is false - returning: { connected: false, isActive: false }');
        return res.json({ connected: false, isActive: false });
      }
      
      const marketplaceConfig = config.config as any;
      const credentialsInKeyVault = marketplaceConfig?.credentialsInKeyVault === true;

      // Connected if we have session/connection; credentials may be in Key Vault (never returned)
      const hasStoredCredentials = credentialsInKeyVault
        || (!!marketplaceConfig?.email && !!marketplaceConfig?.password);
      if (!hasStoredCredentials) {
        console.log('[Facebook Marketplace GET] Config exists but credentials missing (and not in Key Vault)');
        return res.json({ connected: false, isActive: false });
      }

      // Never return actual email/password to UI or API
      const response = {
        connected: true,
        email: 'Saved (encrypted)',
        id: config.id,
        isActive: config.isActive,
      };
      
      console.log('[Facebook Marketplace GET] ✅ Returning success response:', JSON.stringify(response, null, 2));
      console.log('[Facebook Marketplace GET] ===== Config fetch complete =====');
      
      return res.json(response);
    } catch (err: any) {
      console.error('[Facebook Marketplace GET] ❌ Error fetching status:', err);
      console.error('[Facebook Marketplace GET] Error stack:', err?.stack);
      return res.json({ connected: false, isActive: false, error: err?.message });
    }
  });

  // Test Facebook Marketplace connection (LEGACY)
  app.post("/api/integrations/facebook-marketplace/test", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      console.log('[Facebook Marketplace Test LEGACY] ===== TEST CONNECTION =====');
      console.log('[Facebook Marketplace Test LEGACY] ⚠️  WARNING: Using LEGACY endpoint. Use /api/integrations/facebook/connect for persistent sessions.');
      
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Use dynamic import for Playwright (ES module)
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: false }); // Show browser window so user can see the test
      const page = await browser.newPage();
      
      try {
        // Use the exact same login logic as the main Playwright script
        // Helper function for random delay (2-3 seconds)
        const randomDelay = () => Math.floor(Math.random() * 1000) + 2000;
        
        console.log('[Facebook Marketplace Test] Starting Facebook navigation and login...');
        console.log(`[Facebook Marketplace Test] Using email: ${email ? email.substring(0, 5) + '***' : 'NOT SET'}`);
        console.log(`[Facebook Marketplace Test] Password set: ${password ? 'YES' : 'NO'}`);
        
        console.log('[Facebook Marketplace Test] Navigating to Facebook...');
        await page.goto('https://www.facebook.com/');
        await page.waitForTimeout(randomDelay());
        
        console.log('[Facebook Marketplace Test] Filling login form...');
        await page.getByTestId('royal-email').fill(email);
        await page.waitForTimeout(randomDelay());
        await page.getByTestId('royal-pass').fill(password);
        await page.waitForTimeout(randomDelay());
        
        console.log('[Facebook Marketplace Test] Clicking login button...');
        const loginUrlBefore = page.url();
        await page.getByTestId('royal-login-button').click();
        
        // Wait for login to complete - wait for navigation away from login page OR for elements that appear after login
        console.log('[Facebook Marketplace Test] Waiting for login to complete...');
        try {
          // Wait for either URL change OR for elements that appear after login (like the main feed or shortcuts)
          await Promise.race([
            page.waitForURL((url) => !url.pathname.includes('/login') && url.hostname.includes('facebook.com'), { timeout: 30000 }),
            page.waitForSelector('div[role="main"], [aria-label="Shortcuts"], [aria-label="Navigation"]', { timeout: 30000 }),
            page.waitForLoadState('networkidle', { timeout: 30000 }),
          ]);
          console.log('[Facebook Marketplace Test] Login successful, current URL:', page.url());
        } catch (error) {
          // If URL didn't change, check if we're still on login page or if login failed
          const currentUrl = page.url();
          if (currentUrl.includes('/login') || currentUrl === loginUrlBefore) {
            console.error('[Facebook Marketplace Test] Login may have failed - still on login page');
            // Check for error messages
            try {
              const errorElement = await page.locator('[role="alert"], ._4rbf, [data-testid="error"]').first();
              if (await errorElement.isVisible({ timeout: 2000 }).catch(() => false)) {
                const errorText = await errorElement.textContent();
                await browser.close();
                return res.status(401).json({ error: `Facebook login failed: ${errorText}` });
              }
            } catch (e) {
              // No error element found, continue anyway
            }
            await browser.close();
            return res.status(401).json({ error: `Login timeout - URL did not change from login page. Current URL: ${currentUrl}` });
          }
          console.log('[Facebook Marketplace Test] Login appears successful (URL changed or elements loaded)');
        }
        
        await page.waitForTimeout(randomDelay());
        
        // Handle any popups/dialogs that appear after login (try multiple common popup patterns)
        console.log('[Facebook Marketplace Test] Checking for post-login popups/dialogs...');
        const popupSelectors = [
          'button[aria-label="Close"]',
          'div[role="dialog"] button:has-text("Close")',
          'div[role="dialog"] button:has-text("Not Now")',
          'div[role="dialog"] button:has-text("Skip")',
          '[aria-label="Close"]',
          'button:has-text("Close")',
        ];
        
        for (const selector of popupSelectors) {
          try {
            const popupButton = page.locator(selector).first();
            if (await popupButton.isVisible({ timeout: 2000 }).catch(() => false)) {
              await popupButton.click();
              await page.waitForTimeout(randomDelay());
              console.log(`[Facebook Marketplace Test] Closed popup using selector: ${selector}`);
              break; // Only close one popup
            }
          } catch (error) {
            // Continue trying other selectors
          }
        }
        
        // Wait a bit more for any remaining dialogs to settle
        await page.waitForTimeout(randomDelay());
        
        // Navigate to Marketplace - try multiple ways to find it
        console.log('[Facebook Marketplace Test] Navigating to Marketplace...');
        try {
          // Try the shortcuts menu first
          await page.getByLabel('Shortcuts').getByRole('link', { name: 'Marketplace' }).click({ timeout: 5000 });
          console.log('[Facebook Marketplace Test] Clicked Marketplace from shortcuts menu');
        } catch (error) {
          console.log('[Facebook Marketplace Test] Shortcuts menu not found, trying direct navigation...');
          // Fallback: Try direct navigation or search
          try {
            await page.goto('https://www.facebook.com/marketplace');
            console.log('[Facebook Marketplace Test] Navigated directly to Marketplace');
          } catch (navError) {
            console.log('[Facebook Marketplace Test] Direct navigation failed, searching for Marketplace link...');
            // Try finding Marketplace link in different ways
            const marketplaceLink = page.getByRole('link', { name: /marketplace/i }).first();
            if (await marketplaceLink.isVisible({ timeout: 3000 }).catch(() => false)) {
              await marketplaceLink.click();
              console.log('[Facebook Marketplace Test] Found and clicked Marketplace link');
            } else {
              await browser.close();
              return res.status(401).json({ error: 'Could not find Marketplace link - login may have failed' });
            }
          }
        }
        await page.waitForTimeout(randomDelay());
        console.log('[Facebook Marketplace Test] Current URL after Marketplace navigation:', page.url());
        await page.waitForTimeout(randomDelay());
        
        // Handle login popup if it appears when navigating to Marketplace
        console.log('[Facebook Marketplace Test] Checking for login popup...');
        try {
          const emailField = page.getByRole('textbox', { name: 'Email or phone number' });
          if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('[Facebook Marketplace Test] Login popup detected, filling credentials...');
            await emailField.fill(email);
            await page.waitForTimeout(randomDelay());
            await page.locator('#login_popup_cta_form').getByRole('textbox', { name: 'Password' }).click();
            await page.waitForTimeout(randomDelay());
            await page.locator('#login_popup_cta_form').getByRole('textbox', { name: 'Password' }).fill(password);
            await page.waitForTimeout(randomDelay());
            await page.getByRole('button', { name: 'Log in to Facebook' }).click();
            await page.waitForTimeout(randomDelay());
            console.log('[Facebook Marketplace Test] Login popup handled successfully');
          }
        } catch (error) {
          console.log('[Facebook Marketplace Test] No login popup found or already logged in, continuing...');
        }
        
        // Wait a bit more for the page to fully load after handling popup
        await page.waitForTimeout(randomDelay());
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
          console.log('[Facebook Marketplace Test] Network idle timeout, continuing anyway...');
        });
        
        // Final verification - check if we can see Marketplace content
        const finalUrl = page.url();
        console.log('[Facebook Marketplace Test] Final URL:', finalUrl);
        
        // Check for CAPTCHA/checkpoint
        if (finalUrl.includes('/captcha') || finalUrl.includes('/checkpoint') || finalUrl.includes('/challenge')) {
          console.log('[Facebook Marketplace Test] ❌ CAPTCHA/checkpoint detected - login failed');
          await browser.close();
          return res.status(401).json({ error: 'Login failed: Facebook is showing a CAPTCHA or security checkpoint. This usually means invalid credentials or suspicious login activity.' });
        }
        
        // Check if we're on login page
        if (finalUrl.includes('/login')) {
          console.log('[Facebook Marketplace Test] ❌ Still on login page - login failed');
          await browser.close();
          return res.status(401).json({ error: 'Login failed: Still on login page after Marketplace navigation' });
        }
        
        // Verify we can see Marketplace elements - use more flexible checks
        console.log('[Facebook Marketplace Test] Checking for Marketplace indicators...');
        const marketplaceIndicators = [
          'a[href*="/marketplace/create"]',
          'a[href*="/marketplace/sell"]',
          'a[href*="marketplace"]',
          '[aria-label*="Marketplace"]',
          '[aria-label*="marketplace"]',
          'div:has-text("Sell Something")',
          'div:has-text("Create new listing")',
          'div:has-text("Sell")',
          'div[role="main"]',
          'main',
          '[role="main"]',
        ];
        
        let foundMarketplaceIndicator = false;
        for (const selector of marketplaceIndicators) {
          try {
            if (await page.locator(selector).first().isVisible({ timeout: 3000 }).catch(() => false)) {
              foundMarketplaceIndicator = true;
              console.log('[Facebook Marketplace Test] ✅ Found Marketplace indicator:', selector);
              break;
            }
          } catch (e) {
            // Continue checking
          }
        }
        
        // If no specific indicators found, check if we're on a Marketplace URL and page has loaded
        if (!foundMarketplaceIndicator) {
          const isMarketplaceUrl = finalUrl.includes('/marketplace') || finalUrl.includes('facebook.com/marketplace');
          
          if (isMarketplaceUrl) {
            // Check if page has any content loaded (not just a blank page)
            try {
              const hasContent = await page.evaluate(() => {
                return document.body && document.body.innerText && document.body.innerText.length > 100;
              });
              
              if (hasContent) {
                console.log('[Facebook Marketplace Test] ✅ On Marketplace URL with content loaded - considering login successful');
                foundMarketplaceIndicator = true;
              } else {
                console.log('[Facebook Marketplace Test] ⚠️ On Marketplace URL but page appears empty');
              }
            } catch (error) {
              console.log('[Facebook Marketplace Test] ⚠️ Could not check page content');
            }
          }
        }
        
        if (!foundMarketplaceIndicator) {
          console.log('[Facebook Marketplace Test] ❌ No Marketplace indicators found - login failed');
          console.log('[Facebook Marketplace Test] Final URL:', finalUrl);
          await browser.close();
          return res.status(401).json({ error: 'Login failed: Could not verify successful login on Marketplace page' });
        }
        
        console.log('[Facebook Marketplace Test] ✅ Login successful');
        await browser.close();
        res.json({ success: true, message: 'Connection test successful' });
      } catch (error: any) {
        await browser.close();
        console.error('[Facebook Marketplace Test] Error:', error.message);
        res.status(500).json({ error: error.message || 'Test failed' });
      }
    } catch (error: any) {
      console.error('[Facebook Marketplace] Test error:', error);
      res.status(500).json({ error: error.message || 'Failed to test connection' });
    }
  });

  // Configure Facebook Marketplace integration (LEGACY)
  app.post("/api/integrations/facebook-marketplace/configure", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      console.log('[Facebook Marketplace Configure LEGACY] ===== CONFIGURE =====');
      const { allowHardLoginFallback, storeFacebookCredentials } = await import('./facebookAuthSecrets.service');
      const keyVault = await import('./keyVault');

      const { email, password } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const existingConfig = await storage.getIntegrationConfig("facebook-marketplace", req.orgId);
      const existingPassword = existingConfig?.config && typeof existingConfig.config === 'object' && 'password' in existingConfig.config
        ? (existingConfig.config as any).password
        : null;
      const passwordToStore = password || existingPassword;

      if (!passwordToStore) {
        return res.status(400).json({ error: 'Password is required for initial setup' });
      }

      if (!req.orgId) {
        return res.status(400).json({ error: 'No organization context' });
      }

      let credentialsInKeyVault = false;
      if (keyVault.isKeyVaultConfigured() && req.user?.id) {
        try {
          await storeFacebookCredentials(req.user.id, req.orgId, email, passwordToStore);
          credentialsInKeyVault = true;
        } catch (kvErr: any) {
          console.error('[Facebook Marketplace Configure] Key Vault store failed:', kvErr?.message);
          if (!allowHardLoginFallback()) {
            return res.status(400).json({ error: 'Key Vault is required for storing credentials. Configure KEY_VAULT_URI or set ALLOW_HARD_LOGIN_FALLBACK.' });
          }
        }
      } else if (!allowHardLoginFallback()) {
        return res.status(400).json({ error: 'Key Vault is required. Configure KEY_VAULT_URI or set ALLOW_HARD_LOGIN_FALLBACK.' });
      }

      const configToSave: Record<string, unknown> = credentialsInKeyVault
        ? { credentialsInKeyVault: true }
        : { email, password: passwordToStore };
      const savedConfig = await storage.upsertIntegrationConfig({
        service: 'facebook-marketplace',
        config: configToSave,
        isActive: true,
        orgId: req.orgId,
      });

      console.log('[Facebook Marketplace Configure] ✅ Config saved:', { id: savedConfig.id, orgId: savedConfig.orgId, credentialsInKeyVault });
      res.json({ success: true, message: 'Facebook Marketplace configured successfully' });
    } catch (error) {
      console.error('[Facebook Marketplace] Configuration error:', error);
      res.status(500).json({ error: 'Failed to configure Facebook Marketplace' });
    }
  });

  // Disconnect Facebook Marketplace integration
  app.post("/api/integrations/facebook-marketplace/disconnect", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { deleteFacebookCredentials } = await import('./facebookAuthSecrets.service');
      const { disconnectFacebookMarketplace } = await import('./facebookMarketplaceService');
      if (req.user?.id && req.orgId) {
        await deleteFacebookCredentials(req.user.id, req.orgId);
      }
      if (req.orgId) {
        await disconnectFacebookMarketplace(req.orgId);
      }
      await storage.upsertIntegrationConfig({
        service: "facebook-marketplace",
        config: {},
        isActive: false,
        orgId: req.orgId!,
      });
      console.log('[Facebook Marketplace] Disconnected and credentials removed for org:', req.orgId);
      res.json({ success: true, message: "Facebook Marketplace disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting Facebook Marketplace:", error);
      res.status(500).json({ error: "Failed to disconnect Facebook Marketplace" });
    }
  });

  // Run Facebook send message script (uses auth manager: session-first, Key Vault fallback)
  app.post("/api/integrations/facebook-marketplace/run-send-message", isAuthenticated, attachOrgContext, async (req: any, res) => {
    const { spawn } = await import('child_process');
    const { getStorageStatePathForSpawnedProcess } = await import('./facebookAuthManager');

    console.log(`[Facebook Send Message] ===== SEND MESSAGE REQUEST RECEIVED =====`);
    console.log(`[Facebook Send Message] Org ID: ${req.orgId}`);
    console.log(`[Facebook Send Message] User: ${req.user?.email || 'unknown'}`);
    console.log(`[Facebook Send Message] Timestamp: ${new Date().toISOString()}`);

    try {
      if (!req.orgId) {
        return res.status(400).json({ error: 'No organization context' });
      }

      const auth = await getStorageStatePathForSpawnedProcess(req.orgId);
      if (!auth) {
        return res.status(400).json({
          error: 'Facebook authentication failed. Please reconnect in Settings > Integrations.',
        });
      }

      let baseURL = process.env.PLAYWRIGHT_BASE_URL;
      if (!baseURL) {
        const serverPort = process.env.PORT || '5000';
        baseURL = `http://localhost:${serverPort}`;
      }

      const { allowHardLoginFallback, getFacebookCredentialsForOrg } = await import('./facebookAuthSecrets.service');
      let kvCreds: { email: string; password: string } | null = null;
      if (allowHardLoginFallback()) {
        kvCreds = await getFacebookCredentialsForOrg(req.orgId, 'facebook-send-message-fallback').catch(() => null);
      }

      const env: Record<string, string> = {
        ...process.env,
        PLAYWRIGHT_STORAGE_STATE_PATH: auth.path,
        PLAYWRIGHT_BASE_URL: baseURL,
        PLAYWRIGHT_SKIP_WEBSERVER: 'true',
        FACEBOOK_LISTING_SECRET_TOKEN: process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret',
        PLAYWRIGHT_HEADLESS: 'false',
        FACEBOOK_SEND_MESSAGE_ORG_ID: req.orgId,
      };
      if (kvCreds?.email && kvCreds?.password) {
        env.FACEBOOK_EMAIL = kvCreds.email;
        env.FACEBOOK_PASSWORD = kvCreds.password;
        console.log('[Facebook Send Message] Key Vault creds passed for fallback (if storageState fails)');
      }
      
      console.log(`[Facebook Send Message] Environment variables set`);

      const testFile = 'tests/facebook.send.message.spec.ts';
      const command = 'npx';
      const args = [
        'playwright',
        'test',
        testFile,
        '--project=chromium',
        '--headed', // REQUIRED: Show browser window - do not remove this flag
        '--workers=1', // Single worker for stability
      ];

      console.log(`[Facebook Send Message] Spawning process with command: ${command}`);
      console.log(`[Facebook Send Message] Arguments: ${JSON.stringify(args)}`);
      console.log(`[Facebook Send Message] Test file: ${testFile}`);

      // Start the process and return immediately (run in background)
      // IMPORTANT: Always run in headed mode (visible browser) when triggered from UI
      // shell: true required on Windows for npx; use false on Unix to avoid DEP0190
      const playwrightProcess = spawn(command, args, {
        env,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      console.log(`[Facebook Send Message] ✅ Process spawned successfully`);
      console.log(`[Facebook Send Message] Process PID: ${playwrightProcess.pid}`);

      let stdout = '';
      let stderr = '';

      // Capture output
      if (playwrightProcess.stdout) {
        playwrightProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          const lines = output.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            console.log(`[Facebook Send Message PID ${playwrightProcess.pid}] STDOUT: ${line}`);
          });
        });
      }

      if (playwrightProcess.stderr) {
        playwrightProcess.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          const lines = output.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            console.log(`[Facebook Send Message PID ${playwrightProcess.pid}] STDERR: ${line}`);
          });
        });
      }

      playwrightProcess.on('exit', (code, signal) => {
        auth.cleanup().catch(() => {});
        console.log(`[Facebook Send Message] ===== PROCESS EXITED =====`);
        console.log(`[Facebook Send Message] PID: ${playwrightProcess.pid}`);
        console.log(`[Facebook Send Message] Exit code: ${code}`);
        console.log(`[Facebook Send Message] Signal: ${signal || 'none'}`);
        if (code === 0) {
          console.log(`[Facebook Send Message] ✅ Process completed successfully`);
        } else {
          console.error(`[Facebook Send Message] ❌ Process exited with error code ${code}`);
          if (stdout) {
            console.error(`[Facebook Send Message] Last 50 lines of stdout:`, stdout.split('\n').slice(-50).join('\n'));
          }
          if (stderr) {
            console.error(`[Facebook Send Message] Last 50 lines of stderr:`, stderr.split('\n').slice(-50).join('\n'));
          }
        }
        console.log(`[Facebook Send Message] =========================`);
      });

      playwrightProcess.on('error', (error) => {
        auth.cleanup().catch(() => {});
        console.error(`[Facebook Send Message] ===== PROCESS ERROR =====`);
        console.error(`[Facebook Send Message] PID: ${playwrightProcess.pid}`);
        console.error(`[Facebook Send Message] Error name: ${error.name}`);
        console.error(`[Facebook Send Message] Error message: ${error.message}`);
        console.error(`[Facebook Send Message] Error stack:`, error.stack);
        console.error(`[Facebook Send Message] ========================`);
      });

      // Return immediately with process info
      res.json({ 
        success: true, 
        message: "Facebook send message script started",
        pid: playwrightProcess.pid 
      });
    } catch (error: any) {
      console.error(`[Facebook Send Message] ❌ Error starting script:`, error);
      res.status(500).json({ 
        success: false,
        error: error.message || "Failed to start send message script" 
      });
    }
  });

  app.post("/api/integrations/facebook-marketplace/run-message-polling", isAuthenticated, attachOrgContext, async (req: any, res) => {
    const { spawn } = await import('child_process');
    const { getStorageStatePathForSpawnedProcess } = await import('./facebookAuthManager');

    console.log(`[Facebook Message Polling] ===== POLLING REQUEST RECEIVED =====`);
    console.log(`[Facebook Message Polling] Org ID: ${req.orgId}`);
    console.log(`[Facebook Message Polling] User: ${req.user?.email || 'unknown'}`);
    console.log(`[Facebook Message Polling] Timestamp: ${new Date().toISOString()}`);

    try {
      if (!req.orgId) {
        return res.status(400).json({ error: 'No organization context' });
      }

      const existingProcess = facebookPollingProcesses.get(req.orgId);
      if (existingProcess) {
        console.log(`[Facebook Message Polling] ⚠️  Process already running for org ${req.orgId} (PID: ${existingProcess.pid})`);
        return res.status(409).json({
          success: false,
          error: "Polling is already running for this organization",
          pid: existingProcess.pid
        });
      }

      const auth = await getStorageStatePathForSpawnedProcess(req.orgId);
      if (!auth) {
        return res.status(400).json({
          error: 'Facebook authentication failed. Please reconnect in Settings > Integrations.',
        });
      }

      let baseURL = process.env.PLAYWRIGHT_BASE_URL;
      if (!baseURL) {
        const serverPort = process.env.PORT || '5000';
        baseURL = `http://localhost:${serverPort}`;
      }

      // Pass Key Vault creds for fallback login when storageState fails in spawned process (headed vs headless mismatch)
      const { allowHardLoginFallback, getFacebookCredentialsForOrg } = await import('./facebookAuthSecrets.service');
      let kvCreds: { email: string; password: string } | null = null;
      if (allowHardLoginFallback()) {
        kvCreds = await getFacebookCredentialsForOrg(req.orgId, 'facebook-message-polling-fallback').catch(() => null);
      }

      const env: Record<string, string> = {
        ...process.env,
        PLAYWRIGHT_STORAGE_STATE_PATH: auth.path,
        PLAYWRIGHT_BASE_URL: baseURL,
        PLAYWRIGHT_SKIP_WEBSERVER: 'true',
        FACEBOOK_LISTING_SECRET_TOKEN: process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret',
        PLAYWRIGHT_HEADLESS: 'false',
        FACEBOOK_POLLING_ORG_ID: req.orgId,
      };
      if (kvCreds?.email && kvCreds?.password) {
        env.FACEBOOK_EMAIL = kvCreds.email;
        env.FACEBOOK_PASSWORD = kvCreds.password;
        console.log('[Facebook Message Polling] Key Vault creds passed for fallback (if storageState fails)');
      }
      
      console.log(`[Facebook Message Polling] Setting FACEBOOK_POLLING_ORG_ID: ${req.orgId}`);

      console.log(`[Facebook Message Polling] Environment variables set:`);
      console.log(`[Facebook Message Polling]   - PLAYWRIGHT_BASE_URL: ${env.PLAYWRIGHT_BASE_URL}`);
      console.log(`[Facebook Message Polling]   - PLAYWRIGHT_HEADLESS: ${env.PLAYWRIGHT_HEADLESS}`);
      console.log(`[Facebook Message Polling]   - FACEBOOK_LISTING_SECRET_TOKEN: ${env.FACEBOOK_LISTING_SECRET_TOKEN ? '***set***' : 'NOT SET'}`);

      const testFile = 'tests/facebook.message.polling.spec.ts';
      const command = 'npx';
      const args = [
        'playwright',
        'test',
        testFile,
        '--project=chromium',
        '--headed', // REQUIRED: Show browser window
        '--workers=1', // Single worker for stability
      ];

      console.log(`[Facebook Message Polling] Spawning process with command: ${command}`);
      console.log(`[Facebook Message Polling] Arguments: ${JSON.stringify(args)}`);
      console.log(`[Facebook Message Polling] Test file: ${testFile}`);
      console.log(`[Facebook Message Polling] Shell: true`);
      console.log(`[Facebook Message Polling] Detached: false`);
      console.log(`[Facebook Message Polling] Stdio: ['ignore', 'pipe', 'pipe']`);

      // Start the process and return immediately (run in background)
      // IMPORTANT: Always run in headed mode (visible browser) when triggered from UI
      // shell: true required on Windows for npx; use false on Unix to avoid DEP0190
      const playwrightProcess = spawn(command, args, {
        env,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      console.log(`[Facebook Message Polling] ✅ Process spawned successfully`);
      console.log(`[Facebook Message Polling] Process PID: ${playwrightProcess.pid}`);
      console.log(`[Facebook Message Polling] Process killed: ${playwrightProcess.killed}`);
      console.log(`[Facebook Message Polling] Process signal: ${playwrightProcess.signalCode || 'none'}`);

      let stdout = '';
      let stderr = '';

      console.log(`[Facebook Message Polling] Setting up stdout/stderr handlers...`);

      // Capture output
      if (playwrightProcess.stdout) {
        playwrightProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          const lines = output.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            console.log(`[Facebook Message Polling PID ${playwrightProcess.pid}] STDOUT: ${line}`);
          });
        });
        console.log(`[Facebook Message Polling] ✅ Stdout handler attached`);
      } else {
        console.log(`[Facebook Message Polling] ⚠️  Stdout is null - output may not be captured`);
      }

      if (playwrightProcess.stderr) {
        playwrightProcess.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          const lines = output.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            console.error(`[Facebook Message Polling PID ${playwrightProcess.pid}] STDERR: ${line}`);
          });
        });
        console.log(`[Facebook Message Polling] ✅ Stderr handler attached`);
      } else {
        console.log(`[Facebook Message Polling] ⚠️  Stderr is null - errors may not be captured`);
      }

      playwrightProcess.on('close', (code, signal) => {
        auth.cleanup().catch(() => {});
        facebookPollingProcesses.delete(req.orgId);

        console.log(`[Facebook Message Polling] ===== PROCESS CLOSED =====`);
        console.log(`[Facebook Message Polling] PID: ${playwrightProcess.pid}`);
        console.log(`[Facebook Message Polling] Exit code: ${code}`);
        console.log(`[Facebook Message Polling] Signal: ${signal || 'none'}`);

        if (code === 0) {
          console.log(`[Facebook Message Polling] ✅ Process completed successfully`);
        } else {
          console.error(`[Facebook Message Polling] ❌ Process exited with error code ${code}`);
          if (stdout) {
            console.error(`[Facebook Message Polling] Last 50 lines of stdout:`, stdout.split('\n').slice(-50).join('\n'));
          }
          if (stderr) {
            console.error(`[Facebook Message Polling] Last 50 lines of stderr:`, stderr.split('\n').slice(-50).join('\n'));
          }
        }
        console.log(`[Facebook Message Polling] =========================`);
      });

      playwrightProcess.on('error', (error) => {
        auth.cleanup().catch(() => {});
        facebookPollingProcesses.delete(req.orgId);
        console.error(`[Facebook Message Polling] ===== PROCESS ERROR =====`);
        console.error(`[Facebook Message Polling] PID: ${playwrightProcess.pid}`);
        console.error(`[Facebook Message Polling] Error name: ${error.name}`);
        console.error(`[Facebook Message Polling] Error message: ${error.message}`);
        console.error(`[Facebook Message Polling] Error stack:`, error.stack);
        console.error(`[Facebook Message Polling] ========================`);
      });

      // Log when process spawns successfully
      playwrightProcess.on('spawn', () => {
        console.log(`[Facebook Message Polling] ✅ Process spawned event fired`);
      });

      // Store process reference for stopping later
      if (playwrightProcess.pid) {
        facebookPollingProcesses.set(req.orgId, {
          process: playwrightProcess,
          pid: playwrightProcess.pid,
          startedAt: new Date()
        });
        console.log(`[Facebook Message Polling] ✅ Stored process reference for org ${req.orgId} (PID: ${playwrightProcess.pid})`);
        console.log(`[Facebook Message Polling] Total running processes: ${facebookPollingProcesses.size}`);
      } else {
        console.error(`[Facebook Message Polling] ❌ WARNING: Process spawned but PID is undefined!`);
      }

      console.log(`[Facebook Message Polling] ===== SENDING RESPONSE TO CLIENT =====`);
      console.log(`[Facebook Message Polling] Success: true`);
      console.log(`[Facebook Message Polling] PID: ${playwrightProcess.pid || 'undefined'}`);
      console.log(`[Facebook Message Polling] ======================================`);

      // Return immediately with process info
      res.json({ 
        success: true, 
        message: "Facebook message polling started",
        pid: playwrightProcess.pid 
      });
    } catch (error: any) {
      console.error("Error starting Facebook message polling:", error);
      res.status(500).json({ error: "Failed to start Facebook message polling", message: error.message });
    }
  });

  // Stop Facebook message polling
  app.post("/api/integrations/facebook-marketplace/stop-message-polling", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const processInfo = facebookPollingProcesses.get(req.orgId);
      
      if (!processInfo) {
        return res.status(404).json({ 
          success: false,
          error: "No active polling process found for this organization" 
        });
      }

      const { process, pid } = processInfo;
      
      console.log(`[Facebook Message Polling] Stopping process for org ${req.orgId} (PID: ${pid})`);
      
      // Kill the process and all its children
      try {
        // On Windows, use taskkill; on Unix, use kill
        if (require('os').platform() === 'win32') {
          // Windows: kill process tree
          const { exec } = await import('child_process');
          exec(`taskkill /PID ${pid} /T /F`, (error) => {
            if (error) {
              console.error(`[Facebook Message Polling] Error killing process tree:`, error);
            } else {
              console.log(`[Facebook Message Polling] Successfully killed process tree (PID: ${pid})`);
            }
          });
        } else {
          // Unix: kill process and children
          if (process && typeof process.kill === 'function') {
            process.kill('SIGTERM');
            // Force kill after 5 seconds if still running
            setTimeout(() => {
              try {
                if (process && !process.killed && typeof process.kill === 'function') {
                  process.kill('SIGKILL');
                  console.log(`[Facebook Message Polling] Force killed process (PID: ${pid})`);
                }
              } catch (forceKillError) {
                console.error(`[Facebook Message Polling] Error force killing:`, forceKillError);
              }
            }, 5000);
          } else {
            // Fallback: use system kill command
            const { exec } = await import('child_process');
            exec(`kill -TERM ${pid}`, (error) => {
              if (error) {
                console.error(`[Facebook Message Polling] Error killing process:`, error);
              }
            });
          }
        }
      } catch (killError: any) {
        console.error(`[Facebook Message Polling] Error killing process:`, killError);
        // Try to remove from tracking anyway
        facebookPollingProcesses.delete(req.orgId);
        return res.status(500).json({ 
          success: false,
          error: "Failed to stop process", 
          message: killError.message 
        });
      }

      // Remove from tracking
      facebookPollingProcesses.delete(req.orgId);
      
      console.log(`[Facebook Message Polling] Process stopped successfully (PID: ${pid})`);
      
      res.json({ 
        success: true, 
        message: "Facebook message polling stopped",
        pid: pid
      });
    } catch (error: any) {
      console.error("Error stopping Facebook message polling:", error);
      res.status(500).json({ error: "Failed to stop Facebook message polling", message: error.message });
    }
  });

  // Check if polling is running
  app.get("/api/integrations/facebook-marketplace/polling-status", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const processInfo = facebookPollingProcesses.get(req.orgId);
      
      if (!processInfo) {
        return res.json({ 
          isRunning: false,
          pid: null,
          startedAt: null
        });
      }

      // Check if process is still alive
      const isAlive = processInfo.process && !processInfo.process.killed;
      
      if (!isAlive) {
        // Process is dead, remove from tracking
        facebookPollingProcesses.delete(req.orgId);
        return res.json({ 
          isRunning: false,
          pid: null,
          startedAt: null
        });
      }

      res.json({ 
        isRunning: true,
        pid: processInfo.pid,
        startedAt: processInfo.startedAt
      });
    } catch (error: any) {
      console.error("Error checking polling status:", error);
      res.status(500).json({ error: "Failed to check polling status", message: error.message });
    }
  });

  // ===== OUTLOOK LEAD SYNC =====
  app.post("/api/leads/sync-from-outlook", isAuthenticated, attachOrgContext, async (req: any, res) => {
    const { syncProgressTracker } = await import("./syncProgress");
    
    try {
      syncProgressTracker.reset();
      syncProgressTracker.start(0);
      syncProgressTracker.updateStep('Initializing Outlook sync...');
      
      if (syncProgressTracker.isCancelled()) {
        return res.json({ message: "Sync cancelled before start" });
      }
      
      // Get Outlook integration config
      const outlookConfig = await storage.getIntegrationConfig("outlook", req.orgId);
      const tokens = outlookConfig?.config as any;
      if (!outlookConfig || !tokens?.access_token) {
        syncProgressTracker.fail("Outlook not connected");
        return res.status(400).json({ error: "Outlook not connected" });
      }

      syncProgressTracker.addLog('info', '✓ Outlook credentials verified');

      if (syncProgressTracker.isCancelled()) {
        return res.json({ message: "Sync cancelled" });
      }

      // Get all properties to match against
      const properties = await storage.getAllProperties(req.orgId);
      syncProgressTracker.addLog('info', `✓ Loaded ${properties.length} properties`);

      if (syncProgressTracker.isCancelled()) {
        return res.json({ message: "Sync cancelled" });
      }

      // Fetch emails from Outlook (up to 500)
      syncProgressTracker.addLog('info', '📧 Fetching emails from Outlook...');
      syncProgressTracker.updateStep('Fetching emails from Outlook...');
      const messages = await listOutlookMessages(tokens.access_token, 500, () => syncProgressTracker.isCancelled());
      
      if (syncProgressTracker.isCancelled()) {
        return res.json({ message: "Sync cancelled during email fetch" });
      }

      syncProgressTracker.setTotal(messages.length);
      syncProgressTracker.addLog('success', `✓ Fetched ${messages.length} emails`);
      syncProgressTracker.updateStep(`Analyzing ${messages.length} emails with AI...`);
      
      const createdLeads = [];
      const duplicates = [];
      const parseErrors = [];
      const skipped = [];
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Track conversationId -> leadId mapping
      const conversationLeadMap = new Map<string, string>();
      
      // Track email -> leadId mapping to prevent duplicate leads from same email across different conversations
      const emailLeadMap = new Map<string, string>();
      
      // Track processed message IDs in this session to prevent duplicates within the same batch
      const processedMessageIds = new Set<string>();

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        
        if (syncProgressTracker.isCancelled()) {
          syncProgressTracker.addLog('warning', '⚠️ Sync cancelled by user');
          break;
        }

        syncProgressTracker.updateProgress(i + 1);
        syncProgressTracker.addLog('info', `Processing email ${i + 1}/${messages.length}...`);

        try {
          const subject = msg.subject || "";
          const fromEmail = msg.from?.emailAddress?.address || "";
          const fromName = msg.from?.emailAddress?.name || "";
          const conversationId = msg.conversationId;
          
          // Get email body
          const bodyContent = msg.body?.content || "";
          const emailBody = bodyContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

          // Skip if no sender email
          if (!fromEmail) {
            syncProgressTracker.addLog('warning', `⚠️ Skipped: no sender email`);
            skipped.push({ reason: 'No sender email', subject });
            continue;
          }

          // Check if we already processed this message in this sync session
          if (processedMessageIds.has(msg.id)) {
            duplicates.push({ email: fromEmail, reason: "Already processed in this session" });
            syncProgressTracker.addLog('warning', `⏭️ Skipped duplicate: "${subject.substring(0, 50)}..."`);
            continue;
          }

          // Mark this message as being processed immediately to prevent duplicates within this batch
          processedMessageIds.add(msg.id);

          // Check if this exact message was already processed in database by externalId
          const existingConversation = await storage.getConversationByExternalId(msg.id);
          if (existingConversation) {
            duplicates.push({ email: fromEmail, reason: "Already processed" });
            syncProgressTracker.addLog('warning', `⏭️ Skipped duplicate: "${subject.substring(0, 50)}..."`);
            continue;
          }

          // Check if this conversation already has a lead
          let leadToUse = null;
          if (conversationId && conversationLeadMap.has(conversationId)) {
            const existingLeadId = conversationLeadMap.get(conversationId);
            leadToUse = await storage.getLead(existingLeadId!, req.orgId);
            
            if (leadToUse) {
              syncProgressTracker.addLog('info', `📎 Email belongs to existing conversation for ${leadToUse.name}`);
              
              // Clean the email body before storing
              const cleanedConvoBody = cleanEmailBody(emailBody);
              
              // Just create conversation record
              await storage.createConversation({
                leadId: leadToUse.id,
                type: "received",
                message: cleanedConvoBody.substring(0, 500),
                channel: "email",
                aiGenerated: false,
                externalId: msg.id,
              });
              
              duplicates.push({ email: fromEmail, reason: 'Same conversation thread' });
              continue;
            }
          }

          // AI parsing to determine if it's a rental inquiry
          const aiPrompt = `Analyze this email and determine if it's a rental property inquiry. Extract key information.

Email Subject: ${subject}
From: ${fromName} <${fromEmail}>
Body: ${emailBody.substring(0, 1000)}

Return JSON with:
{
  "isRentalInquiry": boolean,
  "firstName": string,
  "lastName": string,
  "phone": string or null,
  "propertyName": string or null,
  "message": string (brief summary),
  "income": string or null,
  "moveInDate": string or null
}`;

          const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: aiPrompt }],
            response_format: { type: "json_object" },
          });

          const parsedData = JSON.parse(aiResponse.choices[0].message.content || "{}");

          if (!parsedData.isRentalInquiry) {
            syncProgressTracker.addLog('info', `⏭️ Skipped: not a rental inquiry`);
            skipped.push({ reason: 'Not a rental inquiry', subject, email: fromEmail });
            continue;
          }

          // Check for duplicate by email or phone
          const leadEmail = fromEmail.toLowerCase().trim();
          const leadPhone = (parsedData.phone || "").trim();
          
          // First check if we've already seen this email in this sync session
          let existingLead = null;
          if (emailLeadMap.has(leadEmail)) {
            const leadId = emailLeadMap.get(leadEmail)!;
            existingLead = await storage.getLead(leadId, req.orgId);
            syncProgressTracker.addLog('info', `📧 Email match: Using existing lead from earlier in sync`);
          }
          
          // If not in session map, check database by email or phone
          if (!existingLead) {
            existingLead = await storage.getLeadByEmail(leadEmail, req.orgId) || 
                            (leadPhone ? await storage.getLeadByPhone(leadPhone, req.orgId) : null);
          }

          if (existingLead) {
            leadToUse = existingLead;
            syncProgressTracker.addLog('info', `📎 Found existing lead: ${existingLead.name}`);
            duplicates.push({ email: fromEmail, leadId: existingLead.id });
            
            // Update lead if new info available
            const updates: any = {};
            if (parsedData.income && !existingLead.income) updates.income = parsedData.income;
            if (parsedData.moveInDate && !existingLead.moveInDate) updates.moveInDate = parsedData.moveInDate;
            
            if (Object.keys(updates).length > 0) {
              await storage.updateLead(existingLead.id, updates, req.orgId);
              syncProgressTracker.addLog('info', `✏️ Updated lead info for ${existingLead.name}`);
            }
          } else {
            // Match property if mentioned
            let matchedProperty = null;
            if (parsedData.propertyName) {
              matchedProperty = properties.find(p => 
                p.name.toLowerCase().includes(parsedData.propertyName.toLowerCase()) ||
                parsedData.propertyName.toLowerCase().includes(p.name.toLowerCase())
              );
            }

            // Create new lead
            leadToUse = await storage.createLead({
              name: `${parsedData.firstName} ${parsedData.lastName}`.trim(),
              email: leadEmail,
              phone: leadPhone,
              propertyId: matchedProperty?.id || properties[0]?.id || null,
              propertyName: matchedProperty?.name || parsedData.propertyName || "Not specified",
              status: "new",
              source: "outlook",
              income: parsedData.income || null,
              moveInDate: parsedData.moveInDate || null,
              profileData: {},
              orgId: req.orgId,
            });
            syncProgressTracker.addLog('success', `✅ Created new lead: ${leadToUse.name}`);
            syncProgressTracker.addCreatedLeadId(leadToUse.id); // Track this lead for current sync
            createdLeads.push(leadToUse);
          }

          // Store conversationId -> leadId mapping
          if (conversationId) {
            conversationLeadMap.set(conversationId, leadToUse.id);
          }
          
          // Store email -> leadId mapping to prevent duplicate leads from same email
          if (leadEmail) {
            emailLeadMap.set(leadEmail, leadToUse.id);
          }

          // Clean the email body to remove quoted content and fix line breaks
          const cleanedOutlookBody = cleanEmailBody(emailBody);
          
          // Create conversation record
          await storage.createConversation({
            leadId: leadToUse.id,
            type: "received",
            message: parsedData.message || cleanedOutlookBody,
            channel: "email",
            aiGenerated: false,
            externalId: msg.id,
          });

        } catch (error) {
          console.error(`Error processing Outlook message ${i}:`, error);
          syncProgressTracker.addLog('error', `❌ Error processing email: ${error}`);
          parseErrors.push({ index: i, error: String(error) });
        }
      }

      const summary = {
        created: createdLeads.length,
        total: createdLeads.length, // Total leads affected
        duplicates: duplicates.length,
        skipped: skipped.length,
        errors: parseErrors.length,
      };

      syncProgressTracker.complete(summary);
      syncProgressTracker.addLog('success', `✅ Sync complete! Created ${summary.created} leads from ${messages.length} emails`);

      res.json({
        success: true,
        createdLeads,
        duplicates,
        skipped,
        parseErrors,
        total: messages.length,
        summary,
        isCancelled: syncProgressTracker.isCancelled(),
      });

    } catch (error) {
      syncProgressTracker.fail(String(error));
      console.error("Outlook sync error:", error);
      res.status(500).json({ error: "Failed to sync Outlook messages" });
    }
  });

  // ===== PENDING REPLIES ROUTES =====
  app.get("/api/pending-replies", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const pendingReplies = await storage.getAllPendingReplies(req.orgId);
      res.json(pendingReplies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending replies" });
    }
  });

  app.post("/api/pending-replies", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validatedData = insertPendingReplySchema.parse(req.body);
      const reply = await storage.createPendingReply({ ...validatedData, orgId: req.orgId });
      res.status(201).json(reply);
    } catch (error) {
      res.status(400).json({ error: "Invalid pending reply data" });
    }
  });

  app.patch("/api/pending-replies/:id/approve", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const reply = await storage.getPendingReply(req.params.id, req.orgId);
      if (!reply) {
        return res.status(404).json({ error: "Pending reply not found" });
      }

      // Send the email
      if (reply.channel === 'email') {
        const requestedIntegration = req.body.integration; // 'gmail' or 'outlook'
        
        // Get integration configs
        const gmailConfig = await storage.getIntegrationConfig("gmail", req.orgId);
        const outlookConfig = await storage.getIntegrationConfig("outlook", req.orgId);
        
        const gmailTokens = gmailConfig?.config as any;
        const outlookTokens = outlookConfig?.config as any;

        // Use requested integration if specified and available, otherwise fall back to auto-select
        if (requestedIntegration === 'gmail' && gmailTokens?.access_token) {
          // Send via Gmail
          await sendReply(gmailTokens, {
            to: reply.leadEmail,
            subject: reply.subject,
            body: reply.content,
            threadId: reply.threadId || undefined,
            inReplyTo: reply.inReplyTo || undefined,
            references: reply.references || undefined,
          });
        } else if (requestedIntegration === 'outlook' && outlookTokens?.access_token) {
          // Send via Outlook
          await sendOutlookEmail(outlookTokens.access_token, {
            to: reply.leadEmail,
            subject: reply.subject,
            body: reply.content,
            inReplyTo: reply.inReplyTo || undefined,
            references: reply.references || undefined,
          });
        } else if (gmailTokens?.access_token) {
          // Fallback: Try Gmail first
          await sendReply(gmailTokens, {
            to: reply.leadEmail,
            subject: reply.subject,
            body: reply.content,
            threadId: reply.threadId || undefined,
            inReplyTo: reply.inReplyTo || undefined,
            references: reply.references || undefined,
          });
        } else if (outlookTokens?.access_token) {
          // Fallback: Try Outlook
          await sendOutlookEmail(outlookTokens.access_token, {
            to: reply.leadEmail,
            subject: reply.subject,
            body: reply.content,
            inReplyTo: reply.inReplyTo || undefined,
            references: reply.references || undefined,
          });
        } else {
          return res.status(400).json({ error: "No email integration connected (Gmail or Outlook required)" });
        }

        // Record conversation
        await storage.createConversation({
          leadId: reply.leadId,
          type: 'outgoing',
          channel: 'email',
          message: reply.content,
          aiGenerated: true,
          sourceIntegration: requestedIntegration || (gmailTokens?.access_token ? 'gmail' : 'outlook'),
        });

        // Update reply status
        await storage.updatePendingReplyStatus(req.params.id, 'sent', req.orgId);
        
        res.json({ success: true, message: "Email sent successfully" });
      } else {
        res.status(400).json({ error: "Only email replies supported currently" });
      }
    } catch (error) {
      console.error("Failed to approve reply:", error);
      res.status(500).json({ error: "Failed to send reply" });
    }
  });

  app.patch("/api/pending-replies/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const reply = await storage.getPendingReply(req.params.id, req.orgId);
      if (!reply) {
        return res.status(404).json({ error: "Pending reply not found" });
      }

      const updates: any = {};
      if (req.body.content !== undefined) {
        updates.content = req.body.content;
      }
      if (req.body.subject !== undefined) {
        updates.subject = req.body.subject;
      }

      // Track edits - get original content from metadata
      const metadata = reply.metadata as any || {};
      const originalContent = metadata.originalContent || reply.content;
      const isEdited = req.body.content !== undefined && req.body.content !== originalContent;
      
      if (isEdited && req.body.content !== undefined) {
        // Update metadata to track edit
        updates.metadata = {
          ...metadata,
          originalContent: originalContent,
          editedByUser: true,
          editedAt: new Date().toISOString(),
          finalContent: req.body.content,
        } as any;
      }

      const updated = await storage.updatePendingReply(req.params.id, updates, req.orgId);
      if (!updated) {
        return res.status(404).json({ error: "Pending reply not found" });
      }

      // Log edit if content was changed
      if (isEdited) {
        const { logAIAction } = await import("./auditLogging");
        const lead = await storage.getLead(reply.leadId, req.orgId);
        await logAIAction(req, {
          actionType: "ai_reply_edited",
          leadId: reply.leadId,
          leadName: lead?.name || reply.leadName,
          pendingReplyId: reply.id,
          channel: reply.channel,
          editedByUser: true,
          originalContent: originalContent,
          finalContent: req.body.content,
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Failed to update pending reply:", error);
      res.status(500).json({ error: "Failed to update pending reply" });
    }
  });

  app.delete("/api/pending-replies/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const deleted = await storage.deletePendingReply(req.params.id, req.orgId);
      if (!deleted) {
        return res.status(404).json({ error: "Pending reply not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pending reply" });
    }
  });

  // Regenerate AI reply with feedback
  app.post("/api/pending-replies/:id/regenerate", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const reply = await storage.getPendingReply(req.params.id, req.orgId);
      if (!reply) {
        return res.status(404).json({ error: "Pending reply not found" });
      }

      const feedback = req.body.feedback || ""; // e.g., "shorter", "more friendly", "add pricing details"

      // Get lead details
      const lead = await storage.getLead(reply.leadId, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      // Get user information
      const user = req.user;
      const userName = user?.name || user?.email?.split('@')[0] || 'Property Manager';
      const userEmail = user?.email || '';
      
      // Get organization information
      const organization = await storage.getOrganization(req.orgId);
      const orgName = organization?.name || 'Our Property Management';

      // Get conversations for this lead
      const conversations = await storage.getConversationsByLeadId(reply.leadId, req.orgId);
      
      // Find the most recent incoming message
      const incomingMessage = conversations
        .filter((c: any) => c.type === 'incoming' || c.type === 'received')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      if (!incomingMessage) {
        return res.status(400).json({ error: "No incoming message to reply to" });
      }

      // Get personality settings (for old endpoint - not used in V2)
      const personalitySettingsOld = await storage.getAISettings('personality', req.orgId);
      const friendliness = personalitySettingsOld.find(s => s.key === 'friendliness')?.value || 'professional';
      const formality = personalitySettingsOld.find(s => s.key === 'formality')?.value || 'professional';
      const responseLength = personalitySettingsOld.find(s => s.key === 'response_length')?.value || 'detailed';
      const urgency = personalitySettingsOld.find(s => s.key === 'urgency')?.value || 'moderate';
      const warmth = personalitySettingsOld.find(s => s.key === 'warmth')?.value || 'moderate';
      const communicationStyle = personalitySettingsOld.find(s => s.key === 'communication_style')?.value || 'informational';

      // Build personality instructions (same as in ai-reply endpoint)
      let personalityInstructions = '';
      if (friendliness === 'friendly') {
        personalityInstructions += 'Write in a warm, approachable, and friendly tone. Use casual language and show enthusiasm. ';
      } else {
        personalityInstructions += 'Write in a professional and businesslike tone. Maintain a respectful and courteous demeanor. ';
      }
      if (formality === 'conversational') {
        personalityInstructions += 'Use conversational language with contractions and a more relaxed style. ';
      } else {
        personalityInstructions += 'Use formal language with proper grammar and structure. Avoid contractions. ';
      }
      if (responseLength === 'short') {
        personalityInstructions += 'Keep responses concise (2-3 short paragraphs maximum). Get to the point quickly. ';
      } else {
        personalityInstructions += 'Provide detailed, thorough responses (3-4 paragraphs). Include comprehensive information. ';
      }
      if (urgency === 'high') {
        personalityInstructions += 'Create a sense of urgency and timeliness. Encourage quick action. Use phrases like "limited availability" or "act soon". ';
      } else if (urgency === 'low') {
        personalityInstructions += 'Maintain a relaxed, no-pressure approach. Avoid creating urgency. ';
      } else {
        personalityInstructions += 'Balance urgency with professionalism. Mention availability naturally without being pushy. ';
      }
      if (warmth === 'high') {
        personalityInstructions += 'Show genuine warmth and care. Use empathetic language and show personal interest. ';
      } else if (warmth === 'low') {
        personalityInstructions += 'Keep responses factual and straightforward. Maintain professional distance. ';
      } else {
        personalityInstructions += 'Show appropriate warmth while remaining professional. Be personable but not overly casual. ';
      }
      if (communicationStyle === 'sales-assist') {
        personalityInstructions += 'Adopt a sales-assist approach: highlight benefits, create excitement, guide toward application/showing, and overcome objections. ';
      } else {
        personalityInstructions += 'Adopt an informational approach: provide clear information, answer questions thoroughly, and let the lead decide without pressure. ';
      }

      // Determine length instruction based on feedback
      const feedbackLower = feedback?.toLowerCase() || '';
      let lengthInstruction = '- Keep it concise (3-4 paragraphs).';
      if (feedbackLower.includes('shorter') || feedbackLower.includes('concise') || feedbackLower.includes('brief')) {
        lengthInstruction = '- Make the response SHORTER and more concise than the previous version. Aim for 1-2 paragraphs if possible.';
      } else if (feedbackLower.includes('longer') || feedbackLower.includes('detailed') || (feedbackLower.includes('more') && feedbackLower.includes('detail'))) {
        lengthInstruction = '- Make the response LONGER and more detailed than the previous version. Include more information.';
      }

      // Build regenerate prompt with feedback
      const regeneratePrompt = `You are a professional property manager responding to a rental inquiry.

PERSONALITY & TONE REQUIREMENTS (apply these consistently):
${personalityInstructions}

YOUR INFORMATION (use this to sign the email):
- Your Name: ${userName}
- Company/Organization: ${orgName}
${userEmail ? `- Email: ${userEmail}` : ''}

LEAD INFORMATION:
- Name: ${lead.name}
- Status: ${lead.status}
- Property Interested In: ${lead.propertyName || 'our property'}
- Move-in Date: ${lead.moveInDate || 'Not specified'}
- Their Message: ${incomingMessage.message}

PREVIOUS AI RESPONSE (for reference):
${reply.content}

${feedback ? `\nFEEDBACK FOR REGENERATION:
${feedback}

IMPORTANT: Pay special attention to this feedback and incorporate it into your regenerated response. If the feedback requests changes to length (shorter, longer, more concise, etc.), prioritize that feedback over any default length instructions below.` : '\nPlease regenerate the response with the same information but potentially improved wording or structure.'}

Write a friendly, professional email response that:
1. Thanks them for their interest
2. Confirms receipt of their inquiry
3. Briefly addresses their specific questions or needs
4. Mentions next steps (viewing, application, etc.)
5. Signs off warmly with YOUR REAL NAME (${userName}) and company/organization (${orgName})

CRITICAL REQUIREMENTS - YOU MUST FOLLOW THESE:
- ALWAYS ground your answers in the ACTUAL database values provided above - DO NOT make up property details, rent amounts, amenities, or policies
- Sign the email with the EXACT name: "${userName}" - NO PLACEHOLDERS
- Use the EXACT organization name: "${orgName}" - NO PLACEHOLDERS
- DO NOT use bracketed placeholders like [Your Name], [Company], [Your Contact Information], etc.
- The signature should look professional, for example:
  "Best regards,
  ${userName}
  ${orgName}${userEmail ? `\n${userEmail}` : ''}"
${lengthInstruction}

Write only the email body, no subject line.`;

      const regenerateCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: regeneratePrompt }],
        temperature: 0.7,
      });

      const regeneratedContent = regenerateCompletion.choices[0].message.content || "";
      
      if (!regeneratedContent) {
        console.error("[Regenerate] Empty content from OpenAI");
        return res.status(500).json({ error: "Failed to generate reply content" });
      }

      // Update the pending reply with new content
      try {
        const updated = await storage.updatePendingReply(req.params.id, { content: regeneratedContent }, req.orgId);
        if (!updated) {
          console.error("[Regenerate] updatePendingReply returned undefined", { replyId: req.params.id, orgId: req.orgId });
          return res.status(404).json({ error: "Failed to update pending reply" });
        }

        res.json({ 
          message: "Reply regenerated successfully",
          pendingReply: updated 
        });
      } catch (updateError: any) {
        console.error("[Regenerate] Error updating pending reply:", updateError);
        throw updateError;
      }
    } catch (error: any) {
      console.error("Error regenerating AI reply:", error);
      console.error("Error details:", {
        message: error?.message,
        stack: error?.stack,
        replyId: req.params.id,
        feedback: req.body.feedback
      });
      res.status(500).json({ 
        error: "Failed to regenerate AI reply",
        message: error?.message || "An unexpected error occurred"
      });
    }
  });

  app.post("/api/scan-unanswered-leads", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Find all leads that haven't been replied to
      const allLeads = await storage.getAllLeads(req.orgId);

      const generatedReplies = [];

      for (const lead of allLeads) {
        // Check if this lead already has an outgoing reply
        const conversations = await storage.getConversationsByLeadId(lead.id, req.orgId);
        const hasOutgoingReply = conversations.some((c: any) => c.type === 'outgoing');
        
        if (hasOutgoingReply) {
          continue; // Skip if already replied
        }

        // Check if there's already a pending reply for this lead
        const pendingReplies = await storage.getAllPendingReplies(req.orgId);
        const hasPendingReply = pendingReplies.some((pr: any) => pr.leadId === lead.id && pr.status === 'pending');
        
        if (hasPendingReply) {
          continue; // Skip if already has pending reply
        }

        // Find the incoming message (check both 'incoming' and 'received' types from Gmail sync)
        const incomingMessage = conversations.find((c: any) => c.type === 'incoming' || c.type === 'received');
        if (!incomingMessage) {
          continue; // Skip if no incoming message
        }

        // Get calendar availability context
        const availabilityContext = await getAvailabilityContext();

        // Generate AI reply based on the lead's inquiry
        const replyPrompt = `You are a professional property manager responding to a rental inquiry. 
        
Lead Information:
- Name: ${lead.name}
- Property Interested In: ${lead.propertyName || 'our property'}
- Move-in Date: ${lead.moveInDate || 'Not specified'}
- Their Message: ${incomingMessage.message}

${availabilityContext}

Write a friendly, professional email response that:
1. Thanks them for their interest
2. Confirms receipt of their inquiry
3. Briefly addresses their specific questions or needs
4. If they're asking about viewing/showing times, suggest specific available times based on the calendar above
5. Mentions next steps (viewing, application, etc.)
6. Signs off warmly

Keep it concise (3-4 paragraphs). Write only the email body, no subject line.`;

        const replyCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: replyPrompt }],
          temperature: 0.7,
        });

        const aiReplyContent = replyCompletion.choices[0].message.content || "";

        // Use fallback email for Facebook leads that don't have an email
        const leadEmailForPending = lead.email || (lead.source === 'facebook' 
          ? `facebook-${lead.externalId || lead.id}@facebook.local` 
          : `lead-${lead.id}@local`);

        // Create pending reply for review
        await storage.createPendingReply({
          orgId: req.orgId,
          leadId: lead.id,
          leadName: lead.name,
          leadEmail: leadEmailForPending,
          subject: `Re: Inquiry about ${lead.propertyName || 'our property'}`,
          content: aiReplyContent,
          originalMessage: incomingMessage.message,
          channel: 'email',
          status: 'pending',
        });

        generatedReplies.push({
          leadId: lead.id,
          leadName: lead.name,
        });
      }

      res.json({ 
        success: true, 
        count: generatedReplies.length,
        replies: generatedReplies
      });
    } catch (error) {
      console.error("Error scanning unanswered leads:", error);
      res.status(500).json({ error: "Failed to scan unanswered leads" });
    }
  });

  // ===== NOTIFICATION ROUTES =====
  app.get("/api/notifications", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const notifications = await storage.getUserNotifications(req.user.id, req.orgId);
      res.json(notifications);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user.id, req.orgId);
      res.json({ count });
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const success = await storage.markNotificationAsRead(req.params.id, req.user.id);
      if (!success) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.delete("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const success = await storage.deleteNotification(req.params.id, req.user.id);
      if (!success) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete notification:", error);
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // ===== ZILLOW INTEGRATION ROUTES =====
  app.get("/api/integrations/zillow", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const integration = await storage.getZillowIntegration(req.orgId);
      if (!integration) {
        return res.json({ configured: false });
      }
      res.json({
        configured: true,
        id: integration.id,
        isActive: integration.isActive,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      });
    } catch (error) {
      console.error("Failed to fetch Zillow integration:", error);
      res.status(500).json({ error: "Failed to fetch Zillow integration" });
    }
  });

  app.post("/api/integrations/zillow", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validationResult = insertZillowIntegrationSchema.safeParse({
        apiKey: req.body.apiKey,
        webhookSecret: req.body.webhookSecret,
        isActive: true,
      });

      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid input", details: validationResult.error.errors });
      }

      const { apiKey, webhookSecret } = validationResult.data;
      const existing = await storage.getZillowIntegration(req.orgId);

      if (existing) {
        const updated = await storage.updateZillowIntegration(req.orgId, {
          apiKey,
          webhookSecret,
          isActive: true,
        });
        return res.json(updated);
      }

      const integration = await storage.createZillowIntegration({
        orgId: req.orgId,
        apiKey,
        webhookSecret,
        isActive: true,
      });
      res.json(integration);
    } catch (error) {
      console.error("Failed to create/update Zillow integration:", error);
      res.status(500).json({ error: "Failed to create/update Zillow integration" });
    }
  });

  app.delete("/api/integrations/zillow", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const success = await storage.deleteZillowIntegration(req.orgId);
      if (!success) {
        return res.status(404).json({ error: "Zillow integration not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete Zillow integration:", error);
      res.status(500).json({ error: "Failed to delete Zillow integration" });
    }
  });

  // ===== API CONNECTOR (External REST API for PMS/integrators) =====
  app.use("/api/integrations/api-connector", createInternalRoutes(isAuthenticated, attachOrgContext));
  app.use("/api/integrations/api/v1", v1Router);

  // ===== ZILLOW LISTINGS ROUTES =====
  app.get("/api/zillow/listings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const listings = await storage.getZillowListings(req.orgId);
      res.json(listings);
    } catch (error) {
      console.error("Failed to fetch Zillow listings:", error);
      res.status(500).json({ error: "Failed to fetch Zillow listings" });
    }
  });

  app.post("/api/zillow/listings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validationResult = insertZillowListingSchema.safeParse({
        propertyId: req.body.propertyId,
        zillowListingId: req.body.zillowListingId,
        listingUrl: req.body.listingUrl || null,
        isActive: true,
      });

      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid input", details: validationResult.error.errors });
      }

      const { propertyId, zillowListingId, listingUrl } = validationResult.data;

      // Check if property exists
      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Check if property is already listed
      const existingPropertyListing = await storage.getZillowListingByPropertyId(propertyId, req.orgId);
      if (existingPropertyListing) {
        return res.status(400).json({ error: "Property is already listed on Zillow" });
      }

      // Check if Zillow listing ID is already used
      const existingZillowListing = await storage.getZillowListingByZillowId(zillowListingId, req.orgId);
      if (existingZillowListing) {
        return res.status(400).json({ error: "Zillow listing ID is already in use" });
      }

      const listing = await storage.createZillowListing({
        orgId: req.orgId,
        propertyId,
        zillowListingId,
        listingUrl: listingUrl || null,
        isActive: true,
      });
      res.json(listing);
    } catch (error) {
      console.error("Failed to create Zillow listing:", error);
      res.status(500).json({ error: "Failed to create Zillow listing" });
    }
  });

  app.delete("/api/zillow/listings/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const success = await storage.deleteZillowListing(req.params.id, req.orgId);
      if (!success) {
        return res.status(404).json({ error: "Zillow listing not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete Zillow listing:", error);
      res.status(500).json({ error: "Failed to delete Zillow listing" });
    }
  });

  // ===== ZILLOW WEBHOOK ENDPOINT =====
  app.post("/api/webhooks/zillow", async (req, res) => {
    try {
      const { listingId, name, email, phone, movingDate, message, leadType, webhookSecret } = req.body;

      if (!listingId) {
        return res.status(400).json({ error: "Listing ID is required" });
      }

      // Find the listing and integration
      const listing = await db.select({
        zillowListing: zillowListings,
        property: properties,
        org: organizations,
      })
        .from(zillowListings)
        .innerJoin(properties, eq(zillowListings.propertyId, properties.id))
        .innerJoin(organizations, eq(properties.orgId, organizations.id))
        .where(eq(zillowListings.zillowListingId, listingId))
        .limit(1);

      if (!listing || listing.length === 0) {
        return res.status(404).json({ error: "Listing not found" });
      }

      const { zillowListing, property, org } = listing[0];

      // Validate webhook secret for security
      const integration = await storage.getZillowIntegration(org.id);
      if (!integration || integration.webhookSecret !== webhookSecret) {
        return res.status(401).json({ error: "Unauthorized: Invalid webhook secret" });
      }

      // Normalize contact info for deduplication
      const normalizedEmail = email?.toLowerCase().trim() || '';
      const normalizedPhone = phone?.replace(/\D/g, '') || '';

      // Look for existing lead by email or phone
      let lead;
      if (normalizedEmail) {
        lead = await storage.getLeadByEmail(normalizedEmail, org.id);
      }
      if (!lead && normalizedPhone) {
        lead = await storage.getLeadByPhone(normalizedPhone, org.id);
      }

      if (lead) {
        // Update existing lead
        lead = await storage.updateLead(lead.id, {
          lastContactAt: new Date(),
          moveInDate: movingDate || lead.moveInDate,
          propertyId: property.id,
          propertyName: property.name,
        }, org.id);
      } else {
        // Create new lead
        lead = await storage.createLead({
          orgId: org.id,
          name: name || 'Unknown',
          email: normalizedEmail || 'no-email@zillow.lead',
          phone: normalizedPhone || 'no-phone',
          propertyId: property.id,
          propertyName: property.name,
          status: 'new',
          source: 'zillow',
          aiHandled: false,
          moveInDate: movingDate || null,
        });
      }

      // Record conversation
      const conversationType = leadType === 'tourRequest' ? 'tour_request' : 
                              leadType === 'applicationRequest' ? 'application_request' : 
                              'question';

      await storage.createConversation({
        leadId: lead!.id,
        type: conversationType,
        channel: 'zillow',
        message: message || 'Inquiry from Zillow',
        aiGenerated: false,
        externalId: `zillow_${listingId}_${Date.now()}`,
      });

      res.json({ 
        success: true, 
        leadId: lead!.id,
        message: "Lead processed successfully" 
      });
    } catch (error) {
      console.error("Zillow webhook error:", error);
      res.status(500).json({ error: "Failed to process Zillow lead" });
    }
  });

  const httpServer = createServer(app);
  // Backfill Message-IDs for existing conversations
  app.post("/api/conversations/backfill-message-ids", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      console.log('[Backfill] Starting Message-ID backfill for org:', req.orgId);
      
      // Get Gmail integration
      const integration = await storage.getIntegrationConfig('gmail', req.orgId);
      if (!integration || !integration.config?.access_token) {
        return res.status(400).json({ error: "Gmail not connected" });
      }
      
      // Get all conversations without Message-IDs that have externalId (Gmail message ID)
      const conversationsToBackfill = await db.select()
        .from(conversations)
        .where(
          and(
            isNull(conversations.emailMessageId),
            isNotNull(conversations.externalId),
            eq(conversations.channel, 'email')
          )
        )
        .limit(100); // Process in batches
      
      console.log('[Backfill] Found', conversationsToBackfill.length, 'conversations to backfill');
      
      let updated = 0;
      let failed = 0;
      
      for (const conv of conversationsToBackfill) {
        try {
          // Fetch the original Gmail message
          const gmailMessage = await getMessage(integration.config, conv.externalId!);
          const headers = gmailMessage.payload?.headers || [];
          const messageId = headers.find((h: any) => h.name === "Message-ID")?.value;
          
          if (messageId) {
            // Update the conversation with the Message-ID
            await db
              .update(conversations)
              .set({ emailMessageId: messageId })
              .where(eq(conversations.id, conv.id));
            updated++;
            console.log('[Backfill] Updated conversation', conv.id, 'with Message-ID:', messageId);
          } else {
            console.log('[Backfill] No Message-ID found for conversation', conv.id);
            failed++;
          }
        } catch (error: any) {
          console.error('[Backfill] Failed to process conversation', conv.id, ':', error.message);
          failed++;
        }
      }
      
      console.log('[Backfill] Complete:', updated, 'updated,', failed, 'failed');
      res.json({ updated, failed, total: conversationsToBackfill.length });
    } catch (error) {
      console.error('[Backfill] Error:', error);
      res.status(500).json({ error: "Failed to backfill Message-IDs" });
    }
  });

  // ===== DEMO REQUEST ROUTES (PUBLIC) =====
  // Create a new demo request (no authentication required)
  app.post("/api/demo-requests", async (req, res) => {
    try {
      const { acquisition_context: acquisitionContext, ...bodyWithoutAcquisition } = req.body;
      const validatedData = insertDemoRequestSchema.parse(bodyWithoutAcquisition);
      const { normalizeAcquisitionContext } = await import("./acquisition");
      const normalized = normalizeAcquisitionContext(
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
      const demoRequest = await storage.createDemoRequest({
        ...validatedData,
        ...(normalized && {
          initialOffer: normalized.initialOffer,
          acquisitionContextJson: normalized.acquisitionContextJson,
          firstTouchTs: normalized.firstTouchTs,
          landingPage: normalized.landingPage,
          utmSource: normalized.utmSource,
          utmMedium: normalized.utmMedium,
          utmCampaign: normalized.utmCampaign,
          utmTerm: normalized.utmTerm,
          utmContent: normalized.utmContent,
        }),
      });
      
      // Automatically create/update sales prospect from this demo request
      try {
        await storage.upsertProspectFromDemo(demoRequest);
        console.log("[Demo Request] Created/updated sales prospect for:", demoRequest.email);
      } catch (prospectError: any) {
        console.error("[Demo Request] Failed to create sales prospect:", prospectError.message);
        // Don't fail the demo request if prospect creation fails
      }
      
      // Send email notification with full form + acquisition context
      try {
        await sendDemoRequestNotification(demoRequest);
        console.log("[Demo Request] Email notification sent for:", demoRequest.email);
      } catch (emailError: any) {
        console.error("[Demo Request] Failed to send email notification:", emailError.message);
        // Don't fail the demo request if email sending fails
      }
      
      res.status(201).json(demoRequest);
    } catch (error: any) {
      console.error("[Demo Request] Error creating demo request:", error);
      res.status(400).json({ 
        message: "Failed to submit demo request", 
        error: error.message 
      });
    }
  });

  // Get all demo requests (admin only - would need auth)
  app.get("/api/demo-requests", isAuthenticated, async (req, res) => {
    try {
      const requests = await storage.getAllDemoRequests();
      res.json(requests);
    } catch (error) {
      console.error("[Demo Request] Error fetching demo requests:", error);
      res.status(500).json({ message: "Failed to fetch demo requests" });
    }
  });

  // ===== APPOINTMENT ROUTES =====
  // Get available time slots for a date (public)
  app.get("/api/appointments/availability", async (req, res) => {
    try {
      const { date } = req.query;
      
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ message: "Date parameter is required (YYYY-MM-DD format)" });
      }

      // Define business hours (9 AM to 5 PM) and slot duration (30 minutes)
      const businessHours = {
        start: 9, // 9 AM
        end: 17,  // 5 PM
        slotDuration: 30, // minutes
      };

      // Generate all possible time slots
      const allSlots: string[] = [];
      for (let hour = businessHours.start; hour < businessHours.end; hour++) {
        for (let minute = 0; minute < 60; minute += businessHours.slotDuration) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          allSlots.push(timeString);
        }
      }

      // Get existing appointments for this date
      const existingAppointments = await storage.getAppointmentsByDate(date);
      const bookedSlots = new Set(existingAppointments.map(apt => apt.appointmentTime));

      // Filter out booked slots and past times if date is today
      const now = new Date();
      const requestedDate = new Date(date);
      const isToday = requestedDate.toDateString() === now.toDateString();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const availableSlots = allSlots.filter(slot => {
        if (bookedSlots.has(slot)) return false;
        
        if (isToday) {
          const [hour, minute] = slot.split(':').map(Number);
          const slotTime = hour * 60 + minute;
          const currentTime = currentHour * 60 + currentMinute;
          return slotTime > currentTime + 60; // At least 1 hour from now
        }
        
        return true;
      });

      res.json({ 
        date, 
        availableSlots, 
        bookedCount: bookedSlots.size,
        totalSlots: allSlots.length 
      });
    } catch (error: any) {
      console.error("[Appointments] Error fetching availability:", error);
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  // Create a new appointment (public - no authentication required)
  app.post("/api/appointments", async (req, res) => {
    try {
      const validatedData = insertAppointmentSchema.parse(req.body);
      
      // Check if the time slot is still available
      const existingAppointments = await storage.getAppointmentsByDate(validatedData.appointmentDate);
      const isSlotTaken = existingAppointments.some(apt => 
        apt.appointmentTime === validatedData.appointmentTime && 
        apt.status === 'scheduled'
      );

      if (isSlotTaken) {
        return res.status(409).json({ 
          message: "This time slot is no longer available. Please select a different time." 
        });
      }

      const appointment = await storage.createAppointment(validatedData);
      console.log("[Appointments] Created appointment:", appointment.id);
      
      // Send confirmation emails
      try {
        const { sendAppointmentConfirmation } = await import("./email");
        await sendAppointmentConfirmation(appointment);
        console.log("[Appointments] Confirmation emails sent");
      } catch (emailError) {
        console.error("[Appointments] Error sending confirmation emails:", emailError);
        // Don't fail the appointment creation if email fails
      }
      
      res.status(201).json(appointment);
    } catch (error: any) {
      console.error("[Appointments] Error creating appointment:", error);
      res.status(400).json({ 
        message: "Failed to create appointment", 
        error: error.message 
      });
    }
  });

  // Get all appointments (admin only)
  app.get("/api/appointments", isAuthenticated, async (req, res) => {
    try {
      const appointments = await storage.getAllAppointments();
      res.json(appointments);
    } catch (error) {
      console.error("[Appointments] Error fetching appointments:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  // Update appointment status (admin only)
  app.patch("/api/appointments/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['scheduled', 'completed', 'cancelled', 'no-show'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      const updated = await storage.updateAppointmentStatus(id, status);
      
      if (!updated) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("[Appointments] Error updating appointment status:", error);
      res.status(500).json({ message: "Failed to update appointment status" });
    }
  });

  // ===== SHOWING ROUTES =====
  // Get all showings for the current organization (with enriched property/lead data)
  app.get("/api/showings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // Get base showings first
      const baseShowings = await storage.getAllShowings(req.orgId);
      
      // Batch-load scheduling settings for all properties
      const propertyIds = [...new Set(baseShowings.map(s => s.propertyId).filter(Boolean))];
      const schedulingSettingsMap = new Map();
      
      await Promise.all(
        propertyIds.map(async (propertyId) => {
          const settings = await storage.getPropertySchedulingSettings(propertyId!, req.orgId);
          if (settings) {
            schedulingSettingsMap.set(propertyId, settings);
          }
        })
      );
      
      // Enrich with property, lead, agent, and event data
      const enrichedShowings = await Promise.all(
        baseShowings.map(async (showing) => {
          const [property, unit, lead, agent] = await Promise.all([
            showing.propertyId ? storage.getProperty(showing.propertyId, req.orgId) : null,
            (showing as any).unitId ? storage.getPropertyUnit((showing as any).unitId, req.orgId) : null,
            showing.leadId ? storage.getLead(showing.leadId, req.orgId) : null,
            showing.assignedTo ? storage.getUser(showing.assignedTo) : null,
          ]);

          const schedulingSettings = showing.propertyId ? schedulingSettingsMap.get(showing.propertyId) : null;

          const agentName = agent?.firstName && agent?.lastName
            ? `${agent.firstName} ${agent.lastName}`
            : agent?.firstName || agent?.lastName || null;

          // Build full address from property
          const fullAddress = property ? [
            property.address,
            property.city,
            property.state,
            property.zipCode
          ].filter(Boolean).join(", ") : null;

          // Parse lead name into first and last name
          let leadFirstName = null;
          let leadLastName = null;
          let leadFullName = null;
          
          if (lead?.name) {
            const nameParts = lead.name.trim().split(/\s+/);
            if (nameParts.length >= 2) {
              leadFirstName = nameParts[0];
              leadLastName = nameParts.slice(1).join(" "); // Handle multiple middle/last names
              leadFullName = lead.name;
            } else {
              // Single name - treat as first name
              leadFirstName = lead.name;
              leadFullName = lead.name;
            }
          }

          // Determine event name - ALWAYS prioritize showing's original title first
          // This ensures existing bookings keep their original event name even when settings change
          // Only use scheduling settings if the title is missing or empty (shouldn't happen, but safety check)
          let eventName = null;
          if (showing.title && showing.title.trim() !== "") {
            eventName = showing.title;
          } else if (unit?.customEventName) {
            eventName = unit.customEventName;
          } else if (schedulingSettings?.eventName) {
            eventName = schedulingSettings.eventName;
          }

          return {
            ...showing,
            propertyName: property?.name || null,
            propertyAddress: fullAddress,
            unitId: (showing as any).unitId || null,
            unitNumber: unit?.unitNumber || null,
            leadName: leadFullName,
            leadFirstName: leadFirstName,
            leadLastName: leadLastName,
            leadEmail: lead?.email || null,
            leadPhone: lead?.phone || null,
            agentName,
            eventName,
          };
        })
      );

      res.json(enrichedShowings);
    } catch (error) {
      console.error("[Showings] Error fetching showings:", error);
      res.status(500).json({ message: "Failed to fetch showings" });
    }
  });

  // Get showings by date range
  app.get("/api/showings/range", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      console.log(`[Showings Range] Fetching showings from ${startDate} to ${endDate} for org ${req.orgId}`);
      const baseShowings = await storage.getShowingsByDateRange(
        startDate as string,
        endDate as string,
        req.orgId
      );
      
      // Enrich with property, unit, and lead data (similar to /api/showings)
      const enrichedShowings = await Promise.all(
        baseShowings.map(async (showing) => {
          const [property, unit, lead] = await Promise.all([
            showing.propertyId ? storage.getProperty(showing.propertyId, req.orgId) : null,
            showing.unitId ? storage.getPropertyUnit(showing.unitId, req.orgId) : null,
            showing.leadId ? storage.getLead(showing.leadId, req.orgId) : null,
          ]);

          // Build full address with unit number if location is not already set
          let location = showing.location;
          if (!location && property) {
            const locationParts = [property.address];
            if (property.city) locationParts.push(property.city);
            if (property.state) locationParts.push(property.state);
            if (property.zipCode) locationParts.push(property.zipCode);
            const fullAddress = locationParts.filter(Boolean).join(", ");
            location = unit?.unitNumber ? `${fullAddress} - Unit ${unit.unitNumber}` : fullAddress;
          }

          // Get lead name
          const leadName = lead?.name || null;

          return {
            ...showing,
            location, // Ensure location includes unit number
            propertyName: property?.name || null,
            unitNumber: unit?.unitNumber || null,
            leadName, // Include lead name for calendar display
          };
        })
      );
      
      console.log(`[Showings Range] Found ${enrichedShowings.length} showings:`, enrichedShowings.map(s => ({
        id: s.id,
        date: s.scheduledDate,
        time: s.scheduledTime,
        assignedTo: s.assignedTo,
        title: s.title,
        location: s.location
      })));
      
      res.json(enrichedShowings);
    } catch (error) {
      console.error("[Showings] Error fetching showings by date range:", error);
      res.status(500).json({ message: "Failed to fetch showings" });
    }
  });

  // Get showings for a specific property
  app.get("/api/showings/property/:propertyId", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const showings = await storage.getShowingsByProperty(req.params.propertyId, req.orgId);
      res.json(showings);
    } catch (error) {
      console.error("[Showings] Error fetching showings by property:", error);
      res.status(500).json({ message: "Failed to fetch showings" });
    }
  });

  // Get showings for a specific lead
  app.get("/api/showings/lead/:leadId", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const showings = await storage.getShowingsByLead(req.params.leadId, req.orgId);
      res.json(showings);
    } catch (error) {
      console.error("[Showings] Error fetching showings by lead:", error);
      res.status(500).json({ message: "Failed to fetch showings" });
    }
  });

  // Get available time slots for a property/agent (authenticated)
  app.get("/api/showings/available-times", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { propertyId, date, assignedTo, unitId } = req.query;
      
      if (!propertyId || !date) {
        return res.status(400).json({ message: "propertyId and date are required" });
      }

      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Get property scheduling settings
      const propertySettings = await storage.getPropertySchedulingSettings(propertyId, req.orgId);
      
      // Get unit settings if unitId provided
      let unitSettings = null;
      if (unitId) {
        unitSettings = await storage.getUnitSchedulingSettings(unitId, req.orgId);
      }

      // Determine assigned members - if assignedTo is provided, use only that agent
      let effectiveAssignedMembers: any[] = [];
      if (assignedTo) {
        effectiveAssignedMembers = [{ userId: assignedTo }];
      } else {
        // Use unit-level or property-level assigned members
        const parseMembers = (members: any): any[] => {
          if (!members) return [];
          if (Array.isArray(members)) return members;
          if (typeof members === 'string') {
            try {
              const parsed = JSON.parse(members);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          }
          return [];
        };
        const unitAssignedMembers = parseMembers(unitSettings?.customAssignedMembers);
        const propertyAssignedMembers = parseMembers(propertySettings?.assignedMembers);
        effectiveAssignedMembers = unitAssignedMembers.length > 0 ? unitAssignedMembers : propertyAssignedMembers;
      }

      if (effectiveAssignedMembers.length === 0) {
        return res.json({ availableSlots: [] });
      }

      // Get schedule preferences for assigned members
      const userIds = effectiveAssignedMembers.map((m: any) => typeof m === 'string' ? m : m.userId).filter(Boolean);
      const schedulePrefs = await storage.getSchedulePreferencesForUsers(userIds, propertyId);

      // Get existing showings for the date
      const allShowings = await storage.getShowingsByDateRange(date, date, req.orgId);
      
      // Filter showings for the specific agent if assignedTo is provided, exclude current showing
      const relevantShowings = allShowings.filter(s => {
        if (s.id === req.query.excludeShowingId) return false;
        if (assignedTo) return s.assignedTo === assignedTo;
        return true;
      });

      // Use suggestTimeSlots to get available time slots
      const { suggestTimeSlots } = await import("./ai-scheduling");
      const suggestions = suggestTimeSlots(
        date,
        property,
        relevantShowings,
        schedulePrefs,
        new Map([[property.id, property]]),
        unitSettings || propertySettings
      );

      // Extract time strings from suggestions
      const availableSlots = suggestions.map(s => s.time);

      res.json({ availableSlots });
    } catch (error: any) {
      console.error("[Showings] Error fetching available time slots:", error);
      res.status(500).json({ message: "Failed to fetch available time slots", error: error.message });
    }
  });

  // Get a single showing
  app.get("/api/showings/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const showing = await storage.getShowing(req.params.id, req.orgId);
      if (!showing) {
        return res.status(404).json({ message: "Showing not found" });
      }
      // Ensure unitId is included in the response
      // The unitId field is now in the schema, so it should be in the showing object
      const response = {
        ...showing,
        unitId: showing.unitId || (showing as any).unitId || null,
      };
      console.log("[Get Showing] Showing ID:", showing.id, "unitId:", response.unitId);
      res.json(response);
    } catch (error) {
      console.error("[Showings] Error fetching showing:", error);
      res.status(500).json({ message: "Failed to fetch showing" });
    }
  });

  // Create a new showing
  app.post("/api/showings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // Omit orgId and assignedTo from client data - we'll inject them server-side
      const clientSchema = insertShowingSchema.omit({ orgId: true, assignedTo: true });
      const validatedData = clientSchema.parse(req.body);
      const showing = await storage.createShowing({ 
        ...validatedData, 
        orgId: req.orgId,
        assignedTo: req.user.id // Track which user created this showing
      });
      res.status(201).json(showing);
    } catch (error: any) {
      console.error("[Showings] Error creating showing:", error);
      res.status(400).json({ 
        message: "Failed to create showing", 
        error: error.message 
      });
    }
  });

  // Update a showing
  app.patch("/api/showings/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // Extract cancellationReason before validation (it's not in the schema)
      const cancellationReason = req.body.cancellationReason;
      
      // Omit orgId from client data - prevent org switching
      const partialSchema = insertShowingSchema.omit({ orgId: true }).partial();
      // Remove cancellationReason from body before validation
      const bodyForValidation = { ...req.body };
      delete bodyForValidation.cancellationReason;
      const validatedData = partialSchema.parse(bodyForValidation);
      
      // Get the original showing to check if we need to send cancellation email
      const originalShowing = await storage.getShowing(req.params.id, req.orgId);
      if (!originalShowing) {
        return res.status(404).json({ message: "Showing not found or access denied" });
      }

      // Check for conflicts if date/time or assignedTo is being changed
      if (validatedData.scheduledDate || validatedData.scheduledTime || validatedData.assignedTo) {
        const { detectConflicts } = await import("./ai-scheduling");
        const property = await storage.getProperty(originalShowing.propertyId, req.orgId);
        if (property) {
          // Get all showings for the org to check conflicts
          const checkDate = validatedData.scheduledDate || originalShowing.scheduledDate;
          const allShowings = await storage.getShowingsByDateRange(
            checkDate,
            checkDate,
            req.orgId
          );
          
          // Merge validated data with original showing for conflict check
          const showingToCheck = {
            ...originalShowing,
            ...validatedData,
            id: originalShowing.id, // Keep original ID for conflict check
          };
          
          const conflicts = detectConflicts(
            showingToCheck,
            allShowings,
            [], // Schedule preferences - not needed for basic conflict check
            property.timezone || undefined
          );
          
          // Check for double-booking errors (same agent, overlapping time)
          const doubleBookingErrors = conflicts.filter(c => c.type === 'double_booking' && c.severity === 'error');
          if (doubleBookingErrors.length > 0) {
            return res.status(400).json({ 
              message: "Conflict detected",
              conflicts: doubleBookingErrors,
              error: doubleBookingErrors[0].message
            });
          }
        }
      }

      const showing = await storage.updateShowing(req.params.id, validatedData, req.orgId);
      
      if (!showing) {
        return res.status(404).json({ message: "Showing not found or access denied" });
      }

      // Check if showing is being rescheduled (date or time changed)
      const dateChanged = validatedData.scheduledDate && validatedData.scheduledDate !== originalShowing.scheduledDate;
      const timeChanged = validatedData.scheduledTime && validatedData.scheduledTime !== originalShowing.scheduledTime;
      const isRescheduled = dateChanged || timeChanged;
      
      console.log(`[Showings] Reschedule check for showing ${req.params.id}:`, {
        dateChanged,
        timeChanged,
        isRescheduled,
        oldDate: originalShowing.scheduledDate,
        newDate: validatedData.scheduledDate,
        oldTime: originalShowing.scheduledTime,
        newTime: validatedData.scheduledTime,
      });
      
      if (isRescheduled) {
        // Validate EMAIL_PASSWORD is configured before attempting to send
        if (!process.env.EMAIL_PASSWORD) {
          console.error("[Showings] EMAIL_PASSWORD not configured - cannot send reschedule email");
          console.warn("[Showings] Please set EMAIL_PASSWORD environment variable to enable email notifications");
        } else {
          try {
            console.log(`[Showings] ===== RESCHEDULE EMAIL PROCESS STARTING =====`);
            console.log(`[Showings] Showing ${req.params.id} is being rescheduled, preparing to send emails...`);
            console.log(`[Showings] Using email: ${process.env.EMAIL_USER || "lead2leaseai@gmail.com"}`);
            console.log(`[Showings] Old date/time: ${originalShowing.scheduledDate} ${originalShowing.scheduledTime}`);
            console.log(`[Showings] New date/time: ${validatedData.scheduledDate || originalShowing.scheduledDate} ${validatedData.scheduledTime || originalShowing.scheduledTime}`);
            
            // Fetch lead and property details for email
            const lead = originalShowing.leadId ? await storage.getLead(originalShowing.leadId, req.orgId) : null;
            const property = await storage.getProperty(originalShowing.propertyId, req.orgId);
            
            console.log(`[Showings] Fetched data:`, {
              hasLead: !!lead,
              leadEmail: lead?.email || 'none',
              leadName: lead?.name || 'none',
              hasProperty: !!property,
              propertyName: property?.name || 'none',
            });
            
            // Fetch assigned agent details if assignedTo is set
            let agentEmail: string | undefined;
            let agentName: string | undefined;
            let assignedMember: any | null = null;
            if (originalShowing.assignedTo) {
              try {
                console.log(`[Showings] Fetching agent details for user: ${originalShowing.assignedTo}`);
                const agent = await storage.getUser(originalShowing.assignedTo);
                if (agent && agent.email) {
                  agentEmail = agent.email;
                  agentName = agent.firstName && agent.lastName 
                    ? `${agent.firstName} ${agent.lastName}` 
                    : agent.email;
                  assignedMember = {
                    firstName: agent.firstName,
                    lastName: agent.lastName,
                    email: agent.email,
                    phone: agent.phone,
                  };
                  console.log(`[Showings] Agent found: ${agentName} (${agentEmail})`);
                } else {
                  console.log(`[Showings] Agent user not found or has no email`);
                }
              } catch (agentError) {
                console.error(`[Showings] Error fetching agent:`, agentError);
              }
            } else {
              console.log(`[Showings] No agent assigned to this showing`);
            }
            
            if (lead && lead.email && property) {
              // Get manager email for calendar invite organizer
              const orgUsers = await storage.getUsersByOrg(req.orgId);
              const managerEmail = orgUsers && orgUsers.length > 0 ? orgUsers[0].email : "lead2leaseai@gmail.com";
              
              // Get organization details
              let organization: any | null = null;
              try {
                organization = await storage.getOrganization(req.orgId);
              } catch (orgError) {
                console.warn(`[Showings] Could not fetch organization`);
              }
              
              // Get unit number if this showing is for a specific unit
              let unitNumber: string | undefined;
              let eventName: string | undefined;
              let eventDescription: string | undefined;
              let fullUnit: any | null = null;
              if ((originalShowing as any).unitId) {
                try {
                  const unit = await storage.getPropertyUnit((originalShowing as any).unitId, req.orgId);
                  if (unit) {
                    unitNumber = unit.unitNumber;
                    fullUnit = unit;
                    // Get unit-level booking settings for event name and description
                    const unitSettings = await storage.getUnitSchedulingSettings((originalShowing as any).unitId, req.orgId);
                    if (unitSettings) {
                      eventName = unitSettings.customEventName || undefined;
                      eventDescription = unitSettings.customEventDescription || undefined;
                    }
                  }
                } catch (unitError) {
                  console.warn(`[Showings] Could not fetch unit for unitId ${(originalShowing as any).unitId}`);
                }
              }
              
              // If no unit-level settings, get property-level settings
              if (!eventName || !eventDescription) {
                try {
                  const propertySettings = await storage.getPropertySchedulingSettings(property.id, req.orgId);
                  if (propertySettings) {
                    if (!eventName) eventName = propertySettings.eventName || undefined;
                    if (!eventDescription) eventDescription = propertySettings.eventDescription || undefined;
                  }
                } catch (settingsError) {
                  console.warn(`[Showings] Could not fetch property scheduling settings`);
                }
              }
              
              // Use showing.title as eventName if available (preserves original booking name)
              if (originalShowing.title && !eventName) {
                eventName = originalShowing.title;
              }
              
              console.log(`[Showings] Calling sendShowingRescheduleEmail...`);
              console.log(`[Showings] Email data:`, {
                leadName: lead.name || "Valued Customer",
                leadEmail: lead.email,
                agentEmail: agentEmail || 'none',
                agentName: agentName || 'none',
                propertyName: property.name,
                unitNumber: unitNumber || 'none',
                eventName: eventName || 'none',
                hasEventDescription: !!eventDescription,
                hasAssignedMember: !!assignedMember,
                hasOrganization: !!organization,
                oldDate: originalShowing.scheduledDate,
                oldTime: originalShowing.scheduledTime,
                newDate: validatedData.scheduledDate || originalShowing.scheduledDate,
                newTime: validatedData.scheduledTime || originalShowing.scheduledTime,
              });
              
              const { sendShowingRescheduleEmail } = await import('./email');
              await sendShowingRescheduleEmail({
                showingId: originalShowing.id,
                leadName: lead.name || "Valued Customer",
                leadEmail: lead.email,
                agentEmail: agentEmail,
                agentName: agentName,
                propertyName: property.name,
                propertyAddress: property.address,
                unitNumber: unitNumber,
                durationMinutes: originalShowing.durationMinutes || 30,
                managerEmail: managerEmail,
                oldScheduledDate: originalShowing.scheduledDate,
                oldScheduledTime: originalShowing.scheduledTime,
                newScheduledDate: validatedData.scheduledDate || originalShowing.scheduledDate,
                newScheduledTime: validatedData.scheduledTime || originalShowing.scheduledTime,
                eventName: eventName,
                eventDescription: eventDescription,
                assignedMember: assignedMember,
                organization: organization,
                property: property,
                unit: fullUnit,
              });
              console.log(`[Showings] ===== RESCHEDULE EMAIL PROCESS COMPLETED =====`);
              console.log(`[Showings] Reschedule emails sent for showing ${req.params.id} - Lead: ${lead.email}${agentEmail ? `, Agent: ${agentEmail}` : ''}`);
            } else {
              console.warn(`[Showings] Cannot send reschedule email - missing lead email or property. Lead: ${lead?.email || 'none'}, Property: ${property?.name || 'none'}`);
            }
          } catch (emailError: any) {
            // Log error but don't fail the request
            console.error("[Showings] ===== ERROR SENDING RESCHEDULE EMAIL =====");
            console.error("[Showings] Error sending reschedule email:", emailError);
            console.error("[Showings] Email error details:", {
              message: emailError.message,
              stack: emailError.stack,
              name: emailError.name,
            });
            // Continue with the response even if email fails
          }
        }
      }

      // If status is being changed to cancelled and cancellation reason is provided, send email
      // Check if status actually changed to cancelled (not just if it's already cancelled)
      const statusChangedToCancelled = validatedData.status === "cancelled" && originalShowing.status !== "cancelled";
      
      console.log(`[Showings] Update request for showing ${req.params.id}:`, {
        newStatus: validatedData.status,
        oldStatus: originalShowing.status,
        statusChangedToCancelled,
        hasCancellationReason: !!cancellationReason,
        cancellationReasonLength: cancellationReason?.trim().length || 0,
      });
      
      if (statusChangedToCancelled && cancellationReason && cancellationReason.trim()) {
        // Validate EMAIL_PASSWORD is configured before attempting to send
        if (!process.env.EMAIL_PASSWORD) {
          console.error("[Showings] EMAIL_PASSWORD not configured - cannot send cancellation email");
          console.warn("[Showings] Please set EMAIL_PASSWORD environment variable to enable email notifications");
        } else {
          try {
            console.log(`[Showings] ===== CANCELLATION EMAIL PROCESS STARTING =====`);
            console.log(`[Showings] Status changed to cancelled for showing ${req.params.id}, preparing to send emails...`);
            console.log(`[Showings] Using email: ${process.env.EMAIL_USER || "lead2leaseai@gmail.com"}`);
            console.log(`[Showings] Cancellation reason: ${cancellationReason.trim()}`);
            
            // Fetch lead and property details for email
            const lead = originalShowing.leadId ? await storage.getLead(originalShowing.leadId, req.orgId) : null;
            const property = await storage.getProperty(originalShowing.propertyId, req.orgId);
            
            console.log(`[Showings] Fetched data:`, {
              hasLead: !!lead,
              leadEmail: lead?.email || 'none',
              leadName: lead?.name || 'none',
              hasProperty: !!property,
              propertyName: property?.name || 'none',
            });
            
            // Fetch assigned agent details if assignedTo is set
            let agentEmail: string | undefined;
            let agentName: string | undefined;
            if (originalShowing.assignedTo) {
              try {
                console.log(`[Showings] Fetching agent details for user: ${originalShowing.assignedTo}`);
                const agent = await storage.getUser(originalShowing.assignedTo);
                if (agent && agent.email) {
                  agentEmail = agent.email;
                  agentName = agent.firstName && agent.lastName 
                    ? `${agent.firstName} ${agent.lastName}` 
                    : agent.email;
                  console.log(`[Showings] Agent found: ${agentName} (${agentEmail})`);
                } else {
                  console.warn(`[Showings] Agent user found but no email: ${originalShowing.assignedTo}`);
                }
              } catch (agentError) {
                console.warn(`[Showings] Could not fetch agent details for user ${originalShowing.assignedTo}:`, agentError);
              }
            } else {
              console.log(`[Showings] No assignedTo user, skipping agent email`);
            }
            
            if (lead && lead.email && property) {
              // Get unit number if this showing is for a specific unit
              let unitNumber: string | undefined;
              if ((originalShowing as any).unitId) {
                try {
                  const unit = await storage.getPropertyUnit((originalShowing as any).unitId, req.orgId);
                  if (unit) {
                    unitNumber = unit.unitNumber;
                  }
                } catch (unitError) {
                  console.warn(`[Showings] Could not fetch unit for unitId ${(originalShowing as any).unitId}`);
                }
              }
              
              // Get event name, description, assigned member, and organization
              const eventName = originalShowing.title || null;
              const eventDescription = originalShowing.description || null;
              let assignedMember = null;
              if (originalShowing.assignedTo) {
                try {
                  assignedMember = await storage.getUser(originalShowing.assignedTo);
                } catch (error) {
                  console.warn(`[Showings] Could not fetch assigned member ${originalShowing.assignedTo}:`, error);
                }
              }
              const organization = await storage.getOrganization(property.orgId);
              
              console.log(`[Showings] Calling sendShowingCancellationEmail...`);
              const { sendShowingCancellationEmail } = await import('./email');
              await sendShowingCancellationEmail({
                leadName: lead.name || "Valued Customer",
                leadEmail: lead.email,
                agentEmail: agentEmail,
                agentName: agentName,
                propertyName: property.name,
                propertyAddress: property.address,
                unitNumber: unitNumber,
                scheduledDate: originalShowing.scheduledDate,
                scheduledTime: originalShowing.scheduledTime,
                durationMinutes: originalShowing.durationMinutes || 30,
                cancellationReason: cancellationReason.trim(),
                eventName: eventName,
                eventDescription: eventDescription,
                assignedMember: assignedMember,
                organization: organization,
                showingId: originalShowing.id,
              });
              console.log(`[Showings] ===== CANCELLATION EMAIL PROCESS COMPLETED =====`);
              console.log(`[Showings] Cancellation emails sent for showing ${req.params.id} - Lead: ${lead.email}${agentEmail ? `, Agent: ${agentEmail}` : ''}`);
            } else {
              console.warn(`[Showings] Cannot send cancellation email - missing lead email or property. Lead: ${lead?.email || 'none'}, Property: ${property?.name || 'none'}`);
            }
          } catch (emailError: any) {
            // Log error but don't fail the request
            console.error("[Showings] ===== ERROR SENDING CANCELLATION EMAIL =====");
            console.error("[Showings] Error sending cancellation email:", emailError);
            console.error("[Showings] Email error details:", {
              message: emailError.message,
              stack: emailError.stack,
              name: emailError.name,
            });
            // Continue with the response even if email fails
          }
        }
      } else if (validatedData.status === "cancelled" && originalShowing.status === "cancelled") {
        console.log(`[Showings] Showing ${req.params.id} is already cancelled, skipping email`);
      } else if (validatedData.status === "cancelled" && (!cancellationReason || !cancellationReason.trim())) {
        console.warn(`[Showings] Status changed to cancelled but no cancellation reason provided, skipping email`);
      } else {
        console.log(`[Showings] Status not changed to cancelled, no email needed. New status: ${validatedData.status}, Old status: ${originalShowing.status}`);
      }

      res.json(showing);
    } catch (error: any) {
      console.error("[Showings] Error updating showing:", error);
      res.status(400).json({ 
        message: "Failed to update showing", 
        error: error.message 
      });
    }
  });

  // Delete a showing
  app.delete("/api/showings/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const deleted = await storage.deleteShowing(req.params.id, req.orgId);
      if (!deleted) {
        return res.status(404).json({ message: "Showing not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("[Showings] Error deleting showing:", error);
      res.status(500).json({ message: "Failed to delete showing" });
    }
  });

  // Delete all showings for today (admin utility)
  app.delete("/api/showings/today", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const allShowings = await storage.getShowingsByDateRange(today, today, req.orgId);
      
      let deletedCount = 0;
      for (const showing of allShowings) {
        const deleted = await storage.deleteShowing(showing.id, req.orgId);
        if (deleted) deletedCount++;
      }
      
      console.log(`[Delete Today Bookings] Deleted ${deletedCount} showings for ${today}`);
      res.json({ 
        message: `Deleted ${deletedCount} showings for ${today}`,
        count: deletedCount,
        date: today
      });
    } catch (error) {
      console.error("[Delete Today Bookings] Error:", error);
      res.status(500).json({ message: "Failed to delete today's bookings" });
    }
  });

  // ===== AI SCHEDULING ROUTES =====
  // Get AI-suggested showings pending approval
  app.get("/api/showings/ai-suggested", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const showings = await storage.getAISuggestedShowings(req.orgId);
      res.json(showings);
    } catch (error) {
      console.error("[AI Scheduling] Error fetching AI-suggested showings:", error);
      res.status(500).json({ message: "Failed to fetch AI-suggested showings" });
    }
  });

  // Analyze conflicts for a proposed showing
  app.post("/api/showings/analyze-conflicts", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = analyzeConflictsSchema.parse(req.body);
      const { propertyId, scheduledDate, scheduledTime, durationMinutes, showingId } = validatedData;

      // Verify property belongs to the organization
      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        return res.status(404).json({ message: "Property not found or access denied" });
      }

      // If showingId provided, verify it belongs to the organization
      if (showingId) {
        const showing = await storage.getShowing(showingId, req.orgId);
        if (!showing) {
          return res.status(404).json({ message: "Showing not found or access denied" });
        }
      }

      // Get all showings and schedule preferences
      const allShowings = await storage.getAllShowings(req.orgId);
      const schedulePreferences = await storage.getSchedulePreferences(req.user.id);

      // Import AI scheduling service
      const { detectConflicts } = await import('./ai-scheduling');

      // Detect conflicts
      const conflicts = detectConflicts(
        {
          id: showingId,
          propertyId,
          scheduledDate,
          scheduledTime,
          durationMinutes,
        },
        allShowings,
        schedulePreferences,
        property.timezone || 'America/Chicago'
      );

      res.json({ conflicts });
    } catch (error: any) {
      console.error("[AI Scheduling] Error analyzing conflicts:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Failed to analyze conflicts",
        error: error.message 
      });
    }
  });

  // Suggest optimal time slots for a showing
  app.post("/api/showings/suggest-times", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = suggestTimesSchema.parse(req.body);
      const { propertyId, date } = validatedData;

      // Verify property belongs to the organization
      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        return res.status(404).json({ message: "Property not found or access denied" });
      }

      const allShowings = await storage.getAllShowings(req.orgId);
      const schedulePreferences = await storage.getSchedulePreferences(req.user.id);
      const allProperties = await storage.getAllProperties(req.orgId);
      
      // Create property map for route optimization
      const propertyMap = new Map(allProperties.map(p => [p.id, p]));

      // Import AI scheduling service
      const { suggestTimeSlots } = await import('./ai-scheduling');

      // Get time slot suggestions
      const suggestions = suggestTimeSlots(
        date,
        property,
        allShowings,
        schedulePreferences,
        propertyMap
      );

      res.json({ suggestions });
    } catch (error: any) {
      console.error("[AI Scheduling] Error suggesting time slots:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Failed to suggest time slots",
        error: error.message 
      });
    }
  });

  // Approve an AI-suggested showing
  app.post("/api/showings/:id/approve", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const showing = await storage.getShowing(req.params.id, req.orgId);
      
      if (!showing) {
        return res.status(404).json({ message: "Showing not found" });
      }

      if (showing.status !== 'ai_suggested') {
        return res.status(400).json({ 
          message: "Only AI-suggested showings can be approved" 
        });
      }

      // Update status to approved
      const updated = await storage.updateShowing(
        req.params.id,
        { status: 'approved' },
        req.orgId
      );

      res.json(updated);
    } catch (error: any) {
      console.error("[AI Scheduling] Error approving showing:", error);
      res.status(500).json({ 
        message: "Failed to approve showing",
        error: error.message 
      });
    }
  });

  // Reject an AI-suggested showing
  app.post("/api/showings/:id/reject", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const showing = await storage.getShowing(req.params.id, req.orgId);
      
      if (!showing) {
        return res.status(404).json({ message: "Showing not found" });
      }

      if (showing.status !== 'ai_suggested') {
        return res.status(400).json({ 
          message: "Only AI-suggested showings can be rejected" 
        });
      }

      // Delete the showing
      const deleted = await storage.deleteShowing(req.params.id, req.orgId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Showing not found" });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error("[AI Scheduling] Error rejecting showing:", error);
      res.status(500).json({ 
        message: "Failed to reject showing",
        error: error.message 
      });
    }
  });

  // ===== PROPERTY SCHEDULING SETTINGS ROUTES =====
  
  // Get scheduling settings for a specific property
  app.get("/api/properties/:propertyId/scheduling-settings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const settings = await storage.getPropertySchedulingSettings(req.params.propertyId, req.orgId);
      res.json(settings || null);
    } catch (error) {
      console.error("[Scheduling Settings] Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch scheduling settings" });
    }
  });

  // Get all scheduling settings for organization
  app.get("/api/scheduling-settings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const settings = await storage.getAllPropertySchedulingSettings(req.orgId);
      res.json(settings);
    } catch (error) {
      console.error("[Scheduling Settings] Error fetching all settings:", error);
      res.status(500).json({ message: "Failed to fetch scheduling settings" });
    }
  });

  // Create or update scheduling settings for a property
  app.post("/api/properties/:propertyId/scheduling-settings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      
      console.log("[Scheduling Settings] POST request body:", JSON.stringify(req.body, null, 2));
      console.log("[Scheduling Settings] reminderSettings in request:", req.body.reminderSettings);
      
      // Verify property belongs to org
      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Validate request body (omit orgId and propertyId as they're added by the API)
      const validatedData = insertPropertySchedulingSettingsSchema.omit({ orgId: true, propertyId: true }).parse(req.body);
      console.log("[Scheduling Settings] Validated data reminderSettings:", validatedData.reminderSettings);

      // Check if settings already exist
      const existingSettings = await storage.getPropertySchedulingSettings(propertyId, req.orgId);
      
      if (existingSettings) {
        // Update existing settings (cascade handled in storage layer)
        const updated = await storage.updatePropertySchedulingSettings(
          propertyId,
          validatedData,
          req.orgId
        );
        res.json(updated);
      } else {
        // Create new settings
        const settings = await storage.createPropertySchedulingSettings({
          ...validatedData,
          propertyId,
          orgId: req.orgId
        });
        res.status(201).json(settings);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("[Scheduling Settings] Error saving settings:", error);
      res.status(500).json({ message: "Failed to save scheduling settings" });
    }
  });

  // Delete scheduling settings for a property
  // Note: This only deletes unit-level settings, NOT property-level settings
  // Property-level settings persist even when all unit booking types are removed
  app.delete("/api/properties/:propertyId/scheduling-settings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      const deletePropertySettings = req.query.deletePropertySettings === 'true';
      
      // Verify property belongs to org
      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Get all units for this property
      const units = await storage.getAllUnitsByProperty(propertyId, req.orgId);
      
      // Clear custom settings for all units (cascade delete)
      for (const unit of units) {
        await storage.deleteUnitSchedulingSettings(unit.id, req.orgId);
      }

      // Only delete property-level scheduling settings if explicitly requested
      // This ensures property settings persist when all unit booking types are removed
      if (deletePropertySettings) {
      await storage.deletePropertySchedulingSettings(propertyId, req.orgId);
        console.log(`[Scheduling Settings] Deleted property-level settings for ${propertyId}`);
      } else {
        console.log(`[Scheduling Settings] Preserved property-level settings for ${propertyId}, only cleared unit settings`);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("[Scheduling Settings] Error deleting settings:", error);
      res.status(500).json({ message: "Failed to delete scheduling settings" });
    }
  });

  // ===== DISPLAY ORDER ROUTES =====

  // Update property display order
  app.patch("/api/properties/:propertyId/display-order", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      const { displayOrder } = req.body;

      // Verify property belongs to org
      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Validate displayOrder
      if (typeof displayOrder !== 'number' || displayOrder < 0) {
        return res.status(400).json({ message: "displayOrder must be a non-negative number" });
      }

      // Update property display order
      await storage.updateProperty(propertyId, { displayOrder }, req.orgId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("[Display Order] Error updating property display order:", error);
      res.status(500).json({ message: "Failed to update property display order" });
    }
  });

  // Update unit display order
  app.patch("/api/units/:unitId/display-order", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { unitId } = req.params;
      const { displayOrder } = req.body;

      // Verify unit belongs to org
      const unit = await storage.getPropertyUnit(unitId, req.orgId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }

      // Validate displayOrder
      if (typeof displayOrder !== 'number' || displayOrder < 0) {
        return res.status(400).json({ message: "displayOrder must be a non-negative number" });
      }

      // Update unit display order
      await storage.updatePropertyUnit(unitId, { displayOrder }, req.orgId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("[Display Order] Error updating unit display order:", error);
      res.status(500).json({ message: "Failed to update unit display order" });
    }
  });

  // ===== UNIT SCHEDULING SETTINGS ROUTES =====

  // Get unit scheduling settings
  app.get("/api/units/:unitId/scheduling", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { unitId } = req.params;
      
      // Verify unit belongs to org
      const unit = await storage.getPropertyUnit(unitId, req.orgId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }

      const settings = await storage.getUnitSchedulingSettings(unitId, req.orgId);
      res.json(settings || {
        bookingEnabled: true,
        customEventName: null,
        customEventDescription: null,
        customAssignedMembers: null,
        customPreferredTimes: null,
      });
    } catch (error) {
      console.error("[Unit Scheduling] Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch unit scheduling settings" });
    }
  });

  // Update unit scheduling settings
  app.patch("/api/units/:unitId/scheduling", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { unitId } = req.params;
      
      // Verify unit belongs to org
      const unit = await storage.getPropertyUnit(unitId, req.orgId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }

      // Validate request body
      const updateSchema = z.object({
        bookingEnabled: z.boolean().optional(),
        customEventName: z.string().nullable().optional(),
        customEventDescription: z.string().nullable().optional(),
        customAssignedMembers: z.array(assignedMemberSchema).nullable().optional(),
        customPreferredTimes: z.any().nullable().optional(),
        customBookingMode: z.string().nullable().optional(),
        customEventDuration: z.number().nullable().optional(),
        customBufferTime: z.number().nullable().optional(),
        customLeadTime: z.number().nullable().optional(),
        customReminderSettings: z.any().nullable().optional(),
        turnOnListing: z.boolean().optional(), // Flag to indicate user confirmed turning on listing
      });

      const validated = updateSchema.parse(req.body);
      
      // Sync bookingEnabled with listing acceptBookings - they must stay in sync
      // Check if unit has an associated listing
      const listing = await storage.getListingByUnit(unitId, req.orgId);
      
      if (listing) {
        // Sync acceptBookings with bookingEnabled
        if ('bookingEnabled' in validated && validated.bookingEnabled !== undefined) {
          if (listing.acceptBookings !== validated.bookingEnabled) {
            await storage.updateListing(listing.id, { acceptBookings: validated.bookingEnabled }, req.orgId);
            console.log(`[Unit Scheduling] Synced listing ${listing.id} acceptBookings to ${validated.bookingEnabled} due to unit ${unitId} bookingEnabled change`);
          }
        }
        
        // Sync listing status with booking status - they must stay in sync
        // If booking was created from a listing, both must be on or both off
        if (unit.createdFromListingId) {
          // If turning on booking and listing is not active, require confirmation
          if (validated.bookingEnabled === true && listing.status !== 'active' && !validated.turnOnListing) {
            // Return a special response indicating that turning on booking will also turn on listing
            return res.status(200).json({
              requiresListingConfirmation: true,
              listingId: listing.id,
              listingStatus: listing.status,
              message: "Turning on this booking will also activate the listing. Would you like to proceed?",
            });
          }
          
          // If user confirmed turning on booking, also activate the listing
          if (validated.bookingEnabled === true && validated.turnOnListing) {
            await storage.updateListing(unit.createdFromListingId, { status: 'active' }, req.orgId);
            console.log(`[Unit Scheduling] Activated listing ${unit.createdFromListingId} when enabling booking for unit ${unitId}`);
          }
          
          // If turning booking ON and listing is already active, ensure booking is enabled (no action needed on listing)
          // This case is handled by the bookingEnabled update below
          
          // If turning booking OFF, also deactivate the listing
          if (validated.bookingEnabled === false && listing.status === 'active') {
            await storage.updateListing(unit.createdFromListingId, { status: 'inactive' }, req.orgId);
            console.log(`[Unit Scheduling] Deactivated listing ${unit.createdFromListingId} when disabling booking for unit ${unitId}`);
          }
        }
      }
      
      // Remove turnOnListing from validated data before saving
      const { turnOnListing, ...settingsToUpdate } = validated;
      await storage.updateUnitSchedulingSettings(unitId, settingsToUpdate, req.orgId);
      
      // Return the updated settings in the same shape as getUnitSchedulingSettings
      const updatedSettings = await storage.getUnitSchedulingSettings(unitId, req.orgId);
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("[Unit Scheduling] Error updating settings:", error);
      res.status(500).json({ message: "Failed to update unit scheduling settings" });
    }
  });

  // Delete unit scheduling settings (clear custom settings, revert to property defaults)
  // If unit is linked to a listing, disable instead of delete and show confirmation
  app.delete("/api/units/:unitId/scheduling", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { unitId } = req.params;
      const { deactivateListing } = req.query; // Query param to confirm listing deactivation
      
      // Verify unit belongs to org
      const unit = await storage.getPropertyUnit(unitId, req.orgId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }

      // Check if unit is linked to a listing
      if (unit.createdFromListingId) {
        const listing = await storage.getListing(unit.createdFromListingId, req.orgId);
        
        if (listing) {
          // If user hasn't confirmed listing deactivation, return confirmation required
          if (deactivateListing !== 'true') {
            return res.status(200).json({
              requiresListingDeactivationConfirmation: true,
              listingId: listing.id,
              listingStatus: listing.status,
              message: "This booking type is linked to a listing. Disabling it will also deactivate the listing. Would you like to proceed?",
            });
          }
          
          // User confirmed - disable booking and deactivate listing
          await storage.updateUnitSchedulingSettings(unitId, { bookingEnabled: false }, req.orgId);
          await storage.updateListing(unit.createdFromListingId, { status: 'inactive' }, req.orgId);
          
          console.log(`[Unit Scheduling] Disabled booking and deactivated listing ${unit.createdFromListingId} for unit ${unitId}`);
          
          return res.status(200).json({
            message: "Booking type disabled and listing deactivated",
            disabled: true,
          });
        }
      }

      // Not linked to listing - proceed with normal deletion
      const deleted = await storage.deleteUnitSchedulingSettings(unitId, req.orgId);
      if (!deleted) {
        return res.status(404).json({ message: "Unit scheduling settings not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("[Unit Scheduling] Error deleting settings:", error);
      res.status(500).json({ message: "Failed to delete unit scheduling settings" });
    }
  });

  // Apply property settings to all linked units (or specific units)
  app.post("/api/properties/:propertyId/apply-settings-to-units", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      
      // Verify property belongs to org
      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Validate request body
      const applySchema = z.object({
        eventName: z.string().optional(),
        bookingMode: z.enum(["one_to_one", "group"]).optional(),
        eventDuration: z.number().optional(),
        bufferTime: z.number().optional(),
        leadTime: z.number().optional(),
        eventDescription: z.string().optional(),
        assignedMembers: z.array(assignedMemberSchema).optional(),
        reminderSettings: z.any().optional(),
        enableBooking: z.boolean().optional(), // Optional: enable booking during creation flow
        unitIds: z.array(z.string()).optional(), // Optional: specific units to apply to
      });

      const validated = applySchema.parse(req.body);
      
      // Filter out undefined/null fields - only include fields that are actually being applied
      // This is critical: we only want to clear unit-level custom fields for settings that are explicitly being applied
      const settingsToApply: any = {};
      
      // Only include fields that are present in the request body AND have non-undefined values
      // Check both that the key exists in the original request AND has a value
      if ('eventName' in req.body && validated.eventName !== undefined) {
        settingsToApply.eventName = validated.eventName;
      }
      if ('bookingMode' in req.body && validated.bookingMode !== undefined) {
        settingsToApply.bookingMode = validated.bookingMode;
      }
      if ('eventDuration' in req.body && validated.eventDuration !== undefined) {
        settingsToApply.eventDuration = validated.eventDuration;
      }
      if ('bufferTime' in req.body && validated.bufferTime !== undefined) {
        settingsToApply.bufferTime = validated.bufferTime;
      }
      if ('leadTime' in req.body && validated.leadTime !== undefined) {
        settingsToApply.leadTime = validated.leadTime;
      }
      if ('eventDescription' in req.body && validated.eventDescription !== undefined) {
        settingsToApply.eventDescription = validated.eventDescription;
      }
      if ('assignedMembers' in req.body && validated.assignedMembers !== undefined) {
        settingsToApply.assignedMembers = validated.assignedMembers;
      }
      if ('reminderSettings' in req.body && validated.reminderSettings !== undefined) {
        settingsToApply.reminderSettings = validated.reminderSettings;
      }
      if ('enableBooking' in req.body && validated.enableBooking !== undefined) {
        settingsToApply.enableBooking = validated.enableBooking;
      }
      // Also handle bookingEnabled (for consistency, both names work)
      if ('bookingEnabled' in req.body && req.body.bookingEnabled !== undefined) {
        settingsToApply.enableBooking = req.body.bookingEnabled;
      }
      
      // Debug logging
      console.log('[Apply Settings] Request body keys:', Object.keys(req.body));
      console.log('[Apply Settings] Settings to apply keys:', Object.keys(settingsToApply));
      
      const updatedCount = await storage.applyPropertySettingsToUnits(
        propertyId, 
        settingsToApply, 
        req.orgId,
        validated.unitIds // Pass unitIds to storage method
      );
      
      res.json({ 
        message: `Applied settings to ${updatedCount} unit(s)`,
        updatedCount 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("[Property Settings] Error applying to units:", error);
      res.status(500).json({ message: "Failed to apply settings to units" });
    }
  });

  // Toggle property booking enabled/disabled
  app.patch("/api/properties/:propertyId/booking-toggle", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      
      console.log(`[Property Booking Toggle API] ===== Toggle request received =====`);
      console.log(`[Property Booking Toggle API] Property ID: ${propertyId}`);
      console.log(`[Property Booking Toggle API] Org ID: ${req.orgId}`);
      console.log(`[Property Booking Toggle API] Request body:`, req.body);
      
      // Verify property belongs to org
      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        console.error(`[Property Booking Toggle API] ❌ Property not found: ${propertyId}`);
        return res.status(404).json({ message: "Property not found" });
      }

      // Validate request body
      const toggleSchema = z.object({
        bookingEnabled: z.boolean(),
      });

      const { bookingEnabled } = toggleSchema.parse(req.body);
      console.log(`[Property Booking Toggle API] Setting bookingEnabled to: ${bookingEnabled}`);
      
      const updated = await storage.togglePropertyBooking(propertyId, bookingEnabled, req.orgId);
      
      if (!updated) {
        console.log(`[Property Booking Toggle API] No existing settings found, creating new settings...`);
        // Create settings if they don't exist
        const settings = await storage.createPropertySchedulingSettings({
          propertyId,
          orgId: req.orgId,
          bookingEnabled: bookingEnabled,
          eventDuration: 30,
          bufferTime: 15,
          leadTime: 120,
          assignedMembers: [],
        });
        console.log(`[Property Booking Toggle API] ✅ Created new settings with bookingEnabled=${bookingEnabled}`);
        return res.json(settings);
      }

      console.log(`[Property Booking Toggle API] ✅ Successfully toggled property booking to ${bookingEnabled}`);
      console.log(`[Property Booking Toggle API] ===== Toggle request complete =====`);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(`[Property Booking Toggle API] ❌ Validation error:`, error.errors);
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("[Property Booking Toggle API] ❌ Error:", error);
      res.status(500).json({ message: "Failed to toggle property booking" });
    }
  });

  // Get property with booking-enabled units (public endpoint for property booking page)
  app.get("/api/properties/:propertyId/public-booking", async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      
      const propertyWithUnits = await storage.getPropertyWithBookingEnabledUnits(propertyId);
      
      if (!propertyWithUnits) {
        return res.status(404).json({ message: "Property not found" });
      }

      res.json(propertyWithUnits);
    } catch (error) {
      console.error("[Property Public Booking] Error:", error);
      res.status(500).json({ message: "Failed to fetch property booking information" });
    }
  });

  // ===== PUBLIC BOOKING ROUTES =====
  // Simple in-memory rate limiting for public endpoints (per IP)
  const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per IP

  function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = rateLimitStore.get(ip);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return true;
    }

    if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }

    record.count++;
    return true;
  }

  // Get unit details and available time slots (public - no auth required)
  app.get("/api/public/units/:unitId/available-times", async (req, res) => {
    try {
      // Rate limiting
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ 
          message: "Too many requests. Please try again later." 
        });
      }

      const { unitId } = req.params;
      
      // Removed verbose logging
      
      // Validate unit exists and get details with property (unit owns the orgId through property)
      const unitWithProperty = await storage.getPropertyUnitPublic(unitId);
      
      if (!unitWithProperty) {
        // Removed verbose logging
        return res.status(404).json({ message: "Unit not found or property is missing" });
      }
      
      // Only check bookingEnabled - isListed is not required if booking is enabled
      if (!unitWithProperty.bookingEnabled) {
        // Removed verbose logging
        return res.status(404).json({ message: "Booking is disabled for this unit" });
      }

      const { property, ...unit } = unitWithProperty;
      
      // SECURITY NOTE: This endpoint is INTENTIONALLY PUBLIC to allow anyone to book units with booking enabled
      // This is similar to public marketplace listings (Airbnb, Zillow, etc.)
      // Security boundaries:
      //   ✅ Only units with booking enabled (bookingEnabled=true) are accessible
      //   ✅ Only safe public data is exposed (no internal org details)
      //   ✅ Showings are scoped to property.orgId for tenant isolation
      //   ✅ Rate limiting prevents abuse
      //   ❌ Booking-disabled units are blocked (404 response)
      //   ❌ Internal org data is never exposed

      // Get property scheduling settings
      const propertySettings = await storage.getPropertySchedulingSettings(property.id, property.orgId);
      
      // Get unit scheduling settings to check for custom assigned members
      const unitSettings = await storage.getUnitSchedulingSettings(unit.id, property.orgId);
      
      // Check property-level booking toggle
      if (propertySettings && !propertySettings.bookingEnabled) {
        return res.status(404).json({ message: "Booking is currently disabled for this property" });
      }
      
      // Get organization name (safe for public display as this is a marketplace model)
      const org = await storage.getOrganization(property.orgId);
      const organizationName = org?.name || "Property Management";
      
      // Helper to parse assignedMembers (handle JSONB string or already parsed)
      const parseAssignedMembers = (members: any): any[] => {
        if (!members) {
          return [];
        }
        if (Array.isArray(members)) {
          return members;
        }
        if (typeof members === 'string') {
          try {
            const parsed = JSON.parse(members);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            return [];
          }
        }
        return [];
      };
      
      // Determine which assigned members to use (unit-level custom or property-level)
      const unitAssignedMembers = parseAssignedMembers(unitSettings?.customAssignedMembers);
      const propertyAssignedMembers = parseAssignedMembers(propertySettings?.assignedMembers);
      
      const effectiveAssignedMembers = (unitAssignedMembers.length > 0)
        ? unitAssignedMembers
        : propertyAssignedMembers;
      
      console.log("[Public Unit Booking] ========== ASSIGNED MEMBERS DEBUG ==========");
      console.log("[Public Unit Booking] Unit settings exists:", !!unitSettings);
      console.log("[Public Unit Booking] Property settings exists:", !!propertySettings);
      console.log("[Public Unit Booking] Unit customAssignedMembers (raw):", JSON.stringify(unitSettings?.customAssignedMembers));
      console.log("[Public Unit Booking] Unit customAssignedMembers (parsed):", JSON.stringify(unitAssignedMembers), "length:", unitAssignedMembers.length);
      console.log("[Public Unit Booking] Property assignedMembers (raw):", JSON.stringify(propertySettings?.assignedMembers));
      console.log("[Public Unit Booking] Property assignedMembers (parsed):", JSON.stringify(propertyAssignedMembers), "length:", propertyAssignedMembers.length);
      console.log("[Public Unit Booking] Effective assigned members:", JSON.stringify(effectiveAssignedMembers), "count:", effectiveAssignedMembers.length);
      console.log("[Public Unit Booking] ============================================");
      
      // Determine which settings to use (unit-level custom or property-level)
      // Check explicitly for null/undefined to handle 0 values correctly
      const effectiveEventDuration = (unitSettings?.customEventDuration !== null && unitSettings?.customEventDuration !== undefined)
        ? unitSettings.customEventDuration
        : (propertySettings?.eventDuration !== null && propertySettings?.eventDuration !== undefined)
        ? propertySettings.eventDuration
        : 30;
      // Calculate effective buffer time: unit-level custom or property-level, default to 15
      // 0 is a valid value (no buffer), so we check for undefined/null explicitly
      const effectiveBufferTime = (unitSettings?.customBufferTime !== undefined && unitSettings?.customBufferTime !== null)
        ? Number(unitSettings.customBufferTime)
        : ((propertySettings?.bufferTime !== undefined && propertySettings?.bufferTime !== null)
          ? Number(propertySettings.bufferTime)
          : 15); // Default from schema
      console.log(`[Public Unit Booking] Buffer time calculation: unit.customBufferTime=${unitSettings?.customBufferTime}, property.bufferTime=${propertySettings?.bufferTime}, effective=${effectiveBufferTime}`);
      const effectiveLeadTime = unitSettings?.customLeadTime ?? propertySettings?.leadTime ?? 120;
      const effectiveBookingMode = unitSettings?.customBookingMode ?? propertySettings?.bookingMode ?? "one_to_one";
      
      // Determine event name - prefer unit-level custom event name, then property-level
      let eventName = unit.customEventName || propertySettings?.eventName || null;
      
      // Prepare event description with variable replacement
      // Use custom description if set, otherwise use property-level description
      let eventDescription = unit.customEventDescription || propertySettings?.eventDescription || "";
      
      // Helper function to replace variables in text
      const replaceVariables = (text: string | null): string => {
        if (!text || !unit || !property) return text || '';
        
        // Format property amenities as comma-separated list
        const propertyAmenitiesStr = property.amenities && property.amenities.length > 0
          ? property.amenities.join(', ')
          : '';
        
        // Format property address
        const propertyAddressParts = [
          property.address,
          property.city,
          property.state,
          property.zipCode
        ].filter(Boolean);
        const propertyAddressStr = propertyAddressParts.join(', ');
        
        // Format unit rent with currency
        const unitRentStr = unit.monthlyRent 
          ? `$${parseFloat(unit.monthlyRent).toLocaleString()}/mo`
          : '';
        
        // Format security deposit with currency
        const securityDepositStr = unit.deposit
          ? `$${parseFloat(unit.deposit).toLocaleString()}`
          : '';
        
        // Define safe replacement mapping with all available variables
        const variables: Record<string, string> = {
          '{unit_number}': unit.unitNumber || '',
          '{bedrooms}': unit.bedrooms?.toString() || '',
          '{bathrooms}': unit.bathrooms || '',
          '{unit_rent}': unitRentStr,
          '{security_deposit}': securityDepositStr,
          '{property_amenities}': propertyAmenitiesStr,
          '{property_address}': propertyAddressStr,
          '{property_name}': property.name || ''
        };
        
        // Replace each variable
        let result = text;
        for (const [placeholder, value] of Object.entries(variables)) {
          // Escape regex special characters in placeholder for safe replacement
          const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          result = result.replace(new RegExp(escapedPlaceholder, 'g'), value);
        }
        
        return result;
      };
      
      // Replace variables in both event name and event description
      if (eventName) {
        eventName = replaceVariables(eventName);
      }
      if (eventDescription) {
        eventDescription = replaceVariables(eventDescription);
      }
      
      // Try to get AI-optimized time slots for next 7 days
      let timeSlots: any[] = [];
      let schedulePrefs: any[] = []; // Declare outside try block so it's accessible in summary
      try {
        const { suggestTimeSlots } = await import("./ai-scheduling");
        
        // Get all showings for next 90 days (3 months for advance booking)
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const allShowings = await storage.getShowingsByDateRange(startDate, endDate, property.orgId);
        
        // Get schedule preferences for effective assigned members (unit-level custom or property-level)
        if (effectiveAssignedMembers && Array.isArray(effectiveAssignedMembers) && effectiveAssignedMembers.length > 0) {
          // Extract user IDs from assigned members (handle both string[] and AssignedMember[] formats)
          const userIds = effectiveAssignedMembers.map((m: any) => {
            if (typeof m === 'string') {
              return m;
            } else if (m && typeof m === 'object' && m.userId) {
              return m.userId;
            } else {
              console.warn("[Public Unit Booking] Unexpected assigned member format:", m);
              return null;
            }
          }).filter((id): id is string => id !== null);
          
          console.log("[Public Unit Booking] Extracted user IDs:", userIds);
          
          if (userIds.length === 0) {
            console.warn("[Public Unit Booking] No valid user IDs extracted from assigned members");
          } else {
            // CRITICAL: Get preferences at the correct level
            // If unit has custom assigned members, fetch unit-level preferences
            // Otherwise, fetch property-level preferences (for inheritance)
            const hasCustomAssignedMembers = unitAssignedMembers.length > 0;
            const preferenceLevel = hasCustomAssignedMembers ? unit.id : undefined; // Pass unitId for unit-level, undefined for property-level
            
            console.log("[Public Unit Booking] Fetching preferences:", {
              userIds,
              propertyId: property.id,
              unitId: preferenceLevel || 'null (property-level)',
              level: hasCustomAssignedMembers ? 'unit-level' : 'property-level'
            });
            
          schedulePrefs = await storage.getSchedulePreferencesForUsers(
              userIds, 
              property.id,
              preferenceLevel // Pass unitId if unit has custom assigned members
            );
            
            console.log("[Public Unit Booking] Preferences found (property-specific + user-level):", schedulePrefs.length);
            if (schedulePrefs.length > 0) {
              console.log("[Public Unit Booking] Sample preference:", {
                userId: schedulePrefs[0].userId,
                dayOfWeek: schedulePrefs[0].dayOfWeek,
                startTime: schedulePrefs[0].startTime,
                endTime: schedulePrefs[0].endTime,
                propertyId: schedulePrefs[0].propertyId,
                isActive: schedulePrefs[0].isActive
              });
            } else {
              console.warn("[Public Unit Booking] No schedule preferences found for user IDs:", userIds);
            }
          }
        } else {
          console.log("[Public Unit Booking] No assigned members found for unit. effectiveAssignedMembers:", effectiveAssignedMembers);
        }
        
        // Get all properties for route optimization
        const allPropertiesArray = await storage.getAllProperties(property.orgId);
        const allPropertiesMap = new Map(allPropertiesArray.map(p => [p.id, p]));
        
        // Create effective settings object using unit-level or property-level values
        const effectiveSettings = {
          ...propertySettings,
          eventDuration: effectiveEventDuration,
          bufferTime: effectiveBufferTime,
          leadTime: effectiveLeadTime,
          bookingMode: effectiveBookingMode,
          assignedMembers: effectiveAssignedMembers,
        };
        
        // Log summary of preferences found
        if (schedulePrefs.length > 0) {
          const daysOfWeek = [...new Set(schedulePrefs.map(p => p.dayOfWeek))];
          console.log("[Public Unit Booking] Schedule preferences summary:", {
            totalPreferences: schedulePrefs.length,
            daysOfWeek: daysOfWeek,
            users: [...new Set(schedulePrefs.map(p => p.userId))],
            samplePreference: {
              userId: schedulePrefs[0].userId,
              dayOfWeek: schedulePrefs[0].dayOfWeek,
              startTime: schedulePrefs[0].startTime,
              endTime: schedulePrefs[0].endTime,
              isActive: schedulePrefs[0].isActive,
              propertyId: schedulePrefs[0].propertyId
            }
          });
        } else {
          console.warn("[Public Unit Booking] ⚠️ NO SCHEDULE PREFERENCES FOUND! This is why no time slots are generated.");
          console.warn("[Public Unit Booking] Debug info:", {
            effectiveAssignedMembersCount: effectiveAssignedMembers.length,
            effectiveAssignedMembers: effectiveAssignedMembers,
            propertyId: property.id,
            orgId: property.orgId
          });
        }
        
        // Get suggestions for next 90 days (3 months) - show recurring weekly availability
        const allSuggestions: any[] = [];
        if (schedulePrefs.length > 0) {
        // Use property timezone to determine "today" and generate dates correctly
        // This ensures slots are generated for the correct local dates
        const propertyTimezone = property.timezone || 'America/Chicago';
        const { DateTime } = await import('luxon');
        const nowInPropertyTz = DateTime.now().setZone(propertyTimezone);
        const todayInPropertyTz = nowInPropertyTz.toFormat('yyyy-MM-dd');
        
        console.log(`[Public Unit Booking] Property timezone: ${propertyTimezone}, Today in property TZ: ${todayInPropertyTz}`);
        
        for (let daysAhead = 0; daysAhead < 90; daysAhead++) {
          // Calculate target date in property's timezone
          const targetDateTime = nowInPropertyTz.plus({ days: daysAhead });
          const dateStr = targetDateTime.toFormat('yyyy-MM-dd');
          
          // Log if processing today (in property's timezone)
          // CRITICAL: Pass unitId for unit-level conflict checking
          // This ensures slots are blocked when there are existing showings for this specific unit
          const daySuggestions = suggestTimeSlots(
            dateStr,
            property,
            allShowings,
            schedulePrefs,
            allPropertiesMap,
            effectiveSettings,
            unit.id // Pass unitId for unit-level conflict checking
          );
          
          allSuggestions.push(...daySuggestions);
        }
        
          // Sort by score and format, then deduplicate by date+time
          const formattedSlots = allSuggestions
          .sort((a, b) => b.score - a.score)
          .map(s => ({
            date: s.date,
            time: s.time,
            score: s.score,
            reason: s.reason,
          }));
          
          // Deduplicate time slots - if multiple members have the same date+time, only show once
          const slotMap = new Map<string, typeof formattedSlots[0]>();
          formattedSlots.forEach(slot => {
            const key = `${slot.date}_${slot.time}`;
            // Keep the slot with the highest score if duplicates exist
            if (!slotMap.has(key) || slotMap.get(key)!.score < slot.score) {
              slotMap.set(key, slot);
            }
          });
          
          timeSlots = Array.from(slotMap.values()).sort((a, b) => {
            // Sort by date first, then by time
            if (a.date !== b.date) {
              return a.date.localeCompare(b.date);
            }
            return a.time.localeCompare(b.time);
          });
          
          if (timeSlots.length === 0) {
            console.warn("[Public Unit Booking] ⚠️ No time slots generated despite having", schedulePrefs.length, "preferences");
          }
        } else {
          console.warn("[Public Unit Booking] ⚠️ Skipping time slot generation - no schedule preferences available");
          timeSlots = [];
        }
      } catch (aiError) {
        console.error("[Public Unit Booking] AI scheduling failed:", aiError);
        // Continue without AI-optimized slots
      }

      if (timeSlots.length === 0) {
        console.error("[Public Booking] ❌ ERROR: No time slots generated for unit", unit.id);
        console.error("[Public Booking] Root cause analysis:");
        if (effectiveAssignedMembers.length === 0) {
          console.error("  → No assigned members found (neither unit-level nor property-level)");
          console.error("  → Unit customAssignedMembers:", unitSettings?.customAssignedMembers);
          console.error("  → Property assignedMembers:", propertySettings?.assignedMembers);
        } else if ((schedulePrefs?.length || 0) === 0) {
          console.error("  → Assigned members found but NO schedule preferences exist for them");
          console.error("  → User IDs queried:", effectiveAssignedMembers.map((m: any) => typeof m === 'string' ? m : m.userId));
        } else {
          console.error("  → Schedule preferences exist but suggestTimeSlots returned empty");
          console.error("  → This might be due to lead time, conflicts, or timezone issues");
        }
      }

      res.json({
        unit: {
          id: unit.id,
          unitNumber: unit.unitNumber,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          squareFeet: unit.squareFeet,
          monthlyRent: unit.monthlyRent,
          description: unit.description,
          amenities: unit.amenities,
          coverPhoto: unit.coverPhoto || null // Explicitly set to null if undefined
        },
        property: {
          id: property.id,
          name: property.name,
          address: property.address,
          city: property.city,
          state: property.state,
          zipCode: property.zipCode,
          description: property.description,
          propertyType: property.propertyType,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          squareFeet: property.squareFeet,
          yearBuilt: property.yearBuilt,
          amenities: property.amenities,
          petPolicy: property.petPolicy,
          images: property.images,
          timezone: property.timezone,
          coverPhoto: property.coverPhoto || null
        },
        organization: {
          name: organizationName,
          logo: org?.logo || null,
          profileImage: org?.profileImage || null,
          email: org?.email || null,
          phone: org?.phone || null,
          address: org?.address || null,
        },
        eventDuration: effectiveEventDuration,
        eventDescription,
        eventName: eventName || null,
        timeSlots
      });
    } catch (error: any) {
      console.error("[Public Unit Booking] Error fetching available times:", error);
      res.status(500).json({ 
        message: "Failed to fetch available times",
        error: error.message 
      });
    }
  });

  // Get property details and available time slots (public - no auth required)
  app.get("/api/public/properties/:propertyId/available-times", async (req, res) => {
    try {
      // Rate limiting
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ 
          message: "Too many requests. Please try again later." 
        });
      }

      const { propertyId } = req.params;
      
      // Validate property exists and get details (property owns the orgId)
      const property = await storage.getPropertyPublic(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found or not available for booking" });
      }

      // SECURITY NOTE: This endpoint is intentionally public to allow lead self-booking
      // All showings are correctly scoped to property.orgId (tenant isolation maintained)
      // Only safe property fields (id, name, address, units) are exposed to public

      // Get organization name (safe for public display as this is a marketplace model)
      const org = await storage.getOrganization(property.orgId);

      // Get property scheduling settings (needed for both time slots and booking checks)
      const propertySettings = await storage.getPropertySchedulingSettings(propertyId, property.orgId);

      // Try to get AI-optimized time slots for next 7 days
      let timeSlots: any[] = [];
      try {
        const { suggestTimeSlots } = await import("./ai-scheduling");
        
        // Get all showings for next 90 days (3 months for advance booking)
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const allShowings = await storage.getShowingsByDateRange(startDate, endDate, property.orgId);
        
        // Get schedule preferences for assigned members on this property
        let schedulePrefs: any[] = [];
        if (propertySettings?.assignedMembers && Array.isArray(propertySettings.assignedMembers) && propertySettings.assignedMembers.length > 0) {
          schedulePrefs = await storage.getSchedulePreferencesForUsers(
            propertySettings.assignedMembers as string[], 
            propertyId
          );
        }
        
        // Get all properties for route optimization
        const allPropertiesArray = await storage.getAllProperties(property.orgId);
        const allPropertiesMap = new Map(allPropertiesArray.map(p => [p.id, p]));
        
        // Get suggestions for next 90 days (3 months) - show recurring weekly availability
        const allSuggestions: any[] = [];
        
        // Use property timezone to determine "today" and generate dates correctly
        const propertyTimezone = property.timezone || 'America/Chicago';
        const { DateTime } = await import('luxon');
        const nowInPropertyTz = DateTime.now().setZone(propertyTimezone);
        const todayInPropertyTz = nowInPropertyTz.toFormat('yyyy-MM-dd');
        
        console.log(`[Public Property Booking] Property timezone: ${propertyTimezone}, Today in property TZ: ${todayInPropertyTz}`);
        
        for (let daysAhead = 0; daysAhead < 90; daysAhead++) {
          // Calculate target date in property's timezone
          const targetDateTime = nowInPropertyTz.plus({ days: daysAhead });
          const dateStr = targetDateTime.toFormat('yyyy-MM-dd');
          
          const daySuggestions = suggestTimeSlots(
            dateStr,
            property,
            allShowings,
            schedulePrefs,
            allPropertiesMap,
            propertySettings
          );
          allSuggestions.push(...daySuggestions);
        }
        
        // Sort by score and format
        timeSlots = allSuggestions
          .sort((a, b) => b.score - a.score)
          .map(s => ({
            date: s.date,
            time: s.time,
            score: s.score,
            reason: s.reason,
          }));
      } catch (schedulingError: any) {
        console.error("[Public Booking] AI scheduling failed, returning property without time slots:", schedulingError.message);
        // Continue without time slots - leads can still submit booking requests
      }

      // Get available units for this property (only units with booking enabled and listed)
      const propertyWithUnits = await storage.getPropertyWithBookingEnabledUnits(propertyId);
      
      // Check if property booking is disabled at property level
      const isPropertyBookingDisabled = propertySettings && propertySettings.bookingEnabled === false;
      
      // If property booking is disabled, return error
      if (isPropertyBookingDisabled) {
        return res.status(404).json({ message: "Booking is currently disabled for this property" });
      }
      
      // If no units available, return error
      if (!propertyWithUnits || propertyWithUnits.units.length === 0) {
        return res.status(404).json({ message: "No units available for booking at this property" });
      }
      
      // Return ONLY safe property info with available units (no orgId or sensitive data)
      res.json({
        property: {
          id: property.id,
          name: property.name,
          address: property.address,
          units: property.units,
          timezone: property.timezone,
          coverPhoto: property.coverPhoto || null,
          description: property.description || null,
          amenities: property.amenities || null,
        },
        units: propertyWithUnits.units.map(unit => ({
          id: unit.id,
          unitNumber: unit.unitNumber,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          squareFeet: unit.squareFeet,
          monthlyRent: unit.monthlyRent,
          description: unit.description,
          amenities: unit.amenities,
          coverPhoto: unit.coverPhoto || null,
        })),
        organization: {
          name: org?.name || "Property Management",
          logo: org?.logo || null,
          profileImage: org?.profileImage || null,
          email: org?.email || null,
          phone: org?.phone || null,
          address: org?.address || null,
        },
        eventDuration: propertySettings?.eventDuration || 30,
        eventDescription: propertySettings?.eventDescription || "",
        timeSlots,
      });
    } catch (error: any) {
      console.error("[Public Booking] Error fetching available times:", error);
      res.status(500).json({ message: "Failed to fetch available times" });
    }
  });

  // Zod schema for public booking requests
  const publicBookingSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(10, "Valid phone number is required"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be valid HH:MM (00:00-23:59)"),
  });

  // Book a showing for a specific unit (public - no auth required)
  app.post("/api/public/units/:unitId/book", async (req, res) => {
    // CRITICAL: Log immediately when route handler is called
    console.error("🔴🔴🔴 [ROUTE HANDLER] BOOKING ENDPOINT CALLED! 🔴🔴🔴");
    console.error("🔴 [ROUTE HANDLER] Method:", req.method);
    console.error("🔴 [ROUTE HANDLER] Path:", req.path);
    console.error("🔴 [ROUTE HANDLER] URL:", req.url);
    console.error("🔴 [ROUTE HANDLER] Params:", JSON.stringify(req.params));
    console.error("🔴 [ROUTE HANDLER] Body:", JSON.stringify(req.body));
    
    console.log("========================================");
    console.log("[Public Unit Booking] ===== BOOKING REQUEST RECEIVED =====");
    console.log("[Public Unit Booking] Request method:", req.method);
    console.log("[Public Unit Booking] Request URL:", req.url);
    console.log("[Public Unit Booking] Request body:", JSON.stringify(req.body, null, 2));
    console.log("[Public Unit Booking] Request params:", req.params);
    console.log("========================================");
    try {
      // Rate limiting
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ 
          message: "Too many requests. Please try again later." 
        });
      }

      const { unitId } = req.params;
      console.log("[Public Unit Booking] Unit ID from params:", unitId);
      
      // Validate request body with Zod
      const validationResult = publicBookingSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid booking data",
          errors: validationResult.error.errors 
        });
      }

      const { name, email, phone, date, time } = validationResult.data;

      // Validate unit exists and booking is enabled (unit owns the orgId through property)
      const unitWithProperty = await storage.getPropertyUnitPublic(unitId);
      if (!unitWithProperty) {
        console.log("[Public Unit Booking] Unit not found:", unitId);
        return res.status(404).json({ message: "Unit not found or not available for booking" });
      }

      // Only check bookingEnabled - isListed is not required if booking is enabled
      if (!unitWithProperty.bookingEnabled) {
        console.log("[Public Unit Booking] Unit booking disabled:", unitId);
        return res.status(404).json({ message: "Unit not found or not available for booking" });
      }

      console.log("[Public Unit Booking] Unit found and booking enabled:", unitId, "property:", unitWithProperty.property.name);
      const { property, ...unit } = unitWithProperty;

      // SECURITY: This is a PUBLIC booking endpoint (intentional cross-tenant access)
      // Similar to public marketplaces - anyone can book any LISTED unit
      // Security measures:
      //   ✅ Only units with booking enabled (bookingEnabled=true) can be booked
      //   ✅ All showings are created with property.orgId (tenant isolation maintained)
      //   ✅ Leads are scoped to the property's organization
      //   ✅ Rate limiting prevents abuse
      // This prevents cross-org showing confusion while allowing public booking

      // Create or find lead first
      let lead = await storage.getLeadByEmail(email, property.orgId);
      if (!lead) {
        lead = await storage.createLead({
          name,
          email,
          phone,
          propertyId: property.id,
          propertyName: `${property.name} - Unit ${unit.unitNumber}`,
          status: "new",
          source: "website",
          orgId: property.orgId,
        });
      }

      // ===== PRE-QUALIFICATION GUARD =====
      // Check if pre-qualification is required for this unit
      const org = await storage.getOrganization(property.orgId!);
      const propertySettingsForQualify = await storage.getPropertySchedulingSettings(property.id, property.orgId!);
      const listing = await storage.getListingByUnitPublic(unitId);
      
      // Determine if pre-qualification is required (4-level inheritance)
      let preQualifyRequired = org?.preQualifyEnabled ?? false;
      
      // Level 2: Property portfolio override
      if (property.preQualifyEnabled !== null) {
        preQualifyRequired = property.preQualifyEnabled;
      }
      
      // Level 3: Property scheduling settings override
      if (propertySettingsForQualify?.preQualifyEnabled !== null && propertySettingsForQualify?.preQualifyEnabled !== undefined) {
        preQualifyRequired = propertySettingsForQualify.preQualifyEnabled;
      }
      
      // Level 4: Listing override (if exists)
      if (listing?.preQualifyEnabled !== null && listing?.preQualifyEnabled !== undefined) {
        preQualifyRequired = listing.preQualifyEnabled;
      }

      // Level 5: Unit override
      if (unit.preQualifyEnabled !== null && unit.preQualifyEnabled !== undefined) {
        preQualifyRequired = unit.preQualifyEnabled;
      }

      // If pre-qualification is required, check if lead has passed
      if (preQualifyRequired) {
        console.log("[Public Unit Booking] Pre-qualification required for unit:", unitId);
        
        // Check if there's an active qualification template
        const qualTemplate = await storage.getEffectiveQualificationTemplate(unitId, property.orgId!);
        if (qualTemplate && qualTemplate.isActive) {
          // Check if lead has passed qualification
          const qualifications = await storage.getLeadQualifications(lead.id, property.orgId!);
          const relevantQualification = qualifications.find(q => 
            (q.unitId === unitId || q.listingId === listing?.id) && q.passed
          );
          
          if (!relevantQualification) {
            console.log("[Public Unit Booking] Lead has not passed pre-qualification:", email);
            return res.status(403).json({ 
              message: "Pre-qualification required before booking",
              requiresQualification: true,
              qualificationUrl: `/book/${unitId}/qualify`
            });
          }
          
          console.log("[Public Unit Booking] Lead passed pre-qualification:", email, "qualification ID:", relevantQualification.id);
        }
      }
      // ===== END PRE-QUALIFICATION GUARD =====

      // ATOMICALLY re-check conflicts right before creating showing (prevent race condition)
      const { detectConflicts } = await import("./ai-scheduling");
      // Get all showings for the selected date (needed for member-level conflict checking)
      const freshShowings = await storage.getShowingsByDateRange(date, date, property.orgId);
      const schedulePrefs = await storage.getSchedulePreferences();

      // Get unit and property scheduling settings to find assigned members and event duration
      console.log("[Public Unit Booking] Fetching scheduling settings for unit:", unitId, "property:", property.id);
      const unitSettings = await storage.getUnitSchedulingSettings(unitId, property.orgId);
      const propertySettings = await storage.getPropertySchedulingSettings(property.id, property.orgId);
      console.log("[Public Unit Booking] Unit settings found:", unitSettings ? "Yes" : "No");
      console.log("[Public Unit Booking] Property settings found:", propertySettings ? "Yes" : "No");
      console.log("[Public Unit Booking] Unit customEventDuration:", unitSettings?.customEventDuration);
      console.log("[Public Unit Booking] Property eventDuration:", propertySettings?.eventDuration);
      
      // Get effective event duration (unit-level custom or property-level, default to 30)
      // Check explicitly for null/undefined to handle 0 values correctly
      const effectiveEventDuration = (unitSettings?.customEventDuration !== null && unitSettings?.customEventDuration !== undefined)
        ? unitSettings.customEventDuration
        : (propertySettings?.eventDuration !== null && propertySettings?.eventDuration !== undefined)
        ? propertySettings.eventDuration
        : 30;
      console.log("[Public Unit Booking] Effective event duration:", effectiveEventDuration, "minutes");

      // NOTE: We don't check for property-level conflicts here anymore
      // Instead, we let auto-assignment check member-level availability
      // This allows the system to assign to an available member even if another member is booked

      console.error("🟢 [AUTO-ASSIGN] About to start auto-assignment logic");
      console.log("[Public Unit Booking] No conflicts detected, proceeding to auto-assignment...");
      // Auto-assign to highest priority available member
      let assignedToUserId: string | null = null;
      let effectiveAssignedMembers: any[] = []; // Declare outside try block for access in catch
      
      console.error("🟢 [AUTO-ASSIGN] assignedToUserId initialized to null");
      console.error("🟢 [AUTO-ASSIGN] About to enter try block for auto-assignment");
      
      try {
        console.error("🟢 [AUTO-ASSIGN] Inside try block, starting auto-assignment");
        // Helper to parse assignedMembers
        const parseAssignedMembers = (members: any): any[] => {
          if (!members) return [];
          if (Array.isArray(members)) return members;
          if (typeof members === 'string') {
            try {
              return JSON.parse(members);
            } catch {
              return [];
            }
          }
          return [];
        };
        
        console.log(`[Auto-Assign Unit] ===== STARTING AUTO-ASSIGNMENT =====`);
        console.log(`[Auto-Assign Unit] Unit ID: ${unitId}, Date: ${date}, Time: ${time}`);
        console.log(`[Auto-Assign Unit] Unit settings exists:`, !!unitSettings);
        console.log(`[Auto-Assign Unit] Property settings exists:`, !!propertySettings);
        
        // Log raw values before parsing
        const rawUnitAssignedMembers = unitSettings?.customAssignedMembers;
        const rawPropertyAssignedMembers = propertySettings?.assignedMembers;
        console.log(`[Auto-Assign Unit] Raw unit customAssignedMembers:`, rawUnitAssignedMembers);
        console.log(`[Auto-Assign Unit] Raw unit customAssignedMembers type:`, typeof rawUnitAssignedMembers);
        console.log(`[Auto-Assign Unit] Raw property assignedMembers:`, rawPropertyAssignedMembers);
        console.log(`[Auto-Assign Unit] Raw property assignedMembers type:`, typeof rawPropertyAssignedMembers);
        
        const unitAssignedMembers = parseAssignedMembers(rawUnitAssignedMembers);
        const propertyAssignedMembers = parseAssignedMembers(rawPropertyAssignedMembers);
        effectiveAssignedMembers = (unitAssignedMembers.length > 0)
          ? unitAssignedMembers
          : propertyAssignedMembers;
        
        console.log(`[Auto-Assign Unit] Unit assigned members (parsed):`, JSON.stringify(unitAssignedMembers, null, 2));
        console.log(`[Auto-Assign Unit] Property assigned members (parsed):`, JSON.stringify(propertyAssignedMembers, null, 2));
        console.log(`[Auto-Assign Unit] Effective assigned members:`, JSON.stringify(effectiveAssignedMembers, null, 2));
        console.log(`[Auto-Assign Unit] Effective assigned members count: ${effectiveAssignedMembers.length}`);
      
      if (effectiveAssignedMembers.length > 0) {
        // Sort by priority (1 = highest priority)
        const sortedMembers = [...effectiveAssignedMembers].sort((a, b) => {
          const priorityA = typeof a === 'object' && a.priority ? a.priority : 999;
          const priorityB = typeof b === 'object' && b.priority ? b.priority : 999;
          return priorityA - priorityB;
        });
        
        console.log(`[Auto-Assign Unit] Sorted members by priority:`, JSON.stringify(sortedMembers.map((m: any) => ({
          userId: typeof m === 'string' ? m : m.userId,
          priority: typeof m === 'object' && m.priority ? m.priority : 999
        }))));
        
        // Get schedule preferences for all assigned members
        const userIds = sortedMembers.map((m: any) => typeof m === 'string' ? m : m.userId);
        const memberSchedulePrefs = await storage.getSchedulePreferencesForUsers(userIds, property.id);
        
        console.log(`[Auto-Assign Unit] Found ${memberSchedulePrefs.length} schedule preferences for ${userIds.length} members`);
        
        // Get day of week for the booking date
        const bookingDate = new Date(date);
        const dayOfWeek = bookingDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        console.log(`[Auto-Assign Unit] Booking day of week: ${dayOfWeek}`);
        
        // Check each member in priority order for availability
        for (const member of sortedMembers) {
          const userId = typeof member === 'string' ? member : member.userId;
          const memberPriority = typeof member === 'object' && member.priority ? member.priority : 999;
          
          console.log(`[Auto-Assign Unit] Checking member ${userId} with priority ${memberPriority}`);
          
          // Check if member has schedule preference for this day
          const dayPreference = memberSchedulePrefs.find(
            pref => pref.userId === userId && 
            pref.dayOfWeek === dayOfWeek && 
            pref.isActive
          );
          
          let isTimeWithinHours = true; // Default to true if no schedule preference
          let skipMember = false;
          
          if (dayPreference) {
            console.log(`[Auto-Assign Unit] Member ${userId} has schedule preference for ${dayOfWeek}: ${dayPreference.startTime}-${dayPreference.endTime}`);
            
            // Check if the booking time is within their available hours
            const [prefStartHour, prefStartMin] = dayPreference.startTime.split(':').map(Number);
            const [prefEndHour, prefEndMin] = dayPreference.endTime.split(':').map(Number);
            const [bookingHour, bookingMin] = time.split(':').map(Number);
            
            const prefStartMinutes = prefStartHour * 60 + prefStartMin;
            const prefEndMinutes = prefEndHour * 60 + prefEndMin;
            const bookingMinutes = bookingHour * 60 + bookingMin;
            const bookingEndMinutes = bookingMinutes + effectiveEventDuration;
            
            isTimeWithinHours = bookingMinutes >= prefStartMinutes && bookingEndMinutes <= prefEndMinutes;
            
            if (!isTimeWithinHours) {
              console.log(`[Auto-Assign Unit] Member ${userId} booking time ${time} is outside their available hours ${dayPreference.startTime}-${dayPreference.endTime}`);
              skipMember = true;
            }
          } else {
            console.log(`[Auto-Assign Unit] Member ${userId} has no schedule preference for ${dayOfWeek}, will assign if no conflicts`);
          }
          
          // Skip if time is outside hours
          if (skipMember) {
            continue;
          }
          
          // Check if member has any existing showings at this time (conflict check)
          const memberShowings = freshShowings.filter(s => s.assignedTo === userId);
          console.log(`[Auto-Assign Unit] Member ${userId} has ${memberShowings.length} existing showings`);
          
          // Use dayPreference if available, otherwise use empty array (just check for conflicts)
          const preferencesForConflictCheck = dayPreference ? [dayPreference] : [];
          
          const memberConflicts = detectConflicts(
        {
          propertyId: property.id,
          scheduledDate: date,
          scheduledTime: time,
              durationMinutes: effectiveEventDuration,
        },
            memberShowings,
            preferencesForConflictCheck,
        property.timezone || 'America/Chicago'
      );

          const hasMemberConflict = memberConflicts.some(c => c.type === 'overlap' && c.severity === 'error');
          
          if (!hasMemberConflict) {
            assignedToUserId = userId;
            console.log(`[Auto-Assign Unit] ✅ ASSIGNED booking to member ${userId} with priority ${memberPriority}`);
            break; // Found available member, stop searching
          } else {
            console.log(`[Auto-Assign Unit] Member ${userId} has a conflict at ${date} ${time}`);
          }
        }
        
        // FALLBACK: If no one was assigned but we have members, try assigning to highest priority member
        // Only if they don't have conflicts (ignore schedule preferences as fallback)
        if (!assignedToUserId && sortedMembers.length > 0) {
          console.log(`[Auto-Assign Unit] Attempting fallback assignment...`);
          for (const fallbackMember of sortedMembers) {
            const fallbackUserId = typeof fallbackMember === 'string' ? fallbackMember : fallbackMember.userId;
            const fallbackPriority = typeof fallbackMember === 'object' && fallbackMember.priority ? fallbackMember.priority : 999;
            
            // Only check for conflicts, ignore schedule preferences
            const fallbackShowings = freshShowings.filter(s => s.assignedTo === fallbackUserId);
            const fallbackConflicts = detectConflicts(
              {
                propertyId: property.id,
                scheduledDate: date,
                scheduledTime: time,
                durationMinutes: effectiveEventDuration,
              },
              fallbackShowings,
              [], // No schedule preferences for fallback
              property.timezone || 'America/Chicago'
            );
            
            const hasFallbackConflict = fallbackConflicts.some(c => c.type === 'overlap' && c.severity === 'error');
            
            if (!hasFallbackConflict) {
              assignedToUserId = fallbackUserId;
              console.log(`[Auto-Assign Unit] ⚠️ FALLBACK ASSIGNMENT: Assigned to highest priority available member ${fallbackUserId} (priority ${fallbackPriority})`);
              console.log(`[Auto-Assign Unit] Reason: No conflicts found (schedule preferences may not match)`);
              break;
            } else {
              console.log(`[Auto-Assign Unit] Fallback member ${fallbackUserId} has conflicts, trying next...`);
            }
          }
        }
        
        if (!assignedToUserId) {
          console.log(`[Auto-Assign Unit] ❌ No available members found for ${date} ${time} after checking all members`);
          console.log(`[Auto-Assign Unit] This could mean:`);
          console.log(`[Auto-Assign Unit] - All members have conflicts at this time`);
          console.log(`[Auto-Assign Unit] - All members are outside their available hours`);
          console.log(`[Auto-Assign Unit] - No members have schedule preferences for ${dayOfWeek}`);
        } else {
          console.log(`[Auto-Assign Unit] ✅ Final assignment: ${assignedToUserId}`);
        }
        
        // If no assigned members are available, reject the booking
        if (!assignedToUserId && effectiveAssignedMembers.length > 0) {
          console.log(`[Public Unit Booking] ❌ Rejecting booking: No assigned members are available at ${date} ${time}`);
        return res.status(409).json({ 
            message: "This time slot is no longer available. All assigned team members are booked at this time. Please select another time." 
          });
        }
      } else {
        console.log(`[Auto-Assign Unit] ⚠️ No assigned members found for this unit/property`);
        console.log(`[Auto-Assign Unit] Unit settings:`, unitSettings ? "exists" : "null");
        console.log(`[Auto-Assign Unit] Property settings:`, propertySettings ? "exists" : "null");
        if (unitSettings) {
          console.log(`[Auto-Assign Unit] Unit customAssignedMembers:`, unitSettings.customAssignedMembers);
        }
        if (propertySettings) {
          console.log(`[Auto-Assign Unit] Property assignedMembers:`, propertySettings.assignedMembers);
        }
      }
      } catch (autoAssignError: any) {
        console.error(`[Auto-Assign Unit] ❌ ERROR during auto-assignment:`, autoAssignError);
        console.error(`[Auto-Assign Unit] Error stack:`, autoAssignError?.stack);
        // If there are assigned members and assignment failed, reject the booking
        // Note: effectiveAssignedMembers is defined in the try block, so we need to check it here
        // We'll do a final check after the catch block instead
        assignedToUserId = null;
      }

      // Final check: If we have assigned members but no assignment was made, reject the booking
      // Get effectiveAssignedMembers again for the final check (in case it was in try block scope)
      const finalEffectiveMembers = effectiveAssignedMembers || [];
      if (!assignedToUserId && finalEffectiveMembers.length > 0) {
        console.log(`[Public Unit Booking] ❌ Rejecting booking: No assignment made despite assigned members existing`);
        return res.status(409).json({ 
          message: "This time slot is no longer available. All assigned team members are booked at this time. Please select another time." 
        });
      }

      // Create showing only after final conflict check passes
      // Database unique constraint provides final protection against race conditions
      console.error("🟢🟢🟢 [AUTO-ASSIGN] ===== FINAL RESULT BEFORE CREATING SHOWING ===== 🟢🟢🟢");
      console.error(`🟢 [AUTO-ASSIGN] assignedToUserId value: ${assignedToUserId || 'null'}`);
      console.error(`🟢 [AUTO-ASSIGN] assignedToUserId type: ${typeof assignedToUserId}`);
      console.log(`[Auto-Assign Unit] ===== FINAL RESULT =====`);
      console.log(`[Auto-Assign Unit] Creating showing with assignedTo: ${assignedToUserId || 'null'}`);
      try {
        // Build location with property address and unit number
        const locationParts = [property.address];
        if (property.city) locationParts.push(property.city);
        if (property.state) locationParts.push(property.state);
        if (property.zipCode) locationParts.push(property.zipCode);
        const fullAddress = locationParts.filter(Boolean).join(", ");
        const locationWithUnit = unit.unitNumber ? `${fullAddress} - Unit ${unit.unitNumber}` : fullAddress;
        
        // Helper function to replace variables in event name/description
        const replaceVariablesForBooking = (text: string | null | undefined): string => {
          if (!text || !unit || !property) return text || '';
          
          // Format property amenities as comma-separated list
          const propertyAmenitiesStr = property.amenities && property.amenities.length > 0
            ? property.amenities.join(', ')
            : '';
          
          // Format property address
          const propertyAddressParts = [
            property.address,
            property.city,
            property.state,
            property.zipCode
          ].filter(Boolean);
          const propertyAddressStr = propertyAddressParts.join(', ');
          
          // Format unit rent with currency
          const unitRentStr = unit.monthlyRent 
            ? `$${parseFloat(unit.monthlyRent).toLocaleString()}/mo`
            : '';
          
          // Format security deposit with currency
          const securityDepositStr = unit.deposit
            ? `$${parseFloat(unit.deposit).toLocaleString()}`
            : '';
          
          // Define safe replacement mapping with all available variables
          const variables: Record<string, string> = {
            '{unit_number}': unit.unitNumber || '',
            '{bedrooms}': unit.bedrooms?.toString() || '',
            '{bathrooms}': unit.bathrooms || '',
            '{unit_rent}': unitRentStr,
            '{security_deposit}': securityDepositStr,
            '{property_amenities}': propertyAmenitiesStr,
            '{property_address}': propertyAddressStr,
            '{property_name}': property.name || ''
          };
          
          // Replace each variable
          let result = text;
          for (const [placeholder, value] of Object.entries(variables)) {
            // Escape regex special characters in placeholder for safe replacement
            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(escapedPlaceholder, 'g'), value);
          }
          
          return result;
        };
        
        // Get event name and description from unit-level or property-level settings
        let eventNameForNewBooking = unitSettings?.customEventName || propertySettings?.eventName || `Showing for ${property.name} - Unit ${unit.unitNumber}`;
        let eventDescriptionForNewBooking = unitSettings?.customEventDescription || propertySettings?.eventDescription || "";
        
        // Replace variables in event name and description
        eventNameForNewBooking = replaceVariablesForBooking(eventNameForNewBooking);
        eventDescriptionForNewBooking = replaceVariablesForBooking(eventDescriptionForNewBooking);
        
        const showingData = {
          propertyId: property.id,
          unitId: unitId,  // Store the unit ID for this showing
          leadId: lead.id,
          scheduledDate: date,
          scheduledTime: time,
          durationMinutes: effectiveEventDuration,
          showingType: "in_person",
          status: "pending",
          title: eventNameForNewBooking, // Use event name from booking event type settings with variables replaced
          location: locationWithUnit, // Include unit number in location
          orgId: property.orgId,
          assignedTo: assignedToUserId, // Auto-assign to highest priority available member
        };
        console.error("🟢 [AUTO-ASSIGN] Showing data being sent to createShowing:", JSON.stringify(showingData, null, 2));
        console.log(`[Auto-Assign Unit] Creating showing with data:`, JSON.stringify(showingData, null, 2));
        const showing = await storage.createShowing(showingData);
        console.error("🟢🟢🟢 [AUTO-ASSIGN] ✅ SHOWING CREATED! 🟢🟢🟢");
        console.error(`🟢 [AUTO-ASSIGN] Showing ID: ${showing.id}`);
        console.error(`🟢 [AUTO-ASSIGN] Showing assignedTo from DB: ${showing.assignedTo || 'null'}`);
        console.error(`🟢 [AUTO-ASSIGN] Showing assignedTo type: ${typeof showing.assignedTo}`);
        console.log(`[Auto-Assign Unit] ✅ Showing created successfully!`);
        console.log(`[Auto-Assign Unit] Showing ID: ${showing.id}`);
        console.log(`[Auto-Assign Unit] Showing assignedTo: ${showing.assignedTo || 'null'}`);
        console.log(`[Auto-Assign Unit] Showing assignedTo type: ${typeof showing.assignedTo}`);

        // Send confirmation emails with calendar invites and create in-app notifications
        const { notifyPublicShowingBooked } = await import("./notifications");
        // Fire notifications asynchronously (don't block response)
        // Pass unit number for inclusion in calendar invites and emails
        notifyPublicShowingBooked(showing, property, lead, storage, unit.unitNumber).catch((err) => {
          console.error("[Public Unit Booking] Failed to send notifications:", err);
        });
        
        // Get assigned member details if assignedTo exists
        let assignedMember = null;
        if (showing.assignedTo) {
          const assignedUser = await storage.getUser(showing.assignedTo);
          if (assignedUser) {
            assignedMember = {
              id: assignedUser.id,
              name: `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() || assignedUser.email,
              email: assignedUser.email,
              phone: assignedUser.phone || null,
            };
          }
        }

        const responseData = {
          message: "Showing booked successfully",
          showing: {
            id: showing.id,
            date: showing.scheduledDate,
            time: showing.scheduledTime,
            property: property.name,
            unit: `Unit ${unit.unitNumber}`,
            assignedTo: showing.assignedTo || null,
            assignedMember: assignedMember,
            eventName: showing.title || null,
          },
        };
        console.log(`[Public Unit Booking] ✅ Booking successful! Response:`, JSON.stringify(responseData, null, 2));
        res.status(201).json(responseData);
      } catch (dbError: any) {
        // Handle unique constraint violation (concurrent booking race condition)
        if (dbError.code === '23505' || dbError.message?.includes('unique')) {
          return res.status(409).json({ 
            message: "This time slot is no longer available. Please select another time." 
          });
        }
        throw dbError;
      }
    } catch (error: any) {
      console.error("========================================");
      console.error("[Public Unit Booking] ❌ ERROR booking showing");
      console.error("[Public Unit Booking] Error message:", error.message);
      console.error("[Public Unit Booking] Error stack:", error.stack);
      console.error("[Public Unit Booking] Error details:", error);
      console.error("========================================");
      res.status(500).json({ 
        message: "Failed to book showing",
        error: error.message 
      });
    }
  });

  // Book a showing (public - no auth required)
  app.post("/api/public/properties/:propertyId/book", async (req, res) => {
    try {
      // Rate limiting
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ 
          message: "Too many requests. Please try again later." 
        });
      }

      const { propertyId } = req.params;
      
      // Validate request body with Zod
      const validationResult = publicBookingSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid booking data",
          errors: validationResult.error.errors 
        });
      }

      const { name, email, phone, date, time } = validationResult.data;

      // Validate property exists (property owns the orgId for tenant isolation)
      const property = await storage.getPropertyPublic(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found or not available for booking" });
      }

      // SECURITY: All showings are created with property.orgId to maintain tenant isolation
      // This prevents cross-org showing creation - the showing belongs to the property's org

      // Create or find lead first
      let lead = await storage.getLeadByEmail(email, property.orgId);
      if (!lead) {
        lead = await storage.createLead({
          name,
          email,
          phone,
          propertyId,
          propertyName: property.name,
          status: "new",
          source: "website",
          orgId: property.orgId,
        });
      }

      // ATOMICALLY re-check conflicts right before creating showing (prevent race condition)
      const { detectConflicts } = await import("./ai-scheduling");
      // Get all showings for the selected date (needed for member-level conflict checking)
      const freshShowings = await storage.getShowingsByDateRange(date, date, property.orgId);
      const schedulePrefs = await storage.getSchedulePreferences();

      // Get property scheduling settings to find assigned members and event duration
      const propertySettings = await storage.getPropertySchedulingSettings(propertyId, property.orgId);
      
      // Get effective event duration (from property settings or default to 30)
      const effectiveEventDuration = propertySettings?.eventDuration || 30;

      // NOTE: We don't check for property-level conflicts here anymore
      // Instead, we let auto-assignment check member-level availability
      // This allows the system to assign to an available member even if another member is booked

      // Auto-assign to highest priority available member
      let assignedToUserId: string | null = null;
      
      // Helper to parse assignedMembers
      const parseAssignedMembers = (members: any): any[] => {
        if (!members) return [];
        if (Array.isArray(members)) return members;
        if (typeof members === 'string') {
          try {
            return JSON.parse(members);
          } catch {
            return [];
          }
        }
        return [];
      };
      
      const propertyAssignedMembers = parseAssignedMembers(propertySettings?.assignedMembers);
      
      console.log(`[Auto-Assign Property] Starting auto-assignment for property ${propertyId}, date ${date}, time ${time}`);
      console.log(`[Auto-Assign Property] Property assigned members:`, JSON.stringify(propertyAssignedMembers));
      
      if (propertyAssignedMembers.length > 0) {
        // Sort by priority (1 = highest priority)
        const sortedMembers = [...propertyAssignedMembers].sort((a, b) => {
          const priorityA = typeof a === 'object' && a.priority ? a.priority : 999;
          const priorityB = typeof b === 'object' && b.priority ? b.priority : 999;
          return priorityA - priorityB;
        });
        
        console.log(`[Auto-Assign Property] Sorted members by priority:`, JSON.stringify(sortedMembers.map((m: any) => ({
          userId: typeof m === 'string' ? m : m.userId,
          priority: typeof m === 'object' && m.priority ? m.priority : 999
        }))));
        
        // Get schedule preferences for all assigned members
        const userIds = sortedMembers.map((m: any) => typeof m === 'string' ? m : m.userId);
        const memberSchedulePrefs = await storage.getSchedulePreferencesForUsers(userIds, propertyId);
        
        console.log(`[Auto-Assign Property] Found ${memberSchedulePrefs.length} schedule preferences for ${userIds.length} members`);
        
        // Get day of week for the booking date
        const bookingDate = new Date(date);
        const dayOfWeek = bookingDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        console.log(`[Auto-Assign Property] Booking day of week: ${dayOfWeek}`);
        
        // Check each member in priority order for availability
        for (const member of sortedMembers) {
          const userId = typeof member === 'string' ? member : member.userId;
          const memberPriority = typeof member === 'object' && member.priority ? member.priority : 999;
          
          console.log(`[Auto-Assign Property] Checking member ${userId} with priority ${memberPriority}`);
          
          // Check if member has schedule preference for this day
          const dayPreference = memberSchedulePrefs.find(
            pref => pref.userId === userId && 
            pref.dayOfWeek === dayOfWeek && 
            pref.isActive
          );
          
          if (dayPreference) {
            console.log(`[Auto-Assign Property] Member ${userId} has schedule preference for ${dayOfWeek}: ${dayPreference.startTime}-${dayPreference.endTime}`);
            
            // Check if the booking time is within their available hours
            const [prefStartHour, prefStartMin] = dayPreference.startTime.split(':').map(Number);
            const [prefEndHour, prefEndMin] = dayPreference.endTime.split(':').map(Number);
            const [bookingHour, bookingMin] = time.split(':').map(Number);
            
            const prefStartMinutes = prefStartHour * 60 + prefStartMin;
            const prefEndMinutes = prefEndHour * 60 + prefEndMin;
            const bookingMinutes = bookingHour * 60 + bookingMin;
            const bookingEndMinutes = bookingMinutes + effectiveEventDuration;
            
            if (bookingMinutes < prefStartMinutes || bookingEndMinutes > prefEndMinutes) {
              console.log(`[Auto-Assign Property] Member ${userId} booking time ${time} is outside their available hours ${dayPreference.startTime}-${dayPreference.endTime}`);
              continue; // Skip if booking time is outside their available hours
            }
          } else {
            console.log(`[Auto-Assign Property] Member ${userId} has no schedule preference for ${dayOfWeek}, will check for conflicts only`);
          }
          
          // Check if member has any existing showings at this time (conflict check)
          const memberShowings = freshShowings.filter(s => s.assignedTo === userId);
          console.log(`[Auto-Assign Property] Member ${userId} has ${memberShowings.length} existing showings`);
          
          // Use dayPreference if available, otherwise use empty array (just check for conflicts)
          const preferencesForConflictCheck = dayPreference ? [dayPreference] : [];
          
          const memberConflicts = detectConflicts(
        {
          propertyId,
          scheduledDate: date,
          scheduledTime: time,
              durationMinutes: effectiveEventDuration,
        },
            memberShowings,
            preferencesForConflictCheck,
        property.timezone || 'America/Chicago'
      );

          const hasMemberConflict = memberConflicts.some(c => c.type === 'overlap' && c.severity === 'error');
          
          if (!hasMemberConflict) {
            assignedToUserId = userId;
            console.log(`[Auto-Assign Property] ✅ ASSIGNED booking to member ${userId} with priority ${memberPriority}`);
            break; // Found available member, stop searching
          } else {
            console.log(`[Auto-Assign Property] Member ${userId} has a conflict at ${date} ${time}`);
          }
        }
        
        if (!assignedToUserId) {
          console.log(`[Auto-Assign Property] ❌ No available members found for ${date} ${time}`);
        } else {
          console.log(`[Auto-Assign Property] ✅ Final assignment: ${assignedToUserId}`);
        }
        
        // If no assigned members are available, reject the booking
        if (!assignedToUserId && propertyAssignedMembers.length > 0) {
          console.log(`[Public Property Booking] ❌ Rejecting booking: No assigned members are available at ${date} ${time}`);
        return res.status(409).json({ 
            message: "This time slot is no longer available. All assigned team members are booked at this time. Please select another time." 
        });
        }
      } else {
        console.log(`[Auto-Assign Property] ⚠️ No assigned members found for this property`);
      }

      // Final check: If we have assigned members but no assignment was made, reject the booking
      if (!assignedToUserId && propertyAssignedMembers.length > 0) {
        console.log(`[Public Property Booking] ❌ Rejecting booking: No assignment made despite assigned members existing`);
        return res.status(409).json({ 
          message: "This time slot is no longer available. All assigned team members are booked at this time. Please select another time." 
        });
      }

      // Create showing only after final conflict check passes
      // Database unique constraint provides final protection against race conditions
      console.log(`[Auto-Assign Property] Creating showing with assignedTo: ${assignedToUserId || 'null'}`);
      try {
        // Build location with property address
        const locationParts = [property.address];
        if (property.city) locationParts.push(property.city);
        if (property.state) locationParts.push(property.state);
        if (property.zipCode) locationParts.push(property.zipCode);
        const location = locationParts.filter(Boolean).join(", ");
        
        // Helper function to replace variables in event name/description
        const replaceVariablesForBooking = (text: string | null | undefined): string => {
          if (!text || !property) return text || '';
          
          // Format property amenities as comma-separated list
          const propertyAmenitiesStr = property.amenities && property.amenities.length > 0
            ? property.amenities.join(', ')
            : '';
          
          // Format property address
          const propertyAddressParts = [
            property.address,
            property.city,
            property.state,
            property.zipCode
          ].filter(Boolean);
          const propertyAddressStr = propertyAddressParts.join(', ');
          
          // Define safe replacement mapping with all available variables
          // Note: For property-level bookings, unit-specific variables will be empty
          const variables: Record<string, string> = {
            '{unit_number}': '', // Not available for property-level bookings
            '{bedrooms}': property.bedrooms?.toString() || '',
            '{bathrooms}': property.bathrooms || '',
            '{unit_rent}': '', // Not available for property-level bookings
            '{security_deposit}': '', // Not available for property-level bookings
            '{property_amenities}': propertyAmenitiesStr,
            '{property_address}': propertyAddressStr,
            '{property_name}': property.name || ''
          };
          
          // Replace each variable
          let result = text;
          for (const [placeholder, value] of Object.entries(variables)) {
            // Escape regex special characters in placeholder for safe replacement
            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(escapedPlaceholder, 'g'), value);
          }
          
          return result;
        };
        
        // Get event name and description from property-level settings
        let eventNameForNewBooking = propertySettings?.eventName || `Showing for ${property.name}`;
        let eventDescriptionForNewBooking = propertySettings?.eventDescription || "";
        
        // Replace variables in event name and description
        eventNameForNewBooking = replaceVariablesForBooking(eventNameForNewBooking);
        eventDescriptionForNewBooking = replaceVariablesForBooking(eventDescriptionForNewBooking);
        
        const showing = await storage.createShowing({
          propertyId,
          leadId: lead.id,
          scheduledDate: date,
          scheduledTime: time,
          durationMinutes: effectiveEventDuration,
          showingType: "in_person",
          status: "pending",
          title: eventNameForNewBooking, // Use event name from booking event type settings with variables replaced
          location: location, // Include full property address
          orgId: property.orgId,
          assignedTo: assignedToUserId, // Auto-assign to highest priority available member
        });
        console.log(`[Auto-Assign Property] Showing created with ID: ${showing.id}, assignedTo: ${showing.assignedTo || 'null'}`);

        // Send confirmation emails with calendar invites and create in-app notifications
        const { notifyPublicShowingBooked } = await import("./notifications");
        // Fire notifications asynchronously (don't block response)
        notifyPublicShowingBooked(showing, property, lead, storage).catch((err) => {
          console.error("[Public Booking] Failed to send notifications:", err);
        });
        
        // Get assigned member details if assignedTo exists
        let assignedMember = null;
        if (showing.assignedTo) {
          const assignedUser = await storage.getUser(showing.assignedTo);
          if (assignedUser) {
            assignedMember = {
              id: assignedUser.id,
              name: `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() || assignedUser.email,
              email: assignedUser.email,
              phone: assignedUser.phone || null,
            };
          }
        }
        
        res.status(201).json({
          message: "Showing booked successfully",
          showing: {
            id: showing.id,
            date: showing.scheduledDate,
            time: showing.scheduledTime,
            property: property.name,
            assignedTo: showing.assignedTo || null,
            assignedMember: assignedMember,
            eventName: showing.title || null,
          },
        });
      } catch (dbError: any) {
        // Handle unique constraint violation (concurrent booking race condition)
        if (dbError.code === '23505' || dbError.message?.includes('unique')) {
          return res.status(409).json({ 
            message: "This time slot is no longer available. Please select another time." 
          });
        }
        throw dbError;
      }
    } catch (error: any) {
      console.error("[Public Booking] Error booking showing:", error);
      res.status(500).json({ 
        message: "Failed to book showing",
        error: error.message 
      });
    }
  });

  // ===== ONBOARDING INTAKE ROUTES =====
  // Create or update onboarding intake (public - no auth required)
  app.post("/api/onboarding", async (req, res) => {
    try {
      const { sessionToken, ...intakeData } = req.body;
      
      if (!sessionToken) {
        return res.status(400).json({ message: "Session token is required" });
      }

      // Check if intake already exists
      const existingIntake = await storage.getOnboardingIntake(sessionToken);
      
      if (existingIntake) {
        // Update existing intake
        const updated = await storage.updateOnboardingIntake(sessionToken, intakeData);
        return res.json(updated);
      } else {
        // Create new intake
        const intake = await storage.createOnboardingIntake({
          sessionToken,
          ...intakeData,
        });
        return res.status(201).json(intake);
      }
    } catch (error: any) {
      console.error("[Onboarding] Error saving onboarding intake:", error);
      res.status(400).json({ 
        message: "Failed to save onboarding data", 
        error: error.message 
      });
    }
  });

  // Get onboarding intake by session token (public)
  app.get("/api/onboarding/:sessionToken", async (req, res) => {
    try {
      const { sessionToken } = req.params;
      const intake = await storage.getOnboardingIntake(sessionToken);
      
      if (!intake) {
        return res.status(404).json({ message: "Onboarding intake not found" });
      }
      
      res.json(intake);
    } catch (error) {
      console.error("[Onboarding] Error fetching onboarding intake:", error);
      res.status(500).json({ message: "Failed to fetch onboarding data" });
    }
  });

  // Mark onboarding as completed (public, but can auto-link if authenticated)
  app.patch("/api/onboarding/:sessionToken/complete", async (req: any, res) => {
    try {
      const { sessionToken } = req.params;
      const userId = req.user?.id; // Will be undefined if not authenticated
      
      // Update status to completed and manually set completedAt timestamp
      const intake = await storage.getOnboardingIntake(sessionToken);
      if (!intake) {
        return res.status(404).json({ message: "Onboarding intake not found" });
      }

      // Use raw DB update to set completedAt
      const result = await db
        .update(onboardingIntakes)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(onboardingIntakes.sessionToken, sessionToken))
        .returning();
      
      const completedIntake = result[0];
      
      // If user is authenticated, automatically link the intake to their account
      if (userId && completedIntake) {
        try {
          await storage.linkOnboardingIntakeToUser(sessionToken, userId);
          console.log(`[Onboarding] Auto-linked completed onboarding intake ${sessionToken} to authenticated user ${userId}`);
        } catch (linkError: any) {
          console.error("[Onboarding] Failed to auto-link intake to user:", linkError.message);
          // Don't fail completion if linking fails
        }
      }
      
      // Automatically create/update sales prospect from this onboarding intake
      if (completedIntake) {
        try {
          await storage.upsertProspectFromOnboarding(completedIntake);
          console.log("[Onboarding] Created/updated sales prospect for intake:", completedIntake.id);
        } catch (prospectError: any) {
          console.error("[Onboarding] Failed to create sales prospect:", prospectError.message);
          // Don't fail the completion if prospect creation fails
        }
      }
      
      res.json(result[0]);
    } catch (error) {
      console.error("[Onboarding] Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Get all onboarding intakes (admin only)
  app.get("/api/onboarding-intakes", isAuthenticated, async (req, res) => {
    try {
      // Only allow admin users
      const user = req.user as User;
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const intakes = await storage.getAllOnboardingIntakes();
      res.json(intakes);
    } catch (error) {
      console.error("[Onboarding] Error fetching onboarding intakes:", error);
      res.status(500).json({ message: "Failed to fetch onboarding intakes" });
    }
  });

  // Get all sales prospects (admin only)
  app.get("/api/sales-prospects", isAuthenticated, async (req, res) => {
    try {
      // Only allow admin users
      const user = req.user as User;
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const prospects = await storage.getAllSalesProspects();
      res.json(prospects);
    } catch (error) {
      console.error("[Sales] Error fetching sales prospects:", error);
      res.status(500).json({ message: "Failed to fetch sales prospects" });
    }
  });

  // Update prospect pipeline stage (admin only)
  app.patch("/api/sales-prospects/:id/stage", isAuthenticated, async (req, res) => {
    try {
      // Only allow admin users
      const user = req.user as User;
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { stage } = req.body;

      if (!stage) {
        return res.status(400).json({ message: "Stage is required" });
      }

      const validStages = ['discovery', 'evaluation', 'probing', 'offer', 'sale', 'onboard'];
      if (!validStages.includes(stage)) {
        return res.status(400).json({ message: "Invalid stage" });
      }

      const prospect = await storage.updateProspectStage(id, stage);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      res.json(prospect);
    } catch (error) {
      console.error("[Sales] Error updating prospect stage:", error);
      res.status(500).json({ message: "Failed to update prospect stage" });
    }
  });

  // Update prospect details (admin only) - must come after specific routes like /stage
  app.patch("/api/sales-prospects/:id", isAuthenticated, async (req, res) => {
    try {
      // Only allow admin users
      const user = req.user as User;
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const updateData: Partial<InsertSalesProspect> = {};

      // Only allow updating specific fields
      if (req.body.notes !== undefined) {
        updateData.notes = req.body.notes;
      }
      if (req.body.primaryName !== undefined) {
        updateData.primaryName = req.body.primaryName;
      }
      if (req.body.phone !== undefined) {
        updateData.phone = req.body.phone;
      }
      if (req.body.units !== undefined) {
        updateData.units = req.body.units;
      }

      const prospect = await storage.updateSalesProspect(id, updateData);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      res.json(prospect);
    } catch (error) {
      console.error("[Sales] Error updating prospect:", error);
      res.status(500).json({ message: "Failed to update prospect" });
    }
  });

  // Resync all prospects from demo requests and onboarding intakes (admin only)
  app.post("/api/sales-prospects/resync", isAuthenticated, async (req, res) => {
    try {
      // Only allow admin users
      const user = req.user as User;
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      console.log("[Sales] Starting prospect resync...");
      const count = await storage.resyncAllProspects();
      console.log("[Sales] Resync completed successfully:", count, "prospects");
      res.json({ message: `Resynced ${count} prospects`, count });
    } catch (error: any) {
      console.error("[Sales] Error resyncing prospects:", error);
      console.error("[Sales] Error stack:", error.stack);
      console.error("[Sales] Error message:", error.message);
      res.status(500).json({ message: "Failed to resync prospects", error: error.message });
    }
  });

  // ===== AUDIT LOGS ROUTES =====
  // Get audit logs for a specific resource
  app.get("/api/audit-logs", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { resource, resourceId } = req.query;
      
      if (!resource) {
        return res.status(400).json({ message: "Resource parameter is required" });
      }

      const filters: any = {
        resource: resource as string,
      };

      if (resourceId) {
        filters.resourceId = resourceId as string;
      }

      const logs = await storage.getAuditLogs(req.orgId, filters);
      res.json(logs);
    } catch (error: any) {
      console.error("[Audit Logs] Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs", error: error.message });
    }
  });

  // ===== ADMIN ANALYTICS ROUTES =====
  // Get platform-wide analytics (admin only)
  app.get("/api/admin/analytics", isAuthenticated, async (req, res) => {
    try {
      // Only allow admin users
      const user = req.user as User;
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const analytics = await storage.getAdminAnalytics();
      res.json(analytics);
    } catch (error: any) {
      console.error("[Admin Analytics] Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics", error: error.message });
    }
  });

  // ===== LISTINGS ROUTES (Pre-qualification System) =====
  // Get all listings for the organization
  app.get("/api/listings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const listings = await storage.getAllListings(req.orgId);
      
      // OPTIMIZED: Fetch all properties and units in parallel, then map (avoids N+1 queries)
      const propertyIdsSet = new Set(listings.map(l => l.propertyId));
      const unitIdsSet = new Set(listings.map(l => l.unitId));
      const propertyIds = Array.from(propertyIdsSet);
      const unitIds = Array.from(unitIdsSet);
      
      // Fetch all properties and units in parallel
      const [propertiesArray, unitsArray] = await Promise.all([
        Promise.all(propertyIds.map(id => storage.getProperty(id, req.orgId))),
        Promise.all(unitIds.map(id => storage.getPropertyUnit(id, req.orgId))),
      ]);
      
      // Create lookup maps for O(1) access
      const propertiesMap = new Map(propertiesArray.filter(p => p).map(p => [p!.id, p!]));
      const unitsMap = new Map(unitsArray.filter(u => u).map(u => [u!.id, u!]));
      
      // Enrich listings using the maps (no additional queries)
      const enrichedListings = listings.map((listing) => ({
        ...listing,
        property: propertiesMap.get(listing.propertyId) || null,
        unit: unitsMap.get(listing.unitId) || null,
      }));
      
      res.json(enrichedListings);
    } catch (error: any) {
      console.error("[Listings] Error fetching listings:", error);
      res.status(500).json({ message: "Failed to fetch listings", error: error.message });
    }
  });

  // Get listings for a specific property
  app.get("/api/properties/:propertyId/listings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      const listings = await storage.getListingsByProperty(propertyId, req.orgId);
      res.json(listings);
    } catch (error: any) {
      console.error("[Listings] Error fetching property listings:", error);
      res.status(500).json({ message: "Failed to fetch property listings", error: error.message });
    }
  });

  // Get a single listing
  // Get listing data for Facebook posting (internal endpoint, uses secret token)
  app.get("/api/listings/:id/for-facebook", async (req: any, res) => {
    try {
      const { id } = req.params;
      const secretToken = req.query.secretToken as string;
      const orgId = req.query.orgId as string;
      
      // Validate secret token
      const expectedToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
      if (secretToken !== expectedToken) {
        return res.status(401).json({ message: "Unauthorized - invalid secret token" });
      }
      
      if (!orgId) {
        return res.status(400).json({ message: "orgId query parameter is required" });
      }
      
      const listing = await storage.getListing(id, orgId);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }
      
      // Enrich listing with property and unit details (for Facebook listing integration)
      const property = await storage.getProperty(listing.propertyId, orgId);
      const unit = await storage.getPropertyUnit(listing.unitId, orgId);
      
      res.json({
        ...listing,
        property,
        unit,
      });
    } catch (error: any) {
      console.error("[Listings] Error fetching listing for Facebook:", error);
      res.status(500).json({ message: "Failed to fetch listing", error: error.message });
    }
  });

  app.get("/api/listings/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { id } = req.params;
      const listing = await storage.getListing(id, req.orgId);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }
      
      // Enrich listing with property and unit details (for Facebook listing integration)
      const property = await storage.getProperty(listing.propertyId, req.orgId);
      const unit = await storage.getPropertyUnit(listing.unitId, req.orgId);
      
      res.json({
        ...listing,
        property,
        unit,
      });
    } catch (error: any) {
      console.error("[Listings] Error fetching listing:", error);
      res.status(500).json({ message: "Failed to fetch listing", error: error.message });
    }
  });

  // Import Facebook listings that were polled in (not created in Lead2Lease)
  app.post("/api/listings/import-facebook", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      console.log("[Listings] Starting Facebook listings import for org:", req.orgId);
      
      // Get all leads with Facebook listing IDs in metadata
      const allLeads = await storage.getAllLeads(req.orgId);
      const facebookListingIds = new Set<string>();
      
      allLeads.forEach(lead => {
        if (lead.metadata) {
          try {
            const metadata = typeof lead.metadata === 'string' 
              ? JSON.parse(lead.metadata) 
              : lead.metadata;
            if (metadata?.facebookListingId) {
              facebookListingIds.add(metadata.facebookListingId);
            }
          } catch (e) {
            // Skip invalid metadata
          }
        }
      });
      
      console.log(`[Listings] Found ${facebookListingIds.size} unique Facebook listing IDs from leads`);
      
      if (facebookListingIds.size === 0) {
        return res.json({ 
          success: true, 
          message: "No Facebook listings found to import",
          imported: 0,
          skipped: 0
        });
      }
      
      // Get all existing listings to check which Facebook listing IDs already have listings
      const existingListings = await storage.getAllListings(req.orgId);
      const existingFacebookListingIds = new Set(
        existingListings
          .filter(l => l.facebookListingId)
          .map(l => l.facebookListingId!)
      );
      
      // Filter to only listing IDs that don't have listings yet
      const listingIdsToImport = Array.from(facebookListingIds).filter(
        id => !existingFacebookListingIds.has(id)
      );
      
      console.log(`[Listings] ${listingIdsToImport.length} Facebook listings need to be imported`);
      
      if (listingIdsToImport.length === 0) {
        return res.json({ 
          success: true, 
          message: "All Facebook listings already imported",
          imported: 0,
          skipped: facebookListingIds.size
        });
      }
      
      // Get or create "Facebook Imported Listings" property
      const allProperties = await storage.getAllProperties(req.orgId);
      let facebookProperty = allProperties.find(p => p.name === "Facebook Imported Listings");
      
      if (!facebookProperty) {
        console.log("[Listings] Creating 'Facebook Imported Listings' property");
        facebookProperty = await storage.createProperty({
          orgId: req.orgId,
          name: "Facebook Imported Listings",
          address: "Imported from Facebook Marketplace",
          description: "Listings imported from Facebook Marketplace that were not created in Lead2Lease",
          units: listingIdsToImport.length,
          occupancy: 0,
          monthlyRevenue: "0",
        });
      }
      
      // Create listings for each Facebook listing ID
      let imported = 0;
      let errors = 0;
      
      for (const facebookListingId of listingIdsToImport) {
        try {
          // Create a placeholder unit for this Facebook listing
          const unit = await storage.createPropertyUnit({
            propertyId: facebookProperty.id,
            orgId: req.orgId,
            unitNumber: `FB-${facebookListingId}`,
            bedrooms: 0, // Placeholder - required field
            bathrooms: "0", // Placeholder - required field
            monthlyRent: undefined,
            deposit: undefined,
            squareFeet: undefined,
            isListed: true,
            status: 'not_occupied',
            bookingEnabled: false, // Don't enable booking for imported listings
          });
          
          // Create listing with Facebook listing ID
          const listing = await storage.createListing({
            orgId: req.orgId,
            propertyId: facebookProperty.id,
            unitId: unit.id,
            title: `Facebook Listing ${facebookListingId}`,
            description: "This listing was imported from Facebook Marketplace. It was not created in Lead2Lease.",
            status: 'active',
            preQualifyEnabled: false,
            acceptBookings: false, // Don't accept bookings for imported listings
            facebookListingId: facebookListingId,
            facebookListedAt: new Date(),
          });
          
          imported++;
          console.log(`[Listings] ✅ Imported Facebook listing ${facebookListingId}`);
        } catch (error: any) {
          errors++;
          console.error(`[Listings] ❌ Failed to import Facebook listing ${facebookListingId}:`, error.message);
        }
      }
      
      res.json({
        success: true,
        message: `Imported ${imported} Facebook listings`,
        imported,
        skipped: facebookListingIds.size - listingIdsToImport.length,
        errors,
      });
    } catch (error: any) {
      console.error("[Listings] Error importing Facebook listings:", error);
      res.status(500).json({ message: "Failed to import Facebook listings", error: error.message });
    }
  });

  // Create a new listing
  app.post("/api/listings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validationResult = insertListingSchema.safeParse({
        ...req.body,
        orgId: req.orgId,
        status: 'active', // Ensure listing is created with 'active' status
      });
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid listing data",
          errors: validationResult.error.errors 
        });
      }

      const listing = await storage.createListing(validationResult.data);
      
      const { propertyId, unitId } = validationResult.data;

      if (validationResult.data.acceptBookings !== false) {
        // acceptBookings ON: enable unit-level booking, ensure property settings exist
        try {
          // 1. Ensure property-level booking settings exist (create if not)
          let propertySettings = await storage.getPropertySchedulingSettings(propertyId, req.orgId);
          if (!propertySettings) {
            const property = await storage.getProperty(propertyId, req.orgId);
            propertySettings = await storage.createPropertySchedulingSettings({
              orgId: req.orgId,
              propertyId,
              eventName: `${property?.name || 'Property'} Showing`,
              bookingMode: "one_to_one",
              eventDuration: 30,
              bufferTime: 15,
              leadTime: 120,
              assignedMembers: [],
              bookingEnabled: true,
            });
            console.log(`[Listings] Auto-created property scheduling settings for property ${propertyId}`);
          }
          
          // 2. Enable unit-level booking and mark as listed
          await storage.updatePropertyUnit(unitId, {
            bookingEnabled: true,
            isListed: true,
            bookingTypeDeleted: false,
            createdFromListingId: listing.id,
          }, req.orgId);
          console.log(`[Listings] Auto-enabled booking for unit ${unitId} from listing ${listing.id} (acceptBookings=true)`);
          
        } catch (bookingError: any) {
          console.error("[Listings] Warning: Failed to auto-create booking event type:", bookingError);
        }
      } else {
        // acceptBookings OFF: explicitly disable unit-level booking (no booking type)
        try {
          await storage.updatePropertyUnit(unitId, {
            bookingEnabled: false,
            isListed: true, // Unit is listed, but bookings are disabled
          }, req.orgId);
          console.log(`[Listings] Disabled booking for unit ${unitId} (acceptBookings=false)`);
        } catch (err: any) {
          console.error("[Listings] Warning: Failed to disable booking for unit:", err);
        }
      }
      
      // Trigger Facebook Marketplace listing if requested
      if (req.body.listToFacebook) {
        try {
          // Check if listing already has a Facebook listing ID - skip if it exists
          const existingListing = await storage.getListing(listing.id, req.orgId);
          if (existingListing?.facebookListingId) {
            console.log(`[Listings] Listing ${listing.id} already has Facebook listing ID: ${existingListing.facebookListingId}. Skipping Facebook posting.`);
          } else {
            const { triggerFacebookListing } = await import('./facebookListing');
            console.log(`[Listings] Starting Facebook Marketplace listing process for listing ${listing.id}...`);
            // Trigger asynchronously - run in background but capture output for visibility
            triggerFacebookListing(listing.id, req.orgId, false).then(({ promise }) => {
              if (promise) {
                promise.then(() => {
                  console.log(`[Listings] ✅ Facebook Marketplace listing completed successfully for listing ${listing.id}`);
                }).catch((error) => {
                  console.error(`[Listings] ❌ Facebook Marketplace listing failed for ${listing.id}:`, error);
                });
              }
            }).catch((error) => {
              console.error(`[Listings] Warning: Failed to trigger Facebook Marketplace listing for ${listing.id}:`, error);
            });
            console.log(`[Listings] Facebook Marketplace listing process started in background for listing ${listing.id} (check logs for progress)`);
          }
        } catch (facebookError: any) {
          // Log but don't fail the listing creation
          console.error(`[Listings] Warning: Failed to import or trigger Facebook listing service for ${listing.id}:`, facebookError);
        }
      }
      
      res.status(201).json(listing);
    } catch (error: any) {
      console.error("[Listings] Error creating listing:", error);
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ message: "A listing already exists for this unit" });
      }
      res.status(500).json({ message: "Failed to create listing", error: error.message });
    }
  });

  // Update Facebook listing ID (called by Playwright script after posting)
  // Uses secret token instead of auth since it's called from an internal script
  app.patch("/api/listings/:id/facebook", async (req: any, res) => {
    const startTime = Date.now();
    console.log(`[Listings/Facebook] 📥 Received PATCH request at ${new Date().toISOString()}`);
    console.log(`[Listings/Facebook] Request params:`, { id: req.params.id });
    console.log(`[Listings/Facebook] Request body keys:`, Object.keys(req.body || {}));
    
    try {
      const { id } = req.params;
      const { facebookListingId, orgId, secretToken } = req.body;
      
      console.log(`[Listings/Facebook] Processing request for listing ${id}, orgId: ${orgId}`);
      
      // Validate secret token
      const expectedToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
      if (secretToken !== expectedToken) {
        console.error(`[Listings/Facebook] ❌ Invalid secret token`);
        return res.status(401).json({ message: "Unauthorized - invalid secret token" });
      }
      
      if (!facebookListingId || !orgId) {
        console.error(`[Listings/Facebook] ❌ Missing required fields - facebookListingId: ${!!facebookListingId}, orgId: ${!!orgId}`);
        return res.status(400).json({ message: "facebookListingId and orgId are required" });
      }
      
      // Extract just the ID from URL if full URL is provided
      // Handles: "https://www.facebook.com/marketplace/item/638680695215754"
      // Handles: "/marketplace/item/25783820144571387/"
      // Handles: "/item/25783820144571387/"
      // Handles: "25783820144571387" (already just an ID)
      let extractedId = facebookListingId;
      
      // Try pattern: /item/123456 or /marketplace/item/123456
      const urlMatch = facebookListingId.match(/(?:marketplace\/)?item\/(\d+)/);
      if (urlMatch && urlMatch[1]) {
        extractedId = urlMatch[1];
        console.log(`[Listings] Extracted ID from URL pattern: ${extractedId}`);
      } else if (facebookListingId.includes('/')) {
        // If it's a URL but doesn't match the pattern, try to extract the last numeric part
        const parts = facebookListingId.split('/').filter(p => p && /^\d+$/.test(p));
        if (parts.length > 0) {
          extractedId = parts[parts.length - 1]; // Get the last numeric part
          console.log(`[Listings] Extracted ID from URL parts: ${extractedId}`);
        } else {
          // Last resort: try to extract any number from the string
          const numberMatch = facebookListingId.match(/(\d{10,})/); // At least 10 digits (Facebook IDs are long)
          if (numberMatch && numberMatch[1]) {
            extractedId = numberMatch[1];
            console.log(`[Listings] Extracted ID using number pattern: ${extractedId}`);
          }
        }
      }
      
      // Validate that we have a numeric ID
      if (!/^\d+$/.test(extractedId)) {
        console.error(`[Listings] Invalid Facebook listing ID format: ${extractedId}`);
        return res.status(400).json({ message: `Invalid Facebook listing ID format: ${extractedId}` });
      }
      
      console.log(`[Listings/Facebook] Final extracted Facebook listing ID: ${extractedId}`);
      
      console.log(`[Listings/Facebook] 💾 Saving to database...`);
      const listing = await storage.updateListing(id, {
        facebookListingId: extractedId,
        facebookListedAt: new Date(),
      }, orgId);
      
      const duration = Date.now() - startTime;
      
      if (!listing) {
        console.error(`[Listings/Facebook] ❌ Listing not found: ${id} (took ${duration}ms)`);
        return res.status(404).json({ message: "Listing not found" });
      }
      
      console.log(`[Listings/Facebook] ✅ Successfully updated Facebook listing ID for listing ${id}: ${extractedId} (took ${duration}ms)`);
      console.log(`[Listings/Facebook] Updated listing data:`, { 
        id: listing.id, 
        facebookListingId: listing.facebookListingId,
        facebookListedAt: listing.facebookListedAt 
      });
      
      res.json(listing);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[Listings/Facebook] ❌ Error updating Facebook listing ID (took ${duration}ms):`, error);
      console.error(`[Listings/Facebook] Error stack:`, error.stack);
      res.status(500).json({ message: "Failed to update Facebook listing ID", error: error.message });
    }
  });

  // Internal endpoint for Facebook message polling: Find or create lead by Facebook profile ID
  // Uses secret token instead of auth since it's called from an internal script
  app.post("/api/leads/for-facebook", async (req: any, res) => {
    try {
      const { profileId, orgId, secretToken, name, email, phone, facebookListingId } = req.body;
      
      console.log(`[Leads/Facebook] Processing request for profile ID: ${profileId}, orgId: ${orgId}`);
      
      // Validate secret token
      const expectedToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
      if (secretToken !== expectedToken) {
        console.error(`[Leads/Facebook] ❌ Invalid secret token`);
        return res.status(401).json({ message: "Unauthorized - invalid secret token" });
      }
      
      if (!profileId || !orgId) {
        console.error(`[Leads/Facebook] ❌ Missing required fields - profileId: ${!!profileId}, orgId: ${!!orgId}`);
        return res.status(400).json({ message: "profileId and orgId are required" });
      }
      
      // Try to find existing lead by externalId (profile ID)
      let lead = await storage.getLeadByExternalId(profileId, orgId);
      
      // Look up property/unit from Facebook listing ID if provided
      let propertyIdFromListing: string | undefined;
      let unitIdFromListing: string | undefined;
      
      if (facebookListingId) {
        const unit = await storage.getUnitByFacebookListingId(facebookListingId, orgId);
        if (unit) {
          propertyIdFromListing = unit.propertyId;
          unitIdFromListing = unit.id;
          console.log(`[Leads/Facebook] 🔍 Mapped listing ID to property: ${unit.propertyId}, unit: ${unit.id}`);
        } else {
          console.log(`[Leads/Facebook] ⚠️  No unit found for Facebook listing ID: ${facebookListingId}`);
        }
      }
      
      if (lead) {
        console.log(`[Leads/Facebook] ✅ Found existing lead: ${lead.id}`);
        // Update metadata and property/unit if listing ID provided
        if (facebookListingId) {
          const metadata = (lead.metadata as any) || {};
          const updates: any = {};
          
          if (!metadata.facebookListingId || metadata.facebookListingId !== facebookListingId) {
            metadata.facebookListingId = facebookListingId;
            if (unitIdFromListing) {
              metadata.unitId = unitIdFromListing;
            }
            updates.metadata = metadata;
          }
          
          // Set propertyId if we found it from listing and lead doesn't have one
          if (propertyIdFromListing && !lead.propertyId) {
            updates.propertyId = propertyIdFromListing;
            console.log(`[Leads/Facebook] Setting propertyId from listing: ${propertyIdFromListing}`);
          }
          
          if (Object.keys(updates).length > 0) {
            lead = await storage.updateLead(lead.id, updates, orgId);
            console.log(`[Leads/Facebook] Updated lead with listing context:`, updates);
          }
        }
      } else {
        console.log(`[Leads/Facebook] Creating new lead for profile ID: ${profileId}`);
        // Create new lead
        const leadData: any = {
          name: name || `Facebook User ${profileId}`,
          email: email || null,
          phone: phone || null,
          source: 'facebook',
          externalId: profileId,
          orgId,
          propertyId: propertyIdFromListing || null,  // Set propertyId from listing if found
          metadata: {
            facebookProfileId: profileId,
            ...(facebookListingId && { facebookListingId }),
            ...(unitIdFromListing && { unitId: unitIdFromListing }),
          },
        };
        
        lead = await storage.createLead(leadData);
        console.log(`[Leads/Facebook] ✅ Created new lead: ${lead.id} with propertyId: ${propertyIdFromListing || 'none'}`);
      }
      
      res.json(lead);
    } catch (error: any) {
      console.error(`[Leads/Facebook] ❌ Error:`, error);
      res.status(500).json({ message: "Failed to find or create lead", error: error.message });
    }
  });

  // Internal endpoint to get organization ID for a user (for Facebook message polling)
  // Uses secret token instead of auth since it's called from an internal script
  app.get("/api/orgs/default", async (req: any, res) => {
    try {
      const secretToken = req.query.secretToken as string;
      const userEmail = req.query.userEmail as string;
      
      // Validate secret token (optional - if no token, still return org for convenience)
      const expectedToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
      if (secretToken && secretToken !== expectedToken) {
        console.error(`[Orgs/Facebook] ❌ Invalid secret token`);
        return res.status(401).json({ message: "Unauthorized - invalid secret token" });
      }
      
      // If user email is provided, get that user's organization
      if (userEmail) {
        const user = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);
        
        if (user.length === 0) {
          return res.status(404).json({ message: `User with email ${userEmail} not found` });
        }
        
        const userId = user[0].id;
        
        // Get user's organization - prefer currentOrgId, otherwise first membership
        if (user[0].currentOrgId) {
          const org = await db.select({ id: organizations.id, name: organizations.name })
            .from(organizations)
            .where(and(
              eq(organizations.id, user[0].currentOrgId),
              isNull(organizations.deletedAt)
            ))
            .limit(1);
          
          if (org.length > 0) {
            console.log(`[Orgs/Facebook] ✅ Returning user's current org: ${org[0].id} (from currentOrgId)`);
            return res.json({ orgId: org[0].id, name: org[0].name });
          }
        }
        
        // Fallback to first membership
        const membership = await db.select({
          orgId: memberships.orgId,
          orgName: organizations.name,
        })
        .from(memberships)
        .innerJoin(organizations, eq(memberships.orgId, organizations.id))
        .where(and(
          eq(memberships.userId, userId),
          isNull(organizations.deletedAt)
        ))
        .limit(1);
        
        if (membership.length > 0) {
          console.log(`[Orgs/Facebook] ✅ Returning user's org: ${membership[0].orgId} (from membership)`);
          return res.json({ orgId: membership[0].orgId, name: membership[0].orgName });
        }
        
        return res.status(404).json({ message: `User ${userEmail} has no organization` });
      }
      
      // If no user email provided, get first organization from database (fallback)
      const result = await db.select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(isNull(organizations.deletedAt))
        .limit(1);
      
      if (result.length === 0) {
        return res.status(404).json({ message: "No organizations found" });
      }
      
      console.log(`[Orgs/Facebook] ✅ Returning first org (fallback): ${result[0].id}`);
      res.json({ orgId: result[0].id, name: result[0].name });
    } catch (error: any) {
      console.error(`[Orgs/Facebook] ❌ Error:`, error);
      res.status(500).json({ message: "Failed to get organization", error: error.message });
    }
  });

  // Internal endpoint to check if a conversation exists and get its last message
  // Used by polling script to optimize processing
  app.post("/api/facebook-messages/check-conversation", async (req: any, res) => {
    try {
      const { secretToken, conversationId, orgId } = req.body;
      
      // Validate secret token
      const expectedToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
      if (secretToken !== expectedToken) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      if (!conversationId) {
        return res.status(400).json({ message: "conversationId is required" });
      }
      
      // Find lead with this conversation ID in metadata
      // If orgId is provided, filter by it; otherwise search across all orgs
      let leadsWithConversation;
      if (orgId) {
        leadsWithConversation = await db.execute(sql`
          SELECT id, metadata, org_id
          FROM leads
          WHERE org_id = ${orgId}
            AND metadata->>'facebookConversationId' = ${conversationId}
          LIMIT 1
        `);
      } else {
        // Search across all orgs (conversationId should be unique per org, but we search all to be safe)
        leadsWithConversation = await db.execute(sql`
          SELECT id, metadata, org_id
          FROM leads
          WHERE metadata->>'facebookConversationId' = ${conversationId}
          LIMIT 1
        `);
      }
      
      if (leadsWithConversation.rows.length === 0) {
        return res.json({ exists: false });
      }
      
      const leadId = leadsWithConversation.rows[0].id as string;
      
      // Get the last message (by timestamp) for this lead
      const lastMessage = await db.execute(sql`
        SELECT 
          id,
          message,
          created_at,
          type,
          channel
        FROM conversations
        WHERE lead_id = ${leadId}
          AND channel = 'facebook'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      
      if (lastMessage.rows.length === 0) {
        return res.json({ exists: true, hasMessages: false, leadId });
      }
      
      const msg = lastMessage.rows[0] as any;
      return res.json({
        exists: true,
        hasMessages: true,
        leadId,
        lastMessage: {
          content: msg.message,
          timestamp: msg.created_at,
          type: msg.type,
        },
      });
    } catch (error: any) {
      console.error(`[Facebook Messages] Error checking conversation:`, error);
      return res.status(500).json({ message: "Internal server error", error: error.message });
    }
  });

  // Internal endpoint to check if a specific message exists in the database
  app.post("/api/facebook-messages/check-message", async (req: any, res) => {
    try {
      const { secretToken, leadId, messageContent, timestamp } = req.body;
      
      // Validate secret token
      const expectedToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
      if (secretToken !== expectedToken) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      if (!leadId || !messageContent) {
        return res.status(400).json({ message: "leadId and messageContent are required" });
      }
      
      // Check if message exists by content and optionally by timestamp
      // Note: Timestamps are created when messages are saved to DB, not extracted from DOM
      // So if timestamp is missing or "unknown", we only check by message content
      const normalizedMessage = messageContent.trim().toLowerCase();
      
      // Validate timestamp - if it's missing, "unknown", or invalid, only check by message content
      let messageDate: Date | null = null;
      let isValidTimestamp = false;
      
      if (timestamp && timestamp !== 'unknown' && timestamp !== '' && typeof timestamp === 'string') {
        try {
          messageDate = new Date(timestamp);
          // Double-check: ensure the date is valid AND can be converted to ISO string
          if (!isNaN(messageDate.getTime())) {
            // Test if toISOString() works without throwing
            try {
              messageDate.toISOString();
              isValidTimestamp = true;
            } catch (isoError) {
              isValidTimestamp = false;
              messageDate = null;
            }
          } else {
            isValidTimestamp = false;
            messageDate = null;
          }
        } catch (error) {
          isValidTimestamp = false;
          messageDate = null;
        }
      }
      // If timestamp is not provided or is "unknown", isValidTimestamp remains false and we'll check by content only
      
      let existingMessage;
      if (isValidTimestamp && messageDate) {
        // Check by both content and timestamp
        try {
          const isoString = messageDate.toISOString();
          existingMessage = await db.execute(sql`
            SELECT id, message, created_at
            FROM conversations
            WHERE lead_id = ${leadId}
              AND channel = 'facebook'
              AND LOWER(TRIM(message)) = ${normalizedMessage}
              AND DATE_TRUNC('minute', created_at) = DATE_TRUNC('minute', ${isoString}::timestamp)
            LIMIT 1
          `);
        } catch (dateError) {
          // If toISOString() fails, fall back to content-only check
          console.log(`[Facebook Messages] Timestamp conversion failed, using content-only check: ${dateError}`);
          existingMessage = await db.execute(sql`
            SELECT id, message, created_at
            FROM conversations
            WHERE lead_id = ${leadId}
              AND channel = 'facebook'
              AND LOWER(TRIM(message)) = ${normalizedMessage}
            LIMIT 1
          `);
        }
      } else {
        // If timestamp is invalid or "unknown", only check by message content
        existingMessage = await db.execute(sql`
          SELECT id, message, created_at
          FROM conversations
          WHERE lead_id = ${leadId}
            AND channel = 'facebook'
            AND LOWER(TRIM(message)) = ${normalizedMessage}
          LIMIT 1
        `);
      }
      
      if (existingMessage.rows.length === 0) {
        return res.json({ exists: false });
      }
      
      return res.json({
        exists: true,
        messageId: existingMessage.rows[0].id,
      });
    } catch (error: any) {
      console.error(`[Facebook Messages] Error checking message:`, error);
      return res.status(500).json({ message: "Internal server error", error: error.message });
    }
  });

  // Internal endpoint for Facebook message polling: Process conversations from scraping
  // Accepts raw scraped data and handles all business logic (org lookup, lead creation, conversation storage)
  // Uses secret token instead of auth since it's called from an internal script
  app.post("/api/facebook-messages/process", async (req: any, res) => {
    try {
      console.log(`[Facebook Messages] 📥 Received request to process conversations`);
      const { secretToken, conversations: conversationData, orgId: providedOrgId } = req.body;
      
      // Validate secret token
      const expectedToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
      if (secretToken !== expectedToken) {
        console.error(`[Facebook Messages] ❌ Invalid secret token (received: ${secretToken ? 'provided' : 'missing'}, expected: ${expectedToken ? 'set' : 'default'})`);
        return res.status(401).json({ message: "Unauthorized - invalid secret token" });
      }
      
      console.log(`[Facebook Messages] ✅ Secret token validated`);
      
      if (!conversationData || !Array.isArray(conversationData)) {
        console.error(`[Facebook Messages] ❌ Invalid request: conversations array is required`);
        return res.status(400).json({ message: "conversations array is required" });
      }
      
      console.log(`[Facebook Messages] Processing ${conversationData.length} conversations`);
      if (providedOrgId) {
        console.log(`[Facebook Messages] 📌 Using provided orgId: ${providedOrgId}`);
      }
      
      const results = [];
      
      for (const conv of conversationData) {
        let { profileId, facebookEmail, messages, listingId, conversationName, conversationId, profileName } = conv;
        
        console.log(`[Facebook Messages] Processing conversation:`, {
          profileId: profileId || 'MISSING',
          conversationId: conversationId || 'MISSING',
          listingId: listingId || 'MISSING',
          profileName: profileName || 'MISSING',
          facebookEmail: facebookEmail || 'MISSING',
        });
        
        // facebookEmail is required, but profileId can be missing if conversationId exists
        if (!facebookEmail) {
          console.log(`[Facebook Messages] ⚠️  Skipping conversation - missing required field (facebookEmail: ${!!facebookEmail})`);
          continue;
        }
        
        // messages is optional - allow empty array
        const messageArray = messages || [];
        
        // Use provided orgId if available, otherwise look up from user's email
        let orgId: string | undefined = providedOrgId;
        
        if (!orgId) {
          // Fallback: Get organization from Facebook email (user's org)
          console.log(`[Facebook Messages] 🔍 No orgId provided, looking up from user email: ${facebookEmail}`);
        const user = await db.select().from(users).where(eq(users.email, facebookEmail)).limit(1);
        if (user.length === 0) {
          console.log(`[Facebook Messages] ⚠️  User ${facebookEmail} not found, skipping conversation`);
          continue;
        }
        
        const userId = user[0].id;
        
        // Get user's organization - prefer currentOrgId, otherwise first membership
        if (user[0].currentOrgId) {
          const org = await db.select({ id: organizations.id })
            .from(organizations)
            .where(and(eq(organizations.id, user[0].currentOrgId), isNull(organizations.deletedAt)))
            .limit(1);
          if (org.length > 0) {
            orgId = org[0].id;
          }
        }
        
        if (!orgId) {
          const membership = await db.select({ orgId: memberships.orgId })
            .from(memberships)
            .innerJoin(organizations, eq(memberships.orgId, organizations.id))
            .where(and(eq(memberships.userId, userId), isNull(organizations.deletedAt)))
            .limit(1);
          if (membership.length > 0) {
            orgId = membership[0].orgId;
          }
          }
        } else {
          // Validate that the provided orgId exists
          const org = await db.select({ id: organizations.id })
            .from(organizations)
            .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
            .limit(1);
          if (org.length === 0) {
            console.log(`[Facebook Messages] ⚠️  Provided orgId ${orgId} not found or deleted, skipping conversation`);
            continue;
          }
          console.log(`[Facebook Messages] ✅ Validated provided orgId: ${orgId}`);
        }
        
        if (!orgId) {
          console.log(`[Facebook Messages] ⚠️  Could not determine organization for ${facebookEmail}, skipping`);
          continue;
        }
        
        // Find lead: if profileId is missing but conversationId exists, find by conversationId
        let lead: any = null;
        if (!profileId && conversationId) {
          console.log(`[Facebook Messages] 🔍 No profileId provided, but conversationId exists. Looking up lead by conversationId: ${conversationId}`);
          const leadsWithConversation = await db.execute(sql`
            SELECT id, external_id, metadata, org_id
            FROM leads
            WHERE metadata->>'facebookConversationId' = ${conversationId}
              AND org_id = ${orgId}
            LIMIT 1
          `);
          
          if (leadsWithConversation.rows.length > 0) {
            const leadRow = leadsWithConversation.rows[0];
            const foundLeadId = leadRow.id as string;
            // Fetch the full lead object from storage
            lead = await storage.getLead(foundLeadId, orgId);
        if (lead) {
              // Extract profileId from the lead's externalId or metadata
              profileId = lead.externalId || (lead.metadata as any)?.facebookProfileId || null;
              console.log(`[Facebook Messages] ✅ Found existing lead by conversationId: ${lead.id}, profileId: ${profileId}`);
            } else {
              console.log(`[Facebook Messages] ⚠️  Lead ID ${foundLeadId} found but could not fetch full lead object`);
              continue;
            }
          } else {
            console.log(`[Facebook Messages] ⚠️  No lead found for conversationId ${conversationId} in org ${orgId}. Cannot save messages without profileId or existing lead.`);
            continue;
          }
        }
        
        // If we still don't have profileId and no lead was found, skip
        if (!profileId && !lead) {
          console.log(`[Facebook Messages] ⚠️  Skipping conversation - missing profileId and no existing lead found by conversationId`);
          continue;
        }
        
        // Find or create lead by profile ID (if we haven't found it already)
        if (!lead && profileId) {
          lead = await storage.getLeadByExternalId(profileId, orgId);
        }
        
        if (lead) {
          console.log(`[Facebook Messages] Found existing lead: ${lead.id} for profileId: ${profileId || 'N/A (found by conversationId)'}`);
          // Update lead metadata if listing ID or conversation ID is provided
            const metadata = (lead.metadata as any) || {};
          let metadataUpdated = false;
          let nameUpdated = false;
          let newName = lead.name;
          
          // Update name if we have a profileName and current name is a default
          if (profileName && (lead.name === `Facebook User ${profileId}` || lead.name?.startsWith('Facebook User'))) {
            newName = profileName;
            nameUpdated = true;
            console.log(`[Facebook Messages] Updating lead name from "${lead.name}" to "${profileName}"`);
          }
          
          // Look up property/unit from Facebook listing ID (for existing leads too)
          let propertyIdFromListing: string | undefined;
          let unitIdFromListing: string | undefined;
          
          if (listingId) {
            const unit = await storage.getUnitByFacebookListingId(listingId, orgId);
            if (unit) {
              propertyIdFromListing = unit.propertyId;
              unitIdFromListing = unit.id;
              console.log(`[Facebook Messages] 🔍 Mapped listing ID to property: ${unit.propertyId}, unit: ${unit.id}`);
            }
          }
          
          if (listingId && (!metadata.facebookListingId || metadata.facebookListingId !== listingId)) {
              metadata.facebookListingId = listingId;
              if (unitIdFromListing) {
                metadata.unitId = unitIdFromListing;
              }
            metadataUpdated = true;
            console.log(`[Facebook Messages] Updating listingId: ${listingId}`);
            
            // Automatically import/create listing for this Facebook listing ID if it doesn't exist
            try {
              const existingListings = await storage.getAllListings(orgId);
              const listingExists = existingListings.some(l => l.facebookListingId === listingId);
              
              if (!listingExists) {
                console.log(`[Facebook Messages] Auto-importing listing for Facebook listing ID: ${listingId}`);
                // Get or create "Facebook Imported Listings" property
                const allProperties = await storage.getAllProperties(orgId);
                let facebookProperty = allProperties.find(p => p.name === "Facebook Imported Listings");
                
                if (!facebookProperty) {
                  facebookProperty = await storage.createProperty({
                    orgId: orgId,
                    name: "Facebook Imported Listings",
                    address: "Imported from Facebook Marketplace",
                    description: "Listings imported from Facebook Marketplace that were not created in Lead2Lease",
                    units: 1,
                    occupancy: 0,
                    monthlyRevenue: "0",
                  });
                }
                
                // Create placeholder unit
                const unit = await storage.createPropertyUnit({
                  propertyId: facebookProperty.id,
                  orgId: orgId,
                  unitNumber: `FB-${listingId}`,
                  bedrooms: 0,
                  bathrooms: "0",
                  monthlyRent: undefined,
                  deposit: undefined,
                  squareFeet: undefined,
                  isListed: true,
                  status: 'not_occupied',
                  bookingEnabled: false,
                });
                
                // Create listing
                await storage.createListing({
                  orgId: orgId,
                  propertyId: facebookProperty.id,
                  unitId: unit.id,
                  title: `Facebook Listing ${listingId}`,
                  description: "This listing was imported from Facebook Marketplace. It was not created in Lead2Lease.",
                  status: 'active',
                  preQualifyEnabled: false,
                  acceptBookings: false,
                  facebookListingId: listingId,
                  facebookListedAt: new Date(),
                });
                
                console.log(`[Facebook Messages] ✅ Auto-imported listing for Facebook listing ID: ${listingId}`);
              }
            } catch (importError: any) {
              console.error(`[Facebook Messages] ⚠️ Failed to auto-import listing for ${listingId}:`, importError.message);
              // Don't fail the entire message processing if listing import fails
            }
          }
          
          if (conversationId && (!metadata.facebookConversationId || metadata.facebookConversationId !== conversationId)) {
            metadata.facebookConversationId = conversationId;
            metadataUpdated = true;
            console.log(`[Facebook Messages] Updating conversationId: ${conversationId}`);
          }
          
          if (profileName && (!metadata.facebookProfileName || metadata.facebookProfileName !== profileName)) {
            metadata.facebookProfileName = profileName;
            metadataUpdated = true;
            console.log(`[Facebook Messages] Updating profileName: ${profileName}`);
          }
          
          // Set propertyId if we found it from listing and lead doesn't have one
          let propertyIdUpdated = false;
          if (propertyIdFromListing && !lead.propertyId) {
            propertyIdUpdated = true;
            console.log(`[Facebook Messages] Setting propertyId from listing: ${propertyIdFromListing}`);
          }
          
          if (metadataUpdated || nameUpdated || propertyIdUpdated) {
            try {
              const updateData: any = { metadata };
              if (nameUpdated) {
                updateData.name = newName;
              }
              if (propertyIdUpdated) {
                updateData.propertyId = propertyIdFromListing;
              }
              lead = await storage.updateLead(lead.id, updateData, orgId) || lead;
              console.log(`[Facebook Messages] ✅ Updated lead metadata:`, metadata);
              // Verify the update was saved
              const verifyLead = await storage.getLead(lead.id, orgId);
              if (verifyLead) {
                console.log(`[Facebook Messages] ✅ Verified lead metadata updated in database:`, verifyLead.metadata);
        } else {
                console.error(`[Facebook Messages] ❌ WARNING: Lead update may have failed - lead not found!`);
              }
            } catch (updateError: any) {
              console.error(`[Facebook Messages] ❌ Error updating lead:`, updateError);
              console.error(`[Facebook Messages] ❌ Update error details:`, {
                message: updateError.message,
                stack: updateError.stack,
                leadId: lead.id,
                metadata: metadata,
              });
              throw updateError;
            }
          } else {
            console.log(`[Facebook Messages] No metadata updates needed for lead: ${lead.id}`);
          }
        } else {
          // Create new lead - use profileName if available, otherwise fallback to conversationName or default
          const leadName = profileName || conversationName || `Facebook User ${profileId}`;
          
          // Look up property/unit from Facebook listing ID
          let propertyIdFromListing: string | undefined;
          let unitIdFromListing: string | undefined;
          
          if (listingId) {
            const unit = await storage.getUnitByFacebookListingId(listingId, orgId);
            if (unit) {
              propertyIdFromListing = unit.propertyId;
              unitIdFromListing = unit.id;
              console.log(`[Facebook Messages] 🔍 Mapped listing ID to property: ${unit.propertyId}, unit: ${unit.id}`);
            } else {
              console.log(`[Facebook Messages] ⚠️  No unit found for Facebook listing ID: ${listingId}`);
            }
          }
          
          const leadData: any = {
            name: leadName,
            email: null,
            phone: null,
            source: 'facebook',
            externalId: profileId,
            orgId,
            propertyId: propertyIdFromListing || null,  // Set propertyId from listing if found
            metadata: {
              facebookProfileId: profileId,
              ...(listingId && { facebookListingId: listingId }),
              ...(conversationId && { facebookConversationId: conversationId }),
              ...(profileName && { facebookProfileName: profileName }),
              ...(unitIdFromListing && { unitId: unitIdFromListing }),
            },
          };
          console.log(`[Facebook Messages] Creating new lead with data:`, {
            name: leadData.name,
            externalId: leadData.externalId,
            source: leadData.source,
            orgId: leadData.orgId,
            propertyId: leadData.propertyId,
            metadata: leadData.metadata,
          });
          try {
          lead = await storage.createLead(leadData);
            console.log(`[Facebook Messages] ✅ Created new lead: ${lead.id} with name: "${leadData.name}", propertyId: ${propertyIdFromListing || 'none'}`);
            // Verify the lead was actually created
            const verifyLead = await storage.getLeadByExternalId(profileId, orgId);
            if (verifyLead) {
              console.log(`[Facebook Messages] ✅ Verified lead exists in database: ${verifyLead.id}, metadata:`, verifyLead.metadata);
            } else {
              console.error(`[Facebook Messages] ❌ WARNING: Lead was created but cannot be found in database!`);
            }
            
            // Automatically import/create listing for this Facebook listing ID if it doesn't exist
            if (listingId) {
              try {
                const existingListings = await storage.getAllListings(orgId);
                const listingExists = existingListings.some(l => l.facebookListingId === listingId);
                
                if (!listingExists) {
                  console.log(`[Facebook Messages] Auto-importing listing for Facebook listing ID: ${listingId}`);
                  // Get or create "Facebook Imported Listings" property
                  const allProperties = await storage.getAllProperties(orgId);
                  let facebookProperty = allProperties.find(p => p.name === "Facebook Imported Listings");
                  
                  if (!facebookProperty) {
                    facebookProperty = await storage.createProperty({
                      orgId: orgId,
                      name: "Facebook Imported Listings",
                      address: "Imported from Facebook Marketplace",
                      description: "Listings imported from Facebook Marketplace that were not created in Lead2Lease",
                      units: 1,
                      occupancy: 0,
                      monthlyRevenue: "0",
                    });
                  }
                  
                  // Create placeholder unit
                  const unit = await storage.createPropertyUnit({
                    propertyId: facebookProperty.id,
                    orgId: orgId,
                    unitNumber: `FB-${listingId}`,
                    bedrooms: 0,
                    bathrooms: "0",
                    monthlyRent: undefined,
                    deposit: undefined,
                    squareFeet: undefined,
                    isListed: true,
                    status: 'not_occupied',
                    bookingEnabled: false,
                  });
                  
                  // Create listing
                  await storage.createListing({
                    orgId: orgId,
                    propertyId: facebookProperty.id,
                    unitId: unit.id,
                    title: `Facebook Listing ${listingId}`,
                    description: "This listing was imported from Facebook Marketplace. It was not created in Lead2Lease.",
                    status: 'active',
                    preQualifyEnabled: false,
                    acceptBookings: false,
                    facebookListingId: listingId,
                    facebookListedAt: new Date(),
                  });
                  
                  console.log(`[Facebook Messages] ✅ Auto-imported listing for Facebook listing ID: ${listingId}`);
                }
              } catch (importError: any) {
                console.error(`[Facebook Messages] ⚠️ Failed to auto-import listing for ${listingId}:`, importError.message);
                // Don't fail the entire message processing if listing import fails
              }
            }
          } catch (createError: any) {
            console.error(`[Facebook Messages] ❌ Error creating lead:`, createError);
            console.error(`[Facebook Messages] ❌ Error details:`, {
              message: createError.message,
              stack: createError.stack,
              leadData: leadData,
            });
            throw createError;
          }
        }
        
        // Store each message as a conversation (if messages provided)
        // Messages can be strings (legacy) or objects with {messageId, text, timestamp, from}
        // DEDUPLICATION: Check for duplicates by conversationId + message content + message position
        let storedCount = 0;
        let skippedCount = 0;
        console.log(`[Facebook Messages] 📝 Processing ${messageArray.length} messages for lead ${lead.id}`);
        
        // Get the conversationId from lead metadata for position-based deduplication
        // Note: conversationId should be set in lead metadata by now (either from creation or update above)
        const leadConversationId = (lead.metadata as any)?.facebookConversationId || conversationId;
        console.log(`[Facebook Messages] 📌 Using conversationId for deduplication: ${leadConversationId} (from lead metadata: ${(lead.metadata as any)?.facebookConversationId || 'none'}, from request: ${conversationId || 'none'})`);
        
        // Get count of existing messages for this conversation to determine starting position
        let existingMessageCount = 0;
        if (leadConversationId) {
          const countResult = await db.execute(sql`
            SELECT COUNT(*) as count
            FROM conversations c
            INNER JOIN leads l ON c.lead_id = l.id
            WHERE l.metadata->>'facebookConversationId' = ${leadConversationId}
              AND c.channel = 'facebook'
          `);
          const countValue = (countResult.rows[0] as any)?.count;
          existingMessageCount = parseInt(String(countValue || '0'), 10);
          console.log(`[Facebook Messages] 📊 Conversation ${leadConversationId} has ${existingMessageCount} existing messages`);
        } else {
          console.log(`[Facebook Messages] ⚠️  No conversationId available for deduplication (lead metadata: ${JSON.stringify(lead.metadata)}, request conversationId: ${conversationId})`);
        }
        
        for (let msgIndex = 0; msgIndex < messageArray.length; msgIndex++) {
          const msg = messageArray[msgIndex];
          // Handle both string format (legacy) and object format (new)
          let messageText: string;
          let messageTimestamp: string | undefined;
          let messageFrom: 'lead' | 'me' | undefined;
          let messageId: string | undefined;
          
          if (typeof msg === 'string') {
            // Legacy format: just a string
            messageText = msg.trim();
            messageFrom = undefined; // Unknown for legacy format
          } else if (msg && typeof msg === 'object' && msg.text) {
            // New format: object with text, timestamp, from, messageId
            messageText = msg.text.trim();
            messageTimestamp = msg.timestamp;
            messageFrom = msg.from; // Should be 'lead' or 'me'
            messageId = msg.messageId;
          } else {
            console.log(`[Facebook Messages] ⚠️  Skipping message ${msgIndex + 1}/${messageArray.length}: invalid message format`, { msg, msgType: typeof msg });
            continue; // Skip invalid messages
          }
          
          if (!messageText) {
            console.log(`[Facebook Messages] ⚠️  Skipping message ${msgIndex + 1}/${messageArray.length}: empty message text`);
            continue;
          }
          
          // Validate messageFrom - if not set, try to infer from messageId or default to 'lead'
          if (!messageFrom) {
            console.log(`[Facebook Messages] ⚠️  Message ${msgIndex + 1}/${messageArray.length} has no 'from' field, defaulting to 'lead'`);
            messageFrom = 'lead'; // Default to 'lead' if not specified
          }
          
          // Ensure messageFrom is either 'lead' or 'me'
          if (messageFrom !== 'lead' && messageFrom !== 'me') {
            console.log(`[Facebook Messages] ⚠️  Message ${msgIndex + 1}/${messageArray.length} has invalid 'from' value: "${messageFrom}", defaulting to 'lead'`);
            messageFrom = 'lead';
          }
          
          // Use messageId if provided, otherwise generate one
          const externalId = messageId || `${profileId}-${Date.now()}-${Math.random()}`;
          
          // DEDUPLICATION CHECK 1: Check for existing conversation by externalId (messageId) - SCOPED TO CURRENT LEAD
          // For Facebook messages, we should only check for duplicates within the same lead/conversation
          // The same messageId can exist in different conversations (e.g., "Hi, is this available?" is common)
          const existingConversationById = await db.execute(sql`
            SELECT id, created_at, type, lead_id, external_id
            FROM conversations
            WHERE external_id = ${externalId}
              AND lead_id = ${lead.id}
              AND channel = 'facebook'
            LIMIT 1
          `);
          
          if (existingConversationById.rows.length > 0) {
            skippedCount++;
            continue;
          }
          
          // DEDUPLICATION CHECK 2: Check for duplicate by conversationId + message content + message position
          // For Facebook messages, duplicates should only be checked within the same conversation
          // Messages can have the same content if they're at different positions (e.g., position 1 and position 3)
          // But messages at the same position cannot have the same content (they're duplicates)
          const normalizedMessage = messageText.trim().toLowerCase();
          
          // Calculate the position this message will be at in the conversation
          // Position = existing messages + messages already stored in this batch + 1
          const messagePosition = existingMessageCount + storedCount + 1;
          
          if (leadConversationId) {
            // Check if a message with the same content exists at the same position in the same conversation
            // We need to find all messages with the same content and check their positions
            const messagesWithSameContent = await db.execute(sql`
              SELECT 
                c.id,
                c.created_at,
                c.type,
                c.external_id
              FROM conversations c
              INNER JOIN leads l ON c.lead_id = l.id
              WHERE l.metadata->>'facebookConversationId' = ${leadConversationId}
                AND c.channel = 'facebook'
                AND LOWER(TRIM(c.message)) = ${normalizedMessage}
              ORDER BY c.created_at ASC
            `);
            
            if (messagesWithSameContent.rows.length > 0) {
              // Check the position of each existing message with the same content
              let isDuplicate = false;
              for (const existing of messagesWithSameContent.rows) {
                // Get the position of this existing message in the conversation
                const existingCreatedAt = existing.created_at as Date;
                const positionResult = await db.execute(sql`
                  SELECT COUNT(*) as count
                  FROM conversations c2
                  INNER JOIN leads l2 ON c2.lead_id = l2.id
                  WHERE l2.metadata->>'facebookConversationId' = ${leadConversationId}
                    AND c2.channel = 'facebook'
                    AND c2.created_at < ${existingCreatedAt.toISOString()}::timestamp
                `);
                
                const positionValue = (positionResult.rows[0] as any)?.count;
                const existingPosition = parseInt(String(positionValue || '0'), 10) + 1;
                
                // If same content at same position, it's a duplicate
                // BUT: For new conversations (existingMessageCount = 0), we should be more lenient
                // Only flag as duplicate if the existing message was created more than 1 second ago
                // This prevents false positives from messages stored in the same batch
                const timeDiff = existingCreatedAt ? (Date.now() - new Date(existingCreatedAt).getTime()) : Infinity;
                const isRecentMessage = timeDiff < 1000; // Less than 1 second old
                
                if (existingPosition === messagePosition) {
                  if (!isRecentMessage || existingMessageCount > 0) {
                    // This is a duplicate (not recent or conversation has existing messages)
                    skippedCount++;
                    isDuplicate = true;
                    break; // Found a duplicate, no need to check other messages
                  }
                  // If recent and new conversation, treat as valid (not duplicate)
                }
              }
              
              if (isDuplicate) {
                continue; // Skip to next message in the outer loop
              }
            }
          }
          
          // Determine type based on 'from' field: 'lead' = 'received', 'me' = 'outgoing'
          const conversationType = messageFrom === 'me' ? 'outgoing' : 'received';
          
          const conversationData: any = {
            leadId: lead.id,
            type: conversationType,
            channel: 'facebook',
            message: messageText,
            sourceIntegration: 'facebook',
            externalId,
          };
          
          // If we have a valid timestamp, we could set createdAt, but the database will use defaultNow()
          // The deduplication check above uses the timestamp for matching, not for storage
          
          try {
          const validatedData = insertConversationSchema.parse(conversationData);
          await storage.createConversation(validatedData);
          storedCount++;
          } catch (storageError: any) {
            console.error(`[Facebook Messages] ❌ Error storing message ${msgIndex + 1}/${messageArray.length}: ${storageError?.message || storageError}`);
            skippedCount++;
            // Continue to next message instead of throwing
            continue;
          }
        }
        
        console.log(`[Facebook Messages] 📊 Message processing summary for lead ${lead.id}:`);
        console.log(`[Facebook Messages]    Total messages in request: ${messageArray.length}`);
        console.log(`[Facebook Messages]    Messages stored: ${storedCount}`);
        console.log(`[Facebook Messages]    Messages skipped: ${skippedCount}`);
        console.log(`[Facebook Messages]    Expected total: ${storedCount + skippedCount} (should equal ${messageArray.length})`);
        
        if (skippedCount > 0) {
          console.log(`[Facebook Messages] ⚠️  Skipped ${skippedCount} duplicate messages`);
        }
        
        if (storedCount + skippedCount !== messageArray.length) {
          console.error(`[Facebook Messages] ❌ MISMATCH: stored (${storedCount}) + skipped (${skippedCount}) = ${storedCount + skippedCount}, but total messages = ${messageArray.length}`);
          console.error(`[Facebook Messages]    This indicates ${messageArray.length - (storedCount + skippedCount)} messages were not processed (possibly due to errors)`);
        }
        
        results.push({
          profileId,
          conversationId: conversationId || null,
          listingId: listingId || null,
          leadId: lead.id,
          messagesStored: storedCount,
        });
        
        console.log(`[Facebook Messages] ✅ Successfully processed conversation:`, {
          profileId,
          conversationId: conversationId || null,
          listingId: listingId || null,
          leadId: lead.id,
        });
      }
      
      console.log(`[Facebook Messages] ✅ Processed ${results.length} conversations`);
      console.log(`[Facebook Messages] Results summary:`, {
        totalProcessed: results.length,
        leadsCreated: results.filter(r => r.leadId).length,
        withProfileId: results.filter(r => r.profileId).length,
        withListingId: results.filter(r => r.listingId).length,
        withConversationId: results.filter(r => r.conversationId).length,
      });
      res.json({ processed: results.length, results });
    } catch (error: any) {
      console.error(`[Facebook Messages] ❌ Error:`, error);
      console.error(`[Facebook Messages] ❌ Error stack:`, error.stack);
      res.status(500).json({ message: "Failed to process messages", error: error.message });
    }
  });

  // Internal endpoint to get pending Facebook messages that need to be sent
  // Uses secret token instead of auth since it's called from an internal script
  app.get("/api/facebook-messages/pending", async (req: any, res) => {
    try {
      const secretToken = req.headers['x-secret-token'] || req.query.secretToken;
      const expectedToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
      
      if (secretToken !== expectedToken) {
        return res.status(401).json({ message: "Unauthorized - invalid secret token" });
      }
      
      // Get all outgoing Facebook messages that are pending (delivery_status = 'pending')
      // These are messages created in Lead2Lease that need to be sent via Facebook
      // Only get messages with delivery_status = 'pending' (not NULL, not 'sent', not 'failed')
      const result = await db.execute(sql`
        SELECT 
          c.id as conversation_id,
          c.lead_id,
          c.message,
          c.created_at,
          l.metadata->>'facebookConversationId' as conversation_id_from_metadata,
          l.metadata->>'facebookProfileId' as profile_id,
          l.name as lead_name
        FROM conversations c
        INNER JOIN leads l ON c.lead_id = l.id
        WHERE c.channel = 'facebook'
          AND c.type = 'outgoing'
          AND c.delivery_status = 'pending'
        ORDER BY c.created_at ASC
        LIMIT 50
      `);
      
      const messages = result.rows.map((row: any) => {
        // Build conversation URL from conversation ID
        const conversationId = row.conversation_id_from_metadata;
        const conversationUrl = conversationId 
          ? `https://www.facebook.com/messages/t/${conversationId}/`
          : null;
        
        return {
          conversationId: row.conversation_id,
          leadId: row.lead_id,
          leadName: row.lead_name,
          message: row.message,
          conversationUrl,
          createdAt: row.created_at,
        };
      });
      
      console.log(`[Facebook Messages Pending] Found ${messages.length} pending messages to send`);
      res.json({ messages });
    } catch (error: any) {
      console.error(`[Facebook Messages Pending] Error:`, error);
      res.status(500).json({ message: "Failed to fetch pending messages", error: error.message });
    }
  });

  // Internal endpoint to mark a Facebook message as sent
  // Uses secret token instead of auth since it's called from an internal script
  app.post("/api/facebook-messages/mark-sent", async (req: any, res) => {
    try {
      const secretToken = req.headers['x-secret-token'] || req.body.secretToken;
      const expectedToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
      
      if (secretToken !== expectedToken) {
        return res.status(401).json({ message: "Unauthorized - invalid secret token" });
      }
      
      const { conversationId, leadId } = req.body;
      
      if (!conversationId) {
        return res.status(400).json({ message: "conversationId is required" });
      }
      
      // Update the conversation to mark it as sent
      await db
        .update(conversations)
        .set({
          deliveryStatus: 'sent',
          deliveryError: null,
        })
        .where(eq(conversations.id, conversationId));
      
      console.log(`[Facebook Messages Mark Sent] ✅ Marked conversation ${conversationId} as sent`);
      res.json({ success: true, conversationId });
    } catch (error: any) {
      console.error(`[Facebook Messages Mark Sent] Error:`, error);
      res.status(500).json({ message: "Failed to mark message as sent", error: error.message });
    }
  });

  // Internal endpoint for Facebook message polling: Create conversation
  // Uses secret token instead of auth since it's called from an internal script
  app.post("/api/conversations/for-facebook", async (req: any, res) => {
    try {
      const { leadId, orgId, secretToken, type, message, externalId } = req.body;
      
      console.log(`[Conversations/Facebook] Processing request for leadId: ${leadId}, type: ${type}`);
      
      // Validate secret token
      const expectedToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
      if (secretToken !== expectedToken) {
        console.error(`[Conversations/Facebook] ❌ Invalid secret token`);
        return res.status(401).json({ message: "Unauthorized - invalid secret token" });
      }
      
      if (!leadId || !orgId || !message) {
        console.error(`[Conversations/Facebook] ❌ Missing required fields - leadId: ${!!leadId}, orgId: ${!!orgId}, message: ${!!message}`);
        return res.status(400).json({ message: "leadId, orgId, and message are required" });
      }
      
      // Verify lead exists and belongs to org
      const lead = await storage.getLead(leadId, orgId);
      if (!lead) {
        console.error(`[Conversations/Facebook] ❌ Lead not found: ${leadId}`);
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Check if conversation with this externalId already exists (deduplication)
      if (externalId) {
        const existingConversation = await storage.getConversationByExternalId(externalId);
        if (existingConversation) {
          console.log(`[Conversations/Facebook] ⚠️  Conversation with externalId ${externalId} already exists: ${existingConversation.id}`);
          return res.json(existingConversation);
        }
      }
      
      // Create conversation - use schema validation directly
      const conversationData: any = {
        leadId,
        type: type || 'received',
        channel: 'facebook',
        message: message.trim(),
        sourceIntegration: 'facebook',
        ...(externalId && { externalId }),
      };
      
      // Validate with schema
      const validatedData = insertConversationSchema.parse(conversationData);
      
      const conversation = await storage.createConversation(validatedData);
      console.log(`[Conversations/Facebook] ✅ Created conversation: ${conversation.id}`);
      
      res.status(201).json(conversation);
    } catch (error: any) {
      console.error(`[Conversations/Facebook] ❌ Error:`, error);
      res.status(500).json({ message: "Failed to create conversation", error: error.message });
    }
  });

  // Update a listing
  app.patch("/api/listings/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get the current listing to check for status changes
      const currentListing = await storage.getListing(id, req.orgId);
      if (!currentListing) {
        return res.status(404).json({ message: "Listing not found" });
      }
      
      const listing = await storage.updateListing(id, req.body, req.orgId);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }
      
      // CRITICAL: Sync acceptBookings with unit bookingEnabled - they must stay in sync
      if ('acceptBookings' in req.body && req.body.acceptBookings !== currentListing.acceptBookings) {
        try {
          // Update the specific unit's bookingEnabled to match acceptBookings
          await storage.updatePropertyUnit(listing.unitId, {
            bookingEnabled: req.body.acceptBookings,
          }, req.orgId);
          console.log(`[Listings] Synced unit ${listing.unitId} bookingEnabled to ${req.body.acceptBookings} due to listing ${id} acceptBookings change`);
          
          // If turning OFF, also disable booking for all other units in this property
          if (req.body.acceptBookings === false) {
            const propertyUnits = await storage.getAllUnitsByProperty(listing.propertyId, req.orgId);
            
            // Disable booking for all other units that have booking enabled
            for (const unit of propertyUnits) {
              if (unit.id !== listing.unitId && unit.bookingEnabled) {
                await storage.updatePropertyUnit(unit.id, {
                  bookingEnabled: false,
                }, req.orgId);
                console.log(`[Listings] Auto-disabled booking for unit ${unit.id} (${unit.unitNumber}) due to listing ${id} having acceptBookings turned off`);
              }
            }
          }
        } catch (syncError: any) {
          console.error("[Listings] Warning: Failed to sync booking for unit:", syncError);
        }
      }
      
      // Sync booking status with listing status - they must both be on or both be off
      // Only sync if this booking type was created from this listing
      if (req.body.status && req.body.status !== currentListing.status) {
        try {
          const unit = await storage.getPropertyUnit(listing.unitId, req.orgId);
          
          if (unit) {
            // If this unit's booking was created from this listing, sync them
            if (unit.createdFromListingId === listing.id) {
              if (req.body.status === 'inactive' || req.body.status === 'paused') {
                // Disable booking when listing becomes inactive
                await storage.updatePropertyUnit(listing.unitId, {
                  bookingEnabled: false,
                }, req.orgId);
                console.log(`[Listings] Auto-disabled booking for unit ${listing.unitId} due to listing ${id} becoming ${req.body.status}`);
              } else if (req.body.status === 'active') {
                // Re-enable booking when listing becomes active
                // Also ensure property-level booking settings exist if not already created
                let propertySettings = await storage.getPropertySchedulingSettings(listing.propertyId, req.orgId);
                if (!propertySettings) {
                  const property = await storage.getProperty(listing.propertyId, req.orgId);
                  propertySettings = await storage.createPropertySchedulingSettings({
                    orgId: req.orgId,
                    propertyId: listing.propertyId,
                    eventName: `${property?.name || 'Property'} Showing`,
                    bookingMode: "one_to_one",
                    eventDuration: 30,
                    bufferTime: 15,
                    leadTime: 120,
                    assignedMembers: [],
                    bookingEnabled: true,
                  });
                  console.log(`[Listings] Auto-created property scheduling settings for property ${listing.propertyId} when activating listing`);
                }
                
                await storage.updatePropertyUnit(listing.unitId, {
                  bookingEnabled: true,
                  bookingTypeDeleted: false, // Clear any previous deletion flag
                }, req.orgId);
                console.log(`[Listings] Auto-enabled booking for unit ${listing.unitId} due to listing ${id} becoming active`);
              }
            } else if (req.body.status === 'active' && !unit.createdFromListingId) {
              // If listing is being activated and unit doesn't have createdFromListingId set,
              // link the unit to this listing and enable booking
              // Ensure property-level booking settings exist
              let propertySettings = await storage.getPropertySchedulingSettings(listing.propertyId, req.orgId);
              if (!propertySettings) {
                const property = await storage.getProperty(listing.propertyId, req.orgId);
                propertySettings = await storage.createPropertySchedulingSettings({
                  orgId: req.orgId,
                  propertyId: listing.propertyId,
                  eventName: `${property?.name || 'Property'} Showing`,
                  bookingMode: "one_to_one",
                  eventDuration: 30,
                  bufferTime: 15,
                  leadTime: 120,
                  assignedMembers: [],
                  bookingEnabled: true,
                });
                console.log(`[Listings] Auto-created property scheduling settings for property ${listing.propertyId}`);
              }
              
              // Enable booking and link it to this listing
              await storage.updatePropertyUnit(listing.unitId, {
                bookingEnabled: true,
                isListed: true,
                bookingTypeDeleted: false,
                createdFromListingId: listing.id,
              }, req.orgId);
              console.log(`[Listings] Auto-enabled booking for unit ${listing.unitId} and linked to listing ${listing.id}`);
            }
          }
        } catch (syncError: any) {
          console.error("[Listings] Warning: Failed to sync booking status:", syncError);
        }
      }
      
      res.json(listing);
    } catch (error: any) {
      console.error("[Listings] Error updating listing:", error);
      res.status(500).json({ message: "Failed to update listing", error: error.message });
    }
  });

  // Delete a listing
  app.delete("/api/listings/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteListing(id, req.orgId);
      if (!deleted) {
        return res.status(404).json({ message: "Listing not found" });
      }
      res.json({ message: "Listing deleted successfully" });
    } catch (error: any) {
      console.error("[Listings] Error deleting listing:", error);
      res.status(500).json({ message: "Failed to delete listing", error: error.message });
    }
  });

  // ===== QUALIFICATION TEMPLATES ROUTES =====
  // Get all qualification templates for the organization
  app.get("/api/qualification-templates", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const templates = await storage.getQualificationTemplates(req.orgId);
      res.json(templates);
    } catch (error: any) {
      console.error("[Qualification] Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch qualification templates", error: error.message });
    }
  });

  // Get organization-level qualification template
  app.get("/api/qualification-templates/org", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const template = await storage.getOrgQualificationTemplate(req.orgId);
      res.json(template || null);
    } catch (error: any) {
      console.error("[Qualification] Error fetching org template:", error);
      res.status(500).json({ message: "Failed to fetch organization qualification template", error: error.message });
    }
  });

  // Get property-level qualification template
  app.get("/api/properties/:propertyId/qualification-template", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      const template = await storage.getPropertyQualificationTemplate(propertyId, req.orgId);
      res.json(template || null);
    } catch (error: any) {
      console.error("[Qualification] Error fetching property template:", error);
      res.status(500).json({ message: "Failed to fetch property qualification template", error: error.message });
    }
  });

  // Get listing-level qualification template
  app.get("/api/listings/:listingId/qualification-template", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { listingId } = req.params;
      const template = await storage.getListingQualificationTemplate(listingId, req.orgId);
      res.json(template || null);
    } catch (error: any) {
      console.error("[Qualification] Error fetching listing template:", error);
      res.status(500).json({ message: "Failed to fetch listing qualification template", error: error.message });
    }
  });

  // Get effective qualification template for a unit (follows inheritance chain)
  app.get("/api/units/:unitId/effective-qualification-template", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { unitId } = req.params;
      const template = await storage.getEffectiveQualificationTemplate(unitId, req.orgId);
      res.json(template || null);
    } catch (error: any) {
      console.error("[Qualification] Error fetching effective template:", error);
      res.status(500).json({ message: "Failed to fetch effective qualification template", error: error.message });
    }
  });

  // Create a qualification template
  app.post("/api/qualification-templates", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validationResult = insertQualificationTemplateSchema.safeParse({
        ...req.body,
        orgId: req.orgId,
      });
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid template data",
          errors: validationResult.error.errors 
        });
      }

      const template = await storage.createQualificationTemplate(validationResult.data);
      res.status(201).json(template);
    } catch (error: any) {
      console.error("[Qualification] Error creating template:", error);
      res.status(500).json({ message: "Failed to create qualification template", error: error.message });
    }
  });

  // Update a qualification template
  app.patch("/api/qualification-templates/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { id } = req.params;
      const template = await storage.updateQualificationTemplate(id, req.body, req.orgId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error("[Qualification] Error updating template:", error);
      res.status(500).json({ message: "Failed to update qualification template", error: error.message });
    }
  });

  // Delete a qualification template
  app.delete("/api/qualification-templates/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteQualificationTemplate(id, req.orgId);
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ message: "Template deleted successfully" });
    } catch (error: any) {
      console.error("[Qualification] Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete qualification template", error: error.message });
    }
  });

  // ===== QUALIFICATION SETTINGS ROUTES (Criteria/Standards) =====
  // Get organization-level qualification settings
  app.get("/api/qualification-settings/org", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const settings = await storage.getOrgQualificationSettings(req.orgId);
      res.json(settings || null);
    } catch (error: any) {
      console.error("[Qualification Settings] Error fetching org settings:", error);
      res.status(500).json({ message: "Failed to fetch organization qualification settings", error: error.message });
    }
  });

  // Save organization-level qualification settings
  app.post("/api/qualification-settings/org", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { qualifications } = req.body;
      if (!Array.isArray(qualifications)) {
        return res.status(400).json({ message: "qualifications must be an array" });
      }
      const settings = await storage.upsertOrgQualificationSettings(req.orgId, {
        orgId: req.orgId,
        propertyId: null,
        qualifications,
      });
      res.json(settings);
    } catch (error: any) {
      console.error("[Qualification Settings] Error saving org settings:", error);
      res.status(500).json({ message: "Failed to save organization qualification settings", error: error.message });
    }
  });

  // Get all property-level qualification settings
  app.get("/api/qualification-settings/properties", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const settings = await storage.getAllPropertyQualificationSettings(req.orgId);
      res.json(settings);
    } catch (error: any) {
      console.error("[Qualification Settings] Error fetching property settings:", error);
      res.status(500).json({ message: "Failed to fetch property qualification settings", error: error.message });
    }
  });

  // Save property-level qualification settings
  app.post("/api/qualification-settings/property/:propertyId", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      const { qualifications } = req.body;
      if (!Array.isArray(qualifications)) {
        return res.status(400).json({ message: "qualifications must be an array" });
      }
      
      // Verify property belongs to org
      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      const settings = await storage.upsertPropertyQualificationSettings(propertyId, req.orgId, {
        orgId: req.orgId,
        propertyId,
        qualifications,
      });
      res.json(settings);
    } catch (error: any) {
      console.error("[Qualification Settings] Error saving property settings:", error);
      res.status(500).json({ message: "Failed to save property qualification settings", error: error.message });
    }
  });

  // Delete property-level qualification settings (removes override)
  app.delete("/api/qualification-settings/property/:propertyId", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      
      // Verify property belongs to org
      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      const deleted = await storage.deletePropertyQualificationSettings(propertyId, req.orgId);
      if (!deleted) {
        return res.status(404).json({ message: "Property qualification settings not found" });
      }
      res.json({ message: "Property qualification override removed successfully" });
    } catch (error: any) {
      console.error("[Qualification Settings] Error deleting property settings:", error);
      res.status(500).json({ message: "Failed to delete property qualification settings", error: error.message });
    }
  });

  // ===== LEAD QUALIFICATION ROUTES (Admin) =====
  // Get qualification history for a lead
  app.get("/api/leads/:leadId/qualifications", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { leadId } = req.params;
      const qualifications = await storage.getLeadQualificationHistory(leadId, req.orgId);
      res.json(qualifications);
    } catch (error: any) {
      console.error("[Qualification] Error fetching lead qualifications:", error);
      res.status(500).json({ message: "Failed to fetch lead qualifications", error: error.message });
    }
  });

  // ===== PUBLIC PRE-QUALIFICATION ROUTES =====
  // Get pre-qualification requirements for a unit (public - no auth required)
  app.get("/api/public/units/:unitId/qualification", async (req, res) => {
    try {
      const { unitId } = req.params;

      // Get unit with property to determine org
      const unitWithProperty = await storage.getPropertyUnitPublic(unitId);
      if (!unitWithProperty) {
        return res.status(404).json({ message: "Unit not found" });
      }

      const { property, ...unit } = unitWithProperty;
      const orgId = property.orgId!;

      // Get the listing for this unit to check if pre-qualification is enabled
      const listing = await storage.getListingByUnitPublic(unitId);
      
      // Check pre-qualification settings at various levels
      const org = await storage.getOrganization(orgId);
      const propertySettings = await storage.getPropertySchedulingSettings(property.id, orgId);
      
      // Determine if pre-qualification is required (4-level inheritance)
      // Level 1: Organization default
      let preQualifyEnabled = org?.preQualifyEnabled ?? false;
      
      // Level 2: Property portfolio override
      if (property.preQualifyEnabled !== null) {
        preQualifyEnabled = property.preQualifyEnabled;
      }
      
      // Level 3: Property scheduling settings override
      if (propertySettings?.preQualifyEnabled !== null && propertySettings?.preQualifyEnabled !== undefined) {
        preQualifyEnabled = propertySettings.preQualifyEnabled;
      }
      
      // Level 4: Listing override (if exists)
      if (listing?.preQualifyEnabled !== null && listing?.preQualifyEnabled !== undefined) {
        preQualifyEnabled = listing.preQualifyEnabled;
      }

      // Level 5: Unit override
      if (unit.preQualifyEnabled !== null && unit.preQualifyEnabled !== undefined) {
        preQualifyEnabled = unit.preQualifyEnabled;
      }

      if (!preQualifyEnabled) {
        return res.json({
          required: false,
          message: "Pre-qualification is not required for this unit"
        });
      }

      // Get the effective qualification template
      const template = await storage.getEffectiveQualificationTemplate(unitId, orgId);
      if (!template || !template.isActive) {
        return res.json({
          required: false,
          message: "No active qualification template found"
        });
      }

      // Get current qualification settings to validate question IDs
      // Questions should match the pattern: {qualificationId}-{questionId}
      // This ensures we only return questions from current qualifications
      let qualificationIds: string[] = [];
      try {
        // Try to get property-level qualifications first
        const propertyQualSettings = await storage.getPropertyQualificationSettings(property.id, orgId);
        if (propertyQualSettings?.qualifications) {
          const quals = propertyQualSettings.qualifications as any[];
          qualificationIds = quals.filter((q: any) => q.enabled).map((q: any) => q.id);
        } else {
          // Fall back to org-level qualifications
          const orgQualSettings = await storage.getOrgQualificationSettings(orgId);
          if (orgQualSettings?.qualifications) {
            const quals = orgQualSettings.qualifications as any[];
            qualificationIds = quals.filter((q: any) => q.enabled).map((q: any) => q.id);
          }
        }
      } catch (error) {
        console.error("[Public Qualification] Error fetching qualification settings:", error);
        // Continue without filtering if we can't fetch qualification settings
      }

      // Return the qualification requirements (questions only, not expected answers)
      // Filter by enabled AND ensure question belongs to a current qualification
      const allQuestions = (template.questions as QualificationQuestion[]) || [];
      console.log(`[Public Qualification] Total questions in template: ${allQuestions.length}`);
      console.log(`[Public Qualification] Qualification IDs:`, qualificationIds);
      
      const questions = allQuestions
        .filter(q => {
          // First check: question must be enabled
          if (!q.enabled) {
            console.log(`[Public Qualification] Question ${q.id} is disabled, skipping`);
            return false;
          }
          
          // Second check: if we have qualification IDs, only include questions that match current enabled qualifications
          if (qualificationIds.length > 0) {
            const matches = qualificationIds.some(qualId => q.id.startsWith(`${qualId}-`));
            if (!matches) {
              console.log(`[Public Qualification] Question ${q.id} does not match any current qualification IDs:`, qualificationIds);
            }
            return matches;
          }
          
          // If we can't fetch qualification IDs, include all enabled questions
          // (fallback for backwards compatibility - but log a warning)
          console.warn("[Public Qualification] No qualification IDs found, showing all enabled questions (fallback mode)");
          return true;
        })
        .map(({ id, type, question, required, options, order }) => ({
          id,
          type,
          question,
          required,
          options,
          order,
        }))
        .sort((a, b) => a.order - b.order);
      
      console.log(`[Public Qualification] Filtered questions count: ${questions.length}`);

      res.json({
        required: true,
        templateId: template.id,
        introMessage: template.introMessage,
        questions,
        allowRetry: template.allowRetry,
        showResultsImmediately: template.showResultsImmediately,
      });
    } catch (error: any) {
      console.error("[Public Qualification] Error fetching qualification requirements:", error);
      res.status(500).json({ message: "Failed to fetch qualification requirements" });
    }
  });

  // Submit pre-qualification answers (public - no auth required)
  app.post("/api/public/units/:unitId/qualify", async (req, res) => {
    try {
      const { unitId } = req.params;
      const { templateId, answers, leadEmail, leadName, leadPhone } = req.body;

      if (!templateId || !answers || !leadEmail) {
        return res.status(400).json({ message: "Missing required fields: templateId, answers, leadEmail" });
      }

      // Get unit with property to determine org
      const unitWithProperty = await storage.getPropertyUnitPublic(unitId);
      if (!unitWithProperty) {
        return res.status(404).json({ message: "Unit not found" });
      }

      const { property, ...unit } = unitWithProperty;
      const orgId = property.orgId!;

      // Get the template
      const template = await storage.getQualificationTemplates(orgId)
        .then(templates => templates.find(t => t.id === templateId));
      if (!template || !template.isActive) {
        return res.status(404).json({ message: "Qualification template not found or inactive" });
      }

      // Get or create lead
      let lead = await storage.getLeadByEmail(leadEmail, orgId);
      if (!lead) {
        lead = await storage.createLead({
          name: leadName || "Unknown",
          email: leadEmail,
          phone: leadPhone || null,
          propertyId: property.id,
          propertyName: property.name,
          status: "new",
          source: "qualification",
          orgId,
        });
      }

      // Get the listing if it exists
      const listing = await storage.getListingByUnitPublic(unitId);

      // Evaluate the qualification answers
      const questions = template.questions as QualificationQuestion[];
      const failedQuestions: string[] = [];
      let totalQuestions = 0;
      let passedQuestions = 0;

      for (const question of questions) {
        if (!question.enabled) continue;
        totalQuestions++;

        const answer = answers[question.id];
        
        // Check if required question was answered
        if (question.required && (answer === undefined || answer === null || answer === '')) {
          failedQuestions.push(question.id);
          continue;
        }

        // Check deal-breaker validation
        if (question.isDealBreaker && question.validation?.expectedAnswer !== undefined) {
          const expected = question.validation.expectedAnswer;
          let passed = false;

          if (question.type === 'number') {
            const numAnswer = Number(answer);
            const min = question.validation.min;
            const max = question.validation.max;
            
            if (min !== undefined && numAnswer < min) {
              passed = false;
            } else if (max !== undefined && numAnswer > max) {
              passed = false;
            } else if (expected !== undefined) {
              passed = numAnswer >= Number(expected);
            } else {
              passed = true;
            }
          } else if (question.type === 'boolean') {
            passed = answer === expected;
          } else {
            passed = String(answer).toLowerCase() === String(expected).toLowerCase();
          }

          if (!passed) {
            failedQuestions.push(question.id);
          } else {
            passedQuestions++;
          }
        } else {
          passedQuestions++;
        }
      }

      const passed = template.allMustPass 
        ? failedQuestions.length === 0 
        : passedQuestions >= Math.ceil(totalQuestions * 0.7); // 70% pass threshold if not all must pass

      const score = totalQuestions > 0 
        ? Math.round((passedQuestions / totalQuestions) * 100) 
        : 100;

      // Save the qualification result
      const qualification = await storage.createLeadQualification({
        orgId,
        leadId: lead.id,
        templateId,
        propertyId: property.id,
        unitId: unit.id,
        listingId: listing?.id || null,
        answers,
        passed,
        score,
        failedQuestions,
        ipAddress: (req.ip || req.socket.remoteAddress || 'unknown') as string,
        userAgent: req.get('user-agent') || null,
      });

      // Update lead status based on qualification result
      if (passed) {
        await storage.updateLead(lead.id, { status: 'qualified' }, orgId);
      } else {
        await storage.updateLead(lead.id, { status: 'unqualified' }, orgId);
      }

      // Return result based on template settings
      if (template.showResultsImmediately) {
        res.json({
          passed,
          score,
          message: passed ? template.successMessage : template.failureMessage,
          allowRetry: template.allowRetry && !passed,
          retryDelayMinutes: template.retryDelayMinutes,
          qualificationId: qualification.id,
        });
      } else {
        res.json({
          submitted: true,
          message: "Your responses have been submitted for review. We will contact you shortly.",
          qualificationId: qualification.id,
        });
      }
    } catch (error: any) {
      console.error("[Public Qualification] Error submitting qualification:", error);
      res.status(500).json({ message: "Failed to submit qualification" });
    }
  });

  // Check if lead has already qualified for a unit (public - no auth required)
  app.get("/api/public/units/:unitId/qualification-status", async (req, res) => {
    try {
      const { unitId } = req.params;
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email query parameter is required" });
      }

      // Get unit with property to determine org
      const unitWithProperty = await storage.getPropertyUnitPublic(unitId);
      if (!unitWithProperty) {
        return res.status(404).json({ message: "Unit not found" });
      }

      const { property } = unitWithProperty;
      const orgId = property.orgId!;

      // Find the lead
      const lead = await storage.getLeadByEmail(email, orgId);
      if (!lead) {
        return res.json({
          qualified: false,
          hasSubmitted: false,
        });
      }

      // Get the listing
      const listing = await storage.getListingByUnitPublic(unitId);
      if (!listing) {
        return res.json({
          qualified: false,
          hasSubmitted: false,
        });
      }

      // Get the latest qualification for this lead and listing
      const latestQualification = await storage.getLatestLeadQualification(lead.id, listing.id, orgId);
      
      if (!latestQualification) {
        return res.json({
          qualified: false,
          hasSubmitted: false,
        });
      }

      // Check if retry is allowed
      const template = latestQualification.templateId 
        ? await storage.getQualificationTemplates(orgId).then(t => t.find(x => x.id === latestQualification.templateId))
        : null;

      const canRetry = template?.allowRetry && !latestQualification.passed;
      const retryAfter = template?.retryDelayMinutes 
        ? new Date(latestQualification.submittedAt.getTime() + template.retryDelayMinutes * 60000)
        : null;
      const canRetryNow = canRetry && (!retryAfter || new Date() >= retryAfter);

      res.json({
        qualified: latestQualification.passed,
        hasSubmitted: true,
        submittedAt: latestQualification.submittedAt,
        score: latestQualification.score,
        canRetry,
        canRetryNow,
        retryAfter,
      });
    } catch (error: any) {
      console.error("[Public Qualification] Error checking qualification status:", error);
      res.status(500).json({ message: "Failed to check qualification status" });
    }
  });

  return httpServer;
}
