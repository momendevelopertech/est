function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function createSpreadsheetXml(params: {
  sheetName: string;
  headers?: string[];
  headerRows?: string[][];
  rows: string[][];
}) {
  const headerRows =
    params.headerRows && params.headerRows.length > 0
      ? params.headerRows
      : params.headers
        ? [params.headers]
        : [];
  const headerXml = headerRows
    .map(
      (row) =>
        `<Row>${row
          .map(
            (cell) =>
              `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`
          )
          .join("")}</Row>`
    )
    .join("");

  const bodyRows = params.rows
    .map(
      (row) =>
        `<Row>${row
          .map(
            (cell) =>
              `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`
          )
          .join("")}</Row>`
    )
    .join("");

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<?mso-application progid=\"Excel.Sheet\"?>",
    "<Workbook",
    " xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\"",
    " xmlns:o=\"urn:schemas-microsoft-com:office:office\"",
    " xmlns:x=\"urn:schemas-microsoft-com:office:excel\"",
    " xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\"",
    ">",
    `<Worksheet ss:Name="${escapeXml(params.sheetName)}">`,
    "<Table>",
    headerXml,
    bodyRows,
    "</Table>",
    "</Worksheet>",
    "</Workbook>"
  ].join("");
}
