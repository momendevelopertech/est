import {
  AppUserRole,
  LocaleCode,
  OperationalRoleScope,
  PrismaClient,
  SettingValueType,
  ThemePreference
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const seedPassword = process.env.SEED_APP_USERS_PASSWORD ?? "ChangeMe123!";

if (seedPassword.length < 8) {
  throw new Error("SEED_APP_USERS_PASSWORD must be at least 8 characters");
}

const assignmentRoles = [
  {
    key: "building_head",
    name: "رئيس المبنى",
    nameEn: "Building head",
    scope: OperationalRoleScope.BUILDING,
    manualOnly: false,
    sortOrder: 10,
    description: "الدور القيادي الأساسي على مستوى المبنى.",
    descriptionEn: "Primary building-level leadership role."
  },
  {
    key: "control_room",
    name: "كنترول",
    nameEn: "Control",
    scope: OperationalRoleScope.BUILDING,
    manualOnly: true,
    sortOrder: 20,
    description: "دور الكنترول يظل يدار يدويا.",
    descriptionEn: "Control assignments stay manual."
  },
  {
    key: "floor_senior",
    name: "مشرف دور",
    nameEn: "Floor senior",
    scope: OperationalRoleScope.FLOOR,
    manualOnly: false,
    sortOrder: 30,
    description: "مشرف مسؤول عن المتابعة على مستوى الدور.",
    descriptionEn: "Supervisor responsible for one floor."
  },
  {
    key: "roaming_monitor",
    name: "مراقب متحرك",
    nameEn: "Roaming monitor",
    scope: OperationalRoleScope.FLOOR,
    manualOnly: false,
    sortOrder: 40,
    description: "دور دعم متحرك بين الغرف.",
    descriptionEn: "Floating support role across rooms."
  },
  {
    key: "room_proctor",
    name: "مراقب لجنة",
    nameEn: "Room proctor",
    scope: OperationalRoleScope.ROOM,
    manualOnly: false,
    sortOrder: 50,
    description: "الدور الأساسي داخل اللجان.",
    descriptionEn: "Primary room-level proctor role."
  },
  {
    key: "assn_manual",
    name: "مراقب ASSN",
    nameEn: "ASSN proctor",
    scope: OperationalRoleScope.ROOM,
    manualOnly: true,
    sortOrder: 60,
    description: "توزيع ASSN يتم يدويا فقط.",
    descriptionEn: "ASSN distribution stays manual only."
  }
] as const;

const settings = [
  {
    key: "system.default_language",
    group: "system",
    label: "اللغة الافتراضية",
    labelEn: "Default language",
    description: "اللغة المستخدمة عند غياب تفضيل محفوظ للمستخدم.",
    descriptionEn: "Language used when the user has no saved preference.",
    type: SettingValueType.STRING,
    value: "AR",
    sortOrder: 10
  },
  {
    key: "system.default_theme",
    group: "system",
    label: "السمة الافتراضية",
    labelEn: "Default theme",
    description: "السمة الأساسية قبل تفعيل تفضيل المستخدم.",
    descriptionEn: "Base theme before a user preference is applied.",
    type: SettingValueType.STRING,
    value: "SYSTEM",
    sortOrder: 20
  },
  {
    key: "distribution.min_rating_threshold",
    group: "distribution",
    label: "الحد الأدنى للتقييم",
    labelEn: "Minimum rating threshold",
    description: "أقل تقييم مسموح به لدخول التوزيع الآلي.",
    descriptionEn: "Minimum rating required for auto-assignment eligibility.",
    type: SettingValueType.NUMBER,
    value: 0,
    sortOrder: 30
  },
  {
    key: "distribution.bad_sessions_for_block",
    group: "distribution",
    label: "عدد الجلسات الضعيفة قبل الحظر",
    labelEn: "Poor sessions before block",
    description: "عدد الجلسات منخفضة الأداء قبل اقتراح الحظر.",
    descriptionEn: "Poor-performance threshold before suggesting a block.",
    type: SettingValueType.NUMBER,
    value: 3,
    sortOrder: 40
  },
  {
    key: "notifications.primary_channel",
    group: "notifications",
    label: "قناة الإرسال الأساسية",
    labelEn: "Primary notification channel",
    description: "القناة الأولى لمحاولات إرسال الإشعارات.",
    descriptionEn: "First channel used when delivering notifications.",
    type: SettingValueType.STRING,
    value: "whatsapp",
    sortOrder: 50
  },
  {
    key: "notifications.fallback_channels",
    group: "notifications",
    label: "قنوات الإرسال الاحتياطية",
    labelEn: "Fallback notification channels",
    description: "ترتيب القنوات البديلة عند تعذر القناة الأساسية.",
    descriptionEn: "Fallback channel order when the primary channel fails.",
    type: SettingValueType.JSON,
    value: ["email", "in_app", "sms"],
    sortOrder: 60
  }
] as const;

const appUsers = [
  {
    email: "admin@examops.local",
    displayName: "ExamOps Admin",
    role: AppUserRole.SUPER_ADMIN,
    preferredLanguage: LocaleCode.AR,
    preferredTheme: ThemePreference.SYSTEM
  },
  {
    email: "coordinator@examops.local",
    displayName: "ExamOps Coordinator",
    role: AppUserRole.COORDINATOR,
    preferredLanguage: LocaleCode.AR,
    preferredTheme: ThemePreference.SYSTEM
  },
  {
    email: "dataentry@examops.local",
    displayName: "ExamOps Data Entry",
    role: AppUserRole.DATA_ENTRY,
    preferredLanguage: LocaleCode.EN,
    preferredTheme: ThemePreference.SYSTEM
  },
  {
    email: "senior@examops.local",
    displayName: "ExamOps Senior",
    role: AppUserRole.SENIOR,
    preferredLanguage: LocaleCode.AR,
    preferredTheme: ThemePreference.SYSTEM
  },
  {
    email: "viewer@examops.local",
    displayName: "ExamOps Viewer",
    role: AppUserRole.VIEWER,
    preferredLanguage: LocaleCode.EN,
    preferredTheme: ThemePreference.SYSTEM
  }
] as const;

async function main() {
  const passwordHash = await hash(seedPassword, 12);

  for (const role of assignmentRoles) {
    await prisma.assignmentRoleDefinition.upsert({
      where: {
        key: role.key
      },
      update: {
        name: role.name,
        nameEn: role.nameEn,
        scope: role.scope,
        manualOnly: role.manualOnly,
        sortOrder: role.sortOrder,
        isSystem: true,
        isActive: true,
        description: role.description,
        descriptionEn: role.descriptionEn
      },
      create: {
        key: role.key,
        name: role.name,
        nameEn: role.nameEn,
        scope: role.scope,
        manualOnly: role.manualOnly,
        sortOrder: role.sortOrder,
        isSystem: true,
        isActive: true,
        description: role.description,
        descriptionEn: role.descriptionEn
      }
    });
  }

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: {
        key: setting.key
      },
      update: {
        group: setting.group,
        label: setting.label,
        labelEn: setting.labelEn,
        description: setting.description,
        descriptionEn: setting.descriptionEn,
        type: setting.type,
        value: setting.value,
        isPublic: false,
        isActive: true,
        sortOrder: setting.sortOrder
      },
      create: {
        key: setting.key,
        group: setting.group,
        label: setting.label,
        labelEn: setting.labelEn,
        description: setting.description,
        descriptionEn: setting.descriptionEn,
        type: setting.type,
        value: setting.value,
        isPublic: false,
        isActive: true,
        sortOrder: setting.sortOrder
      }
    });
  }

  for (const appUser of appUsers) {
    await prisma.appUser.upsert({
      where: {
        email: appUser.email
      },
      update: {
        displayName: appUser.displayName,
        role: appUser.role,
        passwordHash,
        preferredLanguage: appUser.preferredLanguage,
        preferredTheme: appUser.preferredTheme,
        isActive: true
      },
      create: {
        email: appUser.email,
        displayName: appUser.displayName,
        role: appUser.role,
        passwordHash,
        preferredLanguage: appUser.preferredLanguage,
        preferredTheme: appUser.preferredTheme,
        isActive: true
      }
    });
  }

  console.log(
    `Seeded ${assignmentRoles.length} assignment roles, ${settings.length} settings, and ${appUsers.length} app users.`
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
