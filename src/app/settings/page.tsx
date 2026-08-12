import { requireProfile } from "@/lib/guard";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await requireProfile();
  return <SettingsClient profile={profile} />;
}
