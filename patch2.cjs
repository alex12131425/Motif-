const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The issue was a bad regex replace cutting out a comment that typescript confused for actual code syntax.
// We need to fix line 118: ` (32 Actions) ---`
code = code.replace(/ \(32 Actions\) ---/g, '// --- TOOLS SCHEMA (32 Actions) ---');

fs.writeFileSync('server.ts', code);
console.log('Patched');
