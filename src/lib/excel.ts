"use client";

/**
 * =====================================================================
 *  EXCEL ЭКСПОРТ / ИМПОРТ  —  ExcelJS дээр
 * =====================================================================
 *  ExcelJS-ийг зөвхөн хэрэглэгч татах товч дарахад динамикаар ачаална.
 *  Ингэснээр хуудасны эхний ачаалалд ~400KB нэмэгдэхгүй.
 *
 *  Бүх функц асинхрон — дуудахдаа await хийнэ.
 * =====================================================================
 */

import type { Workbook, Worksheet, Cell } from "exceljs";
import {
  DAYS,
  ROMAN,
  teacherName,
  type ClassRoom,
  type Room,
  type ScheduleSlot,
  type ShiftSetting,
  type Subject,
  type Teacher,
} from "./types";

// ---------------------------------------------------------------------
// Брэндийн өнгө (ARGB — ExcelJS-ийн формат)
// ---------------------------------------------------------------------
const C = {
  head: "FF0E6393", // гарчгийн дэвсгэр — гүн цэнхэр
  headText: "FFFFFFFF",
  sub: "FF1B9AD6", // дэд гарчиг
  title: "FF1C2A31",
  border: "FFC8DBE1",
  zebra: "FFF4F8F9",
  elective: "FFFFE288", // сонгон судлах — алтан
  electiveText: "FF7C390F",
  total: "FFE3EDF0",
};

type Primitive = string | number | null;

// ---------------------------------------------------------------------
// Туслах
// ---------------------------------------------------------------------
async function newWorkbook(): Promise<Workbook> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Сургалтын менежерийн систем";
  wb.created = new Date();
  return wb;
}

async function download(wb: Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Бүх нүдэнд нимгэн хүрээ тавина */
function bordered(ws: Worksheet, fromRow: number, toRow: number, cols: number) {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = 1; c <= cols; c++) {
      ws.getCell(r, c).border = {
        top: { style: "thin", color: { argb: C.border } },
        left: { style: "thin", color: { argb: C.border } },
        bottom: { style: "thin", color: { argb: C.border } },
        right: { style: "thin", color: { argb: C.border } },
      };
    }
  }
}

/**
 * Гарчгийн мөрийг өнгөлнө.
 *
 * ⚠ Босоо нэгтгэсэн баганад болгоомжтой: нэгтгэсэн мужийн аль нэг нүдэнд
 * загвар бичихэд бүх мужид тархдаг. Тиймээс 2 мөрт гарчигтай хүснэгтэд
 * доод мөрийг өнгөлөхдөө `fromCol`-оор нэгтгэсэн баганыг алгасана.
 */
