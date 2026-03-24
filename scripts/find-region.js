const { Client } = require('pg');
const fs = require('fs');

const regions = [
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'ap-south-1', 
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 
  'ap-northeast-2', 'ca-central-1', 'us-east-1', 
  'us-east-2', 'us-west-1', 'us-west-2', 'sa-east-1'
];

async function executeMigration() {
  console.log("Probing IPv4 Pooler endpoints...");
  for (const region of regions) {
    const uri = `postgresql://postgres.yrjujtspixcnnuvozjcx:HDKE_5.2P%402.J%21i@aws-0-${region}.pooler.supabase.com:6543/postgres?sslmode=require`;
    const client = new Client({ connectionString: uri, connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      console.log(`✅ Connection SUCCESS in region: ${region}`);
      
      // Execute the migration!
      const sql = fs.readFileSync('scripts/005_sync_balances_and_bonus.sql', 'utf8');
      await client.query(sql);
      console.log("✅ Migration '005_sync_balances_and_bonus.sql' applied successfully!");

      const { rows } = await client.query("SELECT value FROM system_settings WHERE key = 'welcome_bonus'");
      console.log("✅ Current Welcome Bonus Settings:", JSON.stringify(rows[0]?.value || null));

      await client.end();
      return;
    } catch (err) {
      if (!err.message.includes('timeout') && !err.message.includes('password authentication failed')) {
        // Only log meaningful non-timeout errors
        // Most will fail with password auth failed (because user doesn't exist in that region's pooler)
        // console.log(`Failed ${region}:`, err.message);
      }
    }
  }
  console.log("❌ Exhausted all regions, could not connect.");
}
executeMigration();
