"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { TemplateDownloadCard } from "@/components/import-templates/template-download-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
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
import { ArrowUpRightIcon, EyeIcon, RefreshIcon } from "@/components/ui/icons";
import { ModalFrame } from "@/components/ui/modal-frame";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHero } from "@/components/ui/page-hero";
import { Textarea } from "@/components/ui/textarea";
import type { Locale, Messages } from "@/lib/i18n";
import {
  getAlternateLocalizedName,
  getLocalizedName
} from "@/lib/i18n/presentation";
import {
  getProctorOperationalRoleLabel,
  getProctorOperationalRoleOptions
} from "@/lib/proctors/operational-role";

type ProctorSource = "SPHINX" | "UNIVERSITY" | "EXTERNAL";
type ProctorOperationalRole = "HEAD" | "SENIOR" | "ROAMING" | "PROCTOR" | "CONTROL" | "SERVICE";
type BlockStatus = "CLEAR" | "TEMPORARY" | "PERMANENT";
type PreferredLanguage = "AR" | "EN" | null;
type ExportFormat = "csv" | "excel";
type ExportStatus = "active" | "inactive" | "all";

type GovernorateOption = {
  id: string;
  name: string;
  nameEn: string | null;
};

type ProctorRecord = {
  id: string;
  name: string;
  nameEn: string | null;
  phone: string;
  nationalId: string | null;
  email: string | null;
  source: ProctorSource;
  operationalRole: ProctorOperationalRole | null;
  organization: string | null;
  branch: string | null;
  governorateId: string | null;
  averageRating: string;
  totalSessions: number;
  blockStatus: BlockStatus;
  blockEndsAt: string | null;
  preferredLanguage: PreferredLanguage;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  governorate: {
    id: string;
    name: string;
    nameEn: string | null;
    code: string | null;
  } | null;
  _count: {
    assignments: number;
    waitingListEntries: number;
    evaluationsReceived: number;
    blocks: number;
  };
};

type ProctorsResponse = {
  ok: boolean;
  data?: ProctorRecord[];
  pagination?: PaginationMeta;
  error?: string;
  message?: string;
};

type PaginationMeta = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
};

type ProctorDetailResponse = {
  ok: boolean;
  data?: ProctorRecord;
  error?: string;
  message?: string;
};

type ProctorMutationResponse = {
  ok: boolean;
  data?: ProctorRecord;
  error?: string;
  message?: string;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  } | Record<string, unknown> | null;
};

type ProctorsImportTemplateResponse = {
  ok: boolean;
  sampleCsv?: string;
  columns?: string[];
};

type ProctorsImportResponse = {
  ok: boolean;
  summary?: {
    total: number;
    success: number;
    failed: number;
    created: number;
    reused: number;
  };
  errors?: Array<{
    row: number;
    error: string;
    message: string;
    details?: Record<string, unknown> | null;
  }>;
  error?: string;
  message?: string;
};

type LocationsResponse = {
  ok: boolean;
  data?: GovernorateOption[];
  error?: string;
  message?: string;
};

type ProctorsDirectoryProps = {
  locale: Locale;
  messages: Messages;
};

type ProctorFormState = {
  name: string;
  nameEn: string;
  phone: string;
  email: string;
  nationalId: string;
  source: ProctorSource;
  operationalRole: "" | ProctorOperationalRole;
  organization: string;
  branch: string;
  governorateId: string;
  preferredLanguage: "" | "AR" | "EN";
  isActive: boolean;
  notes: string;
};

const selectClassName =
  "h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent";

const pageSizeOptions = [10, 25, 50];

function DetailSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-24 animate-pulse rounded-3xl border border-border bg-surface-elevated"
        />
      ))}
    </div>
  );
}

