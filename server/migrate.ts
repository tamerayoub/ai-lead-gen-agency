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
      "008_add_launch_date_setting.sql",
      "009_add_user_terms_and_email_subscription.sql",
      "010_add_organization_deleted_at.sql",
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

// Always run migration when script is executed
runMigration()
  .then(() => {
    console.log("🎉 Migration script completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration script failed:", error);
    process.exit(1);
  });

export { runMigration };


