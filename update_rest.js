const fs = require('fs');

let code = `import express from 'express';
import cors from 'cors';
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

async function getProfile(userId) {
  try {
    const userRef = doc(db, 'motif_users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) return snap.data().profile;
  } catch (e) { console.error("Firestore get error:", e); }
  return JSON.parse(JSON.stringify(defaultMotifProfile));
}

async function saveProfile(userId, profile) {
  try {
    const userRef = doc(db, 'motif_users', userId);
    await setDoc(userRef, { profile }, { merge: true });
  } catch (e) { console.error("Firestore save error:", e); }
}

// --- HELPER FETCH WRAPPER ---
async function apiFetch(url, headers = {}) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return { error: \`API returned \${res.status}\` };
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}

// --- AUTH MIDDLEWARE FOR CHATGPT ---
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Missing or invalid Authorization header. Please login." });
  }
  req.userId = authHeader.substring(7); // The ChatGPT OAuth token is the Firebase UID
  next();
};

// --- HTTP ENDPOINTS FOR CHATGPT (32 ACTIONS) ---

// 1. CORE
app.post('/api/get_motif_profile', requireAuth, async (req, res) => {
  res.json(await getProfile(req.userId));
});

app.post('/api/update_taste_dna', requireAuth, async (req, res) => {
  const { category, trait, score_adjustment } = req.body;
  if(!category || !trait || score_adjustment===undefined) return res.status(400).json({error: "Missing params"});
  const profile = await getProfile(req.userId);
  if (!profile.taste_dna[category]) profile.taste_dna[category] = {};
  let score = profile.taste_dna[category][trait] || 0.5;
  score = Math.max(0.0, Math.min(1.0, score + score_adjustment));
  profile.taste_dna[category][trait] = score;
  await saveProfile(req.userId, profile);
  res.json({ status: "success", trait, score });
});

app.post('/api/set_context', requireAuth, async (req, res) => {
  const profile = await getProfile(req.userId);
  if (req.body.energy) profile.context.energy = req.body.energy;
  if (req.body.setting) profile.context.setting = req.body.setting;
  if (req.body.time_available_mins) profile.context.time_available_mins = req.body.time_available_mins;
  await saveProfile(req.userId, profile);
  res.json({ status: "success", context: profile.context });
});

app.post('/api/add_to_library', requireAuth, async (req, res) => {
  const { title, type, status } = req.body;
  const profile = await getProfile(req.userId);
  const item = { id: Date.now().toString(), title, type, status, added_at: new Date().toISOString() };
  profile.library.push(item);
  await saveProfile(req.userId, profile);
  res.json({ status: "success", item });
});

app.post('/api/remove_from_library', requireAuth, async (req, res) => {
  const profile = await getProfile(req.userId);
  const initialLen = profile.library.length;
  profile.library = profile.library.filter(i => i.title.toLowerCase() !== req.body.title.toLowerCase());
  await saveProfile(req.userId, profile);
  res.json({ status: "success", removed: initialLen > profile.library.length });
});

app.post('/api/log_interaction', requireAuth, async (req, res) => {
  const profile = await getProfile(req.userId);
  profile.history.push({ title: req.body.title, interaction: req.body.interaction, timestamp: new Date().toISOString() });
  await saveProfile(req.userId, profile);
  res.json({ status: "success", logged: req.body.title });
});

app.post('/api/clear_user_data', requireAuth, async (req, res) => {
  await deleteDoc(doc(db, 'motif_users', req.userId));
  res.json({ status: "success", message: "All user data deleted securely." });
});

app.post('/api/analyze_taste_shift', requireAuth, async (req, res) => {
  res.json({ message: "Taste has shifted towards shorter, high-energy content recently.", top_new_trait: "Fast Pacing" });
});

// 2. VIRAL & DISCOVERY
app.post('/api/generate_taste_card', requireAuth, async (req, res) => {
  const profile = await getProfile(req.userId);
  const genres = profile.taste_dna.genres || {};
  const topGenre = Object.keys(genres).sort((a,b) => genres[b] - genres[a])[0] || "Exploring";
  res.json({ card: \`MY ENTERTAINMENT DNA\\nTop genre: \${topGenre}\\nExplorer score: \${profile.explorer_score || 50}\\n@motif\` });
});

app.post('/api/what_should_i_do_tonight', requireAuth, async (req, res) => {
  res.json({ message: "Generated cross-category chain based on DNA.", chain: { WATCH: "Movie/TV", LISTEN: "Music/Podcast", PLAY: "Game", DO: "Activity" } });
});

app.post('/api/surprise_me', requireAuth, async (req, res) => {
  res.json({ bucket: req.body.risk_level, instructions: \`Generate a recommendation fitting the \${req.body.risk_level} bucket.\` });
});

app.post('/api/sync_passive_data', requireAuth, async (req, res) => {
  res.json({ status: "success", message: "Simulated sync complete." });
});

app.post('/api/group_night_match', requireAuth, async (req, res) => {
  res.json({ compatibility_score: "85%", common_genres: ["Comedy", "Sci-Fi"] });
});

app.post('/api/generate_weekend_plan', requireAuth, async (req, res) => {
  res.json({ friday: "Movie Night", saturday: "Gaming & Takeout", sunday: "Podcast & Walk" });
});

// 3. TMDB (MOVIES/TV)
app.post('/api/tmdb_search_movie', requireAuth, async (req, res) => {
  if (!process.env.TMDB_API_KEY) return res.json({ error: "TMDB_API_KEY missing in Render." });
  res.json(await apiFetch(\`https://api.themoviedb.org/3/search/movie?query=\${encodeURIComponent(req.body.query)}\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` }));
});

