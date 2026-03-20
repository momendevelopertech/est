import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { SessionExportLocale } from "./contracts";

type PdfTableInput = {
  locale: SessionExportLocale;
  title: string;
  subtitle?: string;
  generatedAt: Date;
  headers: string[];
  rows: string[][];
};

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const PAGE_MARGIN = 28;
const HEADER_FONT_SIZE = 9;
const BODY_FONT_SIZE = 8;
const TITLE_FONT_SIZE = 18;
const SUBTITLE_FONT_SIZE = 11;
const ROW_HEIGHT = 18;
const HEADER_CELL_PADDING = 4;
const TABLE_TOP_GAP = 22;

let cachedCairoFontBytes: Uint8Array | null = null;

async function getCairoFontBytes() {
  if (!cachedCairoFontBytes) {
    const fontPath = path.join(
      process.cwd(),
      "src",
      "assets",
      "fonts",
      "Cairo-Regular.ttf"
    );
    const fontBuffer = await readFile(fontPath);
    cachedCairoFontBytes = new Uint8Array(fontBuffer);
  }

  return cachedCairoFontBytes;
}

function formatGeneratedAt(locale: SessionExportLocale, value: Date) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function truncateText(input: {
  value: string;
  font: PDFFont;
  size: number;
  maxWidth: number;
}) {
  const clean = input.value.replace(/\s+/g, " ").trim();

  if (!clean) {
    return "";
  }

  if (input.font.widthOfTextAtSize(clean, input.size) <= input.maxWidth) {
    return clean;
  }

  const ellipsis = "...";
  const ellipsisWidth = input.font.widthOfTextAtSize(ellipsis, input.size);
  const chars = Array.from(clean);
  let output = "";

  for (const char of chars) {
    const candidate = `${output}${char}`;
    const candidateWidth = input.font.widthOfTextAtSize(candidate, input.size);

    if (candidateWidth + ellipsisWidth > input.maxWidth) {
      break;
    }

    output = candidate;
  }

  return `${output}${ellipsis}`;
}

function drawCellText(input: {
  page: PDFPage;
  font: PDFFont;
  value: string;
  x: number;
  y: number;
  width: number;
  locale: SessionExportLocale;
  size: number;
  color: ReturnType<typeof rgb>;
}) {
  const text = truncateText({
    value: input.value,
    font: input.font,
    size: input.size,
    maxWidth: Math.max(input.width - HEADER_CELL_PADDING * 2, 4)
  });

  const textWidth = input.font.widthOfTextAtSize(text, input.size);
  const textX =
    input.locale === "ar"
      ? input.x + Math.max(input.width - HEADER_CELL_PADDING - textWidth, 0)
      : input.x + HEADER_CELL_PADDING;

  input.page.drawText(text, {
    x: textX,
    y: input.y,
    size: input.size,
    font: input.font,
    color: input.color
  });
}

function drawTableHeader(input: {
  page: PDFPage;
  font: PDFFont;
  locale: SessionExportLocale;
  headers: string[];
  y: number;
  rowWidth: number;
}) {
  const columnWidth = input.rowWidth / input.headers.length;
  const headerY = input.y - ROW_HEIGHT + 4;

  input.page.drawRectangle({
    x: PAGE_MARGIN,
    y: input.y - ROW_HEIGHT,
    width: input.rowWidth,
    height: ROW_HEIGHT,
    color: rgb(0.93, 0.96, 1)
  });

  for (let index = 0; index < input.headers.length; index += 1) {
    const columnX = PAGE_MARGIN + columnWidth * index;
    const isLast = index === input.headers.length - 1;

    if (!isLast) {
      input.page.drawLine({
        start: { x: columnX + columnWidth, y: input.y - ROW_HEIGHT },
        end: { x: columnX + columnWidth, y: input.y },
        thickness: 0.5,
        color: rgb(0.78, 0.84, 0.93)
      });
    }

    drawCellText({
      page: input.page,
      font: input.font,
      value: input.headers[index],
      x: columnX,
      y: headerY,
      width: columnWidth,
      locale: input.locale,
      size: HEADER_FONT_SIZE,
      color: rgb(0.08, 0.16, 0.3)
    });
  }
}

