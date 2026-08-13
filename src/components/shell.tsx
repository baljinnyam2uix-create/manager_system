"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import SignOutButton from "./sign-out-button";
import { LogoMark, BackgroundIcons } from "./logo";

export const NAV = [
  { href: "/dashboard", icon: "🏠", label: "Хяналтын самбар" },
  { href: "/teachers", icon: "👩‍🏫", label: "Багшийн бүртгэл" },
  { href: "/schedule", icon: "🗓️", label: "Хичээлийн хуваарь" },
  { href: "/performance", icon: "✅", label: "Ажлын гүйцэтгэл" },
  { href: "/plans", icon: "📋", label: "Төлөвлөгөө" },
  { href: "/payroll", icon: "💰", label: "Цаг, цалин" },
  { href: "/observations", icon: "🔍", label: "Ажиглалтын тэмдэглэл" },
  { href: "/grades", icon: "📊", label: "Дүнгийн матриц" },
  { href: "/settings", icon: "⚙️", label: "Тохиргоо" },
];

export default function Shell({
  children,
  profile,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  profile: { first_name?: string | null; last_name?: string | null; role?: string; school_name?: string | null };
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard" ? path === href : path.startsWith(href);

  return (
    <div className="min-h-screen">
      <BackgroundIcons />
      {/* ---------- Хажуугийн цэс ---------- */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-64 border-r border-[#d7e8e6] bg-white transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <Link
            href="/dashboard"
            className="block border-b border-[#d7e8e6] px-5 py-4"
          >
            <LogoMark width={142} priority />
            <div className="mt-1 min-w-0 leading-tight">
              <div className="truncate text-[11px] font-semibold text-ink-500">
                Сургалтын менежер
              </div>
              <div className="truncate text-[11px] text-ink-400">
                {profile.school_name || "Систем"}
              </div>
            </div>
          </Link>

          <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                  isActive(n.href)
                    ? "bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-soft"
                    : "text-ink-600 hover:bg-ink-50"
                }`}
              >
                <span className="text-base">{n.icon}</span>
                <span className="truncate">{n.label}</span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-[#d7e8e6] p-3">
            {profile.role === "admin" && (
              <Link
                href="/admin"
                className="mb-2 flex items-center gap-3 rounded-xl bg-ink-900 px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-ink-800"
              >
                <span className="text-base">🛡️</span> Админ удирдлага
              </Link>
            )}
            <div className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-100 text-xs font-black text-teal-700">
                {(profile.first_name || "?").charAt(0)}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[12px] font-bold text-ink-800">
                  {profile.last_name} {profile.first_name}
                </div>
                <div className="text-[10px] text-ink-400">
                  {profile.role === "admin" ? "Админ" : "Менежер"}
                </div>
              </div>
              <SignOutButton className="btn btn-sm px-2 text-ink-400 hover:bg-white" label="↪" />
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink-900/30 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ---------- Агуулга ---------- */}
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 border-b border-[#d7e8e6] bg-white/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-5 py-4">
            <button
              onClick={() => setOpen(true)}
              className="btn-ghost btn-sm lg:hidden"
              aria-label="Цэс"
            >
              ☰
            </button>
            <div className="min-w-0 flex-1">
              {title && (
                <h1 className="truncate text-lg font-extrabold tracking-tight text-ink-900">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="truncate text-xs text-ink-400">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
          </div>
        </header>

        <main className="p-5 pb-16">{children}</main>
      </div>
    </div>
  );
}
