import { Client } from 'pg';

const connectionString = 'postgresql://postgres:HDKE_5.2P%402.J%21i@db.yrjujtspixcnnuvozjcx.supabase.co:5432/postgres';

async function main() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('Connected to Supabase PostgreSQL!');

        console.log('Enabling logical replication for requested tables...');
        await client.query('ALTER PUBLICATION supabase_realtime ADD TABLE deposits;');
        await client.query('ALTER PUBLICATION supabase_realtime ADD TABLE withdrawals;');
        await client.query('ALTER PUBLICATION supabase_realtime ADD TABLE trade_rounds;');
        await client.query('ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;');

        console.log('Successfully enabled supabase_realtime on deposits, withdrawals, trade_rounds, user_profiles!');
    } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('already in publication')) {
            console.log('Some or all tables are already added to the realtime publication (Warning ignored).');
        } else {
            console.error('Error enabling realtime:', error);
        }
    } finally {
        await client.end();
        console.log('Disconnected from database.');
    }
}

main();
