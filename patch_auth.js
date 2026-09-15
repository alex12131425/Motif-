const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// 1. Add URL Encoded parsing for ChatGPT OAuth Token requests
if (!code.includes('app.use(express.urlencoded')) {
  code = code.replace(
    "app.use(express.json());", 
    "app.use(express.json());\napp.use(express.urlencoded({ extended: true })); // Required for ChatGPT OAuth Token POST"
  );
}

// 2. Add /auth route
if (!code.includes("app.get('/auth'")) {
  code = code.replace(
    "app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'authorize.html')));",
    "app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'public', 'authorize.html')));\napp.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'authorize.html')));"
  );
}

// 3. Update OpenAPI Schema to use /auth
code = code.replace(
  'authorizationUrl: "https://motif-23oq.onrender.com/",',
  'authorizationUrl: "https://motif-23oq.onrender.com/auth",'
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts for strict ChatGPT OAuth compatibility");
