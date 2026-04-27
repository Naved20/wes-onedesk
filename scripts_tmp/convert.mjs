import fs from 'fs';
import { parse } from 'csv-parse/sync';

const csvText = fs.readFileSync('/dev-server/src/assets/task/WES_Teacher_English_Training_Day1_10_High_Quality_Master.csv','utf8');
const rows = parse(csvText, { columns: true, skip_empty_lines: true });

const data = JSON.parse(fs.readFileSync('/tmp/tasks/raw.json','utf8'));
// Map by title to id
const byTitle = new Map(data.map(r => [r.title, r.id]));

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const out = [];
for (const row of rows) {
  const day = row['Day'] || row['\uFEFFDay'];
  const taskNum = row['Article No'];
  const theme = row['Theme'] || '';
  const difficulty = row['Difficulty'] || '';
  const instruction = row['Instruction'] || '';
  const articleTitle = row['Article Title'] || '';
  const articleText = row['Article Text'] || '';
  const vocab = [];
  for (let i = 1; i <= 20; i++) {
    const v = row[`Vocab${i}`];
    if (v) vocab.push(v);
  }
  const sentences = [];
  for (let i = 1; i <= 10; i++) {
    const s = row[`Sentence${i}`];
    if (s) sentences.push(s);
  }
  const wordCount = row['Word Count'] || '';

  const title = `Day ${day} - Task ${taskNum}: ${articleTitle}`;
  const id = byTitle.get(title);
  if (!id) { console.warn('No id for', title); continue; }

  let html = '';
  html += `<p><strong>Theme:</strong> ${escapeHtml(theme)}</p>`;
  html += `<p><strong>Difficulty:</strong> ${escapeHtml(difficulty)}</p>`;
  if (wordCount) html += `<p><strong>Word Count:</strong> ${escapeHtml(wordCount)}</p>`;
  html += `<h3>📝 Instruction</h3>`;
  html += `<p>${escapeHtml(instruction)}</p>`;
  html += `<h3>📖 Article: ${escapeHtml(articleTitle)}</h3>`;
  // Split article into paragraphs by sentence groups (every 3-4 sentences)
  const sentencesArr = articleText.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  const paragraphs = [];
  for (let i = 0; i < sentencesArr.length; i += 4) {
    paragraphs.push(sentencesArr.slice(i, i+4).join(' '));
  }
  for (const p of paragraphs) html += `<p>${escapeHtml(p)}</p>`;

  html += `<h3>📚 Vocabulary (20 words)</h3><ol>`;
  for (const v of vocab) html += `<li>${escapeHtml(v)}</li>`;
  html += `</ol>`;

  html += `<h3>💬 Practice Sentences (10)</h3><ol>`;
  for (const s of sentences) html += `<li>${escapeHtml(s)}</li>`;
  html += `</ol>`;

  out.push({ id, title, html });
}

fs.writeFileSync('/tmp/tasks/converted.json', JSON.stringify(out));
console.log('Built', out.length, 'rows');
console.log('Sample:\n', out[0].html.slice(0, 800));
