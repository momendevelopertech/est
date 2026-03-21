"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { PageHero } from "@/components/ui/page-hero";
import type { ImportTemplateKey } from "@/lib/import/templates/contracts";
import type { Locale, Messages } from "@/lib/i18n";

type ImportTemplateRecord = {
  key: ImportTemplateKey;
  name: string;
  description: string;
  format: "csv";
  columns: string[];
  columnCount: number;
  sampleRowCount: number;
  templateFileName: string;
  sampleFileName: string;
};

type ImportTemplatesResponse = {
  ok: boolean;
  data?: {
    locale: "en" | "ar";
    data: ImportTemplateRecord[];
  };
  error?: string;
  message?: string;
};

type ImportTemplatesWorkspaceProps = {
  locale: Locale;
  messages: Messages;
};

function TemplatesSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-48 animate-pulse rounded-3xl border border-border bg-surface-elevated"
        />
      ))}
    </div>
  );
}

export function ImportTemplatesWorkspace({
  locale,
  messages
}: ImportTemplatesWorkspaceProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ImportTemplateRecord[]>([]);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTemplates() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/import/templates?locale=${locale}`, {
          method: "GET",
          credentials: "same-origin",
          headers: {
            Accept: "application/json"
          },
          signal: controller.signal
        });
        const payload = (await response.json()) as ImportTemplatesResponse;

        if (!response.ok || !payload.ok || !payload.data?.data) {
          throw new Error(payload.message ?? payload.error ?? "template_list_failed");
        }

        setTemplates(payload.data.data);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(loadError);
        setTemplates([]);
        setError(messages.importTemplates.errorBody);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadTemplates();

    return () => {
      controller.abort();
    };
  }, [locale, messages.importTemplates.errorBody, refreshKey]);

  const totalColumns = useMemo(
    () => templates.reduce((sum, template) => sum + template.columnCount, 0),
    [templates]
  );

  async function handleDownload(template: ImportTemplateRecord, withSample: boolean) {
    const stateKey = `${template.key}:${withSample ? "sample" : "template"}`;
    setDownloadingKey(stateKey);
    setDownloadError(null);

    try {
      const params = new URLSearchParams();
      params.set("locale", locale);
      params.set("withSample", withSample ? "true" : "false");

      const response = await fetch(
        `/api/import/templates/${template.key}/download?${params.toString()}`,
        {
          method: "GET",
          credentials: "same-origin"
        }
      );

      if (!response.ok) {
        const payload = (await response.json()) as {
          error?: string;
          message?: string;
        };
        throw new Error(payload.message ?? payload.error ?? "template_download_failed");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("content-disposition");
      const fileNameMatch = disposition?.match(/filename=\"([^\"]+)\"/);

      anchor.href = downloadUrl;
      anchor.download =
        fileNameMatch?.[1] ??
        (withSample ? template.sampleFileName : template.templateFileName);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (downloadIssue) {
      console.error(downloadIssue);
      setDownloadError(
        downloadIssue instanceof Error
          ? downloadIssue.message
          : messages.importTemplates.errorBody
      );
    } finally {
      setDownloadingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          { label: messages.common.protected, variant: "accent" },
          { label: messages.nav.settings }
        ]}
        title={messages.importTemplates.title}
        description={messages.importTemplates.subtitle}
        body={messages.importTemplates.description}
        aside={
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {messages.importTemplates.labels.columns}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-text-primary">
              {totalColumns}
            </p>
          </>
        }
        actions={
          <>
            <Badge>{`${messages.importTemplates.labels.columns}: ${totalColumns}`}</Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              {messages.importTemplates.retry}
            </Button>
          </>
        }
      />

      {downloadError ? (
        <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4 text-sm text-danger">
          {downloadError}
        </div>
      ) : null}

      {isLoading ? <TemplatesSkeleton /> : null}

      {!isLoading && error ? (
        <Card>
          <CardHeader>
            <CardTitle>{messages.importTemplates.errorTitle}</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              {messages.importTemplates.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {templates.map((template) => {
            const templateMessage = messages.importTemplates.templates[template.key];
            const templateLabel = templateMessage?.title ?? template.name;
            const templateDescription =
              templateMessage?.description ?? template.description;

            return (
              <Card key={template.key}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="accent">{templateLabel}</Badge>
                    <Badge>{`${messages.importTemplates.labels.format}: ${template.format.toUpperCase()}`}</Badge>
                  </div>
                  <CardTitle className="text-2xl">{templateLabel}</CardTitle>
                  <CardDescription>{templateDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
                    <p>
                      {messages.importTemplates.labels.key}: {template.key}
                    </p>
                    <p>
                      {messages.importTemplates.labels.columns}: {template.columnCount}
                    </p>
                    <p>
                      {messages.importTemplates.labels.sampleRows}:{" "}
                      {template.sampleRowCount}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-surface-elevated px-4 py-4">
                    <p className="text-sm font-medium text-text-primary">
                      {messages.importTemplates.labels.columns}
                    </p>
                    <pre className="mt-3 overflow-x-auto text-xs leading-6 text-text-secondary">
                      {template.columns.join(", ")}
                    </pre>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      size="sm"
                      onClick={() => void handleDownload(template, false)}
                      disabled={downloadingKey !== null}
                    >
                      {downloadingKey === `${template.key}:template`
                        ? messages.importTemplates.downloading
                        : messages.importTemplates.downloadTemplate}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleDownload(template, true)}
                      disabled={downloadingKey !== null}
                    >
                      {downloadingKey === `${template.key}:sample`
                        ? messages.importTemplates.downloading
                        : messages.importTemplates.downloadSample}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
