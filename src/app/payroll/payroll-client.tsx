"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/shell";
import { Field, Loading, Modal, SectionHead, StatCard, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { exportSheets } from "@/lib/excel";
import { calcPayroll, workDaysInMonth } from "@/lib/payroll";
import {
  MONTH_ORDER,
  MONTH_ROMAN,
  fullName,
  money,
  type PayrollMonth,
  type PayrollSettings,
  type Profile,
  type Teacher,
  type TeachingLoad,
} from "@/lib/types";

const YEAR = "2025-2026";

export default function PayrollClient({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const { show, node } = useToast();

  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loads, setLoads] = useState<TeachingLoad[]>([]);
  const [months, setMonths] = useState<PayrollMonth[]>([]);
  const [settings, setSettings] = useState<PayrollSettings | null>(null);

  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);
  const [detail, setDetail] = useState<Teacher | null>(null);
  const [edit, setEdit] = useState<Partial<PayrollMonth> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, l, m, s] = await Promise.all([
      supabase.from("teachers").select("*").eq("active", true).order("last_name"),
      supabase.from("teaching_loads").select("*"),
      supabase.from("payroll_months").select("*").eq("school_year", YEAR),
      supabase.from("payroll_settings").select("*").maybeSingle(),
    ]);
    setTeachers((t.data || []) as Teacher[]);
    setLoads((l.data || []) as TeachingLoad[]);
    setMonths((m.data || []) as PayrollMonth[]);
    setSettings(
      (s.data as PayrollSettings) || {
        id: "",
        owner_id: profile.id,
        school_year: YEAR,
        overtime_multiplier: 1.5,
        homeroom_bonus: 0,
        room_bonus: 0,
        zan_bonus: 0,
        skill_bonus_pct: 0,
        rank_bonus_argach: 0,
        rank_bonus_terguuleh: 0,
        rank_bonus_zovloh: 0,
        ndsh_pct: 11.5,
        hhoat_pct: 10,
        hhoat_deduction: 20000,
      }
    );
    setLoading(false);
  }, [supabase, profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  const weeklyOf = useCallback(
    (tid: string) =>
      loads.filter((l) => l.teacher_id === tid).reduce((s, l) => s + Number(l.hours_per_week), 0),
    [loads]
  );

  const rowOf = useCallback(
    (tid: string, month: number): Partial<PayrollMonth> =>
      months.find((m) => m.teacher_id === tid && m.month === month) || {
        teacher_id: tid,
        month,
        school_year: YEAR,
      },
    [months]
  );

  const results = useMemo(() => {
    if (!settings) return new Map<string, ReturnType<typeof calcPayroll>>();
    const m = new Map<string, ReturnType<typeof calcPayroll>>();
    for (const t of teachers) m.set(t.id, calcPayroll(rowOf(t.id, selMonth), t, settings));
    return m;
  }, [teachers, settings, selMonth, rowOf]);

  const totals = useMemo(() => {
    let gross = 0, net = 0, ndsh = 0, hhoat = 0;
    for (const r of results.values()) {
      gross += r.gross; net += r.net; ndsh += r.ndsh; hhoat += r.hhoat;
    }
    return { gross, net, ndsh, hhoat };
  }, [results]);

  /** Хуваариас автоматаар сарын цагийг тооцоолж бөглөх */
  async function autofill() {
    if (!confirm(`${MONTH_ROMAN[selMonth]} сарын цагийг хуваариас автоматаар бөглөх үү?`))
      return;
    const year = selMonth >= 9 ? 2025 : 2026;
    const wd = workDaysInMonth(year, selMonth);
    const weeks = wd / 5;

    const rows = teachers.map((t) => {
      const weekly = weeklyOf(t.id);
      const existing = months.find((m) => m.teacher_id === t.id && m.month === selMonth);
      return {
        ...(existing?.id ? { id: existing.id } : {}),
        owner_id: profile.id,
        teacher_id: t.id,
        school_year: YEAR,
        month: selMonth,
        month_label: MONTH_ROMAN[selMonth],
        work_days: wd,
        work_hours: wd * 8,
        actual_days: existing?.actual_days ?? wd,
        actual_hours: existing?.actual_hours ?? wd * 8,
        taught_hours: Math.round(weekly * weeks * 10) / 10,
        sha_program_hours: existing?.sha_program_hours ?? 0,
        sha_improve_hours: existing?.sha_improve_hours ?? 0,
        sha_other_hours: existing?.sha_other_hours ?? 0,
        sha_teach_hours: existing?.sha_teach_hours ?? 0,
        substitute_hours: existing?.substitute_hours ?? 0,
        overtime_hours: existing?.overtime_hours ?? 0,
      };
    });

    const { error } = await supabase
      .from("payroll_months")
      .upsert(rows, { onConflict: "teacher_id,school_year,month" });
    if (error) return show(error.message, false);
    show(`${MONTH_ROMAN[selMonth]} сарын цаг бөглөгдлөө (${wd} ажлын өдөр)`);
    load();
  }

  async function saveRow() {
    if (!edit?.teacher_id) return;
    setSaving(true);
    const payload = {
      owner_id: profile.id,
      teacher_id: edit.teacher_id,
      school_year: YEAR,
      month: edit.month || selMonth,
      month_label: MONTH_ROMAN[edit.month || selMonth],
      work_days: Number(edit.work_days || 0),
      work_hours: Number(edit.work_hours || 0),
      actual_days: Number(edit.actual_days || 0),
      actual_hours: Number(edit.actual_hours || 0),
      sha_program_hours: Number(edit.sha_program_hours || 0),
      sha_improve_hours: Number(edit.sha_improve_hours || 0),
      sha_other_hours: Number(edit.sha_other_hours || 0),
      sha_teach_hours: Number(edit.sha_teach_hours || 0),
      taught_hours: Number(edit.taught_hours || 0),
      substitute_hours: Number(edit.substitute_hours || 0),
      overtime_hours: Number(edit.overtime_hours || 0),
      bonus_homeroom: edit.bonus_homeroom != null ? Number(edit.bonus_homeroom) : null,
      bonus_room: edit.bonus_room != null ? Number(edit.bonus_room) : null,
      bonus_zan: Number(edit.bonus_zan || 0),
      bonus_skill: edit.bonus_skill != null ? Number(edit.bonus_skill) : null,
      bonus_rank: edit.bonus_rank != null ? Number(edit.bonus_rank) : null,
      vacation_amount: Number(edit.vacation_amount || 0),
      deduction_other: Number(edit.deduction_other || 0),
      note: edit.note || null,
    };
    const { error } = await supabase
      .from("payroll_months")
      .upsert(payload, { onConflict: "teacher_id,school_year,month" });
    setSaving(false);
    if (error) return show(error.message, false);
    show("Хадгалагдлаа");
    setEdit(null);
    load();
  }

  function exportXlsx() {
    if (!settings) return;

    // 1) Сонгосон сарын цалингийн хүснэгт
    const salary: (string | number | null)[][] = [
      [`${profile.school_name || "СУРГУУЛЬ"} — ${MONTH_ROMAN[selMonth]} сарын цалингийн тооцоо`],
      [`Хичээлийн жил: ${YEAR}`],
      [],
      [
        "№", "Багшийн нэр", "Зэрэг", "Үндсэн цалин", "Заасан цаг", "Орлон заасан",
        "Илүү цаг", "СХА цаг", "Хичээлийн хөлс", "Орлон хөлс", "Илүү цагийн хөлс",
        "СХА хөлс", "Анги даалт", "Кабинет", "ЗАН", "Ур чадвар", "Зэргийн нэмэгдэл",
        "НИЙТ", "НДШ", "ХХОАТ", "Бусад суутгал", "ГАРТ ОЛГОХ",
      ],
    ];
    teachers.forEach((t, i) => {
      const r = results.get(t.id)!;
      const m = rowOf(t.id, selMonth);
      salary.push([
        i + 1, fullName(t), t.rank === "Байхгүй" ? "" : t.rank,
        Number(t.base_salary || 0),
        Number(m.taught_hours || 0), Number(m.substitute_hours || 0),
        Number(m.overtime_hours || 0),
        Number(m.sha_program_hours || 0) + Number(m.sha_improve_hours || 0) + Number(m.sha_other_hours || 0),
        Math.round(r.teachingPay), Math.round(r.substitutePay), Math.round(r.overtimePay),
        Math.round(r.shaPay), Math.round(r.bonusBreakdown.homeroom), Math.round(r.bonusBreakdown.room),
        Math.round(r.bonusBreakdown.zan), Math.round(r.bonusBreakdown.skill), Math.round(r.bonusBreakdown.rank),
        Math.round(r.gross), Math.round(r.ndsh), Math.round(r.hhoat),
        Math.round(r.otherDeduction), Math.round(r.net),
      ]);
    });
    salary.push([]);
    salary.push(["", "НИЙТ ДҮН", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
      Math.round(totals.gross), Math.round(totals.ndsh), Math.round(totals.hhoat), "", Math.round(totals.net)]);

    // 2) Цагийн тооцооны хуудас (эх Excel-ийн бүтэц)
    const hours: (string | number | null)[][] = [
      [`${profile.school_name || "СУРГУУЛЬ"}-ИЙН БАГШИЙН ЦАГИЙН ТООЦООНЫ ХУУДАС`],
      [`${YEAR} оны хичээлийн жил`],
      [],
      ["Багш", "Сар", "Ажиллах өдөр", "Ажиллах цаг", "Ажилласан өдөр", "Ажилласан цаг",
       "Хөтөлбөр боловсруулах", "Хөтөлбөр сайжруулах", "Бусад ажил", "Хичээл заах цаг",
       "Хичээл заасан цаг", "Орлон заасан цаг", "Илүү цаг",
       "Анги даалт", "Кабинет", "ЗАН", "Ур чадвар", "Зэрэг"],
    ];
    for (const t of teachers) {
      for (const mo of MONTH_ORDER) {
        const m = months.find((x) => x.teacher_id === t.id && x.month === mo);
        if (!m) continue;
        hours.push([
          fullName(t), MONTH_ROMAN[mo],
          m.work_days, m.work_hours, m.actual_days, m.actual_hours,
          m.sha_program_hours, m.sha_improve_hours, m.sha_other_hours, m.sha_teach_hours,
          m.taught_hours, m.substitute_hours, m.overtime_hours,
          m.bonus_homeroom, m.bonus_room, m.bonus_zan, m.bonus_skill, m.bonus_rank,
        ]);
      }
    }

    exportSheets(
      [
        { name: `${MONTH_ROMAN[selMonth]} сар — цалин`, rows: salary,
          cols: [4, 20, 12, 13, 10, 11, 9, 9, 14, 12, 15, 11, 12, 11, 11, 12, 15, 14, 12, 12, 13, 14] },
        { name: "Цагийн тооцоо", rows: hours,
          cols: [20, 6, 12, 12, 13, 13, 16, 16, 12, 14, 15, 15, 10, 11, 10, 9, 11, 9] },
      ],
      "Цалингийн-тооцоо"
    );
    show("Excel файл татагдлаа");
  }

  return (
    <Shell
      profile={profile}
      title="Цагийн тооцоо, цалин"
      subtitle={`${YEAR} оны хичээлийн жил · ${MONTH_ROMAN[selMonth]} сар`}
      actions={
        <>
          <button onClick={autofill} className="btn-ghost btn-sm">
            Хуваариас бөглөх
          </button>
          <button onClick={exportXlsx} className="btn-primary btn-sm">
            Excel татах
          </button>
        </>
      }
    >
      {node}

      {loading || !settings ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Нийт цалин" value={money(totals.gross)} icon="💰" tone="geo" />
            <StatCard label="НДШ" value={money(totals.ndsh)} icon="🏥" tone="aqua" />
            <StatCard label="ХХОАТ" value={money(totals.hhoat)} icon="🧾" tone="amber" />
            <StatCard label="Гарт олгох" value={money(totals.net)} icon="✅" tone="sun" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-ink-400">Сар:</span>
            {MONTH_ORDER.map((m) => (
              <button
                key={m}
                onClick={() => setSelMonth(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  selMonth === m
                    ? "bg-geo-500 text-white shadow-soft"
                    : "border border-[#dbe6ea] bg-white text-ink-500 hover:bg-ink-50"
                }`}
              >
                {MONTH_ROMAN[m]}
              </button>
            ))}
          </div>

          {teachers.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#c9dbe0] bg-white/60 px-6 py-14 text-center text-sm text-ink-400">
              Багш бүртгэгдээгүй байна. Багшийн бүртгэл хэсгээс нэмнэ үү.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="w-full min-w-[1100px]">
                <thead className="border-b border-[#dbe6ea] bg-ink-50/50">
                  <tr>
                    <th className="th">Багш</th>
                    <th className="th text-center">Заасан цаг</th>
                    <th className="th text-center">Орлон</th>
                    <th className="th text-center">Илүү</th>
                    <th className="th text-right">Хичээлийн хөлс</th>
                    <th className="th text-right">Нэмэгдэл</th>
                    <th className="th text-right">Нийт</th>
                    <th className="th text-right">Суутгал</th>
                    <th className="th text-right">Гарт олгох</th>
                    <th className="th text-right">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9f0f2]">
                  {teachers.map((t) => {
                    const r = results.get(t.id)!;
                    const m = rowOf(t.id, selMonth);
                    return (
                      <tr key={t.id} className="hover:bg-ink-50/40">
                        <td className="td">
                          <div className="font-semibold text-ink-900">{fullName(t)}</div>
                          <div className="text-[11px] text-ink-400">
                            {t.rank !== "Байхгүй" ? t.rank : "—"} ·{" "}
                            {money(t.hourly_rate)}/цаг · 7х: {weeklyOf(t.id)}ц
                          </div>
                        </td>
                        <td className="td text-center font-semibold">{m.taught_hours || 0}</td>
                        <td className="td text-center">{m.substitute_hours || 0}</td>
                        <td className="td text-center">{m.overtime_hours || 0}</td>
                        <td className="td text-right">{money(r.teachingPay)}</td>
                        <td className="td text-right text-ink-500">{money(r.bonusTotal)}</td>
                        <td className="td text-right font-bold">{money(r.gross)}</td>
                        <td className="td text-right text-red-600">
                          −{money(r.ndsh + r.hhoat + r.otherDeduction)}
                        </td>
                        <td className="td text-right font-black text-aqua-700">{money(r.net)}</td>
                        <td className="td">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => setDetail(t)} className="btn-ghost btn-sm">
                              Задаргаа
                            </button>
                            <button
                              onClick={() =>
                                setEdit({ ...rowOf(t.id, selMonth), teacher_id: t.id, month: selMonth })
                              }
                              className="btn-soft btn-sm"
                            >
                              Цаг оруулах
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-[#c9dbe0] bg-ink-50/60">
                  <tr>
                    <td className="td font-black">НИЙТ ({teachers.length} багш)</td>
                    <td colSpan={5} />
                    <td className="td text-right font-black">{money(totals.gross)}</td>
                    <td className="td text-right font-black text-red-600">
                      −{money(totals.ndsh + totals.hhoat)}
                    </td>
                    <td className="td text-right font-black text-aqua-700">{money(totals.net)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------- Цаг оруулах ---------- */}
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        wide
        title={`Цагийн тооцоо — ${fullName(teachers.find((t) => t.id === edit?.teacher_id))}`}
        subtitle={`${MONTH_ROMAN[edit?.month || selMonth]} сар · ${YEAR}`}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEdit(null)}>Болих</button>
            <button className="btn-primary" disabled={saving} onClick={saveRow}>
              {saving ? "Хадгалж байна…" : "Хадгалах"}
            </button>
          </>
        }
      >
        {edit && (
          <div className="space-y-5">
            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-400">
                Ажлын цаг
              </h4>
              <div className="grid gap-3 sm:grid-cols-4">
                <NumF label="Ажиллах өдөр" v={edit.work_days} on={(v) => setEdit({ ...edit, work_days: v })} />
                <NumF label="Ажиллах цаг" v={edit.work_hours} on={(v) => setEdit({ ...edit, work_hours: v })} />
                <NumF label="Ажилласан өдөр" v={edit.actual_days} on={(v) => setEdit({ ...edit, actual_days: v })} />
                <NumF label="Ажилласан цаг" v={edit.actual_hours} on={(v) => setEdit({ ...edit, actual_hours: v })} />
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-400">
                СХА — сургалтын хөтөлбөрийн ажил
              </h4>
              <div className="grid gap-3 sm:grid-cols-4">
                <NumF label="Хөтөлбөр боловсруулах" v={edit.sha_program_hours} on={(v) => setEdit({ ...edit, sha_program_hours: v })} />
                <NumF label="Хөтөлбөр сайжруулах" v={edit.sha_improve_hours} on={(v) => setEdit({ ...edit, sha_improve_hours: v })} />
                <NumF label="Бусад ажил" v={edit.sha_other_hours} on={(v) => setEdit({ ...edit, sha_other_hours: v })} />
                <NumF label="Хичээл заах цаг" v={edit.sha_teach_hours} on={(v) => setEdit({ ...edit, sha_teach_hours: v })} />
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-400">
                Хичээлийн цаг
              </h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <NumF label="Хичээл заасан цаг" v={edit.taught_hours} on={(v) => setEdit({ ...edit, taught_hours: v })} />
                <NumF label="Орлон заасан цаг" v={edit.substitute_hours} on={(v) => setEdit({ ...edit, substitute_hours: v })} />
                <NumF label="Илүү цаг" v={edit.overtime_hours} on={(v) => setEdit({ ...edit, overtime_hours: v })} />
              </div>
            </div>

            <div>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">
                Нэмэгдэл хөлс
              </h4>
              <p className="mb-3 text-[11px] text-ink-400">
                Хоосон орхивол Тохиргоо хэсэгт заасан утгаар автоматаар бодогдоно
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <NumF label="Анги даалт (₮)" v={edit.bonus_homeroom} on={(v) => setEdit({ ...edit, bonus_homeroom: v })} />
                <NumF label="Кабинет (₮)" v={edit.bonus_room} on={(v) => setEdit({ ...edit, bonus_room: v })} />
                <NumF label="ЗАН (₮)" v={edit.bonus_zan} on={(v) => setEdit({ ...edit, bonus_zan: v })} />
                <NumF label="Ур чадвар (₮)" v={edit.bonus_skill} on={(v) => setEdit({ ...edit, bonus_skill: v })} />
                <NumF label="Зэргийн нэмэгдэл (₮)" v={edit.bonus_rank} on={(v) => setEdit({ ...edit, bonus_rank: v })} />
                <NumF label="Амралтын олговор (₮)" v={edit.vacation_amount} on={(v) => setEdit({ ...edit, vacation_amount: v })} />
                <NumF label="Бусад суутгал (₮)" v={edit.deduction_other} on={(v) => setEdit({ ...edit, deduction_other: v })} />
              </div>
            </div>

            <Field label="Тэмдэглэл">
              <input
                className="input"
                value={edit.note || ""}
                onChange={(e) => setEdit({ ...edit, note: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>

      {/* ---------- Задаргаа ---------- */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={`Цалингийн задаргаа — ${fullName(detail)}`}
        subtitle={`${MONTH_ROMAN[selMonth]} сар · ${YEAR}`}
      >
        {detail && settings && (
          <div className="space-y-1">
            {calcPayroll(rowOf(detail.id, selMonth), detail, settings).lines.map((l, i) => (
              <div
                key={i}
                className={`flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm ${
                  l.kind === "info"
                    ? "bg-geo-50 font-black text-geo-800"
                    : l.kind === "sub"
                      ? "text-red-600"
                      : "text-ink-700"
                }`}
              >
                <span className={l.kind === "info" ? "" : "text-[13px]"}>{l.label}</span>
                <span className="whitespace-nowrap font-semibold">
                  {l.kind === "sub" ? "−" : ""}
                  {money(l.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </Shell>
  );
}

function NumF({
  label,
  v,
  on,
}: {
  label: string;
  v: number | null | undefined;
  on: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        className="input"
        type="number"
        step="0.5"
        value={v ?? ""}
        placeholder="0"
        onChange={(e) => on(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </Field>
  );
}
