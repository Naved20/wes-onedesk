import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const data = JSON.parse(fs.readFileSync('/tmp/tasks/raw.json','utf8'));

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  let html = '';
  let inList = false;
  let listType = null; // 'ol' or 'ul'
  const closeList = () => { if (inList) { html += `</${listType}>`; inList = false; listType = null; } };

  for (let raw of lines) {
    let line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }

    // Headings
    let m;
    if ((m = line.match(/^###\s+(.*)$/))) {
      closeList();
      html += `<h3>${inline(m[1])}</h3>`;
      continue;
    }
    if ((m = line.match(/^##\s+(.*)$/))) {
      closeList();
      html += `<h2>${inline(m[1])}</h2>`;
      continue;
    }
    // Bold-only label line like **Theme:** value
    if ((m = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/))) {
      closeList();
      html += `<p><strong>${escapeHtml(m[1])}:</strong> ${inline(m[2])}</p>`;
      continue;
    }
    // Numbered list: "1. text"
    if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      if (!inList || listType !== 'ol') { closeList(); html += '<ol>'; inList = true; listType = 'ol'; }
      html += `<li>${inline(m[1])}</li>`;
      continue;
    }
    // Bullet
    if ((m = line.match(/^[-*]\s+(.*)$/))) {
      if (!inList || listType !== 'ul') { closeList(); html += '<ul>'; inList = true; listType = 'ul'; }
      html += `<li>${inline(m[1])}</li>`;
      continue;
    }
    // Paragraph
    closeList();
    html += `<p>${inline(line)}</p>`;
  }
  closeList();
  return html;
}

function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function inline(s){
  s = escapeHtml(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s;
}

const out = data.map(r => ({ id: r.id, html: mdToHtml(r.description) }));
fs.writeFileSync('/tmp/tasks/converted.json', JSON.stringify(out));
console.log('Sample:\n', out[0].html.slice(0, 600));
console.log('Total:', out.length);