app.post('/api/tmdb_search_tv', requireAuth, async (req, res) => {
  if (!process.env.TMDB_API_KEY) return res.json({ error: "TMDB_API_KEY missing in Render." });
  res.json(await apiFetch(\`https://api.themoviedb.org/3/search/tv?query=\${encodeURIComponent(req.body.query)}\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` }));
});

app.post('/api/tmdb_get_trending', requireAuth, async (req, res) => {
  if (!process.env.TMDB_API_KEY) return res.json({ error: "TMDB_API_KEY missing." });
  res.json(await apiFetch(\`https://api.themoviedb.org/3/trending/\${req.body.media_type}/day\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` }));
});

app.post('/api/tmdb_get_similar', requireAuth, async (req, res) => {
  if (!process.env.TMDB_API_KEY) return res.json({ error: "TMDB_API_KEY missing." });
  res.json(await apiFetch(\`https://api.themoviedb.org/3/movie/\${req.body.movie_id}/similar\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` }));
});

app.post('/api/tmdb_get_providers', requireAuth, async (req, res) => {
  if (!process.env.TMDB_API_KEY) return res.json({ error: "TMDB_API_KEY missing." });
  res.json(await apiFetch(\`https://api.themoviedb.org/3/movie/\${req.body.movie_id}/watch/providers\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` }));
});

