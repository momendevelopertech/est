import { NextResponse } from "next/server";

import { ERROR_CODES } from "@/lib/errors/codes";
import { MAX_IMPORT_FILE_SIZE_BYTES } from "@/lib/import/constants";
import {
  getProctorsImportSampleCsv,
  getProctorsImportTemplateColumns,
  importProctorsCsv
} from "@/lib/proctors/import";
import {
  handleProctorRouteError,
  requireProctorsApiRole
} from "@/lib/proctors/http";

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
  const auth = await requireProctorsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  return NextResponse.json({
    ok: true,
    columns: getProctorsImportTemplateColumns(),
    sampleCsv: getProctorsImportSampleCsv()
  });
}

export async function POST(request: Request) {
  const auth = await requireProctorsApiRole();

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
          error: ERROR_CODES.missingImportFile
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
          error: ERROR_CODES.emptyImportFile
        },
        {
          status: 400
        }
      );
    }

    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: ERROR_CODES.importFileTooLarge,
          message: `CSV files must be ${Math.floor(MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024))} MB or smaller.`
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
          error: ERROR_CODES.unsupportedImportFile,
          message: "Only CSV files are supported for proctors import."
        },
        {
          status: 400
        }
      );
    }

    const csvText = await file.text();
    const result = await importProctorsCsv({
      actorAppUserId: auth.session.user.id,
      csvText,
      fileName: file.name
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleProctorRouteError(error);
  }
}
