import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PUBLIC_PATHS = ["/", "/register", "/login", "/pending", "/auth"];

/**
 * Сешн шинэчлэх + эрхийн урьдчилсан шалгалт.
 *
 * ⚠ ХАМГААЛАЛТЫН ЗАРЧИМ
 * Энэ middleware бол ЗӨВХӨН чиглүүлэлтийн давхарга — хурдан шилжүүлэх,
 * cookie сэргээх зорилготой. Жинхэнэ хамгаалалт хоёр газар байдаг:
 *   1. Хуудас бүр дотор requireProfile() (сервер тал)
 *   2. Өгөгдлийн санд RLS бодлого
 * Тиймээс энд алдаа гарвал бүх сайтыг унагах ёсгүй — алгасаад
 * үргэлжлүүлнэ. Хуудас өөрөө эрхгүй хэрэглэгчийг зогсооно.
 */
export async function updateSession(request: NextRequest) {
  try {
    return await run(request);
  } catch (e) {
    // Edge runtime дээрх ямар нэг гэнэтийн алдаа сайтыг бүхэлд нь
    // унагахаас сэргийлнэ (MIDDLEWARE_INVOCATION_FAILED).
    console.error("[middleware] алдаа гарлаа, алгаслаа:", e);
    return NextResponse.next({ request });
  }
}

async function run(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Тохиргоо байхгүй бол middleware-г алгасна (build/preview үед)
  if (!url || !anon) return supabaseResponse;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    const approved = profile?.status === "approved" || profile?.role === "admin";

    if (!approved) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/pending";
      return NextResponse.redirect(redirect);
    }

    if (path.startsWith("/admin") && profile?.role !== "admin") {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/dashboard";
      return NextResponse.redirect(redirect);
    }
  }

  return supabaseResponse;
}
