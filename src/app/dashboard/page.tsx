import { requireProfile } from "@/lib/guard";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [teachers, classes, subjects, slots, plans, planItems, obs, students, perf] =
    await Promise.all([
      supabase.from("teachers").select("id, is_homeroom, rank", { count: "exact" }),
      supabase.from("classes").select("id", { count: "exact", head: true }),
      supabase.from("subjects").select("id", { count: "exact", head: true }),
      supabase
        .from("schedule_versions")
        .select("id, name, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.from("plans").select("id", { count: "exact", head: true }),
      supabase.from("plan_items").select("status, progress"),
      supabase
        .from("observations")
        .select("id, observed_date, topic, teacher_id, teachers(last_name, first_name)")
        .order("observed_date", { ascending: false })
        .limit(5),
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("performance_tasks").select("is_done, score, max_score"),
    ]);

  let slotCount = 0;
  const activeVersion = slots.data?.[0];
  if (activeVersion) {
    const { count } = await supabase
      .from("schedule_slots")
      .select("id", { count: "exact", head: true })
      .eq("version_id", activeVersion.id);
    slotCount = count || 0;
  }

  const items = planItems.data || [];
  const perfTasks = perf.data || [];

  return (
    <DashboardClient
      profile={profile}
      stats={{
        teachers: teachers.count || 0,
        homeroom: (teachers.data || []).filter((t) => t.is_homeroom).length,
        classes: classes.count || 0,
        subjects: subjects.count || 0,
        slots: slotCount,
        students: students.count || 0,
        plans: plans.count || 0,
        planItemsTotal: items.length,
        planItemsDone: items.filter((i) => i.status === "done").length,
        planProgress: items.length
          ? Math.round(items.reduce((s, i) => s + (i.progress || 0), 0) / items.length)
          : 0,
        perfTotal: perfTasks.length,
        perfDone: perfTasks.filter((t) => t.is_done).length,
        perfScore: (() => {
          const scored = perfTasks.filter((t) => t.score != null);
          if (!scored.length) return 0;
          const got = scored.reduce((s, t) => s + Number(t.score || 0), 0);
          const max = scored.reduce((s, t) => s + Number(t.max_score || 10), 0);
          return max ? Math.round((got / max) * 100) : 0;
        })(),
      }}
      activeVersion={activeVersion || null}
      observations={
        (obs.data || []).map((o) => {
          const t = o.teachers as unknown as
            | { last_name: string; first_name: string }
            | { last_name: string; first_name: string }[]
            | null;
          const tt = Array.isArray(t) ? t[0] : t;
          return {
            id: o.id,
            date: o.observed_date,
            topic: o.topic,
            teacher: tt ? `${tt.last_name} ${tt.first_name}` : "—",
          };
        })
      }
    />
  );
}
