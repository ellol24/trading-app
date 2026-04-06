// Comprehensive Supabase audit script using the JS client
const { createClient } = require('@supabase/supabase-js');

// REAL Supabase project credentials (extracted from DB URL project ref: yrjujtspixcnnuvozjcx)
const SUPABASE_URL = 'https://yrjujtspixcnnuvozjcx.supabase.co';
// We'll need the SERVICE ROLE KEY - try reading from env first
require('fs').readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v) process.env[k.trim()] = v.join('=').trim();
});

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY || SERVICE_KEY.includes('placeholder')) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set or is a placeholder in .env.local');
    console.log('Using the DB URL project ref: yrjujtspixcnnuvozjcx');
    console.log('Please add the real SERVICE_ROLE_KEY to .env.local and re-run this script.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function run() {
    console.log('=== SUPABASE DB AUDIT ===\n');

    // 1. List all user_profiles and key columns
    const { data: allProfiles, error: pErr } = await supabase
        .from('user_profiles')
        .select('uid, email, referral_code, referral_code_used, total_referrals')
        .order('total_referrals', { ascending: false });

    if (pErr) {
        console.error('❌ Error fetching user_profiles:', pErr);
    } else {
        console.log(`✅ Found ${allProfiles?.length ?? 0} users in user_profiles:`);
        console.table(allProfiles);
    }

    // 2. Check the referrals table
    const { data: allReferrals, error: rErr } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false });

    if (rErr) {
        console.error('❌ Error fetching referrals:', rErr.message, rErr.details, rErr.hint);
    } else {
        console.log(`\n✅ Found ${allReferrals?.length ?? 0} rows in referrals table:`);
        console.table(allReferrals);
    }

    // 3. Check referral_commissions
    const { data: allComm, error: cErr } = await supabase
        .from('referral_commissions')
        .select('*')
        .order('created_at', { ascending: false });

    if (cErr) {
        console.error('❌ Error fetching referral_commissions:', cErr.message, cErr.hint);
    } else {
        console.log(`\n✅ Found ${allComm?.length ?? 0} rows in referral_commissions:`);
        console.table(allComm);
    }

    // 4. Check referral_commission_rates
    const { data: rates, error: ratesErr } = await supabase
        .from('referral_commission_rates')
        .select('*');

    if (ratesErr) {
        console.error('❌ Error fetching referral_commission_rates:', ratesErr.message, ratesErr.hint);
    } else {
        console.log(`\n✅ Commission rates table:`);
        console.table(rates);
    }

    // 5. Specifically look for users who used a referral code
    const { data: withCodes } = await supabase
        .from('user_profiles')
        .select('uid, email, referral_code_used')
        .not('referral_code_used', 'is', null);

    console.log(`\n📊 Users who registered with a referral code: ${withCodes?.length ?? 0}`);
    if (withCodes?.length) console.table(withCodes);
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
