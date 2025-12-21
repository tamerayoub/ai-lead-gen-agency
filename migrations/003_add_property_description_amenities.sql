-- Add description and amenities columns to properties table
-- Migration: 003_add_property_description_amenities

-- Add description column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' AND column_name = 'description'
    ) THEN
        ALTER TABLE properties ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add amenities column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' AND column_name = 'amenities'
    ) THEN
        ALTER TABLE properties ADD COLUMN amenities TEXT[];
    END IF;
END $$;

