async function run() {
  const res = await fetch('http://127.0.0.1:3000/sse');
  const reader = res.body;
  for await (const chunk of reader) {
    const text = Buffer.from(chunk).toString();
    if (text.includes('endpoint')) {
      const match = text.match(/data: (.*)/);
      if (match) {
        const url = 'http://127.0.0.1:3000' + match[1].trim();
        console.log("Posting to", url);
        const pRes = await fetch(url, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({jsonrpc: "2.0", id: 1, method: "tools/list"})
        });
        console.log(pRes.status);
        console.log(await pRes.text());
        process.exit(0);
      }
    }
  }
}
run();
