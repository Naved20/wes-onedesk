const fs = require('fs');
let code = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

// For admin query
code = code.replace(/\.gte\("created_at", start\)/g, '// .gte("created_at", start)');
code = code.replace(/\.lte\("created_at", end\)/g, '// .lte("created_at", end)');

fs.writeFileSync('src/pages/Tasks.tsx', code);
console.log('Removed created_at bounds from backend queries');
