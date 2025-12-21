// Stripe Webhook Handlers for Lead2Lease
// Integration: connector:conn_stripe_01KC03S70FY6RJJ078G2PEK8YF

import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { sendFoundingPartnerWelcomeEmail } from './email';
import { db } from './db';
import { organizations, users, memberships, pendingSubscriptions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { storage } from './storage';

// Track sent welcome emails to prevent duplicates (keyed by orgId:subscriptionId)
// This ensures each new organization gets an email, even if user has other orgs
const sentWelcomeEmails = new Set<string>();

/**
 * Send founding partner welcome email for an organization with membership
 * Deduplicates by orgId:subscriptionId to ensure each new org gets an email
 * ALWAYS sends, even if user has multiple organizations with memberships
 */
export async function sendWelcomeEmailForOrgMembership(
  orgId: string,
  subscriptionId: string,
  userEmail: string,
  userName?: string
): Promise<void> {
  const startTime = Date.now();
  const emailKey = `${orgId}:${subscriptionId}`;
  
  console.log(`[Welcome Email] ===== STARTING WELCOME EMAIL SEND FOR ORG MEMBERSHIP =====`);
  console.log(`[Welcome Email] Timestamp: ${new Date().toISOString()}`);
  console.log(`[Welcome Email] Org ID: ${orgId}`);
  console.log(`[Welcome Email] Subscription ID: ${subscriptionId}`);
  console.log(`[Welcome Email] User Email: ${userEmail}`);
  console.log(`[Welcome Email] User Name: ${userName || 'N/A'}`);
  console.log(`[Welcome Email] Email Key (for deduplication): ${emailKey}`);
  
  // Check if email already sent for this org+subscription
  if (sentWelcomeEmails.has(emailKey)) {
    console.log(`[Welcome Email] ⚠️ Email already sent for org ${orgId} subscription ${subscriptionId}, skipping duplicate`);
    console.log(`[Welcome Email] Duration: ${Date.now() - startTime}ms`);
    return;
  }
  
  // Fetch organization name for the email
  // Priority: 1) Subscription/Session metadata (most reliable - set during checkout), 2) Database lookup
  let orgName: string | undefined;
  try {
    const stripe = await getUncachableStripeClient();
    // Check if subscriptionId is actually a sessionId (for one-time payments)
    // Session IDs start with 'cs_' while subscription IDs start with 'sub_'
    if (subscriptionId.startsWith('cs_')) {
      // This is a checkout session (one-time payment)
      const session = await stripe.checkout.sessions.retrieve(subscriptionId);
      const metadataOrgName = session.metadata?.organization_name;
      
      if (metadataOrgName) {
        orgName = metadataOrgName;
        console.log(`[Welcome Email] ✅ Got organization name from session metadata: "${orgName}"`);
      } else {
        console.log(`[Welcome Email] ⚠️ No organization_name in session metadata, fetching from database...`);
        // Fallback to database lookup
        const org = await storage.getOrganization(orgId);
        if (org) {
          orgName = org.name;
          console.log(`[Welcome Email] ✅ Fetched organization name from database: "${orgName}"`);
        } else {
          console.error(`[Welcome Email] ❌ Organization ${orgId} not found in database`);
        }
      }
    } else {
      // This is a subscription
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const metadataOrgName = subscription.metadata?.organization_name;
      
      if (metadataOrgName) {
        orgName = metadataOrgName;
        console.log(`[Welcome Email] ✅ Got organization name from subscription metadata: "${orgName}"`);
      } else {
        console.log(`[Welcome Email] ⚠️ No organization_name in subscription metadata, fetching from database...`);
        // Fallback to database lookup
        const org = await storage.getOrganization(orgId);
        if (org) {
          orgName = org.name;
          console.log(`[Welcome Email] ✅ Fetched organization name from database: "${orgName}"`);
        } else {
          console.error(`[Welcome Email] ❌ Organization ${orgId} not found in database`);
        }
      }
    }
  } catch (error) {
    console.error(`[Welcome Email] ❌ Error getting organization name from subscription/session metadata:`, error);
    // Try database lookup as fallback
    try {
      const org = await storage.getOrganization(orgId);
      if (org) {
        orgName = org.name;
        console.log(`[Welcome Email] ✅ Fallback: Fetched organization name from database: "${orgName}"`);
      } else {
        console.error(`[Welcome Email] ❌ Organization ${orgId} not found in database`);
      }
    } catch (orgError) {
      console.error(`[Welcome Email] ❌ Error fetching organization ${orgId} from database:`, orgError);
      // Continue without org name - email will still be sent
    }
  }
  
  // Mark as sent before sending (to prevent duplicates from concurrent webhooks)
  sentWelcomeEmails.add(emailKey);
  console.log(`[Welcome Email] Marked email as sent (deduplication key: ${emailKey})`);
  
  // Clean up old entries (keep last 1000)
  if (sentWelcomeEmails.size > 1000) {
    const entries = Array.from(sentWelcomeEmails);
    entries.slice(0, 500).forEach(e => sentWelcomeEmails.delete(e));
    console.log(`[Welcome Email] Cleaned up old deduplication entries, now tracking ${sentWelcomeEmails.size} entries`);
  }
  
  try {
    console.log(`[Welcome Email] Calling sendFoundingPartnerWelcomeEmail with orgName: "${orgName || 'N/A'}"`);
    await sendFoundingPartnerWelcomeEmail({
      email: userEmail,
      name: userName,
      orgName: orgName,
    });
    const duration = Date.now() - startTime;
    console.log(`[Welcome Email] ===== WELCOME EMAIL SENT SUCCESSFULLY =====`);
    console.log(`[Welcome Email] ✅ Welcome email sent to founding partner: ${userEmail}`);
    console.log(`[Welcome Email] Organization: ${orgName || 'N/A'} (${orgId})`);
    console.log(`[Welcome Email] Subscription: ${subscriptionId}`);
    console.log(`[Welcome Email] Total duration: ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Welcome Email] ===== WELCOME EMAIL SEND FAILED =====`);
    console.error(`[Welcome Email] ❌ Failed to send welcome email to ${userEmail} for org ${orgId}`);
    console.error(`[Welcome Email] Organization: ${orgName || 'N/A'} (${orgId})`);
    console.error(`[Welcome Email] Subscription: ${subscriptionId}`);
    console.error(`[Welcome Email] Error duration: ${duration}ms`);
    console.error(`[Welcome Email] Error details:`, error);
    // Remove from set if sending failed so it can be retried
    sentWelcomeEmails.delete(emailKey);
    console.log(`[Welcome Email] Removed from deduplication set to allow retry`);
    throw error;
  }
}

/**
 * Link existing Stripe subscription to user's organization by email
 * Called when user logs in, registers, or creates an organization
 * Best practice: Always check for pending subscriptions when user/org is created
 */
export async function linkSubscriptionToUser(userEmail: string, userId: string): Promise<void> {
  try {
    // First, check if user has an organization
    let userOrg = await storage.getUserOrganization(userId);
    
    // If no org yet, subscription will be linked when org is created
    // (This can happen if user paid before creating account)
    if (!userOrg) {
      console.log(`[Link Subscription] User ${userId} has no organization yet. Subscription will be linked when org is created.`);
      return;
    }

    let orgId = userOrg.orgId; // Use let so we can update it if needed
    console.log(`[Link Subscription] Attempting to link subscription for user ${userId} (${userEmail}) to org ${orgId}`);

    // Check if org already has an active subscription
    const org = await storage.getOrganization(orgId);
    if (org?.foundingPartnerStatus === 'active' && org?.stripeSubscriptionId) {
      // Verify the subscription is still active in Stripe
      try {
        const stripe = await getUncachableStripeClient();
        const existingSub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
        if (existingSub.status === 'active' || existingSub.status === 'trialing') {
          console.log(`[Link Subscription] ✅ Org ${orgId} already has active subscription ${org.stripeSubscriptionId}`);
          return;
        } else {
          console.log(`[Link Subscription] Org ${orgId} has subscription ${org.stripeSubscriptionId} but status is ${existingSub.status}, attempting to find new subscription...`);
        }
      } catch (error) {
        console.log(`[Link Subscription] Could not verify existing subscription ${org.stripeSubscriptionId}, attempting to find new subscription...`);
        // Continue to try to link a new subscription
      }
    }

    // Search for Stripe customer by email
    const stripe = await getUncachableStripeClient();
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 100, // Increased to handle multiple customers with same email
    });

    if (customers.data.length === 0) {
      console.log(`[Link Subscription] No Stripe customer found for email ${userEmail}`);
      return;
    }

    console.log(`[Link Subscription] Found ${customers.data.length} Stripe customer(s) for email ${userEmail}`);

    // First, count total active subscriptions to determine if user has only one
    let totalActiveSubscriptions = 0;
    const allActiveSubscriptions: any[] = [];
    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 100, // Increased limit to handle multiple subscriptions
      });
      totalActiveSubscriptions += subscriptions.data.length;
      allActiveSubscriptions.push(...subscriptions.data.map(sub => ({ subscription: sub, customer })));
    }
    const isOnlySubscription = totalActiveSubscriptions === 1;
    console.log(`[Link Subscription] Found ${totalActiveSubscriptions} total active subscription(s) for email ${userEmail}`);

    // Find active subscription for any of these customers
    // Handle multiple subscriptions - link the most recent active one
    let bestSubscription: { subscription: any; customer: any; created: number } | null = null;
    
    for (const { subscription, customer } of allActiveSubscriptions) {
      // Check if this is a founding partner subscription
      // More flexible matching: check metadata, price ($149), or product name
      const hasFoundingPartnerMetadata = subscription.metadata?.membershipType === 'founding_partner';
      const is149Price = subscription.items.data.some(item => 
        item.price.unit_amount === 14999 && 
        item.price.recurring?.interval === 'month'
      );
      
      // Check product name/description for "Founding Partner"
      let hasFoundingPartnerInName = false;
      try {
        for (const item of subscription.items.data) {
          const productId = typeof item.price.product === 'string' ? item.price.product : item.price.product?.id;
          if (productId) {
            try {
              const productDetails = await stripe.products.retrieve(productId);
              if (productDetails.name?.toLowerCase().includes('founding') || 
                  productDetails.description?.toLowerCase().includes('founding')) {
                hasFoundingPartnerInName = true;
                break;
              }
            } catch (e) {
              // Ignore product fetch errors
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
      
      // Accept subscription if it matches any founding partner criteria
      // OR if it's the only active subscription (handles legacy subscriptions)
      const isFoundingPartner = hasFoundingPartnerMetadata || is149Price || hasFoundingPartnerInName;

      // Consider subscription if it matches criteria or is the only one
      if (isFoundingPartner || isOnlySubscription) {
        const created = subscription.created;
        
        // Prefer subscription with founding_partner metadata, then most recent
        if (!bestSubscription || 
            (hasFoundingPartnerMetadata && !bestSubscription.subscription.metadata?.membershipType) ||
            created > bestSubscription.created) {
          bestSubscription = {
            subscription,
            customer,
            created,
          };
        }
        
        console.log(`[Link Subscription] Found potential founding partner subscription ${subscription.id} for customer ${customer.id} (created: ${new Date(created * 1000).toISOString()}, metadata: ${hasFoundingPartnerMetadata}, price: ${is149Price}, name: ${hasFoundingPartnerInName}, only: ${isOnlySubscription}, totalActive: ${allActiveSubscriptions.length})`);
      }
    }
    
    // If no subscription matched criteria but we have active subscriptions, link the most recent one anyway
    // This handles edge cases where subscriptions don't match our criteria but should still be linked
    if (!bestSubscription && allActiveSubscriptions.length > 0) {
      console.log(`[Link Subscription] No subscription matched criteria, but found ${allActiveSubscriptions.length} active subscription(s). Linking most recent one...`);
      const mostRecent = allActiveSubscriptions.reduce((prev, current) => {
        return current.subscription.created > prev.subscription.created ? current : prev;
      });
      bestSubscription = {
        subscription: mostRecent.subscription,
        customer: mostRecent.customer,
        created: mostRecent.subscription.created,
      };
      console.log(`[Link Subscription] Selected most recent subscription ${mostRecent.subscription.id} (created: ${new Date(mostRecent.subscription.created * 1000).toISOString()})`);
    }
    
    // Link the best subscription found
    if (bestSubscription) {
      const { subscription, customer } = bestSubscription;
      console.log(`[Link Subscription] 🔗 Linking best subscription ${subscription.id} for customer ${customer.id} to org ${orgId} (user: ${userEmail})`);
      
      // Check subscription metadata to see if it already has org_id
      const existingOrgId = subscription.metadata?.organization_id || subscription.metadata?.orgId;
      if (existingOrgId && existingOrgId !== orgId) {
        console.log(`[Link Subscription] ⚠️ Subscription ${subscription.id} already has org_id ${existingOrgId} in metadata, but user ${userEmail} current org is ${orgId}.`);
        
        // Check if user belongs to the org that the subscription is linked to
        const userMemberships = await storage.getUserOrganizations(userId);
        const subscriptionOrgMembership = userMemberships.find(m => m.orgId === existingOrgId);
        
        if (subscriptionOrgMembership) {
          // User belongs to the org that the subscription is linked to!
          // Update user's currentOrgId to match the subscription's org
          console.log(`[Link Subscription] ✅ User ${userEmail} belongs to org ${existingOrgId} (subscription's org). Updating user's currentOrgId...`);
          await storage.updateUser(userId, { currentOrgId: existingOrgId });
          
          // Verify the org has the subscription linked
          const subscriptionOrg = await storage.getOrganization(existingOrgId);
          if (subscriptionOrg?.stripeSubscriptionId === subscription.id && subscriptionOrg?.foundingPartnerStatus === 'active') {
            console.log(`[Link Subscription] ✅ Org ${existingOrgId} already has subscription ${subscription.id} linked and active. User's currentOrgId updated.`);
            
            // CRITICAL: Send welcome email even if subscription was already linked
            // This ensures email is sent if webhook didn't send it
            try {
              console.log(`[Link Subscription] Subscription already linked, but sending welcome email to ensure it was sent`);
              const user = await storage.getUser(userId);
              const userName = user?.fullName || undefined;
              await sendWelcomeEmailForOrgMembership(existingOrgId, subscription.id, userEmail, userName);
              console.log(`[Link Subscription] ✅ Welcome email sent for already-linked subscription`);
            } catch (emailError) {
              // Email might have already been sent (deduplication), which is fine
              console.log(`[Link Subscription] Welcome email not sent (likely already sent):`, emailError instanceof Error ? emailError.message : emailError);
            }
            return;
          } else {
            // Org exists but subscription not properly linked - link it now
            console.log(`[Link Subscription] 🔗 Linking subscription ${subscription.id} to org ${existingOrgId} (user's org)...`);
            orgId = existingOrgId; // Use the subscription's org instead
          }
        } else {
          // Subscription is linked to an org the user doesn't belong to
          console.log(`[Link Subscription] ❌ Cannot link subscription to different org. Subscription belongs to org ${existingOrgId}, user does not belong to that org.`);
          return;
        }
      }
      
      // Validate current_period_end before converting to Date
      const periodEnd = (subscription as any).current_period_end;
      let periodEndDate: Date | null = null;
      if (periodEnd && typeof periodEnd === 'number' && periodEnd > 0) {
        try {
          periodEndDate = new Date(periodEnd * 1000);
          // Validate the date is valid
          if (isNaN(periodEndDate.getTime())) {
            console.log(`[Link Subscription] ⚠️ Invalid current_period_end value: ${periodEnd}, using null`);
            periodEndDate = null;
          }
        } catch (e) {
          console.error(`[Link Subscription] Error converting current_period_end to Date:`, e);
          periodEndDate = null;
        }
      } else {
        console.log(`[Link Subscription] ⚠️ Missing or invalid current_period_end: ${periodEnd}, using null`);
      }
      
      await db.update(organizations)
        .set({
          foundingPartnerStatus: 'active',
          stripeCustomerId: customer.id,
          stripeSubscriptionId: subscription.id,
          subscriptionCurrentPeriodEnd: periodEndDate,
          subscriptionCancelledAt: null,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, orgId));
      
      // Also update subscription metadata to include org_id if not already set
      try {
        const stripe = await getUncachableStripeClient();
        if (!subscription.metadata?.organization_id && !subscription.metadata?.orgId) {
          await stripe.subscriptions.update(subscription.id, {
            metadata: {
              ...subscription.metadata,
              organization_id: orgId,
              orgId: orgId,
              billing_contact_user_id: userId,
              billing_contact_email: userEmail,
            },
          });
          console.log(`[Link Subscription] ✅ Updated subscription ${subscription.id} metadata with org_id ${orgId}`);
        }
      } catch (metaError) {
        console.error(`[Link Subscription] Error updating subscription metadata:`, metaError);
        // Don't fail the linking if metadata update fails
      }
      
      console.log(`[Link Subscription] ✅ Successfully linked subscription ${subscription.id} to org ${orgId} (user: ${userEmail})`);
      
      // Send welcome email for this new organization membership
      // ALWAYS sends, even if user has multiple organizations with memberships
      try {
        console.log(`[Link Subscription] Sending welcome email for org ${orgId} subscription ${subscription.id}`);
        // Get user's full name if available
        let userName: string | undefined;
        try {
          const user = await storage.getUser(userId);
          userName = user?.fullName || undefined;
        } catch (e) {
          console.error(`[Link Subscription] Error getting user name (non-fatal):`, e);
        }
        
        await sendWelcomeEmailForOrgMembership(orgId, subscription.id, userEmail, userName);
        console.log(`[Link Subscription] ✅ Welcome email sent successfully for org ${orgId}`);
      } catch (error) {
        // Don't throw - email sending failure shouldn't break subscription linking
        console.error(`[Link Subscription] ❌ Failed to send welcome email (non-fatal):`, error);
        console.error(`[Link Subscription] Error details:`, error instanceof Error ? error.message : error);
      }
      
      return;
    }

    console.log(`[Link Subscription] ❌ No active founding partner subscription found for email ${userEmail} (org: ${orgId})`);
  } catch (error) {
    console.error(`[Link Subscription] Error linking subscription for user ${userId}:`, error);
    // Don't throw - this is a background operation that shouldn't block login
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    // First, let StripeSync process and verify the webhook signature
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature, uuid);

    // Only after successful signature verification, handle custom logic
    // If signature was invalid, processWebhook would have thrown an error
    try {
      const event = JSON.parse(payload.toString());
      
      // Handle checkout session completed - send welcome email and activate membership
      if (event.type === 'checkout.session.completed') {
        await WebhookHandlers.handleCheckoutCompleted(event);
      }
      
      // Handle subscription updates (renewal, payment success, etc.)
      if (event.type === 'customer.subscription.updated') {
        await WebhookHandlers.handleSubscriptionUpdated(event);
      }
      
      // Handle subscription deletion/cancellation
      if (event.type === 'customer.subscription.deleted') {
        await WebhookHandlers.handleSubscriptionDeleted(event);
      }
      
      // Handle invoice payment succeeded (renewal)
      if (event.type === 'invoice.payment_succeeded') {
        await WebhookHandlers.handleInvoicePaymentSucceeded(event);
      }
      
      // Handle invoice payment failed
      if (event.type === 'invoice.payment_failed') {
        await WebhookHandlers.handleInvoicePaymentFailed(event);
      }
      
      // Handle checkout session expired - clean up organizations created for checkout
      if (event.type === 'checkout.session.expired') {
        await WebhookHandlers.handleCheckoutExpired(event);
      }
    } catch (e) {
      console.error('[Stripe Webhook] Error handling custom event logic:', e);
      // Don't throw - webhook was already verified and processed successfully
    }
  }

  static async handleCheckoutCompleted(event: any): Promise<void> {
    const session = event.data?.object;
    if (!session) return;

    const sessionId = session.id;
    const customerEmail = session.customer_email || session.customer_details?.email;
    const customerName = session.metadata?.customerName || session.customer_details?.name;
    const customerId = session.customer;
    const subscriptionId = session.subscription;
    
    // Best practice: Check client_reference_id first (most reliable)
    const clientReferenceId = session.client_reference_id;
    const metadataOrgId = session.metadata?.orgId;

    console.log(`[Stripe Webhook] Checkout completed: ${sessionId}, email: ${customerEmail}, client_ref: ${clientReferenceId}, metadata_orgId: ${metadataOrgId}, customerId: ${customerId}, mode: ${session.mode}`);

    // Handle one-time payments with the configured lookup key
    if (session.mode === 'payment' && session.payment_status === 'paid' && customerId) {
      try {
        const stripe = await getUncachableStripeClient();
        const { getStripeLookupKey } = await import("./stripeClient");
        const expectedLookupKey = getStripeLookupKey();
        
        if (!expectedLookupKey) {
          console.log(`[Stripe Webhook] ⚠️ No STRIPE_LOOKUP_KEY set - skipping one-time payment check for session ${sessionId}`);
        } else {
          // Retrieve the line items to check the price lookup key
          const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });
          
          let hasOneTimePayLookupKey = false;
          for (const item of lineItems.data) {
            const price = item.price;
            if (price?.lookup_key === expectedLookupKey) {
              hasOneTimePayLookupKey = true;
              console.log(`[Stripe Webhook] ✅ Found one-time payment with '${expectedLookupKey}' lookup key in session ${sessionId}`);
              break;
            }
          }
          
          if (hasOneTimePayLookupKey) {
            // Find the organization for this payment
            let targetOrgId: string | null = null;
            
            // Try to find org via metadata
            if (metadataOrgId) {
              const org = await storage.getOrganization(metadataOrgId);
              if (org) {
                targetOrgId = metadataOrgId;
                console.log(`[Stripe Webhook] ✅ Found org via session metadata: ${targetOrgId}`);
              }
            }
            
            // Try client_reference_id
            if (!targetOrgId && clientReferenceId) {
              if (clientReferenceId.startsWith('user:')) {
                const userId = clientReferenceId.replace('user:', '');
                const userOrg = await storage.getUserOrganization(userId);
                if (userOrg) {
                  targetOrgId = userOrg.orgId;
                  console.log(`[Stripe Webhook] ✅ Found org via user reference: ${targetOrgId}`);
                }
              } else {
                const org = await storage.getOrganization(clientReferenceId);
                if (org) {
                  targetOrgId = clientReferenceId;
                  console.log(`[Stripe Webhook] ✅ Found org via client_reference_id: ${targetOrgId}`);
                }
              }
            }
            
            // Try customer metadata
            if (!targetOrgId && customerId) {
              try {
                const customer = await stripe.customers.retrieve(customerId);
                const customerOrgId = (customer as any).metadata?.organization_id;
                if (customerOrgId) {
                  const org = await storage.getOrganization(customerOrgId);
                  if (org) {
                    targetOrgId = customerOrgId;
                    console.log(`[Stripe Webhook] ✅ Found org via customer metadata: ${targetOrgId}`);
                  }
                }
              } catch (error) {
                console.error(`[Stripe Webhook] Error checking customer metadata:`, error);
              }
            }
            
            // Update organization to active status if we found it
            if (targetOrgId) {
              const org = await storage.getOrganization(targetOrgId);
              if (org) {
                await db.update(organizations)
                  .set({
                    foundingPartnerStatus: 'active',
                    stripeCustomerId: customerId,
                    updatedAt: new Date(),
                  })
                  .where(eq(organizations.id, targetOrgId));
                
                console.log(`[Stripe Webhook] ✅ Organization ${targetOrgId} (${org.name}) activated via one-time payment (session: ${sessionId}, customer: ${customerId})`);
                
                // Send welcome email (use sessionId as subscriptionId for one-time payments)
                try {
                  await sendWelcomeEmailForOrgMembership(
                    targetOrgId,
                    sessionId, // Use sessionId for one-time payments
                    customerEmail,
                    customerName || undefined
                  );
                  console.log(`[Stripe Webhook] ✅ Welcome email sent for org ${targetOrgId} (one-time payment)`);
                } catch (emailError) {
                  console.error(`[Stripe Webhook] ❌ Failed to send welcome email (non-fatal):`, emailError);
                }
              }
            } else {
              console.log(`[Stripe Webhook] ⚠️ One-time payment found but could not determine organization - will be checked on next membership status check`);
            }
          }
        }
      } catch (oneTimePaymentError) {
        console.error(`[Stripe Webhook] Error handling one-time payment:`, oneTimePaymentError);
      }
    }

    // Only process subscription checkouts for Founding Partner
    if (session.mode === 'subscription' && customerEmail && customerId && subscriptionId) {
      let targetOrgId: string | null = null;
      let linkedUserId: string | null = null;
      
      // BEST PRACTICE: Link subscription to Organization (not User)
      // Priority: 1) subscription metadata organization_id, 2) session metadata orgId, 3) client_reference_id (orgId), 4) customer metadata
      
      // Step 1: Try subscription metadata organization_id (most reliable - set during checkout)
      if (!targetOrgId && subscriptionId) {
        try {
          const stripe = await getUncachableStripeClient();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const subOrgId = subscription.metadata?.organization_id || subscription.metadata?.orgId;
          if (subOrgId) {
            const org = await storage.getOrganization(subOrgId);
            if (org) {
              targetOrgId = subOrgId;
              console.log(`[Stripe Webhook] ✅ Found org via subscription metadata organization_id: ${targetOrgId}`);
              
              // Get billing contact from subscription metadata
              linkedUserId = subscription.metadata?.billing_contact_user_id || null;
            }
          }
        } catch (error) {
          console.error(`[Stripe Webhook] Error retrieving subscription metadata:`, error);
        }
      }
      
      // Step 2: Try session metadata orgId
      if (!targetOrgId && metadataOrgId) {
        try {
          const org = await storage.getOrganization(metadataOrgId);
          if (org) {
            targetOrgId = metadataOrgId;
            console.log(`[Stripe Webhook] Found org via session metadata: ${targetOrgId}`);
            linkedUserId = session.metadata?.billing_contact_user_id || session.metadata?.userId || null;
          }
        } catch (error) {
          console.error(`[Stripe Webhook] Error checking metadata orgId:`, error);
        }
      }
      
      // Step 3: Try client_reference_id (should be orgId if org exists)
      if (!targetOrgId && clientReferenceId) {
        try {
          // Check if it's a user:userId format (user without org - pending onboarding)
          if (clientReferenceId.startsWith('user:')) {
            const userId = clientReferenceId.replace('user:', '');
            linkedUserId = userId;
            console.log(`[Stripe Webhook] Found user reference ${userId} (pending org creation)`);
            
            // Check if user has an org now (race condition: org might have been created)
            const userOrg = await storage.getUserOrganization(userId);
            if (userOrg) {
              targetOrgId = userOrg.orgId;
              console.log(`[Stripe Webhook] User ${userId} now has org ${targetOrgId}`);
            }
          } else {
            // Check if it's an orgId (best practice)
            const org = await storage.getOrganization(clientReferenceId);
            if (org) {
              targetOrgId = clientReferenceId;
              console.log(`[Stripe Webhook] Found org via client_reference_id: ${targetOrgId}`);
            }
          }
        } catch (error) {
          console.error(`[Stripe Webhook] Error checking client_reference_id:`, error);
        }
      }
      
      // Step 4: Try customer metadata (if customer was created with org info)
      if (!targetOrgId && customerId) {
        try {
          const stripe = await getUncachableStripeClient();
          const customer = await stripe.customers.retrieve(customerId);
          const customerOrgId = (customer as any).metadata?.organization_id;
          if (customerOrgId) {
            const org = await storage.getOrganization(customerOrgId);
            if (org) {
              targetOrgId = customerOrgId;
              console.log(`[Stripe Webhook] Found org via customer metadata: ${targetOrgId}`);
              linkedUserId = (customer as any).metadata?.billing_contact_user_id || null;
            }
          }
        } catch (error) {
          console.error(`[Stripe Webhook] Error checking customer metadata:`, error);
        }
      }
      
      // Step 5: Fallback - Try to find user by email and get their organization
      // WARNING: This fallback should rarely be used - metadata should always have organization_id
      // Only use this if all metadata lookups failed AND we can't find the org
      // DO NOT use this if user has multiple orgs - it will pick the wrong one
      if (!targetOrgId && customerEmail) {
        try {
          console.log(`[Stripe Webhook] ⚠️ WARNING: Fallback lookup by email - metadata should have organization_id!`);
          console.log(`[Stripe Webhook] ⚠️ This fallback may link to wrong org if user has multiple organizations`);
          console.log(`[Stripe Webhook] ⚠️ Fallback: Looking up user by email: ${customerEmail}`);
          
          const user = await db.query.users.findFirst({
            where: eq(users.email, customerEmail),
          });
          
          if (user) {
            linkedUserId = user.id;
            // Get ALL user organizations to check
            const userOrgs = await storage.getUserOrganizations(user.id);
            console.log(`[Stripe Webhook] ⚠️ Fallback: User ${user.id} has ${userOrgs.length} organization(s)`);
            
            // Try to find an org that matches the session metadata orgId (if available)
            let foundOrg = null;
            if (metadataOrgId) {
              foundOrg = userOrgs.find(o => o.orgId === metadataOrgId);
              if (foundOrg) {
                console.log(`[Stripe Webhook] ⚠️ Fallback: Found matching org in user's orgs via metadata: ${foundOrg.orgId}`);
                targetOrgId = foundOrg.orgId;
              }
            }
            
            // If no match, get the first org (but warn)
            if (!targetOrgId && userOrgs.length > 0) {
              if (userOrgs.length > 1) {
                console.error(`[Stripe Webhook] ❌ CRITICAL: User has ${userOrgs.length} organizations but metadata has no orgId! Cannot determine which org to link to.`);
                console.error(`[Stripe Webhook] ❌ This subscription may be linked to the wrong organization!`);
                // Still link to first org, but log warning
              }
              targetOrgId = userOrgs[0].orgId;
              foundOrg = userOrgs[0];
              console.log(`[Stripe Webhook] ⚠️ Fallback: Linking to first org: ${targetOrgId} (${foundOrg.orgName})`);
              
              // Update subscription metadata with org info for future webhooks
              try {
                const stripe = await getUncachableStripeClient();
                await stripe.subscriptions.update(subscriptionId, {
                  metadata: {
                    organization_id: targetOrgId,
                    organization_name: foundOrg.orgName || '',
                    billing_contact_user_id: user.id,
                    billing_contact_email: customerEmail,
                    _fallback_linked: 'true', // Flag that this was linked via fallback
                  },
                });
                console.log(`[Stripe Webhook] Updated subscription metadata with organization info (fallback link)`);
              } catch (updateError) {
                console.error(`[Stripe Webhook] Failed to update subscription metadata:`, updateError);
              }
            } else {
              console.log(`[Stripe Webhook] User ${user.id} found but has no organization - subscription will be linked when org is created`);
            }
          } else {
            console.log(`[Stripe Webhook] No user found with email ${customerEmail} - subscription will be linked when user registers`);
          }
        } catch (error) {
          console.error(`[Stripe Webhook] Error looking up user by email:`, error);
        }
      }
      
      // Step 5: Update organization membership if we found an orgId
      // BEST PRACTICE: Subscription belongs to Organization, not User
      if (targetOrgId && customerId && subscriptionId) {
        try {
          // Get subscription and organization details from Stripe
          const stripe = await getUncachableStripeClient();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const org = await storage.getOrganization(targetOrgId);
          
          // Update organization in database
          await db.update(organizations)
            .set({
              foundingPartnerStatus: 'active',
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              subscriptionCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
              subscriptionCancelledAt: null,
              updatedAt: new Date(),
            })
            .where(eq(organizations.id, targetOrgId));
          
          // BEST PRACTICE: Update Stripe customer and subscription metadata with organization info
          // This ensures future webhooks can always link by organization_id
          try {
            // Update customer metadata
            await stripe.customers.update(customerId, {
              metadata: {
                organization_id: targetOrgId,
                organization_name: org.name,
                billing_contact_user_id: linkedUserId || subscription.metadata?.billing_contact_user_id || '',
                billing_contact_email: customerEmail || subscription.metadata?.billing_contact_email || '',
                app_env: process.env.NODE_ENV || 'development',
              },
            });
            
            // Update subscription metadata (if not already set)
            if (!subscription.metadata?.organization_id) {
              await stripe.subscriptions.update(subscriptionId, {
                metadata: {
                  ...subscription.metadata,
                  organization_id: targetOrgId,
                  organization_name: org.name,
                  billing_contact_user_id: linkedUserId || subscription.metadata?.billing_contact_user_id || '',
                  billing_contact_email: customerEmail || subscription.metadata?.billing_contact_email || '',
                  app_env: process.env.NODE_ENV || 'development',
                },
              });
            }
            
            console.log(`[Stripe Webhook] ✅ Updated Stripe customer and subscription metadata with organization info`);
          } catch (metadataError) {
            console.error(`[Stripe Webhook] Failed to update Stripe metadata (non-fatal):`, metadataError);
            // Don't fail the webhook if metadata update fails
          }
          
          console.log(`[Stripe Webhook] ✅ Organization ${targetOrgId} (${org.name}) activated as Founding Partner (subscription: ${subscriptionId}, customer: ${customerId})`);
          
          // CRITICAL: Send welcome email immediately after successfully linking subscription to org
          // This ensures email is sent even if the condition below fails
          try {
            console.log(`[Stripe Webhook] Sending welcome email for org ${targetOrgId} subscription ${subscriptionId} (immediate send after org update)`);
            await sendWelcomeEmailForOrgMembership(
              targetOrgId,
              subscriptionId,
              customerEmail,
              customerName || undefined
            );
            console.log(`[Stripe Webhook] ✅ Welcome email sent successfully for org ${targetOrgId} (immediate)`);
          } catch (emailError) {
            console.error(`[Stripe Webhook] ❌ Failed to send welcome email immediately (non-fatal):`, emailError);
            console.error(`[Stripe Webhook] Error details:`, emailError instanceof Error ? emailError.message : emailError);
            // Don't throw - continue to try sending again below
          }
        } catch (error) {
          console.error(`[Stripe Webhook] Failed to update org membership for ${targetOrgId}:`, error);
        }
      } else if (!targetOrgId) {
        // Case: User paid but doesn't have organization yet
        // Store as pending subscription to be linked during onboarding
        console.log(`[Stripe Webhook] ⚠️ No organization found for subscription ${subscriptionId}. Storing as pending subscription.`);
        
        try {
          const stripe = await getUncachableStripeClient();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          // Check if pending subscription already exists (prevent duplicates from webhook retries)
          const [existingPending] = await db.select()
            .from(pendingSubscriptions)
            .where(eq(pendingSubscriptions.stripeSubscriptionId, subscriptionId))
            .limit(1);
          
          if (existingPending) {
            console.log(`[Stripe Webhook] Pending subscription already exists for ${subscriptionId}, updating...`);
            await db.update(pendingSubscriptions)
              .set({
                userId: linkedUserId || session.metadata?.userId || existingPending.userId,
                userEmail: customerEmail,
                subscriptionStatus: 'active',
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                updatedAt: new Date(),
              })
              .where(eq(pendingSubscriptions.stripeSubscriptionId, subscriptionId));
          } else {
            // Store pending subscription for later linking
            await db.insert(pendingSubscriptions).values({
              userId: linkedUserId || session.metadata?.userId || null,
              userEmail: customerEmail,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              stripeSessionId: sessionId,
              subscriptionStatus: 'active',
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              status: 'pending',
            });
          }
          
          console.log(`[Stripe Webhook] ✅ Pending subscription stored/updated for email ${customerEmail}, userId: ${linkedUserId || 'unknown'}`);
        } catch (pendingError) {
          console.error(`[Stripe Webhook] Failed to store pending subscription:`, pendingError);
        }
      }

      // Send welcome email if organization was linked (targetOrgId exists)
      // Track by orgId:subscriptionId to ensure each new organization gets an email
      // ALWAYS sends, even if user has multiple organizations with memberships
      // Note: Email may have already been sent above when org was updated, but deduplication will prevent duplicates
      if (targetOrgId && subscriptionId) {
        try {
          console.log(`[Stripe Webhook] Sending welcome email for org ${targetOrgId} subscription ${subscriptionId} (fallback send)`);
          await sendWelcomeEmailForOrgMembership(
            targetOrgId,
            subscriptionId,
            customerEmail,
            customerName || undefined
          );
          console.log(`[Stripe Webhook] ✅ Welcome email sent successfully for org ${targetOrgId} (fallback)`);
        } catch (error) {
          console.error(`[Stripe Webhook] ❌ Failed to send welcome email (non-fatal):`, error);
          console.error(`[Stripe Webhook] Error details:`, error instanceof Error ? error.message : error);
        }
      } else if (!targetOrgId && subscriptionId) {
        // No org linked yet - try to find org by subscription ID and send email
        // This handles cases where org was linked but targetOrgId wasn't found in metadata
        try {
          console.log(`[Stripe Webhook] ⚠️ No targetOrgId found, but subscriptionId exists. Searching for org by subscription ID...`);
          const stripe = await getUncachableStripeClient();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const subOrgId = subscription.metadata?.organization_id || subscription.metadata?.orgId;
          
          if (subOrgId) {
            const org = await storage.getOrganization(subOrgId);
            if (org && org.stripeSubscriptionId === subscriptionId) {
              console.log(`[Stripe Webhook] ✅ Found org ${subOrgId} linked to subscription ${subscriptionId}, sending welcome email`);
              await sendWelcomeEmailForOrgMembership(
                subOrgId,
                subscriptionId,
                customerEmail,
                customerName || undefined
              );
              console.log(`[Stripe Webhook] ✅ Welcome email sent successfully for org ${subOrgId} (found via subscription metadata)`);
            } else {
              console.log(`[Stripe Webhook] ⚠️ Org ${subOrgId} found in subscription metadata but not properly linked, email will be sent when org is created`);
            }
          } else {
            console.log(`[Stripe Webhook] ⚠️ No organization linked yet (targetOrgId: ${targetOrgId}, subscriptionId: ${subscriptionId}), email will be sent when org is created`);
          }
        } catch (fallbackError) {
          console.error(`[Stripe Webhook] ❌ Failed to find org by subscription ID (non-fatal):`, fallbackError);
          console.log(`[Stripe Webhook] ⚠️ Email will be sent when org is created and linked`);
        }
      } else {
        // No org linked yet - email will be sent when org is created and linked
        console.log(`[Stripe Webhook] ⚠️ No organization linked yet (targetOrgId: ${targetOrgId}, subscriptionId: ${subscriptionId}), email will be sent when org is created`);
      }
    }
  }

  // Handle subscription updates (renewal, status changes)
  static async handleSubscriptionUpdated(event: any): Promise<void> {
    const subscription = event.data?.object;
    if (!subscription) return;

    const subscriptionId = subscription.id;
    const customerId = subscription.customer;
    const status = subscription.status; // active, past_due, canceled, unpaid, etc.
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;
    const currentPeriodEnd = subscription.current_period_end;

    console.log(`[Stripe Webhook] Subscription updated: ${subscriptionId}, status: ${status}, cancelAtPeriodEnd: ${cancelAtPeriodEnd}`);
    console.log(`[Stripe Webhook] [Subscription Updated] Full subscription data:`, {
      id: subscriptionId,
      status: status,
      cancel_at_period_end: cancelAtPeriodEnd,
      current_period_end: currentPeriodEnd,
      current_period_end_date: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
    });

    try {
      // Find organization by stripe subscription ID
      const [org] = await db.select()
        .from(organizations)
        .where(eq(organizations.stripeSubscriptionId, subscriptionId))
        .limit(1);

      if (!org) {
        console.log(`[Stripe Webhook] No organization found for subscription ${subscriptionId}`);
        return;
      }

      console.log(`[Stripe Webhook] [Subscription Updated] Found organization:`, {
        orgId: org.id,
        orgName: org.name,
        currentStatus: org.foundingPartnerStatus,
      });

      // Determine founding partner status based on Stripe status
      let foundingPartnerStatus = 'active';
      if (status === 'past_due') {
        foundingPartnerStatus = 'past_due';
      } else if (status === 'canceled' || status === 'unpaid') {
        foundingPartnerStatus = 'expired';
      } else if (cancelAtPeriodEnd) {
        foundingPartnerStatus = 'cancelled'; // Will expire at period end
      }

      const updateData = {
        foundingPartnerStatus,
        subscriptionCurrentPeriodEnd: new Date(currentPeriodEnd * 1000),
        subscriptionCancelledAt: cancelAtPeriodEnd ? new Date() : null,
        updatedAt: new Date(),
      };

      console.log(`[Stripe Webhook] [Subscription Updated] Updating organization with:`, JSON.stringify(updateData, null, 2));

      await db.update(organizations)
        .set(updateData)
        .where(eq(organizations.id, org.id));

      console.log(`[Stripe Webhook] Updated org ${org.id} membership status to ${foundingPartnerStatus}, cancelAtPeriodEnd: ${cancelAtPeriodEnd}, periodEnd: ${new Date(currentPeriodEnd * 1000).toISOString()}`);
    } catch (error) {
      console.error(`[Stripe Webhook] Failed to update subscription status:`, error);
    }
  }

  // Handle subscription deletion
  static async handleSubscriptionDeleted(event: any): Promise<void> {
    const subscription = event.data?.object;
    if (!subscription) return;

    const subscriptionId = subscription.id;

    console.log(`[Stripe Webhook] Subscription deleted: ${subscriptionId}`);

    try {
      const [org] = await db.select()
        .from(organizations)
        .where(eq(organizations.stripeSubscriptionId, subscriptionId))
        .limit(1);

      if (!org) {
        console.log(`[Stripe Webhook] No organization found for subscription ${subscriptionId}`);
        return;
      }

      await db.update(organizations)
        .set({
          foundingPartnerStatus: 'expired',
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, org.id));

      console.log(`[Stripe Webhook] Organization ${org.id} membership expired`);
    } catch (error) {
      console.error(`[Stripe Webhook] Failed to handle subscription deletion:`, error);
    }
  }

  // Handle successful invoice payment (subscription renewal)
  static async handleInvoicePaymentSucceeded(event: any): Promise<void> {
    const invoice = event.data?.object;
    if (!invoice || !invoice.subscription) return;

    const subscriptionId = invoice.subscription;

    console.log(`[Stripe Webhook] Invoice payment succeeded for subscription: ${subscriptionId}`);

    try {
      const [org] = await db.select()
        .from(organizations)
        .where(eq(organizations.stripeSubscriptionId, subscriptionId))
        .limit(1);

      if (!org) return;

      // Get updated subscription info
      const stripe = await getUncachableStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      await db.update(organizations)
        .set({
          foundingPartnerStatus: 'active',
          subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
          subscriptionCancelledAt: null,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, org.id));

      console.log(`[Stripe Webhook] Organization ${org.id} membership renewed`);
    } catch (error) {
      console.error(`[Stripe Webhook] Failed to handle invoice payment:`, error);
    }
  }

  // Handle failed invoice payment
  static async handleInvoicePaymentFailed(event: any): Promise<void> {
    const invoice = event.data?.object;
    if (!invoice || !invoice.subscription) return;

    const subscriptionId = invoice.subscription;

    console.log(`[Stripe Webhook] Invoice payment failed for subscription: ${subscriptionId}`);

    try {
      const [org] = await db.select()
        .from(organizations)
        .where(eq(organizations.stripeSubscriptionId, subscriptionId))
        .limit(1);

      if (!org) return;

      await db.update(organizations)
        .set({
          foundingPartnerStatus: 'past_due',
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, org.id));

      console.log(`[Stripe Webhook] Organization ${org.id} membership marked as past_due`);
    } catch (error) {
      console.error(`[Stripe Webhook] Failed to handle invoice payment failure:`, error);
    }
  }

  static async handleCheckoutExpired(event: any): Promise<void> {
    const session = event.data?.object;
    if (!session) return;

    const sessionId = session.id;
    const metadataOrgId = session.metadata?.orgId;
    const orgCreatedForCheckout = session.metadata?.orgCreatedForCheckout === 'true';

    console.log(`[Stripe Webhook] Checkout session expired: ${sessionId}, orgId: ${metadataOrgId}, orgCreatedForCheckout: ${orgCreatedForCheckout}`);

    // Only clean up if this org was created specifically for this checkout
    if (!orgCreatedForCheckout || !metadataOrgId) {
      console.log(`[Stripe Webhook] Session ${sessionId} did not create an org for checkout, skipping cleanup`);
      return;
    }

    try {
      // Find the organization
      const org = await storage.getOrganization(metadataOrgId);
      if (!org) {
        console.log(`[Stripe Webhook] Organization ${metadataOrgId} not found for expired checkout session ${sessionId}`);
        return;
      }

      // Only delete if the org has no subscription attached
      // If it has a subscription, it means payment completed via another method/session
      if (!org.stripeSubscriptionId && org.foundingPartnerStatus === 'none') {
        console.log(`[Stripe Webhook] Cleaning up organization ${metadataOrgId} created for expired checkout session ${sessionId}`);
        
        // Get the user who created this org (the owner)
        const memberships = await storage.getOrganizationMembers(metadataOrgId);
        const ownerMembership = memberships.find(m => m.role === 'owner');
        
        if (ownerMembership) {
          // Delete the organization (soft delete)
          await storage.deleteOrganization(metadataOrgId, ownerMembership.userId);
          console.log(`[Stripe Webhook] ✅ Deleted organization ${metadataOrgId} (created for expired checkout session ${sessionId})`);
        } else {
          console.log(`[Stripe Webhook] ⚠️ Could not find owner for org ${metadataOrgId}, cannot delete`);
        }
      } else {
        console.log(`[Stripe Webhook] Organization ${metadataOrgId} has subscription or active status, skipping cleanup (subscriptionId: ${org.stripeSubscriptionId || 'none'}, status: ${org.foundingPartnerStatus})`);
      }
    } catch (error) {
      console.error(`[Stripe Webhook] Failed to handle checkout expiration for session ${sessionId}:`, error);
    }
  }
}
