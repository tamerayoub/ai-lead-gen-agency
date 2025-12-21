-- Migration: Add displayOrder columns to properties and property_units tables
-- Created: 2024-01-XX
-- Description: Adds displayOrder column to allow custom ordering of properties and units in the scheduling page

-- Add displayOrder to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- Add displayOrder to property_units table  
ALTER TABLE property_units
ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- Create indexes for better query performance when sorting
CREATE INDEX IF NOT EXISTS idx_properties_display_order ON properties(display_order);
CREATE INDEX IF NOT EXISTS idx_property_units_display_order ON property_units(display_order);

-- Update existing records to have sequential displayOrder based on creation time
-- This ensures existing data has a sensible default order
UPDATE properties 
SET display_order = subquery.row_number - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_number
  FROM properties
) AS subquery
WHERE properties.id = subquery.id;

UPDATE property_units
SET display_order = subquery.row_number - 1
FROM (
  SELECT id, property_id, ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY unit_number) as row_number
  FROM property_units
) AS subquery
WHERE property_units.id = subquery.id;

