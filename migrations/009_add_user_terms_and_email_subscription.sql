-- Add terms acceptance and email subscription tracking to users table

-- Add terms_accepted column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'terms_accepted'
    ) THEN
        ALTER TABLE users ADD COLUMN terms_accepted BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Add email_subscription column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email_subscription'
    ) THEN
        ALTER TABLE users ADD COLUMN email_subscription BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

