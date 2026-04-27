import fs from 'fs';
const data = JSON.parse(fs.readFileSync('/tmp/tasks/raw.json','utf8'));

function looksLikeHtml(s){ return /<\/?(p|h[1-6]|ul|ol|li|strong|em|br|div|span)\b/i.test(s); }

function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function inline(s){
  s = escapeHtml(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  return s;
}

function mdToHtml(md) {
  const hasMarkdown = /\*\*[^*]+\*\*|###\s|\n\d+\.\s/.test(md);
  if (looksLikeHtml(md) && !hasMarkdown && !/&lt;p&gt;/i.test(md)) return md;

  if (/&lt;p&gt;/i.test(md)) {
    md = md.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  }
  if (looksLikeHtml(md)) {
    md = md.replace(/<\/(p|h[1-6]|li|ul|ol|div)>/gi, '\n')
           .replace(/<br\s*\/?>/gi, '\n')
           .replace(/<[^>]+>/g, ' ');
  }
  // Insert newlines before structural markers
  md = md.replace(/\s*###\s+/g, '\n### ')
         .replace(/\s+(\d+)\.\s+/g, '\n$1. ')
         .replace(/\s*\*\*([^*]+):\*\*\s*/g, '\n**$1:** ');
  // Split known headings from inline body
  md = md.replace(/^### (📝 Instruction)[ \t]+/gm, '### $1\n')
         .replace(/^### (📚 Vocabulary[^\n]*?)[ \t]+(?=\d+\.)/gm, '### $1\n')
         .replace(/^### (💬 Practice Sentences[^\n]*?)[ \t]+(?=\d+\.)/gm, '### $1\n')
         .replace(/^### (📖 Article:[ \t]*[^.\n]+?)\.[ \t]+/gm, '### $1\n');

  const lines = md.split(/\r?\n/);
  let html = '';
  let inList = false;
  let listType = null;
  const closeList = () => { if (inList) { html += `</${listType}>`; inList = false; listType = null; } };

  for (let raw of lines) {
    let line = raw.trim();
    if (!line) { closeList(); continue; }
    let m;
    if ((m = line.match(/^###\s+(.*)$/))) { closeList(); html += `<h3>${inline(m[1])}</h3>`; continue; }
    if ((m = line.match(/^##\s+(.*)$/)))  { closeList(); html += `<h2>${inline(m[1])}</h2>`; continue; }
    if ((m = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/))) {
      closeList();
      html += `<p><strong>${escapeHtml(m[1])}:</strong> ${inline(m[2])}</p>`;
      continue;
    }
    if ((m = line.match(/^(\d+)\.\s+(.*)$/))) {
      if (!inList || listType !== 'ol') { closeList(); html += '<ol>'; inList = true; listType = 'ol'; }
      html += `<li>${inline(m[2])}</li>`;
      continue;
    }
    if ((m = line.match(/^[-*]\s+(.*)$/))) {
      if (!inList || listType !== 'ul') { closeList(); html += '<ul>'; inList = true; listType = 'ul'; }
      html += `<li>${inline(m[1])}</li>`;
      continue;
    }
    closeList();
    html += `<p>${inline(line)}</p>`;
  }
  closeList();
  return html;
}

const out = data.map(r => ({ id: r.id, title: r.title, html: mdToHtml(r.description) }));
fs.writeFileSync('/tmp/tasks/converted.json', JSON.stringify(out));
console.log('Row 0 sample:\n', out[0].html.slice(0, 600));
console.log('\nRow 3 (was problematic):\n', out[3].html.slice(0, 600));
