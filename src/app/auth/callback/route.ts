import { NextRequest, NextResponse } from "next/server";
import { isPasswordRecoveryPath, safeInternalPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionRestaurantFromAuthUser } from "@/server/restaurant-provision";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeInternalPath(request.nextUrl.searchParams.get("next"), "/");
  const supabase = await createSupabaseServerClient();

  if (!code || !supabase) {
    return NextResponse.redirect(new URL("/login?error=link", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=link", request.url));
  }

  if (isPasswordRecoveryPath(next)) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await provisionRestaurantFromAuthUser(user);
    } catch {
      return NextResponse.redirect(new URL("/completar-cadastro", request.url));
    }
  }

  return NextResponse.redirect(new URL("/", request.url));
}
