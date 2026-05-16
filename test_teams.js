const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zbdvlqxzumdlevvtopyr.supabase.co',
  'sb_publishable_XAXAYlX0fK-jZuWHpSGR3Q_dnxXHDpe'
);

async function checkTeams() {
  const { data, error } = await supabase.from('companies').select('*');
  if (error) {
    console.error("ERROR fetching companies:", error.message);
  } else {
    console.log("SUCCESS. Companies:", data);
  }
}

checkTeams();
