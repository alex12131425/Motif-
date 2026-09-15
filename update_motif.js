const fs = require('fs');

const code = `import express from 'express';
import cors from 'cors';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- FIREBASE SETUP ---
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

// --- MOTIF PROFILE SCHEMA ---
const defaultMotifProfile = {
  taste_dna: {
    genres: {},       // e.g. { "Sci-Fi": 0.9, "Romance": 0.3 }
    moods: {},        // e.g. { "Dark": 0.8, "Cozy": 0.2 }
    mediums: {},      // e.g. { "Movie": 0.9, "Anime": 0.8, "Book": 0.1 }
    attributes: {}    // e.g. { "Fast Pacing": 0.8 }
  },
  context: {
    energy: "Normal", // Low, Normal, High
    setting: "Alone", // Alone, Partner, Friends, Family
    time_available_mins: 120
  },
  library: [],        // Saved items { id, title, type, status, added_at }
  history: [],        // Watched/Played items { id, title, type, interaction, timestamp }
  connected_sources: [], // e.g. ["browser_companion", "trakt", "myanimelist", "steam"]
  explorer_score: 50  // 0 (Only Safe) to 100 (Extremely Wildcard)
};

async function getProfile(userId) {
  try {
    const userRef = doc(db, 'motif_users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data().profile;
    }
  } catch (e) {
    console.error("Firestore get error:", e);
  }
  return JSON.parse(JSON.stringify(defaultMotifProfile));
}

async function saveProfile(userId, profile) {
  try {
    const userRef = doc(db, 'motif_users', userId);
    await setDoc(userRef, { profile }, { merge: true });
  } catch (e) {
    console.error("Firestore save error:", e);
  }
}

// --- MCP TOOLS SCHEMA ---
const TOOLS_SCHEMA = [
  {
    name: "get_motif_profile",
    description: "Fetch the user's complete Taste DNA, context, and library.",
    inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] }
  },
  {
    name: "update_taste_dna",
    description: "Modify the user's taste graph based on explicit likes/dislikes.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        category: { type: "string", description: "genres, moods, mediums, or attributes" },
        trait: { type: "string" },
        score_adjustment: { type: "number", description: "Value between -1.0 and 1.0" }
      },
      required: ["user_id", "category", "trait", "score_adjustment"]
    }
  },
  {
    name: "set_context",
    description: "Update the user's current situation (time available, mood, setting).",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        energy: { type: "string" },
        setting: { type: "string" },
        time_available_mins: { type: "number" }
      },
      required: ["user_id"]
    }
  },
  {
    name: "add_to_library",
    description: "Save an item to the user's library.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        title: { type: "string" },
        type: { type: "string" },
        status: { type: "string" }
      },
      required: ["user_id", "title", "type", "status"]
    }
  },
  // --- NEW SIGNATURE FEATURES ---
  {
    name: "generate_taste_card",
    description: "Generate a shareable 'MY ENTERTAINMENT DNA' summary based on their profile.",
    inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] }
  },
  {
    name: "what_should_i_do_tonight",
    description: "Cross-Category Intelligence: Suggests a Movie, Anime, Album, Game, and Activity based on Taste DNA and Context.",
    inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] }
  },
  {
    name: "surprise_me",
    description: "Provides a recommendation based on the Anti-Filter-Bubble logic (Safe, Adjacent, Wildcard).",
    inputSchema: { 
      type: "object", 
      properties: { 
        user_id: { type: "string" },
        risk_level: { type: "string", description: "safe, adjacent, wildcard" }
      }, 
      required: ["user_id", "risk_level"] 
    }
  },
  {
    name: "sync_passive_data",
    description: "Simulate pulling passive data from a connected source (Browser Companion, Trakt, Steam) to learn about the user.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        source_name: { type: "string", description: "e.g., 'browser_companion'" },
        inferred_traits: { type: "string", description: "JSON string of inferred traits to add to DNA" }
      },
      required: ["user_id", "source_name"]
    }
  }
];

// --- TOOL EXECUTION LOGIC ---
async function executeTool(name, args) {
  const userId = args.user_id;
  if (!userId) return { error: "user_id is required" };
  
  const profile = await getProfile(userId);
  const today = new Date().toISOString();

  if (name === "get_motif_profile") return profile;

  if (name === "update_taste_dna") {
    const { category, trait, score_adjustment } = args;
    if (!profile.taste_dna[category]) profile.taste_dna[category] = {};
    let currentScore = profile.taste_dna[category][trait] || 0.5;
    currentScore = Math.max(0.0, Math.min(1.0, currentScore + score_adjustment));
    profile.taste_dna[category][trait] = currentScore;
    await saveProfile(userId, profile);
    return { status: "success", updated_trait: trait, new_score: currentScore };
  }

  if (name === "set_context") {
    if (args.energy) profile.context.energy = args.energy;
    if (args.setting) profile.context.setting = args.setting;
    if (args.time_available_mins) profile.context.time_available_mins = args.time_available_mins;
    await saveProfile(userId, profile);
    return { status: "success", context: profile.context };
  }

  if (name === "add_to_library") {
    const item = { id: Date.now().toString(), title: args.title, type: args.type, status: args.status, added_at: today };
    profile.library.push(item);
    await saveProfile(userId, profile);
    return { status: "success", item_added: item };
  }

  if (name === "generate_taste_card") {
    // Determine top genre
    const genres = profile.taste_dna.genres || {};
    const topGenre = Object.keys(genres).sort((a,b) => genres[b] - genres[a])[0] || "Exploring";
    
    const moods = profile.taste_dna.moods || {};
    const topMood = Object.keys(moods).sort((a,b) => moods[b] - moods[a])[0] || "Exploring";
    
    return {
      card: \`MY ENTERTAINMENT DNA\\n\\nTop genre: \${topGenre}\\nFavorite mood: \${topMood}\\nExplorer score: \${profile.explorer_score || 50}\\n\\n@motif\`
    };
  }

  if (name === "what_should_i_do_tonight") {
    return {
      message: "Here is your cross-category discovery chain based on your Taste DNA:",
      chain: {
        WATCH: "Analyzing Taste DNA for a Movie or Show...",
        LISTEN: "Analyzing Taste DNA for an Album or Playlist...",
        PLAY: "Analyzing Taste DNA for a Game...",
        DO: "Analyzing local Activity context..."
      },
      instructions_for_llm: "Based on the user's profile, fill in specific real-world titles for each of these categories that match their top genres and current context. Do not use APIs yet, use your general knowledge of media."
    };
  }

  if (name === "surprise_me") {
    return {
      bucket: args.risk_level,
      instructions_for_llm: \`Generate a recommendation that fits the '\${args.risk_level}' bucket. 
      SAFE: Extremely likely to love (matches top DNA). 
      ADJACENT: Similar but introduces something new. 
      WILDCARD: Outside normal taste but fits their current Context.\`
    };
  }

  if (name === "sync_passive_data") {
    if (!profile.connected_sources) profile.connected_sources = [];
    if (!profile.connected_sources.includes(args.source_name)) {
      profile.connected_sources.push(args.source_name);
    }
    
    if (args.inferred_traits) {
      try {
        const traits = JSON.parse(args.inferred_traits);
        // Merge traits into DNA
        for (const cat of Object.keys(traits)) {
           if (!profile.taste_dna[cat]) profile.taste_dna[cat] = {};
           for (const t of Object.keys(traits[cat])) {
              profile.taste_dna[cat][t] = Math.max(0, Math.min(1.0, (profile.taste_dna[cat][t] || 0.5) + traits[cat][t]));
           }
        }
      } catch (e) {
        console.error("Error parsing passive traits");
      }
    }
    
    await saveProfile(userId, profile);
    return { status: "success", source: args.source_name, message: "Passive signals ingested successfully. Taste DNA expanded." };
  }

  return { error: "Tool not implemented" };
}

// --- HTTP & SSE ENDPOINTS ---
app.get('/health', (req, res) => {
  res.json({ status: "Motif MCP Server running", version: "3.0 (Full Plan)" });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'authorize.html'));
});

app.post('/token', (req, res) => {
  const code = req.body.code || req.query.code;
  if (!code) return res.status(400).json({ error: "Missing code parameter" });
  res.json({ access_token: code, token_type: "bearer", expires_in: 31536000, refresh_token: code });
});

const transports = new Map();

app.get('/sse', async (req, res) => {
  let authUserId = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) authUserId = authHeader.substring(7);

  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);
  res.on('close', () => transports.delete(transport.sessionId));

  const mcpServer = new Server({ name: "Motif", version: "3.0.0" }, { capabilities: { tools: {} } });
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS_SCHEMA }));
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments || {};
    if (authUserId) args.user_id = authUserId;
    try {
      const result = await executeTool(toolName, args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e) {
      return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
    }
  });

  await mcpServer.connect(transport);
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports.get(sessionId);
  if (!transport) return res.status(404).json({ error: "Session not found" });
  await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Motif Server running on port \${PORT}\`));
\`;

fs.writeFileSync('server.ts', code);
console.log('Motif Full Plan Injected');
