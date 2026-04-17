import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile for name + role
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, language")
    .eq("id", user.id)
    .single();

  const initials = (profile?.full_name ?? user.email ?? "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen bg-[#faf8ff]">
      <Sidebar
        fullName={profile?.full_name ?? user.email ?? "User"}
        role={profile?.role ?? "employee"}
        initials={initials}
        language={profile?.language ?? "en"}
        userId={user.id}
      />
      {/* Main content pushes right of sidebar */}
      <main className="flex-1 md:ml-64 p-6 md:p-12 lg:p-20 flex flex-col items-center">
        {children}
      </main>
    </div>
  );
}
