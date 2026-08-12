import { requireProfile } from "@/lib/guard";
import GradesClient from "./grades-client";

export const dynamic = "force-dynamic";

export default async function GradesPage() {
  const profile = await requireProfile();
  return <GradesClient profile={profile} />;
}
