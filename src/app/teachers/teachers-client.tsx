"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/shell";
import { Empty, Field, Loading, Modal, StatCard, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { exportRows } from "@/lib/excel";
import {
  RANKS,
  fullName,
  teacherName,
  type ClassRoom,
  type Profile,
  type Room,
  type Subject,
  type Teacher,
  type TeacherRank,
  type TeachingLoad,
} from "@/lib/types";

const EMPTY: Partial<Teacher> = {
  last_name: "",
  first_name: "",
  register_no: "",
  phone: "",
  email: "",
  home_address: "",
  hire_date: "",
  years_worked: 0,
  rank: "Байхгүй",
  department: "",
  is_homeroom: false,
  homeroom_class_id: null,
  main_room_id: null,
  base_salary: 0,
  hourly_rate: 0,
  active: true,
  note: "",
};

export default function TeachersClient({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const { show, node } = useToast();

  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loads, setLoads] = useState<TeachingLoad[]>([]);
  const [tSubjects, setTSubjects] = useState<{ teacher_id: string; subject_id: string }[]>([]);
  const [tRooms, setTRooms] = useState<{ teacher_id: string; room_id: string; priority: number }[]>([]);

  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [editing, setEditing] = useState<Partial<Teacher> | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Teacher>>(EMPTY);
  const [formSubjects, setFormSubjects] = useState<string[]>([]);
  const [formRooms, setFormRooms] = useState<string[]>([]);   // эрэмбээр 1..7
  const [formLoads, setFormLoads] = useState<Partial<TeachingLoad>[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, s, c, r, l, ts, tr] = await Promise.all([
      supabase.from("teachers").select("*").order("last_name"),
      supabase.from("subjects").select("*").order("name"),
      supabase.from("classes").select("*").order("grade").order("name"),
      supabase.from("rooms").select("*").order("name"),
      supabase.from("teaching_loads").select("*"),
      supabase.from("teacher_subjects").select("teacher_id, subject_id"),
      supabase.from("teacher_rooms").select("teacher_id, room_id, priority").order("priority"),
    ]);
    setTeachers((t.data || []) as Teacher[]);
    setSubjects((s.data || []) as Subject[]);
    setClasses((c.data || []) as ClassRoom[]);
    setRooms((r.data || []) as Room[]);
    setLoads((l.data || []) as TeachingLoad[]);
    setTSubjects(ts.data || []);
    setTRooms(tr.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const departments = useMemo(
    () => [...new Set(teachers.map((t) => t.department).filter(Boolean))] as string[],
    [teachers]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return teachers.filter((t) => {
      if (deptFilter && t.department !== deptFilter) return false;
      if (!s) return true;
      return (
        fullName(t).toLowerCase().includes(s) ||
        (t.phone || "").includes(s) ||
        (t.register_no || "").toLowerCase().includes(s) ||
        (t.department || "").toLowerCase().includes(s)
      );
    });
  }, [teachers, q, deptFilter]);

  const hoursOf = useCallback(
    (tid: string) =>
      loads
        .filter((l) => l.teacher_id === tid)
        .reduce((s, l) => s + Number(l.hours_per_week), 0),
    [loads]
  );

  function openNew() {
    setForm({ ...EMPTY });
    setFormSubjects([]);
    setFormRooms([]);
    setFormLoads([]);
    setEditing({});
  }

  function openEdit(t: Teacher) {
    setForm({ ...t, hire_date: t.hire_date || "" });
    setFormSubjects(tSubjects.filter((x) => x.teacher_id === t.id).map((x) => x.subject_id));
    setFormRooms(
      tRooms
        .filter((x) => x.teacher_id === t.id)
        .sort((a, b) => a.priority - b.priority)
        .map((x) => x.room_id)
    );
    setFormLoads(loads.filter((l) => l.teacher_id === t.id).map((l) => ({ ...l })));
    setEditing(t);
  }

  async function save() {
    if (!form.last_name?.trim() || !form.first_name?.trim()) {
      show("Овог, нэрийг заавал бөглөнө үү", false);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        owner_id: profile.id,
        last_name: form.last_name.trim(),
        first_name: form.first_name.trim(),
        register_no: form.register_no || null,
        phone: form.phone || null,
        email: form.email || null,
        home_address: form.home_address || null,
        hire_date: form.hire_date || null,
        years_worked: Number(form.years_worked || 0),
        rank: (form.rank || "Байхгүй") as TeacherRank,
        department: form.department || null,
        main_room_id: form.main_room_id || null,
        is_homeroom: !!form.is_homeroom,
        homeroom_class_id: form.is_homeroom ? form.homeroom_class_id || null : null,
        base_salary: Number(form.base_salary || 0),
        hourly_rate: Number(form.hourly_rate || 0),
        active: form.active !== false,
        note: form.note || null,
        updated_at: new Date().toISOString(),
      };

      let teacherId = (editing as Teacher)?.id;

      if (teacherId) {
        const { error } = await supabase.from("teachers").update(payload).eq("id", teacherId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("teachers").insert(payload).select("id").single();
        if (error) throw error;
        teacherId = data.id;
      }

      // Судлагдахуун
      await supabase.from("teacher_subjects").delete().eq("teacher_id", teacherId);
      if (formSubjects.length) {
        const { error } = await supabase.from("teacher_subjects").insert(
          formSubjects.map((sid) => ({
            owner_id: profile.id,
            teacher_id: teacherId,
            subject_id: sid,
          }))
        );
        if (error) throw error;
      }

      // Кабинетийн эрэмбэ
      await supabase.from("teacher_rooms").delete().eq("teacher_id", teacherId);
      const uniqRooms = [...new Set(formRooms.filter(Boolean))].slice(0, 7);
      if (uniqRooms.length) {
        const { error } = await supabase.from("teacher_rooms").insert(
          uniqRooms.map((rid, i) => ({
            owner_id: profile.id,
            teacher_id: teacherId,
            room_id: rid,
            priority: i + 1,
          }))
        );
        if (error) throw error;
      }

      // Ачаалал
      await supabase.from("teaching_loads").delete().eq("teacher_id", teacherId);
      const validLoads = formLoads.filter(
        (l) => l.subject_id && l.class_id && Number(l.hours_per_week) > 0
      );
      if (validLoads.length) {
        const { error } = await supabase.from("teaching_loads").insert(
          validLoads.map((l) => ({
            owner_id: profile.id,
            teacher_id: teacherId,
            subject_id: l.subject_id,
            class_id: l.class_id,
            hours_per_week: Number(l.hours_per_week),
            is_elective: !!l.is_elective,
            subgroup: l.subgroup || null,
          }))
        );
        if (error) throw error;
      }

      // Анги даалт — classes хүснэгтэд ч тусгана
      if (payload.is_homeroom && payload.homeroom_class_id) {
        await supabase
          .from("classes")
          .update({ homeroom_teacher_id: teacherId })
          .eq("id", payload.homeroom_class_id);
      }

      show("Багшийн мэдээлэл хадгалагдлаа");
      setEditing(null);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Хадгалахад алдаа гарлаа", false);
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: Teacher) {
    if (!confirm(`${fullName(t)} багшийг устгах уу? Хуваарь, ачаалал нь хамт устана.`)) return;
    const { error } = await supabase.from("teachers").delete().eq("id", t.id);
    if (error) show(error.message, false);
    else {
      show("Багш устлаа");
      load();
    }
  }

  async function exportXlsx() {
    const rows: (string | number | null)[][] = [
      [
        "№", "Овог", "Нэр", "РД", "Утас", "И-мэйл", "Гэрийн хаяг",
        "Ажилд орсон", "Ажилласан жил", "Зэрэг", "Судлагдахуун",
        "Заадаг хичээл", "Хичээл ордог анги", "7 хоногийн нийт цаг",
        "Анги даасан эсэх", "Даасан анги", "Үндсэн кабинет",
      ],
    ];
    filtered.forEach((t, i) => {
      const my = loads.filter((l) => l.teacher_id === t.id);
      const subjNames = [
        ...new Set(
          tSubjects
            .filter((x) => x.teacher_id === t.id)
            .map((x) => subjects.find((s) => s.id === x.subject_id)?.name)
            .filter(Boolean)
        ),
      ].join(", ");
      const classDetail = my
        .map((l) => {
          const c = classes.find((x) => x.id === l.class_id)?.name;
          return `${c} (${l.hours_per_week}ц)`;
        })
        .join(", ");
      rows.push([
        i + 1,
        t.last_name,
        t.first_name,
        t.register_no || "",
        t.phone || "",
        t.email || "",
        t.home_address || "",
        t.hire_date || "",
        t.years_worked || 0,
        t.rank === "Байхгүй" ? "" : t.rank,
        t.department || "",
        subjNames,
        classDetail,
        hoursOf(t.id),
        t.is_homeroom ? "Тийм" : "Үгүй",
        classes.find((c) => c.id === t.homeroom_class_id)?.name || "Ангигүй",
        rooms.find((r) => r.id === t.main_room_id)?.name || "",
      ]);
    });
    try {
      await exportRows(rows, "Багшийн-бүртгэл", "Багш нар",
        [4, 14, 14, 14, 12, 22, 26, 13, 9, 13, 22, 24, 34, 10, 12, 12, 14]);
      show("Excel файл татагдлаа");
    } catch (e) {
      show(e instanceof Error ? e.message : "Excel үүсгэхэд алдаа гарлаа", false);
    }
  }

  const totalHours = teachers.reduce((s, t) => s + hoursOf(t.id), 0);

  return (
    <Shell
      profile={profile}
      title="Багшийн бүртгэл"
      subtitle="Багш нарын үндсэн мэдээлэл, судлагдахуун, ачаалал"
      actions={
        <>
          <button onClick={exportXlsx} className="btn-ghost btn-sm">
            Excel татах
          </button>
          <button onClick={openNew} className="btn-primary btn-sm">
            + Багш нэмэх
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
            <StatCard label="Нийт багш" value={teachers.length} icon="👩‍🏫" tone="geo" />
            <StatCard
              label="Анги даасан"
              value={teachers.filter((t) => t.is_homeroom).length}
              icon="🏫"
              tone="aqua"
            />
            <StatCard label="7 хоногийн нийт цаг" value={totalHours} icon="⏱️" tone="sun" />
            <StatCard
              label="Дундаж ачаалал"
              value={teachers.length ? (totalHours / teachers.length).toFixed(1) : 0}
              sub="цаг / багш"
              icon="📈"
              tone="amber"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              className="input max-w-xs"
              placeholder="Нэр, РД, утсаар хайх…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="input max-w-[220px]"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">Бүх судлагдахуун</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <Empty
              icon="👩‍🏫"
              title="Багш бүртгэгдээгүй байна"
              desc="Багш нарын мэдээллийг оруулснаар хичээлийн хуваарь зохиох, цалин бодох боломжтой болно."
              action={
                <button onClick={openNew} className="btn-primary">
                  + Эхний багшийг нэмэх
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="w-full min-w-[1000px]">
                <thead className="border-b border-[#dbe6ea] bg-ink-50/50">
                  <tr>
                    <th className="th">№</th>
                    <th className="th">Багш</th>
                    <th className="th">Холбоо барих</th>
                    <th className="th">Судлагдахуун</th>
                    <th className="th">Зэрэг</th>
                    <th className="th text-center">7 хоног/цаг</th>
                    <th className="th">Анги даалт</th>
                    <th className="th">Кабинет</th>
                    <th className="th text-right">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9f0f2]">
                  {filtered.map((t, i) => {
                    const h = hoursOf(t.id);
                    const myRooms = tRooms
                      .filter((x) => x.teacher_id === t.id)
                      .sort((a, b) => a.priority - b.priority)
                      .map((x) => rooms.find((r) => r.id === x.room_id)?.name)
                      .filter(Boolean);
                    return (
                      <tr key={t.id} className="hover:bg-ink-50/40">
                        <td className="td text-ink-400">{i + 1}</td>
                        <td className="td">
                          <div className="font-semibold text-ink-900">{fullName(t)}</div>
                          <div className="text-[11px] text-ink-400">
                            {t.register_no || "РД байхгүй"} ·{" "}
                            {t.years_worked ? `${t.years_worked} жил` : "—"}
                          </div>
                        </td>
                        <td className="td text-xs">
                          <div>{t.phone || "—"}</div>
                          <div className="text-ink-400">{t.email || ""}</div>
                        </td>
                        <td className="td text-xs">{t.department || "—"}</td>
                        <td className="td">
                          {t.rank !== "Байхгүй" && (
                            <span className="badge bg-geo-100 text-geo-700">
                              {t.rank}
                            </span>
                          )}
                        </td>
                        <td className="td text-center">
                          <span
                            className={`badge ${
                              h === 0
                                ? "bg-ink-100 text-ink-500"
                                : h > 30
                                  ? "bg-red-100 text-red-700"
                                  : "bg-aqua-100 text-aqua-800"
                            }`}
                          >
                            {h}
                          </span>
                        </td>
                        <td className="td text-xs">
                          {t.is_homeroom ? (
                            <span className="badge bg-sun-100 text-sun-800">
                              {classes.find((c) => c.id === t.homeroom_class_id)?.name || "Анги сонгоогүй"}
                            </span>
                          ) : (
                            <span className="text-ink-300">Ангигүй</span>
                          )}
                        </td>
                        <td className="td text-xs">
                          {myRooms.length ? (
                            <span title={`Эрэмбэ: ${myRooms.join(" → ")}`}>
                              <b className="text-geo-600">{myRooms[0]}</b>
                              {myRooms.length > 1 && (
                                <span className="text-ink-400"> +{myRooms.length - 1}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                        <td className="td">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => openEdit(t)} className="btn-soft btn-sm">
                              Засах
                            </button>
                            <button onClick={() => remove(t)} className="btn-danger btn-sm">
                              Устгах
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Багш засах цонх ---------------- */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        wide
        title={(editing as Teacher)?.id ? "Багшийн мэдээлэл засах" : "Шинэ багш нэмэх"}
        subtitle="Үндсэн мэдээлэл, судлагдахуун, кабинетийн эрэмбэ, долоо хоногийн ачаалал"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)}>
              Болих
            </button>
            <button className="btn-primary" disabled={saving} onClick={save}>
              {saving ? "Хадгалж байна…" : "Хадгалах"}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Үндсэн мэдээлэл */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-400">
              Үндсэн мэдээлэл
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Овог *">
                <input className="input" value={form.last_name || ""} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </Field>
              <Field label="Нэр *">
                <input className="input" value={form.first_name || ""} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </Field>
              <Field label="Регистрийн дугаар">
                <input className="input" placeholder="УБ12345678" value={form.register_no || ""} onChange={(e) => setForm({ ...form, register_no: e.target.value })} />
              </Field>
              <Field label="Утас">
                <input className="input" placeholder="99112233" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="И-мэйл">
                <input className="input" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Ажилд орсон огноо">
                <input className="input" type="date" value={form.hire_date || ""} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
              </Field>
              <Field label="Гэрийн хаяг" className="sm:col-span-2">
                <input className="input" placeholder="Ханбогд сум, 2-р баг…" value={form.home_address || ""} onChange={(e) => setForm({ ...form, home_address: e.target.value })} />
              </Field>
              <Field label="Ажилласан жил">
                <input className="input" type="number" step="0.5" min="0" value={form.years_worked ?? 0} onChange={(e) => setForm({ ...form, years_worked: Number(e.target.value) })} />
              </Field>
              <Field label="Зэрэг">
                <select className="input" value={form.rank || "Байхгүй"} onChange={(e) => setForm({ ...form, rank: e.target.value as TeacherRank })}>
                  {RANKS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Судлагдахууны нэгдэл">
                <input className="input" placeholder="Математик, мэдээллийн технологи" value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </Field>
              <Field label="Үндсэн цалин (сар)">
                <input className="input" type="number" min="0" value={form.base_salary ?? 0} onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} />
              </Field>
              <Field label="1 цагийн хөлс">
                <input className="input" type="number" min="0" value={form.hourly_rate ?? 0} onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })} />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-ink-50 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-geo-500"
                  checked={!!form.is_homeroom}
                  onChange={(e) => setForm({ ...form, is_homeroom: e.target.checked })}
                />
                Анги даасан
              </label>
              {form.is_homeroom ? (
                <select
                  className="input max-w-[200px]"
                  value={form.homeroom_class_id || ""}
                  onChange={(e) => setForm({ ...form, homeroom_class_id: e.target.value || null })}
                >
                  <option value="">— Анги сонгох —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-ink-400">Ангигүй</span>
              )}
              <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-ink-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-aqua-500"
                  checked={form.active !== false}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Идэвхтэй
              </label>
            </div>
          </div>

          {/* Судлагдахуун */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-400">
              Заадаг судлагдахуун
            </h4>
            {subjects.length === 0 ? (
              <p className="text-sm text-ink-400">
                Тохиргоо хэсэгт судлагдахуун нэмнэ үү.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => {
                  const on = formSubjects.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setFormSubjects((v) =>
                          on ? v.filter((x) => x !== s.id) : [...v, s.id]
                        )
                      }
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        on
                          ? "border-transparent text-white shadow-soft"
                          : "border-[#dbe6ea] bg-white text-ink-500 hover:bg-ink-50"
                      }`}
                      style={on ? { backgroundColor: s.color } : undefined}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Кабинетийн эрэмбэ */}
          <div>
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">
              Кабинетийн эрэмбэ (1–7)
            </h4>
            <p className="mb-3 text-[11px] text-ink-400">
              <b className="text-geo-600">1-рт бичсэн кабинет</b> нь бусад багшаас
              давуу эрхтэй — хуваарь зохиоход эхэлж энэ кабинетэд оруулна. Дараагийнх нь
              эрэмбийн дагуу нөөц болно.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-black ${
                      i === 0 ? "bg-geo-500 text-white" : "bg-ink-100 text-ink-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <select
                    className="input py-2 text-sm"
                    value={formRooms[i] || ""}
                    onChange={(e) => {
                      const v = [...formRooms];
                      v[i] = e.target.value;
                      setFormRooms(v.filter((x, j) => j <= i || x));
                    }}
                  >
                    <option value="">— {i === 0 ? "Үндсэн кабинет" : "нөөц"} —</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.is_hall ? "(заал)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Ачаалал */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wide text-ink-400">
                Хичээл ордог анги ба долоо хоногийн цаг
              </h4>
              <button
                type="button"
                className="btn-soft btn-sm"
                onClick={() =>
                  setFormLoads((v) => [
                    ...v,
                    {
                      subject_id: formSubjects[0] || subjects[0]?.id,
                      class_id: classes[0]?.id,
                      hours_per_week: 2,
                      is_elective: false,
                      subgroup: null,
                    },
                  ])
                }
              >
                + Мөр нэмэх
              </button>
            </div>

            {formLoads.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#c9dbe0] px-4 py-6 text-center text-sm text-ink-400">
                Ачаалал оруулаагүй байна. Хуваарь зохиохын тулд заавал оруулна.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1.4fr_1fr_.7fr_.9fr_auto] gap-2 px-1 text-[10px] font-bold uppercase text-ink-400">
                  <span>Хичээл</span>
                  <span>Анги</span>
                  <span>7х/цаг</span>
                  <span>Төрөл</span>
                  <span />
                </div>
                {formLoads.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1.4fr_1fr_.7fr_.9fr_auto] gap-2">
                    <select
                      className="input py-2 text-sm"
                      value={l.subject_id || ""}
                      onChange={(e) => {
                        const v = [...formLoads];
                        v[i] = { ...v[i], subject_id: e.target.value };
                        setFormLoads(v);
                      }}
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <select
                      className="input py-2 text-sm"
                      value={l.class_id || ""}
                      onChange={(e) => {
                        const v = [...formLoads];
                        v[i] = { ...v[i], class_id: e.target.value };
                        setFormLoads(v);
                      }}
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <input
                      className="input py-2 text-sm"
                      type="number"
                      step="0.5"
                      min="0"
                      value={l.hours_per_week ?? 0}
                      onChange={(e) => {
                        const v = [...formLoads];
                        v[i] = { ...v[i], hours_per_week: Number(e.target.value) };
                        setFormLoads(v);
                      }}
                    />
                    <select
                      className="input py-2 text-sm"
                      value={l.is_elective ? "e" : l.subgroup ? `g${l.subgroup}` : "n"}
                      onChange={(e) => {
                        const val = e.target.value;
                        const v = [...formLoads];
                        v[i] = {
                          ...v[i],
                          is_elective: val === "e",
                          subgroup: val.startsWith("g") ? val.slice(1) : null,
                        };
                        setFormLoads(v);
                      }}
                    >
                      <option value="n">Үндсэн</option>
                      <option value="e">Сонгон</option>
                      <option value="gA">Групп A</option>
                      <option value="gB">Групп B</option>
                    </select>
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      onClick={() => setFormLoads((v) => v.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="pt-2 text-right text-sm font-bold text-ink-700">
                  Нийт:{" "}
                  <span className="text-geo-600">
                    {formLoads.reduce((s, l) => s + Number(l.hours_per_week || 0), 0)}
                  </span>{" "}
                  цаг / 7 хоног
                </div>
              </div>
            )}
          </div>

          <Field label="Тэмдэглэл">
            <textarea
              className="input min-h-[70px]"
              value={form.note || ""}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </Shell>
  );
}