function drawTableRow(input: {
  page: PDFPage;
  font: PDFFont;
  locale: SessionExportLocale;
  values: string[];
  y: number;
  rowWidth: number;
}) {
  const columnWidth = input.rowWidth / input.values.length;
  const textY = input.y - ROW_HEIGHT + 5;

  input.page.drawRectangle({
    x: PAGE_MARGIN,
    y: input.y - ROW_HEIGHT,
    width: input.rowWidth,
    height: ROW_HEIGHT,
    color: rgb(1, 1, 1)
  });

  input.page.drawLine({
    start: { x: PAGE_MARGIN, y: input.y - ROW_HEIGHT },
    end: { x: PAGE_MARGIN + input.rowWidth, y: input.y - ROW_HEIGHT },
    thickness: 0.5,
    color: rgb(0.85, 0.88, 0.94)
  });

  for (let index = 0; index < input.values.length; index += 1) {
    const columnX = PAGE_MARGIN + columnWidth * index;
    const isLast = index === input.values.length - 1;

    if (!isLast) {
      input.page.drawLine({
        start: { x: columnX + columnWidth, y: input.y - ROW_HEIGHT },
        end: { x: columnX + columnWidth, y: input.y },
        thickness: 0.4,
        color: rgb(0.9, 0.92, 0.96)
      });
    }

    drawCellText({
      page: input.page,
      font: input.font,
      value: input.values[index],
      x: columnX,
      y: textY,
      width: columnWidth,
      locale: input.locale,
      size: BODY_FONT_SIZE,
      color: rgb(0.11, 0.15, 0.22)
    });
  }
}

export async function createTabularPdf(input: PdfTableInput) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await getCairoFontBytes();
  const cairoFont = await pdfDoc.embedFont(fontBytes, {
    subset: true
  });

  const page = pdfDoc.addPage(A4_LANDSCAPE);
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const rowWidth = pageWidth - PAGE_MARGIN * 2;
  const generatedAtLabel =
    input.locale === "ar" ? "تاريخ التصدير" : "Generated at";
  const rowCountLabel = input.locale === "ar" ? "عدد الصفوف" : "Row count";

  const titleWidth = cairoFont.widthOfTextAtSize(input.title, TITLE_FONT_SIZE);
  const titleX =
    input.locale === "ar"
      ? pageWidth - PAGE_MARGIN - titleWidth
      : PAGE_MARGIN;
  let cursorY = pageHeight - PAGE_MARGIN;

  page.drawText(input.title, {
    x: titleX,
    y: cursorY,
    size: TITLE_FONT_SIZE,
    font: cairoFont,
    color: rgb(0.06, 0.17, 0.33)
  });

  cursorY -= 20;

  if (input.subtitle) {
    const subtitleWidth = cairoFont.widthOfTextAtSize(
      input.subtitle,
      SUBTITLE_FONT_SIZE
    );
    const subtitleX =
      input.locale === "ar"
        ? pageWidth - PAGE_MARGIN - subtitleWidth
        : PAGE_MARGIN;

    page.drawText(input.subtitle, {
      x: subtitleX,
      y: cursorY,
      size: SUBTITLE_FONT_SIZE,
      font: cairoFont,
      color: rgb(0.28, 0.35, 0.47)
    });
    cursorY -= 18;
  }

  const metadataLine = `${generatedAtLabel}: ${formatGeneratedAt(
    input.locale,
    input.generatedAt
  )}  |  ${rowCountLabel}: ${input.rows.length}`;
  const metadataWidth = cairoFont.widthOfTextAtSize(metadataLine, 9);
  const metadataX =
    input.locale === "ar"
      ? pageWidth - PAGE_MARGIN - metadataWidth
      : PAGE_MARGIN;

  page.drawText(metadataLine, {
    x: metadataX,
    y: cursorY,
    size: 9,
    font: cairoFont,
    color: rgb(0.36, 0.43, 0.56)
  });

  cursorY -= TABLE_TOP_GAP;
  let activePage = page;

  drawTableHeader({
    page: activePage,
    font: cairoFont,
    locale: input.locale,
    headers: input.headers,
    y: cursorY,
    rowWidth
  });
  cursorY -= ROW_HEIGHT;

  for (const row of input.rows) {
    if (cursorY <= PAGE_MARGIN + ROW_HEIGHT) {
      activePage = pdfDoc.addPage(A4_LANDSCAPE);
      cursorY = pageHeight - PAGE_MARGIN;

      drawTableHeader({
        page: activePage,
        font: cairoFont,
        locale: input.locale,
        headers: input.headers,
        y: cursorY,
        rowWidth
      });
      cursorY -= ROW_HEIGHT;
    }

    drawTableRow({
      page: activePage,
      font: cairoFont,
      locale: input.locale,
      values: row,
      y: cursorY,
      rowWidth
    });
    cursorY -= ROW_HEIGHT;
  }

  return pdfDoc.save();
}
