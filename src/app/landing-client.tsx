"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogoMark, BackgroundIcons } from "@/components/logo";

type Aph = { text: string; author: string | null };

const FEATURES = [
  {
    icon: "🗓️",
    title: "Хичээлийн хуваарь",
    desc: "Багш, кабинет давхцахгүй, 7 хоногийн цаг яг таарсан хуваарийг автоматаар зохионо. Багшаар, ангиар, нэгдсэн харагдац.",
    tint: "from-teal-500/12 to-teal-500/0",
  },
  {
    icon: "✅",
    title: "Ажлын гүйцэтгэл",
    desc: "Багшийн гүйцэтгэх ажлыг төлөвлөгөөнөөс сонгож эсвэл шинээр нэмж чеклэн дүгнэж, оноо, тайлбар бичнэ.",
    tint: "from-aqua-500/12 to-aqua-500/0",
  },
  {
    icon: "📋",
    title: "Менежерийн төлөвлөгөө",
    desc: "Жил, улирал, сар, 7 хоногийн төлөвлөгөөг зорилго, хугацаа, хариуцагч, шалгуур үзүүлэлттэйгээр боловсруулна.",
    tint: "from-orange-500/12 to-orange-500/0",
  },
  {
    icon: "💰",
    title: "Цагийн тооцоо, цалин",
    desc: "Хичээл заасан, орлон заасан, илүү цаг, СХА, анги даалт, зэрэг, ур чадварын нэмэгдлээр цалинг бодно.",
    tint: "from-gold-500/12 to-gold-500/0",
  },
  {
    icon: "👩‍🏫",
    title: "Багшийн бүртгэл",
    desc: "Овог нэр, РД, утас, хаяг, ажилласан жил, судлагдахуун, ордог анги, долоо хоногийн цаг, анги даалт.",
    tint: "from-teal-500/12 to-aqua-500/0",
  },
  {
    icon: "🔍",
    title: "Ажиглалтын тэмдэглэл",
    desc: "Хичээлд суусан тэмдэглэл: багш, анги, цаг, сэдэв, ажиглалт, давуу тал, зөвлөмж.",
    tint: "from-aqua-500/12 to-orange-500/0",
  },
  {
    icon: "📊",
    title: "Дүнгийн матриц",
    desc: "Сургуулийн хэмжээний дүнгийн нэгдсэн матриц: анги, сурагч, судлагдахуун, улирлаар шүүж дүгнэнэ.",
    tint: "from-orange-500/12 to-gold-500/0",
  },
  {
    icon: "🛡️",
    title: "Админ баталгаажуулалт",
    desc: "Менежерүүд бүртгүүлж, админ баталсны дараа системд нэвтэрнэ. Тусдаа админ эрхтэй.",
    tint: "from-ink-500/10 to-ink-500/0",
  },
];

