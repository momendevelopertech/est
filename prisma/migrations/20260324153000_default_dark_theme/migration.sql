-- Alter app user theme defaults to prefer dark mode on first launch.
ALTER TABLE "app_users"
ALTER COLUMN "preferred_theme" SET DEFAULT 'DARK';

-- Update the system-wide fallback theme used before any user preference exists.
UPDATE "settings"
SET
  "value" = '"DARK"'::jsonb,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'system.default_theme';

-- Bring the local seeded application accounts in line with the new default.
UPDATE "app_users"
SET "preferred_theme" = 'DARK'
WHERE "preferred_theme" = 'SYSTEM'
  AND "email" LIKE '%@examops.local';
