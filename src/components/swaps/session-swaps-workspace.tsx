"use client";

import { useEffect, useMemo, useState } from "react";

import { ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHero } from "@/components/ui/page-hero";
import type { Locale, Messages } from "@/lib/i18n";
import { getLocalizedName } from "@/lib/i18n/presentation";

type ApiPayload<T> = { ok: boolean; data?: T; error?: string; message?: string };
type AssignmentStatus = "DRAFT" | "CONFIRMED" | "LOCKED" | "CANCELLED" | "COMPLETED";
type WaitingListStatus = "WAITING" | "PROMOTED" | "REMOVED";

type SessionSummary = {
  id: string;
  name?: string;
  nameEn?: string | null;
  examType: "EST1" | "EST2" | "EST_ASSN";
  status: string;
  derivedStatus: string;
  isActive?: boolean;
  buildings: Array<{ id: string; name: string; nameEn: string | null }>;
};

type AssignmentRecord = {
  id: string;
  sessionId: string;
  userId: string;
  buildingId: string;
  floorId: string | null;
  roomId: string | null;
  roleDefinitionId: string;
  status: AssignmentStatus;
  assignedMethod: "AUTO" | "MANUAL";
  user: { id: string; name: string; nameEn: string | null };
  building: { id: string; name: string; nameEn: string | null };
  floor: { id: string; name: string; nameEn: string | null } | null;
  room: { id: string; name: string; nameEn: string | null } | null;
  roleDefinition: { id: string; name: string; nameEn: string | null };
};

type WaitingListRecord = {
  id: string;
  sessionId: string;
  userId: string;
  status: WaitingListStatus;
  priority: number;
  buildingId: string | null;
  roleDefinitionId: string | null;
  user: { id: string; name: string; nameEn: string | null };
};

type ProctorOption = { id: string; name: string; nameEn: string | null };

type SwapResult = {
  kind: "DIRECT_ASSIGNMENT_SWAP" | "WAITING_LIST_REPLACEMENT" | "MANUAL_REPLACEMENT";
  sessionId: string;
  changedAssignmentIds: string[];
};

function apiError<T>(payload: ApiPayload<T>, fallback: string) {
  return payload.message ?? payload.error ?? fallback;
}

function assignmentLabel(assignment: AssignmentRecord, locale: Locale) {
  const userName = getLocalizedName(assignment.user, locale);
  const roleName = getLocalizedName(assignment.roleDefinition, locale);
  const location = [
    getLocalizedName(assignment.building, locale),
    assignment.floor ? getLocalizedName(assignment.floor, locale) : null,
    assignment.room ? getLocalizedName(assignment.room, locale) : null
  ]
    .filter(Boolean)
    .join(" / ");

  return `${userName} - ${roleName} - ${location}`;
}

