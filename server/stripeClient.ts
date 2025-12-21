// Stripe client for Lead2Lease - Founding Partner Membership
// Integration: connector:conn_stripe_01KC03S70FY6RJJ078G2PEK8YF
//
// ENVIRONMENT VARIABLES (for local development or non-Replit deployments):
// =========================================================================
// The system first checks for explicit environment variables, then falls back
// to Replit's connector system if those are not set.
//
// LIVE MODE (production):
//   STRIPE_SECRET_KEY       - Live secret key (starts with sk_live_)
//   STRIPE_PUBLISHABLE_KEY  - Live publishable key (starts with pk_live_)
//   STRIPE_WEBHOOK_SECRET   - Live webhook signing secret (starts with whsec_)
//
// TEST MODE (development/testing):
//   STRIPE_TEST_SECRET_KEY       - Test secret key (starts with sk_test_)
//   STRIPE_TEST_PUBLISHABLE_KEY  - Test publishable key (starts with pk_test_)
//   STRIPE_TEST_WEBHOOK_SECRET   - Test webhook signing secret
//
// MODE SELECTION:
//   STRIPE_MODE - Set to 'test' or 'live' (defaults to 'test' in development, 'live' in production)
//
// PRICING LOOKUP:
//   STRIPE_LOOKUP_KEY - Stripe price lookup key for Founding Partner membership
//                       This allows controlling which price/product is used via environment variable.
//                       The lookup key should match a price's lookup_key in your Stripe dashboard.
//                       If set, the app will use this price instead of searching by product name/metadata.
//                       Supports both one-time payments and recurring subscriptions.
//
// Get your test keys from: https://dashboard.stripe.com/test/apikeys
// Get your live keys from: https://dashboard.stripe.com/apikeys
//
// For Replit users: The Stripe connector automatically manages keys.
// Connect your Stripe account via the Integrations panel.

import Stripe from 'stripe';

let connectionSettings: any;
let cachedCredentials: { publishableKey: string; secretKey: string; webhookSecret?: string } | null = null;

// Determine if we should use test mode
function isTestMode(): boolean {
  // Explicit mode override (highest priority)
  if (process.env.STRIPE_MODE === 'live') return false;
  if (process.env.STRIPE_MODE === 'test') return true;
  
  // Check if we're actually running in production (not just configured for it)
  // Only consider production if:
  // 1. REPLIT_DEPLOYMENT is explicitly '1' (actual Replit deployment)
  // 2. NODE_ENV is explicitly 'production' (not just set in env file)
  // 3. We're NOT in local development (no REPL_ID and NODE_ENV is not 'production')
  const isLocalDev = !process.env.REPLIT_DEPLOYMENT && 
                     process.env.NODE_ENV !== 'production' &&
                     !process.env.REPL_ID;
  
  // If we're in local dev, always use test mode (even if PRODUCTION_DOMAIN is set)
  if (isLocalDev) {
    console.log('[Stripe] Local development detected - using TEST mode');
    return true;
  }
  
  // Production detection (only if not local dev)
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || 
                       process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    console.log('[Stripe] Production environment detected - using LIVE mode');
    return false;
  }
  
  // Default to test mode if ambiguous
  console.log('[Stripe] Ambiguous environment, defaulting to TEST mode');
  return true;
}

// Validate Stripe API keys
function isValidStripeKey(key: string | undefined, keyType: 'secret' | 'publishable'): boolean {
  if (!key || key.trim() === '' || key === 'x') {
    return false;
  }
  
  // Minimum length check (Stripe keys are much longer)
  if (key.length < 10) {
    return false;
  }
  
  // Check for valid Stripe key prefixes
  if (keyType === 'secret') {
    // Secret keys start with sk_test_ or sk_live_
    if (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) {
      return false;
    }
  } else {
    // Publishable keys start with pk_test_ or pk_live_
    if (!key.startsWith('pk_test_') && !key.startsWith('pk_live_')) {
      return false;
    }
  }
  
  return true;
}

