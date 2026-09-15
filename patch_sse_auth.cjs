const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `app.get('/sse', async (req: any, res: any) => {
  let authUserId = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) authUserId = authHeader.substring(7);`;

const replacement1 = `app.get('/sse', async (req: any, res: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized. Missing or invalid Authorization header." });
  }
  let authUserId = authHeader.substring(7);`;

if (code.includes(target1)) {
  code = code.replace(target1, replacement1);
  console.log("Patched /sse for strict 401 Unauthorized");
} else {
  console.log("Could not find target1");
}

fs.writeFileSync('server.ts', code);
