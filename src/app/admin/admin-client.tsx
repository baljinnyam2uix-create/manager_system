"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import SignOutButton from "@/components/sign-out-button";
import type { Profile, ApprovalStatus, UserRole } from "@/lib/types";
import { approveProfile, setRole, deleteProfile, assignSchool } from "./actions";
import type { Aphorism, AuditEntry, ManagerUsage, School } from "./page";
import {
  AphorismsTab,
  SchoolsTab,
  SystemTab,
  Stat,
  type SetMsg,
} from "./admin-content";

type Tab = "managers" | "aphorisms" | "schools" | "system";

const TABS: { k: Tab; label: string; icon: string }[] = [
  { k: "managers", label: "Менежерүүд", icon: "👤" },
  { k: "aphorisms", label: "Афоризм", icon: "❝" },
  { k: "schools", label: "Сургууль", icon: "🏫" },
  { k: "system", label: "Систем", icon: "📊" },
];

const STATUS_TABS: { key: ApprovalStatus | "all"; label: string }[] = [
  { key: "pending", label: "Хүлээгдэж буй" },
  { key: "approved", label: "Батлагдсан" },
  { key: "rejected", label: "Татгалзсан" },
  { key: "all", label: "Бүгд" },
];

export default function AdminClient({
  me,
  profiles,
  aphorisms,
  schools,
  audit,
  usage,
  totals,
}: {
  me: Profile;
  profiles: Profile[];
  aphorisms: Aphorism[];
  schools: School[];
  audit: AuditEntry[];
  usage: ManagerUsage[];
  totals: Record<string, number>;
}) {
  const [tab, setTab] = useState<Tab>("managers");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pending = profiles.filter((p) => p.status === "pending").length;

  return (
    <div className="min-h-screen bg-[#f4fbfa]">
      <header className="sticky top-0 z-20 border-b border-[#d7e8e6] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <LogoMark size={42} />
            <div className="leading-tight">
              <div className="flex items-center gap-2 text-sm font-extrabold text-ink-900">
                Админ удирдлага
                <span className="badge bg-ink-900 text-white">SYSTEM</span>
              </div>
              <div className="text-[11px] text-ink-400">
                {me.last_name} {me.first_name} · {me.email}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="btn-ghost btn-sm">
              Систем рүү
            </Link>
            <SignOutButton className="btn-soft btn-sm" />
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 pb-2">
          {TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                tab === t.k
                  ? "bg-teal-500 text-white shadow-soft"
                  : "text-ink-500 hover:bg-ink-50"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.k === "managers" && pending > 0 && (
                <span className="rounded-md bg-pink-700 px-1.5 text-[10px] font-bold text-white">
                  {pending}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-5 py-7">
        {msg && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              msg.ok
                ? "border-seafoam-200 bg-seafoam-50 text-seafoam-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {msg.text}
          </div>
        )}

        {tab === "managers" && (
          <ManagersTab
            profiles={profiles}
            schools={schools}
            usage={usage}
            meId={me.id}
            setMsg={setMsg}
          />
        )}
        {tab === "aphorisms" && <AphorismsTab items={aphorisms} setMsg={setMsg} />}
        {tab === "schools" && (
          <SchoolsTab items={schools} profiles={profiles} setMsg={setMsg} />
        )}
        {tab === "system" && (
          <SystemTab
            profiles={profiles}
            usage={usage}
            totals={totals}
            audit={audit}
            aphorisms={aphorisms}
            schools={schools}
          />
        )}
      </main>
    </div>
  );
}

// =====================================================================
//  МЕНЕЖЕРҮҮД
// =====================================================================
function ManagersTab({
  profiles,
  schools,
  usage,
  meId,
  setMsg,
}: {
  profiles: Profile[];
  schools: School[];
  usage: ManagerUsage[];
  meId: string;
  setMsg: SetMsg;
}) {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState<ApprovalStatus | "all">("pending");
  const [q, setQ] = useState("");
  const [busy, startTransition] = useTransition();
  const [rejectFor, setRejectFor] = useState<Profile | null>(null);
  const [reason, setReason] = useState("");

  const usageOf = (id: string) => usage.find((u) => u.owner_id === id);

  const filtered = profiles.filter((p) => {
    if (statusTab !== "all" && p.status !== statusTab) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      (p.email || "").toLowerCase().includes(s) ||
      (p.first_name || "").toLowerCase().includes(s) ||
      (p.last_name || "").toLowerCase().includes(s) ||
      (p.school_name || "").toLowerCase().includes(s)
    );
  });

  function run(fn: () => Promise<{ error?: string }>, okText: string) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: okText });
        router.refresh();
      }
      setTimeout(() => setMsg(null), 4000);
    });
  }

  const counts = {
    pending: profiles.filter((p) => p.status === "pending").length,
    approved: profiles.filter((p) => p.status === "approved").length,
    rejected: profiles.filter((p) => p.status === "rejected").length,
    admins: profiles.filter((p) => p.role === "admin").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Хүлээгдэж буй" value={counts.pending} tone="amber" />
        <Stat label="Батлагдсан" value={counts.approved} tone="aqua" />
        <Stat label="Татгалзсан" value={counts.rejected} tone="red" />
        <Stat label="Админ" value={counts.admins} tone="ink" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-[#d7e8e6] bg-white p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                statusTab === t.key
                  ? "bg-teal-500 text-white shadow-soft"
                  : "text-ink-500 hover:bg-ink-50"
              }`}
            >
              {t.label}
              <span className="ml-1.5 opacity-60">
                {t.key === "all"
                  ? profiles.length
                  : profiles.filter((p) => p.status === t.key).length}
              </span>
            </button>
          ))}
        </div>
        <input
          className="input max-w-xs"
          placeholder="Нэр, и-мэйл, сургуулиар хайх…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="w-full min-w-[1050px]">
          <thead className="border-b border-[#d7e8e6] bg-ink-50/50">
            <tr>
              <th className="th">Хэрэглэгч</th>
              <th className="th">Сургууль</th>
              <th className="th">Оруулсан өгөгдөл</th>
              <th className="th">Эрх</th>
              <th className="th">Төлөв</th>
              <th className="th text-right">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6f1ef]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="td py-12 text-center text-ink-400">
                  Бичлэг олдсонгүй
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const u = usageOf(p.id);
              return (
                <tr key={p.id} className="hover:bg-ink-50/40">
                  <td className="td">
                    <div className="font-semibold text-ink-900">
                      {p.last_name} {p.first_name}
                      {p.id === meId && (
                        <span className="badge ml-2 bg-teal-100 text-teal-700">Та</span>
                      )}
                    </div>
                    <div className="text-xs text-ink-400">{p.email}</div>
                    <div className="text-[11px] text-ink-300">
                      {p.phone || "утасгүй"} ·{" "}
                      {new Date(p.created_at).toLocaleDateString("mn-MN")}
                    </div>
                  </td>
                  <td className="td">
                    <div className="text-[13px]">{p.school_name || "—"}</div>
                    <select
                      disabled={busy}
                      value={p.school_id || ""}
                      onChange={(e) =>
                        run(
                          () => assignSchool(p.id, e.target.value || null),
                          "Сургууль оноогдлоо"
                        )
                      }
                      className="mt-1 rounded-lg border border-[#d7e8e6] bg-white px-2 py-1 text-[11px]"
                    >
                      <option value="">— бүртгэлд холбоогүй —</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td">
                    {u && (u.teachers || u.classes || u.slots) ? (
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        <Chip n={u.teachers} l="багш" />
                        <Chip n={u.classes} l="анги" />
                        <Chip n={u.students} l="сурагч" />
                        <Chip n={u.slots} l="цаг" />
                        <Chip n={u.observations} l="ажиглалт" />
                        <Chip n={u.plans} l="төлөвлөгөө" />
                      </div>
                    ) : (
                      <span className="text-xs text-ink-300">хоосон</span>
                    )}
                  </td>
                  <td className="td">
                    <select
                      disabled={busy || p.id === meId}
                      value={p.role}
                      onChange={(e) =>
                        run(() => setRole(p.id, e.target.value as UserRole), "Эрх шинэчлэгдлээ")
                      }
                      className={`rounded-lg border px-2 py-1 text-xs font-bold disabled:opacity-50 ${
                        p.role === "admin"
                          ? "border-ink-800 bg-ink-900 text-white"
                          : "border-[#d7e8e6] bg-white"
                      }`}
                    >
                      <option value="manager">Менежер</option>
                      <option value="admin">Админ</option>
                    </select>
                  </td>
                  <td className="td">
                    <StatusBadge s={p.status} />
                    {p.reject_reason && (
                      <div className="mt-1 max-w-[160px] text-[10px] text-red-600">
                        {p.reject_reason}
                      </div>
                    )}
                  </td>
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      {p.status !== "approved" && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => approveProfile(p.id, "approved"),
                              `${p.first_name || p.email} батлагдлаа`
                            )
                          }
                          className="btn btn-sm bg-seafoam-100 text-seafoam-800 hover:bg-seafoam-200"
                        >
                          Батлах
                        </button>
                      )}
                      {p.status !== "rejected" && p.id !== meId && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            setRejectFor(p);
                            setReason("");
                          }}
                          className="btn btn-sm bg-coral-100 text-coral-800 hover:bg-coral-200"
                        >
                          Татгалзах
                        </button>
                      )}
                      {p.id !== meId && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                `${p.last_name} ${p.first_name} (${p.email})-ийн бүртгэлийг бүрмөсөн устгах уу?\n\nТүүний оруулсан бүх өгөгдөл — багш, хуваарь, дүн — хамт устана. Буцаах боломжгүй.`
                              )
                            )
                              run(() => deleteProfile(p.id), "Хэрэглэгч устлаа");
                          }}
                          className="btn-danger btn-sm"
                        >
                          Устгах
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rejectFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#d7e8e6] bg-white p-6 shadow-lift">
            <h3 className="text-lg font-bold text-ink-900">Бүртгэлийг татгалзах</h3>
            <p className="mt-1 text-sm text-ink-400">
              {rejectFor.last_name} {rejectFor.first_name} — {rejectFor.email}
            </p>
            <label className="label mt-4">Шалтгаан (заавал биш)</label>
            <textarea
              className="input min-h-[90px]"
              placeholder="Жишээ: Сургуулийн мэдээлэл буруу байна"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="mt-5 flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setRejectFor(null)}>
                Болих
              </button>
              <button
                className="btn-danger flex-1"
                disabled={busy}
                onClick={() => {
                  const id = rejectFor.id;
                  setRejectFor(null);
                  run(() => approveProfile(id, "rejected", reason), "Татгалзлаа");
                }}
              >
                Татгалзах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ n, l }: { n: number; l: string }) {
  if (!n) return null;
  return (
    <span className="rounded bg-ink-100 px-1.5 py-0.5 font-semibold text-ink-600">
      {n} {l}
    </span>
  );
}

function StatusBadge({ s }: { s: ApprovalStatus }) {
  const map = {
    pending: ["bg-coral-100 text-coral-800", "Хүлээгдэж буй"],
    approved: ["bg-seafoam-100 text-seafoam-800", "Батлагдсан"],
    rejected: ["bg-red-100 text-red-700", "Татгалзсан"],
  } as const;
  const [cls, label] = map[s];
  return <span className={`badge ${cls}`}>{label}</span>;
}
