const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// Update layout engine to generate rich markdown lists of multiple items instead of a "tap here" widget link
const layoutPatch = `
// --- MODERN LAYOUT ENGINE ---
function buildModernCard(items, title) {
  if (!items || items.length === 0) return "No results found.";
  
  let layout = \`# 🍿 **\${title}**\\n\\n---\\n\\n\`;
  
  items.slice(0, 5).forEach((media, index) => {
    const poster = media.poster_path ? \`https://image.tmdb.org/t/p/w500\${media.poster_path}\` : '';
    const name = media.title || media.name || 'Unknown Title';
    const year = (media.release_date || media.first_air_date || media.year || '').toString().split('-')[0];
    const rating = media.vote_average ? media.vote_average.toFixed(1) : 'N/A';
    const overview = (media.overview || '').substring(0, 150) + '...';
    
    layout += \`### \${index + 1}. **\${name}** (\${year})\\n\`;
    if (poster) {
      layout += \`![\${name}](\${poster})\\n\\n\`;
    }
    layout += \`**⭐ \${rating}/10** | *\${overview}*\\n\\n---\\n\\n\`;
  });
  
  layout += \`**🔹 Quick Actions (Tell me to do these!):**\\n\`;
  layout += \`💾 "Save [Movie Name] to my library"\\n\`;
  layout += \`👍 "I loved [Movie Name], update my DNA"\\n\`;
  layout += \`🔍 "Show me trailers for these"\\n\`;
  
  return layout;
}
`;

code = code.replace(/\/\/ --- MODERN LAYOUT ENGINE ---[\s\S]*?\/\/ --- TOOLS SCHEMA/, layoutPatch + '\n// --- TOOLS SCHEMA');

const switchReplacement = `
    case "tmdb_search_movie": {
      const data = await apiFetch(\`https://api.themoviedb.org/3/search/movie?query=\${encodeURIComponent(args.query)}\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` });
      const layout = buildModernCard(data.results, \`Search Results for "\${args.query}"\`);
      return { data: data.results.slice(0, 5), presentation_layout: layout, instructions: "CRITICAL: You MUST output the exact string provided in 'presentation_layout' to the user. It is a pre-formatted Markdown UI card. DO NOT wrap it in a code block." };
    }
    case "tmdb_search_tv": {
      const data = await apiFetch(\`https://api.themoviedb.org/3/search/tv?query=\${encodeURIComponent(args.query)}\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` });
      const layout = buildModernCard(data.results, \`Search Results for "\${args.query}"\`);
      return { data: data.results.slice(0, 5), presentation_layout: layout, instructions: "CRITICAL: You MUST output the exact string provided in 'presentation_layout' to the user. DO NOT wrap it in a code block." };
    }
    case "tmdb_get_trending": {
      const data = await apiFetch(\`https://api.themoviedb.org/3/trending/\${args.media_type}/day\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` });
      const layout = buildModernCard(data.results, \`Trending \${args.media_type.toUpperCase()}s Today\`);
      return { data: data.results.slice(0, 5), presentation_layout: layout, instructions: "CRITICAL: You MUST output the exact string provided in 'presentation_layout' to the user. DO NOT wrap it in a code block." };
    }
`;

code = code.replace(/case "tmdb_search_movie":.*?case "tmdb_get_similar":/s, switchReplacement + '\n    case "tmdb_get_similar":');

fs.writeFileSync('server.ts', code);
console.log('Markdown layout patched');
