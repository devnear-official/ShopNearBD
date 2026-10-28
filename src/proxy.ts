import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie for signed-in areas only, so the public
 * catalogue stays cacheable. Authorization is enforced again on the server in
 * every admin page and action — this is not a security boundary on its own.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (path.startsWith("/admin") && !path.startsWith("/admin/login") && !data.user) {
    const to = request.nextUrl.clone();
    to.pathname = "/admin/login";
    to.searchParams.set("next", path);
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = { matcher: ["/admin/:path*", "/account/:path*"] };
