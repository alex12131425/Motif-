const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Replace the global express.json and urlencoded with the LifeLogistics skip logic
const globalBodyParsers = `app.use(express.json());\napp.use(express.urlencoded({ extended: true }));`;
const customBodyParsers = `app.use((req, res, next) => {
  if (req.path === '/messages') return next();
  express.json()(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true })(req, res, next);
  });
});`;
if (code.includes(globalBodyParsers)) {
  code = code.replace(globalBodyParsers, customBodyParsers);
} else {
  // Try case where they are separate
  code = code.replace("app.use(express.json());", "");
  code = code.replace("app.use(express.urlencoded({ extended: true }));", customBodyParsers);
}

// 2. Add well-known endpoints and /authorize
const wellKnownEndpoints = `
app.get(['/.well-known/oauth-protected-resource/sse', '/.well-known/oauth-protected-resource'], (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const serverUrl = \`https://\${host}\`;
  res.json({
    resource: \`\${serverUrl}/sse\`,
    authorization_servers: [serverUrl],
    scopes_supported: [],
    bearer_methods_supported: ["header"]
  });
});

app.get('/.well-known/oauth-authorization-server', (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const serverUrl = \`https://\${host}\`;
  res.json({
    issuer: serverUrl,
    authorization_endpoint: \`\${serverUrl}/authorize\`,
    token_endpoint: \`\${serverUrl}/token\`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
    code_challenge_methods_supported: ["S256"]
  });
});

app.get('/authorize', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'authorize.html'));
});
`;

code = code.replace("// --- AUTH ENDPOINTS ---", "// --- AUTH ENDPOINTS ---" + wellKnownEndpoints);

fs.writeFileSync('server.ts', code);
console.log("Added well-known OAuth discovery endpoints");
