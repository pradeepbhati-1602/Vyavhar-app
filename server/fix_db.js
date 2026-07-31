const { Client } = require('pg');
require('dotenv').config();

async function fixDB() {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    console.error('DIRECT_URL is not set in .env');
    return;
  }

  console.log('Connecting to database...');
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected.');

    // Wait, the user said they ran the script and it returned "Success. No rows returned".
    // If they did that on Supabase, the changes should ALREADY be there.
    // Let's verify what columns exist in the bills table.
    
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bills';
    `);
    
    const columns = res.rows.map(r => r.column_name);
    console.log('Columns in bills table:', columns);

    if (!columns.includes('items')) {
      console.log('Adding items column to bills table...');
      await client.query(`ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "items" JSONB;`);
      console.log('Added items column.');
    } else {
      console.log('Column "items" already exists in bills table!');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

fixDB();
