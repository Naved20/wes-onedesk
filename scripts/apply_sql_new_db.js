import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const NEW_URL = 'https://cyfcfrgrzcmbweviogrn.supabase.co';
const NEW_SECRET = 'sb_secret_8ex8Z8akzFpzSLgNU8QiSA_PECkzAUr';

const newSupabase = createClient(NEW_URL, NEW_SECRET);

async function testExecuteSql() {
  console.log('Testing SQL Execution on New Supabase...');

  // Let's try calling RPC or REST management endpoint
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS public.test_table (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT now(),
      name TEXT
    );
  `;

  // Check if RPC exec_sql or query API exists
  try {
    const res = await fetch(`${NEW_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': NEW_SECRET,
        'Authorization': `Bearer ${NEW_SECRET}`
      },
      body: JSON.stringify({ sql_string: createTableSql })
    });

    const status = res.status;
    const text = await res.text();
    console.log(`RPC exec_sql Response status: ${status}, text: ${text}`);
  } catch (e) {
    console.error('RPC Error:', e.message);
  }
}

testExecuteSql();
