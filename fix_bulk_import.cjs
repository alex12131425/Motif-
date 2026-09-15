const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Update bulk_import to handle vehicles and consumables
code = code.replace(/else if \(t === "renewal"\) results.push\(await executeTool\("add_renewal", item\)\);/g, 
`else if (t === "renewal") results.push(await executeTool("add_renewal", item));
          else if (t === "vehicle") results.push(await executeTool("add_vehicle", item));
          else if (t === "consumable") results.push(await executeTool("add_consumable", item));`);

fs.writeFileSync('server.ts', code);
console.log("Fixed bulk_import");
