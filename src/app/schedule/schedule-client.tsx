"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/shell";
import { Empty, Field, Loading, Modal, SectionHead, StatCard, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  generateSchedule,
  validateSchedule,
  type Conflict,
  type SchedulerResult,
} from "@/lib/scheduler";
import {
  exportClassSchedule,
  exportSchoolSchedule,
  exportTeacherSchedule,
} from "@/lib/excel";
import { fullName, teacherName } from "@/lib/types";
import type {
  ClassRoom,
  Profile,
  Room,
  ScheduleSlot,
  ScheduleVersion,
  ShiftSetting,
  Subject,
  Teacher,
  TeachingLoad,
} from "@/lib/types";
import { ClassGrid, Legend, SchoolGrid, TeacherGrid, type GridCtx } from "./grid";

type View = "teacher" | "class" | "school";

export default function ScheduleClient({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const { show, node } = useToast();

  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loads, setLoads] = useState<TeachingLoad[]>([]);
  const [shifts, setShifts] = useState<ShiftSetting[]>([]);
  const [teacherRooms, setTeacherRooms] = useState<Record<string, string[]>>({});
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [versionId, setVersionId] = useState<string>("");
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);

  const [view, setView] = useState<View>("school");
  const [selTeacher, setSelTeacher] = useState("");
  const [selClass, setSelClass] = useState("");
  const [selShift, setSelShift] = useState(1);

  const [genOpen, setGenOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SchedulerResult | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [genOpts, setGenOpts] = useState({
    name: `Хувилбар ${new Date().toLocaleDateString("mn-MN")}`,
    peSharedHall: true,
    keepLocked: true,
    attempts: 14,
  });

  // ---------------- Ачаалах ----------------
  const loadBase = useCallback(async () => {
    setLoading(true);
    const [t, c, r, s, l, sh, tr, v] = await Promise.all([
      supabase.from("teachers").select("*").eq("active", true).order("last_name"),
      supabase.from("classes").select("*").order("grade").order("name"),
      supabase.from("rooms").select("*").order("name"),
      supabase.from("subjects").select("*").order("name"),
      supabase.from("teaching_loads").select("*"),
      supabase.from("shift_settings").select("*").order("shift"),
      supabase.from("teacher_rooms").select("teacher_id, room_id, priority").order("priority"),
      supabase.from("schedule_versions").select("*").order("created_at", { ascending: false }),
    ]);

    setTeachers((t.data || []) as Teacher[]);
    setClasses((c.data || []) as ClassRoom[]);
    setRooms((r.data || []) as Room[]);
    setSubjects((s.data || []) as Subject[]);
    setLoads((l.data || []) as TeachingLoad[]);
    setShifts((sh.data || []) as ShiftSetting[]);

    const map: Record<string, string[]> = {};
    for (const row of tr.data || []) {
      (map[row.teacher_id] ||= []).push(row.room_id);
    }
    setTeacherRooms(map);

    const vers = (v.data || []) as ScheduleVersion[];
    setVersions(vers);
    const active = vers.find((x) => x.is_active) || vers[0];
    setVersionId(active?.id || "");

    if ((t.data || []).length) setSelTeacher((t.data as Teacher[])[0].id);
    if ((c.data || []).length) setSelClass((c.data as ClassRoom[])[0].id);
    const firstActive = (sh.data as ShiftSetting[] | null)?.find((x) => x.active);
    if (firstActive) setSelShift(firstActive.shift);

    setLoading(false);
  }, [supabase]);

  const loadSlots = useCallback(
    async (vid: string) => {
      if (!vid) {
        setSlots([]);
        return;
      }
      const { data } = await supabase
        .from("schedule_slots")
        .select("*")
        .eq("version_id", vid);
      setSlots((data || []) as ScheduleSlot[]);
    },
    [supabase]
  );

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    loadSlots(versionId);
  }, [versionId, loadSlots]);

  const ctx: GridCtx = { teachers, classes, rooms, subjects, slots, shifts };
  const currentVersion = versions.find((v) => v.id === versionId);

  // ---------------- Зөрчил шалгах ----------------
  useEffect(() => {
    if (!slots.length) {
      setConflicts([]);
      return;
    }
    setConflicts(
      validateSchedule(slots, {
        teachers,
        classes,
        rooms,
        subjects,
        loads,
        peSharedHall: currentVersion?.pe_shared_hall ?? true,
      })
    );
  }, [slots, teachers, classes, rooms, subjects, loads, currentVersion]);

  // ---------------- Хуваарь үүсгэх ----------------
  async function generate() {
    if (loads.length === 0) {
      show("Багшийн ачаалал оруулаагүй байна. Багшийн бүртгэл хэсгээс оруулна уу.", false);
      return;
    }
    if (shifts.filter((s) => s.active).length === 0) {
      show("Идэвхтэй ээлж алга. Тохиргоо → Ээлж хэсгээс тохируулна уу.", false);
      return;
    }

    setGenerating(true);
    setResult(null);

    // UI хөлдөхөөс сэргийлж дараагийн frame дээр ажиллуулна
    await new Promise((r) => setTimeout(r, 30));

    try {
      const locked = genOpts.keepLocked ? slots.filter((s) => s.locked) : [];

      const res = generateSchedule({
        teachers,
        classes,
        rooms,
        subjects,
        loads,
        shifts: shifts.filter((s) => s.active),
        teacherRooms,
        peSharedHall: genOpts.peSharedHall,
        lockedSlots: locked,
        attempts: genOpts.attempts,
      });

      setResult(res);

      // Хувилбар үүсгэх
      const { data: ver, error: vErr } = await supabase
        .from("schedule_versions")
        .insert({
          owner_id: profile.id,
          name: genOpts.name,
          school_year: "2025-2026",
          pe_shared_hall: genOpts.peSharedHall,
          is_active: true,
          notes: `Автоматаар үүсгэв · ${res.stats.totalPlaced} цаг байрлав · ${res.unplaced.length} байрлаагүй`,
        })
        .select("*")
        .single();

      if (vErr) throw vErr;

      // Өмнөх идэвхтэйг унтраана
      await supabase
        .from("schedule_versions")
        .update({ is_active: false })
        .neq("id", ver.id)
        .eq("owner_id", profile.id);

      // Нүднүүдийг хадгалах (багцаар)
      const rows = res.slots.map((s) => ({ ...s, owner_id: profile.id, version_id: ver.id }));
      for (let i = 0; i < rows.length; i += 400) {
        const { error } = await supabase.from("schedule_slots").insert(rows.slice(i, i + 400));
        if (error) throw error;
      }

      await loadBase();
      setVersionId(ver.id);
      await loadSlots(ver.id);
      setGenOpen(false);
      show(
        res.unplaced.length === 0
          ? `Хуваарь бүрэн зохиогдлоо! ${res.stats.totalPlaced} цаг байрлав.`
          : `${res.stats.totalPlaced} цаг байрлав, ${res.unplaced.length} нэгж байрлаагүй.`,
        res.unplaced.length === 0
      );
    } catch (e) {
      show(e instanceof Error ? e.message : "Хуваарь үүсгэхэд алдаа гарлаа", false);
    } finally {
      setGenerating(false);
    }
  }

  async function deleteVersion(v: ScheduleVersion) {
    if (!confirm(`«${v.name}» хувилбарыг устгах уу?`)) return;
    const { error } = await supabase.from("schedule_versions").delete().eq("id", v.id);
    if (error) return show(error.message, false);
    show("Хувилбар устлаа");
    await loadBase();
  }

  async function setActive(v: ScheduleVersion) {
    await supabase.from("schedule_versions").update({ is_active: false }).eq("owner_id", profile.id);
    await supabase.from("schedule_versions").update({ is_active: true }).eq("id", v.id);
    setVersionId(v.id);
    await loadBase();
    show(`«${v.name}» идэвхжлээ`);
  }

  // ---------------- Excel ----------------
  const [exporting, setExporting] = useState(false);

  async function doExport() {
    const base = { teachers, classes, rooms, subjects, slots, shifts: shifts.filter((s) => s.active) };
    setExporting(true);
    try {
      if (view === "teacher") await exportTeacherSchedule(base);
      else if (view === "class") await exportClassSchedule(base);
      else await exportSchoolSchedule({ ...base, title: profile.school_name || "СУРГУУЛЬ" });
      show("Excel файл татагдлаа");
    } catch (e) {
      show(e instanceof Error ? e.message : "Excel үүсгэхэд алдаа гарлаа", false);
    } finally {
      setExporting(false);
    }
  }

  const requiredHours = loads.reduce((s, l) => s + Number(l.hours_per_week), 0);

  return (
    <Shell
      profile={profile}
      title="Хичээлийн хуваарь"
      subtitle={
        currentVersion
          ? `${currentVersion.name}${currentVersion.is_active ? " · идэвхтэй" : ""}`
          : "Хувилбар үүсгээгүй байна"
      }
      actions={
        <>
          <button
            onClick={doExport}
            disabled={!slots.length || exporting}
            className="btn-ghost btn-sm"
          >
            {exporting ? "Бэлдэж байна…" : "Excel татах"}
          </button>
          <button onClick={() => setGenOpen(true)} className="btn-primary btn-sm">
            ⚡ Хуваарь зохиох
          </button>
        </>
      }
    >
      {node}

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          {/* ---------- Тоон үзүүлэлт ---------- */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Байрласан цаг" value={slots.length} icon="🗓️" tone="teal" />
            <StatCard
              label="Шаардлагатай цаг"
              value={requiredHours}
              sub="7 хоногт"
              icon="⏱️"
              tone="aqua"
            />
            <StatCard
              label="Зөрчил"
              value={conflicts.length}
              icon={conflicts.length ? "⚠️" : "✅"}
              tone={conflicts.length ? "gold" : "aqua"}
            />
            <StatCard label="Хувилбар" value={versions.length} icon="📚" tone="orange" />
          </div>

          {/* ---------- Зөрчлийн жагсаалт ---------- */}
          {conflicts.length > 0 && (
            <details className="rounded-2xl border border-gold-300 bg-gold-50 p-4">
              <summary className="cursor-pointer text-sm font-bold text-gold-900">
                ⚠️ {conflicts.length} зөрчил илэрлээ — дэлгэрэнгүй харах
              </summary>
              <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-[13px] text-gold-900">
                {conflicts.slice(0, 60).map((c, i) => (
                  <li key={i} className="rounded-lg bg-white/70 px-3 py-1.5">
                    <b className="uppercase text-[10px] text-gold-600">
                      {c.type === "teacher" ? "багш" : c.type === "class" ? "анги" : c.type === "room" ? "кабинет" : "цаг"}
                    </b>{" "}
                    {c.message}
                  </li>
                ))}
                {conflicts.length > 60 && (
                  <li className="px-3 py-1.5 text-xs opacity-60">
                    … бас {conflicts.length - 60} зөрчил
                  </li>
                )}
              </ul>
            </details>
          )}

          {slots.length === 0 ? (
            <Empty
              icon="🗓️"
              title="Хуваарь зохиогдоогүй байна"
              desc="Багшийн бүртгэл, ачаалал, ээлжийн тохиргоог оруулсны дараа «Хуваарь зохиох» товчийг дарна уу."
              action={
                <button onClick={() => setGenOpen(true)} className="btn-primary">
                  ⚡ Хуваарь зохиох
                </button>
              }
            />
          ) : (
            <>
              {/* ---------- Харагдац сонгох ---------- */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-xl border border-[#d7e8e6] bg-white p-1">
                  {(
                    [
                      ["school", "Нэгдсэн"],
                      ["class", "Ангиар"],
                      ["teacher", "Багшаар"],
                    ] as [View, string][]
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setView(k)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                        view === k
                          ? "bg-teal-500 text-white shadow-soft"
                          : "text-ink-500 hover:bg-ink-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {view === "teacher" && (
                  <select
                    className="input max-w-[240px]"
                    value={selTeacher}
                    onChange={(e) => setSelTeacher(e.target.value)}
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {fullName(t)}
                      </option>
                    ))}
                  </select>
                )}

                {view === "class" && (
                  <select
                    className="input max-w-[160px]"
                    value={selClass}
                    onChange={(e) => setSelClass(e.target.value)}
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}

                {view === "school" && (
                  <select
                    className="input max-w-[200px]"
                    value={selShift}
                    onChange={(e) => setSelShift(Number(e.target.value))}
                  >
                    {shifts
                      .filter((s) => s.active)
                      .map((s) => (
                        <option key={s.shift} value={s.shift}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                )}

                <select
                  className="input ml-auto max-w-[260px]"
                  value={versionId}
                  onChange={(e) => setVersionId(e.target.value)}
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.is_active ? "★ " : ""}
                      {v.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => window.print()} className="btn-ghost btn-sm no-print">
                  Хэвлэх
                </button>
              </div>

              <Legend subjects={subjects} />

              {/* ---------- Хүснэгт ---------- */}
              {view === "school" && <SchoolGrid ctx={ctx} shift={selShift} />}
              {view === "class" && selClass && <ClassGrid ctx={ctx} classId={selClass} />}
              {view === "teacher" && selTeacher && (
                <>
                  <TeacherGrid ctx={ctx} teacherId={selTeacher} />
                  <TeacherSummary
                    teacherId={selTeacher}
                    slots={slots}
                    loads={loads}
                    subjects={subjects}
                    classes={classes}
                  />
                </>
              )}

              {/* ---------- Хувилбарууд ---------- */}
              <div className="no-print card-pad">
                <SectionHead title="Хувилбарууд" desc="Олон хувилбар үүсгэж харьцуулж болно" />
                <div className="space-y-2">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
                        v.id === versionId
                          ? "border-teal-300 bg-teal-50"
                          : "border-[#d7e8e6] bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-bold text-ink-800">
                          {v.name}
                          {v.is_active && (
                            <span className="badge bg-aqua-100 text-aqua-800">Идэвхтэй</span>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-ink-400">
                          {new Date(v.created_at).toLocaleString("mn-MN")} · {v.notes}
                        </div>
                      </div>
                      {!v.is_active && (
                        <button onClick={() => setActive(v)} className="btn-soft btn-sm">
                          Идэвхжүүлэх
                        </button>
                      )}
                      <button onClick={() => deleteVersion(v)} className="btn-danger btn-sm">
                        Устгах
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================= Хуваарь зохиох цонх ================= */}
      <Modal
        open={genOpen}
        onClose={() => !generating && setGenOpen(false)}
        title="Хуваарь автоматаар зохиох"
        subtitle="Хязгаарлалт болон тохиргоог сонгоно уу"
        wide
        footer={
          <>
            <button className="btn-ghost" disabled={generating} onClick={() => setGenOpen(false)}>
              Болих
            </button>
            <button className="btn-primary" disabled={generating} onClick={generate}>
              {generating ? "Зохиож байна…" : "⚡ Зохиох"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Хувилбарын нэр">
            <input
              className="input"
              value={genOpts.name}
              onChange={(e) => setGenOpts({ ...genOpts, name: e.target.value })}
            />
          </Field>

          <div className="space-y-3 rounded-xl bg-ink-50 p-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-aqua-500"
                checked={genOpts.peSharedHall}
                onChange={(e) => setGenOpts({ ...genOpts, peSharedHall: e.target.checked })}
              />
              <span>
                <b className="text-ink-800">Биеийн тамир — нэг зааланд 2 анги</b>
                <br />
                <span className="text-xs text-ink-500">
                  Идэвхжүүлбэл үе ойролцоо ангиудыг хамтад нь нэг зааланд хуваарилна
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-teal-500"
                checked={genOpts.keepLocked}
                onChange={(e) => setGenOpts({ ...genOpts, keepLocked: e.target.checked })}
              />
              <span>
                <b className="text-ink-800">Бэхэлсэн нүднүүдийг хадгалах</b>
                <br />
                <span className="text-xs text-ink-500">
                  Гараар тогтоосон хичээлүүд хөдлөхгүй
                </span>
              </span>
            </label>

            <Field label={`Оролдлогын тоо: ${genOpts.attempts}`} hint="Их бол чанар сайжирна, боловсруулалт удаана">
              <input
                type="range"
                min={3}
                max={40}
                value={genOpts.attempts}
                onChange={(e) => setGenOpts({ ...genOpts, attempts: Number(e.target.value) })}
                className="w-full accent-teal-500"
              />
            </Field>
          </div>

          <div className="rounded-xl border border-[#d7e8e6] p-4 text-[13px]">
            <h4 className="mb-2 font-bold text-ink-800">Дагаж мөрдөх хязгаарлалт</h4>
            <ul className="space-y-1 text-ink-500">
              <li>✓ Багшийн цаг давхцахгүй</li>
              <li>✓ Кабинет давхцахгүй (заалнаас бусад)</li>
              <li>✓ 7 хоногийн нийт цаг яг таарна — хэтрэхгүй, дутахгүй</li>
              <li>✓ Англи хэл, эрэгтэй/эмэгтэй технологи под группээр зэрэгцэж орно</li>
              <li>
                ✓ Багшийн <b>1-р кабинет</b> давуу эрхтэй, 2–7 нь эрэмбээр нөөцөлнө
              </li>
              <li>✓ Нэг хичээл нэг өдөр давтагдахаас зайлсхийнэ</li>
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <MiniStat label="Багш" value={teachers.length} />
            <MiniStat label="Анги" value={classes.length} />
            <MiniStat label="Кабинет" value={rooms.length} />
            <MiniStat label="Нийт цаг" value={requiredHours} />
          </div>

          {result && (
            <div className="rounded-xl border border-[#d7e8e6] bg-white p-4 text-[13px]">
              <h4 className="mb-2 font-bold text-ink-800">Үр дүн</h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Байрлав" value={result.stats.totalPlaced} />
                <MiniStat label="Байрлаагүй" value={result.unplaced.length} />
                <MiniStat label="Багшийн цонх" value={result.stats.teacherGaps} />
                <MiniStat label="Хугацаа" value={`${result.stats.elapsedMs}мс`} />
              </div>
              {result.unplaced.length > 0 && (
                <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-gold-800">
                  {result.unplaced.slice(0, 20).map((u, i) => (
                    <li key={i} className="rounded bg-gold-50 px-2 py-1">
                      {u.teacherName} · {u.subjectName} · {u.className} — {u.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Modal>
    </Shell>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-ink-50 px-3 py-2">
      <div className="text-base font-black text-ink-800">{value}</div>
      <div className="text-[10px] font-bold uppercase text-ink-400">{label}</div>
    </div>
  );
}

/** Багшийн ачаалал ба хуваарийн тулгалт */
function TeacherSummary({
  teacherId,
  slots,
  loads,
  subjects,
  classes,
}: {
  teacherId: string;
  slots: ScheduleSlot[];
  loads: TeachingLoad[];
  subjects: Subject[];
  classes: ClassRoom[];
}) {
  const mine = loads.filter((l) => l.teacher_id === teacherId);
  if (!mine.length) return null;

  const subjName = new Map(subjects.map((s) => [s.id, s.name]));
  const clsName = new Map(classes.map((c) => [c.id, c.name]));

  return (
    <div className="card-pad">
      <SectionHead title="Ачаалал ба гүйцэтгэл" desc="Төлөвлөсөн цаг ба хуваарилагдсан цагийн тулгалт" />
      <div className="table-wrap">
        <table className="w-full min-w-[520px]">
          <thead className="border-b border-[#d7e8e6] bg-ink-50/50">
            <tr>
              <th className="th">Хичээл</th>
              <th className="th">Анги</th>
              <th className="th text-center">Төлөвлөсөн</th>
              <th className="th text-center">Хуваарилсан</th>
              <th className="th text-center">Төлөв</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6f1ef]">
            {mine.map((l) => {
              const got = slots.filter(
                (s) =>
                  s.teacher_id === teacherId &&
                  s.subject_id === l.subject_id &&
                  s.class_id === l.class_id
              ).length;
              const need = Math.round(Number(l.hours_per_week));
              const ok = got === need;
              return (
                <tr key={l.id}>
                  <td className="td">{subjName.get(l.subject_id)}</td>
                  <td className="td">{clsName.get(l.class_id)}</td>
                  <td className="td text-center font-semibold">{need}</td>
                  <td className="td text-center font-semibold">{got}</td>
                  <td className="td text-center">
                    <span
                      className={`badge ${
                        ok ? "bg-aqua-100 text-aqua-800" : "bg-gold-100 text-gold-800"
                      }`}
                    >
                      {ok ? "Таарсан" : got > need ? `+${got - need}` : `-${need - got}`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
