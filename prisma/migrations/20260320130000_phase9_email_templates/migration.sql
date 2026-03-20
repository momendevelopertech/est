-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL,
    "key" VARCHAR(150) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "subject_ar" VARCHAR(500) NOT NULL,
    "subject_en" VARCHAR(500) NOT NULL,
    "body_ar" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_key_key" ON "email_templates"("key");

-- CreateIndex
CREATE INDEX "email_templates_type_is_active_idx" ON "email_templates"("type", "is_active");

-- CreateIndex
CREATE INDEX "email_templates_is_active_updated_at_idx" ON "email_templates"("is_active", "updated_at");
