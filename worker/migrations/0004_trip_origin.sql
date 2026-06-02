-- Migration: track the trip's home city for round-trip planning.
-- Run: npx wrangler d1 execute tripai-database --remote --file=./migrations/0004_trip_origin.sql

ALTER TABLE itineraries ADD COLUMN from_city TEXT;
ALTER TABLE itineraries ADD COLUMN from_country TEXT;
