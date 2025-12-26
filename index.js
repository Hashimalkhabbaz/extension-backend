import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { License } from "./models/License.js";
import axios from "axios"; // Add axios for Telegram API calls
import { initTelegramControl } from "./telegramcontrol.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
initTelegramControl(app);

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7938237788:AAEHtbVY9GOw5-2UMH_Rk6K6rhKmgv9QBAo';
const MAX_MESSAGES = 4;

/* ===========================
   MongoDB Connection
=========================== */
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB error:", err);
    process.exit(1);
  }
}

connectDB();

/* ===========================
   Telegram Helper Functions
=========================== */
async function sendTelegramMessage(chatId, message) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    };

    const response = await axios.post(url, payload);
    console.log(`✅ Telegram message sent to ${chatId}:`, response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ Error sending Telegram message:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

/* ===========================
   NEW: Save Telegram ID
=========================== */
app.post("/save-telegram-id", async (req, res) => {
  try {
    const { license, deviceId, telegramChatId, telegramUsername } = req.body;
    
    if (!license || !deviceId || !telegramChatId) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: license, deviceId, telegramChatId" 
      });
    }

    // Find the license
    const lic = await License.findOne({ code: license });
    if (!lic) {
      return res.status(404).json({ 
        success: false, 
        message: "License not found" 
      });
    }

    // Check if license is activated on this device
    if (lic.usedBy !== deviceId) {
      return res.status(403).json({ 
        success: false, 
        message: "License is not activated on this device" 
      });
    }

    // Save Telegram ID and username
    lic.telegramChatId = telegramChatId;
    if (telegramUsername) {
      lic.telegramUsername = telegramUsername;
    }
    
    await lic.save();

    // Send a test message to confirm it works
    const testMessage = `✅ Your Telegram ID has been successfully saved!\n\n` +
                       `License: ${license}\n` +
                       `Telegram Chat ID: ${telegramChatId}\n` +
                       `Username: ${telegramUsername || 'Not provided'}\n\n` +
                       `You will now receive notifications from the Travian Multi-Tool.`;
    
    const telegramResult = await sendTelegramMessage(telegramChatId, testMessage);

    res.json({
      success: true,
      message: "Telegram ID saved successfully",
      telegramTest: telegramResult.success ? "Test message sent" : "Test message failed",
      data: {
        license: lic.code,
        telegramChatId: lic.telegramChatId,
        telegramUsername: lic.telegramUsername
      }
    });

  } catch (err) {
    console.error("❌ Error saving Telegram ID:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: err.message 
    });
  }
});

