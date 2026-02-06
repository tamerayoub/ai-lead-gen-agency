-- Migration: 018_ensure_org_id_multi_tenancy
-- This migration ensures all data is properly scoped to organizations
-- Fixes any existing data that might have NULL orgId values

DO $$
DECLARE
    orphaned_count INTEGER;
    fixed_count INTEGER;
BEGIN
    RAISE NOTICE 'Starting migration 018: Ensuring org_id multi-tenancy...';
    
    -- Step 1: Fix listings that have NULL orgId by inferring from property
    SELECT COUNT(*) INTO orphaned_count 
    FROM listings l
    INNER JOIN properties p ON l.property_id = p.id
    WHERE l.org_id IS NULL AND p.org_id IS NOT NULL;
    
    IF orphaned_count > 0 THEN
        RAISE NOTICE 'Found % listings with NULL org_id that can be fixed from property', orphaned_count;
        UPDATE listings l
        SET org_id = p.org_id
        FROM properties p
        WHERE l.property_id = p.id
          AND l.org_id IS NULL
          AND p.org_id IS NOT NULL;
        GET DIAGNOSTICS fixed_count = ROW_COUNT;
        RAISE NOTICE 'Fixed % listings by setting org_id from property', fixed_count;
    END IF;
    
    -- Step 2: Fix property_units that have NULL orgId by inferring from property
    SELECT COUNT(*) INTO orphaned_count 
    FROM property_units u
    INNER JOIN properties p ON u.property_id = p.id
    WHERE u.org_id IS NULL AND p.org_id IS NOT NULL;
    
    IF orphaned_count > 0 THEN
        RAISE NOTICE 'Found % property_units with NULL org_id that can be fixed from property', orphaned_count;
        UPDATE property_units u
        SET org_id = p.org_id
        FROM properties p
        WHERE u.property_id = p.id
          AND u.org_id IS NULL
          AND p.org_id IS NOT NULL;
        GET DIAGNOSTICS fixed_count = ROW_COUNT;
        RAISE NOTICE 'Fixed % property_units by setting org_id from property', fixed_count;
    END IF;
    
    -- Step 3: Add org_id column to pending_replies if it doesn't exist, then populate it
    BEGIN
        -- Check if org_id column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'pending_replies' AND column_name = 'org_id'
        ) THEN
            -- Add org_id column
            ALTER TABLE pending_replies 
            ADD COLUMN org_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added org_id column to pending_replies table';
            
            -- Populate org_id from leads
            UPDATE pending_replies pr
            SET org_id = l.org_id
            FROM leads l
            WHERE pr.lead_id = l.id
              AND l.org_id IS NOT NULL;
            GET DIAGNOSTICS fixed_count = ROW_COUNT;
            RAISE NOTICE 'Populated org_id for % pending_replies from leads', fixed_count;
        ELSE
            -- Column exists, just fix NULL values
            SELECT COUNT(*) INTO orphaned_count 
            FROM pending_replies pr
            INNER JOIN leads l ON pr.lead_id = l.id
            WHERE pr.org_id IS NULL AND l.org_id IS NOT NULL;
            
            IF orphaned_count > 0 THEN
                RAISE NOTICE 'Found % pending_replies with NULL org_id that can be fixed from lead', orphaned_count;
                UPDATE pending_replies pr
                SET org_id = l.org_id
                FROM leads l
                WHERE pr.lead_id = l.id
                  AND pr.org_id IS NULL
                  AND l.org_id IS NOT NULL;
                GET DIAGNOSTICS fixed_count = ROW_COUNT;
                RAISE NOTICE 'Fixed % pending_replies by setting org_id from lead', fixed_count;
            END IF;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Error handling pending_replies.org_id: %', SQLERRM;
    END;
    
    -- Step 4: Report any remaining orphaned data (cannot be auto-fixed)
    SELECT COUNT(*) INTO orphaned_count FROM leads WHERE org_id IS NULL;
    IF orphaned_count > 0 THEN
        RAISE WARNING 'Found % leads with NULL org_id that cannot be auto-fixed. These will be deleted.', orphaned_count;
        -- Delete orphaned leads and their related data
        DELETE FROM leads WHERE org_id IS NULL;
        RAISE NOTICE 'Deleted % orphaned leads with NULL org_id', orphaned_count;
    END IF;
    
    SELECT COUNT(*) INTO orphaned_count FROM properties WHERE org_id IS NULL;
    IF orphaned_count > 0 THEN
        RAISE WARNING 'Found % properties with NULL org_id that cannot be auto-fixed. These will be deleted.', orphaned_count;
        -- Delete orphaned properties (cascade will handle units/listings)
        DELETE FROM properties WHERE org_id IS NULL;
        RAISE NOTICE 'Deleted % orphaned properties with NULL org_id', orphaned_count;
    END IF;
    
    SELECT COUNT(*) INTO orphaned_count FROM listings WHERE org_id IS NULL;
    IF orphaned_count > 0 THEN
        RAISE WARNING 'Found % listings with NULL org_id that cannot be auto-fixed. These will be deleted.', orphaned_count;
        DELETE FROM listings WHERE org_id IS NULL;
        RAISE NOTICE 'Deleted % orphaned listings with NULL org_id', orphaned_count;
    END IF;
    
    SELECT COUNT(*) INTO orphaned_count FROM property_units WHERE org_id IS NULL;
    IF orphaned_count > 0 THEN
        RAISE WARNING 'Found % property_units with NULL org_id that cannot be auto-fixed. These will be deleted.', orphaned_count;
        DELETE FROM property_units WHERE org_id IS NULL;
        RAISE NOTICE 'Deleted % orphaned property_units with NULL org_id', orphaned_count;
    END IF;
    
    SELECT COUNT(*) INTO orphaned_count FROM ai_settings WHERE org_id IS NULL;
    IF orphaned_count > 0 THEN
        RAISE WARNING 'Found % ai_settings with NULL org_id. These will be deleted.', orphaned_count;
        DELETE FROM ai_settings WHERE org_id IS NULL;
        RAISE NOTICE 'Deleted % orphaned ai_settings with NULL org_id', orphaned_count;
    END IF;
    
    SELECT COUNT(*) INTO orphaned_count FROM integration_config WHERE org_id IS NULL;
    IF orphaned_count > 0 THEN
        RAISE WARNING 'Found % integration_config with NULL org_id. These will be deleted.', orphaned_count;
        DELETE FROM integration_config WHERE org_id IS NULL;
        RAISE NOTICE 'Deleted % orphaned integration_config with NULL org_id', orphaned_count;
    END IF;
    
    SELECT COUNT(*) INTO orphaned_count FROM pending_replies WHERE org_id IS NULL;
    IF orphaned_count > 0 THEN
        RAISE WARNING 'Found % pending_replies with NULL org_id. These will be deleted.', orphaned_count;
        DELETE FROM pending_replies WHERE org_id IS NULL;
        RAISE NOTICE 'Deleted % orphaned pending_replies with NULL org_id', orphaned_count;
    END IF;
    
    -- Step 5: Add NOT NULL constraints to prevent future NULL values
    -- Make org_id NOT NULL for leads
    BEGIN
        ALTER TABLE leads 
        ALTER COLUMN org_id SET NOT NULL;
        RAISE NOTICE 'Added NOT NULL constraint to leads.org_id';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to add NOT NULL constraint to leads.org_id: %', SQLERRM;
    END;
    
    -- Make org_id NOT NULL for properties
    BEGIN
        ALTER TABLE properties 
        ALTER COLUMN org_id SET NOT NULL;
        RAISE NOTICE 'Added NOT NULL constraint to properties.org_id';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to add NOT NULL constraint to properties.org_id: %', SQLERRM;
    END;
    
    -- Make org_id NOT NULL for listings
    BEGIN
        ALTER TABLE listings 
        ALTER COLUMN org_id SET NOT NULL;
        RAISE NOTICE 'Added NOT NULL constraint to listings.org_id';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to add NOT NULL constraint to listings.org_id: %', SQLERRM;
    END;
    
    -- Make org_id NOT NULL for property_units
    BEGIN
        ALTER TABLE property_units 
        ALTER COLUMN org_id SET NOT NULL;
        RAISE NOTICE 'Added NOT NULL constraint to property_units.org_id';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to add NOT NULL constraint to property_units.org_id: %', SQLERRM;
    END;
    
    -- Make org_id NOT NULL for ai_settings
    BEGIN
        ALTER TABLE ai_settings 
        ALTER COLUMN org_id SET NOT NULL;
        RAISE NOTICE 'Added NOT NULL constraint to ai_settings.org_id';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to add NOT NULL constraint to ai_settings.org_id: %', SQLERRM;
    END;
    
    -- Make org_id NOT NULL for integration_config
    BEGIN
        ALTER TABLE integration_config 
        ALTER COLUMN org_id SET NOT NULL;
        RAISE NOTICE 'Added NOT NULL constraint to integration_config.org_id';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to add NOT NULL constraint to integration_config.org_id: %', SQLERRM;
    END;
    
    -- Make org_id NOT NULL for pending_replies
    BEGIN
        ALTER TABLE pending_replies 
        ALTER COLUMN org_id SET NOT NULL;
        RAISE NOTICE 'Added NOT NULL constraint to pending_replies.org_id';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to add NOT NULL constraint to pending_replies.org_id: %', SQLERRM;
    END;
    
    RAISE NOTICE 'Migration 018 completed successfully: Multi-tenancy constraints added';
END $$;

