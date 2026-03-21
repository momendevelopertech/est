"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHero } from "@/components/ui/page-hero";
import type { Locale, Messages } from "@/lib/i18n";
import { getLocalizedName } from "@/lib/i18n/presentation";

type AttendanceStatus = "PENDING" | "CONFIRMED" | "ABSENT" | "DECLINED";
type AssignmentStatus = "DRAFT" | "CONFIRMED" | "LOCKED" | "CANCELLED" | "COMPLETED";
type ApiPayload<T> = { ok: boolean; data?: T; error?: string; message?: string };

type SessionSummary = {
  id: string;
  name?: string;
  nameEn?: string | null;
  examType: "EST1" | "EST2" | "EST_ASSN";
  status: string;
  derivedStatus: string;
  isActive?: boolean;
};

type AttendanceRecord = {
  assignmentId: string;
  attendanceId: string | null;
  assignmentStatus: AssignmentStatus;
  attendanceStatus: AttendanceStatus;
  checkedInAt: string | null;
  notes: string | null;
  updatedByAppUserId: string | null;
  updatedAt: string;
};

type AttendanceAssignment = {
  id: string;
  sessionId: string;
  userId: string;
  buildingId: string;
  floorId: string | null;
  roomId: string | null;
  roleDefinitionId: string;
  status: AssignmentStatus;
  assignedMethod: "AUTO" | "MANUAL";
  assignedAt: string;
  user: { id: string; name: string; nameEn: string | null };
  building: { id: string; name: string; nameEn: string | null };
  floor: { id: string; name: string; nameEn: string | null } | null;
  room: { id: string; name: string; nameEn: string | null } | null;
  roleDefinition: { id: string; name: string; nameEn: string | null };
  attendance: {
    id: string;
    status: AttendanceStatus;
    checkedInAt: string | null;
    notes: string | null;
    updatedAt: string;
  } | null;
};

type WaitingReplacementSuggestion = {
  id: string;
  sessionId: string;
  userId: string;
  status: "WAITING";
  priority: number;
  buildingId: string | null;
  roleDefinitionId: string | null;
  entrySource: string | null;
  user: {
    id: string;
    name: string;
    nameEn: string | null;
    averageRating: string;
    totalSessions: number;
  };
  compatibility: {
    roleCompatible: boolean;
    buildingCompatible: boolean;
    compatibilityScore: number;
  };
};

type AttendanceDraft = {
  status: AttendanceStatus;
  notes: string;
  replacementWaitingListId: string;
};

function apiError<T>(payload: ApiPayload<T>, fallback: string) {
  return payload.message ?? payload.error ?? fallback;
}

