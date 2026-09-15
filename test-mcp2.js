async function run() {
  const res = await fetch('http://127.0.0.1:3000/sse');
  const reader = res.body;
  let posted = false;
  for await (const chunk of reader) {
    const text = Buffer.from(chunk).toString();
    console.log("SSE <- ", text);
    if (text.includes('endpoint') && !posted) {
      posted = true;
      const match = text.match(/data: (.*)/);
      if (match) {
        const url = 'http://127.0.0.1:3000' + match[1].trim();
        console.log("Posting to", url);
        fetch(url, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({jsonrpc: "2.0", id: 1, method: "tools/list"})
        }).then(pRes => pRes.text()).then(t => console.log("POST returned", t));
      }
    }
    if (text.includes('tools')) {
        process.exit(0);
    }
  }
}
run();
