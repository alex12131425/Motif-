const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Capitalize Bearer in token response
code = code.replace(
  'token_type: "bearer"',
  'token_type: "Bearer"'
);

// 2. Add WWW-Authenticate to /sse 401
code = code.replace(
  'return res.status(401).json({ error: "Unauthorized. Missing or invalid Authorization header. Please login via OAuth." });',
  'return res.status(401).set("WWW-Authenticate", "Bearer").json({ error: "Unauthorized. Missing or invalid Authorization header. Please login via OAuth." });'
);

// 3. Add OAuth check to /messages
const messagesEndpoint = `app.post('/messages', async (req: any, res: any) => {
  const sessionId = req.query.sessionId as string;`;
  
const messagesReplacement = `app.post('/messages', async (req: any, res: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).set("WWW-Authenticate", "Bearer").json({ error: "Unauthorized" });
  }
  const sessionId = req.query.sessionId as string;`;

code = code.replace(messagesEndpoint, messagesReplacement);

fs.writeFileSync('server.ts', code);
console.log("Patched strictly for ChatGPT MCP OAuth");
