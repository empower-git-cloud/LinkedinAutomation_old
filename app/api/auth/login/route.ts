import { NextResponse } from "next/server";
import { isValidEmail, sessionCookie, signSession } from "../../../../lib/auth";
import { recordUser } from "../../../../lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { email } = await request.json() as { email?: string };
  const clean = (email ?? "").trim().toLowerCase();
  if (!isValidEmail(clean)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  await recordUser(clean);
  const response = NextResponse.json({ ok: true, email: clean });
  response.cookies.set(sessionCookie(await signSession(clean)));
  return response;
}
