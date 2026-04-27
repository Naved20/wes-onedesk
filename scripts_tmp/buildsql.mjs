import fs from 'fs';
const out = JSON.parse(fs.readFileSync('/tmp/tasks/converted.json','utf8'));
const esc = s => s.replace(/'/g, "''");
const values = out.map(r => `('${r.id}'::uuid, '${esc(r.html)}')`).join(',\n');
const sql = `UPDATE tasks SET description = v.html
FROM (VALUES
${values}
) AS v(id, html)
WHERE tasks.id = v.id;`;
fs.writeFileSync('/tmp/tasks/update.sql', sql);
console.log('SQL bytes:', sql.length);
