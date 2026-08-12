"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Profile, ApprovalStatus, UserRole } from "@/lib/types";
import { approveProfile, setRole, deleteProfile } from "./actions";

const TABS: { key: ApprovalStatus | "all"; label: string }[] = [
  { key: "pending", label: "Хүлээгдэж буй" },
  { key: "approved", label: "Батлагдсан" },
  { key: "rejected", label: "Татгалзсан" },
  { key: "all", label: "Бүгд" },
];

export default function AdminClient({
  profiles,
  meId,
}: {
  profiles: Profile[];
  meId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<ApprovalStatus | "all">("pending");
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rejectFor, setRejectFor] = useState<Profile | null>(null);
  const [reason, setReason] = useState("");

  const filtered = profiles.filter((p) => {
    if (tab !== "all" && p.status !== tab) return false;
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

  return (
    <div className="space-y-4">
      {msg && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            msg.ok
              ? "border-aqua-200 bg-aqua-50 text-aqua-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-[#e8e3dd] bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === t.key
                  ? "bg-lavender-500 text-white shadow-soft"
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
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-[#e8e3dd] bg-ink-50/50">
            <tr>
              <th className="th">Хэрэглэгч</th>
              <th className="th">Сургууль</th>
              <th className="th">Утас</th>
              <th className="th">Эрх</th>
              <th className="th">Төлөв</th>
              <th className="th">Бүртгүүлсэн</th>
              <th className="th text-right">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1ece6]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="td py-12 text-center text-ink-400">
                  Бичлэг олдсонгүй
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-ink-50/40">
                <td className="td">
                  <div className="font-semibold text-ink-900">
                    {p.last_name} {p.first_name}
                    {p.id === meId && (
                      <span className="badge ml-2 bg-lavender-100 text-lavender-700">
                        Та
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-400">{p.email}</div>
                </td>
                <td className="td">{p.school_name || "—"}</td>
                <td className="td">{p.phone || "—"}</td>
                <td className="td">
                  <select
                    disabled={pending || p.id === meId}
                    value={p.role}
                    onChange={(e) =>
                      run(
                        () => setRole(p.id, e.target.value as UserRole),
                        "Эрх шинэчлэгдлээ"
                      )
                    }
                    className="rounded-lg border border-[#e8e3dd] bg-white px-2 py-1 text-xs font-semibold disabled:opacity-50"
                  >
                    <option value="manager">Менежер</option>
                    <option value="admin">Админ</option>
                  </select>
                </td>
                <td className="td">
                  <StatusBadge s={p.status} />
                </td>
                <td className="td text-xs text-ink-400">
                  {new Date(p.created_at).toLocaleDateString("mn-MN")}
                </td>
                <td className="td">
                  <div className="flex justify-end gap-1.5">
                    {p.status !== "approved" && (
                      <button
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => approveProfile(p.id, "approved"),
                            `${p.first_name} батлагдлаа`
                          )
                        }
                        className="btn btn-sm bg-aqua-100 text-aqua-800 hover:bg-aqua-200"
                      >
                        Батлах
                      </button>
                    )}
                    {p.status !== "rejected" && p.id !== meId && (
                      <button
                        disabled={pending}
                        onClick={() => {
                          setRejectFor(p);
                          setReason("");
                        }}
                        className="btn btn-sm bg-sand-100 text-sand-800 hover:bg-sand-200"
                      >
                        Татгалзах
                      </button>
                    )}
                    {p.id !== meId && (
                      <button
                        disabled={pending}
                        onClick={() => {
                          if (
                            confirm(
                              `${p.last_name} ${p.first_name}-ийн бүртгэлийг бүрмөсөн устгах уу? Түүний оруулсан бүх өгөгдөл устана.`
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Татгалзах шалтгаан */}
      {rejectFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#e8e3dd] bg-white p-6 shadow-lift">
            <h3 className="text-lg font-bold text-ink-900">
              Бүртгэлийг татгалзах
            </h3>
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
              <button
                className="btn-ghost flex-1"
                onClick={() => setRejectFor(null)}
              >
                Болих
              </button>
              <button
                className="btn-danger flex-1"
                disabled={pending}
                onClick={() => {
                  const id = rejectFor.id;
                  setRejectFor(null);
                  run(
                    () => approveProfile(id, "rejected", reason),
                    "Татгалзлаа"
                  );
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

function StatusBadge({ s }: { s: ApprovalStatus }) {
  const map = {
    pending: ["bg-sand-100 text-sand-800", "Хүлээгдэж буй"],
    approved: ["bg-aqua-100 text-aqua-800", "Батлагдсан"],
    rejected: ["bg-red-100 text-red-700", "Татгалзсан"],
  } as const;
  const [cls, label] = map[s];
  return <span className={`badge ${cls}`}>{label}</span>;
}