// 4. JIKAN (ANIME/MANGA - FREE)
app.post('/api/jikan_search_anime', requireAuth, async (req, res) => {
  res.json(await apiFetch(\`https://api.jikan.moe/v4/anime?q=\${encodeURIComponent(req.body.query)}&sfw=true\`));
});

app.post('/api/jikan_get_top_anime', requireAuth, async (req, res) => {
  const filter = req.body.filter ? \`?filter=\${req.body.filter}\` : '';
  res.json(await apiFetch(\`https://api.jikan.moe/v4/top/anime\${filter}\`));
});

app.post('/api/jikan_search_manga', requireAuth, async (req, res) => {
  res.json(await apiFetch(\`https://api.jikan.moe/v4/manga?q=\${encodeURIComponent(req.body.query)}\`));
});

app.post('/api/jikan_get_season_now', requireAuth, async (req, res) => {
  res.json(await apiFetch(\`https://api.jikan.moe/v4/seasons/now\`));
});

// 5. ITUNES (MUSIC/PODCASTS - FREE)
app.post('/api/itunes_search_music', requireAuth, async (req, res) => {
  res.json(await apiFetch(\`https://itunes.apple.com/search?term=\${encodeURIComponent(req.body.query)}&entity=musicTrack&limit=10\`));
});

app.post('/api/itunes_search_podcast', requireAuth, async (req, res) => {
  res.json(await apiFetch(\`https://itunes.apple.com/search?term=\${encodeURIComponent(req.body.query)}&entity=podcast&limit=10\`));
});

// 6. GOOGLE BOOKS (BOOKS - FREE)
app.post('/api/google_books_search', requireAuth, async (req, res) => {
  res.json(await apiFetch(\`https://www.googleapis.com/books/v1/volumes?q=\${encodeURIComponent(req.body.query)}\`));
});

// 7. FREETOGAME (GAMES - FREE)
app.post('/api/freetogame_get_games', requireAuth, async (req, res) => {
  let url = 'https://www.freetogame.com/api/games?';
  if (req.body.platform) url += \`platform=\${req.body.platform}&\`;
  if (req.body.category) url += \`category=\${req.body.category}\`;
  res.json(await apiFetch(url));
});

app.post('/api/freetogame_sort', requireAuth, async (req, res) => {
  res.json(await apiFetch(\`https://www.freetogame.com/api/games?sort-by=\${req.body.sort_by}\`));
});

// 8. THEMEALDB (RECIPES - FREE)
app.post('/api/themealdb_search_recipe', requireAuth, async (req, res) => {
  res.json(await apiFetch(\`https://www.themealdb.com/api/json/v1/1/search.php?s=\${encodeURIComponent(req.body.query)}\`));
});

app.post('/api/themealdb_get_random', requireAuth, async (req, res) => {
  res.json(await apiFetch(\`https://www.themealdb.com/api/json/v1/1/random.php\`));
});

// 9. CUSTOM LISTS & GENERAL
app.post('/api/manage_custom_list', requireAuth, async (req, res) => {
  const profile = await getProfile(req.userId);
  if (!profile.custom_lists[req.body.list_name]) profile.custom_lists[req.body.list_name] = [];
  if (req.body.action === "add_item" && req.body.item) profile.custom_lists[req.body.list_name].push(req.body.item);
  if (req.body.action === "remove_item" && req.body.item) {
    profile.custom_lists[req.body.list_name] = profile.custom_lists[req.body.list_name].filter(i => i !== req.body.item);
  }
  await saveProfile(req.userId, profile);
  res.json({ status: "success", list: profile.custom_lists[req.body.list_name] });
});

app.post('/api/general_entertainment_query', requireAuth, async (req, res) => {
  const profile = await getProfile(req.userId);
  profile.history.push({ title: \`General Query: \${req.body.query}\`, interaction: "Searched", timestamp: new Date().toISOString() });
  await saveProfile(req.userId, profile);
  res.json({ status: "logged", message: "Query logged to Context Engine. Answer based on vast general knowledge." });
});

// --- OPENAPI SCHEMA GENERATOR ---
app.get('/openapi.json', (req, res) => {
  const schema = {
    openapi: "3.1.0",
    info: { title: "Motif API", description: "The personal entertainment intelligence layer.", version: "4.0.0" },
    servers: [{ url: "https://motif-23oq.onrender.com" }],
    paths: {},
    components: {
      securitySchemes: {
        OAuth2: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: "https://motif-23oq.onrender.com/",
              tokenUrl: "https://motif-23oq.onrender.com/token",
              scopes: {}
            }
          }
        }
      }
    },
    security: [{ OAuth2: [] }]
  };

  const addEndpoint = (path, desc, props) => {
    schema.paths[path] = {
      post: {
        description: desc,
        operationId: path.replace('/api/', ''),
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: props }
            }
          }
        },
        responses: { "200": { description: "Successful response" } }
      }
    };
  };

  // Add all 32 endpoints to the schema
  addEndpoint('/api/get_motif_profile', "Fetch Taste DNA", {});
  addEndpoint('/api/update_taste_dna', "Modify taste", { category: { type: "string" }, trait: { type: "string" }, score_adjustment: { type: "number" } });
  addEndpoint('/api/set_context', "Set situation", { energy: { type: "string" }, setting: { type: "string" }, time_available_mins: { type: "number" } });
  addEndpoint('/api/add_to_library', "Save item", { title: { type: "string" }, type: { type: "string" }, status: { type: "string" } });
  addEndpoint('/api/remove_from_library', "Remove item", { title: { type: "string" } });
  addEndpoint('/api/log_interaction', "Log consumed item", { title: { type: "string" }, interaction: { type: "string" } });
  addEndpoint('/api/clear_user_data', "Wipe data", {});
  addEndpoint('/api/analyze_taste_shift', "Analyze history", {});
  
  addEndpoint('/api/generate_taste_card', "Viral share card", {});
  addEndpoint('/api/what_should_i_do_tonight', "Cross-category engine", {});
  addEndpoint('/api/surprise_me', "Anti-bubble engine", { risk_level: { type: "string" } });
  addEndpoint('/api/sync_passive_data', "Simulate browser extension sync", { source_name: { type: "string" }, inferred_traits: { type: "string" } });
  addEndpoint('/api/group_night_match', "Merge with friends", { user_ids: { type: "array", items: { type: "string" } } });
  addEndpoint('/api/generate_weekend_plan', "Generate 3-day plan", {});

  addEndpoint('/api/tmdb_search_movie', "Search TMDB Movies", { query: { type: "string" } });
  addEndpoint('/api/tmdb_search_tv', "Search TMDB TV", { query: { type: "string" } });
  addEndpoint('/api/tmdb_get_trending', "Get trending", { media_type: { type: "string" } });
  addEndpoint('/api/tmdb_get_similar', "Get similar", { movie_id: { type: "string" } });
  addEndpoint('/api/tmdb_get_providers', "Where to stream", { movie_id: { type: "string" } });

  addEndpoint('/api/jikan_search_anime', "Search Anime", { query: { type: "string" } });
  addEndpoint('/api/jikan_get_top_anime', "Top Anime", { filter: { type: "string" } });
  addEndpoint('/api/jikan_search_manga', "Search Manga", { query: { type: "string" } });
  addEndpoint('/api/jikan_get_season_now', "Airing now", {});

  addEndpoint('/api/itunes_search_music', "Search Music", { query: { type: "string" } });
  addEndpoint('/api/itunes_search_podcast', "Search Podcasts", { query: { type: "string" } });
  addEndpoint('/api/google_books_search', "Search Books", { query: { type: "string" } });

  addEndpoint('/api/freetogame_get_games', "Search Free Games", { platform: { type: "string" }, category: { type: "string" } });
  addEndpoint('/api/freetogame_sort', "Sort Free Games", { sort_by: { type: "string" } });

  addEndpoint('/api/themealdb_search_recipe', "Search Recipes", { query: { type: "string" } });
  addEndpoint('/api/themealdb_get_random', "Random Recipe", {});

  addEndpoint('/api/manage_custom_list', "Custom Motif Lists", { list_name: { type: "string" }, action: { type: "string" }, item: { type: "string" } });
  addEndpoint('/api/general_entertainment_query', "Catch-all routing", { query: { type: "string" } });

  res.json(schema);
});

// --- BASIC ROUTES ---
app.get('/health', (req, res) => res.json({ status: "Motif REST API running", version: "5.0 (ChatGPT GPT Compatible)", actions_count: 32 }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'authorize.html')));
app.post('/token', (req, res) => {
  const code = req.body.code || req.query.code || req.body.client_id;
  if (!code) return res.status(400).json({ error: "Missing code parameter" });
  res.json({ access_token: code, token_type: "bearer", expires_in: 31536000, refresh_token: code });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Motif REST Server running on port \${PORT}\`));
`;

fs.writeFileSync('server.ts', code);
console.log('Motif REST Architecture Injected for ChatGPT GPT compatibility');
