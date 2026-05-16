import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "manager") {
    redirect("/app/dashboard");
  }

  return (
    <div className="w-full max-w-4xl">
      <h2 className="text-4xl font-extrabold tracking-tighter text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
        My History
      </h2>
      <p className="text-[#464553] mt-2">Full log history — coming in Week 5-6.</p>
    </div>
  );
}
