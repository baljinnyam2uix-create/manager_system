/**
 * GEOid лого — вектор хувилбар.
 * Нээлттэй ном + солонгон бөмбөрцөг + луужин + тойрог зам.
 * Өнгө нь брэндийн палитрын эх сурвалж (tailwind.config.ts дахь geo/sun/aqua/amber/ink).
 */
export function LogoMark({
  size = 40,
  className = "",
  title = "GEOid",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  // Нэг хуудсан дээр олон лого байвал gradient id давхцахгүй байх ёстой
  const uid = `lg${Math.abs(hash(`${size}-${title}`))}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        {/* Тойрог зам: улбар шар → эрдэнэ шиш → цэнхэр */}
        <linearGradient id={`${uid}-orbit`} x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0" stopColor="#E14E0C" />
          <stop offset="0.2" stopColor="#F8891A" />
          <stop offset="0.4" stopColor="#FBA92A" />
          <stop offset="0.58" stopColor="#8ED3DE" />
          <stop offset="0.78" stopColor="#2FB9D6" />
          <stop offset="1" stopColor="#1E9BC4" />
        </linearGradient>

        {/* Бөмбөрцөг: солонгон шилжилт */}
        <linearGradient id={`${uid}-globe`} x1="0.08" y1="0.15" x2="0.92" y2="0.9">
          <stop offset="0" stopColor="#63CFC4" />
          <stop offset="0.17" stopColor="#86D9A6" />
          <stop offset="0.35" stopColor="#F0E27A" />
          <stop offset="0.52" stopColor="#F4949E" />
          <stop offset="0.68" stopColor="#F0A054" />
          <stop offset="0.85" stopColor="#3D82D6" />
          <stop offset="1" stopColor="#2FB9D6" />
        </linearGradient>

        {/* Гялбаа */}
        <radialGradient id={`${uid}-shine`} cx="0.34" cy="0.28" r="0.62">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* Номын хуудасны сүүдэр */}
        <linearGradient id={`${uid}-page`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#EAF3F6" />
        </linearGradient>
      </defs>

      {/* ---- Тойрог зам (номын ард) ---- */}
      <ellipse
        cx="60"
        cy="75"
        rx="52"
        ry="20"
        transform="rotate(-6 60 75)"
        stroke={`url(#${uid}-orbit)`}
        strokeWidth="7.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* ---- Бөмбөрцөг ---- */}
      <circle cx="60" cy="50" r="26" fill={`url(#${uid}-globe)`} />
      <circle cx="60" cy="50" r="26" fill={`url(#${uid}-shine)`} />

      {/* ---- Луужин ---- */}
      <circle
        cx="60"
        cy="50"
        r="18.5"
        stroke="#3F6B7C"
        strokeWidth="1.6"
        fill="none"
        opacity="0.9"
      />
      <polygon
        points="60,33 61.99,45.2 72.02,37.98 64.8,48.01 77,50 64.8,51.99 72.02,62.02 61.99,54.8 60,67 58.01,54.8 47.98,62.02 55.2,51.99 43,50 55.2,48.01 47.98,37.98 58.01,45.2"
        fill="#3F6B7C"
      />
      <circle cx="60" cy="50" r="3.1" fill="#ffffff" />
      <circle cx="60" cy="50" r="1.5" fill="#FA7314" />

      {/* ---- Нээлттэй ном ---- */}
      {/* зүүн хуудас */}
      <path
        d="M60 84 C 47 74.5 31 70.5 14.5 72.5 L 14.5 60.5 C 31 58.5 47 62.5 60 72 Z"
        fill={`url(#${uid}-page)`}
        stroke="#3F6B7C"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      {/* баруун хуудас */}
      <path
        d="M60 84 C 73 74.5 89 70.5 105.5 72.5 L 105.5 60.5 C 89 58.5 73 62.5 60 72 Z"
        fill={`url(#${uid}-page)`}
        stroke="#3F6B7C"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      {/* хуудасны нугалаа */}
      <path
        d="M60 72 L 60 84"
        stroke="#3F6B7C"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M22 64.5 C 36 64 48 67.5 57 73.5 M98 64.5 C 84 64 72 67.5 63 73.5"
        stroke="#3F6B7C"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.5"
        fill="none"
      />
    </svg>
  );
}

/**
 * Лого + бичээс. Хажуугийн цэс, нүүр хуудасны толгойд ашиглана.
 */
export function LogoLockup({
  size = 40,
  title = "Сургалтын менежер",
  subtitle,
  className = "",
  compact = false,
}: {
  size?: number;
  title?: string;
  subtitle?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <LogoMark size={size} className="shrink-0" />
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-extrabold tracking-tight text-ink-900">
            {title}
          </span>
          {subtitle && (
            <span className="block truncate text-[11px] font-medium text-ink-400">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
