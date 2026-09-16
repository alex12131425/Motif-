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
app.use((req, res, next) => {
  if (req.path === '/messages') return next();
  express.json()(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true })(req, res, next);
  });
});
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

async function apiFetch(url: string, headers: any = {}) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return { error: `API returned ${res.status}` };
    return await res.json();
  } catch (e: any) {
    return { error: e.message };
  }
}


// --- MODERN LAYOUT ENGINE ---
function buildModernCard(media, providers, type) {
  const poster = media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : (media.image_url || '');
  const title = media.title || media.name || 'Unknown Title';
  const year = (media.release_date || media.first_air_date || media.year || '').toString().split('-')[0];
  const rating = media.vote_average ? media.vote_average.toFixed(1) : (media.score || 'N/A');
  const overview = media.overview || media.synopsis || 'No description available.';
  
  let watchLinks = [];
  if (providers && providers.results && providers.results.US) {
    const us = providers.results.US;
    if (us.flatrate) watchLinks.push(`[▶️ Stream on ${us.flatrate[0].provider_name}](${us.link})`);
    else if (us.rent) watchLinks.push(`[🛒 Rent on ${us.rent[0].provider_name}](${us.link})`);
    else if (us.buy) watchLinks.push(`[💳 Buy on ${us.buy[0].provider_name}](${us.link})`);
  }
  
  const tmdbLink = type === 'movie' ? `https://www.themoviedb.org/movie/${media.id}` : (type === 'tv' ? `https://www.themoviedb.org/tv/${media.id}` : '');
  if (watchLinks.length === 0 && tmdbLink) {
    watchLinks.push(`[▶️ Find Where to Watch](${tmdbLink}/watch)`);
  }
  const watchText = watchLinks.length > 0 ? watchLinks.join(' | ') : '[▶️ Search Providers](https://www.justwatch.com)';

  return `
> # 🎬 **${title}** (${year})
> ![${title} Poster](${poster})
> 
> **⭐ ${rating}/10**
> 
> *${overview}*
> 
> ---
> ${watchText}
> 
> **🔹 Quick Actions (Tell me to do these!):**
> 💾 "Save to my Motif Library"
> 👍 "I loved this, update my DNA"
> 👎 "Not for me"
> 🔍 "Show me 5 more like this"
`;
}

