/* eslint-disable @next/next/no-img-element */

/**
 * GEid лого — /public/logo.png (эх SVG-ээс задалж, тайрч бэлдсэн).
 * Хэвтээ бүтэцтэй (харьцаа 1.15:1) тул `width`-ээр хэмжинэ.
 */
export function LogoMark({
  width = 132,
  className = "",
  priority = false,
}: {
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src="/logo.png"
      alt="GEid"
      width={width}
      height={Math.round(width / 1.152)}
      className={`select-none object-contain ${className}`}
      style={{ width, height: "auto" }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
    />
  );
}

/**
 * Лого + бичээс — хажуугийн цэс, толгой хэсэгт.
 */
export function LogoLockup({
  width = 132,
  subtitle,
  className = "",
}: {
  width?: number;
  subtitle?: string;
  className?: string;
}) {
  return (
    <span className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <LogoMark width={width} priority />
      {subtitle && (
        <span className="truncate text-[11px] font-medium text-ink-400">
          {subtitle}
        </span>
      )}
    </span>
  );
}

/**
 * Дэвсгэрийн хөдөлгөөнт дүрс тэмдэгүүд.
 * Боловсролын сэдэвт тэмдэгүүд удаан хөвж, дэвсгэрт амьд байдал өгнө.
 * Уншихад саад болохгүйн тулд маш бүдэг, товчлууртай харилцахгүй.
 */
const ICONS = [
  { c: "📐", top: "8%", left: "4%", size: 40, delay: "0s", dur: "26s" },
  { c: "📚", top: "18%", left: "91%", size: 46, delay: "3s", dur: "31s" },
  { c: "🗓️", top: "62%", left: "2%", size: 42, delay: "6s", dur: "28s" },
  { c: "✏️", top: "78%", left: "88%", size: 38, delay: "1.5s", dur: "24s" },
  { c: "🧭", top: "42%", left: "95%", size: 44, delay: "8s", dur: "34s" },
  { c: "🌍", top: "88%", left: "46%", size: 40, delay: "4s", dur: "30s" },
  { c: "📊", top: "34%", left: "8%", size: 36, delay: "10s", dur: "27s" },
  { c: "🎓", top: "6%", left: "58%", size: 42, delay: "2s", dur: "33s" },
];

export function BackgroundIcons({ dense = false }: { dense?: boolean }) {
  const list = dense ? ICONS : ICONS.slice(0, 5);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {list.map((i, n) => (
        <span
          key={n}
          className="bg-icon animate-drift"
          style={{
            top: i.top,
            left: i.left,
            fontSize: i.size,
            opacity: 0.12,
            animationDelay: i.delay,
            animationDuration: i.dur,
          }}
        >
          {i.c}
        </span>
      ))}

      {/* Зөөлөн өнгөт бөмбөлгүүд — логоны өнгөөр */}
      <span
        className="animate-pulse-soft absolute -left-32 top-10 h-[26rem] w-[26rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(36,158,160,.30), transparent 70%)" }}
      />
      <span
        className="animate-pulse-soft absolute -right-28 top-1/3 h-[22rem] w-[22rem] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(250,171,54,.28), transparent 70%)",
          animationDelay: "2.5s",
        }}
      />
      <span
        className="animate-pulse-soft absolute bottom-[-8rem] left-1/3 h-[24rem] w-[24rem] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(247,129,4,.22), transparent 70%)",
          animationDelay: "5s",
        }}
      />
    </div>
  );
}
