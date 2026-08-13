"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import type { Aphorism, AuditEntry, ManagerUsage, School } from "./page";
import {
  saveAphorism,
  deleteAphorism,
  toggleAphorism,
  saveSchool,
  deleteSchool,
} from "./actions";

export type SetMsg = (m: { ok: boolean; text: string } | null) => void;

/** Админы самбарын тоон хайрцаг */
export function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: number | string;
  tone: "gold" | "aqua" | "red" | "ink" | "teal" | "orange";
  sub?: string;
}) {
  const tones = {
    gold: "from-gold-100 to-gold-50 text-gold-800",
    aqua: "from-aqua-100 to-aqua-50 text-aqua-800",
    red: "from-red-100 to-red-50 text-red-700",
    ink: "from-ink-100 to-ink-50 text-ink-800",
    teal: "from-teal-100 to-teal-50 text-teal-800",
    orange: "from-orange-100 to-orange-50 text-orange-800",
  };
  return (
    <div
      className={`rounded-2xl border border-[#d7e8e6] bg-gradient-to-br ${tones[tone]} p-5 shadow-soft`}
    >
      <div className="text-3xl font-black">{value}</div>
      <div className="mt-0.5 text-xs font-bold uppercase tracking-wide opacity-70">
        {label}
      </div>
      {sub && <div className="mt-0.5 text-[11px] opacity-60">{sub}</div>}
    </div>
  );
}

