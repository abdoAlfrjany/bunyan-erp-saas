const fs = require('fs');

let url = '';
let key = '';

const content = fs.readFileSync('.env.local', 'utf8').split('\n');
for (const line of content) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
        url = line.split('=')[1].trim().replace(/['"]/g, '');
    }
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
        key = line.split('=')[1].trim().replace(/['"]/g, '');
    }
}

fetch(`${url}/rest/v1/?apikey=${key}`, { headers: { 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => {
      const defs = data.definitions || {};
      const tables = ['tenants', 'profiles', 'couriers', 'treasury_accounts', 'vanex_settlements', 'treasury_transactions'];
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
