"use client";

import { useEffect, useState } from "react";

// ------------------------------------------------------------------
// Modal
// ------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-ink-900/40 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`mx-auto rounded-2xl border border-[#d7e8e6] bg-white shadow-lift ${
          wide ? "max-w-4xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#d7e8e6] px-6 py-4">
          <div>
            <h3 className="text-base font-extrabold text-ink-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-lg leading-none text-ink-300 hover:bg-ink-50 hover:text-ink-600"
            aria-label="Хаах"
          >
            ×
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[#d7e8e6] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Талбар
// ------------------------------------------------------------------
export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

// ------------------------------------------------------------------
// Хоосон төлөв
// ------------------------------------------------------------------
export function Empty({
  icon = "📭",
  title,
  desc,
  action,
}: {
  icon?: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-[#c2ded9] bg-white/60 px-6 py-16 text-center">
      <div className="mb-3 text-4xl opacity-60">{icon}</div>
      <h3 className="text-base font-bold text-ink-800">{title}</h3>
      {desc && <p className="mt-1.5 max-w-sm text-sm text-ink-400">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ------------------------------------------------------------------
// Тооны хайрцаг
// ------------------------------------------------------------------
export function StatCard({
  label,
  value,
  sub,
  tone = "geo",
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  /** Логоны өнгөнүүд: geo=цэнхэр, aqua=номин, sun=улбар шар, amber=алт, ink=саарал */
  tone?: "geo" | "aqua" | "sun" | "amber" | "ink";
  icon?: string;
}) {
  const tones: Record<string, string> = {
    geo: "from-teal-100 to-teal-50 text-teal-800",
    aqua: "from-seafoam-100 to-seafoam-50 text-seafoam-800",
    sun: "from-pink-100 to-pink-50 text-pink-800",
    amber: "from-coral-100 to-coral-50 text-coral-800",
    ink: "from-ink-100 to-ink-50 text-ink-800",
  };
  return (
    <div
      className={`rounded-2xl border border-[#d7e8e6] bg-gradient-to-br ${tones[tone]} p-5 shadow-soft`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-black leading-none">{value}</div>
          <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wide opacity-70">
            {label}
          </div>
          {sub && <div className="mt-1 text-[11px] opacity-60">{sub}</div>}
        </div>
        {icon && <div className="text-2xl opacity-50">{icon}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Мэдэгдэл
// ------------------------------------------------------------------
export function useToast() {
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const show = (text: string, ok = true) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3800);
  };

  const node = toast ? (
    <div
      className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 animate-fade-up rounded-xl border px-5 py-3 text-sm font-semibold shadow-lift ${
        toast.ok
          ? "border-seafoam-200 bg-seafoam-50 text-seafoam-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {toast.text}
    </div>
  ) : null;

  return { show, node };
}

// ------------------------------------------------------------------
// Ачааллаж буй
// ------------------------------------------------------------------
export function Loading({ text = "Ачаалж байна…" }: { text?: string }) {
  return (
    <div className="grid place-items-center py-20 text-sm font-medium text-ink-400">
      <div className="mb-3 h-8 w-8 animate-spin rounded-full border-[3px] border-teal-200 border-t-teal-500" />
      {text}
    </div>
  );
}

// ------------------------------------------------------------------
// Хэсгийн гарчиг
// ------------------------------------------------------------------
export function SectionHead({
  title,
  desc,
  right,
}: {
  title: string;
  desc?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="section-title">{title}</h2>
        {desc && <p className="mt-0.5 text-sm text-ink-400">{desc}</p>}
      </div>
      {right && <div className="flex flex-wrap gap-2">{right}</div>}
    </div>
  );
}
