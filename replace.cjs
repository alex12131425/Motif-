const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Replace import
content = content.replace("import { google } from 'googleapis';", "import { initializeApp } from 'firebase/app';\nimport { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';");

// Find start and end indices for replacement
const startLine = "let spreadsheetId: string | null = null;";
const endLine = "function daysUntil(dateString: string) {";

const startIndex = content.indexOf(startLine);
const endIndex = content.indexOf(endLine);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find start or end bounds.");
    process.exit(1);
}

const replacement = `// Initialize Firebase for the Server using your keys!
const firebaseConfig = {
  apiKey: "AIzaSyAa_sn28F6iMOIej17qVLrnP87_McebFHs",
  authDomain: "lifeskillzs.firebaseapp.com",
  projectId: "lifeskillzs",
  storageBucket: "lifeskillzs.firebasestorage.app",
  messagingSenderId: "636631359646",
  appId: "1:636631359646:web:3ad231ad903ee4f8385b8f",
  measurementId: "G-7H1JC4YS0Y"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

async function getProfile(userId: string): Promise<{ profile: any, rowIdx: number | null }> {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return { profile: snap.data().profile, rowIdx: 1 };
    }
  } catch (e: any) {
    console.error("Firestore get error:", e);
    // Continue and return default profile if error (so new users don't break)
  }
  
  const defaultProfile = {
    basics: { created: new Date().toISOString().split('T')[0], household_size: 1, budget_style: 'Standard' },
    devices: [],
    subscriptions: [],
    renewals: [],
    maintenance: [],
    financial: { insurance: [], phone_plan: { cost: 0.0, provider: '' }, internet: { cost: 0.0, provider: '' } },
    preferences: { brand_loyalties: [], budget_style: 'Standard', dislikes: [] },
    flags: []
  };
  return { profile: defaultProfile, rowIdx: null };
}

async function saveProfile(userId: string, profile: any, rowIdx: number | null) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { profile, lastUpdated: new Date().toISOString() });
  } catch (e: any) {
    console.error("Firestore save error:", e);
    throw new Error("Missing permissions to save data. Please check your Firestore Security Rules.");
  }
}

`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);

fs.writeFileSync('server.ts', content);
console.log("Replaced successfully!");
