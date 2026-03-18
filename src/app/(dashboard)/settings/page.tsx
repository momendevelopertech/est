import {
  Card,
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

  return (
    <div className="space-y-4">
      <Card className="panel border-transparent px-6 py-6">
        <CardHeader>
          <CardTitle className="text-3xl">{messages.settings.title}</CardTitle>
          <CardDescription className="text-base">
            {messages.settings.subtitle}
          </CardDescription>
        </CardHeader>
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
    </div>
  );
}
