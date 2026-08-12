import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";
import AdminClient from "./admin-client";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: me } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "admin") redirect("/dashboard");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const list = (profiles || []) as Profile[];
  const pending = list.filter((p) => p.status === "pending");
  const approved = list.filter((p) => p.status === "approved");
  const rejected = list.filter((p) => p.status === "rejected");

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="sticky top-0 z-20 border-b border-[#e8e3dd] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-ink-800 to-ink-900 text-sm font-black text-white">
              А
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-ink-900">
                Админ удирдлага
              </div>
              <div className="text-[11px] text-ink-400">
                {me.last_name} {me.first_name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/dashboard" className="btn-ghost btn-sm">
              Систем рүү
            </a>
            <SignOutButton className="btn-soft btn-sm" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Хүлээгдэж буй" value={pending.length} tone="sand" />
          <Stat label="Батлагдсан" value={approved.length} tone="aqua" />
          <Stat label="Татгалзсан" value={rejected.length} tone="red" />
        </div>

        <AdminClient profiles={list} meId={me.id} />
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "sand" | "aqua" | "red";
}) {
  const tones = {
    sand: "from-sand-100 to-sand-50 text-sand-700",
    aqua: "from-aqua-100 to-aqua-50 text-aqua-700",
    red: "from-red-100 to-red-50 text-red-700",
  };
  return (
    <div
      className={`rounded-2xl border border-[#e8e3dd] bg-gradient-to-br ${tones[tone]} p-5 shadow-soft`}
    >
      <div className="text-3xl font-black">{value}</div>
      <div className="mt-0.5 text-xs font-bold uppercase tracking-wide opacity-70">
        {label}
      </div>
    </div>
  );
}
