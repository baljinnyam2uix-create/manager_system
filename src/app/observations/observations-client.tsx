"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/shell";
import { Empty, Field, Loading, Modal, StatCard, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { exportRows } from "@/lib/excel";
import { ROMAN, fullName, type ClassRoom, type Observation, type Profile, type Subject, type Teacher } from "@/lib/types";

export default function ObservationsClient({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const { show, node } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Observation[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [filterTeacher, setFilterTeacher] = useState("");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<Partial<Observation> | null>(null);
  const [view, setView] = useState<Observation | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, t, c, s] = await Promise.all([
      supabase.from("observations").select("*").order("observed_date", { ascending: false }),
      supabase.from("teachers").select("*").eq("active", true).order("last_name"),
      supabase.from("classes").select("*").order("grade").order("name"),
      supabase.from("subjects").select("*").order("name"),
    ]);
    setRows((o.data || []) as Observation[]);
    setTeachers((t.data || []) as Teacher[]);
    setClasses((c.data || []) as ClassRoom[]);
    setSubjects((s.data || []) as Subject[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const tName = (id: string | null) => fullName(teachers.find((t) => t.id === id));
  const cName = (id: string | null) => classes.find((c) => c.id === id)?.name || "—";
  const sName = (id: string | null) => subjects.find((s) => s.id === id)?.name || "—";

  const filtered = rows.filter((r) => {
    if (filterTeacher && r.teacher_id !== filterTeacher) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      (r.topic || "").toLowerCase().includes(s) ||
      (r.note || "").toLowerCase().includes(s) ||
      tName(r.teacher_id).toLowerCase().includes(s)
    );
  });

  async function save() {
    if (!modal?.teacher_id) return show("Багш сонгоно уу", false);
    setSaving(true);
    const payload = {
      owner_id: profile.id,
      teacher_id: modal.teacher_id,
      class_id: modal.class_id || null,
      subject_id: modal.subject_id || null,
      observed_date: modal.observed_date || new Date().toISOString().slice(0, 10),
      period: modal.period ? Number(modal.period) : null,
      start_time: modal.start_time || null,
      topic: modal.topic || null,
      note: modal.note || null,
      strengths: modal.strengths || null,
      suggestions: modal.suggestions || null,
      score: modal.score != null ? Number(modal.score) : null,
      observer: modal.observer || `${profile.last_name} ${profile.first_name}`,
    };
    const { error } = modal.id
      ? await supabase.from("observations").update(payload).eq("id", modal.id)
      : await supabase.from("observations").insert(payload);
    setSaving(false);
    if (error) return show(error.message, false);
    show("Ажиглалтын тэмдэглэл хадгалагдлаа");
    setModal(null);
    load();
  }

  async function exportXlsx() {
    const data: (string | number | null)[][] = [
      ["ХИЧЭЭЛД СУУСАН АЖИГЛАЛТЫН ТЭМДЭГЛЭЛ"],
      [profile.school_name || ""],
      [],
      ["№", "Багшийн нэр", "Заасан анги", "Хичээл", "Огноо", "Цаг", "Хичээлийн сэдэв",
       "Тэмдэглэл", "Давуу тал", "Зөвлөмж", "Оноо", "Ажигласан"],
    ];
    filtered.forEach((r, i) =>
      data.push([
        i + 1,
        tName(r.teacher_id),
        cName(r.class_id),
        sName(r.subject_id),
        r.observed_date,
        r.period ? `${ROMAN[r.period - 1]} (${r.start_time || ""})` : r.start_time || "",
        r.topic || "",
        r.note || "",
        r.strengths || "",
        r.suggestions || "",
        r.score ?? "",
        r.observer || "",
      ])
    );
    try {
      await exportRows(data, "Ажиглалтын-тэмдэглэл", "Ажиглалт",
        [4, 20, 12, 18, 12, 14, 34, 40, 30, 30, 7, 18]);
      show("Excel файл татагдлаа");
    } catch (e) {
      show(e instanceof Error ? e.message : "Excel үүсгэхэд алдаа гарлаа", false);
    }
  }

  const avgScore = (() => {
    const sc = filtered.filter((r) => r.score != null);
    if (!sc.length) return 0;
    return Math.round((sc.reduce((s, r) => s + Number(r.score), 0) / sc.length) * 10) / 10;
  })();

  const thisMonth = filtered.filter(
    (r) => new Date(r.observed_date).getMonth() === new Date().getMonth()
  ).length;

  return (
    <Shell
      profile={profile}
      title="Хичээлийн ажиглалтын тэмдэглэл"
      subtitle="Багшийн хичээлд суусан ажиглалт, зөвлөмж"
      actions={
        <>
          <button onClick={exportXlsx} disabled={!filtered.length} className="btn-ghost btn-sm">
            Excel татах
          </button>
          <button
            onClick={() =>
              setModal({
                observed_date: new Date().toISOString().slice(0, 10),
                teacher_id: teachers[0]?.id,
                observer: `${profile.last_name} ${profile.first_name}`,
              })
            }
            className="btn-primary btn-sm"
          >
            + Тэмдэглэл нэмэх
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
            <StatCard label="Нийт тэмдэглэл" value={rows.length} icon="🔍" tone="geo" />
            <StatCard label="Энэ сард" value={thisMonth} icon="📅" tone="aqua" />
            <StatCard
              label="Хамрагдсан багш"
              value={new Set(rows.map((r) => r.teacher_id)).size}
              sub={`нийт ${teachers.length}`}
              icon="👩‍🏫"
              tone="sun"
            />
            <StatCard label="Дундаж оноо" value={avgScore || "—"} icon="⭐" tone="amber" />
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              className="input max-w-xs"
              placeholder="Сэдэв, тэмдэглэлээр хайх…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="input max-w-[240px]"
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
            >
              <option value="">Бүх багш</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{fullName(t)}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <Empty
              icon="🔍"
              title="Ажиглалтын тэмдэглэл алга"
              desc="Багшийн хичээлд суусан тэмдэглэлээ бүртгэж эхлээрэй."
              action={
                <button
                  onClick={() =>
                    setModal({
                      observed_date: new Date().toISOString().slice(0, 10),
                      teacher_id: teachers[0]?.id,
                    })
                  }
                  className="btn-primary"
                >
                  + Эхний тэмдэглэл
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="w-full min-w-[900px]">
                <thead className="border-b border-[#d7e8e6] bg-ink-50/50">
                  <tr>
                    <th className="th">Огноо</th>
                    <th className="th">Багшийн нэр</th>
                    <th className="th">Заасан анги</th>
                    <th className="th">Цаг</th>
                    <th className="th">Хичээлийн сэдэв</th>
                    <th className="th">Тэмдэглэл</th>
                    <th className="th text-center">Оноо</th>
                    <th className="th text-right">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6f1ef]">
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer hover:bg-ink-50/40"
                      onClick={() => setView(r)}
                    >
                      <td className="td whitespace-nowrap text-xs">
                        {new Date(r.observed_date).toLocaleDateString("mn-MN")}
                      </td>
                      <td className="td font-semibold">{tName(r.teacher_id)}</td>
                      <td className="td">
                        <span className="badge bg-teal-100 text-teal-700">
                          {cName(r.class_id)}
                        </span>
                        <div className="mt-0.5 text-[11px] text-ink-400">
                          {sName(r.subject_id)}
                        </div>
                      </td>
                      <td className="td text-xs">
                        {r.period ? ROMAN[r.period - 1] : ""}{" "}
                        {r.start_time && (
                          <span className="text-ink-400">{r.start_time.slice(0, 5)}</span>
                        )}
                      </td>
                      <td className="td max-w-[220px] truncate">{r.topic || "—"}</td>
                      <td className="td max-w-[260px] truncate text-xs text-ink-500">
                        {r.note || "—"}
                      </td>
                      <td className="td text-center">
                        {r.score != null && (
                          <span className="badge bg-seafoam-100 text-seafoam-800">{r.score}</span>
                        )}
                      </td>
                      <td className="td" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setModal(r)} className="btn-soft btn-sm">
                            Засах
                          </button>
                          <button
                            onClick={() => {
                              if (!confirm("Устгах уу?")) return;
                              supabase
                                .from("observations")
                                .delete()
                                .eq("id", r.id)
                                .then(() => load());
                            }}
                            className="btn-danger btn-sm"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------- Засах ---------- */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        wide
        title={modal?.id ? "Тэмдэглэл засах" : "Ажиглалтын тэмдэглэл"}
        subtitle="Багшийн нэр, заасан анги, цаг, хичээлийн сэдэв, тэмдэглэл"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModal(null)}>Болих</button>
            <button className="btn-primary" disabled={saving} onClick={save}>
              {saving ? "Хадгалж байна…" : "Хадгалах"}
            </button>
          </>
        }
      >
        {modal && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Багшийн нэр *">
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
              <Field label="Заасан анги">
                <select
                  className="input"
                  value={modal.class_id || ""}
                  onChange={(e) => setModal({ ...modal, class_id: e.target.value || null })}
                >
                  <option value="">— сонгох —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Хичээл">
                <select
                  className="input"
                  value={modal.subject_id || ""}
                  onChange={(e) => setModal({ ...modal, subject_id: e.target.value || null })}
                >
                  <option value="">— сонгох —</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Огноо">
                <input
                  className="input"
                  type="date"
                  value={modal.observed_date || ""}
                  onChange={(e) => setModal({ ...modal, observed_date: e.target.value })}
                />
              </Field>
              <Field label="Хэддэх цаг">
                <select
                  className="input"
                  value={modal.period ?? ""}
                  onChange={(e) =>
                    setModal({ ...modal, period: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">— сонгох —</option>
                  {ROMAN.slice(0, 8).map((r, i) => (
                    <option key={r} value={i + 1}>{r} цаг</option>
                  ))}
                </select>
              </Field>
              <Field label="Эхлэх цаг">
                <input
                  className="input"
                  type="time"
                  value={modal.start_time?.slice(0, 5) || ""}
                  onChange={(e) => setModal({ ...modal, start_time: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Хичээлийн сэдэв">
              <input
                className="input"
                placeholder="Квадрат тэгшитгэл бодох арга"
                value={modal.topic || ""}
                onChange={(e) => setModal({ ...modal, topic: e.target.value })}
              />
            </Field>

            <Field label="Тэмдэглэл">
              <textarea
                className="input min-h-[110px]"
                placeholder="Хичээлийн явц, багшийн арга зүй, сурагчдын оролцоо…"
                value={modal.note || ""}
                onChange={(e) => setModal({ ...modal, note: e.target.value })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Давуу тал">
                <textarea
                  className="input min-h-[80px]"
                  value={modal.strengths || ""}
                  onChange={(e) => setModal({ ...modal, strengths: e.target.value })}
                />
              </Field>
              <Field label="Зөвлөмж">
                <textarea
                  className="input min-h-[80px]"
                  value={modal.suggestions || ""}
                  onChange={(e) => setModal({ ...modal, suggestions: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Оноо (100-аас)">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={modal.score ?? ""}
                  onChange={(e) =>
                    setModal({ ...modal, score: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Ажигласан хүн">
                <input
                  className="input"
                  value={modal.observer || ""}
                  onChange={(e) => setModal({ ...modal, observer: e.target.value })}
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- Дэлгэрэнгүй ---------- */}
      <Modal
        open={!!view}
        onClose={() => setView(null)}
        wide
        title={view ? `${tName(view.teacher_id)} — ${view.topic || "Ажиглалт"}` : ""}
        subtitle={
          view
            ? `${cName(view.class_id)} · ${sName(view.subject_id)} · ${new Date(view.observed_date).toLocaleDateString("mn-MN")}`
            : ""
        }
      >
        {view && (
          <div className="space-y-4 text-sm">
            <Block title="Тэмдэглэл" text={view.note} />
            <Block title="Давуу тал" text={view.strengths} tone="aqua" />
            <Block title="Зөвлөмж" text={view.suggestions} tone="amber" />
            <div className="flex flex-wrap gap-4 rounded-xl bg-ink-50 p-4 text-xs">
              <span>
                <b className="text-ink-500">Цаг:</b>{" "}
                {view.period ? ROMAN[view.period - 1] : "—"} {view.start_time?.slice(0, 5) || ""}
              </span>
              <span>
                <b className="text-ink-500">Оноо:</b> {view.score ?? "—"}
              </span>
              <span>
                <b className="text-ink-500">Ажигласан:</b> {view.observer || "—"}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </Shell>
  );
}

function Block({
  title,
  text,
  tone = "ink",
}: {
  title: string;
  text: string | null;
  tone?: "ink" | "aqua" | "amber";
}) {
  if (!text) return null;
  const tones = {
    ink: "border-[#d7e8e6] bg-white",
    aqua: "border-seafoam-200 bg-seafoam-50",
    amber: "border-coral-200 bg-coral-50",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-400">
        {title}
      </h4>
      <p className="whitespace-pre-wrap leading-relaxed text-ink-700">{text}</p>
    </div>
  );
}
