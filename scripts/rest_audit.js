/**
 * This script queries Supabase using the REST API (direct HTTP calls)
 * to audit the database state of the referral system.
 * 
 * Usage: node scripts/rest_audit.js <SERVICE_ROLE_KEY>
 */
const https = require('https');

const SUPABASE_URL = 'https://yrjujtspixcnnuvozjcx.supabase.co';
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
    console.error('Usage: node scripts/rest_audit.js <SERVICE_ROLE_KEY>');
    process.exit(1);
}

function supabaseGet(path) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SUPABASE_URL);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    console.log('=== SUPABASE DB AUDIT via REST API ===\n');

    // 1. user_profiles
    const profiles = await supabaseGet('/rest/v1/user_profiles?select=uid,email,referral_code,referral_code_used,total_referrals&order=total_referrals.desc&limit=20');
    console.log('--- user_profiles (top 20) ---');
    console.log('Status:', profiles.status);
    if (Array.isArray(profiles.data)) {
        console.table(profiles.data);
    } else {
        console.log(profiles.data);
    }

    // 2. referrals table 
    const referrals = await supabaseGet('/rest/v1/referrals?select=*&limit=20');
    console.log('\n--- referrals (top 20) ---');
    console.log('Status:', referrals.status);
    if (Array.isArray(referrals.data)) {
        console.table(referrals.data);
    } else {
        console.log(referrals.data);
    }

    // 3. referral_commissions
    const commissions = await supabaseGet('/rest/v1/referral_commissions?select=*&limit=20');
    console.log('\n--- referral_commissions (top 20) ---');
    console.log('Status:', commissions.status);
    if (Array.isArray(commissions.data)) {
        console.table(commissions.data);
    } else {
        console.log(commissions.data);
    }

    // 4. Users who used a referral code
    const codeUsers = await supabaseGet('/rest/v1/user_profiles?select=uid,email,referral_code_used&referral_code_used=not.is.null&limit=20');
    console.log('\n--- Users with referral_code_used ---');
    console.log('Status:', codeUsers.status);
    if (Array.isArray(codeUsers.data)) {
        console.table(codeUsers.data);
    } else {
        console.log(codeUsers.data);
    }
}

run().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