function formatDate(locale: Locale, value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function toPreferredLanguageLabel(
  locale: Locale,
  messages: Messages,
  value: PreferredLanguage
) {
  if (value === "AR") {
    return messages.common.arabic;
  }

  if (value === "EN") {
    return messages.common.english;
  }

  return locale === "ar" ? "-" : "-";
}

function DetailRow({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface-elevated px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-secondary">
        {label}
      </p>
      <div className="mt-2 text-sm leading-7 text-text-primary">{value ?? "-"}</div>
    </div>
  );
}

function MetricCard({
  label,
  value
}: {
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function createInitialProctorForm(): ProctorFormState {
  return {
    name: "",
    nameEn: "",
    phone: "",
    email: "",
    nationalId: "",
    source: "UNIVERSITY",
    operationalRole: "",
    organization: "",
    branch: "",
    governorateId: "",
    preferredLanguage: "",
    isActive: true,
    notes: ""
  };
}

function mapProctorToFormState(proctor: ProctorRecord): ProctorFormState {
  return {
    name: proctor.name,
    nameEn: proctor.nameEn ?? "",
    phone: proctor.phone,
    email: proctor.email ?? "",
    nationalId: proctor.nationalId ?? "",
    source: proctor.source,
    operationalRole: proctor.operationalRole ?? "",
    organization: proctor.organization ?? "",
    branch: proctor.branch ?? "",
    governorateId: proctor.governorateId ?? "",
    preferredLanguage: proctor.preferredLanguage ?? "",
    isActive: proctor.isActive,
    notes: proctor.notes ?? ""
  };
}

function extractApiErrorMessage(
  payload: {
    error?: string;
    message?: string;
    details?:
      | {
          fieldErrors?: Record<string, string[] | undefined>;
          formErrors?: string[];
        }
      | Record<string, unknown>
      | null;
  },
  fallback: string
) {
  if (payload.message) {
    return payload.message;
  }

  const details = payload.details;

  if (
    details &&
    "fieldErrors" in details &&
    details.fieldErrors &&
    typeof details.fieldErrors === "object"
  ) {
    for (const errors of Object.values(details.fieldErrors)) {
      if (Array.isArray(errors) && errors.length > 0) {
        return errors[0] ?? fallback;
      }
    }
  }

  if (
    details &&
    "formErrors" in details &&
    Array.isArray(details.formErrors) &&
    details.formErrors.length > 0
  ) {
    return details.formErrors[0] ?? fallback;
  }

  return payload.error ?? fallback;
}

export function ProctorsDirectory({ locale, messages }: ProctorsDirectoryProps) {
  const router = useRouter();
  const copy =
    locale === "ar"
      ? {
          manualCreate: "إضافة يدويًا",
          manualEdit: "تعديل البيانات",
          manualDelete: "تعطيل المراقب",
          manualTitleCreate: "إضافة مراقب يدويًا",
          manualTitleEdit: "تعديل بيانات المراقب",
          manualBody:
            "أضف أو عدّل سجل مراقب واحد بدون الحاجة إلى تجهيز شيت كامل، مع تحديد المصدر، الجامعة/الجهة، والرول التشغيلية.",
          submitCreate: "إضافة المراقب",
          submitEdit: "حفظ التعديل",
          saving: "جارٍ الحفظ...",
          roleLabel: "الرول التشغيلية",
          roleFilterLabel: "فلترة بالرول",
          allRoles: "كل الرولات",
          organizationLabel: "الجهة / الجامعة",
          organizationUniversityLabel: "اسم الجامعة",
          organizationHintUniversity:
            "إذا كان المصدر جامعة، اكتب اسم الجامعة أو الجهة الجامعية بوضوح.",
          organizationHintGeneral:
            "اكتب اسم الجهة كما تريد ظهوره في البحث والتصدير.",
          branchLabel: "الفرع / المقر",
          statusLabel: "الحالة",
          activeOption: "نشط",
          inactiveOption: "غير نشط",
          saveError: "تعذر حفظ بيانات المراقب.",
          deleteError: "تعذر تعطيل المراقب.",
          deleteConfirm:
            "سيتم تعطيل المراقب وإخفاؤه من القوائم النشطة. هل تريد المتابعة؟",
          tableRole: "الرول",
          templateTitle: "قالب استيراد المراقبين",
          templateDescription:
            "حمّل القالب أو العينة من نفس الصفحة، سواء كنت ترفع شيت منفصل لكل جامعة أو تضيف فردًا واحدًا يدويًا.",
          templateButton: "تحميل القالب",
          templateSample: "تحميل عينة",
          templateOpenAll: "كل القوالب",
          exportRoleLabel: "تصفية حسب الرول"
        }
      : {
          manualCreate: "Add manually",
          manualEdit: "Edit data",
          manualDelete: "Deactivate proctor",
          manualTitleCreate: "Add proctor manually",
          manualTitleEdit: "Edit proctor",
          manualBody:
            "Create or update a single proctor without preparing a full sheet, including source, university/organization, and operational role.",
          submitCreate: "Create proctor",
          submitEdit: "Save changes",
          saving: "Saving...",
          roleLabel: "Operational role",
          roleFilterLabel: "Filter by role",
          allRoles: "All roles",
          organizationLabel: "Organization / university",
          organizationUniversityLabel: "University name",
          organizationHintUniversity:
            "When the source is University, enter the exact university or faculty pool name.",
          organizationHintGeneral:
            "Use the organization name exactly as you want it to appear in search and exports.",
          branchLabel: "Branch / campus",
          statusLabel: "Status",
          activeOption: "Active",
          inactiveOption: "Inactive",
          saveError: "Could not save the proctor.",
          deleteError: "Could not deactivate the proctor.",
          deleteConfirm:
            "The proctor will be deactivated and hidden from active workflows. Continue?",
          tableRole: "Role",
          templateTitle: "Proctors import template",
          templateDescription:
            "Download the template or sample directly from this page, whether you upload one sheet per university or add a single person manually.",
          templateButton: "Download template",
          templateSample: "Download sample",
          templateOpenAll: "All templates",
          exportRoleLabel: "Role filter"
        };
  const roleOptions = getProctorOperationalRoleOptions(locale);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"" | ProctorSource>("");
  const [operationalRoleFilter, setOperationalRoleFilter] = useState<
    "" | ProctorOperationalRole
  >("");
  const [blockStatusFilter, setBlockStatusFilter] = useState<"" | BlockStatus>("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [listState, setListState] = useState({
    isLoading: true,
    error: null as string | null,
    errorCode: null as string | null,
    data: [] as ProctorRecord[],
    pagination: {
      hasNextPage: false,
      hasPreviousPage: false,
      page: 1,
      pageCount: 1,
      pageSize: 10,
      total: 0
    } as PaginationMeta
  });
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState({
    isLoading: false,
    error: null as string | null,
    errorCode: null as string | null,
    data: null as ProctorRecord | null
  });
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ProctorsImportResponse | null>(null);
  const [importSample, setImportSample] = useState("");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportStatus, setExportStatus] = useState<ExportStatus>("active");
  const [exportGovernorateId, setExportGovernorateId] = useState("");
  const [exportOperationalRole, setExportOperationalRole] = useState<
    "" | ProctorOperationalRole
  >("");
  const [governorates, setGovernorates] = useState<GovernorateOption[]>([]);
  const [isGovernoratesLoading, setIsGovernoratesLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingProctorId, setEditingProctorId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProctorFormState>(() =>
    createInitialProctorForm()
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadList() {
      setListState((current) => ({
        ...current,
        isLoading: true,
        error: null,
        errorCode: null
      }));

      const params = new URLSearchParams();
      params.set("includeInactive", includeInactive ? "true" : "false");
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      if (sourceFilter) {
        params.set("source", sourceFilter);
      }

      if (operationalRoleFilter) {
        params.set("operationalRole", operationalRoleFilter);
      }

      if (blockStatusFilter) {
        params.set("blockStatus", blockStatusFilter);
      }

      try {
        const response = await fetch(`/api/proctors?${params.toString()}`, {
          method: "GET",
          credentials: "same-origin",
          headers: {
            Accept: "application/json"
          },
          signal: controller.signal
        });
        const payload = (await response.json()) as ProctorsResponse;

        if (!response.ok || !payload.ok || !payload.data || !payload.pagination) {
          throw new Error(payload.message ?? payload.error ?? "proctors_request_failed");
        }

        const records = payload.data;

        setListState({
          isLoading: false,
          error: null,
          errorCode: null,
          data: records,
          pagination: payload.pagination
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setListState({
          isLoading: false,
          error: messages.proctors.errorBody,
          errorCode: error instanceof Error ? error.message : "proctors_request_failed",
          data: [],
          pagination: {
            hasNextPage: false,
            hasPreviousPage: false,
            page: 1,
            pageCount: 1,
            pageSize,
            total: 0
          }
        });
      }
    }

    void loadList();

    return () => {
      controller.abort();
    };
  }, [
    blockStatusFilter,
    includeInactive,
    messages.proctors.errorBody,
    operationalRoleFilter,
    page,
    pageSize,
    refreshKey,
    searchTerm,
    sourceFilter
  ]);

  useEffect(() => {
    if (!activeDetailId) {
      setDetailState({
        isLoading: false,
        error: null,
        errorCode: null,
        data: null
      });
      return;
    }

    const controller = new AbortController();

    async function loadDetail() {
      setDetailState((current) => ({
        ...current,
        isLoading: true,
        error: null,
        errorCode: null
      }));

      try {
        const response = await fetch(
          `/api/proctors/${activeDetailId}?includeInactive=${includeInactive ? "true" : "false"}`,
          {
            method: "GET",
            credentials: "same-origin",
            headers: {
              Accept: "application/json"
            },
            signal: controller.signal
          }
        );
        const payload = (await response.json()) as ProctorDetailResponse;

        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.message ?? payload.error ?? "proctor_detail_failed");
        }

        setDetailState({
          isLoading: false,
          error: null,
          errorCode: null,
          data: payload.data
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setDetailState({
          isLoading: false,
          error: messages.proctors.detailErrorBody,
          errorCode: error instanceof Error ? error.message : "proctor_detail_failed",
          data: null
        });
      }
    }

    void loadDetail();

    return () => {
      controller.abort();
    };
  }, [activeDetailId, includeInactive, messages.proctors.detailErrorBody]);

  async function openImportModal() {
    setIsImportOpen(true);
    setImportError(null);

    if (importSample) {
      return;
    }

    try {
      const response = await fetch("/api/proctors/import", {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });

      const payload = (await response.json()) as ProctorsImportTemplateResponse;

      if (response.ok && payload.ok && payload.sampleCsv) {
        setImportSample(payload.sampleCsv);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function handleImportSubmit() {
    if (!selectedFile) {
      setImportError(messages.proctors.importFlow.missingFile);
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setImportError(messages.proctors.importFlow.unsupportedFile);
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/proctors/import", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });
      const payload = (await response.json()) as ProctorsImportResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? payload.error ?? "proctors_import_failed");
      }

      setImportResult(payload);
      setSelectedFile(null);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      console.error(error);
      setImportError(
        error instanceof Error ? error.message : messages.proctors.importFlow.submit
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function loadGovernorates() {
    if (governorates.length > 0 || isGovernoratesLoading) {
      return;
    }

    setIsGovernoratesLoading(true);

    try {
      const response = await fetch("/api/locations?includeInactive=false", {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = (await response.json()) as LocationsResponse;

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.message ?? payload.error ?? "governorates_request_failed");
      }

      setGovernorates(
        payload.data.map((governorate) => ({
          id: governorate.id,
          name: governorate.name,
          nameEn: governorate.nameEn
        }))
      );
    } catch (error) {
      console.error(error);
    } finally {
      setIsGovernoratesLoading(false);
    }
  }

  async function openExportModal() {
    setIsExportOpen(true);
    setExportError(null);
    await loadGovernorates();
  }

  async function handleExportSubmit() {
    setIsExporting(true);
    setExportError(null);

    try {
      const params = new URLSearchParams();
      params.set("format", exportFormat);
      params.set("status", exportStatus);
      params.set("locale", locale);

      if (exportGovernorateId) {
        params.set("governorateId", exportGovernorateId);
      }

      if (exportOperationalRole) {
        params.set("operationalRole", exportOperationalRole);
      }

      const response = await fetch(`/api/proctors/export?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin"
      });

      if (!response.ok) {
        const payload = (await response.json()) as {
          error?: string;
          message?: string;
        };
        throw new Error(payload.message ?? payload.error ?? "proctors_export_failed");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("content-disposition");
      const fileNameMatch = disposition?.match(/filename=\"([^\"]+)\"/);

      anchor.href = downloadUrl;
      anchor.download =
        fileNameMatch?.[1] ??
        (exportFormat === "excel" ? "proctors-export.xls" : "proctors-export.csv");
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      setIsExportOpen(false);
    } catch (error) {
      console.error(error);
      setExportError(
        error instanceof Error ? error.message : messages.proctors.exportFlow.submit
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function openCreateModal() {
    await loadGovernorates();
    setEditingProctorId(null);
    setFormState(createInitialProctorForm());
    setFormError(null);
    setIsFormOpen(true);
  }

  async function openEditModal(proctor: ProctorRecord) {
    await loadGovernorates();
    setEditingProctorId(proctor.id);
    setFormState(mapProctorToFormState(proctor));
    setFormError(null);
    setIsFormOpen(true);
  }

  async function handleSaveProctor() {
    setIsSaving(true);
    setFormError(null);

    try {
      const payload = {
        name: formState.name,
        nameEn: formState.nameEn || undefined,
        phone: formState.phone,
        email: formState.email || undefined,
        nationalId: formState.nationalId || undefined,
        source: formState.source,
        operationalRole: formState.operationalRole || null,
        organization: formState.organization || undefined,
        branch: formState.branch || undefined,
        governorateId: formState.governorateId || null,
        preferredLanguage: formState.preferredLanguage || null,
        isActive: formState.isActive,
        notes: formState.notes || undefined
      };

      const response = await fetch(
        editingProctorId ? `/api/proctors/${editingProctorId}` : "/api/proctors",
        {
          method: editingProctorId ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );
      const result = (await response.json()) as ProctorMutationResponse;

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(extractApiErrorMessage(result, copy.saveError));
      }

      setIsFormOpen(false);
      setEditingProctorId(null);
      setFormState(createInitialProctorForm());
      setRefreshKey((current) => current + 1);

      if (activeDetailId === result.data.id) {
        setDetailState({
          isLoading: false,
          error: null,
          errorCode: null,
          data: result.data
        });
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivateProctor(proctorId: string) {
    const shouldContinue = window.confirm(copy.deleteConfirm);

    if (!shouldContinue) {
      return;
    }

    try {
      const response = await fetch(`/api/proctors/${proctorId}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const result = (await response.json()) as ProctorMutationResponse;

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(extractApiErrorMessage(result, copy.deleteError));
      }

      setRefreshKey((current) => current + 1);
      setIsFormOpen(false);

      if (!includeInactive && activeDetailId === proctorId) {
        setActiveDetailId(null);
      } else if (activeDetailId === proctorId) {
        setDetailState({
          isLoading: false,
          error: null,
          errorCode: null,
          data: result.data
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.deleteError;

      if (isFormOpen) {
        setFormError(message);
        return;
      }

      setDetailState((current) => ({
        ...current,
        error: message,
        errorCode: "proctor_delete_failed"
      }));
    }
  }

  const selectedProctor = detailState.data;
  const isEditing = editingProctorId !== null;
  const organizationFieldLabel =
    formState.source === "UNIVERSITY"
      ? copy.organizationUniversityLabel
      : copy.organizationLabel;
  const organizationHint =
    formState.source === "UNIVERSITY"
      ? copy.organizationHintUniversity
      : copy.organizationHintGeneral;
  const listCount = listState.pagination.total;
  const metrics = [
    {
      label: messages.proctors.labels.sessions,
      value: listState.data.reduce((sum, proctor) => sum + proctor.totalSessions, 0)
    },
    {
      label: messages.proctors.labels.assignments,
      value: listState.data.reduce((sum, proctor) => sum + proctor._count.assignments, 0)
    },
    {
      label: messages.proctors.labels.waitingList,
      value: listState.data.reduce((sum, proctor) => sum + proctor._count.waitingListEntries, 0)
    },
    {
      label: messages.proctors.labels.blocks,
      value: listState.data.reduce((sum, proctor) => sum + proctor._count.blocks, 0)
    }
  ];

  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          { label: messages.common.protected, variant: "accent" },
          { label: messages.nav.proctors }
        ]}
        title={messages.proctors.title}
        description={messages.proctors.subtitle}
        aside={
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {messages.proctors.listTitle}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-text-primary">
              {listCount}
            </p>
          </>
        }
        body={
          <div className="space-y-4">
            <p className="max-w-3xl text-sm leading-7 text-text-secondary">
              {messages.proctors.description}
            </p>
            <div className="grid gap-4 xl:grid-cols-[2fr_repeat(3,1fr)]">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary" htmlFor="proctors-search">
                  {messages.proctors.searchLabel}
                </label>
                <Input
                  id="proctors-search"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setPage(1);
                  }}
                  placeholder={messages.proctors.searchPlaceholder}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary" htmlFor="proctors-source">
                  {messages.proctors.filters.source}
                </label>
                <select
                  id="proctors-source"
                  value={sourceFilter}
                  onChange={(event) => {
                    setSourceFilter(event.target.value as "" | ProctorSource);
                    setPage(1);
                  }}
                  className={selectClassName}
                >
                  <option value="">{messages.proctors.filters.allSources}</option>
                  <option value="SPHINX">{messages.proctors.sources.SPHINX}</option>
                  <option value="UNIVERSITY">{messages.proctors.sources.UNIVERSITY}</option>
                  <option value="EXTERNAL">{messages.proctors.sources.EXTERNAL}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-text-primary"
                  htmlFor="proctors-operational-role"
                >
                  {copy.roleFilterLabel}
                </label>
                <select
                  id="proctors-operational-role"
                  value={operationalRoleFilter}
                  onChange={(event) => {
                    setOperationalRoleFilter(
                      event.target.value as "" | ProctorOperationalRole
                    );
                    setPage(1);
                  }}
                  className={selectClassName}
                >
                  <option value="">{copy.allRoles}</option>
                  {roleOptions.map((roleOption) => (
                    <option key={roleOption.value} value={roleOption.value}>
                      {roleOption.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-text-primary"
                  htmlFor="proctors-block-status"
                >
                  {messages.proctors.filters.blockStatus}
                </label>
                <select
                  id="proctors-block-status"
                  value={blockStatusFilter}
                  onChange={(event) => {
                    setBlockStatusFilter(event.target.value as "" | BlockStatus);
                    setPage(1);
                  }}
                  className={selectClassName}
                >
                  <option value="">{messages.proctors.filters.allBlockStatuses}</option>
                  <option value="CLEAR">{messages.proctors.blockStatuses.CLEAR}</option>
                  <option value="TEMPORARY">{messages.proctors.blockStatuses.TEMPORARY}</option>
                  <option value="PERMANENT">{messages.proctors.blockStatuses.PERMANENT}</option>
                </select>
              </div>
              <div className="space-y-2 xl:col-span-4">
                <label className="text-sm font-medium text-text-primary" htmlFor="proctors-page-size">
                  {messages.cycles.pagination.pageSize}
                </label>
                <select
                  id="proctors-page-size"
                  value={String(pageSize)}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className={selectClassName}
                >
                  {pageSizeOptions.map((sizeOption) => (
                    <option key={sizeOption} value={String(sizeOption)}>
                      {sizeOption}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={() => void openCreateModal()}>
                {copy.manualCreate}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void openImportModal()}>
                {messages.proctors.import}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void openExportModal()}>
                {messages.proctors.export}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIncludeInactive((current) => !current);
                  setPage(1);
                }}
              >
                {includeInactive
                  ? messages.proctors.showActiveOnly
                  : messages.proctors.showInactive}
              </Button>
              <IconButton
                variant="secondary"
                size="sm"
                icon={<RefreshIcon />}
                label={messages.proctors.reload}
                onClick={() => setRefreshKey((current) => current + 1)}
              />
            </div>
          </div>
        }
      />

      <TemplateDownloadCard
        locale={locale}
        templateKey="proctors"
        title={copy.templateTitle}
        description={copy.templateDescription}
        templateLabel={copy.templateButton}
        sampleLabel={copy.templateSample}
        openAllLabel={copy.templateOpenAll}
      />

      <Card>
        <CardHeader>
          <CardTitle>{messages.proctors.snapshotTitle}</CardTitle>
          <CardDescription>{messages.proctors.snapshotBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.proctors.listTitle}</CardTitle>
          <CardDescription>
            {messages.proctors.listBody.replace("{count}", String(listCount))}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {listState.isLoading ? <DetailSkeleton /> : null}

          {!listState.isLoading && listState.error ? (
            <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-5 py-5">
              <h3 className="text-lg font-semibold text-text-primary">
                {messages.proctors.errorTitle}
              </h3>
              <p className="mt-2 text-sm leading-7 text-text-secondary">
                {listState.error}
              </p>
              {listState.errorCode ? (
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-danger">
                  {listState.errorCode}
                </p>
              ) : null}
            </div>
          ) : null}

          {!listState.isLoading && !listState.error && listState.data.length === 0 ? (
            <DataTableEmptyState
              title={messages.proctors.emptyTitle}
              description={messages.proctors.emptyBody}
            />
          ) : null}

          {!listState.isLoading && !listState.error && listState.data.length > 0 ? (
            <>
              <div className="rounded-[24px] border border-border bg-surface-elevated">
                <DataTable>
                  <DataTableHeader>
                    <tr>
                      <DataTableHead>{messages.proctors.listTitle}</DataTableHead>
                      <DataTableHead>{messages.proctors.labels.phone}</DataTableHead>
                      <DataTableHead>{copy.tableRole}</DataTableHead>
                      <DataTableHead>{messages.proctors.labels.organization}</DataTableHead>
                      <DataTableHead>{messages.proctors.labels.governorate}</DataTableHead>
                      <DataTableHead>{messages.proctors.labels.sessions}</DataTableHead>
                      <DataTableHead>{messages.proctors.labels.assignments}</DataTableHead>
                      <DataTableHead className="w-28 text-end">
                        <span className="sr-only">{messages.proctors.detailTitle}</span>
                      </DataTableHead>
                    </tr>
                  </DataTableHeader>
                  <DataTableBody>
                    {listState.data.map((proctor) => {
                      const label = getLocalizedName(proctor, locale);
                      const alternate = getAlternateLocalizedName(proctor, locale);

                      return (
                        <DataTableRow key={proctor.id}>
                          <DataTableCell>
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="accent">
                                  {messages.proctors.sources[proctor.source]}
                                </Badge>
                                <Badge>
                                  {proctor.isActive
                                    ? messages.proctors.labels.active
                                    : messages.proctors.labels.inactive}
                                </Badge>
                                <Badge>
                                  {messages.proctors.blockStatuses[proctor.blockStatus]}
                                </Badge>
                              </div>
                              <div>
                                <p className="font-semibold text-text-primary">{label}</p>
                                {alternate ? (
                                  <p className="text-xs text-text-secondary">{alternate}</p>
                                ) : null}
                              </div>
                            </div>
                          </DataTableCell>
                          <DataTableCell>{proctor.phone}</DataTableCell>
                          <DataTableCell>
                            {getProctorOperationalRoleLabel(proctor.operationalRole, locale)}
                          </DataTableCell>
                          <DataTableCell>{proctor.organization ?? "-"}</DataTableCell>
                          <DataTableCell>
                            {proctor.governorate
                              ? getLocalizedName(proctor.governorate, locale)
                              : "-"}
                          </DataTableCell>
                          <DataTableCell>{proctor.totalSessions}</DataTableCell>
                          <DataTableCell>{proctor._count.assignments}</DataTableCell>
                          <DataTableCell className="text-end">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void openEditModal(proctor)}
                              >
                                {copy.manualEdit}
                              </Button>
                              <IconButton
                                variant="secondary"
                                size="sm"
                                icon={<EyeIcon />}
                                label={messages.proctors.detailTitle}
                                onClick={() => setActiveDetailId(proctor.id)}
                              />
                              <IconButton
                                variant="secondary"
                                size="sm"
                                icon={<ArrowUpRightIcon />}
                                label={messages.proctors.viewProfile}
                                onClick={() => router.push(`/proctors/${proctor.id}`)}
                              />
                            </div>
                          </DataTableCell>
                        </DataTableRow>
                      );
                    })}
                  </DataTableBody>
                </DataTable>
              </div>

              <PaginationControls
                page={listState.pagination.page}
                pageCount={listState.pagination.pageCount}
                total={listState.pagination.total}
                hasPreviousPage={listState.pagination.hasPreviousPage}
                hasNextPage={listState.pagination.hasNextPage}
                summaryLabel={`${messages.cycles.pagination.summary.replace("{page}", String(listState.pagination.page)).replace("{pageCount}", String(listState.pagination.pageCount))}`}
                totalLabel={messages.proctors.listBody.replace("{count}", String(listState.pagination.total))}
                previousLabel={messages.cycles.pagination.previous}
                nextLabel={messages.cycles.pagination.next}
                onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                onNext={() => setPage((current) => current + 1)}
              />
            </>
          ) : null}
        </CardContent>
      </Card>

      {activeDetailId ? (
        <ModalFrame
          title={messages.proctors.detailTitle}
          description={messages.proctors.detailBody}
          closeLabel={messages.proctors.importFlow.close}
          onClose={() => {
            setActiveDetailId(null);
            setDetailState({
              isLoading: false,
              error: null,
              errorCode: null,
              data: null
            });
          }}
          className="max-w-6xl"
          bodyClassName="space-y-6"
        >
          {detailState.isLoading ? <DetailSkeleton /> : null}

          {!detailState.isLoading && detailState.error ? (
            <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-5 py-5">
              <h3 className="text-lg font-semibold text-text-primary">
                {messages.proctors.detailErrorTitle}
              </h3>
              <p className="mt-2 text-sm leading-7 text-text-secondary">
                {detailState.error}
              </p>
              {detailState.errorCode ? (
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-danger">
                  {detailState.errorCode}
                </p>
              ) : null}
            </div>
          ) : null}

          {!detailState.isLoading && !detailState.error && !selectedProctor ? (
            <div className="rounded-3xl border border-border bg-surface-elevated px-5 py-5">
              <h3 className="text-lg font-semibold text-text-primary">
                {messages.proctors.detailEmptyTitle}
              </h3>
              <p className="mt-2 text-sm leading-7 text-text-secondary">
                {messages.proctors.detailEmptyBody}
              </p>
            </div>
          ) : null}

          {!detailState.isLoading && !detailState.error && selectedProctor ? (
            <>
              <div className="rounded-3xl border border-border bg-surface-elevated px-5 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="accent">
                        {messages.proctors.sources[selectedProctor.source]}
                      </Badge>
                      <Badge>{getProctorOperationalRoleLabel(selectedProctor.operationalRole, locale)}</Badge>
                      <Badge>
                        {selectedProctor.isActive
                          ? messages.proctors.labels.active
                          : messages.proctors.labels.inactive}
                      </Badge>
                      <Badge>
                        {messages.proctors.blockStatuses[selectedProctor.blockStatus]}
                      </Badge>
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-text-primary">
                      {getLocalizedName(selectedProctor, locale)}
                    </h3>
                    {getAlternateLocalizedName(selectedProctor, locale) ? (
                      <p className="mt-2 text-sm text-text-secondary">
                        {getAlternateLocalizedName(selectedProctor, locale)}
                      </p>
                    ) : null}
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary">
                      {selectedProctor.notes ?? messages.proctors.noNotes}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void openEditModal(selectedProctor)}
                    >
                      {copy.manualEdit}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void handleDeactivateProctor(selectedProctor.id)}
                    >
                      {copy.manualDelete}
                    </Button>
                    <IconButton
                      variant="secondary"
                      size="md"
                      icon={<ArrowUpRightIcon />}
                      label={messages.proctors.viewProfile}
                      onClick={() => router.push(`/proctors/${selectedProctor.id}`)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <DetailRow label={messages.proctors.labels.phone} value={selectedProctor.phone} />
                <DetailRow
                  label={messages.proctors.labels.email}
                  value={selectedProctor.email ?? "-"}
                />
                <DetailRow
                  label={messages.proctors.labels.nationalId}
                  value={selectedProctor.nationalId ?? "-"}
                />
                <DetailRow
                  label={copy.roleLabel}
                  value={getProctorOperationalRoleLabel(
                    selectedProctor.operationalRole,
                    locale
                  )}
                />
                <DetailRow
                  label={messages.proctors.labels.organization}
                  value={selectedProctor.organization ?? "-"}
                />
                <DetailRow
                  label={messages.proctors.labels.branch}
                  value={selectedProctor.branch ?? "-"}
                />
                <DetailRow
                  label={messages.proctors.labels.governorate}
                  value={
                    selectedProctor.governorate
                      ? getLocalizedName(selectedProctor.governorate, locale)
                      : "-"
                  }
                />
                <DetailRow
                  label={messages.proctors.labels.preferredLanguage}
                  value={toPreferredLanguageLabel(
                    locale,
                    messages,
                    selectedProctor.preferredLanguage
                  )}
                />
                <DetailRow
                  label={messages.proctors.labels.rating}
                  value={selectedProctor.averageRating}
                />
                <DetailRow
                  label={messages.proctors.labels.sessions}
                  value={selectedProctor.totalSessions}
                />
                <DetailRow
                  label={messages.proctors.labels.assignments}
                  value={selectedProctor._count.assignments}
                />
                <DetailRow
                  label={messages.proctors.labels.waitingList}
                  value={selectedProctor._count.waitingListEntries}
                />
                <DetailRow
                  label={messages.proctors.labels.blocks}
                  value={selectedProctor._count.blocks}
                />
                <DetailRow
                  label={messages.proctors.labels.blockEndsAt}
                  value={formatDate(locale, selectedProctor.blockEndsAt) ?? "-"}
                />
                <DetailRow
                  label={messages.proctors.labels.updatedAt}
                  value={formatDate(locale, selectedProctor.updatedAt) ?? "-"}
                />
              </div>
            </>
          ) : null}
        </ModalFrame>
      ) : null}

      {isFormOpen ? (
        <ModalFrame
          title={isEditing ? copy.manualTitleEdit : copy.manualTitleCreate}
          description={copy.manualBody}
          closeLabel={messages.proctors.importFlow.close}
          onClose={() => {
            setIsFormOpen(false);
            setEditingProctorId(null);
            setFormError(null);
            setFormState(createInitialProctorForm());
          }}
          className="max-w-5xl"
          bodyClassName="space-y-6"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-name">
                {locale === "ar" ? "الاسم" : "Name"}
              </label>
              <Input
                id="proctor-form-name"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-name-en">
                {locale === "ar" ? "الاسم بالإنجليزية" : "English name"}
              </label>
              <Input
                id="proctor-form-name-en"
                value={formState.nameEn}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, nameEn: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-phone">
                {messages.proctors.labels.phone}
              </label>
              <Input
                id="proctor-form-phone"
                value={formState.phone}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-email">
                {messages.proctors.labels.email}
              </label>
              <Input
                id="proctor-form-email"
                type="email"
                value={formState.email}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, email: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-national-id">
                {messages.proctors.labels.nationalId}
              </label>
              <Input
                id="proctor-form-national-id"
                value={formState.nationalId}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    nationalId: event.target.value
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-source">
                {messages.proctors.filters.source}
              </label>
              <select
                id="proctor-form-source"
                value={formState.source}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    source: event.target.value as ProctorSource
                  }))
                }
                className={selectClassName}
              >
                <option value="SPHINX">{messages.proctors.sources.SPHINX}</option>
                <option value="UNIVERSITY">{messages.proctors.sources.UNIVERSITY}</option>
                <option value="EXTERNAL">{messages.proctors.sources.EXTERNAL}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-role">
                {copy.roleLabel}
              </label>
              <select
                id="proctor-form-role"
                value={formState.operationalRole}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    operationalRole: event.target.value as "" | ProctorOperationalRole
                  }))
                }
                className={selectClassName}
              >
                <option value="">{copy.allRoles}</option>
                {roleOptions.map((roleOption) => (
                  <option key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-governorate">
                {messages.proctors.labels.governorate}
              </label>
              <select
                id="proctor-form-governorate"
                value={formState.governorateId}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    governorateId: event.target.value
                  }))
                }
                className={selectClassName}
              >
                <option value="">{messages.proctors.exportFlow.allGovernorates}</option>
                {governorates.map((governorate) => (
                  <option key={governorate.id} value={governorate.id}>
                    {getLocalizedName(governorate, locale)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-organization">
                {organizationFieldLabel}
              </label>
              <Input
                id="proctor-form-organization"
                value={formState.organization}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    organization: event.target.value
                  }))
                }
              />
              <p className="text-xs text-text-secondary">{organizationHint}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-branch">
                {copy.branchLabel}
              </label>
              <Input
                id="proctor-form-branch"
                value={formState.branch}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, branch: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-language">
                {messages.proctors.labels.preferredLanguage}
              </label>
              <select
                id="proctor-form-language"
                value={formState.preferredLanguage}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    preferredLanguage: event.target.value as "" | "AR" | "EN"
                  }))
                }
                className={selectClassName}
              >
                <option value="">{locale === "ar" ? "بدون تفضيل" : "No preference"}</option>
                <option value="AR">{messages.common.arabic}</option>
                <option value="EN">{messages.common.english}</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-status">
                {copy.statusLabel}
              </label>
              <select
                id="proctor-form-status"
                value={formState.isActive ? "active" : "inactive"}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    isActive: event.target.value === "active"
                  }))
                }
                className={selectClassName}
              >
                <option value="active">{copy.activeOption}</option>
                <option value="inactive">{copy.inactiveOption}</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctor-form-notes">
                {locale === "ar" ? "ملاحظات" : "Notes"}
              </label>
              <Textarea
                id="proctor-form-notes"
                value={formState.notes}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </div>
          </div>

          {formError ? (
            <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4 text-sm text-danger">
              {formError}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-3">
            <div>
              {editingProctorId ? (
                <Button
                  variant="danger"
                  onClick={() => void handleDeactivateProctor(editingProctorId)}
                >
                  {copy.manualDelete}
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingProctorId(null);
                  setFormError(null);
                  setFormState(createInitialProctorForm());
                }}
              >
                {messages.proctors.importFlow.cancel}
              </Button>
              <Button onClick={() => void handleSaveProctor()} disabled={isSaving}>
                {isSaving ? copy.saving : isEditing ? copy.submitEdit : copy.submitCreate}
              </Button>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {isImportOpen ? (
        <ModalFrame
          title={messages.proctors.importFlow.title}
          description={messages.proctors.importFlow.subtitle}
          closeLabel={messages.proctors.importFlow.close}
          onClose={() => {
            setIsImportOpen(false);
            setImportError(null);
          }}
          className="max-w-5xl"
          bodyClassName="space-y-6"
        >
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-text-primary"
                  htmlFor="proctors-import-file"
                >
                  {messages.proctors.importFlow.fileLabel}
                </label>
                <Input
                  id="proctors-import-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] ?? null);
                    setImportError(null);
                  }}
                />
              </div>

              {importError ? (
                <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4 text-sm text-danger">
                  {importError}
                </div>
              ) : null}

              <div className="rounded-3xl border border-border bg-surface-elevated px-4 py-4">
                <p className="text-sm font-medium text-text-primary">
                  {messages.proctors.importFlow.sampleTitle}
                </p>
                <p className="mt-2 text-sm leading-7 text-text-secondary">
                  {messages.proctors.importFlow.sampleBody}
                </p>
                {importSample ? (
                  <pre className="mt-4 overflow-x-auto rounded-2xl bg-background px-4 py-4 text-xs leading-6 text-text-secondary">
                    {importSample}
                  </pre>
                ) : null}
              </div>

              {importResult?.summary ? (
                <div className="space-y-4 rounded-3xl border border-border bg-surface-elevated px-4 py-4">
                  <p className="text-sm font-medium text-text-primary">
                    {messages.proctors.importFlow.resultTitle}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <MetricCard
                      label={messages.proctors.importFlow.total}
                      value={importResult.summary.total}
                    />
                    <MetricCard
                      label={messages.proctors.importFlow.success}
                      value={importResult.summary.success}
                    />
                    <MetricCard
                      label={messages.proctors.importFlow.failed}
                      value={importResult.summary.failed}
                    />
                    <MetricCard
                      label={messages.proctors.importFlow.created}
                      value={importResult.summary.created}
                    />
                    <MetricCard
                      label={messages.proctors.importFlow.reused}
                      value={importResult.summary.reused}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {messages.proctors.importFlow.errorsTitle}
                    </p>
                    {importResult.errors && importResult.errors.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        {importResult.errors.map((rowError) => (
                          <div
                            key={`${rowError.row}-${rowError.error}`}
                            className="rounded-2xl border border-danger/30 bg-background px-4 py-4"
                          >
                            <p className="text-sm font-semibold text-text-primary">
                              {messages.proctors.importFlow.row} {rowError.row}
                            </p>
                            <p className="mt-1 text-sm text-danger">{rowError.message}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-secondary">
                              {rowError.error}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-text-secondary">
                        {messages.proctors.importFlow.noErrors}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedFile(null);
                    setImportResult(null);
                    setImportError(null);
                    setIsImportOpen(false);
                  }}
                >
                  {messages.proctors.importFlow.cancel}
                </Button>
                <Button onClick={() => void handleImportSubmit()} disabled={isImporting}>
                  {isImporting
                    ? messages.proctors.importFlow.submitting
                    : messages.proctors.importFlow.submit}
                </Button>
              </div>
        </ModalFrame>
      ) : null}

      {isExportOpen ? (
        <ModalFrame
          title={messages.proctors.exportFlow.title}
          description={messages.proctors.exportFlow.subtitle}
          closeLabel={messages.proctors.exportFlow.close}
          onClose={() => {
            setIsExportOpen(false);
            setExportError(null);
            setExportOperationalRole("");
          }}
          className="max-w-3xl"
          bodyClassName="space-y-4"
        >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="export-format">
                    {messages.proctors.exportFlow.formatLabel}
                  </label>
                  <select
                    id="export-format"
                    value={exportFormat}
                    onChange={(event) =>
                      setExportFormat(event.target.value as ExportFormat)
                    }
                    className={selectClassName}
                  >
                    <option value="csv">{messages.proctors.exportFlow.csv}</option>
                    <option value="excel">{messages.proctors.exportFlow.excel}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="export-status">
                    {messages.proctors.exportFlow.statusLabel}
                  </label>
                  <select
                    id="export-status"
                    value={exportStatus}
                    onChange={(event) =>
                      setExportStatus(event.target.value as ExportStatus)
                    }
                    className={selectClassName}
                  >
                    <option value="active">{messages.proctors.exportFlow.activeOnly}</option>
                    <option value="inactive">{messages.proctors.exportFlow.inactiveOnly}</option>
                    <option value="all">{messages.proctors.exportFlow.allStatuses}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-text-primary"
                  htmlFor="export-governorate"
                >
                  {messages.proctors.exportFlow.governorateLabel}
                </label>
                <select
                  id="export-governorate"
                  value={exportGovernorateId}
                  onChange={(event) => setExportGovernorateId(event.target.value)}
                  className={selectClassName}
                >
                  <option value="">{messages.proctors.exportFlow.allGovernorates}</option>
                  {governorates.map((governorate) => (
                    <option key={governorate.id} value={governorate.id}>
                      {getLocalizedName(governorate, locale)}
                    </option>
                  ))}
                </select>
                {isGovernoratesLoading ? (
                  <p className="text-xs text-text-secondary">
                    {messages.proctors.exportFlow.loadingGovernorates}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary" htmlFor="export-role">
                  {copy.exportRoleLabel}
                </label>
                <select
                  id="export-role"
                  value={exportOperationalRole}
                  onChange={(event) =>
                    setExportOperationalRole(
                      event.target.value as "" | ProctorOperationalRole
                    )
                  }
                  className={selectClassName}
                >
                  <option value="">{copy.allRoles}</option>
                  {roleOptions.map((roleOption) => (
                    <option key={roleOption.value} value={roleOption.value}>
                      {roleOption.label}
                    </option>
                  ))}
                </select>
              </div>

              {exportError ? (
                <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4 text-sm text-danger">
                  {exportError}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setExportGovernorateId("");
                    setExportOperationalRole("");
                    setExportStatus("active");
                    setExportFormat("csv");
                    setExportError(null);
                    setIsExportOpen(false);
                  }}
                >
                  {messages.proctors.exportFlow.cancel}
                </Button>
                <Button onClick={() => void handleExportSubmit()} disabled={isExporting}>
                  {isExporting
                    ? messages.proctors.exportFlow.submitting
                    : messages.proctors.exportFlow.submit}
                </Button>
              </div>
        </ModalFrame>
      ) : null}
    </div>
  );
}
