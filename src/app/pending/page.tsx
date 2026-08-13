import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") redirect("/admin");
  if (profile?.status === "approved") redirect("/dashboard");

  const rejected = profile?.status === "rejected";

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f4fbfa] px-5">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-0 h-[30rem] w-[30rem] rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-coral-300/30 blur-3xl" />
      </div>

      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/85 p-9 text-center shadow-lift backdrop-blur-xl">
        <div
          className={`mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl text-3xl ${
            rejected ? "bg-red-100" : "bg-coral-100"
          }`}
        >
          {rejected ? "✕" : "⏳"}
        </div>

        <h1 className="text-2xl font-black tracking-tight text-ink-900">
          {rejected ? "Бүртгэл татгалзагдсан" : "Баталгаажуулалт хүлээгдэж байна"}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-ink-500">
          {rejected ? (
            <>
              Таны бүртгэлийг админ баталгаажуулаагүй байна.
              {profile?.reject_reason && (
                <span className="mt-3 block rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-left text-[13px] font-medium text-red-700">
                  <b>Шалтгаан:</b> {profile.reject_reason}
                </span>
              )}
            </>
          ) : (
            <>
              Сайн байна уу,{" "}
              <b className="text-ink-800">
                {profile?.last_name} {profile?.first_name}
              </b>
              . Таны бүртгэлийг админ хянаж байна. Батлагдмагц энэ хуудсыг
              сэргээхэд систем рүү автоматаар орно.
            </>
          )}
        </p>

        <dl className="mt-6 space-y-2 rounded-2xl border border-[#d7e8e6] bg-ink-50/60 p-4 text-left text-[13px]">
          <Row label="И-мэйл" value={profile?.email || user.email || "—"} />
          <Row label="Сургууль" value={profile?.school_name || "—"} />
          <Row label="Утас" value={profile?.phone || "—"} />
          <Row
            label="Төлөв"
            value={rejected ? "Татгалзсан" : "Хүлээгдэж буй"}
          />
        </dl>

        <div className="mt-6 flex gap-3">
          <a href="/pending" className="btn-ghost flex-1 py-3">
            Сэргээх
          </a>
          <SignOutButton className="btn-soft flex-1 py-3" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="font-semibold text-ink-400">{label}</dt>
      <dd className="truncate font-medium text-ink-800">{value}</dd>
    </div>
  );
}
