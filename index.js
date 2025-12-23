import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { License } from "./models/License.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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
   Activate License
=========================== */
app.post("/activate", async (req, res) => {
  try {
    const { license, deviceId } = req.body;
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
      await lic.save();
      return res.json({
        valid: true,
        message: "Activated successfully",
        expiresAt: lic.expiresAt
      });
    }

    if (lic.usedBy === deviceId) {
      return res.json({
        valid: true,
        message: "Already activated on this device",
        expiresAt: lic.expiresAt
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
   Check License
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
      remainingMs: lic.expiresAt - now
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   Deactivate
=========================== */
app.post("/deactivate", async (req, res) => {
  const { license } = req.body;
  await License.updateOne({ code: license }, { active: false });
  res.json({ message: "License deactivated" });
});

/* ===========================
   Reactivate
=========================== */
app.post("/reactivate", async (req, res) => {
  const { license } = req.body;
  await License.updateOne(
    { code: license },
    { active: true, usedBy: null }
  );
  res.json({ message: "License reactivated" });
});

/* ===========================
   Add License
=========================== */
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

/* ===========================
   Admin Panel
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
      <th>Actions</th>
    </tr>
  `;

  licenses.forEach(l => {
    html += `
      <tr>
        <td>${l.code}</td>
        <td>${l.active ? "✅" : "❌"}</td>
        <td>${new Date(l.expiresAt).toISOString()}</td>
        <td>${l.usedBy || "-"}</td>
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
   Health Check
=========================== */
app.get("/", (req, res) => res.send("API is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
