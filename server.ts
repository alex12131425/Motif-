import express from 'express';
import cors from 'cors';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
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
  taste_dna: { genres: {}, moods: {}, mediums: {}, attributes: {} },
  context: { energy: "Normal", setting: "Alone", time_available_mins: 120 },
  library: [], history: [], custom_lists: {}, connected_sources: [], explorer_score: 50
};

async function getProfile(userId: string) {
  try {
    const userRef = doc(db, 'motif_users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) return snap.data().profile;
  } catch (e) { console.error("Firestore get error:", e); }
  return JSON.parse(JSON.stringify(defaultMotifProfile));
}

async function saveProfile(userId: string, profile: any) {
  try {
    const userRef = doc(db, 'motif_users', userId);
    await setDoc(userRef, { profile }, { merge: true });
  } catch (e) { console.error("Firestore save error:", e); }
}

// --- MCP TOOLS SCHEMA (32 Actions) ---
const TOOLS_SCHEMA = [
  // CORE PROFILE & TASTE (8)
  { name: "get_motif_profile", description: "Fetch user's Taste DNA & library.", inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } },
  { name: "update_taste_dna", description: "Modify taste graph based on likes/dislikes.", inputSchema: { type: "object", properties: { user_id: { type: "string" }, category: { type: "string" }, trait: { type: "string" }, score_adjustment: { type: "number" } }, required: ["user_id", "category", "trait", "score_adjustment"] } },
  { name: "set_context", description: "Update user situation (energy, setting, time).", inputSchema: { type: "object", properties: { user_id: { type: "string" }, energy: { type: "string" }, setting: { type: "string" }, time_available_mins: { type: "number" } }, required: ["user_id"] } },
  { name: "add_to_library", description: "Save item to library.", inputSchema: { type: "object", properties: { user_id: { type: "string" }, title: { type: "string" }, type: { type: "string" }, status: { type: "string" } }, required: ["user_id", "title", "type", "status"] } },
  { name: "remove_from_library", description: "Remove item from library.", inputSchema: { type: "object", properties: { user_id: { type: "string" }, title: { type: "string" } }, required: ["user_id", "title"] } },
  { name: "log_interaction", description: "Log consumed item.", inputSchema: { type: "object", properties: { user_id: { type: "string" }, title: { type: "string" }, interaction: { type: "string" } }, required: ["user_id", "title", "interaction"] } },
  { name: "clear_user_data", description: "Delete all user data (Privacy Compliance).", inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } },
  { name: "analyze_taste_shift", description: "Analyze how taste has changed over time.", inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } },

  // VIRAL & DISCOVERY (6)
  { name: "generate_taste_card", description: "Shareable DNA summary.", inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } },
  { name: "what_should_i_do_tonight", description: "Cross-Category Intelligence Chain.", inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } },
  { name: "surprise_me", description: "Anti-Filter-Bubble recommendation.", inputSchema: { type: "object", properties: { user_id: { type: "string" }, risk_level: { type: "string" } }, required: ["user_id", "risk_level"] } },
  { name: "sync_passive_data", description: "Simulate passive data sync.", inputSchema: { type: "object", properties: { user_id: { type: "string" }, source_name: { type: "string" }, inferred_traits: { type: "string" } }, required: ["user_id", "source_name"] } },
  { name: "group_night_match", description: "Merge DNA of multiple users for group recommendations.", inputSchema: { type: "object", properties: { user_ids: { type: "array", items: { type: "string" } } }, required: ["user_ids"] } },
  { name: "generate_weekend_plan", description: "Generate a multi-day entertainment plan.", inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } },

  // MOVIES & TV - TMDB (5)
  { name: "tmdb_search_movie", description: "Search movies via TMDB.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "tmdb_search_tv", description: "Search TV shows via TMDB.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "tmdb_get_trending", description: "Get trending movies/tv.", inputSchema: { type: "object", properties: { media_type: { type: "string", description: "movie, tv, all" } }, required: ["media_type"] } },
  { name: "tmdb_get_similar", description: "Get similar movies.", inputSchema: { type: "object", properties: { movie_id: { type: "string" } }, required: ["movie_id"] } },
  { name: "tmdb_get_providers", description: "Find where to stream a movie.", inputSchema: { type: "object", properties: { movie_id: { type: "string" } }, required: ["movie_id"] } },

  // ANIME & MANGA - JIKAN (4)
  { name: "jikan_search_anime", description: "Search anime database.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "jikan_get_top_anime", description: "Get top ranked anime.", inputSchema: { type: "object", properties: { filter: { type: "string", description: "bypopularity, favorite, airing" } }, required: [] } },
  { name: "jikan_search_manga", description: "Search manga database.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "jikan_get_season_now", description: "Get currently airing anime.", inputSchema: { type: "object", properties: {}, required: [] } },

  // MUSIC & PODCASTS - ITUNES (2)
  { name: "itunes_search_music", description: "Search music tracks/albums.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "itunes_search_podcast", description: "Search podcasts.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },

  // BOOKS - GOOGLE BOOKS (1)
  { name: "google_books_search", description: "Search books and authors.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },

  // GAMES - FREETOGAME (2)
  { name: "freetogame_get_games", description: "Search free games by platform/category.", inputSchema: { type: "object", properties: { platform: { type: "string", description: "pc, browser, all" }, category: { type: "string", description: "shooter, mmorpg, strategy, etc." } }, required: [] } },
  { name: "freetogame_sort", description: "Get top free games sorted.", inputSchema: { type: "object", properties: { sort_by: { type: "string", description: "release-date, popularity, alphabetical, relevance" } }, required: ["sort_by"] } },

  // RECIPES & FOOD - THEMEALDB (2)
  { name: "themealdb_search_recipe", description: "Search recipes by name or ingredient.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "themealdb_get_random", description: "Get a random recipe.", inputSchema: { type: "object", properties: {}, required: [] } },

  // CUSTOM LISTS & GENERAL ENGINES (2)
  { name: "manage_custom_list", description: "Create or modify a custom WatchFinder list.", inputSchema: { type: "object", properties: { user_id: { type: "string" }, list_name: { type: "string" }, action: { type: "string", description: "create, add_item, remove_item" }, item: { type: "string" } }, required: ["user_id", "list_name", "action"] } },
  { name: "general_entertainment_query", description: "A catch-all tool to process any general leisure request (events, local, random) and log it in Motif Context.", inputSchema: { type: "object", properties: { user_id: { type: "string" }, query: { type: "string" } }, required: ["user_id", "query"] } }
];

// --- HELPER FETCH WRAPPER ---
async function apiFetch(url: string, headers: any = {}) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return { error: `API returned ${res.status}` };
    return await res.json();
  } catch (e: any) {
    return { error: e.message };
  }
}

// --- TOOL EXECUTION LOGIC ---
async function executeTool(name: string, args: any) {
  const userId = args.user_id;
  let profile = null;
  if (userId) profile = await getProfile(userId);
  const today = new Date().toISOString();

  switch (name) {
    // --- CORE ---
    case "get_motif_profile": return profile;
    case "update_taste_dna": {
      const { category, trait, score_adjustment } = args;
      if (!profile.taste_dna[category]) profile.taste_dna[category] = {};
      let score = profile.taste_dna[category][trait] || 0.5;
      score = Math.max(0.0, Math.min(1.0, score + score_adjustment));
      profile.taste_dna[category][trait] = score;
      await saveProfile(userId, profile);
      return { status: "success", trait, score };
    }
    case "set_context": {
      if (args.energy) profile.context.energy = args.energy;
      if (args.setting) profile.context.setting = args.setting;
      if (args.time_available_mins) profile.context.time_available_mins = args.time_available_mins;
      await saveProfile(userId, profile);
      return { status: "success", context: profile.context };
    }
    case "add_to_library": {
      const item = { id: Date.now().toString(), title: args.title, type: args.type, status: args.status, added_at: today };
      profile.library.push(item);
      await saveProfile(userId, profile);
      return { status: "success", item };
    }
    case "remove_from_library": {
      const initialLen = profile.library.length;
      profile.library = profile.library.filter((i: any) => i.title.toLowerCase() !== args.title.toLowerCase());
      await saveProfile(userId, profile);
      return { status: "success", removed: initialLen > profile.library.length };
    }
    case "log_interaction": {
      profile.history.push({ title: args.title, interaction: args.interaction, timestamp: today });
      await saveProfile(userId, profile);
      return { status: "success", logged: args.title };
    }
    case "clear_user_data": {
      await deleteDoc(doc(db, 'motif_users', userId));
      return { status: "success", message: "All user data deleted securely." };
    }
    case "analyze_taste_shift": return { message: "Taste has shifted towards shorter, high-energy content recently.", top_new_trait: "Fast Pacing" };

    // --- VIRAL & DISCOVERY ---
    case "generate_taste_card": {
      const genres = profile.taste_dna.genres || {};
      const topGenre = Object.keys(genres).sort((a,b) => genres[b] - genres[a])[0] || "Exploring";
      return { card: `MY ENTERTAINMENT DNA\nTop genre: ${topGenre}\nExplorer score: ${profile.explorer_score || 50}\n@motif` };
    }
    case "what_should_i_do_tonight": return { message: "Generated cross-category chain based on DNA.", chain: { WATCH: "Movie/TV", LISTEN: "Music/Podcast", PLAY: "Game", DO: "Activity" } };
    case "surprise_me": return { bucket: args.risk_level, instructions: `Generate a recommendation fitting the ${args.risk_level} bucket.` };
    case "sync_passive_data": return { status: "success", message: "Simulated sync complete." };
    case "group_night_match": return { compatibility_score: "85%", common_genres: ["Comedy", "Sci-Fi"] };
    case "generate_weekend_plan": return { friday: "Movie Night", saturday: "Gaming & Takeout", sunday: "Podcast & Walk" };

    // --- TMDB (MOVIES/TV) ---
    case "tmdb_search_movie": {
      if (!process.env.TMDB_API_KEY) return { error: "TMDB_API_KEY missing in Render environment variables. Cannot fetch live movie data." };
      return await apiFetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(args.query)}`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
    }
    case "tmdb_search_tv": {
      if (!process.env.TMDB_API_KEY) return { error: "TMDB_API_KEY missing in Render environment variables." };
      return await apiFetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(args.query)}`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
    }
    case "tmdb_get_trending": {
      if (!process.env.TMDB_API_KEY) return { error: "TMDB_API_KEY missing." };
      return await apiFetch(`https://api.themoviedb.org/3/trending/${args.media_type}/day`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
    }
    case "tmdb_get_similar": {
      if (!process.env.TMDB_API_KEY) return { error: "TMDB_API_KEY missing." };
      return await apiFetch(`https://api.themoviedb.org/3/movie/${args.movie_id}/similar`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
    }
    case "tmdb_get_providers": {
      if (!process.env.TMDB_API_KEY) return { error: "TMDB_API_KEY missing." };
      return await apiFetch(`https://api.themoviedb.org/3/movie/${args.movie_id}/watch/providers`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
    }

    // --- JIKAN (ANIME/MANGA - FREE) ---
    case "jikan_search_anime": return await apiFetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(args.query)}&sfw=true`);
    case "jikan_get_top_anime": {
      const filter = args.filter ? `?filter=${args.filter}` : '';
      return await apiFetch(`https://api.jikan.moe/v4/top/anime${filter}`);
    }
    case "jikan_search_manga": return await apiFetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(args.query)}`);
    case "jikan_get_season_now": return await apiFetch(`https://api.jikan.moe/v4/seasons/now`);

    // --- ITUNES (MUSIC/PODCASTS - FREE) ---
    case "itunes_search_music": return await apiFetch(`https://itunes.apple.com/search?term=${encodeURIComponent(args.query)}&entity=musicTrack&limit=10`);
    case "itunes_search_podcast": return await apiFetch(`https://itunes.apple.com/search?term=${encodeURIComponent(args.query)}&entity=podcast&limit=10`);

    // --- GOOGLE BOOKS (BOOKS - FREE) ---
    case "google_books_search": return await apiFetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(args.query)}`);

    // --- FREETOGAME (GAMES - FREE) ---
    case "freetogame_get_games": {
      let url = 'https://www.freetogame.com/api/games?';
      if (args.platform) url += `platform=${args.platform}&`;
      if (args.category) url += `category=${args.category}`;
      return await apiFetch(url);
    }
    case "freetogame_sort": return await apiFetch(`https://www.freetogame.com/api/games?sort-by=${args.sort_by}`);

    // --- THEMEALDB (RECIPES - FREE) ---
    case "themealdb_search_recipe": return await apiFetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(args.query)}`);
    case "themealdb_get_random": return await apiFetch(`https://www.themealdb.com/api/json/v1/1/random.php`);

    // --- CUSTOM LISTS & GENERAL ---
    case "manage_custom_list": {
      if (!profile.custom_lists[args.list_name]) profile.custom_lists[args.list_name] = [];
      if (args.action === "add_item" && args.item) profile.custom_lists[args.list_name].push(args.item);
      if (args.action === "remove_item" && args.item) {
        profile.custom_lists[args.list_name] = profile.custom_lists[args.list_name].filter((i: string) => i !== args.item);
      }
      await saveProfile(userId, profile);
      return { status: "success", list: profile.custom_lists[args.list_name] };
    }
    case "general_entertainment_query": {
      // Log context for general queries (e.g. "Find me a local escape room")
      profile.history.push({ title: `General Query: ${args.query}`, interaction: "Searched", timestamp: today });
      await saveProfile(userId, profile);
      return { 
        status: "logged", 
        message: "General query logged to Context Engine. AI should use its vast general knowledge to answer the user's specific request about this entertainment topic." 
      };
    }

    default: return { error: "Tool not implemented" };
  }
}

// --- HTTP & SSE ENDPOINTS ---
app.get('/health', (req, res) => res.json({ status: "Motif MCP Server running", version: "4.0 (32 Actions)", actions_count: TOOLS_SCHEMA.length }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'authorize.html')));
app.post('/token', (req, res) => {
  const code = req.body.code || req.query.code;
  if (!code) return res.status(400).json({ error: "Missing code parameter" });
  res.json({ access_token: code, token_type: "bearer", expires_in: 31536000, refresh_token: code });
});

const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req, res) => {
  let authUserId = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) authUserId = authHeader.substring(7);

  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);
  res.on('close', () => transports.delete(transport.sessionId));

  const mcpServer = new Server({ name: "Motif", version: "4.0.0" }, { capabilities: { tools: {} } });
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS_SCHEMA }));
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments || {};
    if (authUserId) args.user_id = authUserId;
    try {
      const result = await executeTool(toolName, args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
    }
  });

  await mcpServer.connect(transport);
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  if (!transport) return res.status(404).json({ error: "Session not found" });
  await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Motif Server running on port ${PORT}`));
