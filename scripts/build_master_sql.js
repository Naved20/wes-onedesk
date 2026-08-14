import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const OUTPUT_FILE = path.join(process.cwd(), 'supabase', 'combined_schema.sql');

function combineMigrations() {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));
  
  // Sort files: timestamped files first in order, then named/capitalized files
  files.sort((a, b) => {
    const isATimestamp = /^\d/.test(a);
    const isBTimestamp = /^\d/.test(b);
    if (isATimestamp && isBTimestamp) return a.localeCompare(b);
    if (isATimestamp) return -1;
    if (isBTimestamp) return 1;
    return a.localeCompare(b);
  });

  console.log(`Found ${files.length} SQL migration files.`);

  let combinedSql = `-- COMBINED SCHEMA MIGRATIONS FOR SUPABASE\n-- Generated on ${new Date().toISOString()}\n\n`;

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    combinedSql += `\n-- ==============================================\n`;
    combinedSql += `-- MIGRATION: ${file}\n`;
    combinedSql += `-- ==============================================\n\n`;
    combinedSql += content + '\n';
  }

  fs.writeFileSync(OUTPUT_FILE, combinedSql, 'utf-8');
  console.log(`Successfully combined ${files.length} files into ${OUTPUT_FILE}`);
  console.log(`Total size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
}

combineMigrations();