export function SessionSwapsWorkspace({
  locale,
  messages,
  session
}: {
  locale: Locale;
  messages: Messages;
  session: SessionSummary;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SwapResult | null>(null);

  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [waitingList, setWaitingList] = useState<WaitingListRecord[]>([]);
  const [proctors, setProctors] = useState<ProctorOption[]>([]);

  const [directForm, setDirectForm] = useState({
    primaryAssignmentId: "",
    secondaryAssignmentId: "",
    manualOverride: false,
    overrideNote: ""
  });
  const [waitingForm, setWaitingForm] = useState({
    assignmentId: "",
    waitingListId: "",
    manualOverride: false,
    demoteCurrentAssignee: true,
    demotionReason: "",
    demotionNotes: "",
    overrideNote: ""
  });
  const [manualForm, setManualForm] = useState({
    assignmentId: "",
    replacementUserId: "",
    manualOverride: false,
    demoteCurrentAssignee: true,
    demotionReason: "",
    demotionNotes: "",
    overrideNote: ""
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadWorkspace() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [aRes, wRes, pRes] = await Promise.all([
          fetch(`/api/assignments?sessionId=${session.id}&page=1&pageSize=500`, {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          }),
          fetch(`/api/waiting-list?sessionId=${session.id}&status=WAITING&page=1&pageSize=500`, {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          }),
          fetch("/api/proctors?includeInactive=false&page=1&pageSize=500", {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          })
        ]);
        const aPayload = (await aRes.json()) as ApiPayload<AssignmentRecord[]>;
        const wPayload = (await wRes.json()) as ApiPayload<WaitingListRecord[]>;
        const pPayload = (await pRes.json()) as ApiPayload<ProctorOption[]>;

        if (!aRes.ok || !aPayload.ok || !aPayload.data) {
          throw new Error(apiError(aPayload, messages.swaps.errors.loadFailed));
        }

        if (!wRes.ok || !wPayload.ok || !wPayload.data) {
          throw new Error(apiError(wPayload, messages.swaps.errors.loadFailed));
        }

        if (!pRes.ok || !pPayload.ok || !pPayload.data) {
          throw new Error(apiError(pPayload, messages.swaps.errors.loadFailed));
        }

        const activeAssignments = aPayload.data.filter(
          (assignment) =>
            assignment.status !== "CANCELLED" && assignment.status !== "COMPLETED"
        );
        setAssignments(activeAssignments);
        setWaitingList(
          wPayload.data.filter((entry) => entry.status === "WAITING")
        );
        setProctors(pPayload.data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error ? error.message : messages.swaps.errors.loadFailed
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkspace();
    return () => controller.abort();
  }, [messages.swaps.errors.loadFailed, refreshKey, session.id]);

  const replacementCandidates = useMemo(() => {
    if (!manualForm.assignmentId) {
      return proctors;
    }

    const selectedAssignment = assignments.find(
      (assignment) => assignment.id === manualForm.assignmentId
    );

    if (!selectedAssignment) {
      return proctors;
    }

    return proctors.filter((proctor) => proctor.id !== selectedAssignment.userId);
  }, [assignments, manualForm.assignmentId, proctors]);

  async function submitSwap(payload: Record<string, unknown>) {
    setSubmitError(null);
    setIsBusy(true);
    setLastResult(null);

    try {
      const response = await fetch("/api/swaps", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as ApiPayload<SwapResult>;

      if (!response.ok || !body.ok || !body.data) {
        setSubmitError(apiError(body, messages.swaps.errors.swapFailed));
        return;
      }

      setLastResult(body.data);
      setRefreshKey((current) => current + 1);
    } finally {
      setIsBusy(false);
    }
  }

  async function runDirectSwap() {
    if (!directForm.primaryAssignmentId || !directForm.secondaryAssignmentId) {
      setSubmitError(messages.swaps.errors.swapFailed);
      return;
    }

    await submitSwap({
      kind: "DIRECT_ASSIGNMENT_SWAP",
      sessionId: session.id,
      primaryAssignmentId: directForm.primaryAssignmentId,
      secondaryAssignmentId: directForm.secondaryAssignmentId,
      manualOverride: directForm.manualOverride,
      overrideNote: directForm.overrideNote || undefined
    });
  }

  async function runWaitingReplacement() {
    if (!waitingForm.assignmentId || !waitingForm.waitingListId) {
      setSubmitError(messages.swaps.errors.swapFailed);
      return;
    }

    await submitSwap({
      kind: "WAITING_LIST_REPLACEMENT",
      sessionId: session.id,
      assignmentId: waitingForm.assignmentId,
      waitingListId: waitingForm.waitingListId,
      manualOverride: waitingForm.manualOverride,
      demoteCurrentAssignee: waitingForm.demoteCurrentAssignee,
      demotionReason: waitingForm.demotionReason || undefined,
      demotionNotes: waitingForm.demotionNotes || undefined,
      overrideNote: waitingForm.overrideNote || undefined
    });
  }

  async function runManualReplacement() {
    if (!manualForm.assignmentId || !manualForm.replacementUserId) {
      setSubmitError(messages.swaps.errors.swapFailed);
      return;
    }

    await submitSwap({
      kind: "MANUAL_REPLACEMENT",
      sessionId: session.id,
      assignmentId: manualForm.assignmentId,
      replacementUserId: manualForm.replacementUserId,
      manualOverride: manualForm.manualOverride,
      demoteCurrentAssignee: manualForm.demoteCurrentAssignee,
      demotionReason: manualForm.demotionReason || undefined,
      demotionNotes: manualForm.demotionNotes || undefined,
      overrideNote: manualForm.overrideNote || undefined
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{messages.swaps.title}</CardTitle>
          <CardDescription>{messages.swaps.loading}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="border-danger/40">
        <CardHeader>
          <CardTitle>{messages.swaps.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-danger">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          { label: messages.nav.sessions, variant: "accent" },
          { label: messages.sessions.examTypes[session.examType] },
          { label: messages.sessions.statuses[session.status as keyof typeof messages.sessions.statuses] },
          { label: messages.sessions.statuses[session.derivedStatus as keyof typeof messages.sessions.statuses] }
        ]}
        title={messages.swaps.title}
        description={messages.swaps.subtitle}
        aside={
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {messages.swaps.direct.title}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-text-primary">
              {assignments.length}
            </p>
          </>
        }
        actions={
          <>
            <ActionLink href={`/sessions/${session.id}`}>{messages.swaps.backToSession}</ActionLink>
            <Button
              variant="secondary"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              {messages.swaps.refresh}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{messages.swaps.direct.title}</CardTitle>
            <CardDescription>{messages.swaps.direct.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary"
              value={directForm.primaryAssignmentId}
              onChange={(event) =>
                setDirectForm((current) => ({
                  ...current,
                  primaryAssignmentId: event.target.value
                }))
              }
            >
              <option value="">{messages.swaps.direct.primaryAssignment}</option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignmentLabel(assignment, locale)}
                </option>
              ))}
            </select>
            <select
              className="h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary"
              value={directForm.secondaryAssignmentId}
              onChange={(event) =>
                setDirectForm((current) => ({
                  ...current,
                  secondaryAssignmentId: event.target.value
                }))
              }
            >
              <option value="">{messages.swaps.direct.secondaryAssignment}</option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignmentLabel(assignment, locale)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={directForm.manualOverride}
                onChange={(event) =>
                  setDirectForm((current) => ({
                    ...current,
                    manualOverride: event.target.checked
                  }))
                }
              />
              {messages.swaps.labels.manualOverride}
            </label>
            <Input
              value={directForm.overrideNote}
              onChange={(event) =>
                setDirectForm((current) => ({
                  ...current,
                  overrideNote: event.target.value
                }))
              }
              placeholder={messages.swaps.labels.overrideNote}
            />
            <div className="flex justify-end">
              <Button onClick={() => void runDirectSwap()} disabled={isBusy}>
                {messages.swaps.direct.submit}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{messages.swaps.waiting.title}</CardTitle>
            <CardDescription>{messages.swaps.waiting.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary"
              value={waitingForm.assignmentId}
              onChange={(event) =>
                setWaitingForm((current) => ({
                  ...current,
                  assignmentId: event.target.value
                }))
              }
            >
              <option value="">{messages.swaps.waiting.assignment}</option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignmentLabel(assignment, locale)}
                </option>
              ))}
            </select>
            <select
              className="h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary"
              value={waitingForm.waitingListId}
              onChange={(event) =>
                setWaitingForm((current) => ({
                  ...current,
                  waitingListId: event.target.value
                }))
              }
            >
              <option value="">{messages.swaps.waiting.waitingEntry}</option>
              {waitingList.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {`${getLocalizedName(entry.user, locale)} - ${messages.waitingList.labels.priority}: ${entry.priority}`}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={waitingForm.manualOverride}
                onChange={(event) =>
                  setWaitingForm((current) => ({
                    ...current,
                    manualOverride: event.target.checked
                  }))
                }
              />
              {messages.swaps.labels.manualOverride}
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={waitingForm.demoteCurrentAssignee}
                onChange={(event) =>
                  setWaitingForm((current) => ({
                    ...current,
                    demoteCurrentAssignee: event.target.checked
                  }))
                }
              />
              {messages.swaps.labels.demoteCurrentAssignee}
            </label>
            <Input
              value={waitingForm.demotionReason}
              onChange={(event) =>
                setWaitingForm((current) => ({
                  ...current,
                  demotionReason: event.target.value
                }))
              }
              placeholder={messages.swaps.labels.demotionReason}
            />
            <Input
              value={waitingForm.demotionNotes}
              onChange={(event) =>
                setWaitingForm((current) => ({
                  ...current,
                  demotionNotes: event.target.value
                }))
              }
              placeholder={messages.swaps.labels.demotionNotes}
            />
            <Input
              value={waitingForm.overrideNote}
              onChange={(event) =>
                setWaitingForm((current) => ({
                  ...current,
                  overrideNote: event.target.value
                }))
              }
              placeholder={messages.swaps.labels.overrideNote}
            />
            <div className="flex justify-end">
              <Button onClick={() => void runWaitingReplacement()} disabled={isBusy}>
                {messages.swaps.waiting.submit}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{messages.swaps.manual.title}</CardTitle>
          <CardDescription>{messages.swaps.manual.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary"
              value={manualForm.assignmentId}
              onChange={(event) =>
                setManualForm((current) => ({
                  ...current,
                  assignmentId: event.target.value,
                  replacementUserId: ""
                }))
              }
            >
              <option value="">{messages.swaps.manual.assignment}</option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignmentLabel(assignment, locale)}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary"
              value={manualForm.replacementUserId}
              onChange={(event) =>
                setManualForm((current) => ({
                  ...current,
                  replacementUserId: event.target.value
                }))
              }
            >
              <option value="">{messages.swaps.manual.replacementUser}</option>
              {replacementCandidates.map((proctor) => (
                <option key={proctor.id} value={proctor.id}>
                  {getLocalizedName(proctor, locale)}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={manualForm.manualOverride}
              onChange={(event) =>
                setManualForm((current) => ({
                  ...current,
                  manualOverride: event.target.checked
                }))
              }
            />
            {messages.swaps.labels.manualOverride}
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={manualForm.demoteCurrentAssignee}
              onChange={(event) =>
                setManualForm((current) => ({
                  ...current,
                  demoteCurrentAssignee: event.target.checked
                }))
              }
            />
            {messages.swaps.labels.demoteCurrentAssignee}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={manualForm.demotionReason}
              onChange={(event) =>
                setManualForm((current) => ({
                  ...current,
                  demotionReason: event.target.value
                }))
              }
              placeholder={messages.swaps.labels.demotionReason}
            />
            <Input
              value={manualForm.demotionNotes}
              onChange={(event) =>
                setManualForm((current) => ({
                  ...current,
                  demotionNotes: event.target.value
                }))
              }
              placeholder={messages.swaps.labels.demotionNotes}
            />
          </div>
          <Input
            value={manualForm.overrideNote}
            onChange={(event) =>
              setManualForm((current) => ({
                ...current,
                overrideNote: event.target.value
              }))
            }
            placeholder={messages.swaps.labels.overrideNote}
          />
          <div className="flex justify-end">
            <Button onClick={() => void runManualReplacement()} disabled={isBusy}>
              {messages.swaps.manual.submit}
            </Button>
          </div>
        </CardContent>
      </Card>

      {submitError ? (
        <Card className="border-danger/40">
          <CardContent className="pt-6">
            <p className="text-sm text-danger">{submitError}</p>
          </CardContent>
        </Card>
      ) : null}

      {lastResult ? (
        <Card>
          <CardHeader>
            <CardTitle>{messages.swaps.lastResult.title}</CardTitle>
            <CardDescription>{messages.swaps.lastResult.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-text-secondary">
            <p>{messages.swaps.lastResult.kind}: {lastResult.kind}</p>
            <p>{messages.swaps.lastResult.sessionId}: {lastResult.sessionId}</p>
            <p>{messages.swaps.lastResult.changedAssignments}: {lastResult.changedAssignmentIds.join(", ") || "-"}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
