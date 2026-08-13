"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/shell";
import { Field, Loading, SectionHead, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { periodTimes } from "@/lib/scheduler";
import type {
  ClassRoom,
  PayrollSettings,
  Profile,
  Room,
  ShiftSetting,
  Subject,
} from "@/lib/types";

type Tab = "subjects" | "classes" | "rooms" | "shifts" | "payroll";

const TABS: { k: Tab; label: string; icon: string }[] = [
  { k: "subjects", label: "Судлагдахуун", icon: "📚" },
  { k: "classes", label: "Анги", icon: "🏫" },
  { k: "rooms", label: "Кабинет", icon: "🚪" },
  { k: "shifts", label: "Ээлж, цагийн хуваарь", icon: "⏰" },
  { k: "payroll", label: "Цалингийн тохиргоо", icon: "💰" },
];

export default function SettingsClient({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const { show, node } = useToast();
  const [tab, setTab] = useState<Tab>("subjects");
  const [loading, setLoading] = useState(true);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [shifts, setShifts] = useState<ShiftSetting[]>([]);
  const [pay, setPay] = useState<Partial<PayrollSettings>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [s, c, r, sh, p] = await Promise.all([
      supabase.from("subjects").select("*").order("department").order("name"),
      supabase.from("classes").select("*").order("grade").order("name"),
      supabase.from("rooms").select("*").order("name"),
      supabase.from("shift_settings").select("*").order("shift"),
      supabase.from("payroll_settings").select("*").maybeSingle(),
    ]);
    setSubjects((s.data || []) as Subject[]);
    setClasses((c.data || []) as ClassRoom[]);
    setRooms((r.data || []) as Room[]);
    setShifts((sh.data || []) as ShiftSetting[]);
    setPay(
      (p.data as PayrollSettings) || {
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
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<{ error: unknown }>, ok: string) {
    const { error } = await fn();
    if (error) show((error as { message?: string }).message || "Алдаа гарлаа", false);
    else {
      show(ok);
      load();
    }
  }

  return (
    <Shell
      profile={profile}
      title="Тохиргоо"
      subtitle="Судлагдахуун, анги, кабинет, ээлж, цалингийн үзүүлэлт"
    >
      {node}

      <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-[#d7e8e6] bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              tab === t.k
                ? "bg-teal-500 text-white shadow-soft"
                : "text-ink-500 hover:bg-ink-50"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : (
        <>
          {tab === "subjects" && (
            <SubjectsTab
              subjects={subjects}
              ownerId={profile.id}
              supabase={supabase}
              run={run}
            />
          )}
          {tab === "classes" && (
            <ClassesTab classes={classes} ownerId={profile.id} supabase={supabase} run={run} />
          )}
          {tab === "rooms" && (
            <RoomsTab rooms={rooms} ownerId={profile.id} supabase={supabase} run={run} />
          )}
          {tab === "shifts" && (
            <ShiftsTab shifts={shifts} ownerId={profile.id} supabase={supabase} run={run} />
          )}
          {tab === "payroll" && (
            <PayrollTab
              pay={pay}
              setPay={setPay}
              ownerId={profile.id}
              supabase={supabase}
              run={run}
            />
          )}
        </>
      )}
    </Shell>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = ReturnType<typeof createClient>;
type Run = (fn: () => Promise<{ error: unknown }>, ok: string) => Promise<void>;

// ====================================================================
// СУДЛАГДАХУУН
// ====================================================================
function SubjectsTab({
  subjects,
  ownerId,
  supabase,
  run,
}: {
  subjects: Subject[];
  ownerId: string;
  supabase: Sb;
  run: Run;
}) {
  const [f, setF] = useState({
    name: "",
    department: "",
    color: "#008080",
    is_subgroup: false,
    allow_shared_room: false,
    is_elective: false,
  });

  return (
    <div className="space-y-5">
      <div className="card-pad">
        <SectionHead
          title="Судлагдахуун нэмэх"
          desc="Под группээр хуваагддаг (Англи хэл, технологи) болон заал хуваалцдаг (биеийн тамир) хичээлийг тэмдэглэнэ"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Хичээлийн нэр">
            <input className="input" placeholder="Математик" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Судлагдахууны нэгдэл">
            <input className="input" placeholder="Математик, МТ" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} />
          </Field>
          <Field label="Өнгө">
            <input className="input h-[42px] p-1" type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <button
              className="btn-primary w-full"
              onClick={() => {
                if (!f.name.trim()) return;
                run(
                  () =>
                    supabase.from("subjects").insert({ ...f, owner_id: ownerId, name: f.name.trim() }) as any,
                  "Хичээл нэмэгдлээ"
                ).then(() => setF({ ...f, name: "" }));
              }}
            >
              + Нэмэх
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-5 rounded-xl bg-ink-50 p-4 text-sm font-semibold text-ink-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-teal-500" checked={f.is_subgroup} onChange={(e) => setF({ ...f, is_subgroup: e.target.checked })} />
            Под группээр хуваагдана (зэрэгцэж орно)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-seafoam-500" checked={f.allow_shared_room} onChange={(e) => setF({ ...f, allow_shared_room: e.target.checked })} />
            Нэг зааланд 2 анги зэрэг орж болно
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-coral-500" checked={f.is_elective} onChange={(e) => setF({ ...f, is_elective: e.target.checked })} />
            Сонгон судлах
          </label>
        </div>
      </div>

      <div className="table-wrap">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-[#d7e8e6] bg-ink-50/50">
            <tr>
              <th className="th">Өнгө</th>
              <th className="th">Хичээл</th>
              <th className="th">Нэгдэл</th>
              <th className="th text-center">Под групп</th>
              <th className="th text-center">Заал хуваалцах</th>
              <th className="th text-center">Сонгон</th>
              <th className="th text-right">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6f1ef]">
            {subjects.map((s) => (
              <tr key={s.id} className="hover:bg-ink-50/40">
                <td className="td">
                  <span className="inline-block h-5 w-5 rounded-md" style={{ backgroundColor: s.color }} />
                </td>
                <td className="td font-semibold">{s.name}</td>
                <td className="td text-xs text-ink-500">{s.department || "—"}</td>
                <td className="td text-center">{s.is_subgroup ? "✓" : ""}</td>
                <td className="td text-center">{s.allow_shared_room ? "✓" : ""}</td>
                <td className="td text-center">{s.is_elective ? "✓" : ""}</td>
                <td className="td text-right">
                  <button
                    className="btn-danger btn-sm"
                    onClick={() =>
                      confirm(`${s.name} хичээлийг устгах уу?`) &&
                      run(() => supabase.from("subjects").delete().eq("id", s.id) as any, "Устлаа")
                    }
                  >
                    Устгах
                  </button>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr><td colSpan={7} className="td py-10 text-center text-ink-400">Хичээл бүртгээгүй байна</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ====================================================================
// АНГИ
// ====================================================================
function ClassesTab({
  classes,
  ownerId,
  supabase,
  run,
}: {
  classes: ClassRoom[];
  ownerId: string;
  supabase: Sb;
  run: Run;
}) {
  const [f, setF] = useState({ grade: 6, section: "а", shift: 1, student_count: 28 });
  const [bulk, setBulk] = useState({ from: 1, to: 12, sections: "а,б,в", shift: 1 });

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card-pad">
          <SectionHead title="Анги нэмэх" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Түвшин">
              <input className="input" type="number" min={1} max={12} value={f.grade} onChange={(e) => setF({ ...f, grade: Number(e.target.value) })} />
            </Field>
            <Field label="Бүлэг">
              <input className="input" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} />
            </Field>
            <Field label="Ээлж">
              <select className="input" value={f.shift} onChange={(e) => setF({ ...f, shift: Number(e.target.value) })}>
                <option value={1}>1-р ээлж</option>
                <option value={2}>2-р ээлж</option>
                <option value={3}>3-р ээлж</option>
              </select>
            </Field>
            <Field label="Сурагчийн тоо">
              <input className="input" type="number" min={0} value={f.student_count} onChange={(e) => setF({ ...f, student_count: Number(e.target.value) })} />
            </Field>
          </div>
          <button
            className="btn-primary mt-3 w-full"
            onClick={() =>
              run(
                () =>
                  supabase.from("classes").insert({
                    owner_id: ownerId,
                    name: `${f.grade}${f.section}`,
                    grade: f.grade,
                    section: f.section,
                    shift: f.shift,
                    student_count: f.student_count,
                  }) as any,
                "Анги нэмэгдлээ"
              )
            }
          >
            + Нэмэх
          </button>
        </div>

        <div className="card-pad">
          <SectionHead title="Багцаар үүсгэх" desc="Олон ангийг нэг дор үүсгэнэ" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Эхлэх түвшин">
              <input className="input" type="number" min={1} max={12} value={bulk.from} onChange={(e) => setBulk({ ...bulk, from: Number(e.target.value) })} />
            </Field>
            <Field label="Дуусах түвшин">
              <input className="input" type="number" min={1} max={12} value={bulk.to} onChange={(e) => setBulk({ ...bulk, to: Number(e.target.value) })} />
            </Field>
            <Field label="Бүлгүүд (таслалаар)" className="col-span-2">
              <input className="input" value={bulk.sections} onChange={(e) => setBulk({ ...bulk, sections: e.target.value })} />
            </Field>
            <Field label="Ээлж" className="col-span-2">
              <select className="input" value={bulk.shift} onChange={(e) => setBulk({ ...bulk, shift: Number(e.target.value) })}>
                <option value={1}>1-р ээлж</option>
                <option value={2}>2-р ээлж</option>
                <option value={3}>3-р ээлж</option>
              </select>
            </Field>
          </div>
          <button
            className="btn-soft mt-3 w-full"
            onClick={() => {
              const secs = bulk.sections.split(",").map((s) => s.trim()).filter(Boolean);
              const rows: Record<string, unknown>[] = [];
              for (let g = bulk.from; g <= bulk.to; g++)
                for (const s of secs)
                  rows.push({
                    owner_id: ownerId,
                    name: `${g}${s}`,
                    grade: g,
                    section: s,
                    shift: bulk.shift,
                    student_count: 0,
                  });
              if (!rows.length) return;
              run(
                () => supabase.from("classes").upsert(rows, { onConflict: "owner_id,name" }) as any,
                `${rows.length} анги үүслээ`
              );
            }}
          >
            Багцаар үүсгэх
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="w-full min-w-[600px]">
          <thead className="border-b border-[#d7e8e6] bg-ink-50/50">
            <tr>
              <th className="th">Анги</th>
              <th className="th">Түвшин</th>
              <th className="th">Ээлж</th>
              <th className="th">Сурагч</th>
              <th className="th text-right">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6f1ef]">
            {classes.map((c) => (
              <tr key={c.id} className="hover:bg-ink-50/40">
                <td className="td font-semibold">{c.name}</td>
                <td className="td">{c.grade}</td>
                <td className="td">
                  <select
                    className="rounded-lg border border-[#d7e8e6] px-2 py-1 text-xs font-semibold"
                    value={c.shift}
                    onChange={(e) =>
                      run(
                        () =>
                          supabase.from("classes").update({ shift: Number(e.target.value) }).eq("id", c.id) as any,
                        "Ээлж солигдлоо"
                      )
                    }
                  >
                    <option value={1}>1-р ээлж</option>
                    <option value={2}>2-р ээлж</option>
                    <option value={3}>3-р ээлж</option>
                  </select>
                </td>
                <td className="td">{c.student_count || 0}</td>
                <td className="td text-right">
                  <button
                    className="btn-danger btn-sm"
                    onClick={() =>
                      confirm(`${c.name} ангийг устгах уу?`) &&
                      run(() => supabase.from("classes").delete().eq("id", c.id) as any, "Устлаа")
                    }
                  >
                    Устгах
                  </button>
                </td>
              </tr>
            ))}
            {classes.length === 0 && (
              <tr><td colSpan={5} className="td py-10 text-center text-ink-400">Анги бүртгээгүй байна</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ====================================================================
// КАБИНЕТ
// ====================================================================
function RoomsTab({
  rooms,
  ownerId,
  supabase,
  run,
}: {
  rooms: Room[];
  ownerId: string;
  supabase: Sb;
  run: Run;
}) {
  const [f, setF] = useState({ name: "", building: "", capacity: 30, is_hall: false });

  return (
    <div className="space-y-5">
      <div className="card-pad">
        <SectionHead
          title="Кабинет нэмэх"
          desc="«Заал» гэж тэмдэглэсэн танхимд биеийн тамирын 2 анги зэрэг орж болно"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Нэр / дугаар">
            <input className="input" placeholder="205" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Байр / давхар">
            <input className="input" placeholder="II давхар" value={f.building} onChange={(e) => setF({ ...f, building: e.target.value })} />
          </Field>
          <Field label="Багтаамж">
            <input className="input" type="number" min={0} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} />
          </Field>
          <div className="flex items-end gap-3">
            <label className="mb-2.5 flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-ink-700">
              <input type="checkbox" className="h-4 w-4 accent-seafoam-500" checked={f.is_hall} onChange={(e) => setF({ ...f, is_hall: e.target.checked })} />
              Заал
            </label>
            <button
              className="btn-primary flex-1"
              onClick={() => {
                if (!f.name.trim()) return;
                run(
                  () => supabase.from("rooms").insert({ ...f, owner_id: ownerId, name: f.name.trim() }) as any,
                  "Кабинет нэмэгдлээ"
                ).then(() => setF({ ...f, name: "" }));
              }}
            >
              + Нэмэх
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="w-full min-w-[600px]">
          <thead className="border-b border-[#d7e8e6] bg-ink-50/50">
            <tr>
              <th className="th">Кабинет</th>
              <th className="th">Байрлал</th>
              <th className="th">Багтаамж</th>
              <th className="th text-center">Заал</th>
              <th className="th text-right">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6f1ef]">
            {rooms.map((r) => (
              <tr key={r.id} className="hover:bg-ink-50/40">
                <td className="td font-semibold">{r.name}</td>
                <td className="td text-xs text-ink-500">{r.building || "—"}</td>
                <td className="td">{r.capacity || "—"}</td>
                <td className="td text-center">
                  {r.is_hall && <span className="badge bg-seafoam-100 text-seafoam-800">Заал</span>}
                </td>
                <td className="td text-right">
                  <button
                    className="btn-danger btn-sm"
                    onClick={() =>
                      confirm(`${r.name} кабинетийг устгах уу?`) &&
                      run(() => supabase.from("rooms").delete().eq("id", r.id) as any, "Устлаа")
                    }
                  >
                    Устгах
                  </button>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr><td colSpan={5} className="td py-10 text-center text-ink-400">Кабинет бүртгээгүй байна</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ====================================================================
// ЭЭЛЖ
// ====================================================================
function ShiftsTab({
  shifts,
  ownerId,
  supabase,
  run,
}: {
  shifts: ShiftSetting[];
  ownerId: string;
  supabase: Sb;
  run: Run;
}) {
  const [local, setLocal] = useState<ShiftSetting[]>(shifts);
  useEffect(() => setLocal(shifts), [shifts]);

  const defaults = [
    { shift: 1, name: "1-р ээлж (өглөө)", start_time: "08:00" },
    { shift: 2, name: "2-р ээлж (өдөр)", start_time: "13:30" },
    { shift: 3, name: "3-р ээлж (орой)", start_time: "17:30" },
  ];

  return (
    <div className="space-y-5">
      {defaults.map((d) => {
        const s =
          local.find((x) => x.shift === d.shift) ||
          ({
            id: "",
            owner_id: ownerId,
            shift: d.shift,
            name: d.name,
            start_time: d.start_time,
            lesson_minutes: 40,
            break_minutes: 10,
            long_break_after: 3,
            long_break_minutes: 20,
            periods_per_day: 7,
            days_per_week: 5,
            active: d.shift === 1,
          } as ShiftSetting);

        const upd = (patch: Partial<ShiftSetting>) =>
          setLocal((v) => {
            const i = v.findIndex((x) => x.shift === d.shift);
            const next = { ...s, ...patch };
            if (i === -1) return [...v, next];
            const c = [...v];
            c[i] = next;
            return c;
          });

        const times = periodTimes(s);

        return (
          <div key={d.shift} className="card-pad">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-black ${
                    s.active ? "bg-teal-500 text-white" : "bg-ink-100 text-ink-400"
                  }`}
                >
                  {d.shift}
                </span>
                <input
                  className="input max-w-[240px] font-semibold"
                  value={s.name}
                  onChange={(e) => upd({ name: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-teal-500"
                  checked={s.active}
                  onChange={(e) => upd({ active: e.target.checked })}
                />
                Идэвхтэй
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Field label="Эхлэх цаг">
                <input className="input" type="time" value={s.start_time?.slice(0, 5)} onChange={(e) => upd({ start_time: e.target.value })} />
              </Field>
              <Field label="Хичээл (мин)">
                <input className="input" type="number" min={20} max={90} value={s.lesson_minutes} onChange={(e) => upd({ lesson_minutes: Number(e.target.value) })} />
              </Field>
              <Field label="Завсарлага (мин)">
                <input className="input" type="number" min={0} max={40} value={s.break_minutes} onChange={(e) => upd({ break_minutes: Number(e.target.value) })} />
              </Field>
              <Field label="Урт завсарлага дараа">
                <input className="input" type="number" min={0} max={8} value={s.long_break_after ?? 0} onChange={(e) => upd({ long_break_after: Number(e.target.value) })} />
              </Field>
              <Field label="Урт завсарлага (мин)">
                <input className="input" type="number" min={0} max={90} value={s.long_break_minutes ?? 0} onChange={(e) => upd({ long_break_minutes: Number(e.target.value) })} />
              </Field>
              <Field label="Өдрийн цагийн тоо">
                <input className="input" type="number" min={1} max={12} value={s.periods_per_day} onChange={(e) => upd({ periods_per_day: Number(e.target.value) })} />
              </Field>
              <Field label="7 хоногийн өдөр">
                <select className="input" value={s.days_per_week} onChange={(e) => upd({ days_per_week: Number(e.target.value) })}>
                  <option value={5}>5 өдөр (Да–Ба)</option>
                  <option value={6}>6 өдөр (Да–Бя)</option>
                </select>
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {times.map((t) => (
                <span
                  key={t.period}
                  className="rounded-lg border border-[#d7e8e6] bg-ink-50 px-2.5 py-1 text-[11px] font-semibold text-ink-600"
                >
                  <b className="text-teal-600">{t.period}</b> · {t.start}–{t.end}
                </span>
              ))}
            </div>

            <button
              className="btn-primary mt-4"
              onClick={() =>
                run(
                  () =>
                    supabase.from("shift_settings").upsert(
                      {
                        owner_id: ownerId,
                        shift: s.shift,
                        name: s.name,
                        start_time: s.start_time,
                        lesson_minutes: s.lesson_minutes,
                        break_minutes: s.break_minutes,
                        long_break_after: s.long_break_after,
                        long_break_minutes: s.long_break_minutes,
                        periods_per_day: s.periods_per_day,
                        days_per_week: s.days_per_week,
                        active: s.active,
                      },
                      { onConflict: "owner_id,shift" }
                    ) as any,
                  `${s.name} хадгалагдлаа`
                )
              }
            >
              Хадгалах
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ====================================================================
// ЦАЛИН
// ====================================================================
function PayrollTab({
  pay,
  setPay,
  ownerId,
  supabase,
  run,
}: {
  pay: Partial<PayrollSettings>;
  setPay: (p: Partial<PayrollSettings>) => void;
  ownerId: string;
  supabase: Sb;
  run: Run;
}) {
  const num = (k: keyof PayrollSettings, label: string, step = "1", hint?: string) => (
    <Field label={label} hint={hint}>
      <input
        className="input"
        type="number"
        step={step}
        value={(pay[k] as number) ?? 0}
        onChange={(e) => setPay({ ...pay, [k]: Number(e.target.value) })}
      />
    </Field>
  );

  return (
    <div className="space-y-5">
      <div className="card-pad">
        <SectionHead
          title="Нэмэгдэл хөлс"
          desc="Цагийн тооцооны хуудасны «Нэмэгдэл хөлс» баганад тохирно"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {num("overtime_multiplier", "Илүү цагийн коэффициент", "0.1", "Жишээ: 1.5 = 150%")}
          {num("homeroom_bonus", "Анги даалт (₮)")}
          {num("room_bonus", "Кабинет (₮)")}
          {num("zan_bonus", "ЗАН — заах аргын нэгдэл (₮)")}
          {num("skill_bonus_pct", "Ур чадварын нэмэгдэл (%)", "0.5")}
        </div>
      </div>

      <div className="card-pad">
        <SectionHead title="Зэргийн нэмэгдэл" />
        <div className="grid gap-4 sm:grid-cols-3">
          {num("rank_bonus_argach", "Заах аргач (₮)")}
          {num("rank_bonus_terguuleh", "Тэргүүлэх (₮)")}
          {num("rank_bonus_zovloh", "Зөвлөх (₮)")}
        </div>
      </div>

      <div className="card-pad">
        <SectionHead title="Татвар, шимтгэл" />
        <div className="grid gap-4 sm:grid-cols-3">
          {num("ndsh_pct", "НДШ (%)", "0.1")}
          {num("hhoat_pct", "ХХОАТ (%)", "0.1")}
          {num("hhoat_deduction", "ХХОАТ-ын хөнгөлөлт (₮)")}
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={() =>
          run(
            () =>
              supabase.from("payroll_settings").upsert(
                { ...pay, owner_id: ownerId, updated_at: new Date().toISOString() },
                { onConflict: "owner_id" }
              ) as any,
            "Цалингийн тохиргоо хадгалагдлаа"
          )
        }
      >
        Хадгалах
      </button>
    </div>
  );
}