function styleHeader(
  ws: Worksheet,
  rowNo: number,
  toCol: number,
  bg = C.head,
  fromCol = 1
) {
  const row = ws.getRow(rowNo);
  row.height = 30;
  for (let c = fromCol; c <= toCol; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.font = { bold: true, size: 10, color: { argb: C.headText } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }
}

/** Баримтын нэрийн мөр */
function styleTitle(ws: Worksheet, rowNo: number, cols: number, size = 14) {
  const row = ws.getRow(rowNo);
  row.height = size + 12;
  const cell = row.getCell(1);
  cell.font = { bold: true, size, color: { argb: C.title } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  if (cols > 1) ws.mergeCells(rowNo, 1, rowNo, cols);
}

function setWidths(ws: Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

/** null -> "" (ExcelJS null-г хоосон нүд болгодоггүй) */
function clean(row: Primitive[]): (string | number)[] {
  return row.map((v) => (v === null || v === undefined ? "" : v));
}

function addRows(ws: Worksheet, rows: Primitive[][]) {
  for (const r of rows) ws.addRow(clean(r));
}

// ---------------------------------------------------------------------
// Хуваарийн контекст
// ---------------------------------------------------------------------
type Ctx = {
  teachers: Teacher[];
  classes: ClassRoom[];
  rooms: Room[];
  subjects: Subject[];
  slots: ScheduleSlot[];
  shifts: ShiftSetting[];
  title?: string;
};

function maps(ctx: Ctx) {
  return {
    tch: new Map(ctx.teachers.map((t) => [t.id, t])),
    cls: new Map(ctx.classes.map((c) => [c.id, c])),
    rm: new Map(ctx.rooms.map((r) => [r.id, r])),
    sub: new Map(ctx.subjects.map((s) => [s.id, s])),
  };
}

// =====================================================================
// 1. БАГШААР — мөр = багш, багана = өдөр × цаг
//    (Эх Excel файлын баганын дарааллыг дагасан)
// =====================================================================
export async function exportTeacherSchedule(ctx: Ctx) {
  const m = maps(ctx);
  const wb = await newWorkbook();

  const FIXED = [
    "Судлагдахуун", "№", "Багшийн нэр", "Зэрэг", "Заадаг хичээл",
    "Даасан анги", "Кабинет", "Үндсэн цаг", "Сонгон судлах",
  ];

  for (const st of ctx.shifts.filter((s) => s.active)) {
    const days = st.days_per_week;
    const periods = st.periods_per_day;
    const totalCols = FIXED.length + days * periods;

    const ws = wb.addWorksheet(st.name.slice(0, 28) || `Ээлж ${st.shift}`, {
      views: [{ state: "frozen", xSplit: 3, ySplit: 3 }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    // 1-р мөр: баримтын нэр
    ws.addRow([`${ctx.title || "ХИЧЭЭЛИЙН ХУВААРЬ"} — ${st.name}`]);
    styleTitle(ws, 1, totalCols);

    // 2-3-р мөр: гарчиг
    const head1: Primitive[] = [...FIXED];
    const head2: Primitive[] = FIXED.map(() => "");
    for (let d = 0; d < days; d++) {
      for (let p = 1; p <= periods; p++) {
        head1.push(p === 1 ? DAYS[d] : "");
        head2.push(ROMAN[p - 1]);
      }
    }
    ws.addRow(clean(head1));
    ws.addRow(clean(head2));

    // Тогтмол баганын гарчгийг 2 мөрөөр нэгтгэх
    for (let c = 1; c <= FIXED.length; c++) ws.mergeCells(2, c, 3, c);
    // Өдрийн нэрийг цагуудын дээгүүр нэгтгэх
    for (let d = 0; d < days; d++) {
      const c = FIXED.length + d * periods + 1;
      ws.mergeCells(2, c, 2, c + periods - 1);
    }
    styleHeader(ws, 2, totalCols);
    // Зөвхөн цагийн баганууд — тогтмол баганууд 2:3 мөрөөр нэгтгэгдсэн тул алгасна
    styleHeader(ws, 3, totalCols, C.sub, FIXED.length + 1);

    // Өгөгдөл
    const shiftSlots = ctx.slots.filter((s) => s.shift === st.shift);
    const teachersHere = ctx.teachers
      .filter((t) => shiftSlots.some((s) => s.teacher_id === t.id))
      .sort(
        (a, b) =>
          (a.department || "").localeCompare(b.department || "") ||
          a.last_name.localeCompare(b.last_name)
      );

    let lastDept = "";
    teachersHere.forEach((t, idx) => {
      const mine = shiftSlots.filter((s) => s.teacher_id === t.id);
      const base = mine.filter((s) => !s.is_elective).length;
      const elective = mine.filter((s) => s.is_elective).length;
      const subjNames = [
        ...new Set(mine.map((s) => m.sub.get(s.subject_id)?.name).filter(Boolean)),
      ].join(", ");
      const roomNames = [
        ...new Set(
          mine.map((s) => (s.room_id ? m.rm.get(s.room_id)?.name : null)).filter(Boolean)
        ),
      ].join(", ");
      const homeroom = ctx.classes.find((c) => c.id === t.homeroom_class_id)?.name || "";
      const dept = t.department || "";

      const row: Primitive[] = [
        dept === lastDept ? "" : dept,
        idx + 1,
        teacherName(t),
        t.rank === "Байхгүй" ? "" : t.rank,
        subjNames,
        homeroom,
        roomNames,
        base,
        elective || "",
      ];
      lastDept = dept;

      const electiveCols: number[] = [];
      for (let d = 1; d <= days; d++) {
        for (let p = 1; p <= periods; p++) {
          const cell = mine.filter((s) => s.day_of_week === d && s.period === p);
          if (cell.some((c) => c.is_elective)) electiveCols.push(row.length + 1);
          row.push(
            cell
              .map((s) => {
                const cls = m.cls.get(s.class_id)?.name || "";
                const room = s.room_id ? m.rm.get(s.room_id)?.name : "";
                const el = s.is_elective ? "-со" : "";
                const sg = s.subgroup ? `(${s.subgroup})` : "";
                return `${cls}${el}${sg}${room ? "/" + room : ""}`;
              })
              .join(" + ")
          );
        }
      }

      const added = ws.addRow(clean(row));
      added.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      // Зүүн талын текст баганууд зүүн тэгшилгээтэй
      for (const c of [1, 3, 4, 5, 7]) {
        added.getCell(c).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      }
      // Сонгон судлах нүдийг тодруулах
      for (const c of electiveCols) {
        added.getCell(c).fill = {
          type: "pattern", pattern: "solid", fgColor: { argb: C.elective },
        };
        added.getCell(c).font = { color: { argb: C.electiveText }, bold: true, size: 10 };
      }
    });

    setWidths(ws, [
      24, 4, 17, 12, 20, 10, 12, 9, 11,
      ...Array(days * periods).fill(11),
    ]);
    bordered(ws, 2, ws.rowCount, totalCols);
  }

  await download(wb, `Хичээлийн-хуваарь-багшаар-${today()}.xlsx`);
}

// =====================================================================
// 2. АНГИАР — анги тус бүр өөрийн хүснэгттэй
// =====================================================================
export async function exportClassSchedule(ctx: Ctx) {
  const m = maps(ctx);
  const wb = await newWorkbook();
  const ws = wb.addWorksheet("Ангиар", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const classes = [...ctx.classes].sort(
    (a, b) => a.grade - b.grade || a.name.localeCompare(b.name)
  );

  let maxDays = 5;
  for (const c of classes) {
    const mine = ctx.slots.filter((s) => s.class_id === c.id);
    if (mine.length === 0) continue;
    const st = ctx.shifts.find((s) => s.shift === c.shift) || ctx.shifts[0];
    if (!st) continue;
    maxDays = Math.max(maxDays, st.days_per_week);

    const titleRow = ws.addRow([`${c.name} анги — ${st.name}`]);
    styleTitle(ws, titleRow.number, st.days_per_week + 1, 12);

    ws.addRow(clean(["Цаг", ...DAYS.slice(0, st.days_per_week)]));
    styleHeader(ws, ws.rowCount, st.days_per_week + 1);
    const headRow = ws.rowCount;

    for (let p = 1; p <= st.periods_per_day; p++) {
      const row: Primitive[] = [ROMAN[p - 1]];
      const electiveCols: number[] = [];
      for (let d = 1; d <= st.days_per_week; d++) {
        const cell = mine.filter((s) => s.day_of_week === d && s.period === p);
        if (cell.some((s) => s.is_elective)) electiveCols.push(row.length + 1);
        row.push(
          cell
            .map((s) => {
              const subj = m.sub.get(s.subject_id)?.name || "";
              const t = teacherName(m.tch.get(s.teacher_id));
              const r = s.room_id ? m.rm.get(s.room_id)?.name : "";
              const sg = s.subgroup ? ` ${s.subgroup}` : "";
              return `${subj}${s.is_elective ? " (сонгон)" : ""}${sg}\n${t}${r ? " · " + r : ""}`;
            })
            .join("\n— — —\n")
        );
      }
      const added = ws.addRow(clean(row));
      added.height = 34;
      added.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      added.getCell(1).font = { bold: true };
      for (const cn of electiveCols) {
        added.getCell(cn).fill = {
          type: "pattern", pattern: "solid", fgColor: { argb: C.elective },
        };
        added.getCell(cn).font = { color: { argb: C.electiveText } };
      }
    }
    bordered(ws, headRow, ws.rowCount, st.days_per_week + 1);
    ws.addRow([]);
  }

  setWidths(ws, [7, ...Array(maxDays).fill(30)]);
  await download(wb, `Хичээлийн-хуваарь-ангиар-${today()}.xlsx`);
}

// =====================================================================
// 3. СУРГУУЛИЙН НЭГДСЭН — мөр = анги, багана = өдөр × цаг
// =====================================================================
export async function exportSchoolSchedule(ctx: Ctx) {
  const m = maps(ctx);
  const wb = await newWorkbook();

  for (const st of ctx.shifts.filter((s) => s.active)) {
    const days = st.days_per_week;
    const periods = st.periods_per_day;
    const totalCols = 3 + days * periods;

    const ws = wb.addWorksheet(st.name.slice(0, 28) || `Ээлж ${st.shift}`, {
      views: [{ state: "frozen", xSplit: 1, ySplit: 4 }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    ws.addRow([ctx.title || "СУРГУУЛИЙН НЭГДСЭН ХИЧЭЭЛИЙН ХУВААРЬ"]);
    styleTitle(ws, 1, totalCols);
    ws.addRow([st.name]);
    styleTitle(ws, 2, totalCols, 11);

    const head1: Primitive[] = ["Анги", "Ээлж", "Нийт цаг"];
    const head2: Primitive[] = ["", "", ""];
    for (let d = 0; d < days; d++) {
      for (let p = 1; p <= periods; p++) {
        head1.push(p === 1 ? DAYS[d] : "");
        head2.push(ROMAN[p - 1]);
      }
    }
    ws.addRow(clean(head1));
    ws.addRow(clean(head2));
    for (let c = 1; c <= 3; c++) ws.mergeCells(3, c, 4, c);
    for (let d = 0; d < days; d++) {
      const c = 3 + d * periods + 1;
      ws.mergeCells(3, c, 3, c + periods - 1);
    }
    styleHeader(ws, 3, totalCols);
    // Анги/Ээлж/Нийт цаг баганууд 3:4 мөрөөр нэгтгэгдсэн тул алгасна
    styleHeader(ws, 4, totalCols, C.sub, 4);

    const classesHere = ctx.classes
      .filter((c) => c.shift === st.shift)
      .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));

    classesHere.forEach((c, i) => {
      const mine = ctx.slots.filter((s) => s.class_id === c.id && s.shift === st.shift);
      const row: Primitive[] = [c.name, st.shift, mine.length];
      const electiveCols: number[] = [];
      for (let d = 1; d <= days; d++) {
        for (let p = 1; p <= periods; p++) {
          const cell = mine.filter((s) => s.day_of_week === d && s.period === p);
          if (cell.some((s) => s.is_elective)) electiveCols.push(row.length + 1);
          row.push(
            cell
              .map((s) => {
                const subj = m.sub.get(s.subject_id)?.name || "";
                const r = s.room_id ? m.rm.get(s.room_id)?.name : "";
                return `${subj}${s.is_elective ? "-со" : ""}${r ? "/" + r : ""}`;
              })
              .join(" + ")
          );
        }
      }
      const added = ws.addRow(clean(row));
      added.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      added.getCell(1).font = { bold: true };
      if (i % 2 === 1) {
        for (let c2 = 1; c2 <= totalCols; c2++)
          added.getCell(c2).fill = {
            type: "pattern", pattern: "solid", fgColor: { argb: C.zebra },
          };
      }
      for (const cn of electiveCols) {
        added.getCell(cn).fill = {
          type: "pattern", pattern: "solid", fgColor: { argb: C.elective },
        };
        added.getCell(cn).font = { color: { argb: C.electiveText }, bold: true };
      }
    });

    setWidths(ws, [10, 7, 9, ...Array(days * periods).fill(13)]);
    bordered(ws, 3, ws.rowCount, totalCols);
  }

  await download(wb, `Хичээлийн-хуваарь-нэгдсэн-${today()}.xlsx`);
}

// =====================================================================
// 4. ЕРӨНХИЙ ЭКСПОРТ — нэг хуудас
// =====================================================================
export async function exportRows(
  rows: Primitive[][],
  filename: string,
  sheetName = "Хуудас1",
  colWidths?: number[]
) {
  const wb = await newWorkbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 28), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  applyGeneric(ws, rows, colWidths);
  await download(wb, filename.endsWith(".xlsx") ? filename : `${filename}-${today()}.xlsx`);
}

// =====================================================================
// 5. ОЛОН ХУУДАСТАЙ ЭКСПОРТ
// =====================================================================
export async function exportSheets(
  sheets: { name: string; rows: Primitive[][]; cols?: number[] }[],
  filename: string
) {
  const wb = await newWorkbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 28), {
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    applyGeneric(ws, s.rows, s.cols);
  }
  await download(wb, filename.endsWith(".xlsx") ? filename : `${filename}-${today()}.xlsx`);
}

/**
 * Ерөнхий хүснэгтийн загвар.
 * Дүрэм: эхний хэдэн мөр 1 нүдтэй бол гарчиг гэж үзнэ;
 * түүний дараах анхны бүтэн мөрийг хүснэгтийн толгой болгоно.
 */
function applyGeneric(ws: Worksheet, rows: Primitive[][], colWidths?: number[]) {
  if (!rows.length) return;
  const maxCols = Math.max(...rows.map((r) => r.length), 1);

  let headerRowNo = 0;
  rows.forEach((r, i) => {
    const added = ws.addRow(clean(r));
    const filled = r.filter((v) => v !== null && v !== undefined && v !== "").length;
    if (!headerRowNo && filled === 1 && i < 4) {
      // Баримтын нэр
      styleTitle(ws, added.number, maxCols, i === 0 ? 13 : 11);
    } else if (!headerRowNo && filled > 1) {
      headerRowNo = added.number;
      styleHeader(ws, headerRowNo, maxCols);
    } else if (headerRowNo) {
      added.alignment = { vertical: "middle", wrapText: true };
      // Нийт дүнгийн мөрийг тодруулах
      const first = String(r[0] ?? "") + String(r[1] ?? "");
      if (/НИЙТ|ДҮН|Нийт/.test(first)) {
        for (let c = 1; c <= maxCols; c++) {
          added.getCell(c).fill = {
            type: "pattern", pattern: "solid", fgColor: { argb: C.total },
          };
          added.getCell(c).font = { bold: true };
        }
      }
    }
  });

  if (colWidths) setWidths(ws, colWidths);
  else setWidths(ws, Array(maxCols).fill(18));

  if (headerRowNo) {
    bordered(ws, headerRowNo, ws.rowCount, maxCols);
    ws.views = [{ state: "frozen", ySplit: headerRowNo }];
  }
}

// =====================================================================
// 6. ИМПОРТ — Excel файл уншиж мөр болгон буцаана
// =====================================================================
export async function readSheetRows(file: File): Promise<(string | number)[][]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const ws = wb.worksheets[0];
  if (!ws) return [];

  const out: (string | number)[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const arr: (string | number)[] = [];
    const count = Math.max(row.cellCount, ws.columnCount);
    for (let c = 1; c <= count; c++) {
      arr[c - 1] = cellToPrimitive(row.getCell(c));
    }
    out.push(arr);
  });
  return out;
}

/** ExcelJS-ийн нүдний утгыг энгийн текст/тоо болгоно */
function cellToPrimitive(cell: Cell): string | number {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v;
  if (typeof v === "string") return v.trim();
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return v.toISOString().slice(0, 10);

  const o = v as unknown as Record<string, unknown>;
  // Томьёоны үр дүн
  if ("result" in o) {
    const r = o.result;
    if (typeof r === "number") return r;
    if (typeof r === "string") return r.trim();
    return "";
  }
  // Rich text
  if ("richText" in o && Array.isArray(o.richText)) {
    return (o.richText as { text?: string }[]).map((p) => p.text || "").join("").trim();
  }
  // Гипер холбоос
  if ("text" in o && typeof o.text === "string") return o.text.trim();
  // Алдааны нүд
  if ("error" in o) return "";

  return String(v).trim();
}
