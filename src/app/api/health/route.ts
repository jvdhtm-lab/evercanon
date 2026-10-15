import { NextResponse } from "next/server";

// Liveness endpoint used by the container health check. Deliberately does not
// depend on the database so the app container can report readiness while the
// database is still starting.
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json({
    status: "ok",
    service: "evercanon",
    time: new Date().toISOString(),
  });
}
