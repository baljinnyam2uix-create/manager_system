"use client";

import * as XLSX from "xlsx";
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

function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename, { compression: true });
}

/** Нүдний бичиглэл: "6а/205" эсвэл сонгон бол "6а-со/205" */
function cellText(
  slot: ScheduleSlot,
  m: ReturnType<typeof maps>,
  mode: "class" | "teacher" | "school"
) {
  const cls = m.cls.get(slot.class_id)?.name || "";
  const room = slot.room_id ? m.rm.get(slot.room_id)?.name : "";
  const subj = m.sub.get(slot.subject_id)?.name || "";
  const t = m.tch.get(slot.teacher_id);
  const el = slot.is_elective ? "-со" : "";
  const sg = slot.subgroup ? `(${slot.subgroup})` : "";

  if (mode === "teacher") return `${cls}${el}${sg}${room ? "/" + room : ""}`;
  if (mode === "class")
    return `${subj}${el}${sg}\n${teacherName(t)}${room ? " · " + room : ""}`;
  return `${subj}${el} ${cls}${sg}${room ? "/" + room : ""}`;
}

// =====================================================================
// 1. БАГШААР — Excel эх файлын бүтэц (мөр = багш, багана = өдөр × цаг)
// =====================================================================
export function exportTeacherSchedule(ctx: Ctx) {
  const m = maps(ctx);
  const wb = XLSX.utils.book_new();

  for (const st of ctx.shifts.filter((s) => s.active)) {
    const days = st.days_per_week;
    const periods = st.periods_per_day;

    const head1: string[] = ["Судлагдахуун", "№", "Багшийн нэр", "Зэрэг", "Заадаг хичээл", "Даасан анги", "Кабинет", "Үндсэн цаг", "Сонгон судлах"];
    const head2: string[] = ["", "", "", "", "", "", "", "", ""];
    for (let d = 0; d < days; d++) {
      for (let p = 1; p <= periods; p++) {
        head1.push(p === 1 ? DAYS[d] : "");
        head2.push(ROMAN[p - 1]);
      }
    }

    const rows: (string | number)[][] = [head1, head2];
    const shiftSlots = ctx.slots.filter((s) => s.shift === st.shift);

    const teachersHere = ctx.teachers
      .filter((t) => shiftSlots.some((s) => s.teacher_id === t.id))
      .sort((a, b) =>
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
        ...new Set(mine.map((s) => (s.room_id ? m.rm.get(s.room_id)?.name : null)).filter(Boolean)),
      ].join(", ");
      const homeroom = ctx.classes.find((c) => c.id === t.homeroom_class_id)?.name || "";

      const dept = t.department || "";
      const row: (string | number)[] = [
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

      for (let d = 1; d <= days; d++) {
        for (let p = 1; p <= periods; p++) {
          const cell = mine.filter((s) => s.day_of_week === d && s.period === p);
          row.push(cell.map((c) => cellText(c, m, "teacher")).join(" + "));
        }
      }
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 26 }, { wch: 4 }, { wch: 18 }, { wch: 12 }, { wch: 20 },
      { wch: 10 }, { wch: 12 }, { wch: 9 }, { wch: 11 },
      ...Array(days * periods).fill({ wch: 11 }),
    ];
    // Өдрийн гарчгийг нэгтгэх
    const merges: XLSX.Range[] = [];
    for (let d = 0; d < days; d++) {
      const c = 9 + d * periods;
      merges.push({ s: { r: 0, c }, e: { r: 0, c: c + periods - 1 } });
    }
    ws["!merges"] = merges;
    ws["!freeze"] = { xSplit: 3, ySplit: 2 };

    XLSX.utils.book_append_sheet(wb, ws, st.name.slice(0, 28) || `Ээлж ${st.shift}`);
  }

  download(wb, `Хичээлийн-хуваарь-багшаар-${today()}.xlsx`);
}

