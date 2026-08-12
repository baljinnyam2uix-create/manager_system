"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/shell";
import { Empty, Field, Loading, Modal, SectionHead, StatCard, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { exportSheets, readSheetRows } from "@/lib/excel";
import type { ClassRoom, Grade, Profile, Student, Subject } from "@/lib/types";

const YEAR = "2025-2026";
const QUARTERS = [1, 2, 3, 4];

function letterOf(score: number | null | undefined) {
  if (score == null) return "";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function scoreColor(score: number | null | undefined) {
  if (score == null) return "";
  if (score >= 90) return "bg-aqua-100 text-aqua-800";
  if (score >= 80) return "bg-geo-100 text-geo-700";
  if (score >= 70) return "bg-amber-100 text-amber-800";
  if (score >= 60) return "bg-sun-100 text-sun-800";
  return "bg-red-100 text-red-700";
}

export default function GradesClient({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const { show, node } = useToast();

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);

  const [selClass, setSelClass] = useState("");
  const [quarter, setQuarter] = useState(1);
  const [stuModal, setStuModal] = useState<Partial<Student> | null>(null);
  const [bulkStu, setBulkStu] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Map<string, number | null>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    const [c, s, st, g] = await Promise.all([
      supabase.from("classes").select("*").order("grade").order("name"),
      supabase.from("subjects").select("*").order("name"),
      supabase.from("students").select("*").eq("active", true).order("first_name"),
      supabase.from("grades").select("*").eq("school_year", YEAR),
    ]);
    const cs = (c.data || []) as ClassRoom[];
    setClasses(cs);
    setSubjects((s.data || []) as Subject[]);
    setStudents((st.data || []) as Student[]);
    setGrades((g.data || []) as Grade[]);
    setSelClass((cur) => (cur && cs.some((x) => x.id === cur) ? cur : cs[0]?.id || ""));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const classStudents = students.filter((s) => s.class_id === selClass);

  const gradeMap = useMemo(() => {
    const m = new Map<string, Grade>();
    for (const g of grades) m.set(`${g.student_id}|${g.subject_id}|${g.quarter}`, g);
    return m;
  }, [grades]);

  const key = (sid: string, subId: string) => `${sid}|${subId}|${quarter}`;

  const valueOf = (sid: string, subId: string): number | null => {
    const k = key(sid, subId);
    if (dirty.has(k)) return dirty.get(k) ?? null;
    return gradeMap.get(k)?.score != null ? Number(gradeMap.get(k)!.score) : null;
  };

  function setCell(sid: string, subId: string, v: string) {
    const k = key(sid, subId);
    const n = v === "" ? null : Math.max(0, Math.min(100, Number(v)));
    setDirty((m) => new Map(m).set(k, n));
  }

  async function saveGrades() {
    if (dirty.size === 0) return show("Өөрчлөлт алга", false);
    setSaving(true);
    const upserts: Record<string, unknown>[] = [];
    const deletes: string[] = [];

    for (const [k, v] of dirty) {
      const [student_id, subject_id, q] = k.split("|");
      if (v == null) {
        const g = gradeMap.get(k);
        if (g) deletes.push(g.id);
      } else {
        upserts.push({
          owner_id: profile.id,
          student_id,
          subject_id,
          school_year: YEAR,
          quarter: Number(q),
          score: v,
        });
      }
    }

    try {
      if (deletes.length) {
        const { error } = await supabase.from("grades").delete().in("id", deletes);
        if (error) throw error;
      }
      for (let i = 0; i < upserts.length; i += 300) {
        const { error } = await supabase
          .from("grades")
          .upsert(upserts.slice(i, i + 300), {
            onConflict: "student_id,subject_id,school_year,quarter",
          });
        if (error) throw error;
      }
      show(`${dirty.size} дүн хадгалагдлаа`);
      setDirty(new Map());
      load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Хадгалахад алдаа гарлаа", false);
    } finally {
      setSaving(false);
    }
  }

  async function saveStudent() {
    if (!stuModal?.first_name?.trim()) return show("Нэр оруулна уу", false);
    setSaving(true);
    const payload = {
      owner_id: profile.id,
      class_id: stuModal.class_id || selClass,
      last_name: stuModal.last_name || null,
      first_name: stuModal.first_name.trim(),
      student_no: stuModal.student_no || null,
      gender: stuModal.gender || null,
    };
    const { error } = stuModal.id
      ? await supabase.from("students").update(payload).eq("id", stuModal.id)
      : await supabase.from("students").insert(payload);
    setSaving(false);
    if (error) return show(error.message, false);
    show("Хадгалагдлаа");
    setStuModal(null);
    load();
  }

  async function saveBulkStudents() {
    const names = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!names.length) return;
    setSaving(true);
    const rows = names.map((n) => {
      const parts = n.split(/[.\s]+/).filter(Boolean);
      return {
        owner_id: profile.id,
        class_id: selClass,
        last_name: parts.length > 1 ? parts[0] : null,
        first_name: parts.length > 1 ? parts.slice(1).join(" ") : n,
      };
    });
    const { error } = await supabase.from("students").insert(rows);
    setSaving(false);
    if (error) return show(error.message, false);
    show(`${rows.length} сурагч нэмэгдлээ`);
    setBulkStu(false);
    setBulkText("");
    load();
  }

  /** Excel-ээс импорт: Анги | Сурагч | Судлагдахуун | Улирал | Дүн */
  async function importXlsx(file: File) {
    try {
      const rows = await readSheetRows(file);
      const body = rows.slice(1).filter((r) => r[0] && r[1]);
      if (!body.length) return show("Мөр олдсонгүй", false);

      const clsByName = new Map(classes.map((c) => [c.name.toLowerCase(), c]));
      const subByName = new Map(subjects.map((s) => [s.name.toLowerCase(), s]));
      const stuKey = new Map(
        students.map((s) => [`${s.class_id}|${(s.first_name || "").toLowerCase()}`, s])
      );

      const newStudents: Record<string, unknown>[] = [];
      const pending: { cls: string; name: string; sub: string; q: number; score: number }[] = [];
      const missing = new Set<string>();

      for (const r of body) {
        const clsName = String(r[0]).trim();
        const stuName = String(r[1]).trim();
        const subName = String(r[2] || "").trim();
        const q = Number(r[3] || 1);
        const score = Number(r[4]);
        const c = clsByName.get(clsName.toLowerCase());
        if (!c) { missing.add(`анги: ${clsName}`); continue; }
        if (!subByName.get(subName.toLowerCase())) { missing.add(`хичээл: ${subName}`); continue; }
        if (isNaN(score)) continue;

        const parts = stuName.split(/[.\s]+/).filter(Boolean);
        const fn = parts.length > 1 ? parts.slice(1).join(" ") : stuName;
        if (!stuKey.has(`${c.id}|${fn.toLowerCase()}`)) {
          const rec = {
            owner_id: profile.id,
            class_id: c.id,
            last_name: parts.length > 1 ? parts[0] : null,
            first_name: fn,
          };
          if (!newStudents.some((x) => x.class_id === c.id && x.first_name === fn))
            newStudents.push(rec);
        }
        pending.push({ cls: c.id, name: fn, sub: subName, q, score });
      }

      if (newStudents.length) {
        const { error } = await supabase.from("students").insert(newStudents);
        if (error) throw error;
      }

      const { data: allStu } = await supabase.from("students").select("*").eq("active", true);
      const stuMap = new Map(
        (allStu || []).map((s) => [`${s.class_id}|${(s.first_name || "").toLowerCase()}`, s.id])
      );

      const gRows = pending
        .map((p) => {
          const sid = stuMap.get(`${p.cls}|${p.name.toLowerCase()}`);
          const sub = subByName.get(p.sub.toLowerCase());
          if (!sid || !sub) return null;
          return {
            owner_id: profile.id,
            student_id: sid,
            subject_id: sub.id,
            school_year: YEAR,
            quarter: p.q,
            score: p.score,
          };
        })
        .filter(Boolean) as Record<string, unknown>[];

      for (let i = 0; i < gRows.length; i += 300) {
        const { error } = await supabase
          .from("grades")
          .upsert(gRows.slice(i, i + 300), {
            onConflict: "student_id,subject_id,school_year,quarter",
          });
        if (error) throw error;
      }

      show(
        `${gRows.length} дүн импортлогдлоо` +
          (missing.size ? ` · олдоогүй: ${[...missing].slice(0, 3).join(", ")}` : "")
      );
      load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Импортлоход алдаа гарлаа", false);
    }
  }

  function exportXlsx() {
    // 1) Сонгосон ангийн матриц
    const head: (string | number | null)[] = ["№", "Сурагчийн нэр"];
    subjects.forEach((s) => head.push(s.name));
    head.push("Дундаж", "Үнэлгээ");

    const matrix: (string | number | null)[][] = [
      [`${classes.find((c) => c.id === selClass)?.name || ""} анги — ${quarter}-р улирлын дүн`],
      [profile.school_name || ""],
      [],
      head,
    ];
    classStudents.forEach((st, i) => {
      const row: (string | number | null)[] = [i + 1, `${st.last_name || ""} ${st.first_name}`.trim()];
      const vals: number[] = [];
      subjects.forEach((s) => {
        const v = valueOf(st.id, s.id);
        row.push(v ?? "");
        if (v != null) vals.push(v);
      });
      const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
      row.push(avg ?? "", letterOf(avg));
      matrix.push(row);
    });

    // 2) Сургуулийн нэгдсэн (бүх анги)
    const school: (string | number | null)[][] = [
      [`СУРГУУЛИЙН ДҮНГИЙН НЭГДСЭН МАТРИЦ — ${quarter}-р улирал`],
      [],
      ["Анги", "Сурагчийн тоо", ...subjects.map((s) => s.name), "Ангийн дундаж"],
    ];
    for (const c of classes) {
      const sts = students.filter((s) => s.class_id === c.id);
      if (!sts.length) continue;
      const row: (string | number | null)[] = [c.name, sts.length];
      const all: number[] = [];
      for (const s of subjects) {
        const vals = sts
          .map((st) => gradeMap.get(`${st.id}|${s.id}|${quarter}`)?.score)
          .filter((v) => v != null)
          .map(Number);
        const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
        row.push(avg ?? "");
        all.push(...vals);
      }
      row.push(all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10 : "");
      school.push(row);
    }

    // 3) Түүхий өгөгдөл (загварын бүтэц)
    const raw: (string | number | null)[][] = [["Анги", "Сурагч", "Судлагдахуун", "Улирал", "Дүн"]];
    for (const g of grades) {
      const st = students.find((s) => s.id === g.student_id);
      if (!st) continue;
      raw.push([
        classes.find((c) => c.id === st.class_id)?.name || "",
        `${st.last_name || ""}.${st.first_name}`.replace(/^\./, ""),
        subjects.find((s) => s.id === g.subject_id)?.name || "",
        g.quarter,
        g.score,
      ]);
    }

    exportSheets(
      [
        { name: "Ангийн матриц", rows: matrix, cols: [4, 24, ...subjects.map(() => 12), 10, 10] },
        { name: "Сургуулийн нэгдсэн", rows: school, cols: [10, 13, ...subjects.map(() => 12), 14] },
        { name: "Дүнгийн жагсаалт", rows: raw, cols: [10, 24, 22, 9, 8] },
      ],
      "Дүнгийн-матриц"
    );
    show("Excel файл татагдлаа");
  }

  const stats = useMemo(() => {
    const qg = grades.filter((g) => g.quarter === quarter && g.score != null);
    const avg = qg.length
      ? Math.round((qg.reduce((s, g) => s + Number(g.score), 0) / qg.length) * 10) / 10
      : 0;
    const fails = qg.filter((g) => Number(g.score) < 60).length;
    return { total: qg.length, avg, fails, quality: qg.length ? Math.round((qg.filter((g) => Number(g.score) >= 80).length / qg.length) * 100) : 0 };
  }, [grades, quarter]);

  return (
    <Shell
      profile={profile}
      title="Дүнгийн нэгдсэн матриц"
      subtitle={`${YEAR} · ${quarter}-р улирал`}
      actions={
        <>
          <label className="btn-ghost btn-sm cursor-pointer">
            Excel импорт
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importXlsx(f);
                e.target.value = "";
              }}
            />
          </label>
          <button onClick={exportXlsx} className="btn-ghost btn-sm">
            Excel татах
          </button>
          <button onClick={saveGrades} disabled={saving || dirty.size === 0} className="btn-primary btn-sm">
            {saving ? "Хадгалж байна…" : `Хадгалах${dirty.size ? ` (${dirty.size})` : ""}`}
          </button>
        </>
      }
    >
      {node}

      {loading ? (
        <Loading />
      ) : classes.length === 0 || subjects.length === 0 ? (
        <Empty
          icon="📊"
          title="Анги эсвэл хичээл бүртгээгүй байна"
          desc="Тохиргоо хэсэгт анги, судлагдахуунаа оруулсны дараа дүн бүртгэх боломжтой."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Бүртгэсэн дүн" value={stats.total} icon="📊" tone="geo" />
            <StatCard label="Дундаж оноо" value={stats.avg || "—"} icon="📈" tone="aqua" />
            <StatCard label="Чанарын хувь" value={`${stats.quality}%`} sub="80-аас дээш" icon="⭐" tone="sun" />
            <StatCard label="Амжилтгүй" value={stats.fails} sub="60-аас доош" icon="⚠️" tone="amber" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select className="input max-w-[160px]" value={selClass} onChange={(e) => setSelClass(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} анги</option>
              ))}
            </select>

            <div className="flex gap-1 rounded-xl border border-[#dbe6ea] bg-white p-1">
              {QUARTERS.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    if (dirty.size && !confirm("Хадгалаагүй дүн байна. Үргэлжлүүлэх үү?")) return;
                    setDirty(new Map());
                    setQuarter(q);
                  }}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                    quarter === q ? "bg-geo-500 text-white shadow-soft" : "text-ink-500 hover:bg-ink-50"
                  }`}
                >
                  {q}-р улирал
                </button>
              ))}
            </div>

            <button onClick={() => setStuModal({ class_id: selClass, first_name: "" })} className="btn-ghost btn-sm">
              + Сурагч
            </button>
            <button onClick={() => setBulkStu(true)} className="btn-ghost btn-sm">
              Жагсаалтаар нэмэх
            </button>
          </div>

          {classStudents.length === 0 ? (
            <Empty
              icon="🧑‍🎓"
              title="Энэ ангид сурагч бүртгээгүй байна"
              desc="Сурагчдын нэрийг нэг бүрчлэн эсвэл жагсаалтаар нэмнэ үү."
              action={
                <button onClick={() => setBulkStu(true)} className="btn-primary">
                  Жагсаалтаар нэмэх
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-ink-50/60">
                    <th className="sticky left-0 z-10 border-b border-r border-[#dbe6ea] bg-ink-50 px-3 py-2 text-left text-[11px] font-bold uppercase text-ink-500">
                      Сурагч
                    </th>
                    {subjects.map((s) => (
                      <th
                        key={s.id}
                        className="border-b border-[#dbe6ea] px-1 py-2 text-center text-[10px] font-bold text-ink-500"
                        title={s.name}
                      >
                        <div
                          className="mx-auto mb-1 h-1 w-8 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="block max-w-[64px] truncate">{s.name}</span>
                      </th>
                    ))}
                    <th className="border-b border-l border-[#dbe6ea] px-2 py-2 text-center text-[10px] font-bold text-ink-500">
                      Дундаж
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9f0f2]">
                  {classStudents.map((st, i) => {
                    const vals = subjects
                      .map((s) => valueOf(st.id, s.id))
                      .filter((v) => v != null) as number[];
                    const avg = vals.length
                      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
                      : null;
                    return (
                      <tr key={st.id} className="hover:bg-geo-50/30">
                        <td className="sticky left-0 z-10 border-r border-[#dbe6ea] bg-white px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-ink-300">{i + 1}</span>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-semibold text-ink-900">
                                {st.last_name ? `${st.last_name.charAt(0)}.` : ""}
                                {st.first_name}
                              </div>
                            </div>
                            <button
                              onClick={() => setStuModal(st)}
                              className="ml-auto text-[10px] text-ink-300 hover:text-geo-600"
                            >
                              ✎
                            </button>
                          </div>
                        </td>
                        {subjects.map((s) => {
                          const v = valueOf(st.id, s.id);
                          const k = key(st.id, s.id);
                          return (
                            <td key={s.id} className="p-0.5 text-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={v ?? ""}
                                onChange={(e) => setCell(st.id, s.id, e.target.value)}
                                className={`h-8 w-14 rounded-md border text-center text-xs font-bold outline-none transition focus:ring-2 focus:ring-geo-200 ${
                                  dirty.has(k)
                                    ? "border-geo-400 bg-geo-50"
                                    : v != null
                                      ? `border-transparent ${scoreColor(v)}`
                                      : "border-[#e2edf0] bg-white"
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="border-l border-[#dbe6ea] px-2 py-1.5 text-center">
                          {avg != null && (
                            <span className={`badge ${scoreColor(avg)}`}>
                              {avg} · {letterOf(avg)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-[#c9dbe0] bg-ink-50/60">
                  <tr>
                    <td className="sticky left-0 z-10 border-r border-[#dbe6ea] bg-ink-50 px-3 py-2 text-[11px] font-black text-ink-700">
                      Хичээлийн дундаж
                    </td>
                    {subjects.map((s) => {
                      const vals = classStudents
                        .map((st) => valueOf(st.id, s.id))
                        .filter((v) => v != null) as number[];
                      const avg = vals.length
                        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
                        : null;
                      return (
                        <td key={s.id} className="px-1 py-2 text-center text-[11px] font-bold text-ink-700">
                          {avg ?? "—"}
                        </td>
                      );
                    })}
                    <td className="border-l border-[#dbe6ea]" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {dirty.size > 0 && (
            <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
              <button onClick={saveGrades} disabled={saving} className="btn-primary shadow-lift">
                {saving ? "Хадгалж байна…" : `💾 ${dirty.size} өөрчлөлт хадгалах`}
              </button>
            </div>
          )}

          {/* Сургуулийн нэгдсэн харагдац */}
          <div className="card-pad">
            <SectionHead
              title="Сургуулийн нэгдсэн"
              desc={`${quarter}-р улирлын анги тус бүрийн дундаж`}
            />
            <div className="table-wrap">
              <table className="w-full min-w-[600px]">
                <thead className="border-b border-[#dbe6ea] bg-ink-50/50">
                  <tr>
                    <th className="th">Анги</th>
                    <th className="th text-center">Сурагч</th>
                    <th className="th text-center">Бүртгэсэн дүн</th>
                    <th className="th text-center">Дундаж</th>
                    <th className="th text-center">Чанар</th>
                    <th className="th text-center">Амжилт</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9f0f2]">
                  {classes.map((c) => {
                    const sts = students.filter((s) => s.class_id === c.id);
                    const gs = grades.filter(
                      (g) => g.quarter === quarter && sts.some((s) => s.id === g.student_id) && g.score != null
                    );
                    if (!sts.length) return null;
                    const avg = gs.length
                      ? Math.round((gs.reduce((s, g) => s + Number(g.score), 0) / gs.length) * 10) / 10
                      : null;
                    const quality = gs.length
                      ? Math.round((gs.filter((g) => Number(g.score) >= 80).length / gs.length) * 100)
                      : 0;
                    const pass = gs.length
                      ? Math.round((gs.filter((g) => Number(g.score) >= 60).length / gs.length) * 100)
                      : 0;
                    return (
                      <tr
                        key={c.id}
                        className={`cursor-pointer hover:bg-ink-50/40 ${c.id === selClass ? "bg-geo-50/50" : ""}`}
                        onClick={() => setSelClass(c.id)}
                      >
                        <td className="td font-semibold">{c.name}</td>
                        <td className="td text-center">{sts.length}</td>
                        <td className="td text-center text-ink-500">{gs.length}</td>
                        <td className="td text-center">
                          {avg != null ? (
                            <span className={`badge ${scoreColor(avg)}`}>{avg}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="td text-center">{quality}%</td>
                        <td className="td text-center">{pass}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Сурагч ---------- */}
      <Modal
        open={!!stuModal}
        onClose={() => setStuModal(null)}
        title={stuModal?.id ? "Сурагч засах" : "Сурагч нэмэх"}
        footer={
          <>
            {stuModal?.id && (
              <button
                className="btn-danger mr-auto"
                onClick={() => {
                  if (!confirm("Сурагчийг устгах уу? Дүн нь хамт устана.")) return;
                  supabase
                    .from("students")
                    .delete()
                    .eq("id", stuModal.id!)
                    .then(() => {
                      setStuModal(null);
                      load();
                    });
                }}
              >
                Устгах
              </button>
            )}
            <button className="btn-ghost" onClick={() => setStuModal(null)}>Болих</button>
            <button className="btn-primary" disabled={saving} onClick={saveStudent}>
              Хадгалах
            </button>
          </>
        }
      >
        {stuModal && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Овог">
              <input
                className="input"
                value={stuModal.last_name || ""}
                onChange={(e) => setStuModal({ ...stuModal, last_name: e.target.value })}
              />
            </Field>
            <Field label="Нэр *">
              <input
                className="input"
                value={stuModal.first_name || ""}
                onChange={(e) => setStuModal({ ...stuModal, first_name: e.target.value })}
              />
            </Field>
            <Field label="Анги">
              <select
                className="input"
                value={stuModal.class_id || selClass}
                onChange={(e) => setStuModal({ ...stuModal, class_id: e.target.value })}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Хүйс">
              <select
                className="input"
                value={stuModal.gender || ""}
                onChange={(e) => setStuModal({ ...stuModal, gender: e.target.value })}
              >
                <option value="">—</option>
                <option value="Эр">Эрэгтэй</option>
                <option value="Эм">Эмэгтэй</option>
              </select>
            </Field>
          </div>
        )}
      </Modal>

      {/* ---------- Жагсаалтаар нэмэх ---------- */}
      <Modal
        open={bulkStu}
        onClose={() => setBulkStu(false)}
        title="Сурагчдыг жагсаалтаар нэмэх"
        subtitle={`${classes.find((c) => c.id === selClass)?.name || ""} анги — мөр тутамд нэг сурагч`}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setBulkStu(false)}>Болих</button>
            <button className="btn-primary" disabled={saving} onClick={saveBulkStudents}>
              Нэмэх
            </button>
          </>
        }
      >
        <Field label="Сурагчдын нэр" hint="Жишээ: А.Анударь — овог, нэрийг цэг эсвэл зайгаар тусгаарлана">
          <textarea
            className="input min-h-[220px] font-mono text-sm"
            placeholder={"А.Анударь\nБ.Болор\nД.Дулмаа"}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
        </Field>
      </Modal>
    </Shell>
  );
}
