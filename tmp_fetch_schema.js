const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=([^\\n\\r]+)/);
const keyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\\n\\r]+)/);

if (!urlMatch || !keyMatch) {
  console.error("Missing URL or Key in .env.local");
  process.exit(1);
}

const url = urlMatch[1].replace(/['"]/g, '').trim();
const key = keyMatch[1].replace(/['"]/g, '').trim();

fetch(`${url}/rest/v1/`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => {
      const defs = data.definitions || {};
      const tables = ['bunyan_cities', 'bunyan_regions', 'provider_geo_mappings'];
      tables.forEach(t => {
          if (defs[t]) {
              console.log('--- ' + t + ' ---');
              console.log(JSON.stringify(defs[t].properties, null, 2));
          } else {
              console.log('--- ' + t + ' NOT FOUND ---');
          }
      });
  })
  .catch(err => {
      console.error("Fetch Error:", err);
  });
