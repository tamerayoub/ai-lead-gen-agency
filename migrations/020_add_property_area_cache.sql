-- Migration: Add property_area_cache table for neighborhood/nearby places
-- Caches OpenAI web search results for nearby places (TTL 7 days)
-- Keyed by (property_id, radius_meters, categories_hash)

CREATE TABLE IF NOT EXISTS property_area_cache (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id VARCHAR NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  radius_meters INTEGER NOT NULL DEFAULT 800,
  categories_hash VARCHAR NOT NULL,
  result_json JSONB NOT NULL,
  provider_name VARCHAR NOT NULL DEFAULT 'openai_web_search',
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_area_cache_lookup 
  ON property_area_cache(property_id, radius_meters, categories_hash);

CREATE INDEX IF NOT EXISTS idx_property_area_cache_expires 
  ON property_area_cache(expires_at);

COMMENT ON TABLE property_area_cache IS 'Caches nearby places web search results for properties (7-day TTL)';
