"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/logo";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    last_name: "",
    first_name: "",
    phone: "",
    school_name: "",
    email: "",
    password: "",
    password2: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password.length < 8) {
      setError("Нууц үг дор хаяж 8 тэмдэгт байх ёстой.");
      return;
    }
    if (form.password !== form.password2) {
      setError("Нууц үг таарахгүй байна.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            last_name: form.last_name.trim(),
            first_name: form.first_name.trim(),
            phone: form.phone.trim(),
            school_name: form.school_name.trim(),
          },
        },
      });
      if (error) throw error;
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Бүртгэлд алдаа гарлаа";
      setError(
        msg.includes("already registered")
          ? "Энэ и-мэйл аль хэдийн бүртгэгдсэн байна."
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-aqua-100 text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink-900">
            Бүртгэл амжилттай!
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
            Таны бүртгэлийг <b className="text-ink-700">админ хянан батлах</b>{" "}
            хүлээгдэж байна. Баталгаажсаны дараа системд бүрэн нэвтрэх боломжтой
            болно.
            <br />
            <br />
            Хэрэв и-мэйл баталгаажуулалт идэвхтэй бол{" "}
            <b className="text-ink-700">{form.email}</b> хаяг руу илгээсэн
            холбоосыг дарна уу.
          </p>
          <button
            onClick={() => router.push("/")}
            className="btn-primary mt-7 w-full py-3"
          >
            Нэвтрэх хуудас руу буцах
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-ink-900">
          Менежерээр бүртгүүлэх
        </h1>
        <p className="mt-1.5 text-sm text-ink-400">
          Мэдээллээ бөглөснөөр админ таны эрхийг баталгаажуулна
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Овог *</label>
            <input required className="input" placeholder="Гантөмөр" value={form.last_name} onChange={set("last_name")} />
          </div>
          <div>
            <label className="label">Нэр *</label>
            <input required className="input" placeholder="Энхжаргал" value={form.first_name} onChange={set("first_name")} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Утас</label>
            <input className="input" placeholder="99112233" value={form.phone} onChange={set("phone")} />
          </div>
          <div>
            <label className="label">Сургуулийн нэр *</label>
            <input required className="input" placeholder="ЕБ-ын 2-р сургууль" value={form.school_name} onChange={set("school_name")} />
          </div>
        </div>

        <div>
          <label className="label">И-мэйл хаяг *</label>
          <input required type="email" autoComplete="email" className="input" placeholder="menejer@surguuli.mn" value={form.email} onChange={set("email")} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Нууц үг *</label>
            <input required type="password" autoComplete="new-password" className="input" placeholder="Хамгийн багадаа 8 тэмдэгт" value={form.password} onChange={set("password")} />
          </div>
          <div>
            <label className="label">Нууц үг давтах *</label>
            <input required type="password" autoComplete="new-password" className="input" placeholder="••••••••" value={form.password2} onChange={set("password2")} />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? "Бүртгэж байна…" : "Бүртгүүлэх"}
        </button>

        <p className="text-center text-sm text-ink-400">
          Бүртгэлтэй юу?{" "}
          <Link href="/" className="font-semibold text-geo-600 hover:underline">
            Нэвтрэх
          </Link>
        </p>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f6fafb] px-5 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-0 h-[30rem] w-[30rem] rounded-full bg-geo-400/25 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-sun-300/30 blur-3xl" />
      </div>
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-6 flex items-center justify-center gap-3">
          <LogoMark size={46} />
          <span className="text-[15px] font-extrabold tracking-tight text-ink-900">
            Сургалтын менежер
          </span>
        </Link>
        <div className="rounded-3xl border border-white/70 bg-white/85 p-7 shadow-lift backdrop-blur-xl sm:p-9">
          {children}
        </div>
      </div>
    </div>
  );
}
