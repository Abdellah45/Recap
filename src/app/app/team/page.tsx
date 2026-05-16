import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TeamManagementClient from "@/components/TeamManagementClient";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "employee") redirect("/app/log");
  if (profile.role === "manager") redirect("/app/dashboard");

  const companyId = profile.company_id!;

  // Fetch company info
  const { data: company } = await supabase
    .from("companies")
    .select("name, manager_invite_code")
    .eq("id", companyId)
    .single();

  // Fetch all teams in this company
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, created_at, invite_code")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  // Fetch all profiles in this company
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, status, team_id")
    .eq("company_id", companyId)
    .neq("id", user.id); // exclude owner themselves

  const pendingUsers = (allProfiles ?? []).filter((p) => p.status === "pending");
  const activeUsers = (allProfiles ?? []).filter((p) => p.status === "active");

  return (
    <TeamManagementClient
      companyId={companyId}
      company={{ name: company?.name ?? "", managerCode: company?.manager_invite_code ?? "" }}
      teams={teams ?? []}
      pendingUsers={pendingUsers}
      activeUsers={activeUsers}
    />
  );
}
