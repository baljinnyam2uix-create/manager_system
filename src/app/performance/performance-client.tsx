"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/shell";
import { Empty, Field, Loading, Modal, SectionHead, StatCard, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { exportRows } from "@/lib/excel";
import { fullName, type PerformanceTask, type PlanItem, type Profile, type Teacher } from "@/lib/types";

interface Period {
  id: string;
  name: string;
  school_year: string;
  start_date: string | null;
  end_date: string | null;
}

const CATEGORIES = [
  "Сургалтын ажил",
  "Хөтөлбөр боловсруулалт",
  "Арга зүйн ажил",
  "Ангийн ажил",
  "Эцэг эхтэй ажиллах",
  "Судалгаа, туршилт",
  "Олон нийтийн ажил",
  "Бусад",
];

export default function PerformanceClient({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const { show, node } = useToast();

  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [tasks, setTasks] = useState<PerformanceTask[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);

  const [selPeriod, setSelPeriod] = useState("");
  const [selTeacher, setSelTeacher] = useState("");
  const [modal, setModal] = useState<Partial<PerformanceTask> | null>(null);
  const [periodModal, setPeriodModal] = useState<Partial<Period> | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPick, setBulkPick] = useState<string[]>([]);
  const [bulkTeachers, setBulkTeachers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, p, ta, pi] = await Promise.all([
      supabase.from("teachers").select("*").eq("active", true).order("last_name"),
      supabase.from("performance_periods").select("*").order("created_at", { ascending: false }),
      supabase.from("performance_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("plan_items").select("*").order("seq"),
    ]);
    const ts = (t.data || []) as Teacher[];
    const ps = (p.data || []) as Period[];
    setTeachers(ts);
    setPeriods(ps);
    setTasks((ta.data || []) as PerformanceTask[]);
    setPlanItems((pi.data || []) as PlanItem[]);
    setSelPeriod((c) => (c && ps.some((x) => x.id === c) ? c : ps[0]?.id || ""));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = tasks.filter(
    (t) =>
      (!selPeriod || t.period_id === selPeriod) &&
      (!selTeacher || t.teacher_id === selTeacher)
  );

  const byTeacher = useMemo(() => {
    const m = new Map<string, PerformanceTask[]>();
    for (const t of visible) {
      if (!m.has(t.teacher_id)) m.set(t.teacher_id, []);
      m.get(t.teacher_id)!.push(t);
    }
    return m;
  }, [visible]);

  async function savePeriod() {
    if (!periodModal?.name?.trim()) return show("Нэр оруулна уу", false);
    setSaving(true);
    const payload = {
      owner_id: profile.id,
      name: periodModal.name.trim(),
      school_year: periodModal.school_year || "2025-2026",
      start_date: periodModal.start_date || null,
      end_date: periodModal.end_date || null,
    };
    const { error } = periodModal.id
      ? await supabase.from("performance_periods").update(payload).eq("id", periodModal.id)
      : await supabase.from("performance_periods").insert(payload);
    setSaving(false);
    if (error) return show(error.message, false);
    show("Үнэлгээний хугацаа хадгалагдлаа");
    setPeriodModal(null);
    load();
  }

  async function saveTask() {
    if (!modal?.title?.trim()) return show("Ажлын нэрийг бичнэ үү", false);
    if (!modal.teacher_id) return show("Багш сонгоно уу", false);
    setSaving(true);
    const payload = {
      owner_id: profile.id,
      period_id: modal.period_id || selPeriod || null,
      teacher_id: modal.teacher_id,
      plan_item_id: modal.plan_item_id || null,
      title: modal.title.trim(),
      category: modal.category || null,
      due_date: modal.due_date || null,
      is_done: !!modal.is_done,
      done_at: modal.is_done ? new Date().toISOString() : null,
      score: modal.score != null && modal.score !== undefined ? Number(modal.score) : null,
      max_score: Number(modal.max_score || 10),
      comment: modal.comment || null,
    };
    const { error } = modal.id
      ? await supabase.from("performance_tasks").update(payload).eq("id", modal.id)
      : await supabase.from("performance_tasks").insert(payload);
    setSaving(false);
    if (error) return show(error.message, false);
    show("Хадгалагдлаа");
    setModal(null);
    load();
  }

  async function toggleDone(t: PerformanceTask) {
    const next = !t.is_done;
    const { error } = await supabase
      .from("performance_tasks")
      .update({ is_done: next, done_at: next ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) return show(error.message, false);
    setTasks((v) =>
      v.map((x) => (x.id === t.id ? { ...x, is_done: next, done_at: next ? new Date().toISOString() : null } : x))
    );
  }

  async function setScore(t: PerformanceTask, score: number) {
    const { error } = await supabase.from("performance_tasks").update({ score }).eq("id", t.id);
    if (error) return show(error.message, false);
    setTasks((v) => v.map((x) => (x.id === t.id ? { ...x, score } : x)));
  }

  /** Төлөвлөгөөнөөс олон ажлыг олон багшид нэг дор оноох */
  async function bulkAssign() {
    if (!bulkPick.length || !bulkTeachers.length)
      return show("Ажил болон багш сонгоно уу", false);
    setSaving(true);
    const rows = [];
    for (const tid of bulkTeachers)
      for (const pid of bulkPick) {
        const pi = planItems.find((x) => x.id === pid);
        rows.push({
          owner_id: profile.id,
          period_id: selPeriod || null,
          teacher_id: tid,
          plan_item_id: pid,
          title: pi?.activity || "",
          category: "Сургалтын ажил",
          due_date: pi?.due_date || null,
          max_score: 10,
        });
      }
    const { error } = await supabase.from("performance_tasks").insert(rows);
    setSaving(false);
    if (error) return show(error.message, false);
    show(`${rows.length} ажил оноогдлоо`);
    setBulkOpen(false);
    setBulkPick([]);
    setBulkTeachers([]);
    load();
  }

  async function exportXlsx() {
    const rows: (string | number | null)[][] = [
      ["Багшийн ажлын гүйцэтгэлийн үнэлгээ"],
      [periods.find((p) => p.id === selPeriod)?.name || "Бүх хугацаа"],
      [],
      ["№", "Багш", "Гүйцэтгэх ажил", "Ангилал", "Хугацаа", "Гүйцэтгэсэн", "Оноо", "Дээд оноо", "Хувь", "Тайлбар"],
    ];
    visible.forEach((t, i) => {
      const tc = teachers.find((x) => x.id === t.teacher_id);
      rows.push([
        i + 1,
        fullName(tc),
        t.title,
        t.category || "",
        t.due_date || "",
        t.is_done ? "Тийм" : "Үгүй",
        t.score ?? "",
        t.max_score ?? "",
        t.score != null && t.max_score
          ? `${Math.round((Number(t.score) / Number(t.max_score)) * 100)}%`
          : "",
        t.comment || "",
      ]);
    });
    try {
      await exportRows(rows, "Ажлын-гүйцэтгэл", "Гүйцэтгэл", [5, 20, 42, 20, 13, 13, 8, 10, 8, 30]);
      show("Excel файл татагдлаа");
    } catch (e) {
      show(e instanceof Error ? e.message : "Excel үүсгэхэд алдаа гарлаа", false);
    }
  }

  const doneCount = visible.filter((t) => t.is_done).length;
  const scored = visible.filter((t) => t.score != null);
  const avgPct = scored.length
    ? Math.round(
        (scored.reduce((s, t) => s + Number(t.score || 0), 0) /
          scored.reduce((s, t) => s + Number(t.max_score || 10), 0)) *
          100
      )
    : 0;

  return (
    <Shell
      profile={profile}
      title="Багшийн ажлын гүйцэтгэл"
      subtitle="Гүйцэтгэх ажлыг тэмдэглэх, чеклэх, оноожуулах"
      actions={
        <>
          <button onClick={exportXlsx} disabled={!visible.length} className="btn-ghost btn-sm">
            Excel татах
          </button>
          <button
            onClick={() => setModal({ teacher_id: selTeacher || teachers[0]?.id, max_score: 10, title: "" })}
            className="btn-primary btn-sm"
          >
            + Ажил нэмэх
          </button>
        </>
      }
    >
      {node}

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Нийт ажил" value={visible.length} icon="📌" tone="geo" />
            <StatCard label="Гүйцэтгэсэн" value={doneCount} icon="✅" tone="aqua" />
            <StatCard
              label="Гүйцэтгэлийн хувь"
              value={visible.length ? `${Math.round((doneCount / visible.length) * 100)}%` : "0%"}
              icon="📈"
              tone="sun"
            />
            <StatCard label="Дундаж оноо" value={`${avgPct}%`} icon="⭐" tone="amber" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select className="input max-w-[260px]" value={selPeriod} onChange={(e) => setSelPeriod(e.target.value)}>
              <option value="">Бүх хугацаа</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select className="input max-w-[240px]" value={selTeacher} onChange={(e) => setSelTeacher(e.target.value)}>
              <option value="">Бүх багш</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{fullName(t)}</option>
              ))}
            </select>
            <button
              onClick={() => setPeriodModal({ name: "", school_year: "2025-2026" })}
              className="btn-ghost btn-sm"
            >
              + Үнэлгээний хугацаа
            </button>
            <button
              onClick={() => setBulkOpen(true)}
              disabled={planItems.length === 0}
              className="btn-soft btn-sm"
              title={planItems.length === 0 ? "Эхлээд төлөвлөгөө үүсгэнэ үү" : ""}
            >
              Төлөвлөгөөнөөс оноох
            </button>
          </div>

          {visible.length === 0 ? (
            <Empty
              icon="✅"
              title="Гүйцэтгэх ажил бүртгээгүй байна"
              desc="Ажлыг шинээр нэмэх, эсвэл менежерийн төлөвлөгөөнөөс сонгож багш нарт оноож болно."
              action={
                <div className="flex gap-2">
                  <button
                    onClick={() => setModal({ teacher_id: teachers[0]?.id, max_score: 10, title: "" })}
                    className="btn-primary"
                  >
                    + Ажил нэмэх
                  </button>
                  {planItems.length > 0 && (
                    <button onClick={() => setBulkOpen(true)} className="btn-ghost">
                      Төлөвлөгөөнөөс
                    </button>
                  )}
                </div>
              }
            />
          ) : (
            <div className="space-y-4">
              {[...byTeacher.entries()].map(([tid, list]) => {
                const tc = teachers.find((x) => x.id === tid);
                const done = list.filter((x) => x.is_done).length;
                const sc = list.filter((x) => x.score != null);
                const pct = sc.length
                  ? Math.round(
                      (sc.reduce((s, x) => s + Number(x.score || 0), 0) /
                        sc.reduce((s, x) => s + Number(x.max_score || 10), 0)) *
                        100
                    )
                  : 0;
                return (
                  <div key={tid} className="card">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dbe6ea] px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-geo-100 text-sm font-black text-geo-700">
                          {(tc?.first_name || "?").charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-ink-900">{fullName(tc)}</div>
                          <div className="text-[11px] text-ink-400">
                            {tc?.department || "—"} · {tc?.rank !== "Байхгүй" ? tc?.rank : "зэрэггүй"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-ink-500">
                          Гүйцэтгэсэн: <b className="text-ink-800">{done}/{list.length}</b>
                        </span>
                        <span className="badge bg-aqua-100 text-aqua-800">{pct}%</span>
                      </div>
                    </div>

                    <div className="divide-y divide-[#e9f0f2]">
                      {list.map((t) => (
                        <div key={t.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                          <input
                            type="checkbox"
                            checked={t.is_done}
                            onChange={() => toggleDone(t)}
                            className="mt-1 h-5 w-5 shrink-0 accent-aqua-500"
                          />
                          <div className="min-w-[200px] flex-1">
                            <div
                              className={`text-sm font-semibold ${
                                t.is_done ? "text-ink-400 line-through" : "text-ink-900"
                              }`}
                            >
                              {t.title}
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-ink-400">
                              {t.category && (
                                <span className="badge bg-ink-100 text-ink-600">{t.category}</span>
                              )}
                              {t.due_date && <span>⏱ {t.due_date}</span>}
                              {t.plan_item_id && (
                                <span className="badge bg-sun-100 text-sun-700">
                                  Төлөвлөгөөнөөс
                                </span>
                              )}
                            </div>
                            {t.comment && (
                              <p className="mt-1 text-[12px] italic text-ink-500">“{t.comment}”</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={Number(t.max_score || 10)}
                              step="0.5"
                              value={t.score ?? ""}
                              placeholder="—"
                              onChange={(e) =>
                                setScore(t, e.target.value === "" ? 0 : Number(e.target.value))
                              }
                              className="w-16 rounded-lg border border-[#dbe6ea] px-2 py-1 text-center text-sm font-bold"
                            />
                            <span className="text-xs text-ink-400">/ {t.max_score || 10}</span>
                          </div>

                          <div className="flex gap-1.5">
                            <button onClick={() => setModal(t)} className="btn-soft btn-sm">
                              Засах
                            </button>
                            <button
                              onClick={() => {
                                if (!confirm("Устгах уу?")) return;
                                supabase
                                  .from("performance_tasks")
                                  .delete()
                                  .eq("id", t.id)
                                  .then(() => load());
                              }}
                              className="btn-danger btn-sm"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------- Ажил ---------- */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? "Ажил засах" : "Гүйцэтгэх ажил нэмэх"}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModal(null)}>Болих</button>
            <button className="btn-primary" disabled={saving} onClick={saveTask}>
              {saving ? "Хадгалж байна…" : "Хадгалах"}
            </button>
          </>
        }
      >
        {modal && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Багш *">
                <select
                  className="input"
                  value={modal.teacher_id || ""}
                  onChange={(e) => setModal({ ...modal, teacher_id: e.target.value })}
                >
                  <option value="">— сонгох —</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{fullName(t)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Үнэлгээний хугацаа">
                <select
                  className="input"
                  value={modal.period_id || ""}
                  onChange={(e) => setModal({ ...modal, period_id: e.target.value || null })}
                >
                  <option value="">— байхгүй —</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Төлөвлөгөөнөөс сонгох" hint="Сонговол ажлын нэр автоматаар бөглөгдөнө">
              <select
                className="input"
                value={modal.plan_item_id || ""}
                onChange={(e) => {
                  const pi = planItems.find((x) => x.id === e.target.value);
                  setModal({
                    ...modal,
                    plan_item_id: e.target.value || null,
                    title: pi ? pi.activity : modal.title,
                    due_date: pi?.due_date || modal.due_date,
                  });
                }}
              >
                <option value="">— шинээр бичих —</option>
                {planItems.map((p) => (
                  <option key={p.id} value={p.id}>{p.activity}</option>
                ))}
              </select>
            </Field>

            <Field label="Гүйцэтгэх ажил *">
              <textarea
                className="input min-h-[70px]"
                value={modal.title || ""}
                onChange={(e) => setModal({ ...modal, title: e.target.value })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Ангилал">
                <select
                  className="input"
                  value={modal.category || ""}
                  onChange={(e) => setModal({ ...modal, category: e.target.value })}
                >
                  <option value="">— сонгох —</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Хугацаа">
                <input
                  className="input"
                  type="date"
                  value={modal.due_date || ""}
                  onChange={(e) => setModal({ ...modal, due_date: e.target.value })}
                />
              </Field>
              <Field label="Дээд оноо">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={modal.max_score ?? 10}
                  onChange={(e) => setModal({ ...modal, max_score: Number(e.target.value) })}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Авсан оноо">
                <input
                  className="input"
                  type="number"
                  step="0.5"
                  min={0}
                  value={modal.score ?? ""}
                  onChange={(e) =>
                    setModal({ ...modal, score: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </Field>
              <div className="flex items-end pb-2.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-ink-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-aqua-500"
                    checked={!!modal.is_done}
                    onChange={(e) => setModal({ ...modal, is_done: e.target.checked })}
                  />
                  Гүйцэтгэсэн
                </label>
              </div>
            </div>

            <Field label="Тайлбар">
              <textarea
                className="input min-h-[70px]"
                placeholder="Гүйцэтгэлийн талаарх тэмдэглэл, зөвлөмж…"
                value={modal.comment || ""}
                onChange={(e) => setModal({ ...modal, comment: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>

      {/* ---------- Үнэлгээний хугацаа ---------- */}
      <Modal
        open={!!periodModal}
        onClose={() => setPeriodModal(null)}
        title="Үнэлгээний хугацаа"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPeriodModal(null)}>Болих</button>
            <button className="btn-primary" disabled={saving} onClick={savePeriod}>
              Хадгалах
            </button>
          </>
        }
      >
        {periodModal && (
          <div className="space-y-4">
            <Field label="Нэр *">
              <input
                className="input"
                placeholder="2025-2026 I улирал"
                value={periodModal.name || ""}
                onChange={(e) => setPeriodModal({ ...periodModal, name: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Эхлэх">
                <input
                  className="input"
                  type="date"
                  value={periodModal.start_date || ""}
                  onChange={(e) => setPeriodModal({ ...periodModal, start_date: e.target.value })}
                />
              </Field>
              <Field label="Дуусах">
                <input
                  className="input"
                  type="date"
                  value={periodModal.end_date || ""}
                  onChange={(e) => setPeriodModal({ ...periodModal, end_date: e.target.value })}
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- Багцаар оноох ---------- */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        wide
        title="Төлөвлөгөөнөөс ажил оноох"
        subtitle="Сонгосон ажлуудыг сонгосон багш бүрд оноож өгнө"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setBulkOpen(false)}>Болих</button>
            <button className="btn-primary" disabled={saving} onClick={bulkAssign}>
              {bulkPick.length * bulkTeachers.length} ажил үүсгэх
            </button>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <SectionHead title="Ажлууд" />
            <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-[#dbe6ea] p-2">
              {planItems.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-ink-50"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-geo-500"
                    checked={bulkPick.includes(p.id)}
                    onChange={(e) =>
                      setBulkPick((v) =>
                        e.target.checked ? [...v, p.id] : v.filter((x) => x !== p.id)
                      )
                    }
                  />
                  <span>{p.activity}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <SectionHead
              title="Багш нар"
              right={
                <button
                  className="btn-ghost btn-sm"
                  onClick={() =>
                    setBulkTeachers(
                      bulkTeachers.length === teachers.length ? [] : teachers.map((t) => t.id)
                    )
                  }
                >
                  {bulkTeachers.length === teachers.length ? "Цуцлах" : "Бүгд"}
                </button>
              }
            />
            <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-[#dbe6ea] p-2">
              {teachers.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-ink-50"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-aqua-500"
                    checked={bulkTeachers.includes(t.id)}
                    onChange={(e) =>
                      setBulkTeachers((v) =>
                        e.target.checked ? [...v, t.id] : v.filter((x) => x !== t.id)
                      )
                    }
                  />
                  <span>{fullName(t)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </Shell>
  );
}
