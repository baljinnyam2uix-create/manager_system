"use client";

import { DAYS, ROMAN, teacherName } from "@/lib/types";
import type {
  ClassRoom,
  Room,
  ScheduleSlot,
  ShiftSetting,
  Subject,
  Teacher,
} from "@/lib/types";
import { periodTimes } from "@/lib/scheduler";

export interface GridCtx {
  teachers: Teacher[];
  classes: ClassRoom[];
  rooms: Room[];
  subjects: Subject[];
  slots: ScheduleSlot[];
  shifts: ShiftSetting[];
}

function useMaps(ctx: GridCtx) {
  return {
    tch: new Map(ctx.teachers.map((t) => [t.id, t])),
    cls: new Map(ctx.classes.map((c) => [c.id, c])),
    rm: new Map(ctx.rooms.map((r) => [r.id, r])),
    sub: new Map(ctx.subjects.map((s) => [s.id, s])),
  };
}

/** Сонгон судлах хичээлийг тод шар/улбар өнгөөр ялгана */
const ELECTIVE_STYLE =
  "bg-gradient-to-br from-gold-300 to-gold-100 ring-2 ring-gold-500 text-gold-900";

// ====================================================================
// БАГШИЙН ХУВААРЬ
// ====================================================================
export function TeacherGrid({
  ctx,
  teacherId,
  onCellClick,
}: {
  ctx: GridCtx;
  teacherId: string;
  onCellClick?: (day: number, period: number, shift: number) => void;
}) {
  const m = useMaps(ctx);
  const mine = ctx.slots.filter((s) => s.teacher_id === teacherId);
  const shiftNos = [...new Set(mine.map((s) => s.shift))].sort();
  const shifts = ctx.shifts.filter(
    (s) => shiftNos.includes(s.shift) || (shiftNos.length === 0 && s.active)
  );

  if (shifts.length === 0)
    return <p className="py-10 text-center text-sm text-ink-400">Ээлжийн тохиргоо алга</p>;

  return (
    <div className="space-y-6">
      {shifts.map((st) => {
        const times = periodTimes(st);
        return (
          <div key={st.shift}>
            <h4 className="mb-2 text-sm font-bold text-ink-700">{st.name}</h4>
            <div className="table-wrap">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="bg-ink-50/60">
                    <th className="th w-24 border-b border-r border-[#d7e8e6]">Цаг</th>
                    {DAYS.slice(0, st.days_per_week).map((d) => (
                      <th key={d} className="th border-b border-[#d7e8e6] text-center">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: st.periods_per_day }).map((_, pi) => {
                    const period = pi + 1;
                    const t = times[pi];
                    return (
                      <tr key={period}>
                        <td className="border-b border-r border-[#e6f1ef] bg-ink-50/40 px-3 py-2 text-center">
                          <div className="text-sm font-black text-ink-700">
                            {ROMAN[pi]}
                          </div>
                          <div className="text-[10px] text-ink-400">
                            {t?.start}–{t?.end}
                          </div>
                        </td>
                        {Array.from({ length: st.days_per_week }).map((__, di) => {
                          const day = di + 1;
                          const cell = mine.filter(
                            (s) =>
                              s.shift === st.shift &&
                              s.day_of_week === day &&
                              s.period === period
                          );
                          return (
                            <td
                              key={day}
                              onClick={() => onCellClick?.(day, period, st.shift)}
                              className={`border-b border-r border-[#e6f1ef] p-1.5 align-top ${
                                onCellClick ? "cursor-pointer hover:bg-teal-50" : ""
                              }`}
                            >
                              <div className="flex flex-col gap-1">
                                {cell.map((s) => {
                                  const subj = m.sub.get(s.subject_id);
                                  const cls = m.cls.get(s.class_id);
                                  const room = s.room_id ? m.rm.get(s.room_id) : null;
                                  return (
                                    <div
                                      key={s.id}
                                      className={`rounded-lg px-2 py-1.5 text-[11px] leading-tight ${
                                        s.is_elective ? ELECTIVE_STYLE : "text-white"
                                      }`}
                                      style={
                                        s.is_elective
                                          ? undefined
                                          : { backgroundColor: subj?.color || "#008080" }
                                      }
                                    >
                                      <div className="font-bold">
                                        {cls?.name}
                                        {s.subgroup && ` (${s.subgroup})`}
                                        {s.is_elective && " · сонгон"}
                                      </div>
                                      <div className="opacity-90">
                                        {subj?.name}
                                        {room && ` · ${room.name}`}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ====================================================================
// АНГИЙН ХУВААРЬ
// ====================================================================
export function ClassGrid({
  ctx,
  classId,
  onCellClick,
}: {
  ctx: GridCtx;
  classId: string;
  onCellClick?: (day: number, period: number, shift: number) => void;
}) {
  const m = useMaps(ctx);
  const cls = m.cls.get(classId);
  const st =
    ctx.shifts.find((s) => s.shift === cls?.shift) ||
    ctx.shifts.find((s) => s.active) ||
    ctx.shifts[0];
  if (!st) return <p className="py-10 text-center text-sm text-ink-400">Ээлж алга</p>;

  const mine = ctx.slots.filter((s) => s.class_id === classId);
  const times = periodTimes(st);

  return (
    <div className="table-wrap">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="bg-ink-50/60">
            <th className="th w-24 border-b border-r border-[#d7e8e6]">Цаг</th>
            {DAYS.slice(0, st.days_per_week).map((d) => (
              <th key={d} className="th border-b border-[#d7e8e6] text-center">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: st.periods_per_day }).map((_, pi) => {
            const period = pi + 1;
            const t = times[pi];
            return (
              <tr key={period}>
                <td className="border-b border-r border-[#e6f1ef] bg-ink-50/40 px-3 py-2 text-center">
                  <div className="text-sm font-black text-ink-700">{ROMAN[pi]}</div>
                  <div className="text-[10px] text-ink-400">
                    {t?.start}–{t?.end}
                  </div>
                </td>
                {Array.from({ length: st.days_per_week }).map((__, di) => {
                  const day = di + 1;
                  const cell = mine.filter(
                    (s) => s.day_of_week === day && s.period === period
                  );
                  return (
                    <td
                      key={day}
                      onClick={() => onCellClick?.(day, period, st.shift)}
                      className={`border-b border-r border-[#e6f1ef] p-1.5 align-top ${
                        onCellClick ? "cursor-pointer hover:bg-teal-50" : ""
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        {cell.map((s) => {
                          const subj = m.sub.get(s.subject_id);
                          const tc = m.tch.get(s.teacher_id);
                          const room = s.room_id ? m.rm.get(s.room_id) : null;
                          return (
                            <div
                              key={s.id}
                              className={`rounded-lg px-2 py-1.5 text-[11px] leading-tight ${
                                s.is_elective ? ELECTIVE_STYLE : "text-white"
                              }`}
                              style={
                                s.is_elective
                                  ? undefined
                                  : { backgroundColor: subj?.color || "#008080" }
                              }
                            >
                              <div className="font-bold">
                                {subj?.name}
                                {s.subgroup && ` (${s.subgroup})`}
                                {s.is_elective && " · сонгон"}
                              </div>
                              <div className="opacity-90">
                                {teacherName(tc)}
                                {room && ` · ${room.name}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ====================================================================
// СУРГУУЛИЙН НЭГДСЭН
// ====================================================================
export function SchoolGrid({ ctx, shift }: { ctx: GridCtx; shift: number }) {
  const m = useMaps(ctx);
  const st = ctx.shifts.find((s) => s.shift === shift);
  if (!st) return null;

  const classes = ctx.classes
    .filter((c) => c.shift === shift)
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));

  if (classes.length === 0)
    return (
      <p className="py-10 text-center text-sm text-ink-400">
        Энэ ээлжид анги бүртгэгдээгүй байна
      </p>
    );

  return (
    <div className="table-wrap">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-ink-50/60">
            <th className="sticky left-0 z-10 border-b border-r border-[#d7e8e6] bg-ink-50 px-2 py-2 text-left text-[11px] font-bold text-ink-600">
              Анги
            </th>
            {Array.from({ length: st.days_per_week }).map((_, di) =>
              Array.from({ length: st.periods_per_day }).map((__, pi) => (
                <th
                  key={`${di}-${pi}`}
                  className={`border-b border-[#d7e8e6] px-1 py-1.5 text-center font-bold text-ink-500 ${
                    pi === st.periods_per_day - 1 ? "border-r-2 border-r-[#c2ded9]" : ""
                  }`}
                >
                  {pi === 0 && (
                    <div className="mb-0.5 whitespace-nowrap text-[10px] text-teal-600">
                      {DAYS[di]}
                    </div>
                  )}
                  {ROMAN[pi]}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {classes.map((c) => {
            const mine = ctx.slots.filter((s) => s.class_id === c.id);
            return (
              <tr key={c.id} className="hover:bg-teal-50/30">
                <td className="sticky left-0 z-10 border-b border-r border-[#d7e8e6] bg-white px-2 py-1.5 text-[12px] font-bold text-ink-800">
                  {c.name}
                </td>
                {Array.from({ length: st.days_per_week }).map((_, di) =>
                  Array.from({ length: st.periods_per_day }).map((__, pi) => {
                    const cell = mine.filter(
                      (s) => s.day_of_week === di + 1 && s.period === pi + 1
                    );
                    const s0 = cell[0];
                    const subj = s0 ? m.sub.get(s0.subject_id) : null;
                    const room = s0?.room_id ? m.rm.get(s0.room_id) : null;
                    return (
                      <td
                        key={`${di}-${pi}`}
                        title={
                          s0
                            ? `${subj?.name} · ${teacherName(m.tch.get(s0.teacher_id))}${room ? " · " + room.name : ""}`
                            : ""
                        }
                        className={`border-b border-[#e6f1ef] p-0.5 text-center ${
                          pi === st.periods_per_day - 1 ? "border-r-2 border-r-[#c2ded9]" : ""
                        }`}
                      >
                        {s0 && (
                          <div
                            className={`truncate rounded px-1 py-1 font-semibold leading-none ${
                              s0.is_elective
                                ? "bg-gold-300 text-gold-900 ring-1 ring-gold-500"
                                : "text-white"
                            }`}
                            style={
                              s0.is_elective
                                ? undefined
                                : { backgroundColor: subj?.color || "#008080" }
                            }
                          >
                            {abbr(subj?.name)}
                            {room && (
                              <span className="opacity-75">/{room.name}</span>
                            )}
                            {cell.length > 1 && <span className="opacity-75">+</span>}
                          </div>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function abbr(name?: string) {
  if (!name) return "";
  const words = name.split(/\s+/);
  if (name.length <= 6) return name;
  if (words.length > 1) return words.map((w) => w.charAt(0).toUpperCase()).join("");
  return name.slice(0, 5) + ".";
}

// ====================================================================
// ТАЙЛБАР (legend)
// ====================================================================
export function Legend({ subjects }: { subjects: Subject[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#d7e8e6] bg-white p-3">
      <span className="text-[11px] font-bold uppercase text-ink-400">Тайлбар:</span>
      {subjects.slice(0, 14).map((s) => (
        <span
          key={s.id}
          className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: s.color }}
        >
          {s.name}
        </span>
      ))}
      <span className="rounded-md bg-gold-300 px-2 py-0.5 text-[10px] font-bold text-gold-900 ring-1 ring-gold-500">
        Сонгон судлах
      </span>
    </div>
  );
}
