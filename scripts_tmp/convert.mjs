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
  // If already HTML and contains real tags (not escaped), return as-is.
  if (looksLikeHtml(md) && !/&lt;p&gt;/i.test(md)) return md;

  // If content was double-escaped (contains &lt;p&gt;), unescape first then strip outer tags
  let stripped = false;
  if (/&lt;p&gt;/i.test(md)) {
    md = md.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
    md = md.replace(/<[^>]+>/g,' ');
    stripped = true;
  }
  if (stripped) {
    // After stripping tags, treat as a single concatenated line; insert newlines.
    md = md.replace(/\s*###\s+/g, '\n### ')
           .replace(/\s+(\d+)\.\s+/g, '\n$1. ')
           .replace(/\s*\*\*([^*]+):\*\*\s*/g, '\n**$1:** ');
  }

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

// Special handling: row may be a single line with all content concatenated (no newlines).
// Split such single-line content into segments at heading markers and list-item markers.
function preNormalize(md){
  if (md.includes('\n')) return md;
  // Insert newlines before ###, before "1." style numbers, before **Theme:** style labels
  let s = md;
  s = s.replace(/\s*###\s+/g, '\n### ');
  s = s.replace(/\s+(\d+)\.\s+/g, '\n$1. ');
  s = s.replace(/\s*\*\*([^*]+):\*\*\s*/g, '\n**$1:** ');
  return s;
}

const out = data.map(r => ({ id: r.id, html: mdToHtml(preNormalize(r.description)) }));
fs.writeFileSync('/tmp/tasks/converted.json', JSON.stringify(out));
console.log('Sample row 4 (problematic):\n', out[3].html.slice(0, 800));
