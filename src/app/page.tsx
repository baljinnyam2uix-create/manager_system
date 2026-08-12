import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LandingClient from "./landing-client";

const FALLBACK_APHORISMS = [
  { text: "Багш бол ирээдүйг өнөөдөр бүтээж буй цорын ганц мэргэжил.", author: "Криста МакОлифф" },
  { text: "Сургалтын чанар нь багшийн чанараас хэтэрдэггүй.", author: "Андреас Шляйхер" },
  { text: "Боловсрол бол дэлхийг өөрчлөх хамгийн хүчирхэг зэвсэг юм.", author: "Нельсон Мандела" },
  { text: "Хэмжиж чадахгүй зүйлээ удирдаж чадахгүй.", author: "Питер Дракер" },
  { text: "Сурах гэдэг бол сав дүүргэх биш, гал асаах явдал.", author: "Плутарх" },
];

type Aph = { text: string; author: string | null };

async function loadState(): Promise<{
  target: string | null;
  aphorisms: Aph[];
}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { target: null, aphorisms: FALLBACK_APHORISMS };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .maybeSingle();

      const target =
        profile?.role === "admin"
          ? "/admin"
          : profile?.status === "approved"
            ? "/dashboard"
            : "/pending";
      return { target, aphorisms: FALLBACK_APHORISMS };
    }

    const { data } = await supabase
      .from("aphorisms")
      .select("text, author")
      .eq("active", true);

    return {
      target: null,
      aphorisms: data && data.length ? data : FALLBACK_APHORISMS,
    };
  } catch {
    // Supabase тохируулаагүй / холбогдоогүй бол нүүр хуудас хэвийн харагдана
    return { target: null, aphorisms: FALLBACK_APHORISMS };
  }
}

export default async function Home() {
  const { target, aphorisms } = await loadState();
  if (target) redirect(target);
  return <LandingClient aphorisms={aphorisms} />;
}
