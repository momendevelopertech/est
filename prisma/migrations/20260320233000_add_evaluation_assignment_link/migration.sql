ALTER TABLE "evaluations"
ADD COLUMN "assignment_id" UUID;

CREATE UNIQUE INDEX "evaluations_assignment_id_key"
ON "evaluations"("assignment_id");

ALTER TABLE "evaluations"
ADD CONSTRAINT "evaluations_assignment_id_fkey"
FOREIGN KEY ("assignment_id")
REFERENCES "assignments"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
