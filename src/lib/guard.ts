import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/** Батлагдсан хэрэглэгч эсэхийг шалгаад профайлыг буцаана */
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) redirect("/pending");
  if (data.role !== "admin" && data.status !== "approved") redirect("/pending");

  return data as Profile;
}
