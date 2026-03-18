import { NextResponse } from "next/server";

import {
  getLocationsImportSampleCsv,
  getLocationsImportTemplateColumns,
  importLocationsCsv
} from "@/lib/locations/import";
import {
  handleLocationRouteError,
  requireLocationsApiRole
} from "@/lib/locations/http";

function isUploadedImportFile(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value === "string") {
    return false;
  }

  return (
    typeof value === "object" &&
    "name" in value &&
    typeof value.name === "string" &&
    "size" in value &&
    typeof value.size === "number" &&
    "text" in value &&
    typeof value.text === "function"
  );
}

export async function GET() {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  return NextResponse.json({
    ok: true,
    columns: getLocationsImportTemplateColumns(),
    sampleCsv: getLocationsImportSampleCsv()
  });
}

export async function POST(request: Request) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!isUploadedImportFile(file)) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_import_file"
        },
        {
          status: 400
        }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "empty_import_file"
        },
        {
          status: 400
        }
      );
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        {
          ok: false,
          error: "unsupported_import_file",
          message: "Only CSV files are supported for locations import."
        },
        {
          status: 400
        }
      );
    }

    const csvText = await file.text();
    const result = await importLocationsCsv({
      actorAppUserId: auth.session.user.id,
      csvText,
      fileName: file.name
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleLocationRouteError(error);
  }
}
