import { requireProfile } from "@/lib/guard";
import ScheduleClient from "./schedule-client";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const profile = await requireProfile();
  return <ScheduleClient profile={profile} />;
}
