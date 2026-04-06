const { Client } = require('pg');

async function run() {
    const client = new Client({
        host: 'aws-0-eu-central-1.pooler.supabase.com', // Let's try direct IP or if supabase requires pooler
        port: 6543,
    });
    // Actually, I don't know their pooler host. Supabase poolers vary by region, like aws-0-eu-central-1.pooler.supabase.com.
}
