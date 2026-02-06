-- Add separate address fields to properties table
-- Matches schema definition in shared/schema.ts (street, city, state, zipCode fields)

DO $$
BEGIN
    -- Add street column
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'properties' AND column_name = 'street'
    ) THEN
        ALTER TABLE properties
        ADD COLUMN street TEXT;
        
        COMMENT ON COLUMN properties.street IS 'Street address';
    END IF;

    -- Add city column
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'properties' AND column_name = 'city'
    ) THEN
        ALTER TABLE properties
        ADD COLUMN city TEXT;
        
        COMMENT ON COLUMN properties.city IS 'City';
    END IF;

    -- Add state column
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'properties' AND column_name = 'state'
    ) THEN
        ALTER TABLE properties
        ADD COLUMN state TEXT;
        
        COMMENT ON COLUMN properties.state IS 'State (2-letter code)';
    END IF;

    -- Add zip_code column
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'properties' AND column_name = 'zip_code'
    ) THEN
        ALTER TABLE properties
        ADD COLUMN zip_code TEXT;
        
        COMMENT ON COLUMN properties.zip_code IS 'Zip code';
    END IF;
END $$;

-- Update existing records: try to parse address into separate fields
-- This is a best-effort migration - some addresses may not parse correctly
UPDATE properties
SET 
  street = CASE 
    WHEN address ~ '^[^,]+' THEN TRIM(SUBSTRING(address FROM '^[^,]+'))
    ELSE address
  END,
  city = CASE 
    WHEN address ~ ',[^,]+,' THEN TRIM(SUBSTRING(address FROM ',\s*([^,]+),'))
    WHEN address ~ ',\s*[A-Z]{2}\s+\d' THEN TRIM(SUBSTRING(address FROM ',\s*([^,]+?),\s*[A-Z]{2}'))
    WHEN address ~ ',' THEN TRIM(SUBSTRING(address FROM ',\s*([^,]+)'))
    ELSE ''
  END,
  state = CASE 
    WHEN address ~ '[A-Z]{2}\s+\d' THEN UPPER(SUBSTRING(address FROM '([A-Z]{2})\s+\d'))
    WHEN address ~ ',\s*[A-Z]{2}\s*,' THEN UPPER(SUBSTRING(address FROM ',\s*([A-Z]{2})\s*,'))
    ELSE ''
  END,
  zip_code = CASE 
    WHEN address ~ '\d{5}(-\d{4})?' THEN SUBSTRING(address FROM '(\d{5}(?:-\d{4})?)')
    ELSE ''
  END
WHERE (street IS NULL OR street = '') 
   OR (city IS NULL OR city = '') 
   OR (state IS NULL OR state = '') 
   OR (zip_code IS NULL OR zip_code = '');

