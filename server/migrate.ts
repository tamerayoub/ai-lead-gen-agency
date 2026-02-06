import { pool } from "./db.js";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration(migrationFile?: string) {
  const client = await pool.connect();
  
  try {
    // If a specific migration file is provided, run only that one
    if (migrationFile) {
      console.log(`🔄 Starting migration: ${migrationFile}...`);
      const migrationPath = join(__dirname, "..", "migrations", migrationFile);
      const sql = readFileSync(migrationPath, "utf-8");
      await client.query(sql);
      console.log(`✅ Migration ${migrationFile} completed successfully!`);
      return;
    }
    
    // Otherwise, run all migrations in order
    const migrations = [
      "001_add_display_order.sql",
      "002_add_organization_fields.sql",
      "003_add_property_description_amenities.sql",
      "004_add_qualification_settings.sql",
      "005_add_listing_accept_bookings.sql",
      "006_add_organization_name_to_onboarding.sql",
      "007_fix_ai_settings_org_id.sql",  // Fix NULL org_id rows before 008
      "008_add_launch_date_setting.sql",
      "009_add_user_terms_and_email_subscription.sql",
      "010_add_organization_deleted_at.sql",
      "011_add_ai_enabled_to_leads.sql",  // Added missing 011
      "011_add_pending_replies_metadata.sql",
      "012_add_property_address_fields.sql",
      "013_add_unit_facebook_amenities.sql",
      "014_add_unit_pet_friendly_fields.sql",
      "015_add_autopilot_activity_logs.sql",
      "018_ensure_org_id_multi_tenancy.sql",  // Removed missing 016, 017
      "019_add_lead_ai_memory.sql",  // CRITICAL: Adds lead_ai_memory table for conversation memory
      "020_add_property_area_cache.sql",  // Neighborhood nearby places cache (7-day TTL)
      "021_add_booking_idempotency.sql",  // Idempotency for in-chat tour bookings
      "022_add_api_connector_tables.sql",  // API Connector: keys, audit, idempotency, webhooks
      "023_add_external_auth_secrets.sql", // Key Vault secret references for Facebook auth
      "024_add_user_acquisition_fields.sql", // Acquisition attribution: initial_offer, utm_*, landing_page
      "025_add_demo_request_acquisition_fields.sql", // Demo requests acquisition attribution
    ];
    
    for (const migrationFile of migrations) {
      console.log(`🔄 Running migration: ${migrationFile}...`);
      const migrationPath = join(__dirname, "..", "migrations", migrationFile);
      
      try {
        const sql = readFileSync(migrationPath, "utf-8");
        await client.query(sql);
        console.log(`✅ Migration ${migrationFile} completed successfully!`);
      } catch (error: any) {
        // If migration fails because column already exists, that's okay
        if (error.message && error.message.includes('already exists')) {
          console.log(`⚠️  Migration ${migrationFile} skipped (columns already exist)`);
        } else {
          console.error(`❌ Migration ${migrationFile} failed:`, error);
          throw error;
        }
      }
    }
    
    console.log("✅ All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Get migration file from command line arguments if provided
const migrationFile = process.argv[2];

// Always run migration when script is executed
runMigration(migrationFile)
  .then(() => {
    console.log("🎉 Migration script completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration script failed:", error);
    process.exit(1);
  });

export { runMigration };


