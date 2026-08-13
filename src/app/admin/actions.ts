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

/** Админы үйлдлийг журналд бичнэ */
async function log(
  actorId: string,
  action: string,
  entity: string,
  entityId: string | null,
  detail?: Record<string, unknown>
) {
  const supabase = await createClient();
  await supabase.from("audit_log").insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    detail: detail || null,
  });
}

// =====================================================================
//  АФОРИЗМ — нүүр хуудсанд харагдах урам зоригийн үг
// =====================================================================

export async function saveAphorism(input: {
  id?: string;
  text: string;
  author: string | null;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  if (!input.text.trim()) return { error: "Афоризмын текстийг бичнэ үү" };

  const supabase = await createClient();
  const payload = {
    text: input.text.trim(),
    author: input.author?.trim() || null,
    active: input.active,
  };

  const { error } = input.id
    ? await supabase.from("aphorisms").update(payload).eq("id", input.id)
    : await supabase.from("aphorisms").insert(payload);

  if (error) {
    return {
      error: error.message.includes("uq_aphorism_text")
        ? "Ийм афоризм аль хэдийн бүртгэгдсэн байна"
        : error.message,
    };
  }

  await log(auth.userId, input.id ? "update_aphorism" : "create_aphorism", "aphorisms", input.id || null, {
    text: payload.text.slice(0, 60),
  });
  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

export async function deleteAphorism(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase.from("aphorisms").delete().eq("id", id);
  if (error) return { error: error.message };

  await log(auth.userId, "delete_aphorism", "aphorisms", id);
  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

export async function toggleAphorism(
  id: string,
  active: boolean
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase.from("aphorisms").update({ active }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

// =====================================================================
//  СУРГУУЛЬ — системд бүртгэлтэй байгууллагууд
// =====================================================================

export async function saveSchool(input: {
  id?: string;
  name: string;
  aimag: string | null;
  soum: string | null;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  if (!input.name.trim()) return { error: "Сургуулийн нэрийг бичнэ үү" };

  const supabase = await createClient();
  const payload = {
    name: input.name.trim(),
    aimag: input.aimag?.trim() || null,
    soum: input.soum?.trim() || null,
  };

  const { error } = input.id
    ? await supabase.from("schools").update(payload).eq("id", input.id)
    : await supabase.from("schools").insert(payload);

  if (error) return { error: error.message };

  await log(auth.userId, input.id ? "update_school" : "create_school", "schools", input.id || null, {
    name: payload.name,
  });
  revalidatePath("/admin");
  return {};
}

export async function deleteSchool(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase.from("schools").delete().eq("id", id);
  if (error) return { error: error.message };

  await log(auth.userId, "delete_school", "schools", id);
  revalidatePath("/admin");
  return {};
}

/** Менежерийг сургуульд хамааруулах */
export async function assignSchool(
  profileId: string,
  schoolId: string | null
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ school_id: schoolId, updated_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) return { error: error.message };

  await log(auth.userId, "assign_school", "profiles", profileId, { schoolId });
  revalidatePath("/admin");
  return {};
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
