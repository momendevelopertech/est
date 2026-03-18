-- CreateEnum
CREATE TYPE "LocaleCode" AS ENUM ('AR', 'EN');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UserSource" AS ENUM ('SPHINX', 'UNIVERSITY', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "AppUserRole" AS ENUM ('SUPER_ADMIN', 'COORDINATOR', 'DATA_ENTRY', 'SENIOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CloneMode" AS ENUM ('STRUCTURE_ONLY', 'STRUCTURE_PLUS_MANAGEMENT', 'FULL');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('EST1', 'EST2', 'EST_ASSN');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('DRAFT', 'OPEN', 'LOCKED', 'COMPLETED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'LOCKED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AssignmentMethod" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "OperationalRoleScope" AS ENUM ('BUILDING', 'FLOOR', 'ROOM');

-- CreateEnum
CREATE TYPE "WaitingListStatus" AS ENUM ('WAITING', 'PROMOTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ABSENT', 'DECLINED');

-- CreateEnum
CREATE TYPE "BlockStatus" AS ENUM ('CLEAR', 'TEMPORARY', 'PERMANENT');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('TEMPORARY', 'PERMANENT');

-- CreateEnum
CREATE TYPE "BlockRecordStatus" AS ENUM ('ACTIVE', 'LIFTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BlockSource" AS ENUM ('MANUAL', 'SUGGESTED', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateTable
CREATE TABLE "governorates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governorates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universities" (
    "id" UUID NOT NULL,
    "governorate_id" UUID NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "address" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "level_number" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "floor_id" UUID NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "room_type" VARCHAR(100) NOT NULL,
    "supported_exam_types" "ExamType"[],
    "capacity_min" INTEGER NOT NULL DEFAULT 0,
    "capacity_max" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "phone" VARCHAR(50) NOT NULL,
    "national_id" VARCHAR(50),
    "email" VARCHAR(255),
    "source" "UserSource" NOT NULL,
    "organization" VARCHAR(255),
    "branch" VARCHAR(255),
    "governorate_id" UUID,
    "average_rating" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "block_status" "BlockStatus" NOT NULL DEFAULT 'CLEAR',
    "block_ends_at" TIMESTAMP(3),
    "preferred_language" "LocaleCode",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_users" (
    "id" UUID NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "password_hash" VARCHAR(255),
    "role" "AppUserRole" NOT NULL,
    "linked_user_id" UUID,
    "preferred_language" "LocaleCode",
    "preferred_theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_sessions" (
    "id" UUID NOT NULL,
    "app_user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_role_definitions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "scope" "OperationalRoleScope" NOT NULL,
    "manual_only" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "description_en" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_role_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100),
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "status" "CycleStatus" NOT NULL DEFAULT 'DRAFT',
    "start_date" DATE,
    "end_date" DATE,
    "source_cycle_id" UUID,
    "clone_mode" "CloneMode",
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "exam_type" "ExamType" NOT NULL,
    "session_date" DATE NOT NULL,
    "day_index" INTEGER,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'DRAFT',
    "locked_at" TIMESTAMP(3),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_buildings" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "floor_id" UUID,
    "room_id" UUID,
    "role_definition_id" UUID NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "assigned_method" "AssignmentMethod" NOT NULL DEFAULT 'AUTO',
    "is_manual_override" BOOLEAN NOT NULL DEFAULT false,
    "override_note" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waiting_list" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "building_id" UUID,
    "role_definition_id" UUID,
    "priority" INTEGER NOT NULL,
    "status" "WaitingListStatus" NOT NULL DEFAULT 'WAITING',
    "entry_source" VARCHAR(100),
    "reason" TEXT,
    "notes" TEXT,
    "promoted_at" TIMESTAMP(3),
    "removed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waiting_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "subject_user_id" UUID NOT NULL,
    "evaluator_app_user_id" UUID NOT NULL,
    "score" DECIMAL(4,2) NOT NULL,
    "criteria_payload" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "checked_in_at" TIMESTAMP(3),
    "updated_by_app_user_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "BlockType" NOT NULL,
    "status" "BlockRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "BlockSource" NOT NULL DEFAULT 'MANUAL',
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "suggestion_context" JSONB,
    "lift_reason" TEXT,
    "lifted_at" TIMESTAMP(3),
    "created_by_app_user_id" UUID,
    "lifted_by_app_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL,
    "actor_app_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "before_payload" JSONB,
    "after_payload" JSONB,
    "metadata" JSONB,
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(150) NOT NULL,
    "group" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "label_en" VARCHAR(255),
    "description" TEXT,
    "description_en" TEXT,
    "type" "SettingValueType" NOT NULL,
    "value" JSONB NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "governorates_code_key" ON "governorates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "governorates_name_key" ON "governorates"("name");

-- CreateIndex
CREATE INDEX "universities_governorate_id_is_active_idx" ON "universities"("governorate_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "universities_governorate_id_code_key" ON "universities"("governorate_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "universities_governorate_id_name_key" ON "universities"("governorate_id", "name");

-- CreateIndex
CREATE INDEX "buildings_university_id_is_active_idx" ON "buildings"("university_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_university_id_code_key" ON "buildings"("university_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_university_id_name_key" ON "buildings"("university_id", "name");

-- CreateIndex
CREATE INDEX "floors_building_id_is_active_idx" ON "floors"("building_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "floors_building_id_code_key" ON "floors"("building_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "floors_building_id_name_key" ON "floors"("building_id", "name");

-- CreateIndex
CREATE INDEX "rooms_floor_id_is_active_idx" ON "rooms"("floor_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_floor_id_code_key" ON "rooms"("floor_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_floor_id_name_key" ON "rooms"("floor_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_national_id_key" ON "users"("national_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_source_is_active_idx" ON "users"("source", "is_active");

-- CreateIndex
CREATE INDEX "users_governorate_id_is_active_idx" ON "users"("governorate_id", "is_active");

-- CreateIndex
CREATE INDEX "users_block_status_is_active_idx" ON "users"("block_status", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_email_key" ON "app_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_phone_key" ON "app_users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_linked_user_id_key" ON "app_users"("linked_user_id");

-- CreateIndex
CREATE INDEX "app_users_role_is_active_idx" ON "app_users"("role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "app_sessions_token_hash_key" ON "app_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "app_sessions_app_user_id_expires_at_idx" ON "app_sessions"("app_user_id", "expires_at");

-- CreateIndex
CREATE INDEX "app_sessions_expires_at_idx" ON "app_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_role_definitions_key_key" ON "assignment_role_definitions"("key");

-- CreateIndex
CREATE INDEX "assignment_role_definitions_scope_is_active_idx" ON "assignment_role_definitions"("scope", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cycles_code_key" ON "cycles"("code");

-- CreateIndex
CREATE INDEX "cycles_status_is_active_idx" ON "cycles"("status", "is_active");

-- CreateIndex
CREATE INDEX "sessions_cycle_id_status_idx" ON "sessions"("cycle_id", "status");

-- CreateIndex
CREATE INDEX "sessions_session_date_exam_type_idx" ON "sessions"("session_date", "exam_type");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_cycle_id_session_date_exam_type_key" ON "sessions"("cycle_id", "session_date", "exam_type");

-- CreateIndex
CREATE INDEX "session_buildings_building_id_is_active_idx" ON "session_buildings"("building_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "session_buildings_session_id_building_id_key" ON "session_buildings"("session_id", "building_id");

-- CreateIndex
CREATE INDEX "assignments_session_id_building_id_status_idx" ON "assignments"("session_id", "building_id", "status");

-- CreateIndex
CREATE INDEX "assignments_session_id_floor_id_idx" ON "assignments"("session_id", "floor_id");

-- CreateIndex
CREATE INDEX "assignments_session_id_room_id_idx" ON "assignments"("session_id", "room_id");

-- CreateIndex
CREATE INDEX "assignments_role_definition_id_status_idx" ON "assignments"("role_definition_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_session_id_user_id_key" ON "assignments"("session_id", "user_id");

-- CreateIndex
CREATE INDEX "waiting_list_session_id_status_priority_idx" ON "waiting_list"("session_id", "status", "priority");

-- CreateIndex
CREATE INDEX "waiting_list_cycle_id_status_idx" ON "waiting_list"("cycle_id", "status");

-- CreateIndex
CREATE INDEX "waiting_list_building_id_status_idx" ON "waiting_list"("building_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "waiting_list_session_id_user_id_key" ON "waiting_list"("session_id", "user_id");

-- CreateIndex
CREATE INDEX "evaluations_subject_user_id_session_id_idx" ON "evaluations"("subject_user_id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_session_id_subject_user_id_evaluator_app_user_i_key" ON "evaluations"("session_id", "subject_user_id", "evaluator_app_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_assignment_id_key" ON "attendance"("assignment_id");

-- CreateIndex
CREATE INDEX "attendance_status_updated_at_idx" ON "attendance"("status", "updated_at");

-- CreateIndex
CREATE INDEX "blocks_user_id_status_idx" ON "blocks"("user_id", "status");

-- CreateIndex
CREATE INDEX "blocks_status_type_idx" ON "blocks"("status", "type");

-- CreateIndex
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "activity_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "activity_log_actor_app_user_id_occurred_at_idx" ON "activity_log"("actor_app_user_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "settings_group_is_active_idx" ON "settings"("group", "is_active");

-- AddForeignKey
ALTER TABLE "universities" ADD CONSTRAINT "universities_governorate_id_fkey" FOREIGN KEY ("governorate_id") REFERENCES "governorates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_governorate_id_fkey" FOREIGN KEY ("governorate_id") REFERENCES "governorates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_linked_user_id_fkey" FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_sessions" ADD CONSTRAINT "app_sessions_app_user_id_fkey" FOREIGN KEY ("app_user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_source_cycle_id_fkey" FOREIGN KEY ("source_cycle_id") REFERENCES "cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_buildings" ADD CONSTRAINT "session_buildings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_buildings" ADD CONSTRAINT "session_buildings_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_role_definition_id_fkey" FOREIGN KEY ("role_definition_id") REFERENCES "assignment_role_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_role_definition_id_fkey" FOREIGN KEY ("role_definition_id") REFERENCES "assignment_role_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evaluator_app_user_id_fkey" FOREIGN KEY ("evaluator_app_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_updated_by_app_user_id_fkey" FOREIGN KEY ("updated_by_app_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_created_by_app_user_id_fkey" FOREIGN KEY ("created_by_app_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_lifted_by_app_user_id_fkey" FOREIGN KEY ("lifted_by_app_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_app_user_id_fkey" FOREIGN KEY ("actor_app_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
