import type { NextRequest } from "next/server";

/**
 * Conservative same-origin check for cookie-authenticated writes. Browsers send
 * `Origin` and `Sec-Fetch-Site` on cross-origin form/fetch submissions, so a
 * cross-site request is rejected. Non-browser clients that omit both headers
 * (for example server-to-server health checks) are allowed through.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
