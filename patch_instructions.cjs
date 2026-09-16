const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const layoutPatch = `
// --- MODERN LAYOUT ENGINE ---
function buildModernCard(items, title) {
  if (!items || items.length === 0) return "No results found.";
  
  let layout = \`# 🍿 **\${title}**\\n\\n\`;
  
  items.slice(0, 5).forEach((media, index) => {
    const poster = media.poster_path ? \`https://image.tmdb.org/t/p/w500\${media.poster_path}\` : '';
    const name = media.title || media.name || 'Unknown Title';
    const year = (media.release_date || media.first_air_date || media.year || '').toString().split('-')[0];
    const rating = media.vote_average ? media.vote_average.toFixed(1) : 'N/A';
    const overview = (media.overview || '').substring(0, 150) + '...';
    
    layout += \`### \${index + 1}. \${name} (\${year})\\n\`;
    if (poster) {
      layout += \`![\${name} Poster](\${poster})\\n\\n\`;
    }
    layout += \`**⭐ \${rating}/10** | *\${overview}*\\n\\n---\\n\\n\`;
  });
  
  layout += \`**🔹 Quick Actions:**\\n- 💾 "Save to library"\\n- 👍 "Update my DNA"\`;
  
  return layout;
}
`;

code = code.replace(/\/\/ --- MODERN LAYOUT ENGINE ---[\s\S]*?\/\/ --- TOOLS SCHEMA/, layoutPatch + '\n// --- TOOLS SCHEMA');

const switchReplacement = `
    case "tmdb_search_movie": {
      const data = await apiFetch(\`https://api.themoviedb.org/3/search/movie?query=\${encodeURIComponent(args.query)}\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` });
      const layout = buildModernCard(data.results, \`Search Results for "\${args.query}"\`);
      return { _instruction_to_model: "You MUST copy and paste the 'markdown_ui' field below exactly as it is into your response to the user. Do not summarize it. Do not put it in a code block. Render it directly so the user sees the images.", markdown_ui: layout };
    }
    case "tmdb_search_tv": {
      const data = await apiFetch(\`https://api.themoviedb.org/3/search/tv?query=\${encodeURIComponent(args.query)}\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` });
      const layout = buildModernCard(data.results, \`Search Results for "\${args.query}"\`);
      return { _instruction_to_model: "You MUST copy and paste the 'markdown_ui' field below exactly as it is into your response to the user. Do not summarize it. Render it directly.", markdown_ui: layout };
    }
    case "tmdb_get_trending": {
      const data = await apiFetch(\`https://api.themoviedb.org/3/trending/\${args.media_type}/day\`, { Authorization: \`Bearer \${process.env.TMDB_API_KEY}\` });
      const layout = buildModernCard(data.results, \`Trending \${args.media_type.toUpperCase()}s Today\`);
      return { _instruction_to_model: "You MUST copy and paste the 'markdown_ui' field exactly as it is into your response to the user so the images render.", markdown_ui: layout };
    }
`;

code = code.replace(/case "tmdb_search_movie":.*?case "tmdb_get_similar":/s, switchReplacement + '\n    case "tmdb_get_similar":');

fs.writeFileSync('server.ts', code);
console.log('Instructions patched');