// =====================================================================
//  АФОРИЗМ
// =====================================================================
export function AphorismsTab({
  items,
  setMsg,
}: {
  items: Aphorism[];
  setMsg: SetMsg;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [form, setForm] = useState<Partial<Aphorism>>({ text: "", author: "", active: true });

  function run(fn: () => Promise<{ error?: string }>, ok: string, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: ok });
        after?.();
        router.refresh();
      }
      setTimeout(() => setMsg(null), 4000);
    });
  }

  const active = items.filter((a) => a.active).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Нийт афоризм" value={items.length} tone="teal" />
        <Stat label="Идэвхтэй" value={active} tone="aqua" sub="нүүр хуудсанд эргэлдэнэ" />
        <Stat label="Нуусан" value={items.length - active} tone="ink" />
      </div>

      <div className="card-pad">
        <h3 className="section-title">
          {form.id ? "Афоризм засах" : "Шинэ афоризм нэмэх"}
        </h3>
        <p className="mt-0.5 text-sm text-ink-400">
          Нэвтрэх хуудсанд менежерүүдэд харагдах урам зоригийн үг
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Афоризм *</label>
            <textarea
              className="input min-h-[80px]"
              placeholder="Боловсрол бол дэлхийг өөрчлөх хамгийн хүчирхэг зэвсэг юм."
              value={form.text || ""}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <label className="label">Зохиогч</label>
              <input
                className="input"
                placeholder="Нельсон Мандела"
                value={form.author || ""}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
              />
            </div>
            <label className="flex items-end gap-2 pb-2.5 text-sm font-semibold text-ink-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-aqua-500"
                checked={form.active !== false}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Идэвхтэй
            </label>
            <div className="flex items-end gap-2">
              {form.id && (
                <button
                  className="btn-ghost"
                  onClick={() => setForm({ text: "", author: "", active: true })}
                >
                  Болих
                </button>
              )}
              <button
                className="btn-primary"
                disabled={busy || !form.text?.trim()}
                onClick={() =>
                  run(
                    () =>
                      saveAphorism({
                        id: form.id,
                        text: form.text || "",
                        author: form.author || null,
                        active: form.active !== false,
                      }),
                    form.id ? "Афоризм шинэчлэгдлээ" : "Афоризм нэмэгдлээ",
                    () => setForm({ text: "", author: "", active: true })
                  )
                }
              >
                {form.id ? "Хадгалах" : "+ Нэмэх"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#c2ded9] bg-white/60 px-6 py-12 text-center text-sm text-ink-400">
            Афоризм бүртгээгүй байна
          </p>
        )}
        {items.map((a) => (
          <div
            key={a.id}
            className={`flex flex-wrap items-start gap-3 rounded-2xl border p-4 ${
              a.active ? "border-[#d7e8e6] bg-white" : "border-[#e6f1ef] bg-ink-50/60 opacity-70"
            }`}
          >
            <span className="text-xl leading-none text-teal-300">❝</span>
            <div className="min-w-[220px] flex-1">
              <p className="text-[15px] font-semibold leading-relaxed text-ink-800">
                {a.text}
              </p>
              {a.author && (
                <p className="mt-1 text-sm text-ink-400">— {a.author}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-500">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-aqua-500"
                  checked={a.active}
                  disabled={busy}
                  onChange={(e) =>
                    run(
                      () => toggleAphorism(a.id, e.target.checked),
                      e.target.checked ? "Идэвхжлээ" : "Нуулаа"
                    )
                  }
                />
                {a.active ? "Идэвхтэй" : "Нуусан"}
              </label>
              <button
                className="btn-soft btn-sm"
                onClick={() => {
                  setForm(a);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Засах
              </button>
              <button
                className="btn-danger btn-sm"
                disabled={busy}
                onClick={() =>
                  confirm("Энэ афоризмыг устгах уу?") &&
                  run(() => deleteAphorism(a.id), "Устлаа")
                }
              >
                Устгах
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
//  СУРГУУЛЬ
// =====================================================================
export function SchoolsTab({
  items,
  profiles,
  setMsg,
}: {
  items: School[];
  profiles: Profile[];
  setMsg: SetMsg;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [form, setForm] = useState<Partial<School>>({ name: "", aimag: "", soum: "" });

  function run(fn: () => Promise<{ error?: string }>, ok: string, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: ok });
        after?.();
        router.refresh();
      }
      setTimeout(() => setMsg(null), 4000);
    });
  }

  const managersOf = (schoolId: string) =>
    profiles.filter(
      (p) => p.school_id === schoolId
    );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Бүртгэлтэй сургууль" value={items.length} tone="teal" />
        <Stat
          label="Холбогдсон менежер"
          value={
            profiles.filter((p) => p.school_id)
              .length
          }
          tone="aqua"
        />
        <Stat
          label="Холбоогүй менежер"
          value={
            profiles.filter((p) => !p.school_id)
              .length
          }
          tone="gold"
        />
      </div>

      <div className="card-pad">
        <h3 className="section-title">
          {form.id ? "Сургууль засах" : "Сургууль бүртгэх"}
        </h3>
        <p className="mt-0.5 text-sm text-ink-400">
          Менежерүүдийг сургуульд хамааруулснаар байгууллагаар нь бүлэглэж харна
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <div>
            <label className="label">Сургуулийн нэр *</label>
            <input
              className="input"
              placeholder="ЕБ-ын 2 дугаар сургууль"
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Аймаг / хот</label>
            <input
              className="input"
              placeholder="Өмнөговь"
              value={form.aimag || ""}
              onChange={(e) => setForm({ ...form, aimag: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Сум / дүүрэг</label>
            <input
              className="input"
              placeholder="Ханбогд"
              value={form.soum || ""}
              onChange={(e) => setForm({ ...form, soum: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            {form.id && (
              <button
                className="btn-ghost"
                onClick={() => setForm({ name: "", aimag: "", soum: "" })}
              >
                Болих
              </button>
            )}
            <button
              className="btn-primary"
              disabled={busy || !form.name?.trim()}
              onClick={() =>
                run(
                  () =>
                    saveSchool({
                      id: form.id,
                      name: form.name || "",
                      aimag: form.aimag || null,
                      soum: form.soum || null,
                    }),
                  form.id ? "Шинэчлэгдлээ" : "Сургууль бүртгэгдлээ",
                  () => setForm({ name: "", aimag: "", soum: "" })
                )
              }
            >
              {form.id ? "Хадгалах" : "+ Нэмэх"}
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="w-full min-w-[700px]">
          <thead className="border-b border-[#d7e8e6] bg-ink-50/50">
            <tr>
              <th className="th">Сургууль</th>
              <th className="th">Байршил</th>
              <th className="th">Менежерүүд</th>
              <th className="th text-right">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6f1ef]">
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="td py-12 text-center text-ink-400">
                  Сургууль бүртгээгүй байна
                </td>
              </tr>
            )}
            {items.map((s) => {
              const mgrs = managersOf(s.id);
              return (
                <tr key={s.id} className="hover:bg-ink-50/40">
                  <td className="td font-semibold">{s.name}</td>
                  <td className="td text-xs text-ink-500">
                    {[s.aimag, s.soum].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="td">
                    {mgrs.length ? (
                      <div className="flex flex-wrap gap-1">
                        {mgrs.map((m) => (
                          <span
                            key={m.id}
                            className="badge bg-teal-100 text-teal-700"
                            title={m.email}
                          >
                            {m.last_name} {m.first_name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-300">холбогдоогүй</span>
                    )}
                  </td>
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-soft btn-sm" onClick={() => setForm(s)}>
                        Засах
                      </button>
                      <button
                        className="btn-danger btn-sm"
                        disabled={busy}
                        onClick={() =>
                          confirm(
                            `«${s.name}»-ийг устгах уу? Менежерүүдийн холбоос сална, өгөгдөл нь үлдэнэ.`
                          ) && run(() => deleteSchool(s.id), "Устлаа")
                        }
                      >
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
    </div>
  );
}

// =====================================================================
//  СИСТЕМ — статистик ба хандалтын журнал
// =====================================================================
const ACTION_LABEL: Record<string, string> = {
  approve_manager: "Менежер баталсан",
  reject_manager: "Менежер татгалзсан",
  set_role: "Эрх өөрчилсөн",
  create_aphorism: "Афоризм нэмсэн",
  update_aphorism: "Афоризм зассан",
  delete_aphorism: "Афоризм устгасан",
  create_school: "Сургууль нэмсэн",
  update_school: "Сургууль зассан",
  delete_school: "Сургууль устгасан",
  assign_school: "Сургууль оноосон",
};

export function SystemTab({
  profiles,
  usage,
  totals,
  audit,
  aphorisms,
  schools,
}: {
  profiles: Profile[];
  usage: ManagerUsage[];
  totals: Record<string, number>;
  audit: AuditEntry[];
  aphorisms: Aphorism[];
  schools: School[];
}) {
  const nameOf = (id: string | null) => {
    if (!id) return "систем";
    const p = profiles.find((x) => x.id === id);
    return p ? `${p.last_name || ""} ${p.first_name || p.email}`.trim() : "устсан хэрэглэгч";
  };

  const ranked = [...usage]
    .map((u) => ({
      ...u,
      total: u.teachers + u.classes + u.students + u.slots + u.observations + u.plans,
      profile: profiles.find((p) => p.id === u.owner_id),
    }))
    .filter((u) => u.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 section-title">Системийн нийт өгөгдөл</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Stat label="Багш" value={totals.teachers} tone="teal" />
          <Stat label="Анги" value={totals.classes} tone="aqua" />
          <Stat label="Сурагч" value={totals.students} tone="orange" />
          <Stat label="Хуваарийн цаг" value={totals.slots} tone="gold" />
          <Stat label="Ажиглалт" value={totals.observations} tone="ink" />
          <Stat label="Төлөвлөгөө" value={totals.plans} tone="teal" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Менежер" value={profiles.length} tone="ink" />
        <Stat label="Афоризм" value={aphorisms.length} tone="ink" />
        <Stat label="Сургууль" value={schools.length} tone="ink" />
      </div>

      <div className="card-pad">
        <h3 className="section-title">Менежерүүдийн идэвх</h3>
        <p className="mt-0.5 text-sm text-ink-400">
          Хэн хэр их өгөгдөл оруулсныг харуулна
        </p>
        {ranked.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">
            Одоогоор хэн ч өгөгдөл оруулаагүй байна
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {ranked.map((u) => {
              const max = ranked[0].total || 1;
              return (
                <div key={u.owner_id} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 truncate text-[13px] font-semibold text-ink-800">
                    {u.profile?.last_name} {u.profile?.first_name || u.profile?.email}
                  </div>
                  <div className="h-6 flex-1 overflow-hidden rounded-lg bg-ink-100">
                    <div
                      className="brand-gradient flex h-full items-center justify-end rounded-lg px-2 text-[10px] font-bold text-white"
                      style={{ width: `${Math.max(8, (u.total / max) * 100)}%` }}
                    >
                      {u.total}
                    </div>
                  </div>
                  <div className="hidden w-64 shrink-0 gap-1 text-[10px] sm:flex">
                    <span className="text-ink-400">
                      {u.teachers} багш · {u.classes} анги · {u.slots} цаг
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card-pad">
        <h3 className="section-title">Хандалтын журнал</h3>
        <p className="mt-0.5 text-sm text-ink-400">
          Админы сүүлийн {audit.length} үйлдэл
        </p>
        {audit.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">Бичлэг алга</p>
        ) : (
          <div className="mt-4 max-h-[420px] overflow-y-auto">
            <table className="w-full min-w-[560px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#d7e8e6]">
                  <th className="th">Хэзээ</th>
                  <th className="th">Хэн</th>
                  <th className="th">Юу хийсэн</th>
                  <th className="th">Дэлгэрэнгүй</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6f1ef]">
                {audit.map((a) => (
                  <tr key={a.id} className="hover:bg-ink-50/40">
                    <td className="td whitespace-nowrap text-xs text-ink-400">
                      {new Date(a.created_at).toLocaleString("mn-MN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="td text-[13px]">{nameOf(a.actor_id)}</td>
                    <td className="td">
                      <span className="badge bg-ink-100 text-ink-700">
                        {ACTION_LABEL[a.action] || a.action}
                      </span>
                    </td>
                    <td className="td max-w-[260px] truncate text-[11px] text-ink-400">
                      {a.detail
                        ? Object.entries(a.detail)
                            .filter(([, v]) => v !== null && v !== undefined)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
