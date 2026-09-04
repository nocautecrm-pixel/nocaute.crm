import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoAllowed, isLiveBackendReady } from "@/lib/config";

const AUTH_PATHS = new Set(["/login", "/cadastro", "/recuperar-senha"]);
const UNAVAILABLE_PATH = "/indisponivel";

function isPublicPath(pathname: string) {
  if (AUTH_PATHS.has(pathname)) return true;
  if (pathname === UNAVAILABLE_PATH) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  if (pathname.startsWith("/api/meta/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname === "/privacidade" || pathname === "/termos" || pathname === "/opt-in") return true;
  return false;
}

function isMetaCallbackPath(pathname: string) {
  return (
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/meta/") ||
    pathname.startsWith("/api/cron/")
  );
}

function unavailableResponse(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Sistema indisponível. Backend não configurado." },
      { status: 503 },
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = UNAVAILABLE_PATH;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isLiveBackendReady()) {
    if (isDemoAllowed()) {
      return NextResponse.next();
    }
    if (pathname === UNAVAILABLE_PATH || isMetaCallbackPath(pathname)) {
      return NextResponse.next();
    }
    return unavailableResponse(request);
  }

  if (pathname === UNAVAILABLE_PATH) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = isPublicPath(pathname);

  if (!user && pathname === "/redefinir-senha") {
    const recoverUrl = request.nextUrl.clone();
    recoverUrl.pathname = "/recuperar-senha";
    recoverUrl.search = "";
    return NextResponse.redirect(recoverUrl);
  }

  if (!user && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    const next = `${pathname}${request.nextUrl.search}`;
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  if (user && AUTH_PATHS.has(pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/visao-geral";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
