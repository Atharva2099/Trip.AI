-- Migration: track which model + provider was used to generate each trip.
-- Run: npx wrangler d1 execute tripai-database --remote --file=./migrations/0005_trip_model.sql

ALTER TABLE itineraries ADD COLUMN model TEXT;
ALTER TABLE itineraries ADD COLUMN model_provider TEXT;
