import pg from 'pg';

const { Client } = pg;
const connectionString = 'postgres://postgres:Mansoori%40%40%40005@db.cyfcfrgrzcmbweviogrn.supabase.co:5432/postgres';

async function fixSchemaColumns() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  console.log('🔌 Adding missing columns to new DB...');
  await client.connect();

  const extraColumns = [
    `ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS file_name TEXT;`,
    `ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS file_url TEXT;`,
    `ALTER TABLE IF EXISTS public.task_remarks ADD COLUMN IF NOT EXISTS confidence NUMERIC;`,
    `ALTER TABLE IF EXISTS public.task_responses ADD COLUMN IF NOT EXISTS additional_file_name TEXT;`,
    `ALTER TABLE IF EXISTS public.task_responses ADD COLUMN IF NOT EXISTS additional_file_url TEXT;`
  ];

  for (const stmt of extraColumns) {
    try {
      await client.query(stmt);
      console.log('✅ Added column:', stmt);
    } catch (e) {
      console.warn('⚠️ Column note:', e.message);
    }
  }

  await client.end();
  console.log('🎉 Column additions completed!');
}

fixSchemaColumns();
