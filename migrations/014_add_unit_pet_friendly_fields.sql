-- Add pet-friendly fields to property_units table
-- These fields match the options available in Facebook when creating a listing

-- Add cat_friendly column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'property_units' AND column_name = 'cat_friendly'
    ) THEN
        ALTER TABLE property_units ADD COLUMN cat_friendly BOOLEAN DEFAULT false;
        COMMENT ON COLUMN property_units.cat_friendly IS 'Whether the unit allows cats';
    END IF;
END $$;

-- Add dog_friendly column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'property_units' AND column_name = 'dog_friendly'
    ) THEN
        ALTER TABLE property_units ADD COLUMN dog_friendly BOOLEAN DEFAULT false;
        COMMENT ON COLUMN property_units.dog_friendly IS 'Whether the unit allows dogs';
    END IF;
END $$;

