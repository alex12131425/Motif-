import express from 'express';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());

// Parse JSON and urlencoded for everything EXCEPT /messages (which MCP SDK needs as a raw stream)
app.use((req, res, next) => {
  if (req.path === '/messages') {
    return next();
  }
  express.json()(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true })(req, res, next);
  });
});

app.use(express.static(path.join(__dirname, 'public')));

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

// Initialize Firebase for the Server using your keys!
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

async function getProfile(userId: string): Promise<{ profile: any, rowIdx: number | null }> {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return { profile: snap.data().profile, rowIdx: 1 };
    }
  } catch (e: any) {
    console.error("Firestore get error:", e);
    // Continue and return default profile if error (so new users don't break)
  }
  
  const defaultProfile = {
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
  };
  return { profile: defaultProfile, rowIdx: null };
}

async function saveProfile(userId: string, profile: any, rowIdx: number | null) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { profile, lastUpdated: new Date().toISOString() });
  } catch (e: any) {
    console.error("Firestore save error:", e);
    throw new Error("Missing permissions to save data. Please check your Firestore Security Rules.");
  }
}

function daysUntil(dateString: string) {
  if (!dateString) return 0;
  try {
    const target = new Date(dateString.substring(0, 10)).getTime();
    const today = new Date(new Date().toISOString().substring(0, 10)).getTime();
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

function formatCurrency(amount: number) {
  return `$${Number(amount).toFixed(2)}`;
}

const TOOLS_SCHEMA = [
  {
      name: "get_life_profile",
      description: "Retrieve user's full profile",
      inputSchema: {
          type: "object",
          properties: { user_id: { type: "string" } },
          required: ["user_id"]
      }
  },
  {
      name: "add_device",
      description: "Add device or appliance to track",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              device_name: { type: "string" },
              purchase_date: { type: "string" },
              price: { type: "number" },
              warranty_years: { type: "number" },
              has_protection_plan: { type: "boolean" }
          },
          required: ["user_id", "device_name", "purchase_date", "price"]
      }
  },
  {
      name: "add_subscription",
      description: "Add subscription to track",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              name: { type: "string" },
              monthly_cost: { type: "number" },
              category: { type: "string" }
          },
          required: ["user_id", "name", "monthly_cost"]
      }
  },
  {
      name: "add_renewal",
      description: "Add document or license renewal",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              document_name: { type: "string" },
              expires_date: { type: "string" },
              renewal_window_days: { type: "number" }
          },
          required: ["user_id", "document_name", "expires_date"]
      }
  },
  {
      name: "add_maintenance",
      description: "Add recurring maintenance task",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              task_name: { type: "string" },
              frequency_days: { type: "number" },
              last_done_date: { type: "string" }
          },
          required: ["user_id", "task_name", "frequency_days"]
      }
  },
  {
      name: "update_subscription_usage",
      description: "Mark subscription as used today",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              subscription_name: { type: "string" }
          },
          required: ["user_id", "subscription_name"]
      }
  },
  {
      name: "run_life_scan",
      description: "Comprehensive scan for issues",
      inputSchema: {
          type: "object",
          properties: { user_id: { type: "string" } },
          required: ["user_id"]
      }
  },
  {
      name: "get_spending_summary",
      description: "Financial overview",
      inputSchema: {
          type: "object",
          properties: { user_id: { type: "string" } },
          required: ["user_id"]
      }
  },
  {
      name: "before_i_buy",
      description: "Pre-purchase analysis",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              item_name: { type: "string" },
              estimated_price: { type: "number" }
          },
          required: ["user_id", "item_name", "estimated_price"]
      }
  },
  {
      name: "something_broke",
      description: "Handle device failure",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              device_name: { type: "string" }
          },
          required: ["user_id", "device_name"]
      }
  },
  {
      name: "remove_device",
      description: "Remove device from profile",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              device_name: { type: "string" }
          },
          required: ["user_id", "device_name"]
      }
  },
  {
      name: "remove_subscription",
      description: "Remove/cancel subscription",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              subscription_name: { type: "string" }
          },
          required: ["user_id", "subscription_name"]
      }
  },
  {
      name: "update_preferences",
      description: "Update user preferences",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              preferences_dict: { type: "object" }
          },
          required: ["user_id", "preferences_dict"]
      }
  },
  {
      name: "get_upcoming_renewals",
      description: "List renewals in next 90 days",
      inputSchema: {
          type: "object",
          properties: { user_id: { type: "string" } },
          required: ["user_id"]
      }
  },
  {
      name: "bulk_import",
      description: "Import multiple items at once",
      inputSchema: {
          type: "object",
          properties: {
              user_id: { type: "string" },
              items_array: {
                  type: "array",
                  items: { type: "object" }
              }
          },
          required: ["user_id", "items_array"]
      }
  }
];

