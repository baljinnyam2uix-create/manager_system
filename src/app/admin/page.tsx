import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminClient from "./admin-client";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export interface Aphorism {
  id: string;
  text: string;
  author: string | null;
  active: boolean;
}

export interface School {
  id: string;
  name: string;
  aimag: string | null;
  soum: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

/** Менежер бүрийн оруулсан өгөгдлийн хэмжээ */
export interface ManagerUsage {
  owner_id: string;
  teachers: number;
  classes: number;
  students: number;
  slots: number;
  observations: number;
  plans: number;
}

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

  // Админ RLS-ээр бүх мөрийг харна
  const [profiles, aphorisms, schools, audit, tch, cls, stu, slt, obs, pln] =
    await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("aphorisms").select("*").order("text"),
      supabase.from("schools").select("*").order("name"),
      supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("teachers").select("owner_id"),
      supabase.from("classes").select("owner_id"),
      supabase.from("students").select("owner_id"),
      supabase.from("schedule_slots").select("owner_id"),
      supabase.from("observations").select("owner_id"),
      supabase.from("plans").select("owner_id"),
    ]);

  const list = (profiles.data || []) as Profile[];

  // Эзэмшигчээр бүлэглэж тоолно
  const tally = (rows: { owner_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows || []) m.set(r.owner_id, (m.get(r.owner_id) || 0) + 1);
    return m;
  };
  const T = tally(tch.data), C = tally(cls.data), S = tally(stu.data);
  const L = tally(slt.data), O = tally(obs.data), P = tally(pln.data);

  const usage: ManagerUsage[] = list.map((p) => ({
    owner_id: p.id,
    teachers: T.get(p.id) || 0,
    classes: C.get(p.id) || 0,
    students: S.get(p.id) || 0,
    slots: L.get(p.id) || 0,
    observations: O.get(p.id) || 0,
    plans: P.get(p.id) || 0,
  }));

  return (
    <AdminClient
      me={me as Profile}
      profiles={list}
      aphorisms={(aphorisms.data || []) as Aphorism[]}
      schools={(schools.data || []) as School[]}
      audit={(audit.data || []) as AuditEntry[]}
      usage={usage}
      totals={{
        teachers: tch.data?.length || 0,
        classes: cls.data?.length || 0,
        students: stu.data?.length || 0,
        slots: slt.data?.length || 0,
        observations: obs.data?.length || 0,
        plans: pln.data?.length || 0,
      }}
    />
  );
}
