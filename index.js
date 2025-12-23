import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 licenses
const licenses = [
  {
    code: "BETA-1234",
    active: true,
    expiresAt: "2026-01-31T23:59:59Z",
    usedBy: null
  }
];

// 🧪 Activate
app.post("/activate", (req, res) => {
  const { license, deviceId } = req.body;
  if (!license || !deviceId)
    return res.json({ valid: false, message: "Missing data" });

  const lic = licenses.find(l => l.code === license);
  if (!lic) return res.json({ valid: false, message: "Invalid license" });
  if (!lic.active) return res.json({ valid: false, message: "License deactivated" });

  if (new Date(lic.expiresAt) < new Date())
    return res.json({ valid: false, message: "License expired" });

  if (!lic.usedBy) {
    lic.usedBy = deviceId;
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
});

// ⏰ Check license status and remaining time
app.post("/check-license", (req, res) => {
  const { license } = req.body;
  if (!license) return res.json({ valid: false, message: "Missing license" });

  const lic = licenses.find(l => l.code === license);
  if (!lic) return res.json({ valid: false, message: "Invalid license" });
  if (!lic.active) return res.json({ valid: false, message: "License deactivated" });

  const now = new Date();
  const expiresAt = new Date(lic.expiresAt);
  
  if (expiresAt < now) {
    return res.json({ 
      valid: false, 
      message: "License expired",
      expiresAt: lic.expiresAt,
      remainingMs: 0
    });
  }

  const remainingMs = expiresAt.getTime() - now.getTime();

  return res.json({ 
    valid: true, 
    message: "License is valid",
    expiresAt: lic.expiresAt,
    remainingMs
  });
});

// 🛑 Deactivate
app.post("/deactivate", (req, res) => {
  const { license } = req.body;
  const lic = licenses.find(l => l.code === license);
  if (!lic) return res.json({ message: "License not found" });

  lic.active = false;
  return res.json({ message: "License deactivated" });
});

// ♻️ Reactivate
app.post("/reactivate", (req, res) => {
  const { license } = req.body;
  const lic = licenses.find(l => l.code === license);
  if (!lic) return res.json({ message: "License not found" });

  lic.active = true;
  lic.usedBy = null; // تحريره لجهاز جديد
  return res.json({ message: "License reactivated" });
});

// ➕ Add license
app.post("/add-license", (req, res) => {
  const { code, expiresAt } = req.body;
  if (!code || !expiresAt)
    return res.json({ message: "Missing data" });

  licenses.push({
    code,
    active: true,
    expiresAt,
    usedBy: null
  });

  return res.json({ message: "License added" });
});

// 🖥️ Admin page
app.get("/admin", (req, res) => {
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
      <th>Used By (Device ID)</th>
      <th>Actions</th>
    </tr>
  `;

  licenses.forEach(l => {
    html += `
    <tr>
      <td>${l.code}</td>
      <td>${l.active ? "✅" : "❌"}</td>
      <td>${l.expiresAt}</td>
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

// 🟢 Health
app.get("/", (req, res) => res.send("API is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));