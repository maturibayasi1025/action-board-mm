import type { AwardGroupSummary } from "@/lib/types/award-nomination";
import ExcelJS from "exceljs";

const COLS_PER_BLOCK = 4;
const GAP_BETWEEN_BLOCKS = 1;

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const FILL_TITLE: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF000000" },
};

const FILL_HEADER: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFFFF" },
};

const FILL_WINNER: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFFFF" },
};

const FILL_BLUE: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9E2F3" },
};

const FILL_ORANGE: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFCE4D6" },
};

const TABLE_HEADERS = ["該当者", "票数", "推薦者", "コメント"] as const;

function colLetter(col: number): string {
  let s = "";
  let n = col;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function mergeRange(
  sheet: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
) {
  sheet.mergeCells(`${colLetter(c1)}${r1}:${colLetter(c2)}${r2}`);
}

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = BORDER_THIN;
}

function headerTitle(label: string): string {
  if (label.startsWith("【") && label.endsWith("】")) return label;
  return `【${label}】`;
}

function setColumnWidths(sheet: ExcelJS.Worksheet, baseCol: number) {
  sheet.getColumn(baseCol).width = 16;
  sheet.getColumn(baseCol + 1).width = 8;
  sheet.getColumn(baseCol + 2).width = 16;
  sheet.getColumn(baseCol + 3).width = 48;
}

function writeAwardBlock(
  sheet: ExcelJS.Worksheet,
  group: AwardGroupSummary,
  baseCol: number,
) {
  setColumnWidths(sheet, baseCol);
  let row = 1;

  mergeRange(sheet, row, baseCol, row, baseCol + 3);
  const titleCell = sheet.getCell(row, baseCol);
  titleCell.value = headerTitle(group.label);
  titleCell.fill = FILL_TITLE;
  titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  applyBorder(titleCell);
  sheet.getRow(row).height = 28;
  row += 1;

  for (let c = 0; c < COLS_PER_BLOCK; c++) {
    const cell = sheet.getCell(row, baseCol + c);
    cell.value = TABLE_HEADERS[c];
    cell.fill = FILL_HEADER;
    cell.font = { bold: true, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    applyBorder(cell);
  }
  sheet.getRow(row).height = 22;
  row += 1;

  for (const winner of group.winners) {
    const recs =
      winner.recommenders.length > 0
        ? winner.recommenders
        : [{ recommenderName: "", comment: "" }];
    const startRow = row;

    for (let idx = 0; idx < recs.length; idx++) {
      const rec = recs[idx];
      const stripeFill = idx % 2 === 0 ? FILL_BLUE : FILL_ORANGE;

      const recCell = sheet.getCell(row, baseCol + 2);
      recCell.value = rec.recommenderName;
      recCell.fill = stripeFill;
      recCell.alignment = {
        horizontal: "center",
        vertical: "top",
        wrapText: true,
      };
      applyBorder(recCell);

      const commentCell = sheet.getCell(row, baseCol + 3);
      commentCell.value = rec.comment;
      commentCell.fill = stripeFill;
      commentCell.alignment = {
        horizontal: "left",
        vertical: "top",
        wrapText: true,
      };
      applyBorder(commentCell);

      row += 1;
    }

    const endRow = row - 1;
    if (endRow > startRow) {
      mergeRange(sheet, startRow, baseCol, endRow, baseCol);
      mergeRange(sheet, startRow, baseCol + 1, endRow, baseCol + 1);
    }

    const nameCell = sheet.getCell(startRow, baseCol);
    nameCell.value = winner.name;
    nameCell.fill = FILL_WINNER;
    nameCell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    applyBorder(nameCell);

    const voteCell = sheet.getCell(startRow, baseCol + 1);
    voteCell.value = winner.total;
    voteCell.fill = FILL_WINNER;
    voteCell.alignment = { horizontal: "center", vertical: "middle" };
    voteCell.numFmt = "0";
    applyBorder(voteCell);
  }
}

export async function buildAwardWinnerExcelBuffer(
  groups: AwardGroupSummary[],
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("表彰集計");

  groups.forEach((group, blockIndex) => {
    const baseCol = blockIndex * (COLS_PER_BLOCK + GAP_BETWEEN_BLOCKS) + 1;
    writeAwardBlock(sheet, group, baseCol);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