async function executeTool(name: string, args: any): Promise<any> {
  const userId = args.user_id;
  if (!userId) return { error: "Invalid input", expected: "user_id is required" };

  const { profile, rowIdx } = await getProfile(userId);
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];
  
  
    if (!profile.consumables) profile.consumables = [];
    if (!profile.vehicles) profile.vehicles = [];

    if (name === "add_vehicle") {
        try {
            // Call the free NHTSA Gov API
            const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${args.vin}?format=json`);
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
                assetList.push({ type: "Vehicle", name: `${v.year} ${v.make} ${v.model}`, vin: v.vin });
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


    if (name === "get_life_profile") {
      if (!rowIdx) return { message: "No profile found. Use add_device to start." };
      return profile;
  }
  
  if (name === "add_device") {
      const pDate = new Date(args.purchase_date.substring(0, 10));
      if (isNaN(pDate.getTime())) return { error: "Invalid input", expected: "purchase_date must be iso-date YYYY-MM-DD" };
      
      const warrantyYears = args.warranty_years || 1;
      const wEnd = new Date(pDate);
      wEnd.setFullYear(wEnd.getFullYear() + Number(warrantyYears));
      const wEndIso = wEnd.toISOString().split('T')[0];
      
      const alertDate = new Date(wEnd);
      alertDate.setDate(alertDate.getDate() - 30);
      
      const device = {
          name: args.device_name,
          purchase_date: args.purchase_date.substring(0, 10),
          price: Number(args.price),
          warranty_end: wEndIso,
          protection_plan: args.has_protection_plan || false,
          condition: "Good",
          complaints: []
      };
      profile.devices.push(device);
      await saveProfile(userId, profile, rowIdx);
      return { status: "success", device, alert_date: alertDate.toISOString().split('T')[0] };
  }
  
  if (name === "add_subscription") {
      const nextMonth = new Date(today);
      nextMonth.setDate(nextMonth.getDate() + 30);
      
      const sub = {
          name: args.name,
          monthly_cost: Number(args.monthly_cost),
          last_used: todayIso,
          renewal_date: nextMonth.toISOString().split('T')[0],
          category: args.category || "General"
      };
      profile.subscriptions.push(sub);
      await saveProfile(userId, profile, rowIdx);
      return { status: "success", annual_cost: formatCurrency(sub.monthly_cost * 12) };
  }
  
  if (name === "add_renewal") {
      const ren = {
          document: args.document_name,
          expires: args.expires_date,
          renewal_window: args.renewal_window_days || 60
      };
      profile.renewals.push(ren);
      await saveProfile(userId, profile, rowIdx);
      return { status: "success", renewal: ren };
  }
  
  if (name === "add_maintenance") {
      const task: any = {
          task: args.task_name,
          last_done: args.last_done_date || todayIso,
          frequency_days: Number(args.frequency_days)
      };
      try {
          const ldDate = new Date(task.last_done.substring(0, 10));
          ldDate.setDate(ldDate.getDate() + task.frequency_days);
          task.next_due_date = ldDate.toISOString().split('T')[0];
      } catch (e) {}
      
      profile.maintenance.push(task);
      await saveProfile(userId, profile, rowIdx);
      return { status: "success", maintenance: task };
  }
  
  if (name === "update_subscription_usage") {
      const subName = args.subscription_name.toLowerCase();
      let found = false;
      for (const s of profile.subscriptions) {
          if (s.name.toLowerCase() === subName) {
              s.last_used = todayIso;
              found = true;
          }
      }
      if (found) {
          await saveProfile(userId, profile, rowIdx);
          return { status: "success", message: `${args.subscription_name} usage updated to today` };
      }
      return { error: "Subscription not found" };
  }
  
  if (name === "run_life_scan") {
      const alerts: string[] = [];
      
      for (const d of profile.devices) {
          const dl = daysUntil(d.warranty_end);
          if (dl >= 0 && dl <= 30) alerts.push(`WARRANTY ALERT: ${d.name} warranty ends in ${dl} days (${d.warranty_end})`);
      }
      for (const r of profile.renewals) {
          const dl = daysUntil(r.expires);
          if (dl >= 0 && dl <= (r.renewal_window || 60)) alerts.push(`RENEWAL ALERT: ${r.document} expires in ${dl} days (${r.expires})`);
      }
      for (const s of profile.subscriptions) {
          const unusedDays = -daysUntil(s.last_used);
          if (unusedDays >= 45) alerts.push(`UNUSED SUB ALERT: ${s.name} has not been used in ${unusedDays} days. Cost: ${formatCurrency(s.monthly_cost)}/mo`);
      }
      for (const m of profile.maintenance) {
          if (m.next_due_date && daysUntil(m.next_due_date) < 0) {
              alerts.push(`MAINTENANCE OVERDUE: ${m.task} was due on ${m.next_due_date}`);
          }
      }
      
      const ins = profile.financial.insurance.reduce((sum: number, i: any) => sum + Number(i.monthly_cost || 0), 0);
      const phone = Number(profile.financial.phone_plan?.cost || 0);
      const inet = Number(profile.financial.internet?.cost || 0);
      
      if (ins > 50) alerts.push(`FINANCIAL REVIEW: Insurance costs are high (${formatCurrency(ins)}/mo)`);
      if (phone > 50) alerts.push(`FINANCIAL REVIEW: Phone plan is high (${formatCurrency(phone)}/mo)`);
      if (inet > 50) alerts.push(`FINANCIAL REVIEW: Internet cost is high (${formatCurrency(inet)}/mo)`);
      
      return { alerts: alerts.length ? alerts : ["No active issues found. You're all caught up!"] };
  }
  
  if (name === "get_spending_summary") {
      const subs = profile.subscriptions.reduce((sum: number, s: any) => sum + Number(s.monthly_cost || 0), 0);
      const ins = profile.financial.insurance.reduce((sum: number, i: any) => sum + Number(i.monthly_cost || 0), 0);
      const phone = Number(profile.financial.phone_plan?.cost || 0);
      const inet = Number(profile.financial.internet?.cost || 0);
      
      const total = subs + ins + phone + inet;
      return {
          monthly_total: formatCurrency(total),
          annual_total: formatCurrency(total * 12),
          breakdown: {
              subscriptions: formatCurrency(subs),
              insurance: formatCurrency(ins),
              phone: formatCurrency(phone),
              internet: formatCurrency(inet)
          }
      };
  }
  
  if (name === "before_i_buy") {
      const itemName = args.item_name.toLowerCase();
      const similar = profile.devices.filter((d: any) => d.name.toLowerCase().includes(itemName) || itemName.includes(d.name.toLowerCase()));
      
      let rec = "buy now";
      if (similar.length > 0) rec = "already have similar";
      else if (profile.preferences?.budget_style === "Strict") rec = "wait - strict budget rules apply";
      
      return { recommendation: rec, similar_existing_items: similar, budget_style: profile.preferences?.budget_style };
  }
  
  if (name === "something_broke") {
      const dName = args.device_name.toLowerCase();
      const device = profile.devices.find((d: any) => d.name.toLowerCase() === dName);
      if (!device) return { error: "Device not found" };
      
      const warrantyActive = daysUntil(device.warranty_end) >= 0;
      const ageDays = -daysUntil(device.purchase_date);
      const ageYears = ageDays / 365.0;
      
      let tradeInPct = 0.05;
      if (ageYears < 1) tradeInPct = 0.30;
      else if (ageYears < 2) tradeInPct = 0.20;
      else if (ageYears < 3) tradeInPct = 0.10;
      
      const estValue = device.price * tradeInPct;
      let action = warrantyActive ? "Repair under warranty" : "Replace (out of warranty)";
      if (device.protection_plan && !warrantyActive) action = "Check protection plan terms for replacement/repair";
      
      return {
          device: device.name,
          warranty_active: warrantyActive,
          protection_plan: device.protection_plan,
          recommended_action: action,
          estimated_trade_in_value: formatCurrency(estValue)
      };
  }
  
  if (name === "remove_device") {
      const dName = args.device_name.toLowerCase();
      const origLen = profile.devices.length;
      profile.devices = profile.devices.filter((d: any) => d.name.toLowerCase() !== dName);
      
      if (profile.devices.length < origLen) {
          await saveProfile(userId, profile, rowIdx);
          return { status: "success", message: `Removed ${args.device_name}` };
      }
      return { error: "Device not found" };
  }
  
  if (name === "remove_subscription") {
      const sName = args.subscription_name.toLowerCase();
      let savings = 0;
      const newSubs = [];
      for (const s of profile.subscriptions) {
          if (s.name.toLowerCase() === sName) {
              savings += Number(s.monthly_cost);
          } else {
              newSubs.push(s);
          }
      }
      if (savings > 0) {
          profile.subscriptions = newSubs;
          await saveProfile(userId, profile, rowIdx);
          return { status: "success", monthly_savings: formatCurrency(savings) };
      }
      return { error: "Subscription not found" };
  }
  
  if (name === "update_preferences") {
      profile.preferences = { ...profile.preferences, ...(args.preferences_dict || {}) };
      await saveProfile(userId, profile, rowIdx);
      return { status: "success", preferences: profile.preferences };
  }
  
  if (name === "get_upcoming_renewals") {
      const upcoming = profile.renewals.filter((r: any) => {
          const dl = daysUntil(r.expires);
          return dl >= 0 && dl <= 90;
      });
      upcoming.sort((a: any, b: any) => new Date(a.expires).getTime() - new Date(b.expires).getTime());
      return { upcoming_renewals: upcoming };
  }
  
  if (name === "bulk_import") {
      const items = args.items_array || [];
      const results = [];
      for (const item of items) {
          const t = item.type;
          item.user_id = userId;
          if (t === "device") results.push(await executeTool("add_device", item));
          else if (t === "subscription") results.push(await executeTool("add_subscription", item));
          else if (t === "renewal") results.push(await executeTool("add_renewal", item));
          else if (t === "vehicle") results.push(await executeTool("add_vehicle", item));
          else if (t === "consumable") results.push(await executeTool("add_consumable", item));
      }
      return { status: "completed", imported_count: results.length, results };
  }
  
  return { error: "Tool logic not implemented" };
}

app.get('/health', (req, res) => {
  res.json({
    status: "Life Logistics MCP Server running (Node.js)",
    tools_count: TOOLS_SCHEMA.length,
    version: "1.0",
    endpoints: {
      sse: "/sse",
      messages: "/messages",
      authorize: "/authorize",
      token: "/token"
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'authorize.html'));
});

// OAuth2 Token Endpoint for ChatGPT Custom Action
app.post('/token', (req, res) => {
  // ChatGPT sends: client_id, client_secret, code, grant_type, redirect_uri
  // We simply echo back the code as the access_token (which is the Firebase UID)
  const code = req.body.code || req.query.code;
  
  if (!code) {
    return res.status(400).json({ error: "invalid_request", error_description: "Missing code parameter" });
  }

  res.json({
    access_token: code,
    token_type: "bearer",
    expires_in: 3600 * 24 * 365, // 1 year
    refresh_token: code
  });
});

// Keep track of active SSE sessions
const transports = new Map<string, SSEServerTransport>();

// The SSE endpoint that ChatGPT connects to
app.get('/sse', async (req, res) => {
  // Extract user_id from Authorization Header
  let authUserId = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    authUserId = authHeader.substring(7);
  }

  // Create transport and tell client to POST to /messages
  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);

  res.on('close', () => {
    transports.delete(transport.sessionId);
  });

  const mcpServer = new Server(
    { name: "LifeSkillzs", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS_SCHEMA };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments || {};
    
    // Inject the authenticated user ID if provided
    if (authUserId) {
      args.user_id = authUserId;
    }
    
    try {
      const result = await executeTool(toolName, args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e: any) {
      if (e.message.includes('Database not connected')) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Database not connected", setup: "Add GOOGLE_SHEETS_CREDS to secrets" }) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
    }
  });

  await mcpServer.connect(transport);
});

// The POST endpoint where ChatGPT sends JSON-RPC messages for a session
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// (Legacy /mcp POST endpoint for standard HTTP testing)
app.post('/mcp', async (req, res) => {
  try {
    const data = req.body;
    const method = data.method;
    
    // Extract user_id from Authorization Header
    let authUserId = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      authUserId = authHeader.substring(7);
    }
    
    if (method === "tools/list") {
      res.json({ tools: TOOLS_SCHEMA });
      return;
    }
    
    if (method === "tools/call") {
      const params = data.params || {};
      const toolName = params.name;
      const args = params.arguments || {};
      
      // Inject the authenticated user ID if provided
      if (authUserId) {
        args.user_id = authUserId;
      }
      
      try {
        const result = await executeTool(toolName, args);
        res.json({ content: [{ type: "text", text: JSON.stringify(result) }] });
      } catch (e: any) {
        if (e.message.includes('Database not connected')) {
          res.json({ content: [{ type: "text", text: JSON.stringify({ error: "Database not connected", setup: "Add GOOGLE_SHEETS_CREDS to secrets" }) }] });
        } else {
          res.json({ content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] });
        }
      }
      return;
    }
    
    res.status(400).json({ error: "Method not supported. Supported methods: tools/list, tools/call" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
