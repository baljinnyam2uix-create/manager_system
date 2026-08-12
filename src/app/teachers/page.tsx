import { requireProfile } from "@/lib/guard";
import TeachersClient from "./teachers-client";

export const dynamic = "force-dynamic";

export default async function TeachersPage() {
  const profile = await requireProfile();
  return <TeachersClient profile={profile} />;
}
