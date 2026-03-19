import { Badge } from "@/components/ui/badge";
import type { SessionStatusValue } from "@/lib/sessions/status-ui";

type SessionStatusBadgeProps = {
  status: SessionStatusValue;
  label: string;
};

export function SessionStatusBadge({ status, label }: SessionStatusBadgeProps) {
  if (status === "CANCELLED") {
    return (
      <Badge className="bg-surface-elevated text-danger ring-1 ring-danger/40">{label}</Badge>
    );
  }

  if (status === "IN_PROGRESS") {
    return <Badge variant="success">{label}</Badge>;
  }

  if (status === "LOCKED") {
    return <Badge variant="warning">{label}</Badge>;
  }

  if (status === "SCHEDULED") {
    return <Badge variant="accent">{label}</Badge>;
  }

  if (status === "COMPLETED") {
    return (
      <Badge className="bg-surface-elevated text-success ring-1 ring-border">{label}</Badge>
    );
  }

  return <Badge>{label}</Badge>;
}
