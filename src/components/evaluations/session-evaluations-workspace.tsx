"use client";

import { useEffect, useState } from "react";

import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyState,
  DataTableHead,
  DataTableHeader,
  DataTableRow
} from "@/components/ui/data-table";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { RefreshIcon } from "@/components/ui/icons";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHero } from "@/components/ui/page-hero";
import type { Locale, Messages } from "@/lib/i18n";
import { getLocalizedName } from "@/lib/i18n/presentation";

type AssignmentStatus = "DRAFT" | "CONFIRMED" | "LOCKED" | "CANCELLED" | "COMPLETED";
type PaginationMeta = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
};
type ApiPayload<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationMeta;
};

const pageSizeOptions = [25, 50, 100];

type SessionSummary = {
  id: string;
  name?: string;
  nameEn?: string | null;
  examType: "EST1" | "EST2" | "EST_ASSN";
  status: string;
  derivedStatus: string;
  isActive?: boolean;
};

type EvaluationAssignment = {
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
};

type EvaluationRecord = {
  id: string;
  assignmentId: string | null;
  sessionId: string;
  subjectUserId: string;
  evaluatorAppUserId: string;
  rating: string | number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  evaluatorAppUser: {
    id: string;
    displayName: string;
    role: string;
  };
};

type EvaluationDraft = {
  rating: string;
  notes: string;
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

function assignmentLocationLabel(assignment: EvaluationAssignment, locale: Locale) {
  return [
    assignment.building ? getLocalizedName(assignment.building, locale) : null,
    assignment.floor ? getLocalizedName(assignment.floor, locale) : null,
    assignment.room ? getLocalizedName(assignment.room, locale) : null
  ]
    .filter(Boolean)
    .join(" / ");
}

export function SessionEvaluationsWorkspace({
  locale,
  messages,
  session,
  actorAppUserId
}: {
  locale: Locale;
  messages: Messages;
  session: SessionSummary;
  actorAppUserId: string;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<EvaluationAssignment[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    hasNextPage: false,
    hasPreviousPage: false,
    page: 1,
    pageCount: 1,
    pageSize: 25,
    total: 0
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [evaluationsByAssignmentId, setEvaluationsByAssignmentId] = useState<
    Record<string, EvaluationRecord>
  >({});
  const [draftsByAssignmentId, setDraftsByAssignmentId] = useState<
    Record<string, EvaluationDraft>
  >({});
  const [savingByAssignmentId, setSavingByAssignmentId] = useState<
    Record<string, boolean>
  >({});
  const [formErrorByAssignmentId, setFormErrorByAssignmentId] = useState<
    Record<string, string | null>
  >({});

  useEffect(() => {
    const controller = new AbortController();

    async function loadWorkspace() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [assignmentsResponse, evaluationsResponse] = await Promise.all([
          fetch(`/api/assignments?sessionId=${session.id}&page=${page}&pageSize=${pageSize}`, {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          }),
          fetch(`/api/evaluations?sessionId=${session.id}&page=${page}&pageSize=${pageSize}`, {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          })
        ]);
        const assignmentsPayload =
          (await assignmentsResponse.json()) as ApiPayload<EvaluationAssignment[]>;
        const evaluationsPayload =
          (await evaluationsResponse.json()) as ApiPayload<EvaluationRecord[]>;

        if (!assignmentsResponse.ok || !assignmentsPayload.ok || !assignmentsPayload.data || !assignmentsPayload.pagination) {
          throw new Error(apiError(assignmentsPayload, messages.evaluations.errors.loadFailed));
        }

        if (!evaluationsResponse.ok || !evaluationsPayload.ok || !evaluationsPayload.data) {
          throw new Error(apiError(evaluationsPayload, messages.evaluations.errors.loadFailed));
        }

        const nextEvaluationsByAssignmentId = Object.fromEntries(
          (evaluationsPayload.data ?? [])
            .filter((evaluation) => Boolean(evaluation.assignmentId))
            .map((evaluation) => [evaluation.assignmentId!, evaluation])
        ) as Record<string, EvaluationRecord>;
        const nextDraftsByAssignmentId = Object.fromEntries(
          assignmentsPayload.data.map((assignment) => {
            const existing = nextEvaluationsByAssignmentId[assignment.id];

            return [
              assignment.id,
              {
                rating: existing ? String(existing.rating) : "",
                notes: existing?.notes ?? ""
              } satisfies EvaluationDraft
            ];
          })
        ) as Record<string, EvaluationDraft>;

        setAssignments(assignmentsPayload.data);
        setPagination(assignmentsPayload.pagination);
        setEvaluationsByAssignmentId(nextEvaluationsByAssignmentId);
        setDraftsByAssignmentId(nextDraftsByAssignmentId);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error ? error.message : messages.evaluations.errors.loadFailed
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
  }, [messages.evaluations.errors.loadFailed, page, pageSize, refreshKey, session.id]);

  async function submitEvaluation(assignment: EvaluationAssignment) {
    const draft = draftsByAssignmentId[assignment.id];
    const existing = evaluationsByAssignmentId[assignment.id] ?? null;
    const editableByActor = !existing || existing.evaluatorAppUserId === actorAppUserId;

    setFormErrorByAssignmentId((current) => ({
      ...current,
      [assignment.id]: null
    }));

    if (!editableByActor) {
      setFormErrorByAssignmentId((current) => ({
        ...current,
        [assignment.id]: messages.evaluations.errors.alreadyEvaluatedByAnother
      }));
      return;
    }

    const numericRating = Number(draft?.rating ?? "");

    if (!Number.isFinite(numericRating)) {
      setFormErrorByAssignmentId((current) => ({
        ...current,
        [assignment.id]: messages.evaluations.errors.ratingRequired
      }));
      return;
    }

    if (numericRating < 1 || numericRating > 5) {
      setFormErrorByAssignmentId((current) => ({
        ...current,
        [assignment.id]: messages.evaluations.errors.ratingRange
      }));
      return;
    }

    setSavingByAssignmentId((current) => ({
      ...current,
      [assignment.id]: true
    }));

    try {
      const response = await fetch("/api/evaluations", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          sessionId: assignment.sessionId,
          assignmentId: assignment.id,
          userId: assignment.userId,
          rating: numericRating,
          notes: draft?.notes || undefined,
          allowUpdate: Boolean(existing)
        })
      });
      const payload = (await response.json()) as ApiPayload<EvaluationRecord>;

      if (!response.ok || !payload.ok || !payload.data || !payload.data.assignmentId) {
        setFormErrorByAssignmentId((current) => ({
          ...current,
          [assignment.id]: apiError(payload, messages.evaluations.errors.submitFailed)
        }));
        return;
      }

      setEvaluationsByAssignmentId((current) => ({
        ...current,
        [assignment.id]: payload.data!
      }));
    } finally {
      setSavingByAssignmentId((current) => ({
        ...current,
        [assignment.id]: false
      }));
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{messages.evaluations.title}</CardTitle>
          <CardDescription>{messages.evaluations.loading}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="border-danger/40">
        <CardHeader>
          <CardTitle>{messages.evaluations.title}</CardTitle>
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
        title={messages.evaluations.title}
        description={messages.evaluations.subtitle}
        aside={
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {messages.evaluations.list.title}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-text-primary">
              {pagination.total}
            </p>
          </>
        }
        actions={
          <>
            <ActionLink href={`/sessions/${session.id}`}>{messages.evaluations.backToSession}</ActionLink>
            <div className="flex items-center gap-2">
              <select
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="h-9 rounded-xl border border-border bg-surface px-3 text-sm text-text-primary outline-none"
              >
                {pageSizeOptions.map((sizeOption) => (
                  <option key={sizeOption} value={String(sizeOption)}>
                    {sizeOption}
                  </option>
                ))}
              </select>
              <IconButton
                variant="secondary"
                size="sm"
                icon={<RefreshIcon />}
                label={messages.evaluations.refresh}
                onClick={() => setRefreshKey((current) => current + 1)}
              />
            </div>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{messages.evaluations.list.title}</CardTitle>
          <CardDescription>{messages.evaluations.list.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignments.length === 0 ? (
            <DataTableEmptyState
              title={messages.evaluations.list.title}
              description={messages.evaluations.list.empty}
            />
          ) : (
            <>
              <div className="rounded-[24px] border border-border bg-surface-elevated">
                <DataTable>
                  <DataTableHeader>
                    <tr>
                      <DataTableHead>{messages.evaluations.list.title}</DataTableHead>
                      <DataTableHead>{messages.evaluations.labels.location}</DataTableHead>
                      <DataTableHead>{messages.evaluations.labels.assignedAt}</DataTableHead>
                      <DataTableHead>{messages.evaluations.labels.lastEvaluatedAt}</DataTableHead>
                      <DataTableHead>{messages.evaluations.actions.submit}</DataTableHead>
                    </tr>
                  </DataTableHeader>
                  <DataTableBody>
                    {assignments.map((assignment) => {
              const existing = evaluationsByAssignmentId[assignment.id] ?? null;
              const draft = draftsByAssignmentId[assignment.id] ?? {
                rating: "",
                notes: ""
              };
              const canEdit = !existing || existing.evaluatorAppUserId === actorAppUserId;
              const isSaving = savingByAssignmentId[assignment.id] ?? false;

              return (
                <DataTableRow key={assignment.id}>
                  <DataTableCell>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge>{messages.assignments.statuses[assignment.status]}</Badge>
                        <Badge>{messages.assignments.methods[assignment.assignedMethod]}</Badge>
                        <Badge variant={existing ? "accent" : "default"}>
                          {existing
                            ? messages.evaluations.statuses.evaluated
                            : messages.evaluations.statuses.notEvaluated}
                        </Badge>
                      </div>
                      <div>
                        <p className="font-semibold text-text-primary">
                          {getLocalizedName(assignment.user, locale)}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {getLocalizedName(assignment.roleDefinition, locale)}
                        </p>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>{assignmentLocationLabel(assignment, locale)}</DataTableCell>
                  <DataTableCell>{formatDateTime(locale, assignment.assignedAt)}</DataTableCell>
                  <DataTableCell>
                    <div className="space-y-1">
                      <p>{formatDateTime(locale, existing?.updatedAt ?? null)}</p>
                      <p className="text-xs text-text-secondary">
                        {existing?.evaluatorAppUser.displayName ??
                          messages.evaluations.labels.notEvaluated}
                      </p>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="min-w-[18rem] space-y-3">
                      <div className="grid gap-3 lg:grid-cols-2">
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      step={0.1}
                      value={draft.rating}
                      placeholder={messages.evaluations.labels.rating}
                      disabled={!canEdit}
                      onChange={(event) =>
                        setDraftsByAssignmentId((current) => ({
                          ...current,
                          [assignment.id]: {
                            ...(current[assignment.id] ?? {
                              rating: "",
                              notes: ""
                            }),
                            rating: event.target.value
                          }
                        }))
                      }
                    />
                    <Input
                      value={draft.notes}
                      placeholder={messages.evaluations.labels.notes}
                      disabled={!canEdit}
                      onChange={(event) =>
                        setDraftsByAssignmentId((current) => ({
                          ...current,
                          [assignment.id]: {
                            ...(current[assignment.id] ?? {
                              rating: "",
                              notes: ""
                            }),
                            notes: event.target.value
                          }
                        }))
                      }
                    />
                      </div>

                  {formErrorByAssignmentId[assignment.id] ? (
                    <p className="text-sm text-danger">
                      {formErrorByAssignmentId[assignment.id]}
                    </p>
                  ) : null}

                  <div className="flex justify-end">
                    <Button
                      onClick={() => void submitEvaluation(assignment)}
                      disabled={!canEdit || isSaving}
                    >
                      {isSaving
                        ? messages.evaluations.actions.submitting
                        : existing
                          ? messages.evaluations.actions.update
                          : messages.evaluations.actions.submit}
                    </Button>
                  </div>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              );
                    })}
                  </DataTableBody>
                </DataTable>
              </div>

              <PaginationControls
                page={pagination.page}
                pageCount={pagination.pageCount}
                total={pagination.total}
                hasPreviousPage={pagination.hasPreviousPage}
                hasNextPage={pagination.hasNextPage}
                summaryLabel={`${pagination.page} / ${pagination.pageCount}`}
                totalLabel={`${messages.evaluations.list.title}: ${pagination.total}`}
                previousLabel={messages.cycles.pagination.previous}
                nextLabel={messages.cycles.pagination.next}
                onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                onNext={() => setPage((current) => current + 1)}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
