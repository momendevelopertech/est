import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function TeamPage() {
  const session = await requireSession();
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);
  const matrix = Object.entries(messages.team.matrix);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="panel border-transparent px-6 py-6">
        <CardHeader>
          <CardTitle className="text-3xl">{messages.team.title}</CardTitle>
          <CardDescription className="text-base">
            {messages.team.subtitle}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {matrix.map(([role, description]) => (
          <Card key={role}>
            <CardHeader>
              <CardTitle>{messages.roles[role as keyof typeof messages.roles]}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
