import { requireProfile } from "@/lib/guard";
import PlansClient from "./plans-client";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const profile = await requireProfile();
  return <PlansClient profile={profile} />;
}
