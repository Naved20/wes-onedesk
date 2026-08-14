const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const OLD_URL_BASE = 'https://glijytescdhdtihzlhlg.supabase.co';
const NEW_URL_BASE = 'https://cyfcfrgrzcmbweviogrn.supabase.co';
const NEW_SERVICE_KEY = 'sb_secret_8ex8Z8akzFpzSLgNU8QiSA_PECkzAUr';
const DB_URL = 'postgres://postgres:Mansoori%40%40%40005@db.cyfcfrgrzcmbweviogrn.supabase.co:5432/postgres';

async function migrateAllStorage() {
  const pgClient = new Client({ connectionString: DB_URL });
  await pgClient.connect();

  const supabase = createClient(NEW_URL_BASE, NEW_SERVICE_KEY);

  const targets = [
    { table: 'announcements', column: 'file_url', idCol: 'id' },
    { table: 'documents', column: 'file_url', idCol: 'id' },
    { table: 'task_responses', column: 'article_file_url', idCol: 'id' },
    { table: 'task_responses', column: 'additional_file_url', idCol: 'id' },
  ];

  let totalSuccess = 0;

  for (const target of targets) {
    console.log(`Processing ${target.table}.${target.column}...`);
    const { rows } = await pgClient.query(`
      SELECT ${target.idCol} as id, "${target.column}" as old_url
      FROM public."${target.table}"
      WHERE "${target.column}" LIKE $1
    `, ['%glijytescdhdtihzlhlg%']);

    console.log(`Found ${rows.length} rows to migrate.`);

    for (const row of rows) {
      try {
        const oldUrl = row.old_url;
        console.log(`Downloading ${oldUrl}...`);
        
        const res = await fetch(oldUrl);
        if (!res.ok) {
          console.error(`Failed to download ${oldUrl}: ${res.statusText}`);
          continue;
        }
        
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Extract bucket and path from URL
        // https://glijytescdhdtihzlhlg.supabase.co/storage/v1/object/public/<bucket>/<path>
        const urlParts = oldUrl.split('/storage/v1/object/public/');
        if (urlParts.length !== 2) {
          console.log(`URL parsing failed for ${oldUrl}`);
          continue;
        }
        
        const pathParts = urlParts[1].split('/');
        const bucket = pathParts[0];
        const path = pathParts.slice(1).join('/');

        // Ensure bucket exists in the new project (this might fail if already exists but that's fine, we can try to create or ignore error)
        try {
          await supabase.storage.createBucket(bucket, { public: true });
        } catch(e) {
          // ignore bucket creation error if it already exists
        }

        console.log(`Uploading ${path} to bucket ${bucket}...`);
        const { data, error } = await supabase.storage.from(bucket).upload(path, buffer, {
          contentType: res.headers.get('content-type') || 'application/octet-stream',
          upsert: true,
        });

        if (error) {
          console.error(`Upload error for ${path}:`, error.message);
          continue;
        }

        const newUrl = oldUrl.replace(OLD_URL_BASE, NEW_URL_BASE);
        
        await pgClient.query(`
          UPDATE public."${target.table}"
          SET "${target.column}" = $1 
          WHERE ${target.idCol} = $2
        `, [newUrl, row.id]);

        console.log(`Updated DB for ${target.table} ID ${row.id} with new URL`);
        totalSuccess++;
      } catch(e) {
        console.error(`Error processing row ${row.id}:`, e.message);
      }
    }
  }

  console.log(`Migration complete! Successfully migrated ${totalSuccess} images.`);
  await pgClient.end();
}

migrateAllStorage().catch(console.error);
