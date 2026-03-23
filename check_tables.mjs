import { createClient } from '@supabase/supabase-js';

const url = 'https://riecnyonvqxtqqoyhkvh.supabase.co';
const key = 'sb_publishable_dpoj1iiD8iWDEdlFHtXH-g_31_sJnJj';
const supabase = createClient(url, key);

async function checkSchema() {
  console.log("Checking bunyan_cities...");
  const { data: cities, error: errC } = await supabase.from('bunyan_cities').select('*').limit(1);
  console.log(errC ? "Error: " + errC.message : (cities.length ? Object.keys(cities[0]) : "Table exists but is empty"));

  console.log("\nChecking bunyan_regions...");
  const { data: regions, error: errR } = await supabase.from('bunyan_regions').select('*').limit(1);
  console.log(errR ? "Error: " + errR.message : (regions.length ? Object.keys(regions[0]) : "Table exists but is empty"));

  console.log("\nChecking provider_geo_mappings...");
  const { data: mappings, error: errM } = await supabase.from('provider_geo_mappings').select('*').limit(1);
  console.log(errM ? "Error: " + errM.message : (mappings.length ? Object.keys(mappings[0]) : "Table exists but is empty"));
}

checkSchema();
