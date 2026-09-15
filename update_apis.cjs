const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Update Default Profile to include new arrays
const defaultProfileStr = `const defaultProfile = {
    basics: { created: new Date().toISOString().split('T')[0], household_size: 1, budget_style: 'Standard' },
    devices: [],
    subscriptions: [],
    renewals: [],
    maintenance: [],
    consumables: [],
    vehicles: [],
    financial: { insurance: [], phone_plan: { cost: 0.0, provider: '' }, internet: { cost: 0.0, provider: '' } },
    preferences: { brand_loyalties: [], budget_style: 'Standard', dislikes: [] },
    flags: []
  };`;
code = code.replace(/const defaultProfile = {[\s\S]*?flags: \[\]\n  };/, defaultProfileStr);

// 2. Add New Tool Schemas
const newSchemas = `,
  {
      name: "add_vehicle",
      description: "Decode a VIN using the US Gov NHTSA API and add vehicle to tracking.",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              vin: { type: "string", description: "17 character Vehicle Identification Number" },
              mileage: { type: "number", description: "Current mileage" }
          },
          required: ["user_id", "vin"]
      }
  },
  {
      name: "add_consumable",
      description: "Track items that run out (e.g., filters, ink, coffee) to prompt reordering.",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              name: { type: "string" },
              replacement_cycle_days: { type: "number", description: "How many days until it needs replacing" },
              last_replaced: { type: "string", description: "YYYY-MM-DD" },
              cost: { type: "number" }
          },
          required: ["user_id", "name", "replacement_cycle_days"]
      }
  },
  {
      name: "generate_insurance_report",
      description: "Generate a summary of all high-value tracked assets (devices, vehicles) for insurance claims.",
      inputSchema: {
          type: "object",
          properties: { user_id: { type: "string" } },
          required: ["user_id"]
      }
  },
  {
      name: "analyze_subscription_waste",
      description: "Audit subscriptions to find wasted spend based on overlap or high costs.",
      inputSchema: {
          type: "object",
          properties: { user_id: { type: "string" } },
          required: ["user_id"]
      }
  }`;
  
code = code.replace(/}  }\n\];/g, "}  }" + newSchemas + "\n];");

// 3. Add Implementations to executeTool
const newImplementations = `
    if (!profile.consumables) profile.consumables = [];
    if (!profile.vehicles) profile.vehicles = [];

    if (name === "add_vehicle") {
        try {
            // Call the free NHTSA Gov API
            const response = await fetch(\`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/\${args.vin}?format=json\`);
            const data = await response.json();
            
            // Parse out the most important variables
            const getValue = (id) => {
                const item = data.Results.find(r => r.VariableId === id);
                return item && item.Value ? item.Value : "Unknown";
            };
            
            const make = getValue(26); // Make
            const model = getValue(28); // Model
            const year = getValue(29); // Model Year
            const engine = getValue(73); // Engine Number of Cylinders + info
            
            if (make === "Unknown" && year === "Unknown") {
                return { error: "Invalid VIN or data not found in NHTSA database." };
            }
            
            const vehicle = {
                vin: args.vin.toUpperCase(),
                make,
                model,
                year,
                engine,
                mileage: args.mileage || 0,
                added_on: todayIso
            };
            
            profile.vehicles.push(vehicle);
            await saveProfile(userId, profile, rowIdx);
            return { status: "success", vehicle_added: vehicle, source: "US Gov NHTSA API" };
        } catch (e) {
            return { error: "Failed to connect to NHTSA API", details: e.message };
        }
    }

    if (name === "add_consumable") {
        const lr = args.last_replaced ? new Date(args.last_replaced.substring(0, 10)) : today;
        const replaceDate = new Date(lr.getTime() + (args.replacement_cycle_days * 24 * 60 * 60 * 1000));
        
        const consumable = {
            name: args.name,
            replacement_cycle_days: args.replacement_cycle_days,
            last_replaced: lr.toISOString().split('T')[0],
            next_replacement_due: replaceDate.toISOString().split('T')[0],
            cost: args.cost || 0
        };
        
        profile.consumables.push(consumable);
        await saveProfile(userId, profile, rowIdx);
        return { status: "success", consumable_added: consumable };
    }

    if (name === "generate_insurance_report") {
        let totalValue = 0;
        const assetList = [];
        
        if (profile.devices) {
            for (const d of profile.devices) {
                totalValue += (d.price || 0);
                assetList.push({ type: "Device", name: d.name, purchase_date: d.purchase_date, declared_value: d.price });
            }
        }
        
        if (profile.vehicles) {
            for (const v of profile.vehicles) {
                assetList.push({ type: "Vehicle", name: \`\${v.year} \${v.make} \${v.model}\`, vin: v.vin });
            }
        }
        
        return {
            report_generated_on: todayIso,
            total_declared_device_value: totalValue,
            item_count: assetList.length,
            assets: assetList,
            message: "Report prepared. Provide to insurance adjuster if requested."
        };
    }

    if (name === "analyze_subscription_waste") {
        let totalMonthly = 0;
        let yearly = 0;
        const subs = profile.subscriptions || [];
        
        const breakdown = subs.map(s => {
            const m = Number(s.monthly_cost);
            totalMonthly += m;
            return { name: s.name, yearly_cost: (m * 12) };
        });
        yearly = totalMonthly * 12;
        
        let warning = "";
        if (totalMonthly > 100) {
            warning = "High subscription spend detected. Consider canceling unused streaming services to save cash.";
        }
        
        return {
            total_monthly_spend: totalMonthly,
            total_yearly_spend: yearly,
            highest_cost: breakdown.sort((a,b) => b.yearly_cost - a.yearly_cost)[0] || null,
            all_subscriptions: breakdown,
            analysis: warning
        };
    }
`;

code = code.replace(/if \(name === "get_life_profile"\) {/g, newImplementations + "\n\n    if (name === \"get_life_profile\") {");

fs.writeFileSync('server.ts', code);
console.log("APIs and actions injected successfully!");
