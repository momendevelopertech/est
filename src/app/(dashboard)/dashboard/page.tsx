import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function DashboardPage() {
  const [session, locale] = await Promise.all([
    requireSession(),
    resolveRequestLocale()
  ]);
  const messages = getMessages(locale);
  const cards = Object.values(messages.dashboard.cards);

  return (
    <div className="space-y-6">
      <Card className="panel border-transparent px-6 py-6 sm:px-8">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{messages.common.protected}</Badge>
            <Badge>{messages.roles[session.user.role]}</Badge>
          </div>
          <CardTitle className="text-3xl">{messages.dashboard.title}</CardTitle>
          <CardDescription className="text-base">
            {messages.dashboard.subtitle}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
