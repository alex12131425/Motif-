const fs = require('fs');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Motif Account</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #ffffff;
      color: #000000;
      -webkit-font-smoothing: antialiased;
    }
    .input-container {
      position: relative;
      border: 1px solid #d1d1d6;
      border-radius: 12px;
      background-color: #ffffff;
      transition: all 0.2s ease;
    }
    .input-container:focus-within {
      border-color: #000000;
      box-shadow: 0 0 0 1px #000000;
    }
    .input-label {
      position: absolute;
      top: 6px;
      left: 14px;
      font-size: 11px;
      color: #6e6e73;
      font-weight: 400;
      pointer-events: none;
    }
    .input-field {
      width: 100%;
      background: transparent;
      border: none;
      padding: 22px 14px 8px 14px;
      font-size: 15px;
      color: #1d1d1f;
      outline: none;
    }
    .btn-primary {
      background-color: #39FF14;
      color: #000000;
      transition: transform 0.1s ease, opacity 0.2s ease;
    }
    .btn-primary:active { transform: scale(0.98); }
    .btn-primary:hover { opacity: 0.9; }
    .social-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 1px solid #d1d1d6;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s ease;
      cursor: pointer;
    }
    .social-btn:hover { background-color: #f5f5f7; }
    .hidden-element { display: none !important; }
    
    /* Toggle Tabs */
    .tab-container {
      display: flex;
      background: #f5f5f7;
      border-radius: 12px;
      padding: 4px;
      margin-bottom: 24px;
    }
    .tab-btn {
      flex: 1;
      padding: 10px 0;
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      border-radius: 8px;
      color: #6e6e73;
      transition: all 0.2s ease;
    }
    .tab-btn.active {
      background: #ffffff;
      color: #000000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
  </style>
</head>
<body class="flex justify-center items-start min-h-screen sm:bg-[#f5f5f7] sm:pt-12 sm:pb-12">

  <div id="appContainer" class="w-full max-w-[440px] bg-white sm:rounded-[32px] sm:shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative p-6 sm:p-10 min-h-screen sm:min-h-0">
    
    <button class="absolute top-6 right-6 text-gray-400 hover:text-black transition-colors">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>

    <h1 id="pageTitle" class="text-[22px] font-bold text-center mb-6 tracking-tight">Motif Account</h1>

    <!-- TABS -->
    <div class="tab-container">
      <button id="tabSignIn" type="button" class="tab-btn active">Sign In</button>
      <button id="tabSignUp" type="button" class="tab-btn">Create Account</button>
    </div>

    <div id="errorBanner" class="hidden mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 text-center"></div>

    <form id="authForm" class="space-y-4">
      
      <!-- Only visible during Sign Up -->
      <div id="nameRow" class="grid grid-cols-2 gap-4 hidden-element">
        <div class="input-container">
          <label class="input-label">First name</label>
          <input type="text" id="firstName" class="input-field" placeholder="" />
        </div>
        <div class="input-container">
          <label class="input-label">Last name</label>
          <input type="text" id="lastName" class="input-field" placeholder="" />
        </div>
      </div>

      <!-- Always visible -->
      <div class="input-container">
        <label class="input-label">Email</label>
        <input type="email" id="email" class="input-field" required />
      </div>

      <div class="input-container flex items-center pr-4">
        <div class="relative flex-1">
          <label class="input-label">Password</label>
          <input type="password" id="password" class="input-field" required minlength="6" />
        </div>
      </div>

      <div class="pt-2 space-y-3">
        <button type="submit" id="submitBtn" class="btn-primary w-full py-4 rounded-xl font-semibold text-[15px] flex justify-center items-center">
          Sign In
        </button>
      </div>
    </form>

    <div class="mt-8 text-center">
      <p class="text-[13px] text-[#6e6e73] mb-6">Or continue with</p>
      <div class="flex justify-center space-x-5">
        <!-- Google Only -->
        <button type="button" id="googleBtn" class="social-btn group">
          <svg class="w-6 h-6 group-hover:opacity-80 transition-opacity" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        </button>
      </div>
    </div>

    <div class="mt-10 text-center space-y-4">
      <p class="text-[11px] text-[#86868b] px-4 leading-relaxed">
        By continuing, you agree to our <a href="#" class="text-black hover:underline">user agreement</a> and acknowledge our <a href="#" class="text-black hover:underline">privacy notice</a>.
      </p>

      <div class="pt-4 border-t border-gray-100">
        <button type="button" id="bypassBtn" class="text-[11px] text-[#86868b] hover:text-black hover:underline transition-colors">
          Bypass (Test ChatGPT Connection)
        </button>
      </div>
    </div>

  </div>

  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
    import { 
      getAuth, 
      signInWithRedirect, 
      getRedirectResult,
      GoogleAuthProvider, 
      createUserWithEmailAndPassword, 
      signInWithEmailAndPassword,
      updateProfile
    } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
    
    const firebaseConfig = {
      apiKey: "AIzaSyAa_sn28F6iMOIej17qVLrnP87_McebFHs",
      authDomain: "lifeskillzs.firebaseapp.com",
      projectId: "lifeskillzs",
      storageBucket: "lifeskillzs.firebasestorage.app",
      messagingSenderId: "636631359646",
      appId: "1:636631359646:web:3ad231ad903ee4f8385b8f"
    };

    let app, auth;
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
    } catch (e) {
      console.error("Firebase config missing or invalid", e);
    }

    // Capture OAuth params immediately
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUri = urlParams.get('redirect_uri');
    const state = urlParams.get('state');
    
    if (redirectUri && state) {
      sessionStorage.setItem('motif_oauth_redirect_uri', redirectUri);
      sessionStorage.setItem('motif_oauth_state', state);
    }

    function handleSuccess(uid) {
      const storedUri = sessionStorage.getItem('motif_oauth_redirect_uri');
      const storedState = sessionStorage.getItem('motif_oauth_state');
      
      if (storedUri && storedState) {
        window.location.href = \`\${storedUri}?code=\${uid}&state=\${storedState}\`;
      } else {
        document.getElementById('appContainer').innerHTML = \`
          <div class="flex flex-col items-center justify-center h-full text-center py-20">
            <div class="w-20 h-20 bg-[#39FF14] rounded-full flex items-center justify-center mb-6">
              <svg class="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 class="text-3xl font-bold mb-3 tracking-tight">Connected</h2>
            <p class="text-[#6e6e73] text-[15px]">You can securely close this window and return to ChatGPT.</p>
          </div>
        \`;
      }
    }

    const errorBanner = document.getElementById('errorBanner');
    function showError(msg) {
      errorBanner.innerText = msg;
      errorBanner.classList.remove('hidden');
    }

    // CHECK FOR GOOGLE REDIRECT SUCCESS
    getRedirectResult(auth).then((result) => {
      if (result && result.user) {
        handleSuccess(result.user.uid);
      }
    }).catch((error) => {
      showError("Google login failed: " + error.message);
    });

    // UI Toggle Logic
    let isSignUp = false; // Default to Sign In
    const tabSignIn = document.getElementById('tabSignIn');
    const tabSignUp = document.getElementById('tabSignUp');
    const nameRow = document.getElementById('nameRow');
    const submitBtn = document.getElementById('submitBtn');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    
    tabSignIn.addEventListener('click', () => {
      isSignUp = false;
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      nameRow.classList.add('hidden-element');
      submitBtn.innerText = "Sign In";
      firstNameInput.required = false;
      lastNameInput.required = false;
      errorBanner.classList.add('hidden');
    });

    tabSignUp.addEventListener('click', () => {
      isSignUp = true;
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      nameRow.classList.remove('hidden-element');
      submitBtn.innerText = "Create an account";
      firstNameInput.required = true;
      lastNameInput.required = true;
      errorBanner.classList.add('hidden');
    });

    document.getElementById('authForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBanner.classList.add('hidden');
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const originalText = submitBtn.innerText;
      
      submitBtn.innerText = "Processing...";
      submitBtn.disabled = true;

      try {
        if (isSignUp) {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          const firstName = firstNameInput.value;
          const lastName = lastNameInput.value;
          await updateProfile(cred.user, { displayName: \`\${firstName} \${lastName}\`.trim() });
          handleSuccess(cred.user.uid);
        } else {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          handleSuccess(cred.user.uid);
        }
      } catch (error) {
        let userFriendlyMsg = error.message;
        if (error.code === 'auth/email-already-in-use') userFriendlyMsg = "Email is already in use. Please switch to Sign In.";
        if (error.code === 'auth/invalid-credential') userFriendlyMsg = "Invalid email or password.";
        showError(userFriendlyMsg);
      } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
      }
    });

    document.getElementById('googleBtn').addEventListener('click', () => {
      const provider = new GoogleAuthProvider();
      signInWithRedirect(auth, provider);
    });

    document.getElementById('bypassBtn').addEventListener('click', (e) => {
      e.preventDefault();
      handleSuccess("motif_dev_test_user_001");
    });
  </script>
</body>
</html>
`;
fs.writeFileSync('public/authorize.html', html);
console.log('Done writing new authorize.html');
