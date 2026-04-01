import { OperationalResetCard } from "@/components/settings/operational-reset-card";
import { ActionLink } from "@/components/ui/action-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function SettingsPage() {
  const session = await requireRole(["super_admin", "coordinator"]);

  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);
  const items = Object.values(messages.settings.items);
  const canResetOperationalData = session.user.role === "super_admin";
  const quickLinks =
    locale === "ar"
      ? [
          {
            title: "قوالب الاستيراد",
            description:
              "ادخل إلى صفحة القوالب المركزية، أو افتح صفحات المراقبين والمواقع لتحميل القالب من نفس مكان العمل.",
            href: "/settings/import-templates",
            action: "فتح القوالب"
          },
          {
            title: "المراقبون",
            description:
              "إدارة المراقبين أصبحت تدعم الإدخال اليدوي، التعديل، التعطيل، والاستيراد/التصدير من نفس الصفحة.",
            href: "/proctors",
            action: "فتح المراقبين"
          },
          {
            title: "المواقع",
            description:
              "أضف جامعة أو مبنى أو دور أو غرفة يدويًا، وصدّر الجزء المحدد من الشجرة مباشرة.",
            href: "/locations",
            action: "فتح المواقع"
          },
          {
            title: "إعدادات الإشعارات",
            description: "راجع قنوات الإرسال والتفضيلات من مساحة الإشعارات المخصصة.",
            href: "/settings/notifications",
            action: "فتح الإشعارات"
          }
        ]
      : [
          {
            title: "Import templates",
            description:
              "Open the centralized templates page, or download the relevant template directly from the Proctors and Locations workspaces.",
            href: "/settings/import-templates",
            action: "Open templates"
          },
          {
            title: "Proctors",
            description:
              "The proctors workspace now supports manual entry, edit, deactivate, and import/export from the same page.",
            href: "/proctors",
            action: "Open proctors"
          },
          {
            title: "Locations",
            description:
              "Add a university, building, floor, or room manually and export the currently selected hierarchy scope.",
            href: "/locations",
            action: "Open locations"
          },
          {
            title: "Notification settings",
            description: "Review delivery channels and user preferences from the notification settings workspace.",
            href: "/settings/notifications",
            action: "Open notifications"
          }
        ];

  return (
    <div className="space-y-4">
      <Card className="panel border-transparent px-6 py-6">
        <CardHeader>
          <CardTitle className="text-3xl">{messages.settings.title}</CardTitle>
          <CardDescription className="text-base">
            {messages.settings.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <ActionLink href="/settings/import-templates" variant="primary">
              {messages.importTemplates.open}
            </ActionLink>
            <ActionLink href="/settings/notifications">
              {messages.notificationPreferences.actions.open}
            </ActionLink>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item}>
            <CardHeader>
              <CardDescription>{item}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {quickLinks.map((item) => (
          <Card key={item.href}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionLink href={item.href}>
                {item.action}
              </ActionLink>
            </CardContent>
          </Card>
        ))}
      </div>

      {canResetOperationalData ? (
        <OperationalResetCard copy={messages.settings.operationalReset} />
      ) : null}
    </div>
  );
}
