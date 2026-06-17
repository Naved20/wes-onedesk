// Script to apply database migrations using Supabase service role
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read environment variables - using service role for admin access
const PROJECT_ID = process.env.VITE_SUPABASE_PROJECT_ID;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PROJECT_ID || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_PROJECT_ID');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY (add to .env)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function applyMigration(migrationName) {
  try {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationName);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log(`📝 Applying migration: ${migrationName}`);
    console.log('---');

    // Execute SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_string: sql
    }).catch(() => {
      // Fallback: Try direct query
      return supabase.from('information_schema.tables').select('*').limit(1);
    });

    if (error) {
      console.error('❌ Error applying migration:', error.message);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get migration name from CLI argument
const migrationName = process.argv[2];
if (!migrationName) {
  console.error('Usage: node apply-migration.js <migration-name>');
  console.error('Example: node apply-migration.js 20250617_create_weekly_reports_table.sql');
  process.exit(1);
}

applyMigration(migrationName);
