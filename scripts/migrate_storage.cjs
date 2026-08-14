const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const OLD_URL_BASE = 'https://glijytescdhdtihzlhlg.supabase.co';
const NEW_URL_BASE = 'https://cyfcfrgrzcmbweviogrn.supabase.co';
const NEW_SERVICE_KEY = 'sb_secret_8ex8Z8akzFpzSLgNU8QiSA_PECkzAUr';
const DB_URL = 'postgres://postgres:Mansoori%40%40%40005@db.cyfcfrgrzcmbweviogrn.supabase.co:5432/postgres';

async function migrateStorage() {
  const pgClient = new Client({ connectionString: DB_URL });
  await pgClient.connect();

  const supabase = createClient(NEW_URL_BASE, NEW_SERVICE_KEY);

  console.log("Fetching rows to migrate...");
  const { rows } = await pgClient.query(`
    SELECT id, user_id, photo_url 
    FROM public.face_descriptors 
    WHERE photo_url LIKE $1
  `, ['%glijytescdhdtihzlhlg%']);

  console.log(`Found ${rows.length} images to migrate.`);

  let successCount = 0;

  for (const row of rows) {
    try {
      const oldUrl = row.photo_url;
      console.log(`Downloading ${oldUrl}...`);
      
      const res = await fetch(oldUrl);
      if (!res.ok) {
        console.error(`Failed to download ${oldUrl}: ${res.statusText}`);
        continue;
      }
      
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const urlParts = oldUrl.split('/face-enrollments/');
      if (urlParts.length !== 2) {
        console.log(`URL parsing failed for ${oldUrl}`);
        continue;
      }
      const path = urlParts[1];

      console.log(`Uploading ${path} to new Supabase...`);
      const { data, error } = await supabase.storage.from("face-enrollments").upload(path, buffer, {
        contentType: res.headers.get('content-type') || 'image/jpeg',
        upsert: true,
      });

      if (error) {
        console.error(`Upload error for ${path}:`, error.message);
        continue;
      }

      const newUrl = oldUrl.replace(OLD_URL_BASE, NEW_URL_BASE);
      
      await pgClient.query(`
        UPDATE public.face_descriptors 
        SET photo_url = $1 
        WHERE id = $2
      `, [newUrl, row.id]);

      console.log(`Updated DB for user ${row.user_id} with new URL: ${newUrl}`);
      successCount++;
    } catch(e) {
      console.error(`Error processing row ${row.id}:`, e.message);
    }
  }

  console.log(`Migration complete! Successfully migrated ${successCount} out of ${rows.length} images.`);
  await pgClient.end();
}

migrateStorage().catch(console.error);
