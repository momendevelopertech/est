import {
  AppUserRole,
  AssignmentMethod,
  AssignmentStatus,
  AttendanceStatus,
  BlockRecordStatus,
  BlockSource,
  BlockStatus,
  BlockType,
  CycleStatus,
  ExamType,
  LocaleCode,
  OperationalRoleScope,
  PrismaClient,
  SessionStatus,
  SettingValueType,
  ThemePreference,
  UserSource,
  WaitingListStatus
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const seedPassword = process.env.SEED_APP_USERS_PASSWORD ?? "ChangeMe123!";
const seedTag = "release-validation-fixture-2026";
const allowProductionSeed = process.env.ALLOW_PRODUCTION_SEED === "true";

if (seedPassword.length < 8) {
  throw new Error("SEED_APP_USERS_PASSWORD must be at least 8 characters");
}

if (process.env.NODE_ENV === "production" && !allowProductionSeed) {
  throw new Error("Refusing to run prisma seed in production without ALLOW_PRODUCTION_SEED=true");
}

const d = (value: string) => new Date(value);
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const setting = (
  key: string,
  group: string,
  type: SettingValueType,
  value: string | number | boolean | string[],
  sortOrder: number
) => ({
  key,
  group,
  label: key,
  labelEn: key,
  description: key,
  descriptionEn: key,
  type,
  value,
  sortOrder
});

const assignmentRoles = [
  ["building_head", "\u0647\u064a\u062f", "Head", OperationalRoleScope.BUILDING, false, 10],
  ["control_room", "\u0643\u0646\u062a\u0631\u0648\u0644", "Control Room", OperationalRoleScope.BUILDING, true, 20],
  ["floor_senior", "\u0633\u0646\u064a\u0648\u0631", "Senior", OperationalRoleScope.FLOOR, false, 30],
  ["roaming_monitor", "\u0631\u0648\u0645\u064a\u0646\u062c", "Roaming", OperationalRoleScope.FLOOR, false, 40],
  ["room_proctor", "\u0628\u0631\u0648\u0643\u062a\u0648\u0631", "Proctor", OperationalRoleScope.ROOM, false, 50],
  ["assn_manual", "\u0628\u0631\u0648\u0643\u062a\u0648\u0631 ASSN", "ASSN Proctor", OperationalRoleScope.ROOM, true, 60]
] as const;

const settings = [
  setting("system.default_language", "system", SettingValueType.STRING, "AR", 10),
  setting("system.default_theme", "system", SettingValueType.STRING, "SYSTEM", 20),
  setting("distribution.min_rating_threshold", "distribution", SettingValueType.NUMBER, 0, 30),
  setting("distribution.min_sessions_required", "distribution", SettingValueType.NUMBER, 3, 35),
  setting("distribution.min_attendance_ratio", "distribution", SettingValueType.NUMBER, 0.7, 38),
  setting("distribution.bad_sessions_for_block", "distribution", SettingValueType.NUMBER, 3, 40),
  setting("notifications.primary_channel", "notifications", SettingValueType.STRING, "email", 50),
  setting(
    "notifications.fallback_channels",
    "notifications",
    SettingValueType.JSON,
    ["whatsapp", "in_app", "sms"],
    60
  ),
  setting("email_enabled", "notifications", SettingValueType.BOOLEAN, true, 70),
  setting("whatsapp_enabled", "notifications", SettingValueType.BOOLEAN, false, 80),
  setting("whatsapp_provider", "notifications", SettingValueType.STRING, "twilio", 90),
  setting("whatsapp_api_key", "notifications", SettingValueType.STRING, "", 100),
  setting("whatsapp_sender_id", "notifications", SettingValueType.STRING, "", 110),
  setting("whatsapp_account_sid", "notifications", SettingValueType.STRING, "", 120),
  setting("sms_enabled", "notifications", SettingValueType.BOOLEAN, false, 130),
  setting("sms_provider", "notifications", SettingValueType.STRING, "twilio", 140),
  setting("sms_api_key", "notifications", SettingValueType.STRING, "", 150),
  setting("sms_sender_id", "notifications", SettingValueType.STRING, "", 160),
  setting("sms_account_sid", "notifications", SettingValueType.STRING, "", 170),
  setting("notification_preferences.default_email_enabled", "notifications", SettingValueType.BOOLEAN, true, 180),
  setting("notification_preferences.default_whatsapp_enabled", "notifications", SettingValueType.BOOLEAN, true, 190),
  setting("notification_preferences.default_sms_enabled", "notifications", SettingValueType.BOOLEAN, false, 200),
  setting("notification_preferences.default_in_app_enabled", "notifications", SettingValueType.BOOLEAN, true, 210),
  setting("notification_preferences.default_preferred_language", "notifications", SettingValueType.STRING, "", 220),
  setting("monitoring.api_error_alert_threshold", "monitoring", SettingValueType.NUMBER, 5, 230),
  setting("monitoring.api_error_alert_window_minutes", "monitoring", SettingValueType.NUMBER, 5, 240),
  setting("monitoring.notification_failure_alert_threshold", "monitoring", SettingValueType.NUMBER, 5, 250),
  setting("monitoring.notification_failure_alert_window_minutes", "monitoring", SettingValueType.NUMBER, 10, 260)
] as const;

const governorates = {
  ALX: { name: "\u0627\u0644\u0625\u0633\u0643\u0646\u062f\u0631\u064a\u0629", nameEn: "Alexandria", sortOrder: 10 },
  CAI: { name: "\u0627\u0644\u0642\u0627\u0647\u0631\u0629", nameEn: "Cairo", sortOrder: 20 },
  GIZ: { name: "\u0627\u0644\u062c\u064a\u0632\u0629", nameEn: "Giza", sortOrder: 30 },
  MNF: { name: "\u0627\u0644\u0645\u0646\u0648\u0641\u064a\u0629", nameEn: "Menoufia", sortOrder: 40 },
  DMT: { name: "\u062f\u0645\u064a\u0627\u0637", nameEn: "Damietta", sortOrder: 50 }
} as const;

const universities = {
  AAST_ABQ: { governorate: "ALX", name: "\u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0623\u0628\u0648 \u0642\u064a\u0631", nameEn: "Arab Academy Abu Qir", sortOrder: 10 },
  AAST_SHE: { governorate: "CAI", name: "\u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0634\u064a\u0631\u0627\u062a\u0648\u0646", nameEn: "Arab Academy Sheraton", sortOrder: 20 },
  AAST_SV: { governorate: "GIZ", name: "\u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0633\u0645\u0627\u0631\u062a \u0641\u064a\u0644\u062f\u062c", nameEn: "Arab Academy Smart Village", sortOrder: 30 },
  RST: { governorate: "MNF", name: "\u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0631\u064a\u0627\u062f\u0629", nameEn: "Al Ryada University", sortOrder: 40 },
  HUE: { governorate: "DMT", name: "\u062c\u0627\u0645\u0639\u0629 \u062d\u0648\u0631\u0633", nameEn: "Horus University Egypt", sortOrder: 50 },
  FUE: { governorate: "CAI", name: "\u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0645\u0633\u062a\u0642\u0628\u0644", nameEn: "Future University in Egypt", sortOrder: 60 }
} as const;

const buildings = {
  NASR_HQ: {
    university: "AAST_SHE",
    code: "SHE-A",
    name: "\u0645\u0628\u0646\u0649 \u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u0634\u064a\u0631\u0627\u062a\u0648\u0646 A",
    nameEn: "Arab Academy Sheraton Engineering Building A",
    address: "Sheraton, Cairo",
    sortOrder: 10
  },
  ABBAS_ANNEX: {
    university: "AAST_ABQ",
    code: "ABQ-PHAR",
    name: "\u0645\u0628\u0646\u0649 \u0635\u064a\u062f\u0644\u0629 \u0623\u0628\u0648 \u0642\u064a\u0631",
    nameEn: "Arab Academy Abu Qir Faculty of Pharmacy",
    address: "Abu Qir, Alexandria",
    sortOrder: 20
  },
  GIZA_ENG: {
    university: "AAST_SV",
    code: "SV-A",
    name: "\u0645\u0628\u0646\u0649 A \u0633\u0645\u0627\u0631\u062a \u0641\u064a\u0644\u062f\u062c",
    nameEn: "Arab Academy Smart Village Building A",
    address: "Smart Village, Giza",
    sortOrder: 30
  },
  SHE_B: {
    university: "AAST_SHE",
    code: "SHE-B",
    name: "\u0645\u0628\u0646\u0649 \u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u0634\u064a\u0631\u0627\u062a\u0648\u0646 B",
    nameEn: "Arab Academy Sheraton Engineering Building B",
    address: "Sheraton, Cairo",
    sortOrder: 40
  },
  SHE_CITL: {
    university: "AAST_SHE",
    code: "SHE-CITL",
    name: "\u0645\u0628\u0646\u0649 \u0627\u0644\u0646\u0642\u0644 \u0627\u0644\u062f\u0648\u0644\u064a \u0648\u0627\u0644\u0644\u0648\u062c\u0633\u062a\u064a\u0627\u062a",
    nameEn: "Arab Academy Sheraton CITL Building",
    address: "Sheraton, Cairo",
    sortOrder: 50
  },
  ABQ_ENG_B: {
    university: "AAST_ABQ",
    code: "ABQ-ENG-B",
    name: "\u0645\u0628\u0646\u0649 \u0647\u0646\u062f\u0633\u0629 B \u0623\u0628\u0648 \u0642\u064a\u0631",
    nameEn: "Arab Academy Abu Qir Engineering Building B",
    address: "Abu Qir, Alexandria",
    sortOrder: 60
  },
  SV_B: {
    university: "AAST_SV",
    code: "SV-B",
    name: "\u0645\u0628\u0646\u0649 B \u0633\u0645\u0627\u0631\u062a \u0641\u064a\u0644\u062f\u062c",
    nameEn: "Arab Academy Smart Village Building B",
    address: "Smart Village, Giza",
    sortOrder: 70
  },
  FUE_BUS: {
    university: "FUE",
    code: "FUE-BUS",
    name: "\u0645\u0628\u0646\u0649 \u0643\u0644\u064a\u0629 \u0627\u0644\u0628\u064a\u0632\u0646\u0633 \u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0645\u0633\u062a\u0642\u0628\u0644",
    nameEn: "Future University Faculty of Business",
    address: "New Cairo",
    sortOrder: 80
  },
  HUE_ENG: {
    university: "HUE",
    code: "HUE-ENG",
    name: "\u0645\u0628\u0646\u0649 \u0643\u0644\u064a\u0629 \u0627\u0644\u0647\u0646\u062f\u0633\u0629 \u062c\u0627\u0645\u0639\u0629 \u062d\u0648\u0631\u0633",
    nameEn: "Horus University Faculty of Engineering",
    address: "Damietta",
    sortOrder: 90
  },
  RST_MAIN: {
    university: "RST",
    code: "RST-MAIN",
    name: "\u0627\u0644\u0645\u0628\u0646\u0649 \u0627\u0644\u0631\u0626\u064a\u0633\u064a \u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0631\u064a\u0627\u062f\u0629",
    nameEn: "Al Ryada Main Building",
    address: "Sadat City",
    sortOrder: 100
  }
} as const;

const floors = {
  NASR_HQ_F1: { building: "NASR_HQ", code: "F1", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u0623\u0648\u0644", nameEn: "First Floor", level: 1, sortOrder: 10 },
  NASR_HQ_F2: { building: "NASR_HQ", code: "F2", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u062b\u0627\u0646\u064a", nameEn: "Second Floor", level: 2, sortOrder: 20 },
  ABBAS_ANNEX_F1: { building: "ABBAS_ANNEX", code: "F1", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u0623\u0648\u0644", nameEn: "First Floor", level: 1, sortOrder: 10 },
  ABBAS_ANNEX_F2: { building: "ABBAS_ANNEX", code: "F2", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u062b\u0627\u0646\u064a", nameEn: "Second Floor", level: 2, sortOrder: 20 },
  GIZA_ENG_F1: { building: "GIZA_ENG", code: "F1", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u0623\u0648\u0644", nameEn: "First Floor", level: 1, sortOrder: 10 },
  GIZA_ENG_F2: { building: "GIZA_ENG", code: "F2", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u062b\u0627\u0646\u064a", nameEn: "Second Floor", level: 2, sortOrder: 20 },
  SHE_B_F1: { building: "SHE_B", code: "F1", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064a", nameEn: "Ground Floor", level: 0, sortOrder: 10 },
  SHE_B_F2: { building: "SHE_B", code: "F2", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u0623\u0648\u0644", nameEn: "First Floor", level: 1, sortOrder: 20 },
  SHE_CITL_F2: { building: "SHE_CITL", code: "F2", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u062b\u0627\u0646\u064a", nameEn: "Second Floor", level: 2, sortOrder: 10 },
  ABQ_ENG_B_F1: { building: "ABQ_ENG_B", code: "F1", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u0623\u0648\u0644", nameEn: "First Floor", level: 1, sortOrder: 10 },
  ABQ_ENG_B_F2: { building: "ABQ_ENG_B", code: "F2", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u062b\u0627\u0646\u064a", nameEn: "Second Floor", level: 2, sortOrder: 20 },
  SV_B_F1: { building: "SV_B", code: "F1", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u0623\u0648\u0644", nameEn: "First Floor", level: 1, sortOrder: 10 },
  FUE_BUS_F2: { building: "FUE_BUS", code: "F2", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u062b\u0627\u0646\u064a", nameEn: "Second Floor", level: 2, sortOrder: 10 },
  HUE_ENG_F2: { building: "HUE_ENG", code: "F2", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u062b\u0627\u0646\u064a", nameEn: "Second Floor", level: 2, sortOrder: 10 },
  RST_MAIN_F1: { building: "RST_MAIN", code: "F1", name: "\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u0623\u0648\u0644", nameEn: "First Floor", level: 1, sortOrder: 10 }
} as const;

const rooms = {
  NASR_HQ_N101: { floor: "NASR_HQ_F1", code: "A101", name: "\u0644\u062c\u0646\u0629 A101", nameEn: "Room A101", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 20, max: 45 },
  NASR_HQ_N201: { floor: "NASR_HQ_F2", code: "A201", name: "\u0644\u062c\u0646\u0629 A201", nameEn: "Room A201", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 20, max: 40 },
  ABBAS_ANNEX_A101: { floor: "ABBAS_ANNEX_F1", code: "201", name: "\u0644\u062c\u0646\u0629 201", nameEn: "Room 201", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 25, max: 40 },
  ABBAS_ANNEX_A201: { floor: "ABBAS_ANNEX_F2", code: "304", name: "\u0644\u062c\u0646\u0629 304", nameEn: "Room 304", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 25, max: 40 },
  ABBAS_ANNEX_AS1: { floor: "ABBAS_ANNEX_F2", code: "GS001", name: "\u063a\u0631\u0641\u0629 ASSN \u0648\u0623\u0648\u0631\u0627\u0642", nameEn: "ASSN Control Room", roomType: "ASSN", exams: [ExamType.EST_ASSN], min: 8, max: 18 },
  GIZA_ENG_G101: { floor: "GIZA_ENG_F1", code: "A106", name: "\u0644\u062c\u0646\u0629 A106", nameEn: "Room A106", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 25, max: 35 },
  GIZA_ENG_G201: { floor: "GIZA_ENG_F2", code: "A201", name: "\u0644\u062c\u0646\u0629 A201", nameEn: "Room A201", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 25, max: 35 },
  SHE_B_B001: { floor: "SHE_B_F1", code: "B001", name: "\u0644\u062c\u0646\u0629 B001", nameEn: "Room B001", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 20, max: 30 },
  SHE_B_B103: { floor: "SHE_B_F2", code: "B103", name: "\u0644\u062c\u0646\u0629 B103", nameEn: "Room B103", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 20, max: 30 },
  SHE_CITL_201A: { floor: "SHE_CITL_F2", code: "201A", name: "\u0644\u062c\u0646\u0629 201A", nameEn: "Room 201 A", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 25, max: 40 },
  ABQ_ENG_B_100: { floor: "ABQ_ENG_B_F1", code: "100", name: "\u0644\u062c\u0646\u0629 100", nameEn: "Room 100", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 20, max: 25 },
  ABQ_ENG_B_202: { floor: "ABQ_ENG_B_F2", code: "202", name: "\u0644\u062c\u0646\u0629 202", nameEn: "Room 202", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 20, max: 25 },
  SV_B_B104: { floor: "SV_B_F1", code: "B104", name: "\u0644\u062c\u0646\u0629 B104", nameEn: "Room B104", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 25, max: 30 },
  FUE_BUS_F22: { floor: "FUE_BUS_F2", code: "F2.2", name: "\u0644\u062c\u0646\u0629 F2.2", nameEn: "Room F2.2", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 40, max: 50 },
  HUE_ENG_E205: { floor: "HUE_ENG_F2", code: "E205", name: "\u0644\u062c\u0646\u0629 E205", nameEn: "Room E205", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 28, max: 30 },
  RST_MAIN_P024: { floor: "RST_MAIN_F1", code: "P024", name: "\u0644\u062c\u0646\u0629 P024", nameEn: "Room P024", roomType: "STANDARD", exams: [ExamType.EST1, ExamType.EST2], min: 20, max: 20 }
} as const;

const users = {
  coordination_hub: { name: "\u0645\u0643\u062a\u0628 \u062a\u0646\u0633\u064a\u0642 EST", nameEn: "EST Coordination Hub", phone: "+201099110001", email: "seed.coordination.user@example.com", source: UserSource.UNIVERSITY, governorate: "CAI", organization: "ExamOps Coordination", branch: "Sheraton", rating: "4.90", sessions: 22, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.EN, isActive: true },
  senior_supervisor: { name: "\u0645\u0634\u0631\u0641 \u062a\u0634\u063a\u064a\u0644", nameEn: "Operations Senior", phone: "+201099110002", email: "seed.senior.user@example.com", source: UserSource.UNIVERSITY, governorate: "CAI", organization: "ExamOps Operations", branch: "Sheraton", rating: "4.70", sessions: 18, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.AR, isActive: true },
  viewer_observer: { name: "\u0645\u062a\u0627\u0628\u0639 \u062a\u0634\u063a\u064a\u0644\u064a", nameEn: "Operations Viewer", phone: "+201099110003", email: "seed.viewer.user@example.com", source: UserSource.EXTERNAL, governorate: "GIZ", organization: "ExamOps QA", branch: "Smart Village", rating: "4.10", sessions: 9, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.EN, isActive: true },
  proctor_head: { name: "\u0645\u062d\u0645\u0648\u062f \u0635\u0644\u0627\u062d", nameEn: "Mahmoud Salah", phone: "+201099110101", email: "seed.mahmoud.salah@example.com", source: UserSource.SPHINX, governorate: "ALX", organization: "Sphinx Alex", branch: "Alex Team", rating: "4.85", sessions: 24, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.AR, isActive: true },
  floor_senior: { name: "\u0633\u0644\u0645\u0649 \u0647\u0627\u0646\u064a", nameEn: "Salma Hany", phone: "+201099110102", email: "seed.salma.hany@example.com", source: UserSource.UNIVERSITY, governorate: "CAI", organization: "Arab Academy Sheraton", branch: "Engineering Building A", rating: "4.68", sessions: 16, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.AR, isActive: true },
  roaming_monitor: { name: "\u064a\u0648\u0633\u0641 \u0639\u0627\u062f\u0644", nameEn: "Youssef Adel", phone: "+201099110103", email: "seed.youssef.adel@example.com", source: UserSource.EXTERNAL, governorate: "GIZ", organization: "Future University Pool", branch: "Smart Village", rating: "4.55", sessions: 14, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.EN, isActive: true },
  room_proctor_a: { name: "\u0645\u0631\u064a\u0645 \u0646\u0628\u064a\u0644", nameEn: "Mariam Nabil", phone: "+201099110104", email: "seed.mariam.nabil@example.com", source: UserSource.UNIVERSITY, governorate: "CAI", organization: "FUE Employee", branch: "New Cairo", rating: "4.20", sessions: 11, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.EN, isActive: true },
  room_proctor_b: { name: "\u062e\u0627\u0644\u062f \u0639\u0627\u0637\u0641", nameEn: "Khaled Atef", phone: "+201099110105", email: "seed.khaled.atef@example.com", source: UserSource.UNIVERSITY, governorate: "DMT", organization: "HUE Employee", branch: "Damietta", rating: "3.92", sessions: 7, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.AR, isActive: true },
  waiting_candidate: { name: "\u0647\u0628\u0629 \u0633\u0627\u0645\u0631", nameEn: "Heba Samir", phone: "+201099110106", email: "seed.heba.samir@example.com", source: UserSource.UNIVERSITY, governorate: "MNF", organization: "Al Ryada University", branch: "Sadat City", rating: "4.35", sessions: 8, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.AR, isActive: true },
  promoted_candidate: { name: "\u0646\u0648\u0631\u0627 \u062c\u0645\u0627\u0644", nameEn: "Nora Gamal", phone: "+201099110107", email: "seed.nora.gamal@example.com", source: UserSource.EXTERNAL, governorate: "CAI", organization: "UK Marking Pool", branch: "Sheraton", rating: "4.45", sessions: 10, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.EN, isActive: true },
  removed_candidate: { name: "\u0637\u0627\u0631\u0642 \u062d\u0633\u0646", nameEn: "Tarek Hassan", phone: "+201099110108", email: "seed.tarek.hassan@example.com", source: UserSource.EXTERNAL, governorate: "GIZ", organization: "Independent Pool", branch: "Smart Village", rating: "3.10", sessions: 4, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.EN, isActive: true },
  manual_assn_candidate: { name: "\u0631\u0627\u0646\u064a\u0627 \u0645\u062d\u0645\u062f", nameEn: "Rania Mohamed", phone: "+201099110109", email: "seed.rania.mohamed@example.com", source: UserSource.UNIVERSITY, governorate: "ALX", organization: "Arab Academy Abu Qir", branch: "Pharmacy Building", rating: "4.00", sessions: 6, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.AR, isActive: true },
  temp_blocked: { name: "\u0623\u0645\u0644 \u0639\u0644\u064a", nameEn: "Amal Ali", phone: "+201099110110", email: "seed.amal.ali@example.com", source: UserSource.EXTERNAL, governorate: "GIZ", organization: "Independent Pool", branch: "Smart Village", rating: "4.05", sessions: 9, blockStatus: BlockStatus.TEMPORARY, blockEndsAt: d("2026-04-01T00:00:00.000Z"), locale: LocaleCode.AR, isActive: true },
  expired_block: { name: "\u0639\u0645\u0631 \u0641\u062a\u062d\u064a", nameEn: "Omar Fathy", phone: "+201099110111", email: "seed.omar.fathy@example.com", source: UserSource.SPHINX, governorate: "ALX", organization: "Sphinx Alex", branch: "Alex Team", rating: "3.80", sessions: 5, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.EN, isActive: true },
  inactive_user: { name: "\u0644\u064a\u0644\u0649 \u0633\u064a\u062f", nameEn: "Laila Sayed", phone: "+201099110112", email: "seed.laila.sayed@example.com", source: UserSource.UNIVERSITY, governorate: "CAI", organization: "Future University in Egypt", branch: "New Cairo", rating: "4.00", sessions: 8, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.AR, isActive: false },
  ryada_hala: { name: "\u0647\u0627\u0644\u0629 \u0635\u0644\u0627\u062d \u062d\u0627\u0645\u062f \u0639\u0637\u064a\u0629", nameEn: "Hala Salah Hamed Attia", phone: "+201067994949", email: "hala.hamed@rst.edu.eg", source: UserSource.UNIVERSITY, governorate: "MNF", organization: "Al Ryada University", branch: "Sadat City", rating: "4.60", sessions: 12, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.AR, isActive: true },
  hue_ahmed_adel: { name: "\u0623\u062d\u0645\u062f \u0639\u0627\u062f\u0644 \u0648\u0647\u0628\u0629", nameEn: "Ahmed Adel Wahba", phone: "+201060606321", email: "ahawas@horus.edu.eg", source: UserSource.UNIVERSITY, governorate: "DMT", organization: "HUE Employee", branch: "Damietta", rating: "4.30", sessions: 10, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.AR, isActive: true },
  fue_bahaa: { name: "\u0628\u0647\u0627\u0621 \u0627\u0644\u062f\u064a\u0646 \u0628\u064a\u0648\u0645\u064a \u0625\u0645\u0627\u0645 \u0634\u0639\u062a", nameEn: "Bahaa El-Dein Bayoumi Mohamed Emam Shaat", phone: "+201551290610", email: "bahaashaat1990@gmail.com", source: UserSource.UNIVERSITY, governorate: "CAI", organization: "FUE Employee", branch: "New Cairo", rating: "4.25", sessions: 9, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.EN, isActive: true },
  uk_joseph: { name: "\u062c\u0648\u0632\u064a\u0641 \u0646\u0627\u0635\u0631 \u0623\u0646\u0648\u0631 \u0635\u0645\u0648\u0626\u064a\u0644", nameEn: "Joseph Naser Anwr Samoul", phone: "+201211035098", email: "joenaser227@gmail.com", source: UserSource.EXTERNAL, governorate: "CAI", organization: "UK Marking Pool", branch: "Sheraton", rating: "4.10", sessions: 7, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.EN, isActive: true },
  sphinx_tamer: { name: "\u062a\u0627\u0645\u0631 \u0639\u0628\u062f\u0627\u0644\u0633\u062a\u0627\u0631", nameEn: "Tamer Abdel Sattar", phone: "+201068801465", email: "tamerabdelsattar812@gmail.com", source: UserSource.SPHINX, governorate: "DMT", organization: "Sphinx Alex", branch: "Alex Team", rating: "4.40", sessions: 15, blockStatus: BlockStatus.CLEAR, blockEndsAt: null, locale: LocaleCode.AR, isActive: true }
} as const;

const appUsers = [
  { email: "admin@examops.local", displayName: "ExamOps Admin", role: AppUserRole.SUPER_ADMIN, locale: LocaleCode.AR },
  { email: "coordinator@examops.local", displayName: "ExamOps Coordinator", role: AppUserRole.COORDINATOR, locale: LocaleCode.AR },
  { email: "dataentry@examops.local", displayName: "ExamOps Data Entry", role: AppUserRole.DATA_ENTRY, locale: LocaleCode.EN },
  { email: "senior@examops.local", displayName: "ExamOps Senior", role: AppUserRole.SENIOR, locale: LocaleCode.AR },
  { email: "viewer@examops.local", displayName: "ExamOps Viewer", role: AppUserRole.VIEWER, locale: LocaleCode.EN },
  { email: "seed.coordinator@examops.local", displayName: "Seed Coordinator", role: AppUserRole.COORDINATOR, locale: LocaleCode.EN, linkedUserKey: "coordination_hub" },
  { email: "seed.senior@examops.local", displayName: "Seed Senior", role: AppUserRole.SENIOR, locale: LocaleCode.AR, linkedUserKey: "senior_supervisor" },
  { email: "seed.viewer@examops.local", displayName: "Seed Viewer", role: AppUserRole.VIEWER, locale: LocaleCode.EN, linkedUserKey: "viewer_observer" }
] as const;

const cycleFixture = {
  code: "FINAL-VALIDATION-2026",
  name: "\u062f\u0648\u0631\u0629 \u062a\u0634\u063a\u064a\u0644 EST \u064a\u0646\u0627\u064a\u0631 2026",
  nameEn: "EST January 2026 Operations Cycle",
  startDate: day("2026-03-16"),
  endDate: day("2026-03-29")
} as const;

const sessions = {
  completed_est1: { name: "\u062c\u0644\u0633\u0629 EST1 \u0627\u0644\u062c\u0645\u0639\u0629", nameEn: "Friday EST1 Session", examType: ExamType.EST1, date: day("2026-03-18"), startsAt: d("2026-03-18T07:00:00.000Z"), endsAt: d("2026-03-18T09:30:00.000Z"), status: SessionStatus.COMPLETED, dayIndex: 1, buildings: ["ABBAS_ANNEX", "GIZA_ENG"] },
  scheduled_est2: { name: "\u062c\u0644\u0633\u0629 EST2 \u0627\u0644\u0633\u0628\u062a", nameEn: "Saturday EST2 Session", examType: ExamType.EST2, date: day("2026-03-24"), startsAt: d("2026-03-24T07:00:00.000Z"), endsAt: d("2026-03-24T10:00:00.000Z"), status: SessionStatus.SCHEDULED, dayIndex: 2, buildings: ["NASR_HQ", "ABBAS_ANNEX"] },
  locked_assn: { name: "\u062c\u0644\u0633\u0629 ASSN \u0627\u0644\u062a\u062d\u0642\u0642", nameEn: "Locked ASSN Validation Session", examType: ExamType.EST_ASSN, date: day("2026-03-26"), startsAt: d("2026-03-26T08:00:00.000Z"), endsAt: d("2026-03-26T11:00:00.000Z"), status: SessionStatus.LOCKED, dayIndex: 3, buildings: ["NASR_HQ", "GIZA_ENG"] }
} as const;

const assignments = [
  ["completed_est1", "proctor_head", "NASR_HQ", null, null, "building_head", AssignmentStatus.COMPLETED, AssignmentMethod.AUTO, false, null],
  ["completed_est1", "floor_senior", "NASR_HQ", "NASR_HQ_F1", null, "floor_senior", AssignmentStatus.COMPLETED, AssignmentMethod.AUTO, false, null],
  ["completed_est1", "room_proctor_a", "NASR_HQ", "NASR_HQ_F1", "NASR_HQ_N101", "room_proctor", AssignmentStatus.COMPLETED, AssignmentMethod.AUTO, false, null],
  ["completed_est1", "room_proctor_b", "GIZA_ENG", "GIZA_ENG_F1", "GIZA_ENG_G101", "room_proctor", AssignmentStatus.COMPLETED, AssignmentMethod.AUTO, false, null],
  ["completed_est1", "roaming_monitor", "GIZA_ENG", "GIZA_ENG_F1", null, "roaming_monitor", AssignmentStatus.COMPLETED, AssignmentMethod.AUTO, false, null],
  ["scheduled_est2", "proctor_head", "ABBAS_ANNEX", null, null, "building_head", AssignmentStatus.CONFIRMED, AssignmentMethod.AUTO, false, null],
  ["scheduled_est2", "room_proctor_a", "ABBAS_ANNEX", "ABBAS_ANNEX_F1", "ABBAS_ANNEX_A101", "room_proctor", AssignmentStatus.CONFIRMED, AssignmentMethod.AUTO, false, null],
  ["scheduled_est2", "promoted_candidate", "NASR_HQ", "NASR_HQ_F2", "NASR_HQ_N201", "room_proctor", AssignmentStatus.CONFIRMED, AssignmentMethod.MANUAL, true, "promoted_from_waiting_list_seed"],
  ["scheduled_est2", "removed_candidate", "ABBAS_ANNEX", "ABBAS_ANNEX_F2", "ABBAS_ANNEX_A201", "room_proctor", AssignmentStatus.CANCELLED, AssignmentMethod.MANUAL, true, "cancelled_seed_assignment"],
  ["locked_assn", "manual_assn_candidate", "ABBAS_ANNEX", "ABBAS_ANNEX_F2", "ABBAS_ANNEX_AS1", "assn_manual", AssignmentStatus.DRAFT, AssignmentMethod.MANUAL, true, "manual_assn_seed"],
  ["locked_assn", "floor_senior", "GIZA_ENG", "GIZA_ENG_F2", null, "floor_senior", AssignmentStatus.CONFIRMED, AssignmentMethod.MANUAL, true, "locked_session_floor_coverage_seed"]
] as const;

const waitingList = [
  ["scheduled_est2", "waiting_candidate", "ABBAS_ANNEX", "room_proctor", 1, WaitingListStatus.WAITING, "AUTO_RERANK", "Top backup", null, null],
  ["scheduled_est2", "promoted_candidate", "NASR_HQ", "room_proctor", 2, WaitingListStatus.PROMOTED, "AUTO_RERANK", "Promoted into assignment", d("2026-03-23T12:00:00.000Z"), null],
  ["scheduled_est2", "removed_candidate", "ABBAS_ANNEX", "room_proctor", 3, WaitingListStatus.REMOVED, "MANUAL", "Removed after review", null, d("2026-03-23T15:00:00.000Z")]
] as const;

const attendance = [
  ["completed_est1", "proctor_head", AttendanceStatus.CONFIRMED, d("2026-03-18T06:45:00.000Z"), "Arrived early", "admin@examops.local"],
  ["completed_est1", "floor_senior", AttendanceStatus.CONFIRMED, d("2026-03-18T06:50:00.000Z"), "Confirmed on site", "coordinator@examops.local"],
  ["completed_est1", "room_proctor_a", AttendanceStatus.CONFIRMED, d("2026-03-18T06:55:00.000Z"), "Checked in on time", "coordinator@examops.local"],
  ["completed_est1", "room_proctor_b", AttendanceStatus.ABSENT, null, "Did not arrive", "coordinator@examops.local"],
  ["completed_est1", "roaming_monitor", AttendanceStatus.DECLINED, null, "Declined before session", "senior@examops.local"]
] as const;

const evaluations = [
  ["completed_est1", "room_proctor_a", "seed.coordinator@examops.local", "4.80", { punctuality: 5, discipline: 5, communication: 4 }, "Strong performance"],
  ["completed_est1", "room_proctor_b", "coordinator@examops.local", "2.90", { punctuality: 1, discipline: 3, communication: 4 }, "Low score after absence"],
  ["completed_est1", "roaming_monitor", "seed.senior@examops.local", "3.70", { punctuality: 3, discipline: 4, communication: 4 }, "Adequate performance"],
  ["completed_est1", "floor_senior", "admin@examops.local", "4.20", { punctuality: 4, discipline: 4, communication: 4 }, "Consistent supervision"]
] as const;

const blocks = [
  ["temp_blocked", BlockType.TEMPORARY, BlockRecordStatus.ACTIVE, d("2026-03-10T00:00:00.000Z"), d("2026-04-01T00:00:00.000Z"), "Seed active temporary block", "admin@examops.local", null, null],
  ["expired_block", BlockType.TEMPORARY, BlockRecordStatus.EXPIRED, d("2026-02-10T00:00:00.000Z"), d("2026-02-24T00:00:00.000Z"), "Seed expired temporary block", "admin@examops.local", "admin@examops.local", d("2026-02-24T00:00:00.000Z")]
] as const;

const preferences = {
  coordination_hub: [true, true, false, true, LocaleCode.EN],
  senior_supervisor: [true, true, false, true, LocaleCode.AR],
  viewer_observer: [true, false, false, true, LocaleCode.EN],
  proctor_head: [true, true, false, true, LocaleCode.AR],
  floor_senior: [true, true, false, true, LocaleCode.AR],
  room_proctor_a: [true, false, true, true, LocaleCode.EN],
  room_proctor_b: [false, true, true, true, LocaleCode.AR],
  waiting_candidate: [true, true, false, true, LocaleCode.AR],
  promoted_candidate: [false, true, true, true, LocaleCode.EN],
  removed_candidate: [true, false, false, true, LocaleCode.EN],
  manual_assn_candidate: [true, true, false, true, LocaleCode.AR],
  temp_blocked: [true, false, false, true, LocaleCode.AR],
  ryada_hala: [true, true, false, true, LocaleCode.AR],
  hue_ahmed_adel: [true, true, false, true, LocaleCode.AR],
  fue_bahaa: [true, false, true, true, LocaleCode.EN],
  uk_joseph: [true, true, false, true, LocaleCode.EN],
  sphinx_tamer: [true, true, false, true, LocaleCode.AR]
} as const;

const emailTemplates = [
  ["assignment_created", "assignment", "\u062a\u0643\u0644\u064a\u0641 \u062c\u062f\u064a\u062f \u0644\u062c\u0644\u0633\u0629 {{session}}", "New assignment for {{session}}", "\u0645\u0631\u062d\u0628\u0627 {{name}}. \u062a\u0645 \u062a\u0643\u0644\u064a\u0641\u0643 \u0643{{role}} \u0641\u064a {{building}} \u064a\u0648\u0645 {{sessionDate}}.", "Hello {{name}}. You have been assigned as {{role}} in {{building}} on {{sessionDate}}.", ["name", "session", "role", "building", "examType", "sessionDate", "assignmentId", "assignmentStatus", "assignedMethod"]],
  ["attendance_marked", "attendance", "\u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062d\u0636\u0648\u0631", "Attendance updated", "\u062d\u0627\u0644\u0629 \u062d\u0636\u0648\u0631\u0643 \u0623\u0635\u0628\u062d\u062a {{attendanceState}} \u0641\u064a {{session}}.", "Your attendance for {{session}} is now {{attendanceState}}.", ["name", "session", "role", "building", "examType", "sessionDate", "assignmentId", "assignmentStatus", "assignedMethod", "attendanceStatus", "attendanceState"]],
  ["waiting_list_promoted", "waiting_list", "\u062a\u0631\u0642\u064a\u0629 \u0645\u0646 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631", "Promoted from waiting list", "\u062a\u0645 \u062a\u0631\u0642\u064a\u062a\u0643 \u0625\u0644\u0649 \u062a\u0643\u0644\u064a\u0641 {{role}} \u0641\u064a {{building}}.", "You were promoted into the {{role}} assignment in {{building}}.", ["name", "session", "role", "building", "examType", "sessionDate", "assignmentId", "assignmentStatus", "assignedMethod", "waitingListId"]],
  ["assignment_swapped", "assignment", "\u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062a\u0643\u0644\u064a\u0641", "Assignment updated", "\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u062a\u0643\u0644\u064a\u0641\u0643. \u0646\u0648\u0639 \u0627\u0644\u062a\u0639\u062f\u064a\u0644 {{swapKind}}.", "Your assignment was updated. Swap kind: {{swapKind}}.", ["name", "session", "role", "building", "examType", "sessionDate", "assignmentId", "assignmentStatus", "assignedMethod", "swapKind"]],
  ["user_blocked", "block", "\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u062d\u0638\u0631", "Block activated", "\u062d\u0627\u0644\u0629 \u0627\u0644\u062d\u0638\u0631 \u0627\u0644\u062d\u0627\u0644\u064a\u0629 {{blockStatus}}.", "Your current block status is {{blockStatus}}.", ["name", "blockAction", "blockStatus", "blockEndsAt"]],
  ["user_unblocked", "block", "\u062a\u0645 \u0631\u0641\u0639 \u0627\u0644\u062d\u0638\u0631", "Block lifted", "\u062a\u0645 \u0631\u0641\u0639 \u0627\u0644\u062d\u0638\u0631 \u0648\u0623\u0635\u0628\u062d\u062a \u062d\u0627\u0644\u062a\u0643 {{blockStatus}}.", "Your block has been lifted and the current status is {{blockStatus}}.", ["name", "blockAction", "blockStatus", "blockEndsAt"]]
] as const;

async function deactivateStaleSeedMasterData() {
  const activeGovernorateCodes = Object.keys(governorates);
  const activeUniversityCodes = Object.keys(universities);
  const activeBuildingCodes = Object.values(buildings).map((item) => item.code);
  const activeUserPhones = Object.values(users).map((item) => item.phone);

  await prisma.governorate.updateMany({
    where: {
      notes: seedTag,
      isActive: true,
      code: {
        notIn: activeGovernorateCodes
      }
    },
    data: {
      isActive: false
    }
  });

  await prisma.university.updateMany({
    where: {
      notes: seedTag,
      isActive: true,
      code: {
        notIn: activeUniversityCodes
      }
    },
    data: {
      isActive: false
    }
  });

  await prisma.building.updateMany({
    where: {
      notes: seedTag,
      isActive: true,
      code: {
        notIn: activeBuildingCodes
      }
    },
    data: {
      isActive: false
    }
  });

  await prisma.user.updateMany({
    where: {
      notes: seedTag,
      isActive: true,
      phone: {
        notIn: activeUserPhones
      }
    },
    data: {
      isActive: false
    }
  });
}

async function upsertBlock(input: {
  userId: string;
  type: BlockType;
  status: BlockRecordStatus;
  startsAt: Date;
  endsAt: Date | null;
  reason: string;
  createdByAppUserId: string;
  liftedByAppUserId: string | null;
  liftedAt: Date | null;
}) {
  const existing = await prisma.block.findFirst({
    where: { userId: input.userId, reason: input.reason },
    select: { id: true }
  });

  const data = {
    type: input.type,
    status: input.status,
    source: BlockSource.MANUAL,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    reason: input.reason,
    notes: seedTag,
    suggestionContext: { seedTag },
    liftReason: input.liftedAt ? "Automatically expired" : null,
    liftedAt: input.liftedAt,
    createdByAppUserId: input.createdByAppUserId,
    liftedByAppUserId: input.liftedByAppUserId
  };

  if (existing) {
    return prisma.block.update({ where: { id: existing.id }, data });
  }

  return prisma.block.create({ data: { userId: input.userId, ...data } });
}

async function main() {
  const passwordHash = await hash(seedPassword, 12);

  await deactivateStaleSeedMasterData();

  for (const [key, name, nameEn, scope, manualOnly, sortOrder] of assignmentRoles) {
    await prisma.assignmentRoleDefinition.upsert({
      where: { key },
      update: { name, nameEn, scope, manualOnly, sortOrder, isSystem: true, isActive: true, description: nameEn, descriptionEn: nameEn },
      create: { key, name, nameEn, scope, manualOnly, sortOrder, isSystem: true, isActive: true, description: nameEn, descriptionEn: nameEn }
    });
  }

  for (const item of settings) {
    await prisma.setting.upsert({
      where: { key: item.key },
      update: { ...item, isPublic: false, isActive: true },
      create: { ...item, isPublic: false, isActive: true }
    });
  }

  const governorateIds: Record<string, string> = {};
  for (const [code, value] of Object.entries(governorates)) {
    const record = await prisma.governorate.upsert({
      where: { code },
      update: { ...value, isActive: true, notes: seedTag },
      create: { code, ...value, isActive: true, notes: seedTag },
      select: { id: true }
    });
    governorateIds[code] = record.id;
  }

  const universityIds: Record<string, string> = {};
  for (const [code, value] of Object.entries(universities)) {
    const governorateId = governorateIds[value.governorate];
    const record = await prisma.university.upsert({
      where: { governorateId_code: { governorateId, code } },
      update: { name: value.name, nameEn: value.nameEn, sortOrder: value.sortOrder, isActive: true, notes: seedTag },
      create: { governorateId, code, name: value.name, nameEn: value.nameEn, sortOrder: value.sortOrder, isActive: true, notes: seedTag },
      select: { id: true }
    });
    universityIds[code] = record.id;
  }

  const buildingIds: Record<string, string> = {};
  for (const [key, value] of Object.entries(buildings)) {
    const universityId = universityIds[value.university];
    const record = await prisma.building.upsert({
      where: { universityId_code: { universityId, code: value.code } },
      update: { name: value.name, nameEn: value.nameEn, address: value.address, sortOrder: value.sortOrder, isActive: true, notes: seedTag },
      create: { universityId, code: value.code, name: value.name, nameEn: value.nameEn, address: value.address, sortOrder: value.sortOrder, isActive: true, notes: seedTag },
      select: { id: true }
    });
    buildingIds[key] = record.id;
  }

  const floorIds: Record<string, string> = {};
  for (const [key, value] of Object.entries(floors)) {
    const buildingId = buildingIds[value.building];
    const record = await prisma.floor.upsert({
      where: { buildingId_code: { buildingId, code: value.code } },
      update: { name: value.name, nameEn: value.nameEn, levelNumber: value.level, sortOrder: value.sortOrder, isActive: true, notes: seedTag },
      create: { buildingId, code: value.code, name: value.name, nameEn: value.nameEn, levelNumber: value.level, sortOrder: value.sortOrder, isActive: true, notes: seedTag },
      select: { id: true }
    });
    floorIds[key] = record.id;
  }

  const roomIds: Record<string, string> = {};
  for (const [key, value] of Object.entries(rooms)) {
    const floorId = floorIds[value.floor];
    const record = await prisma.room.upsert({
      where: { floorId_code: { floorId, code: value.code } },
      update: { name: value.name, nameEn: value.nameEn, roomType: value.roomType, supportedExamTypes: [...value.exams], capacityMin: value.min, capacityMax: value.max, isActive: true, notes: seedTag },
      create: { floorId, code: value.code, name: value.name, nameEn: value.nameEn, roomType: value.roomType, supportedExamTypes: [...value.exams], capacityMin: value.min, capacityMax: value.max, isActive: true, notes: seedTag },
      select: { id: true }
    });
    roomIds[key] = record.id;
  }

  const userIds: Record<string, string> = {};
  for (const [key, value] of Object.entries(users)) {
    const record = await prisma.user.upsert({
      where: { phone: value.phone },
      update: {
        name: value.name,
        nameEn: value.nameEn,
        email: value.email,
        source: value.source,
        organization: value.organization,
        branch: value.branch,
        governorateId: governorateIds[value.governorate],
        averageRating: value.rating,
        totalSessions: value.sessions,
        blockStatus: value.blockStatus,
        blockEndsAt: value.blockEndsAt,
        preferredLanguage: value.locale,
        isActive: value.isActive,
        notes: seedTag
      },
      create: {
        name: value.name,
        nameEn: value.nameEn,
        phone: value.phone,
        email: value.email,
        source: value.source,
        organization: value.organization,
        branch: value.branch,
        governorateId: governorateIds[value.governorate],
        averageRating: value.rating,
        totalSessions: value.sessions,
        blockStatus: value.blockStatus,
        blockEndsAt: value.blockEndsAt,
        preferredLanguage: value.locale,
        isActive: value.isActive,
        notes: seedTag
      },
      select: { id: true }
    });
    userIds[key] = record.id;
  }

  const appUserIds: Record<string, string> = {};
  for (const appUser of appUsers) {
    const linkedUserId = "linkedUserKey" in appUser && appUser.linkedUserKey ? userIds[appUser.linkedUserKey] : undefined;
    const record = await prisma.appUser.upsert({
      where: { email: appUser.email },
      update: {
        displayName: appUser.displayName,
        role: appUser.role,
        passwordHash,
        preferredLanguage: appUser.locale,
        preferredTheme: ThemePreference.SYSTEM,
        isActive: true,
        ...(linkedUserId ? { linkedUserId } : {})
      },
      create: {
        email: appUser.email,
        displayName: appUser.displayName,
        role: appUser.role,
        passwordHash,
        preferredLanguage: appUser.locale,
        preferredTheme: ThemePreference.SYSTEM,
        isActive: true,
        ...(linkedUserId ? { linkedUserId } : {})
      },
      select: { id: true }
    });
    appUserIds[appUser.email] = record.id;
  }

  for (const [key, type, subjectAr, subjectEn, bodyAr, bodyEn, variables] of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { key },
      update: { type, subjectAr, subjectEn, bodyAr, bodyEn, variables, isActive: true },
      create: { key, type, subjectAr, subjectEn, bodyAr, bodyEn, variables, isActive: true }
    });
  }

  const cycle = await prisma.cycle.upsert({
    where: { code: cycleFixture.code },
    update: { name: cycleFixture.name, nameEn: cycleFixture.nameEn, status: CycleStatus.ACTIVE, startDate: cycleFixture.startDate, endDate: cycleFixture.endDate, notes: seedTag, isActive: true },
    create: { code: cycleFixture.code, name: cycleFixture.name, nameEn: cycleFixture.nameEn, status: CycleStatus.ACTIVE, startDate: cycleFixture.startDate, endDate: cycleFixture.endDate, notes: seedTag, isActive: true },
    select: { id: true }
  });

  const sessionIds: Record<string, string> = {};
  for (const [key, value] of Object.entries(sessions)) {
    const record = await prisma.session.upsert({
      where: { cycleId_sessionDate_examType: { cycleId: cycle.id, sessionDate: value.date, examType: value.examType } },
      update: { name: value.name, nameEn: value.nameEn, startsAt: value.startsAt, endsAt: value.endsAt, status: value.status, dayIndex: value.dayIndex, notes: seedTag, isActive: true },
      create: { cycleId: cycle.id, name: value.name, nameEn: value.nameEn, examType: value.examType, sessionDate: value.date, startsAt: value.startsAt, endsAt: value.endsAt, status: value.status, dayIndex: value.dayIndex, notes: seedTag, isActive: true },
      select: { id: true }
    });
    sessionIds[key] = record.id;
    for (const buildingKey of value.buildings) {
      await prisma.sessionBuilding.upsert({
        where: { sessionId_buildingId: { sessionId: record.id, buildingId: buildingIds[buildingKey] } },
        update: { isActive: true, notes: seedTag },
        create: { sessionId: record.id, buildingId: buildingIds[buildingKey], isActive: true, notes: seedTag }
      });
    }
  }

  const roleIds = Object.fromEntries(
    (
      await prisma.assignmentRoleDefinition.findMany({
        where: { key: { in: assignmentRoles.map((item) => item[0]) } },
        select: { key: true, id: true }
      })
    ).map((item) => [item.key, item.id])
  ) as Record<string, string>;

  const assignmentIds: Record<string, string> = {};
  for (const [sessionKey, userKey, buildingKey, floorKey, roomKey, roleKey, status, method, manualOverride, overrideNote] of assignments) {
    const sessionId = sessionIds[sessionKey];
    const userId = userIds[userKey];
    const record = await prisma.assignment.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      update: {
        buildingId: buildingIds[buildingKey],
        floorId: floorKey ? floorIds[floorKey] : null,
        roomId: roomKey ? roomIds[roomKey] : null,
        roleDefinitionId: roleIds[roleKey],
        status,
        assignedMethod: method,
        isManualOverride: manualOverride,
        overrideNote
      },
      create: {
        sessionId,
        userId,
        buildingId: buildingIds[buildingKey],
        floorId: floorKey ? floorIds[floorKey] : null,
        roomId: roomKey ? roomIds[roomKey] : null,
        roleDefinitionId: roleIds[roleKey],
        status,
        assignedMethod: method,
        isManualOverride: manualOverride,
        overrideNote
      },
      select: { id: true }
    });
    assignmentIds[`${sessionKey}:${userKey}`] = record.id;
  }

  for (const [sessionKey, userKey, buildingKey, roleKey, priority, status, entrySource, reason, promotedAt, removedAt] of waitingList) {
    await prisma.waitingList.upsert({
      where: { sessionId_userId: { sessionId: sessionIds[sessionKey], userId: userIds[userKey] } },
      update: { cycleId: cycle.id, buildingId: buildingIds[buildingKey], roleDefinitionId: roleIds[roleKey], priority, status, entrySource, reason, notes: seedTag, promotedAt, removedAt },
      create: { sessionId: sessionIds[sessionKey], cycleId: cycle.id, userId: userIds[userKey], buildingId: buildingIds[buildingKey], roleDefinitionId: roleIds[roleKey], priority, status, entrySource, reason, notes: seedTag, promotedAt, removedAt }
    });
  }

  for (const [sessionKey, userKey, status, checkedInAt, notes, actorEmail] of attendance) {
    await prisma.attendance.upsert({
      where: { assignmentId: assignmentIds[`${sessionKey}:${userKey}`] },
      update: { status, checkedInAt, notes, updatedByAppUserId: appUserIds[actorEmail] },
      create: { assignmentId: assignmentIds[`${sessionKey}:${userKey}`], status, checkedInAt, notes, updatedByAppUserId: appUserIds[actorEmail] }
    });
  }

  for (const [sessionKey, userKey, actorEmail, score, criteriaPayload, notes] of evaluations) {
    await prisma.evaluation.upsert({
      where: {
        sessionId_subjectUserId_evaluatorAppUserId: {
          sessionId: sessionIds[sessionKey],
          subjectUserId: userIds[userKey],
          evaluatorAppUserId: appUserIds[actorEmail]
        }
      },
      update: { assignmentId: assignmentIds[`${sessionKey}:${userKey}`], score, criteriaPayload, notes },
      create: { sessionId: sessionIds[sessionKey], subjectUserId: userIds[userKey], evaluatorAppUserId: appUserIds[actorEmail], assignmentId: assignmentIds[`${sessionKey}:${userKey}`], score, criteriaPayload, notes }
    });
  }

  for (const [userKey, emailEnabled, whatsappEnabled, smsEnabled, inAppEnabled, preferredLanguage] of Object.entries(preferences).map(([key, value]) => [key, ...value] as const)) {
    await prisma.notificationPreference.upsert({
      where: { userId: userIds[userKey] },
      update: { emailEnabled, whatsappEnabled, smsEnabled, inAppEnabled, preferredLanguage },
      create: { userId: userIds[userKey], emailEnabled, whatsappEnabled, smsEnabled, inAppEnabled, preferredLanguage }
    });
  }

  for (const [userKey, type, status, startsAt, endsAt, reason, createdByEmail, liftedByEmail, liftedAt] of blocks) {
    await upsertBlock({
      userId: userIds[userKey],
      type,
      status,
      startsAt,
      endsAt,
      reason,
      createdByAppUserId: appUserIds[createdByEmail],
      liftedByAppUserId: liftedByEmail ? appUserIds[liftedByEmail] : null,
      liftedAt
    });
  }

  console.log(
    [
      `roles=${assignmentRoles.length}`,
      `settings=${settings.length}`,
      `appUsers=${appUsers.length}`,
      `buildings=${Object.keys(buildings).length}`,
      `rooms=${Object.keys(rooms).length}`,
      `sessions=${Object.keys(sessions).length}`,
      `assignments=${assignments.length}`,
      `waitingList=${waitingList.length}`,
      `attendance=${attendance.length}`,
      `evaluations=${evaluations.length}`,
      `blocks=${blocks.length}`,
      `preferences=${Object.keys(preferences).length}`,
      `templates=${emailTemplates.length}`,
      `tag=${seedTag}`
    ].join(" ")
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
