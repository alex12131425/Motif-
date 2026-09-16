const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const widgetRoute = `
// --- WIDGET ENDPOINTS (Rich UI for Mobile/Web) ---
app.get('/widget/movie/:id', async (req, res) => {
  const movieId = req.params.id;
  try {
    const movieRes = await fetch(\`https://api.themoviedb.org/3/movie/\${movieId}?append_to_response=videos,credits\`, {
      headers: { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` }
    });
    const movie = await movieRes.json();
    
    if (movie.error) return res.send("Movie not found");

    const poster = movie.poster_path ? \`https://image.tmdb.org/t/p/w500\${movie.poster_path}\` : '';
    const backdrop = movie.backdrop_path ? \`https://image.tmdb.org/t/p/original\${movie.backdrop_path}\` : '';
    const trailer = movie.videos && movie.videos.results ? movie.videos.results.find((v) => v.type === 'Trailer') : null;
    
    const html = \`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>\${movie.title} - Motif Widget</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { background-color: #050505; color: white; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        .glass { background: rgba(20, 20, 20, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid rgba(255,255,255,0.1); }
        .hide-scroll::-webkit-scrollbar { display: none; }
      </style>
    </head>
    <body class="relative min-h-screen pb-24">
      <!-- Backdrop -->
      <div class="absolute top-0 left-0 w-full h-[60vh] z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/80 to-[#050505] z-10"></div>
        \${backdrop ? \`<img src="\${backdrop}" class="w-full h-full object-cover opacity-60" />\` : ''}
      </div>

      <!-- Content -->
      <div class="relative z-20 pt-32 px-6">
        <div class="flex space-x-6 items-end mb-6">
          \${poster ? \`<img src="\${poster}" class="w-32 rounded-2xl shadow-2xl border border-white/10" />\` : ''}
          <div class="pb-2">
            <h1 class="text-3xl font-bold leading-tight mb-2">\${movie.title}</h1>
            <div class="flex items-center space-x-3 text-sm text-gray-400">
              <span class="bg-[#39FF14]/20 text-[#39FF14] px-2 py-1 rounded-md font-bold">⭐ \${movie.vote_average.toFixed(1)}</span>
              <span>\${movie.release_date.split('-')[0]}</span>
              <span>\${movie.runtime} min</span>
            </div>
          </div>
        </div>

        <p class="text-gray-300 leading-relaxed mb-8">\${movie.overview}</p>

        <!-- Cast Carousel -->
        \${movie.credits && movie.credits.cast && movie.credits.cast.length > 0 ? \`
        <h3 class="text-lg font-semibold mb-4">Top Cast</h3>
        <div class="flex overflow-x-auto space-x-4 hide-scroll pb-4">
          \${movie.credits.cast.slice(0, 8).map(c => \`
            <div class="flex-none w-24 text-center">
              \${c.profile_path ? \`<img src="https://image.tmdb.org/t/p/w185\${c.profile_path}" class="w-24 h-24 rounded-full object-cover mb-2 border border-white/10">\` : \`<div class="w-24 h-24 rounded-full bg-white/10 mb-2"></div>\`}
              <p class="text-xs font-medium truncate">\${c.name}</p>
              <p class="text-[10px] text-gray-500 truncate">\${c.character}</p>
            </div>
          \`).join('')}
        </div>
        \` : ''}
      </div>

      <!-- Fixed Bottom Action Bar -->
      <div class="fixed bottom-0 left-0 w-full glass p-4 z-50 flex space-x-3">
        \${trailer ? \`
          <a href="https://www.youtube.com/watch?v=\${trailer.key}" target="_blank" class="flex-1 bg-[#39FF14] text-black text-center py-4 rounded-xl font-bold text-sm">
            ▶️ Watch Trailer
          </a>
        \` : ''}
        <button onclick="alert('Saved to Motif DNA!')" class="w-14 bg-white/10 flex items-center justify-center rounded-xl border border-white/10">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
        </button>
      </div>
    </body>
    </html>
    \`;
    res.send(html);
  } catch (e) {
    res.send("Error generating widget");
  }
});
`;

code = code.replace('// --- AUTH ENDPOINTS ---', widgetRoute + '\n// --- AUTH ENDPOINTS ---');

// Update layout engine
const layoutPatch = `
// --- MODERN LAYOUT ENGINE ---
function buildModernCard(media, providers, type) {
  const poster = media.poster_path ? \`https://image.tmdb.org/t/p/w500\${media.poster_path}\` : (media.image_url || '');
  const title = media.title || media.name || 'Unknown Title';
  const year = (media.release_date || media.first_air_date || media.year || '').toString().split('-')[0];
  const rating = media.vote_average ? media.vote_average.toFixed(1) : (media.score || 'N/A');
  const overview = media.overview || media.synopsis || 'No description available.';
  
  const widgetUrl = type === 'movie' ? \`https://motif-23oq.onrender.com/widget/movie/\${media.id}\` : \`https://www.themoviedb.org/\${type}/\${media.id}\`;

  return \`
> # 🎬 **\${title}** (\${year})
> ![\${title} Poster](\${poster})
> 
> **⭐ \${rating}/10**
> 
> *\${overview}*
> 
> ---
> **[📲 TAP HERE TO OPEN INTERACTIVE WIDGET (Trailer, Cast, Streaming)](\${widgetUrl})**
> 
> **🔹 Quick Chat Actions (Tell me to do these!):**
> 💾 "Save to my Motif Library"
> 👍 "I loved this, update my DNA"
> 👎 "Not for me"
\`;
}
`;

code = code.replace(/\/\/ --- MODERN LAYOUT ENGINE ---[\s\S]*?\/\/ --- TOOLS SCHEMA/, layoutPatch + '\n// --- TOOLS SCHEMA');

fs.writeFileSync('server.ts', code);
console.log('Widgets added');
