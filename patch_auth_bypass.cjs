const fs = require('fs');
let code = fs.readFileSync('public/authorize.html', 'utf8');

const bypassButtonHtml = `
      <button id="bypassBtn" class="w-full py-2 rounded-xl font-semibold text-xs text-gray-400 border border-gray-700 mt-2 hover:text-white hover:border-gray-500 transition-colors">
        Developer Bypass (Test ChatGPT Link)
      </button>
`;

// Insert after Google button
code = code.replace(
  'Sign in with Google\n      </button>',
  'Sign in with Google\n      </button>' + bypassButtonHtml
);

const bypassScript = `
    document.getElementById('bypassBtn').addEventListener('click', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUri = urlParams.get('redirect_uri');
      const state = urlParams.get('state');
      const testUid = "motif_dev_test_user_001";
      if (redirectUri && state) {
        window.location.href = \`\${redirectUri}?code=\${testUid}&state=\${state}\`;
      } else {
        alert("Bypass clicked, but no ChatGPT redirect parameters found in URL.");
      }
    });
`;

code = code.replace(
  "document.getElementById('loginBtn').addEventListener('click', async () => {",
  bypassScript + "\n    document.getElementById('loginBtn').addEventListener('click', async () => {"
);

fs.writeFileSync('public/authorize.html', code);
console.log("Added bypass button");
