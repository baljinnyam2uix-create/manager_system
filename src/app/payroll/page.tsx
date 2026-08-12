import { requireProfile } from "@/lib/guard";
import PayrollClient from "./payroll-client";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const profile = await requireProfile();
  return <PayrollClient profile={profile} />;
}
