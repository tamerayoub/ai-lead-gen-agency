import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load environment variables from .env file FIRST
// Try loading from server directory first, then parent directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });
dotenv.config({ path: resolve(__dirname, "../../.env") });

// Check if DATABASE_URL is set BEFORE importing db (which requires it)
if (!process.env.DATABASE_URL) {
  console.error("[Clear Subscriptions] ❌ ERROR: DATABASE_URL environment variable is not set!");
  console.error("[Clear Subscriptions] Please set DATABASE_URL before running this script.");
  console.error("[Clear Subscriptions] You can either:");
  console.error("[Clear Subscriptions]   1. Set it as an environment variable:");
  console.error("[Clear Subscriptions]      PowerShell: $env:DATABASE_URL='your-db-url'");
  console.error("[Clear Subscriptions]      CMD: set DATABASE_URL=your-db-url");
  console.error("[Clear Subscriptions]   2. Create a .env file in the server or root directory with: DATABASE_URL=your-db-url");
  process.exit(1);
}

/**
 * Script to clear all subscription data from organizations table
 * This will reset all organizations to have no subscription
 * 
 * Usage:
 *   Set DATABASE_URL environment variable or create a .env file with DATABASE_URL
 *   Then run: npx tsx server/scripts/clear-subscriptions.ts (from root) or npx tsx scripts/clear-subscriptions.ts (from server/)
 */
async function clearSubscriptions() {
  // Dynamically import db and schema AFTER checking DATABASE_URL
  const { db } = await import("../db");
  const { organizations } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  
  try {
    console.log("[Clear Subscriptions] Starting to clear subscription data...");
    console.log("[Clear Subscriptions] DATABASE_URL is set:", !!process.env.DATABASE_URL);
    
    // Clear all organizations with any subscription status
    const result = await db.update(organizations)
      .set({
        foundingPartnerStatus: 'none',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        subscriptionCurrentPeriodEnd: null,
        subscriptionCancelledAt: null,
        updatedAt: new Date(),
      });
    
    console.log("[Clear Subscriptions] Cleared subscription data from all organizations");
    console.log("[Clear Subscriptions] Result:", result);
    
    console.log("[Clear Subscriptions] ✅ Successfully cleared all subscription data");
  } catch (error) {
    console.error("[Clear Subscriptions] ❌ Error clearing subscriptions:", error);
    throw error;
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) ||
                     process.argv[1]?.includes('clear-subscriptions.ts');

if (isMainModule || import.meta.url.includes('clear-subscriptions.ts')) {
  clearSubscriptions()
    .then(() => {
      console.log("[Clear Subscriptions] Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[Clear Subscriptions] Failed:", error);
      process.exit(1);
    });
}

export { clearSubscriptions };

