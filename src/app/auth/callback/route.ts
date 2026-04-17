import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    // Check if user already has a profile (returning user) or needs setup (new user)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      // New user → setup workspace; Existing user → go to app
      if (!profile) {
        return NextResponse.redirect(`${origin}/onboarding/setup`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/app/log`);
}
