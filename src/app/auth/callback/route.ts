import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { isPasswordRecoveryPath, safeInternalPath } from "@/lib/auth/paths";
import { isSupabaseConfigured } from "@/lib/config";
import { provisionRestaurantFromAuthUser } from "@/server/restaurant-provision";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeInternalPath(request.nextUrl.searchParams.get("next"), "/");
  const recovery = isPasswordRecoveryPath(next);

  if (!code || !isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=link", request.url));
  }

  const destination = recovery
    ? new URL(next, request.url)
    : new URL("/login?confirmed=1", request.url);
  const response = NextResponse.redirect(destination);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=link", request.url));
  }

  if (recovery) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await provisionRestaurantFromAuthUser(user);
    } catch {
      // Sem loja: depois do login o painel manda para /completar-cadastro.
    }
  }

  await supabase.auth.signOut();
  return response;
}