function formatDateTime(locale: Locale, value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function assignmentLocationLabel(assignment: AttendanceAssignment, locale: Locale) {
  return [
    assignment.building ? getLocalizedName(assignment.building, locale) : null,
    assignment.floor ? getLocalizedName(assignment.floor, locale) : null,
    assignment.room ? getLocalizedName(assignment.room, locale) : null
  ]
    .filter(Boolean)
    .join(" / ");
}

function getCurrentAttendanceStatus(assignment: AttendanceAssignment): AttendanceStatus {
  return assignment.attendance?.status ?? "PENDING";
}

export function SessionAttendanceWorkspace({
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
  const [isSavingByAssignmentId, setIsSavingByAssignmentId] = useState<
    Record<string, boolean>
  >({});
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "ALL">("ALL");
  const [formErrorByAssignmentId, setFormErrorByAssignmentId] = useState<
    Record<string, string | null>
  >({});
  const [assignments, setAssignments] = useState<AttendanceAssignment[]>([]);
  const [attendanceByAssignmentId, setAttendanceByAssignmentId] = useState<
    Record<string, AttendanceRecord>
  >({});
  const [draftsByAssignmentId, setDraftsByAssignmentId] = useState<
    Record<string, AttendanceDraft>
  >({});
  const [
    replacementSuggestionsByAssignmentId,
    setReplacementSuggestionsByAssignmentId
  ] = useState<Record<string, WaitingReplacementSuggestion[]>>({});
  const [loadingSuggestionsByAssignmentId, setLoadingSuggestionsByAssignmentId] =
    useState<Record<string, boolean>>({});

  useEffect(() => {
    const controller = new AbortController();

    async function loadWorkspace() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(
          `/api/attendance?sessionId=${session.id}&page=1&pageSize=500`,
          {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          }
        );
        const payload = (await response.json()) as ApiPayload<AttendanceAssignment[]> & {
          attendance?: AttendanceRecord[];
        };

        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(apiError(payload, messages.attendance.errors.loadFailed));
        }

        const nextAttendanceIndex = Object.fromEntries(
          (payload.attendance ?? []).map((record) => [record.assignmentId, record])
        );
        const nextDrafts = Object.fromEntries(
          payload.data.map((assignment) => [
            assignment.id,
            {
              status: getCurrentAttendanceStatus(assignment),
              notes: assignment.attendance?.notes ?? "",
              replacementWaitingListId: ""
            } satisfies AttendanceDraft
          ])
        ) as Record<string, AttendanceDraft>;

        setAssignments(payload.data);
        setAttendanceByAssignmentId(nextAttendanceIndex);
        setDraftsByAssignmentId(nextDrafts);
        setReplacementSuggestionsByAssignmentId({});
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error ? error.message : messages.attendance.errors.loadFailed
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
  }, [messages.attendance.errors.loadFailed, refreshKey, session.id]);

  const filteredAssignments = useMemo(() => {
    if (statusFilter === "ALL") {
      return assignments;
    }

    return assignments.filter(
      (assignment) => getCurrentAttendanceStatus(assignment) === statusFilter
    );
  }, [assignments, statusFilter]);

  async function loadReplacementSuggestions(assignmentId: string) {
    if (replacementSuggestionsByAssignmentId[assignmentId]) {
      return;
    }

    setLoadingSuggestionsByAssignmentId((current) => ({
      ...current,
      [assignmentId]: true
    }));

    try {
      const response = await fetch(
        `/api/attendance/replacements?assignmentId=${assignmentId}`,
        {
          credentials: "same-origin",
          headers: { Accept: "application/json" }
        }
      );
      const payload =
        (await response.json()) as ApiPayload<WaitingReplacementSuggestion[]>;

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(apiError(payload, messages.attendance.errors.loadSuggestionsFailed));
      }

      setReplacementSuggestionsByAssignmentId((current) => ({
        ...current,
        [assignmentId]: payload.data ?? []
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : messages.attendance.errors.loadSuggestionsFailed;
      setFormErrorByAssignmentId((current) => ({
        ...current,
        [assignmentId]: message
      }));
    } finally {
      setLoadingSuggestionsByAssignmentId((current) => ({
        ...current,
        [assignmentId]: false
      }));
    }
  }

  async function saveAttendance(assignmentId: string) {
    const draft = draftsByAssignmentId[assignmentId];

    if (!draft) {
      return;
    }

    setFormErrorByAssignmentId((current) => ({
      ...current,
      [assignmentId]: null
    }));
    setIsSavingByAssignmentId((current) => ({
      ...current,
      [assignmentId]: true
    }));

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          assignmentId,
          status: draft.status,
          notes: draft.notes || undefined,
          replacementWaitingListId:
            draft.replacementWaitingListId || undefined
        })
      });
      const payload = (await response.json()) as ApiPayload<{
        assignment: AttendanceAssignment;
        attendance: AttendanceRecord;
      }>;

      if (!response.ok || !payload.ok || !payload.data) {
        setFormErrorByAssignmentId((current) => ({
          ...current,
          [assignmentId]: apiError(payload, messages.attendance.errors.saveFailed)
        }));
        return;
      }

      setAssignments((current) =>
        current.map((assignment) =>
          assignment.id === assignmentId ? payload.data!.assignment : assignment
        )
      );
      setAttendanceByAssignmentId((current) => ({
        ...current,
        [assignmentId]: payload.data!.attendance
      }));
      setDraftsByAssignmentId((current) => ({
        ...current,
        [assignmentId]: {
          ...current[assignmentId],
          replacementWaitingListId: ""
        }
      }));
      setRefreshKey((current) => current + 1);
    } finally {
      setIsSavingByAssignmentId((current) => ({
        ...current,
        [assignmentId]: false
      }));
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{messages.attendance.title}</CardTitle>
          <CardDescription>{messages.attendance.loading}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="border-danger/40">
        <CardHeader>
          <CardTitle>{messages.attendance.title}</CardTitle>
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
        title={messages.attendance.title}
        description={messages.attendance.subtitle}
        aside={
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {messages.attendance.list.title}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-text-primary">
              {filteredAssignments.length}
            </p>
          </>
        }
        actions={
          <>
            <ActionLink href={`/sessions/${session.id}`}>{messages.attendance.backToSession}</ActionLink>
            <Button variant="secondary" onClick={() => setRefreshKey((current) => current + 1)}>
              {messages.attendance.refresh}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{messages.attendance.filters.title}</CardTitle>
          <CardDescription>{messages.attendance.filters.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(["ALL", "PENDING", "CONFIRMED", "ABSENT", "DECLINED"] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={`rounded-2xl px-3 py-2 text-sm ring-1 transition-colors ${
                statusFilter === status
                  ? "bg-accent text-white ring-transparent"
                  : "bg-surface-elevated text-text-primary ring-border hover:bg-surface"
              }`}
              onClick={() => setStatusFilter(status)}
            >
              {status === "ALL"
                ? messages.attendance.filters.all
                : messages.attendance.statuses[status]}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.attendance.list.title}</CardTitle>
          <CardDescription>{messages.attendance.list.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredAssignments.length === 0 ? (
            <p className="text-sm text-text-secondary">{messages.attendance.list.empty}</p>
          ) : (
            filteredAssignments.map((assignment) => {
              const draft = draftsByAssignmentId[assignment.id];
              const attendanceRecord = attendanceByAssignmentId[assignment.id] ?? null;
              const currentStatus = getCurrentAttendanceStatus(assignment);
              const shouldShowReplacement =
                draft?.status === "ABSENT" || draft?.status === "DECLINED";
              const suggestions = replacementSuggestionsByAssignmentId[assignment.id] ?? [];
              const isSaving = isSavingByAssignmentId[assignment.id] ?? false;

              return (
                <div
                  key={assignment.id}
                  className="rounded-2xl border border-border bg-surface-elevated px-4 py-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge>{messages.attendance.statuses[currentStatus]}</Badge>
                    <Badge>{messages.assignments.statuses[assignment.status]}</Badge>
                    <Badge>{messages.assignments.methods[assignment.assignedMethod]}</Badge>
                  </div>

                  <p className="mt-3 text-base font-semibold text-text-primary">
                    {getLocalizedName(assignment.user, locale)}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {getLocalizedName(assignment.roleDefinition, locale)}
                  </p>
                  <div className="mt-2 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 xl:grid-cols-4">
                    <p>
                      {messages.attendance.labels.location}:{" "}
                      {assignmentLocationLabel(assignment, locale)}
                    </p>
                    <p>
                      {messages.attendance.labels.assignedAt}:{" "}
                      {formatDateTime(locale, assignment.assignedAt)}
                    </p>
                    <p>
                      {messages.attendance.labels.checkedInAt}:{" "}
                      {formatDateTime(locale, attendanceRecord?.checkedInAt ?? null)}
                    </p>
                    <p>
                      {messages.attendance.labels.updatedAt}:{" "}
                      {formatDateTime(locale, attendanceRecord?.updatedAt ?? null)}
                    </p>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <select
                      className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary"
                      value={draft?.status ?? currentStatus}
                      onChange={(event) =>
                        setDraftsByAssignmentId((current) => ({
                          ...current,
                          [assignment.id]: {
                            ...(current[assignment.id] ?? {
                              status: currentStatus,
                              notes: "",
                              replacementWaitingListId: ""
                            }),
                            status: event.target.value as AttendanceStatus,
                            replacementWaitingListId: ""
                          }
                        }))
                      }
                    >
                      <option value="PENDING">{messages.attendance.statuses.PENDING}</option>
                      <option value="CONFIRMED">{messages.attendance.statuses.CONFIRMED}</option>
                      <option value="ABSENT">{messages.attendance.statuses.ABSENT}</option>
                      <option value="DECLINED">{messages.attendance.statuses.DECLINED}</option>
                    </select>
                    <Input
                      value={draft?.notes ?? ""}
                      placeholder={messages.attendance.labels.notes}
                      onChange={(event) =>
                        setDraftsByAssignmentId((current) => ({
                          ...current,
                          [assignment.id]: {
                            ...(current[assignment.id] ?? {
                              status: currentStatus,
                              notes: "",
                              replacementWaitingListId: ""
                            }),
                            notes: event.target.value
                          }
                        }))
                      }
                    />
                  </div>

                  {shouldShowReplacement ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => void loadReplacementSuggestions(assignment.id)}
                          disabled={loadingSuggestionsByAssignmentId[assignment.id]}
                        >
                          {messages.attendance.actions.loadSuggestions}
                        </Button>
                      </div>
                      <select
                        className="h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary"
                        value={draft?.replacementWaitingListId ?? ""}
                        onChange={(event) =>
                          setDraftsByAssignmentId((current) => ({
                            ...current,
                            [assignment.id]: {
                              ...(current[assignment.id] ?? {
                                status: currentStatus,
                                notes: "",
                                replacementWaitingListId: ""
                              }),
                              replacementWaitingListId: event.target.value
                            }
                          }))
                        }
                      >
                        <option value="">{messages.attendance.labels.noReplacement}</option>
                        {suggestions.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {`${getLocalizedName(entry.user, locale)} - ${
                              messages.waitingList.labels.priority
                            }: ${entry.priority}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {formErrorByAssignmentId[assignment.id] ? (
                    <p className="mt-2 text-sm text-danger">
                      {formErrorByAssignmentId[assignment.id]}
                    </p>
                  ) : null}

                  <div className="mt-3 flex justify-end">
                    <Button
                      onClick={() => void saveAttendance(assignment.id)}
                      disabled={isSaving}
                    >
                      {isSaving
                        ? messages.attendance.actions.saving
                        : messages.attendance.actions.save}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
