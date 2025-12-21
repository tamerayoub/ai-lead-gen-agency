-- Add missing columns to organizations table
-- These columns are defined in the schema but may not exist in the database yet

-- Add email column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'email'
    ) THEN
        ALTER TABLE organizations ADD COLUMN email TEXT;
    END IF;
END $$;

-- Add address column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'address'
    ) THEN
        ALTER TABLE organizations ADD COLUMN address TEXT;
    END IF;
END $$;

-- Add phone column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'phone'
    ) THEN
        ALTER TABLE organizations ADD COLUMN phone TEXT;
    END IF;
END $$;

-- Add profile_image column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'profile_image'
    ) THEN
        ALTER TABLE organizations ADD COLUMN profile_image TEXT;
    END IF;
END $$;

