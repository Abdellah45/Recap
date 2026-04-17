import { createClient } from "@/lib/supabase/server";
import DailyLogClient from "@/components/DailyLogClient";

export default async function DailyLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch last 3 log entries for this user
  const { data: recentLogs } = await supabase
    .from("daily_logs")
    .select("id, logged_at, ai_summary, blocker_note")
    .eq("user_id", user!.id)
    .order("logged_at", { ascending: false })
    .limit(3);

  // Fetch profile for greeting name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, language")
    .eq("id", user!.id)
    .single();

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <DailyLogClient
      firstName={firstName}
      userId={user!.id}
      recentLogs={recentLogs ?? []}
      language={profile?.language ?? "en"}
    />
  );
}
