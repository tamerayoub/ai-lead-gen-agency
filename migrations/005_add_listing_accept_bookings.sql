-- Add accept_bookings field to listings table
-- Migration: 005_add_listing_accept_bookings

ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS accept_bookings BOOLEAN NOT NULL DEFAULT true;

