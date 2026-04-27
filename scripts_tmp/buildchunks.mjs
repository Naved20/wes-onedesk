import fs from 'fs';
const out = JSON.parse(fs.readFileSync('/tmp/tasks/converted.json','utf8'));
const esc = s => s.replace(/'/g, "''");
const chunkSize = 4;
for (let i = 0; i < out.length; i += chunkSize) {
  const chunk = out.slice(i, i+chunkSize);
  const values = chunk.map(r => `('${r.id}'::uuid, '${esc(r.html)}')`).join(',\n');
  const sql = `UPDATE tasks SET description = v.html FROM (VALUES\n${values}\n) AS v(id, html) WHERE tasks.id = v.id;`;
  fs.writeFileSync(`/tmp/tasks/chunk_${i/chunkSize}.sql`, sql);
  console.log(`chunk_${i/chunkSize}.sql`, sql.length, 'bytes');
}