// =====================================================================
// 2. АНГИАР — мөр = цаг, багана = өдөр. Анги тус бүр өөрийн хүснэгттэй
// =====================================================================
export function exportClassSchedule(ctx: Ctx) {
  const m = maps(ctx);
  const wb = XLSX.utils.book_new();

  const rows: (string | number)[][] = [];
  const classes = [...ctx.classes].sort(
    (a, b) => a.grade - b.grade || a.name.localeCompare(b.name)
  );

  for (const c of classes) {
    const mine = ctx.slots.filter((s) => s.class_id === c.id);
    if (mine.length === 0) continue;
    const st = ctx.shifts.find((s) => s.shift === c.shift) || ctx.shifts[0];
    if (!st) continue;

    rows.push([`${c.name} анги — ${st.name}`]);
    rows.push(["Цаг", ...DAYS.slice(0, st.days_per_week)]);
    for (let p = 1; p <= st.periods_per_day; p++) {
      const row: (string | number)[] = [ROMAN[p - 1]];
      for (let d = 1; d <= st.days_per_week; d++) {
        const cell = mine.filter((s) => s.day_of_week === d && s.period === p);
        row.push(
          cell
            .map((s) => {
              const subj = m.sub.get(s.subject_id)?.name || "";
              const t = teacherName(m.tch.get(s.teacher_id));
              const r = s.room_id ? m.rm.get(s.room_id)?.name : "";
              return `${subj}${s.is_elective ? " (сонгон)" : ""}${s.subgroup ? " " + s.subgroup : ""} · ${t}${r ? " · " + r : ""}`;
            })
            .join("  ||  ")
        );
      }
      rows.push(row);
    }
    rows.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 6 }, ...Array(6).fill({ wch: 34 })];
  XLSX.utils.book_append_sheet(wb, ws, "Ангиар");
  download(wb, `Хичээлийн-хуваарь-ангиар-${today()}.xlsx`);
}

// =====================================================================
// 3. СУРГУУЛИЙН НЭГДСЭН — мөр = анги, багана = өдөр × цаг
// =====================================================================
export function exportSchoolSchedule(ctx: Ctx) {
  const m = maps(ctx);
  const wb = XLSX.utils.book_new();

  for (const st of ctx.shifts.filter((s) => s.active)) {
    const days = st.days_per_week;
    const periods = st.periods_per_day;
    const head1: string[] = ["Анги", "Ээлж", "Нийт цаг"];
    const head2: string[] = ["", "", ""];
    for (let d = 0; d < days; d++)
      for (let p = 1; p <= periods; p++) {
        head1.push(p === 1 ? DAYS[d] : "");
        head2.push(ROMAN[p - 1]);
      }

    const rows: (string | number)[][] = [
      [ctx.title || "СУРГУУЛИЙН НЭГДСЭН ХИЧЭЭЛИЙН ХУВААРЬ"],
      [st.name],
      head1,
      head2,
    ];

    const classesHere = ctx.classes
      .filter((c) => c.shift === st.shift)
      .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));

    for (const c of classesHere) {
      const mine = ctx.slots.filter((s) => s.class_id === c.id && s.shift === st.shift);
      const row: (string | number)[] = [c.name, st.shift, mine.length];
      for (let d = 1; d <= days; d++)
        for (let p = 1; p <= periods; p++) {
          const cell = mine.filter((s) => s.day_of_week === d && s.period === p);
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
      rows.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 10 }, { wch: 7 }, { wch: 9 }, ...Array(days * periods).fill({ wch: 14 })];
    const merges: XLSX.Range[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 + days * periods - 1 } },
    ];
    for (let d = 0; d < days; d++) {
      const c = 3 + d * periods;
      merges.push({ s: { r: 2, c }, e: { r: 2, c: c + periods - 1 } });
    }
    ws["!merges"] = merges;
    XLSX.utils.book_append_sheet(wb, ws, st.name.slice(0, 28) || `Ээлж ${st.shift}`);
  }

  download(wb, `Хичээлийн-хуваарь-нэгдсэн-${today()}.xlsx`);
}

// =====================================================================
// 4. ЕРӨНХИЙ ХҮСНЭГТ ЭКСПОРТ
// =====================================================================
export function exportRows(
  rows: (string | number | null)[][],
  filename: string,
  sheetName = "Хуудас1",
  colWidths?: number[]
) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (colWidths) ws["!cols"] = colWidths.map((w) => ({ wch: w }));
  else if (rows[0]) ws["!cols"] = rows[0].map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 28));
  download(wb, filename.endsWith(".xlsx") ? filename : `${filename}-${today()}.xlsx`);
}

/** Олон хуудастай экспорт */
export function exportSheets(
  sheets: { name: string; rows: (string | number | null)[][]; cols?: number[] }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    if (s.cols) ws["!cols"] = s.cols.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 28));
  }
  download(wb, filename.endsWith(".xlsx") ? filename : `${filename}-${today()}.xlsx`);
}

/** Excel файл уншиж мөр болгон буцаана (импорт) */
export async function readSheetRows(file: File): Promise<(string | number)[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as (
    | string
    | number
  )[][];
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
