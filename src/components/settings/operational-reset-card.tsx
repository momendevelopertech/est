"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type OperationalResetCounts = {
  appSessions: number;
  activities: number;
  cycles: number;
  sessions: number;
  sessionBuildings: number;
  assignments: number;
  waitingList: number;
  attendance: number;
  evaluations: number;
  blocks: number;
  governorates: number;
  universities: number;
  buildings: number;
  floors: number;
  rooms: number;
  users: number;
  notificationPreferences: number;
  inAppNotifications: number;
};

type OperationalResetCardProps = {
  copy: {
    title: string;
    description: string;
    warning: string;
    preserve: string;
    confirmLabel: string;
    confirmPlaceholder: string;
    countsTitle: string;
    previewLoading: string;
    previewFailed: string;
    resetAction: string;
    resetting: string;
    success: string;
    forbidden: string;
  };
};

function formatCountList(counts: OperationalResetCounts) {
  return [
    `cycles=${counts.cycles}`,
    `sessions=${counts.sessions}`,
    `assignments=${counts.assignments}`,
    `waitingList=${counts.waitingList}`,
    `attendance=${counts.attendance}`,
    `evaluations=${counts.evaluations}`,
    `locations=${
      counts.governorates +
      counts.universities +
      counts.buildings +
      counts.floors +
      counts.rooms
    }`,
    `users=${counts.users}`,
    `activity=${counts.activities}`
  ].join(" ");
}

export function OperationalResetCard({ copy }: OperationalResetCardProps) {
  const [confirmValue, setConfirmValue] = useState("");
  const [preview, setPreview] = useState<OperationalResetCounts | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const isConfirmed = confirmValue.trim().toUpperCase() === "RESET";

  useEffect(() => {
    let isMounted = true;

    async function loadPreview() {
      try {
        setIsLoadingPreview(true);
        setPreviewError(null);

        const response = await fetch("/api/settings/operational-reset", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store"
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload?.message || copy.previewFailed);
        }

        if (isMounted) {
          setPreview(payload.preview);
        }
      } catch (error) {
        if (isMounted) {
          setPreviewError(
            error instanceof Error ? error.message : copy.previewFailed
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingPreview(false);
        }
      }
    }

    void loadPreview();

    return () => {
      isMounted = false;
    };
  }, [copy.previewFailed]);

  const previewSummary = useMemo(() => {
    if (!preview) {
      return null;
    }

    return formatCountList(preview);
  }, [preview]);

  async function handleReset() {
    if (!isConfirmed || isResetting) {
      return;
    }

    try {
      setIsResetting(true);
      setResultMessage(null);

      const response = await fetch("/api/settings/operational-reset", {
        method: "POST",
        credentials: "same-origin"
      });
      const payload = await response.json();

      if (response.status === 403) {
        throw new Error(copy.forbidden);
      }

      if (!response.ok || !payload.ok) {
        throw new Error(payload?.message || copy.previewFailed);
      }

      setPreview(payload.after);
      setResultMessage(copy.success);
      setConfirmValue("");
    } catch (error) {
      setResultMessage(
        error instanceof Error ? error.message : copy.previewFailed
      );
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <Card className="border border-danger/25 bg-[color:color-mix(in_srgb,var(--danger)_7%,var(--surface))]">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-danger/25 bg-surface px-4 py-4 text-sm leading-7 text-text-secondary">
          <p>{copy.warning}</p>
          <p className="mt-2">{copy.preserve}</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface px-4 py-4 text-sm text-text-secondary">
          <p className="font-medium text-text-primary">{copy.countsTitle}</p>
          <p className="mt-2">
            {isLoadingPreview
              ? copy.previewLoading
              : previewError
                ? previewError
                : previewSummary ?? copy.previewFailed}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            value={confirmValue}
            onChange={(event) => setConfirmValue(event.target.value)}
            placeholder={copy.confirmPlaceholder}
            aria-label={copy.confirmLabel}
          />
          <Button
            variant="danger"
            onClick={() => void handleReset()}
            disabled={!isConfirmed || isResetting}
          >
            {isResetting ? copy.resetting : copy.resetAction}
          </Button>
        </div>

        <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">
          {copy.confirmLabel}
        </p>

        {resultMessage ? (
          <p className="text-sm text-text-primary">{resultMessage}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
