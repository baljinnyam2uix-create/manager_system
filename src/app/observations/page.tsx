import { requireProfile } from "@/lib/guard";
import ObservationsClient from "./observations-client";

export const dynamic = "force-dynamic";

export default async function ObservationsPage() {
  const profile = await requireProfile();
  return <ObservationsClient profile={profile} />;
}
