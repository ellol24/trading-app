const fs = require('fs');
const { Client } = require('pg');

// Use the exact URL-encoded password provided
const uri = "postgresql://postgres:HDKE_5.2P%402.J%21i@db.yrjujtspixcnnuvozjcx.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString: uri });
  
  console.log("Connecting to Supabase production database...");
  await client.connect();
  console.log("Connected successfully!");

  // 1. Read and apply the SQL script
  try {
    const sql = fs.readFileSync('scripts/005_sync_balances_and_bonus.sql', 'utf8');
    await client.query(sql);
    console.log("✅ SQL Migration '005_sync_balances_and_bonus.sql' applied successfully!");
  } catch (err) {
    console.error("❌ Failed to apply SQL:", err);
  }

  // 2. Check system settings to verify the Welcome Bonus UI was saved
  try {
    const { rows } = await client.query("SELECT value FROM system_settings WHERE key = 'welcome_bonus'");
    console.log("✅ Current Welcome Bonus Settings in DB:", JSON.stringify(rows[0]?.value || null));
  } catch (err) {
    console.error("❌ Failed to query settings:", err);
  }

  await client.end();
}

run().catch(console.error);
