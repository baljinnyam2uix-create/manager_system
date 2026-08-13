"use client";

import Link from "next/link";
import Shell from "@/components/shell";
import { StatCard } from "@/components/ui";
import type { Profile } from "@/lib/types";

interface Stats {
  teachers: number;
  homeroom: number;
  classes: number;
  subjects: number;
  slots: number;
  students: number;
  plans: number;
  planItemsTotal: number;
  planItemsDone: number;
  planProgress: number;
  perfTotal: number;
  perfDone: number;
  perfScore: number;
}

const QUICK = [
  { href: "/teachers", icon: "👩‍🏫", label: "Багш нэмэх", desc: "Үндсэн мэдээлэл, ачаалал" },
  { href: "/schedule", icon: "🗓️", label: "Хуваарь зохиох", desc: "Автомат үүсгэлт" },
  { href: "/performance", icon: "✅", label: "Гүйцэтгэл дүгнэх", desc: "Чек, оноо, тайлбар" },
  { href: "/plans", icon: "📋", label: "Төлөвлөгөө", desc: "Жил, улирал, сар, 7 хоног" },
  { href: "/payroll", icon: "💰", label: "Цалин бодох", desc: "Цагийн тооцоо" },
  { href: "/observations", icon: "🔍", label: "Ажиглалт бичих", desc: "Хичээлийн тэмдэглэл" },
  { href: "/grades", icon: "📊", label: "Дүн оруулах", desc: "Нэгдсэн матриц" },
  { href: "/settings", icon: "⚙️", label: "Тохиргоо", desc: "Анги, кабинет, ээлж" },
];

