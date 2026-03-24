-- Normalize any legacy theme values so only light and dark remain in active use.
UPDATE "settings"
SET
  "value" = '"DARK"'::jsonb,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'system.default_theme'
  AND "value" = '"SYSTEM"'::jsonb;

UPDATE "app_users"
SET "preferred_theme" = 'DARK'
WHERE "preferred_theme" = 'SYSTEM';
