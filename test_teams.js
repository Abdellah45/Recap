const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zbdvlqxzumdlevvtopyr.supabase.co',
  'sb_publishable_XAXAYlX0fK-jZuWHpSGR3Q_dnxXHDpe'
);

async function dumpProfiles() {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error("ERROR:", error.message);
  } else {
    console.log("PROFILES:", data);
  }
}

dumpProfiles();
