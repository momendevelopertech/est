export type NotificationPreferenceLanguageContract = "en" | "ar" | null;

export type NotificationPreferenceContract = {
  id: string;
  userId: string;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  preferredLanguage: NotificationPreferenceLanguageContract;
  createdAt: Date;
  updatedAt: Date;
};

export type NotificationPreferenceDefaultsContract = {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  preferredLanguage: NotificationPreferenceLanguageContract;
};

export type UpdateNotificationPreferencesPayloadContract = Partial<{
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  preferredLanguage: NotificationPreferenceLanguageContract;
}>;
