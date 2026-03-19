import {
  Card,
  CardContent,
  CardHeader
} from "@/components/ui/card";

export default function SessionsLoading() {
  return (
    <div className="space-y-6">
      <Card className="panel border-transparent px-6 py-6 sm:px-8">
        <CardHeader>
          <div className="h-10 w-56 animate-pulse rounded-2xl bg-surface-elevated" />
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-3xl border border-border bg-surface-elevated"
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-4">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-3xl border border-border bg-surface-elevated"
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