// Try to get credentials from environment variables
function getEnvCredentials(): { publishableKey: string; secretKey: string; webhookSecret?: string } | null {
  // Check if we're actually in production (not just configured for it)
  // Only consider production if:
  // 1. REPLIT_DEPLOYMENT is explicitly '1' (actual Replit deployment)
  // 2. NODE_ENV is explicitly 'production' (not just set in env file)
  const isLocalDev = !process.env.REPLIT_DEPLOYMENT && 
                     process.env.NODE_ENV !== 'production' &&
                     !process.env.REPL_ID;
  
  const isProductionEnv = process.env.REPLIT_DEPLOYMENT === '1' || 
                          process.env.NODE_ENV === 'production';
  
  const testMode = isTestMode();
  
  // STRICT MODE: Production uses production keys ONLY, Test uses test keys ONLY
  if (isProductionEnv && process.env.STRIPE_MODE !== 'test') {
    // PRODUCTION MODE: Only use production keys, no fallback
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    
    if (!secretKey || !publishableKey) {
      console.error('[Stripe] ❌ PRODUCTION MODE: STRIPE_SECRET_KEY or STRIPE_PUBLISHABLE_KEY not set. Production requires production keys.');
      return null;
    }
    
    // Validate production keys
    if (!isValidStripeKey(secretKey, 'secret')) {
      console.error('[Stripe] ❌ PRODUCTION MODE: Invalid STRIPE_SECRET_KEY detected (empty, "x", too short, or invalid format). Production requires valid production keys.');
      return null;
    }
    if (!isValidStripeKey(publishableKey, 'publishable')) {
      console.error('[Stripe] ❌ PRODUCTION MODE: Invalid STRIPE_PUBLISHABLE_KEY detected (empty, "x", too short, or invalid format). Production requires valid production keys.');
      return null;
    }
    
    console.log('[Stripe] ✅ PRODUCTION MODE: Using LIVE credentials from environment variables');
    return {
      secretKey,
      publishableKey,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    };
  }
  
  // TEST MODE: Only use test keys, no fallback
  if (testMode) {
    const testSecretKey = process.env.STRIPE_TEST_SECRET_KEY;
    const testPublishableKey = process.env.STRIPE_TEST_PUBLISHABLE_KEY;
    
    if (!testSecretKey || !testPublishableKey) {
      console.error('[Stripe] ❌ TEST MODE: STRIPE_TEST_SECRET_KEY or STRIPE_TEST_PUBLISHABLE_KEY not set. Test mode requires test keys.');
      return null;
    }
    
    // Validate test keys
    if (!isValidStripeKey(testSecretKey, 'secret')) {
      console.error('[Stripe] ❌ TEST MODE: Invalid STRIPE_TEST_SECRET_KEY detected (empty, "x", too short, or invalid format). Test mode requires valid test keys.');
      return null;
    }
    if (!isValidStripeKey(testPublishableKey, 'publishable')) {
      console.error('[Stripe] ❌ TEST MODE: Invalid STRIPE_TEST_PUBLISHABLE_KEY detected (empty, "x", too short, or invalid format). Test mode requires valid test keys.');
      return null;
    }
    
    console.log('[Stripe] ✅ TEST MODE: Using TEST credentials from environment variables');
    return {
      secretKey: testSecretKey,
      publishableKey: testPublishableKey,
      webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET,
    };
  }
  
  // If we get here, we're in an ambiguous state - default to test mode
  console.warn('[Stripe] ⚠️ Ambiguous environment state, defaulting to TEST mode');
  const testSecretKey = process.env.STRIPE_TEST_SECRET_KEY;
  const testPublishableKey = process.env.STRIPE_TEST_PUBLISHABLE_KEY;
  
  if (testSecretKey && testPublishableKey && 
      isValidStripeKey(testSecretKey, 'secret') && 
      isValidStripeKey(testPublishableKey, 'publishable')) {
    console.log('[Stripe] Using TEST mode credentials (default fallback)');
    return {
      secretKey: testSecretKey,
      publishableKey: testPublishableKey,
      webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET,
    };
  }
  
  return null;
}

