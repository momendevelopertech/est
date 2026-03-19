-- Normalize session status into a forward-only state machine.
ALTER TYPE "SessionStatus" RENAME TO "SessionStatus_old";

CREATE TYPE "SessionStatus" AS ENUM (
  'DRAFT',
  'SCHEDULED',
  'LOCKED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "sessions"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "sessions"
ALTER COLUMN "status" TYPE "SessionStatus"
USING (
  CASE "status"::text
    WHEN 'OPEN' THEN 'SCHEDULED'
    WHEN 'ARCHIVED' THEN 'COMPLETED'
    ELSE "status"::text
  END
)::"SessionStatus";

ALTER TABLE "sessions"
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "SessionStatus_old";
