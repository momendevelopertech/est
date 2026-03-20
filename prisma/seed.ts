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
    value: "email",
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
    value: ["whatsapp", "in_app", "sms"],
    sortOrder: 60
  },
  {
    key: "email_enabled",
    group: "notifications",
    label: "Email Enabled",
    labelEn: "Email Enabled",
    description: "Enable or disable email notification preparation.",
    descriptionEn: "Enable or disable email notification preparation.",
    type: SettingValueType.BOOLEAN,
    value: true,
    sortOrder: 65
  },
  {
    key: "whatsapp_enabled",
    group: "notifications",
    label: "WhatsApp Enabled",
    labelEn: "WhatsApp Enabled",
    description: "Enable or disable WhatsApp delivery attempts.",
    descriptionEn: "Enable or disable WhatsApp delivery attempts.",
    type: SettingValueType.BOOLEAN,
    value: false,
    sortOrder: 70
  },
  {
    key: "whatsapp_provider",
    group: "notifications",
    label: "WhatsApp Provider",
    labelEn: "WhatsApp Provider",
    description: "Provider key used for WhatsApp delivery.",
    descriptionEn: "Provider key used for WhatsApp delivery.",
    type: SettingValueType.STRING,
    value: "twilio",
    sortOrder: 80
  },
  {
    key: "whatsapp_api_key",
    group: "notifications",
    label: "WhatsApp API Key",
    labelEn: "WhatsApp API Key",
    description: "Provider token or API key for WhatsApp delivery.",
    descriptionEn: "Provider token or API key for WhatsApp delivery.",
    type: SettingValueType.STRING,
    value: "",
    sortOrder: 90
  },
  {
    key: "whatsapp_sender_id",
    group: "notifications",
    label: "WhatsApp Sender ID",
    labelEn: "WhatsApp Sender ID",
    description: "Sender ID or from number for WhatsApp messages.",
    descriptionEn: "Sender ID or from number for WhatsApp messages.",
    type: SettingValueType.STRING,
    value: "",
    sortOrder: 100
  },
  {
    key: "whatsapp_account_sid",
    group: "notifications",
    label: "WhatsApp Account SID",
    labelEn: "WhatsApp Account SID",
    description: "Optional account SID used by Twilio provider.",
    descriptionEn: "Optional account SID used by Twilio provider.",
    type: SettingValueType.STRING,
    value: "",
    sortOrder: 110
  },
  {
    key: "sms_enabled",
    group: "notifications",
    label: "SMS Enabled",
    labelEn: "SMS Enabled",
    description: "Enable or disable SMS fallback delivery attempts.",
    descriptionEn: "Enable or disable SMS fallback delivery attempts.",
    type: SettingValueType.BOOLEAN,
    value: false,
    sortOrder: 120
  },
  {
    key: "sms_provider",
    group: "notifications",
    label: "SMS Provider",
    labelEn: "SMS Provider",
    description: "Provider key used for SMS fallback delivery.",
    descriptionEn: "Provider key used for SMS fallback delivery.",
    type: SettingValueType.STRING,
    value: "twilio",
    sortOrder: 130
  },
  {
    key: "sms_api_key",
    group: "notifications",
    label: "SMS API Key",
    labelEn: "SMS API Key",
    description: "Provider token or API key for SMS fallback delivery.",
    descriptionEn: "Provider token or API key for SMS fallback delivery.",
    type: SettingValueType.STRING,
    value: "",
    sortOrder: 140
  },
  {
    key: "sms_sender_id",
    group: "notifications",
    label: "SMS Sender ID",
    labelEn: "SMS Sender ID",
    description: "Sender ID or from number for SMS fallback messages.",
    descriptionEn: "Sender ID or from number for SMS fallback messages.",
    type: SettingValueType.STRING,
    value: "",
    sortOrder: 150
  },
  {
    key: "sms_account_sid",
    group: "notifications",
    label: "SMS Account SID",
    labelEn: "SMS Account SID",
    description: "Optional account SID used by Twilio SMS provider.",
    descriptionEn: "Optional account SID used by Twilio SMS provider.",
    type: SettingValueType.STRING,
    value: "",
    sortOrder: 160
  },
  {
    key: "notification_preferences.default_email_enabled",
    group: "notifications",
    label: "Notification Preferences Default Email",
    labelEn: "Notification Preferences Default Email",
    description: "Default email channel toggle for new user notification preferences.",
    descriptionEn:
      "Default email channel toggle for new user notification preferences.",
    type: SettingValueType.BOOLEAN,
    value: true,
    sortOrder: 170
  },
  {
    key: "notification_preferences.default_whatsapp_enabled",
    group: "notifications",
    label: "Notification Preferences Default WhatsApp",
    labelEn: "Notification Preferences Default WhatsApp",
    description:
      "Default WhatsApp channel toggle for new user notification preferences.",
    descriptionEn:
      "Default WhatsApp channel toggle for new user notification preferences.",
    type: SettingValueType.BOOLEAN,
    value: true,
    sortOrder: 180
  },
  {
    key: "notification_preferences.default_sms_enabled",
    group: "notifications",
    label: "Notification Preferences Default SMS",
    labelEn: "Notification Preferences Default SMS",
    description: "Default SMS channel toggle for new user notification preferences.",
    descriptionEn:
      "Default SMS channel toggle for new user notification preferences.",
    type: SettingValueType.BOOLEAN,
    value: false,
    sortOrder: 190
  },
  {
    key: "notification_preferences.default_in_app_enabled",
    group: "notifications",
    label: "Notification Preferences Default In-App",
    labelEn: "Notification Preferences Default In-App",
    description:
      "Default in-app channel toggle for new user notification preferences.",
    descriptionEn:
      "Default in-app channel toggle for new user notification preferences.",
    type: SettingValueType.BOOLEAN,
    value: true,
    sortOrder: 200
  },
  {
    key: "notification_preferences.default_preferred_language",
    group: "notifications",
    label: "Notification Preferences Default Language",
    labelEn: "Notification Preferences Default Language",
    description:
      "Default language override for new user notification preferences. Empty means use profile preference.",
    descriptionEn:
      "Default language override for new user notification preferences. Empty means use profile preference.",
    type: SettingValueType.STRING,
    value: "",
    sortOrder: 210
  },
  {
    key: "monitoring.api_error_alert_threshold",
    group: "monitoring",
    label: "API Error Alert Threshold",
    labelEn: "API Error Alert Threshold",
    description:
      "Number of API server errors within the alert window required to raise a monitoring alert.",
    descriptionEn:
      "Number of API server errors within the alert window required to raise a monitoring alert.",
    type: SettingValueType.NUMBER,
    value: 5,
    sortOrder: 220
  },
  {
    key: "monitoring.api_error_alert_window_minutes",
    group: "monitoring",
    label: "API Error Alert Window Minutes",
    labelEn: "API Error Alert Window Minutes",
    description:
      "Time window in minutes used when evaluating API error alert thresholds.",
    descriptionEn:
      "Time window in minutes used when evaluating API error alert thresholds.",
    type: SettingValueType.NUMBER,
    value: 5,
    sortOrder: 230
  },
  {
    key: "monitoring.notification_failure_alert_threshold",
    group: "monitoring",
    label: "Notification Failure Alert Threshold",
    labelEn: "Notification Failure Alert Threshold",
    description:
      "Number of notification delivery failures within the alert window required to raise a monitoring alert.",
    descriptionEn:
      "Number of notification delivery failures within the alert window required to raise a monitoring alert.",
    type: SettingValueType.NUMBER,
    value: 5,
    sortOrder: 240
  },
  {
    key: "monitoring.notification_failure_alert_window_minutes",
    group: "monitoring",
    label: "Notification Failure Alert Window Minutes",
    labelEn: "Notification Failure Alert Window Minutes",
    description:
      "Time window in minutes used when evaluating notification failure alert thresholds.",
    descriptionEn:
      "Time window in minutes used when evaluating notification failure alert thresholds.",
    type: SettingValueType.NUMBER,
    value: 10,
    sortOrder: 250
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