export default function LandingClient({ aphorisms }: { aphorisms: Aph[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (aphorisms.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % aphorisms.length), 7000);
    return () => clearInterval(t);
  }, [aphorisms.length]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.role === "admin") router.push("/admin");
      else if (profile?.status === "approved") router.push("/dashboard");
      else router.push("/pending");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Нэвтрэхэд алдаа гарлаа";
      setError(
        msg.includes("Invalid login")
          ? "И-мэйл эсвэл нууц үг буруу байна."
          : msg.includes("Email not confirmed")
            ? "И-мэйл хаягаа баталгаажуулна уу."
            : msg
      );
    } finally {
      setLoading(false);
    }
  }

  const aph = aphorisms[idx] || aphorisms[0];

  return (
    <div className="relative min-h-screen">
      <BackgroundIcons dense />

      {/* ---------------- Толгой ---------------- */}
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
        <div className="flex items-center gap-3">
          <LogoMark width={148} priority />
          <div className="hidden leading-tight sm:block">
            <div className="text-[14px] font-extrabold tracking-tight text-ink-900">
              Сургалтын менежер
            </div>
            <div className="text-[11px] font-medium text-ink-400">
              Цогц удирдлагын систем
            </div>
          </div>
        </div>
        <Link href="/register" className="btn-ghost btn-sm sm:btn">
          Бүртгүүлэх
        </Link>
      </header>

      {/* ---------------- Гол хэсэг ---------------- */}
      <main className="mx-auto max-w-7xl px-5 pb-20">
        <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_.85fr]">
          {/* Зүүн — тайлбар */}
          <div className="animate-fade-up pt-6">
            <span className="badge bg-teal-100 text-teal-700">
              2025–2026 оны хичээлийн жил
            </span>

            <h1 className="mt-5 text-4xl font-black leading-[1.1] tracking-tight text-ink-900 sm:text-5xl lg:text-[3.4rem]">
              Сургуулийн сургалтын
              {/* Цайвар дэвсгэр дээрх текст тул гүн сүүдрүүдийг ашиглав */}
              <span className="block bg-gradient-to-r from-teal-700 via-aqua-600 to-orange-700 bg-clip-text text-transparent">
                удирдлагыг нэг дороос
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-500">
              Хичээлийн хуваарь зохиох, багшийн бүртгэл хөтлөх, ажлын гүйцэтгэл
              дүгнэх, төлөвлөгөө боловсруулах, цагийн тооцоо хийж цалин бодох,
              дүнгийн нэгдсэн матриц гаргах — бүгд нэг системд.
            </p>

            {/* Афоризм */}
            <div className="relative mt-8 max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl">
              <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-teal-500 via-aqua-400 to-orange-400" />
              <div className="pl-3">
                <div className="mb-2 text-2xl leading-none text-teal-400">❝</div>
                <p
                  key={idx}
                  className="animate-fade-up text-[17px] font-semibold leading-relaxed text-ink-800"
                >
                  {aph?.text}
                </p>
                {aph?.author && (
                  <p className="mt-2.5 text-sm font-medium text-ink-400">
                    — {aph.author}
                  </p>
                )}
                {aphorisms.length > 1 && (
                  <div className="mt-4 flex gap-1.5">
                    {aphorisms.map((_, i) => (
                      <button
                        key={i}
                        aria-label={`Афоризм ${i + 1}`}
                        onClick={() => setIdx(i)}
                        className={`h-1.5 rounded-full transition-all ${
                          i === idx
                            ? "w-6 bg-teal-500"
                            : "w-1.5 bg-ink-200 hover:bg-ink-300"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Баруун — нэвтрэх */}
          <div className="animate-fade-up lg:sticky lg:top-8">
            <div className="rounded-3xl border border-white/70 bg-white/85 p-7 shadow-lift backdrop-blur-xl">
              <h2 className="text-xl font-extrabold tracking-tight text-ink-900">
                Системд нэвтрэх
              </h2>
              <p className="mt-1 text-sm text-ink-400">
                Менежер болон админы нэгдсэн хаалга
              </p>

              <form onSubmit={signIn} className="mt-6 space-y-4">
                <div>
                  <label className="label">И-мэйл хаяг</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    className="input"
                    placeholder="menejer@surguuli.mn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Нууц үг</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      className="input pr-12"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-ink-400 hover:bg-ink-50"
                    >
                      {showPw ? "Нуух" : "Харах"}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3"
                >
                  {loading ? "Нэвтэрч байна…" : "Нэвтрэх"}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-ink-100" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
                  эсвэл
                </span>
                <div className="h-px flex-1 bg-ink-100" />
              </div>

              <Link href="/register" className="btn-ghost w-full py-3">
                Шинээр бүртгүүлэх
              </Link>

              <p className="mt-4 text-center text-xs leading-relaxed text-ink-400">
                Бүртгүүлсний дараа <b className="text-ink-600">админ баталсны</b>{" "}
                дараа системд нэвтрэх боломжтой болно.
              </p>
            </div>
          </div>
        </div>

        {/* ---------------- Боломжууд ---------------- */}
        <section className="mt-20">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">
              Системийн боломжууд
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-ink-400">
              Сургалтын менежерийн өдөр тутмын ажлыг бүрэн хамарсан систем
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`group relative overflow-hidden rounded-2xl border border-white/70 bg-white/70 p-5 shadow-soft backdrop-blur transition-all hover:-translate-y-1 hover:shadow-lift`}
              >
                <div
                  className={`absolute inset-0 -z-10 bg-gradient-to-br ${f.tint} opacity-0 transition-opacity group-hover:opacity-100`}
                />
                <div className="mb-3 text-2xl">{f.icon}</div>
                <h3 className="text-[15px] font-bold text-ink-900">{f.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#d7e8e6] bg-white/50 py-6 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 text-xs text-ink-400 sm:flex-row">
          <span>© {new Date().getFullYear()} Сургалтын менежерийн систем</span>
          <span>Next.js · Supabase · Vercel</span>
        </div>
      </footer>
    </div>
  );
}
