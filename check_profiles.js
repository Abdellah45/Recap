import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function fix() {
  const { data: users, error: err1 } = await supabase.from("profiles").select("*");
  console.log("Profiles:", users);
}

fix();
