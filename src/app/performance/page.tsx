import { requireProfile } from "@/lib/guard";
import PerformanceClient from "./performance-client";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const profile = await requireProfile();
  return <PerformanceClient profile={profile} />;
}
