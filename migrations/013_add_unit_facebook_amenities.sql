-- Add Facebook Marketplace amenity fields to property_units table
-- These fields match the options available in Facebook when creating a listing

-- Add laundry_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'property_units' AND column_name = 'laundry_type'
    ) THEN
        ALTER TABLE property_units ADD COLUMN laundry_type TEXT;
        COMMENT ON COLUMN property_units.laundry_type IS 'Laundry type: In-unit laundry, Laundry in building, Laundry available, or None';
    END IF;
END $$;

-- Add parking_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'property_units' AND column_name = 'parking_type'
    ) THEN
        ALTER TABLE property_units ADD COLUMN parking_type TEXT;
        COMMENT ON COLUMN property_units.parking_type IS 'Parking type: Garage parking, Street parking, Off-street parking, Parking available, or None';
    END IF;
END $$;

-- Add air_conditioning_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'property_units' AND column_name = 'air_conditioning_type'
    ) THEN
        ALTER TABLE property_units ADD COLUMN air_conditioning_type TEXT;
        COMMENT ON COLUMN property_units.air_conditioning_type IS 'AC type: Central AC, AC Available, or None';
    END IF;
END $$;

-- Add heating_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'property_units' AND column_name = 'heating_type'
    ) THEN
        ALTER TABLE property_units ADD COLUMN heating_type TEXT;
        COMMENT ON COLUMN property_units.heating_type IS 'Heating type: Central Heat, Gas Heat, Electric Heat, Radiator Heat, Heating Available, or None';
    END IF;
END $$;

