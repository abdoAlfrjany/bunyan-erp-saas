// scripts/test-vanex-connection.mjs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const credentials = {
  email: '0918247857',
  password: 'libyafreevanex'
};

const POSSIBLE_URLS = [
  'https://test.dev.vanex.ly/api/v1',
  'https://accounting.dev.vanex.ly/api/v1',
  'https://dev.vanex.ly/api/v1',
  'https://app-stg.vanex.ly/api/v1',
  'https://staging.vanex.ly/api/v1',
  'https://app.vanex.ly/api/v1'
];

async function runTest() {
  for (const url of POSSIBLE_URLS) {
    console.log(`\n--- Testing URL: ${url} ---`);
    try {
      const loginRes = await fetch(`${url}/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      const text = await loginRes.text();
      console.log(`Status: ${loginRes.status} | Body Snippet: ${text.substring(0, 100)}`);
      
      if (loginRes.ok) {
        const loginData = JSON.parse(text);
        const token = loginData.data?.token;
        console.log('✅ Found working URL! Token retrieved.');

        console.log('--- Fetching Settlements (All) ---');
        const setRes = await fetch(`${url}/store/settelmets`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const setData = await setRes.json();
        console.log('Settlements Found:', setData.data?.length ?? 0);
        console.log('Sample Settlement:', JSON.stringify(setData.data?.[0] || {}, null, 2));
        return;
      }
    } catch (e) {
      console.error(`Error on ${url}:`, e.message);
    }
  }
}

runTest();
