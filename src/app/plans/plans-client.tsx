"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/shell";
import { Empty, Field, Loading, Modal, SectionHead, StatCard, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { exportRows } from "@/lib/excel";
import {
  MONTH_NAMES_MN,
  PLAN_PERIOD_LABEL,
  PLAN_STATUS_LABEL,
  type Plan,
  type PlanItem,
  type PlanPeriod,
  type PlanStatus,
  type Profile,
} from "@/lib/types";

const PERIODS: PlanPeriod[] = ["year", "quarter", "month", "week"];
const STATUSES: PlanStatus[] = ["planned", "in_progress", "done", "cancelled"];

const STATUS_STYLE: Record<PlanStatus, string> = {
  planned: "bg-ink-100 text-ink-600",
  in_progress: "bg-lavender-100 text-lavender-700",
  done: "bg-aqua-100 text-aqua-800",
  cancelled: "bg-red-100 text-red-700",
};

export default function PlansClient({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const { show, node } = useToast();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [filter, setFilter] = useState<PlanPeriod | "all">("all");
  const [selPlan, setSelPlan] = useState<string>("");

  const [planModal, setPlanModal] = useState<Partial<Plan> | null>(null);
  const [itemModal, setItemModal] = useState<Partial<PlanItem> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, i] = await Promise.all([
      supabase.from("plans").select("*").order("created_at", { ascending: false }),
      supabase.from("plan_items").select("*").order("seq"),
    ]);
    const ps = (p.data || []) as Plan[];
    setPlans(ps);
    setItems((i.data || []) as PlanItem[]);
    setSelPlan((cur) => (cur && ps.some((x) => x.id === cur) ? cur : ps[0]?.id || ""));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const visiblePlans = plans.filter((p) => filter === "all" || p.period === filter);
  const current = plans.find((p) => p.id === selPlan);
  const currentItems = items.filter((i) => i.plan_id === selPlan);

  async function savePlan() {
    if (!planModal?.title?.trim()) return show("Гарчиг оруулна уу", false);
    setSaving(true);
    const payload = {
      owner_id: profile.id,
      period: planModal.period || "month",
      school_year: planModal.school_year || "2025-2026",
      quarter: planModal.quarter ?? null,
      month: planModal.month ?? null,
      week: planModal.week ?? null,
      title: planModal.title.trim(),
      goal: planModal.goal || null,
      start_date: planModal.start_date || null,
      end_date: planModal.end_date || null,
    };
    const { error } = planModal.id
      ? await supabase.from("plans").update(payload).eq("id", planModal.id)
      : await supabase.from("plans").insert(payload);
    setSaving(false);
    if (error) return show(error.message, false);
    show("Төлөвлөгөө хадгалагдлаа");
    setPlanModal(null);
    load();
  }

  async function saveItem() {
    if (!itemModal?.activity?.trim()) return show("Хийх ажлыг бичнэ үү", false);
    setSaving(true);
    const payload = {
      owner_id: profile.id,
      plan_id: itemModal.plan_id || selPlan,
      seq: Number(itemModal.seq || currentItems.length + 1),
      activity: itemModal.activity.trim(),
      responsible: itemModal.responsible || null,
      due_date: itemModal.due_date || null,
      indicator: itemModal.indicator || null,
      budget: itemModal.budget ? Number(itemModal.budget) : null,
      status: itemModal.status || "planned",
      progress: Number(itemModal.progress || 0),
      note: itemModal.note || null,
    };
    const { error } = itemModal.id
      ? await supabase.from("plan_items").update(payload).eq("id", itemModal.id)
      : await supabase.from("plan_items").insert(payload);
    setSaving(false);
    if (error) return show(error.message, false);
    show("Ажил хадгалагдлаа");
    setItemModal(null);
    load();
  }

  async function quickUpdate(item: PlanItem, patch: Partial<PlanItem>) {
    const { error } = await supabase.from("plan_items").update(patch).eq("id", item.id);
    if (error) return show(error.message, false);
    setItems((v) => v.map((x) => (x.id === item.id ? { ...x, ...patch } : x)));
  }

  function exportPlan() {
    if (!current) return;
    const rows: (string | number | null)[][] = [
      [`${PLAN_PERIOD_LABEL[current.period]} төлөвлөгөө — ${current.title}`],
      [`Зорилго: ${current.goal || "—"}`],
      [`Хугацаа: ${current.start_date || "—"} … ${current.end_date || "—"}`],
      [],
      ["№", "Хийх ажил", "Хариуцах эзэн", "Хугацаа", "Шалгуур үзүүлэлт", "Төсөв", "Төлөв", "Явц %", "Тэмдэглэл"],
    ];
    currentItems.forEach((i, n) =>
      rows.push([
        n + 1,
        i.activity,
        i.responsible || "",
        i.due_date || "",
        i.indicator || "",
        i.budget || "",
        PLAN_STATUS_LABEL[i.status],
        i.progress,
        i.note || "",
      ])
    );
    exportRows(rows, `Төлөвлөгөө-${current.title}`, "Төлөвлөгөө", [5, 42, 18, 13, 30, 12, 14, 8, 26]);
  }

  const doneCount = currentItems.filter((i) => i.status === "done").length;
  const avgProgress = currentItems.length
    ? Math.round(currentItems.reduce((s, i) => s + i.progress, 0) / currentItems.length)
    : 0;

  return (
    <Shell
      profile={profile}
      title="Менежерийн төлөвлөгөө"
      subtitle="Жил, улирал, сар, долоо хоногийн ажлын төлөвлөгөө"
      actions={
        <>
          <button onClick={exportPlan} disabled={!current} className="btn-ghost btn-sm">
            Excel татах
          </button>
          <button
            onClick={() =>
              setPlanModal({ period: "month", school_year: "2025-2026", title: "" })
            }
            className="btn-primary btn-sm"
          >
            + Төлөвлөгөө
          </button>
        </>
      }
    >
      {node}

      {loading ? (
        <Loading />
      ) : plans.length === 0 ? (
        <Empty
          icon="📋"
          title="Төлөвлөгөө үүсгээгүй байна"
          desc="Жилийн, улирлын, сарын, долоо хоногийн төлөвлөгөөгөө боловсруулж эхлээрэй."
          action={
            <button
              onClick={() => setPlanModal({ period: "year", school_year: "2025-2026", title: "" })}
              className="btn-primary"
            >
              + Эхний төлөвлөгөө үүсгэх
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Төлөвлөгөө" value={plans.length} icon="📋" tone="lavender" />
            <StatCard label="Нийт ажил" value={currentItems.length} icon="📌" tone="mocha" />
            <StatCard label="Дууссан" value={doneCount} icon="✅" tone="aqua" />
            <StatCard label="Дундаж явц" value={`${avgProgress}%`} icon="📈" tone="sand" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-xl border border-[#e8e3dd] bg-white p-1">
              {(["all", ...PERIODS] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilter(p as PlanPeriod | "all")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    filter === p ? "bg-lavender-500 text-white shadow-soft" : "text-ink-500 hover:bg-ink-50"
                  }`}
                >
                  {p === "all" ? "Бүгд" : PLAN_PERIOD_LABEL[p as PlanPeriod]}
                </button>
              ))}
            </div>
            <select
              className="input max-w-sm"
              value={selPlan}
              onChange={(e) => setSelPlan(e.target.value)}
            >
              {visiblePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  [{PLAN_PERIOD_LABEL[p.period]}] {p.title}
                </option>
              ))}
            </select>
          </div>

          {current && (
            <>
              <div className="card-pad">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="badge bg-lavender-100 text-lavender-700">
                      {PLAN_PERIOD_LABEL[current.period]}
                      {current.quarter ? ` · ${current.quarter}-р улирал` : ""}
                      {current.month ? ` · ${MONTH_NAMES_MN[current.month]}` : ""}
                      {current.week ? ` · ${current.week}-р 7 хоног` : ""}
                    </span>
                    <h2 className="mt-2 text-xl font-black text-ink-900">{current.title}</h2>
                    {current.goal && (
                      <p className="mt-1 max-w-2xl text-sm text-ink-500">
                        <b className="text-ink-600">Зорилго:</b> {current.goal}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-ink-400">
                      {current.start_date || "—"} … {current.end_date || "—"} ·{" "}
                      {current.school_year}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPlanModal(current)} className="btn-soft btn-sm">
                      Засах
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`«${current.title}» төлөвлөгөөг устгах уу?`)) return;
                        supabase
                          .from("plans")
                          .delete()
                          .eq("id", current.id)
                          .then(({ error }) => {
                            if (error) show(error.message, false);
                            else {
                              show("Устлаа");
                              load();
                            }
                          });
                      }}
                      className="btn-danger btn-sm"
                    >
                      Устгах
                    </button>
                  </div>
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-lavender-500 to-aqua-400"
                    style={{ width: `${avgProgress}%` }}
                  />
                </div>
              </div>

              <div>
                <SectionHead
                  title="Хийх ажлууд"
                  right={
                    <button
                      onClick={() =>
                        setItemModal({
                          plan_id: current.id,
                          seq: currentItems.length + 1,
                          status: "planned",
                          progress: 0,
                          activity: "",
                        })
                      }
                      className="btn-primary btn-sm"
                    >
                      + Ажил нэмэх
                    </button>
                  }
                />

                {currentItems.length === 0 ? (
                  <Empty icon="📌" title="Ажил нэмээгүй байна" />
                ) : (
                  <div className="table-wrap">
                    <table className="w-full min-w-[900px]">
                      <thead className="border-b border-[#e8e3dd] bg-ink-50/50">
                        <tr>
                          <th className="th w-10">№</th>
                          <th className="th">Хийх ажил</th>
                          <th className="th">Хариуцагч</th>
                          <th className="th">Хугацаа</th>
                          <th className="th">Шалгуур</th>
                          <th className="th">Төлөв</th>
                          <th className="th w-40">Явц</th>
                          <th className="th text-right">Үйлдэл</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1ece6]">
                        {currentItems.map((it, n) => (
                          <tr key={it.id} className="hover:bg-ink-50/40">
                            <td className="td text-ink-400">{n + 1}</td>
                            <td className="td">
                              <div className="font-semibold text-ink-900">{it.activity}</div>
                              {it.note && (
                                <div className="text-[11px] text-ink-400">{it.note}</div>
                              )}
                            </td>
                            <td className="td text-xs">{it.responsible || "—"}</td>
                            <td className="td text-xs">{it.due_date || "—"}</td>
                            <td className="td text-xs text-ink-500">{it.indicator || "—"}</td>
                            <td className="td">
                              <select
                                value={it.status}
                                onChange={(e) =>
                                  quickUpdate(it, {
                                    status: e.target.value as PlanStatus,
                                    progress:
                                      e.target.value === "done" ? 100 : it.progress,
                                  })
                                }
                                className={`rounded-lg border-0 px-2 py-1 text-[11px] font-bold ${STATUS_STYLE[it.status]}`}
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {PLAN_STATUS_LABEL[s]}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="td">
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={5}
                                  value={it.progress}
                                  onChange={(e) =>
                                    quickUpdate(it, { progress: Number(e.target.value) })
                                  }
                                  className="w-20 accent-lavender-500"
                                />
                                <span className="w-9 text-xs font-bold text-ink-600">
                                  {it.progress}%
                                </span>
                              </div>
                            </td>
                            <td className="td">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setItemModal(it)}
                                  className="btn-soft btn-sm"
                                >
                                  Засах
                                </button>
                                <button
                                  onClick={() => {
                                    if (!confirm("Устгах уу?")) return;
                                    supabase
                                      .from("plan_items")
                                      .delete()
                                      .eq("id", it.id)
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
            </>
          )}
        </div>
      )}

      {/* ---------- Төлөвлөгөө ---------- */}
      <Modal
        open={!!planModal}
        onClose={() => setPlanModal(null)}
        title={planModal?.id ? "Төлөвлөгөө засах" : "Шинэ төлөвлөгөө"}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPlanModal(null)}>Болих</button>
            <button className="btn-primary" disabled={saving} onClick={savePlan}>
              {saving ? "Хадгалж байна…" : "Хадгалах"}
            </button>
          </>
        }
      >
        {planModal && (
          <div className="space-y-4">
            <Field label="Хугацааны төрөл">
              <div className="flex gap-1 rounded-xl border border-[#e8e3dd] bg-white p-1">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlanModal({ ...planModal, period: p })}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                      planModal.period === p
                        ? "bg-lavender-500 text-white"
                        : "text-ink-500 hover:bg-ink-50"
                    }`}
                  >
                    {PLAN_PERIOD_LABEL[p]}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Гарчиг *">
              <input
                className="input"
                placeholder="2025-2026 оны сургалтын менежерийн жилийн төлөвлөгөө"
                value={planModal.title || ""}
                onChange={(e) => setPlanModal({ ...planModal, title: e.target.value })}
              />
            </Field>

            <Field label="Зорилго">
              <textarea
                className="input min-h-[80px]"
                value={planModal.goal || ""}
                onChange={(e) => setPlanModal({ ...planModal, goal: e.target.value })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              {planModal.period === "quarter" && (
                <Field label="Улирал">
                  <select
                    className="input"
                    value={planModal.quarter || 1}
                    onChange={(e) => setPlanModal({ ...planModal, quarter: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4].map((q) => (
                      <option key={q} value={q}>{q}-р улирал</option>
                    ))}
                  </select>
                </Field>
              )}
              {planModal.period === "month" && (
                <Field label="Сар">
                  <select
                    className="input"
                    value={planModal.month || new Date().getMonth() + 1}
                    onChange={(e) => setPlanModal({ ...planModal, month: Number(e.target.value) })}
                  >
                    {Object.entries(MONTH_NAMES_MN).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
              )}
              {planModal.period === "week" && (
                <Field label="Долоо хоног">
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={52}
                    value={planModal.week || 1}
                    onChange={(e) => setPlanModal({ ...planModal, week: Number(e.target.value) })}
                  />
                </Field>
              )}
              <Field label="Хичээлийн жил">
                <input
                  className="input"
                  value={planModal.school_year || "2025-2026"}
                  onChange={(e) => setPlanModal({ ...planModal, school_year: e.target.value })}
                />
              </Field>
              <Field label="Эхлэх огноо">
                <input
                  className="input"
                  type="date"
                  value={planModal.start_date || ""}
                  onChange={(e) => setPlanModal({ ...planModal, start_date: e.target.value })}
                />
              </Field>
              <Field label="Дуусах огноо">
                <input
                  className="input"
                  type="date"
                  value={planModal.end_date || ""}
                  onChange={(e) => setPlanModal({ ...planModal, end_date: e.target.value })}
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- Ажил ---------- */}
      <Modal
        open={!!itemModal}
        onClose={() => setItemModal(null)}
        title={itemModal?.id ? "Ажил засах" : "Ажил нэмэх"}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setItemModal(null)}>Болих</button>
            <button className="btn-primary" disabled={saving} onClick={saveItem}>
              {saving ? "Хадгалж байна…" : "Хадгалах"}
            </button>
          </>
        }
      >
        {itemModal && (
          <div className="space-y-4">
            <Field label="Хийх ажил *">
              <textarea
                className="input min-h-[70px]"
                placeholder="Багш нарын хичээлд суух, зөвлөн туслах"
                value={itemModal.activity || ""}
                onChange={(e) => setItemModal({ ...itemModal, activity: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Хариуцах эзэн">
                <input
                  className="input"
                  value={itemModal.responsible || ""}
                  onChange={(e) => setItemModal({ ...itemModal, responsible: e.target.value })}
                />
              </Field>
              <Field label="Хугацаа">
                <input
                  className="input"
                  type="date"
                  value={itemModal.due_date || ""}
                  onChange={(e) => setItemModal({ ...itemModal, due_date: e.target.value })}
                />
              </Field>
              <Field label="Төсөв (₮)">
                <input
                  className="input"
                  type="number"
                  value={itemModal.budget ?? ""}
                  onChange={(e) => setItemModal({ ...itemModal, budget: Number(e.target.value) })}
                />
              </Field>
              <Field label="Төлөв">
                <select
                  className="input"
                  value={itemModal.status || "planned"}
                  onChange={(e) => setItemModal({ ...itemModal, status: e.target.value as PlanStatus })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{PLAN_STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Гүйцэтгэлийн шалгуур үзүүлэлт">
              <input
                className="input"
                placeholder="Ажиглалтын тэмдэглэл бүрэн хөтлөгдсөн байх"
                value={itemModal.indicator || ""}
                onChange={(e) => setItemModal({ ...itemModal, indicator: e.target.value })}
              />
            </Field>
            <Field label={`Явц: ${itemModal.progress || 0}%`}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                className="w-full accent-lavender-500"
                value={itemModal.progress || 0}
                onChange={(e) => setItemModal({ ...itemModal, progress: Number(e.target.value) })}
              />
            </Field>
            <Field label="Тэмдэглэл">
              <textarea
                className="input min-h-[60px]"
                value={itemModal.note || ""}
                onChange={(e) => setItemModal({ ...itemModal, note: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </Shell>
  );
}