export default function DashboardClient({
  profile,
  stats,
  activeVersion,
  observations,
}: {
  profile: Profile;
  stats: Stats;
  activeVersion: { id: string; name: string; is_active: boolean; created_at: string } | null;
  observations: { id: string; date: string; topic: string | null; teacher: string }[];
}) {
  const hour = new Date().getHours();
  const greet =
    hour < 6 ? "Сайхан шөнө" : hour < 12 ? "Өглөөний мэнд" : hour < 18 ? "Өдрийн мэнд" : "Оройн мэнд";

  const setupNeeded = stats.teachers === 0 || stats.classes === 0 || stats.subjects === 0;

  return (
    <Shell
      profile={profile}
      title="Хяналтын самбар"
      subtitle={`${greet}, ${profile.first_name || ""}!`}
    >
      <div className="space-y-6">
        {/* Мэндчилгээ */}
        <div className="brand-gradient relative overflow-hidden rounded-2xl border border-[#d7e8e6] p-7 text-white shadow-lift">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-white/10" />
          <div className="relative">
            <h2 className="text-2xl font-black tracking-tight">
              {greet}, {profile.last_name} {profile.first_name}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-white/80">
              {profile.school_name || "Сургууль"} · 2025–2026 оны хичээлийн жил
            </p>
            {activeVersion && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-semibold backdrop-blur">
                🗓️ Идэвхтэй хуваарь: {activeVersion.name}
              </div>
            )}
          </div>
        </div>

        {/* Тохиргоо шаардлагатай */}
        {setupNeeded && (
          <div className="rounded-2xl border border-gold-300 bg-gold-50 p-5">
            <h3 className="text-sm font-bold text-gold-900">
              🚀 Системийг ашиглаж эхлэхийн тулд
            </h3>
            <ol className="mt-3 space-y-2 text-[13px] text-gold-900">
              <Step done={stats.subjects > 0} n={1}>
                <Link href="/settings" className="font-semibold underline">
                  Тохиргоо
                </Link>{" "}
                хэсэгт судлагдахуун, анги, кабинет, ээлжээ бүртгэнэ
              </Step>
              <Step done={stats.teachers > 0} n={2}>
                <Link href="/teachers" className="font-semibold underline">
                  Багшийн бүртгэл
                </Link>{" "}
                хэсэгт багш нар болон тэдний долоо хоногийн ачааллыг оруулна
              </Step>
              <Step done={stats.slots > 0} n={3}>
                <Link href="/schedule" className="font-semibold underline">
                  Хичээлийн хуваарь
                </Link>{" "}
                хэсэгт «Хуваарь зохиох» товчийг дарна
              </Step>
            </ol>
          </div>
        )}

        {/* Үзүүлэлтүүд */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Багш" value={stats.teachers} sub={`${stats.homeroom} анги даасан`} icon="👩‍🏫" tone="teal" />
          <StatCard label="Анги" value={stats.classes} sub={`${stats.students} сурагч`} icon="🏫" tone="aqua" />
          <StatCard label="Хуваарийн цаг" value={stats.slots} sub="7 хоногт" icon="🗓️" tone="orange" />
          <StatCard label="Судлагдахуун" value={stats.subjects} icon="📚" tone="gold" />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Төлөвлөгөө */}
          <div className="card-pad">
            <h3 className="text-sm font-bold text-ink-800">Төлөвлөгөөний явц</h3>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-black text-teal-600">
                {stats.planProgress}%
              </span>
              <span className="pb-1.5 text-xs text-ink-400">дундаж гүйцэтгэл</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-aqua-400 transition-all"
                style={{ width: `${stats.planProgress}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-ink-400">
              {stats.plans} төлөвлөгөө · {stats.planItemsDone}/{stats.planItemsTotal} ажил дууссан
            </p>
            <Link href="/plans" className="btn-soft btn-sm mt-4 w-full">
              Төлөвлөгөө рүү
            </Link>
          </div>

          {/* Гүйцэтгэл */}
          <div className="card-pad">
            <h3 className="text-sm font-bold text-ink-800">Багшийн ажлын гүйцэтгэл</h3>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-black text-aqua-600">{stats.perfScore}%</span>
              <span className="pb-1.5 text-xs text-ink-400">дундаж оноо</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-aqua-500 to-teal-400 transition-all"
                style={{ width: `${stats.perfScore}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-ink-400">
              {stats.perfDone}/{stats.perfTotal} ажил гүйцэтгэсэн
            </p>
            <Link href="/performance" className="btn-soft btn-sm mt-4 w-full">
              Гүйцэтгэл рүү
            </Link>
          </div>

          {/* Сүүлийн ажиглалт */}
          <div className="card-pad">
            <h3 className="text-sm font-bold text-ink-800">Сүүлийн ажиглалт</h3>
            {observations.length === 0 ? (
              <p className="mt-4 text-sm text-ink-400">
                Ажиглалтын тэмдэглэл хөтлөөгүй байна.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {observations.map((o) => (
                  <li key={o.id} className="rounded-xl bg-ink-50 px-3 py-2">
                    <div className="text-[13px] font-semibold text-ink-800">
                      {o.teacher}
                    </div>
                    <div className="truncate text-[11px] text-ink-400">
                      {new Date(o.date).toLocaleDateString("mn-MN")} · {o.topic || "Сэдэвгүй"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/observations" className="btn-soft btn-sm mt-4 w-full">
              Бүгдийг харах
            </Link>
          </div>
        </div>

        {/* Түргэн шилжилт */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-ink-800">Түргэн шилжилт</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="group rounded-2xl border border-[#d7e8e6] bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lift"
              >
                <div className="mb-2 text-xl">{q.icon}</div>
                <div className="text-[13px] font-bold text-ink-900 group-hover:text-teal-600">
                  {q.label}
                </div>
                <div className="text-[11px] text-ink-400">{q.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Step({
  n,
  done,
  children,
}: {
  n: number;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${
          done ? "bg-aqua-700 text-white" : "bg-gold-300 text-gold-900"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span className={done ? "line-through opacity-50" : ""}>{children}</span>
    </li>
  );
}