// Get credentials from Replit connector (fallback)
async function getConnectorCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      'Stripe credentials not found. Please set environment variables:\n' +
      '  For TEST mode: STRIPE_TEST_SECRET_KEY and STRIPE_TEST_PUBLISHABLE_KEY\n' +
      '  For LIVE mode: STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY\n' +
      'Or connect your Stripe account via Replit Integrations panel.'
    );
  }

  const connectorName = 'stripe';
  // Check if we're actually in production (not just configured for it)
  // Only consider production if:
  // 1. REPLIT_DEPLOYMENT is explicitly '1' (actual Replit deployment)
  // 2. NODE_ENV is explicitly 'production' (not just set in env file)
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || 
                       process.env.NODE_ENV === 'production';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  
  connectionSettings = data.items?.[0];

  if (!connectionSettings || (!connectionSettings.settings.publishable || !connectionSettings.settings.secret)) {
    throw new Error(
      `Stripe ${targetEnvironment} connection not found. Please:\n` +
      '1. Connect your Stripe account via Replit Integrations panel, OR\n' +
      '2. Set environment variables (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY)'
    );
  }

  console.log(`[Stripe] Using credentials from Replit connector (${targetEnvironment})`);
  
  const secretKey = connectionSettings.settings.secret;
  const publishableKey = connectionSettings.settings.publishable;
  
  // Validate keys from connector
  if (!isValidStripeKey(secretKey, 'secret')) {
    throw new Error(
      `Invalid Stripe secret key from Replit connector (empty, "x", too short, or invalid format). ` +
      `Please verify your Stripe connector configuration in Replit. ` +
      `Expected format: sk_test_... or sk_live_...`
    );
  }
  if (!isValidStripeKey(publishableKey, 'publishable')) {
    throw new Error(
      `Invalid Stripe publishable key from Replit connector (empty, "x", too short, or invalid format). ` +
      `Please verify your Stripe connector configuration in Replit. ` +
      `Expected format: pk_test_... or pk_live_...`
    );
  }
  
  return {
    publishableKey,
    secretKey,
  };
}

