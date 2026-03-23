CREATE TYPE "ProctorOperationalRole" AS ENUM (
  'HEAD',
  'SENIOR',
  'ROAMING',
  'PROCTOR',
  'CONTROL',
  'SERVICE'
);

ALTER TABLE "users"
ADD COLUMN "operational_role" "ProctorOperationalRole";

CREATE INDEX "users_operational_role_is_active_idx"
ON "users"("operational_role", "is_active");