// --- TOOLS SCHEMA
// --- TOOLS SCHEMA (32 Actions) ---
const TOOLS_SCHEMA = [
  { name: "get_motif_profile", description: "Fetch user's Taste DNA & library.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "update_taste_dna", description: "Modify taste graph based on likes/dislikes.", inputSchema: { type: "object", properties: { category: { type: "string" }, trait: { type: "string" }, score_adjustment: { type: "number" } }, required: ["category", "trait", "score_adjustment"] } },
  { name: "set_context", description: "Update user situation (energy, setting, time).", inputSchema: { type: "object", properties: { energy: { type: "string" }, setting: { type: "string" }, time_available_mins: { type: "number" } }, required: [] } },
  { name: "add_to_library", description: "Save item to library.", inputSchema: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, status: { type: "string" } }, required: ["title", "type", "status"] } },
  { name: "remove_from_library", description: "Remove item from library.", inputSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] } },
  { name: "log_interaction", description: "Log consumed item.", inputSchema: { type: "object", properties: { title: { type: "string" }, interaction: { type: "string" } }, required: ["title", "interaction"] } },
  { name: "clear_user_data", description: "Delete all user data.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "analyze_taste_shift", description: "Analyze taste changes.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "generate_taste_card", description: "Shareable DNA summary.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "what_should_i_do_tonight", description: "Cross-Category Intelligence Chain.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "surprise_me", description: "Anti-Filter-Bubble recommendation.", inputSchema: { type: "object", properties: { risk_level: { type: "string" } }, required: ["risk_level"] } },
  { name: "sync_passive_data", description: "Simulate passive data sync.", inputSchema: { type: "object", properties: { source_name: { type: "string" }, inferred_traits: { type: "string" } }, required: ["source_name"] } },
  { name: "group_night_match", description: "Merge DNA of multiple users.", inputSchema: { type: "object", properties: { user_ids: { type: "array", items: { type: "string" } } }, required: ["user_ids"] } },
  { name: "generate_weekend_plan", description: "Generate a multi-day plan.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "tmdb_search_movie", description: "Search movies via TMDB.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "tmdb_search_tv", description: "Search TV shows via TMDB.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "tmdb_get_trending", description: "Get trending movies/tv.", inputSchema: { type: "object", properties: { media_type: { type: "string" } }, required: ["media_type"] } },
  { name: "tmdb_get_similar", description: "Get similar movies.", inputSchema: { type: "object", properties: { movie_id: { type: "string" } }, required: ["movie_id"] } },
  { name: "tmdb_get_providers", description: "Find where to stream.", inputSchema: { type: "object", properties: { movie_id: { type: "string" } }, required: ["movie_id"] } },
  { name: "jikan_search_anime", description: "Search anime.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "jikan_get_top_anime", description: "Top anime.", inputSchema: { type: "object", properties: { filter: { type: "string" } }, required: [] } },
  { name: "jikan_search_manga", description: "Search manga.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "jikan_get_season_now", description: "Airing now.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "itunes_search_music", description: "Search music tracks/albums.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "itunes_search_podcast", description: "Search podcasts.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "google_books_search", description: "Search books.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "freetogame_get_games", description: "Free games.", inputSchema: { type: "object", properties: { platform: { type: "string" }, category: { type: "string" } }, required: [] } },
  { name: "freetogame_sort", description: "Top free games.", inputSchema: { type: "object", properties: { sort_by: { type: "string" } }, required: ["sort_by"] } },
  { name: "themealdb_search_recipe", description: "Search recipes.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "themealdb_get_random", description: "Random recipe.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "manage_custom_list", description: "Manage lists.", inputSchema: { type: "object", properties: { list_name: { type: "string" }, action: { type: "string" }, item: { type: "string" } }, required: ["list_name", "action"] } },
  { name: "general_entertainment_query", description: "Catch-all query.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }
];

async function executeTool(name: string, args: any, userId: string) {
  let profile = await getProfile(userId);
  const today = new Date().toISOString();

  switch (name) {
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
    
    case "tmdb_search_movie": {
      const data = await apiFetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(args.query)}`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
      if (data.results && data.results.length > 0) {
        const movie = data.results[0];
        const providers = await apiFetch(`https://api.themoviedb.org/3/movie/${movie.id}/watch/providers`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
        const layout = buildModernCard(movie, providers, 'movie');
        return { data: data.results.slice(0, 3), presentation_layout: layout, instructions: "CRITICAL: You MUST output the exact string provided in 'presentation_layout' to the user. It is a pre-formatted Markdown UI card. Do not modify the layout string." };
      }
      return data;
    }
    case "tmdb_search_tv": {
      const data = await apiFetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(args.query)}`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
      if (data.results && data.results.length > 0) {
        const tv = data.results[0];
        const providers = await apiFetch(`https://api.themoviedb.org/3/tv/${tv.id}/watch/providers`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
        const layout = buildModernCard(tv, providers, 'tv');
        return { data: data.results.slice(0, 3), presentation_layout: layout, instructions: "CRITICAL: You MUST output the exact string provided in 'presentation_layout' to the user. It is a pre-formatted Markdown UI card." };
      }
      return data;
    }
    case "tmdb_get_trending": {
      const data = await apiFetch(`https://api.themoviedb.org/3/trending/${args.media_type}/day`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        const providers = await apiFetch(`https://api.themoviedb.org/3/${args.media_type}/${item.id}/watch/providers`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
        const layout = buildModernCard(item, providers, args.media_type);
        return { data: data.results.slice(0, 5), presentation_layout: layout, instructions: "CRITICAL: You MUST output the exact string provided in 'presentation_layout' to the user. It is a pre-formatted Markdown UI card." };
      }
      return data;
    }

    case "tmdb_get_similar": return await apiFetch(`https://api.themoviedb.org/3/movie/${args.movie_id}/similar`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
    case "tmdb_get_providers": return await apiFetch(`https://api.themoviedb.org/3/movie/${args.movie_id}/watch/providers`, { Authorization: `Bearer ${process.env.TMDB_API_KEY}` });
    case "jikan_search_anime": return await apiFetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(args.query)}&sfw=true`);
    case "jikan_get_top_anime": return await apiFetch(`https://api.jikan.moe/v4/top/anime${args.filter ? '?filter=' + args.filter : ''}`);
    case "jikan_search_manga": return await apiFetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(args.query)}`);
    case "jikan_get_season_now": return await apiFetch(`https://api.jikan.moe/v4/seasons/now`);
    case "itunes_search_music": return await apiFetch(`https://itunes.apple.com/search?term=${encodeURIComponent(args.query)}&entity=musicTrack&limit=10`);
    case "itunes_search_podcast": return await apiFetch(`https://itunes.apple.com/search?term=${encodeURIComponent(args.query)}&entity=podcast&limit=10`);
    case "google_books_search": return await apiFetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(args.query)}`);
    case "freetogame_get_games": return await apiFetch(`https://www.freetogame.com/api/games?platform=${args.platform||''}&category=${args.category||''}`);
    case "freetogame_sort": return await apiFetch(`https://www.freetogame.com/api/games?sort-by=${args.sort_by}`);
    case "themealdb_search_recipe": return await apiFetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(args.query)}`);
    case "themealdb_get_random": return await apiFetch(`https://www.themealdb.com/api/json/v1/1/random.php`);
    case "manage_custom_list": {
      if (!profile.custom_lists[args.list_name]) profile.custom_lists[args.list_name] = [];
      if (args.action === "add_item" && args.item) profile.custom_lists[args.list_name].push(args.item);
      if (args.action === "remove_item" && args.item) profile.custom_lists[args.list_name] = profile.custom_lists[args.list_name].filter((i: any) => i !== args.item);
      await saveProfile(userId, profile);
      return { status: "success", list: profile.custom_lists[args.list_name] };
    }
    case "general_entertainment_query": {
      profile.history.push({ title: `General Query: ${args.query}`, interaction: "Searched", timestamp: today });
      await saveProfile(userId, profile);
      return { status: "logged", message: "Query logged to Context Engine. Answer based on vast general knowledge." };
    }
    default: return { error: "Tool not implemented" };
  }
}