// Main credential getter - checks env vars first, then connector
async function getCredentials(): Promise<{ publishableKey: string; secretKey: string; webhookSecret?: string }> {
  // Return cached credentials if available (but validate them first)
  if (cachedCredentials) {
    // Re-validate cached credentials to ensure they're still valid
    if (isValidStripeKey(cachedCredentials.secretKey, 'secret') && 
        isValidStripeKey(cachedCredentials.publishableKey, 'publishable')) {
      return cachedCredentials;
    } else {
      // Clear invalid cached credentials
      console.warn('[Stripe] Cached credentials are invalid, clearing cache');
      cachedCredentials = null;
    }
  }

  // Log environment variable status for debugging
  const testMode = isTestMode();
  console.log('[Stripe] Credential retrieval:', {
    mode: testMode ? 'TEST' : 'LIVE',
    NODE_ENV: process.env.NODE_ENV,
    REPLIT_DEPLOYMENT: process.env.REPLIT_DEPLOYMENT,
    PRODUCTION_DOMAIN: process.env.PRODUCTION_DOMAIN,
    STRIPE_MODE: process.env.STRIPE_MODE,
    hasSTRIPE_TEST_SECRET_KEY: !!process.env.STRIPE_TEST_SECRET_KEY,
    hasSTRIPE_TEST_PUBLISHABLE_KEY: !!process.env.STRIPE_TEST_PUBLISHABLE_KEY,
    hasSTRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    hasSTRIPE_PUBLISHABLE_KEY: !!process.env.STRIPE_PUBLISHABLE_KEY,
  });

  // Try environment variables first
  const envCreds = getEnvCredentials();
  if (envCreds) {
    cachedCredentials = envCreds;
    return envCreds;
  }

  // Determine mode for error messages (reuse testMode from above)
  
  // Fall back to Replit connector (connector respects production/test mode)
  try {
    const connectorCreds = await getConnectorCredentials();
    cachedCredentials = connectorCreds;
    return connectorCreds;
  } catch (error: any) {
    // Provide helpful error message based on mode
    const errorMessage = error?.message || 'Unknown error';
    console.error('[Stripe] ❌ Failed to get credentials from Replit connector:', errorMessage);
    
    const modeMessage = testMode 
      ? 'TEST mode requires STRIPE_TEST_SECRET_KEY and STRIPE_TEST_PUBLISHABLE_KEY'
      : 'PRODUCTION mode requires STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY';
    
    throw new Error(
      `Stripe credentials not configured for ${testMode ? 'TEST' : 'PRODUCTION'} mode. ${errorMessage}\n\n` +
      `${modeMessage}\n` +
      `Please set the correct environment variables:\n` +
      `  For TEST mode: STRIPE_TEST_SECRET_KEY and STRIPE_TEST_PUBLISHABLE_KEY\n` +
      `  For LIVE mode: STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY\n` +
      `Or connect your Stripe account via Replit Integrations panel.\n\n` +
      `Get your keys from:\n` +
      `  Test keys: https://dashboard.stripe.com/test/apikeys\n` +
      `  Live keys: https://dashboard.stripe.com/apikeys`
    );
  }
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();

  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil',
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

export async function getStripeWebhookSecret(): Promise<string | undefined> {
  const { webhookSecret } = await getCredentials();
  return webhookSecret;
}

// Check if Stripe is properly configured
export async function isStripeConfigured(): Promise<boolean> {
  try {
    await getCredentials();
    return true;
  } catch {
    return false;
  }
}

// Get current Stripe mode for display purposes
export function getStripeMode(): 'test' | 'live' {
  return isTestMode() ? 'test' : 'live';
}

// Get Stripe lookup key from environment variables
// This allows controlling which price/product is used via environment variable
export function getStripeLookupKey(): string | null {
  return process.env.STRIPE_LOOKUP_KEY || null;
}

// Retrieve price by lookup key from Stripe
export async function getPriceByLookupKey(lookupKey: string): Promise<{ price: Stripe.Price; product: Stripe.Product } | null> {
  try {
    const stripe = await getUncachableStripeClient();
    
    // Retrieve price by lookup key
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
    });
    
    if (prices.data.length === 0) {
      console.log(`[Stripe] No price found with lookup key: ${lookupKey}`);
      return null;
    }
    
    const price = prices.data[0];
    console.log(`[Stripe] Found price with lookup key "${lookupKey}":`, {
      priceId: price.id,
      amount: price.unit_amount,
      currency: price.currency,
      type: price.type,
      recurring: price.recurring ? {
        interval: price.recurring.interval,
        intervalCount: price.recurring.interval_count,
      } : null,
      productId: typeof price.product === 'string' ? price.product : price.product?.id,
    });
    
    // Retrieve the product
    const productId = typeof price.product === 'string' ? price.product : price.product?.id;
    if (!productId) {
      console.error(`[Stripe] Price ${price.id} has no product ID`);
      return null;
    }
    
    const product = await stripe.products.retrieve(productId);
    console.log(`[Stripe] Retrieved product for lookup key "${lookupKey}":`, {
      productId: product.id,
      name: product.name,
      description: product.description,
    });
    
    return { price, product };
  } catch (error: any) {
    console.error(`[Stripe] Error retrieving price by lookup key "${lookupKey}":`, error);
    return null;
  }
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
