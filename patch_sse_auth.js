const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// Require auth on /sse
code = code.replace(
  "app.get('/sse', async (req, res) => {\n  let authUserId = '';",
  `app.get('/sse', async (req, res) => {
  let authUserId = '';
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized. Missing or invalid Authorization header." });
  }`
);

// We need to carefully replace this since the old code had:
//   const authHeader = req.headers.authorization;
//   if (authHeader && authHeader.startsWith('Bearer ')) authUserId = authHeader.substring(7);
code = code.replace(
  "  const authHeader = req.headers.authorization;\n  if (authHeader && authHeader.startsWith('Bearer ')) authUserId = authHeader.substring(7);",
  "  authUserId = authHeader.substring(7);"
);


fs.writeFileSync('server.ts', code);
console.log("Patched /sse for strict 401 Unauthorized");
