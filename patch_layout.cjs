const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// We will inject a UI Builder function right before // --- TOOLS SCHEMA
const uiBuilderCode = `
// --- MODERN LAYOUT ENGINE ---
function buildModernCard(media, providers, type) {
  const poster = media.poster_path ? \`https://image.tmdb.org/t/p/w500\${media.poster_path}\` : (media.image_url || '');
  const title = media.title || media.name || 'Unknown Title';
  const year = (media.release_date || media.first_air_date || media.year || '').toString().split('-')[0];
  const rating = media.vote_average ? media.vote_average.toFixed(1) : (media.score || 'N/A');
  const overview = media.overview || media.synopsis || 'No description available.';
  
  let watchLinks = [];
  if (providers && providers.results && providers.results.US) {
    const us = providers.results.US;
    if (us.flatrate) watchLinks.push(\`[▶️ Stream on \${us.flatrate[0].provider_name}](\${us.link})\`);
    else if (us.rent) watchLinks.push(\`[🛒 Rent on \${us.rent[0].provider_name}](\${us.link})\`);
    else if (us.buy) watchLinks.push(\`[💳 Buy on \${us.buy[0].provider_name}](\${us.link})\`);
  }
  
  const tmdbLink = type === 'movie' ? \`https://www.themoviedb.org/movie/\${media.id}\` : (type === 'tv' ? \`https://www.themoviedb.org/tv/\${media.id}\` : '');
  if (watchLinks.length === 0 && tmdbLink) {
    watchLinks.push(\`[▶️ Find Where to Watch](\${tmdbLink}/watch)\`);
  }
  const watchText = watchLinks.length > 0 ? watchLinks.join(' | ') : '[▶️ Search Providers](https://www.justwatch.com)';

  return \`
> # 🎬 **\${title}** (\${year})
> ![\${title} Poster](\${poster})
> 
> **⭐ \${rating}/10**
> 
> *\${overview}*
> 
> ---
> \${watchText}
> 
> **🔹 Quick Actions (Tell me to do these!):**
> 💾 "Save to my Motif Library"
> 👍 "I loved this, update my DNA"
> 👎 "Not for me"
> 🔍 "Show me 5 more like this"
\`;
}

// --- TOOLS SCHEMA
`;

code = code.replace('// --- TOOLS SCHEMA', uiBuilderCode);

// Now update the tmdb endpoints in the switch statement
const switchReplacement = `
    case "tmdb_search_movie": {
      const data = await apiFetch(\`https://api.themoviedb.org/3/search/movie?query=\${encodeURIComponent(args.query)}\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` });
      if (data.results && data.results.length > 0) {
        const movie = data.results[0];
        const providers = await apiFetch(\`https://api.themoviedb.org/3/movie/\${movie.id}/watch/providers\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` });
        const layout = buildModernCard(movie, providers, 'movie');
        return { data: data.results.slice(0, 3), presentation_layout: layout, instructions: "CRITICAL: You MUST output the exact string provided in 'presentation_layout' to the user. It is a pre-formatted Markdown UI card. Do not modify the layout string." };
      }
      return data;
    }
    case "tmdb_search_tv": {
      const data = await apiFetch(\`https://api.themoviedb.org/3/search/tv?query=\${encodeURIComponent(args.query)}\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` });
      if (data.results && data.results.length > 0) {
        const tv = data.results[0];
        const providers = await apiFetch(\`https://api.themoviedb.org/3/tv/\${tv.id}/watch/providers\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` });
        const layout = buildModernCard(tv, providers, 'tv');
        return { data: data.results.slice(0, 3), presentation_layout: layout, instructions: "CRITICAL: You MUST output the exact string provided in 'presentation_layout' to the user. It is a pre-formatted Markdown UI card." };
      }
      return data;
    }
    case "tmdb_get_trending": {
      const data = await apiFetch(\`https://api.themoviedb.org/3/trending/\${args.media_type}/day\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` });
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        const providers = await apiFetch(\`https://api.themoviedb.org/3/\${args.media_type}/\${item.id}/watch/providers\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` });
        const layout = buildModernCard(item, providers, args.media_type);
        return { data: data.results.slice(0, 5), presentation_layout: layout, instructions: "CRITICAL: You MUST output the exact string provided in 'presentation_layout' to the user. It is a pre-formatted Markdown UI card." };
      }
      return data;
    }
`;

code = code.replace(/case "tmdb_search_movie":.*?case "tmdb_get_similar":/s, switchReplacement + '\n    case "tmdb_get_similar":');

fs.writeFileSync('server.ts', code);
console.log('Layout patched successfully.');
