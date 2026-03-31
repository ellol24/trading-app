const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split('\n');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of lines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim().replace(/\r/g, '');
}

async function run() {
    console.log('Testing GET withdrawals...');
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/withdrawals?select=*&limit=1`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        console.log('Status withdrawals:', res.status);
        const text = await res.text();
        console.log('Response withdrawals:', text);

        const res2 = await fetch(`${supabaseUrl}/rest/v1/user_profiles?select=*&limit=1`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        console.log('Status profiles:', res2.status);
        const text2 = await res2.text();
        console.log('Response profiles:', text2);
    } catch (err) {
        console.error('Fetch error:', err.message);
    }
}
run();