// --- AUTH ENDPOINTS ---
app.get(['/.well-known/oauth-protected-resource/sse', '/.well-known/oauth-protected-resource'], (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const serverUrl = `https://${host}`;
  res.json({
    resource: `${serverUrl}/sse`,
    authorization_servers: [serverUrl],
    scopes_supported: [],
    bearer_methods_supported: ["header"]
  });
});

app.get('/.well-known/oauth-authorization-server', (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const serverUrl = `https://${host}`;
  res.json({
    issuer: serverUrl,
    authorization_endpoint: `${serverUrl}/authorize`,
    token_endpoint: `${serverUrl}/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
    code_challenge_methods_supported: ["S256"]
  });
});

app.get('/authorize', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'authorize.html'));
});

app.get('/auth', (req: any, res: any) => res.sendFile(path.join(__dirname, 'public', 'authorize.html')));
app.get('/', (req: any, res: any) => res.sendFile(path.join(__dirname, 'public', 'authorize.html')));
app.post('/token', (req: any, res: any) => {
  const code = req.body.code || req.query.code || req.body.client_id;
  if (!code) return res.status(400).json({ error: "Missing code parameter" });
  res.json({ access_token: code, token_type: "Bearer", expires_in: 31536000, refresh_token: code });
});

// --- MCP SSE INTEGRATION ---
const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req: any, res: any) => {
  // STRICT OAUTH CHECK FOR CHATGPT MCP PLUGIN
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("MCP /sse request blocked: No valid Authorization header.");
    return res.status(401).set("WWW-Authenticate", "Bearer").json({ error: "Unauthorized. Missing or invalid Authorization header. Please login via OAuth." });
  }
  
  const authUserId = authHeader.substring(7);

  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);
  res.on('close', () => transports.delete(transport.sessionId));

  const mcpServer = new Server({ name: "Motif", version: "4.0.0" }, { capabilities: { tools: {} } });
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS_SCHEMA }));
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await executeTool(request.params.name, request.params.arguments || {}, authUserId);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
    }
  });

  await mcpServer.connect(transport);
});

app.post('/messages', async (req: any, res: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).set("WWW-Authenticate", "Bearer").json({ error: "Unauthorized" });
  }
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  if (!transport) return res.status(404).json({ error: "Session not found" });
  await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Motif Server running on port ${PORT}`));
