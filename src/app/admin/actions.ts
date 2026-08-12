"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { ApprovalStatus, UserRole } from "@/lib/types";

/** Дуудагч нь админ мөн эсэхийг шалгана */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Нэвтрээгүй байна" };

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (data?.role !== "admin")
    return { ok: false as const, error: "Админ эрх шаардлагатай" };

  return { ok: true as const, userId: user.id };
}

export async function approveProfile(
  id: string,
  status: ApprovalStatus,
  reason?: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      approved_by: auth.userId,
      reject_reason: status === "rejected" ? reason || null : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor_id: auth.userId,
    action: status === "approved" ? "approve_manager" : "reject_manager",
    entity: "profiles",
    entity_id: id,
    detail: { reason: reason || null },
  });

  revalidatePath("/admin");
  return {};
}

export async function setRole(
  id: string,
  role: UserRole
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  if (id === auth.userId)
    return { error: "Өөрийн эрхийг өөрчлөх боломжгүй" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor_id: auth.userId,
    action: "set_role",
    entity: "profiles",
    entity_id: id,
    detail: { role },
  });

  revalidatePath("/admin");
  return {};
}

export async function deleteProfile(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  if (id === auth.userId) return { error: "Өөрийгөө устгах боломжгүй" };

  try {
    // auth.users-ээс устгахад profiles болон холбогдох өгөгдөл cascade-аар устана
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return { error: error.message };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `${e.message}. SUPABASE_SERVICE_ROLE_KEY тохируулсан эсэхээ шалгана уу.`
          : "Устгахад алдаа гарлаа",
    };
  }

  revalidatePath("/admin");
  return {};
}
