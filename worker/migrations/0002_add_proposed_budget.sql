-- Migration: Add proposed_budget column to itineraries
-- Run: npx wrangler d1 execute tripai-database --remote --file=./migrations/0002_add_proposed_budget.sql

ALTER TABLE itineraries ADD COLUMN proposed_budget INTEGER;