/* ===========================
   NEW: Get Telegram ID
=========================== */
app.get("/get-telegram-id/:license/:deviceId", async (req, res) => {
  try {
    const { license, deviceId } = req.params;

    const lic = await License.findOne({ code: license });
    if (!lic) {
      return res.status(404).json({ 
        success: false, 
        message: "License not found" 
      });
    }

    // Check if license is activated on this device
    if (lic.usedBy !== deviceId) {
      return res.status(403).json({ 
        success: false, 
        message: "License is not activated on this device" 
      });
    }

    res.json({
      success: true,
      hasTelegramId: !!lic.telegramChatId,
      telegramChatId: lic.telegramChatId,
      telegramUsername: lic.telegramUsername
    });

  } catch (err) {
    console.error("❌ Error getting Telegram ID:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

/* ===========================
   NEW: Send Telegram Message (Secure)
=========================== */
app.post("/send-telegram", async (req, res) => {
  try {
    const { license, deviceId, message } = req.body;
    
    if (!license || !deviceId || !message) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

    // Find the license
    const lic = await License.findOne({ code: license });
    if (!lic) {
      return res.status(404).json({ 
        success: false, 
        message: "License not found" 
      });
    }

    // Check if license is activated on this device
    if (lic.usedBy !== deviceId) {
      return res.status(403).json({ 
        success: false, 
        message: "License is not activated on this device" 
      });
    }

    // Check if Telegram ID is set
    if (!lic.telegramChatId) {
      return res.status(400).json({ 
        success: false, 
        message: "Telegram Chat ID not set for this license. Please set it first." 
      });
    }

    // Send the message
    const telegramResult = await sendTelegramMessage(lic.telegramChatId, message);

    res.json({
      success: telegramResult.success,
      message: telegramResult.success ? "Message sent successfully" : "Failed to send message",
      telegramResponse: telegramResult
    });

  } catch (err) {
    console.error("❌ Error sending Telegram message:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

/* ===========================
   NEW: Update Activation Endpoint to Include Telegram Info
=========================== */
app.post("/activate", async (req, res) => {
  try {
    const { license, deviceId, telegramChatId, telegramUsername } = req.body;
    if (!license || !deviceId)
      return res.json({ valid: false, message: "Missing data" });

    const lic = await License.findOne({ code: license });
    if (!lic) return res.json({ valid: false, message: "Invalid license" });
    if (!lic.active)
      return res.json({ valid: false, message: "License deactivated" });

    if (lic.expiresAt < new Date())
      return res.json({ valid: false, message: "License expired" });

    if (!lic.usedBy) {
      lic.usedBy = deviceId;
      
      // Save Telegram info if provided during activation
      if (telegramChatId) {
        lic.telegramChatId = telegramChatId;
      }
      if (telegramUsername) {
        lic.telegramUsername = telegramUsername;
      }
      
      await lic.save();
      
      return res.json({
        valid: true,
        message: "Activated successfully",
        expiresAt: lic.expiresAt,
        hasTelegramId: !!lic.telegramChatId
      });
    }

    if (lic.usedBy === deviceId) {
      return res.json({
        valid: true,
        message: "Already activated on this device",
        expiresAt: lic.expiresAt,
        hasTelegramId: !!lic.telegramChatId
      });
    }

    return res.json({
      valid: false,
      message: "This license is already used on another device"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   Check License (Updated to return Telegram info)
=========================== */
app.post("/check-license", async (req, res) => {
  try {
    const { license } = req.body;
    if (!license)
      return res.json({ valid: false, message: "Missing license" });

    const lic = await License.findOne({ code: license });
    if (!lic) return res.json({ valid: false, message: "Invalid license" });
    if (!lic.active)
      return res.json({ valid: false, message: "License deactivated" });

    const now = new Date();

    if (lic.expiresAt < now) {
      return res.json({
        valid: false,
        message: "License expired",
        expiresAt: lic.expiresAt,
        remainingMs: 0
      });
    }

    return res.json({
      valid: true,
      message: "License is valid",
      expiresAt: lic.expiresAt,
      remainingMs: lic.expiresAt - now,
      hasTelegramId: !!lic.telegramChatId,
      telegramChatId: lic.telegramChatId,
      telegramUsername: lic.telegramUsername
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   Update Admin Panel to Show Telegram Info
=========================== */
app.get("/admin", async (req, res) => {
  const licenses = await License.find().lean();

  let html = `
  <html>
  <head>
    <title>License Admin</title>
    <style>
      body { font-family: Arial; padding: 20px; }
      table { border-collapse: collapse; width: 100%; margin-top: 20px; }
      th, td { border: 1px solid #ccc; padding: 8px; }
      th { background: #eee; }
      button { margin-right: 5px; }
      input { margin-right: 5px; }
      .telegram { color: #0088cc; }
    </style>
  </head>
  <body>

  <h1>License Admin Panel</h1>

  <h3>Add License</h3>
  <input id="code" placeholder="LICENSE-CODE" />
  <input id="exp" type="date" />
  <button onclick="add()">Add</button>

  <table>
    <tr>
      <th>License</th>
      <th>Active</th>
      <th>Expires</th>
      <th>Used By</th>
      <th class="telegram">Telegram</th>
      <th>Actions</th>
    </tr>
  `;

  licenses.forEach(l => {
    const telegramInfo = l.telegramChatId ? 
      `${l.telegramChatId}<br><small>${l.telegramUsername || 'No username'}</small>` : 
      '❌ Not set';
    
    html += `
      <tr>
        <td>${l.code}</td>
        <td>${l.active ? "✅" : "❌"}</td>
        <td>${new Date(l.expiresAt).toLocaleDateString()}</td>
        <td>${l.usedBy || "-"}</td>
        <td class="telegram">${telegramInfo}</td>
        <td>
          <button onclick="deactivate('${l.code}')">Deactivate</button>
          <button onclick="reactivate('${l.code}')">Reactivate</button>
        </td>
      </tr>
    `;
  });

  html += `
  </table>

  <script>
    function deactivate(code) {
      fetch('/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license: code })
      }).then(() => location.reload());
    }

    function reactivate(code) {
      fetch('/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license: code })
      }).then(() => location.reload());
    }

    function add() {
      fetch('/add-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: document.getElementById('code').value,
          expiresAt: document.getElementById('exp').value + "T23:59:59Z"
        })
      }).then(() => location.reload());
    }
  </script>

  </body>
  </html>
  `;

  res.send(html);
});

/* ===========================
   Remaining Endpoints (unchanged)
=========================== */
app.post("/deactivate", async (req, res) => {
  const { license } = req.body;
  await License.updateOne({ code: license }, { active: false });
  res.json({ message: "License deactivated" });
});

app.post("/reactivate", async (req, res) => {
  const { license } = req.body;
  await License.updateOne(
    { code: license },
    { active: true, usedBy: null }
  );
  res.json({ message: "License reactivated" });
});

app.post("/add-license", async (req, res) => {
  const { code, expiresAt } = req.body;
  if (!code || !expiresAt)
    return res.json({ message: "Missing data" });

  await License.create({
    code,
    expiresAt: new Date(expiresAt)
  });

  res.json({ message: "License added" });
});

app.get("/", (req, res) => res.send("API is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);