import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 licenses مع Expiration + Active
const licenses = [
  { code: "BETA-1234", active: true, expiresAt: "2026-01-31T23:59:59Z" },
  { code: "BETA-5678", active: true, expiresAt: "2026-02-28T23:59:59Z" },
  { code: "HASHIM-ACCESS", active: true, expiresAt: "2026-12-31T23:59:59Z" }
];

// 🧪 Activate endpoint
app.post("/activate", (req, res) => {
  const { license } = req.body;
  if (!license) return res.status(400).json({ valid: false, message: "License missing" });

  const lic = licenses.find(l => l.code === license);

  if (!lic) return res.json({ valid: false, message: "Invalid license" });
  if (!lic.active) return res.json({ valid: false, message: "License deactivated" });

  const now = new Date();
  if (new Date(lic.expiresAt) < now) return res.json({ valid: false, message: "License expired" });

  return res.json({ valid: true, message: "Activated successfully" });
});

// 🛑 Deactivate endpoint
app.post("/deactivate", (req, res) => {
  const { license } = req.body;
  const lic = licenses.find(l => l.code === license);

  if (!lic) return res.status(400).json({ message: "License not found" });

  lic.active = false;
  return res.json({ message: "License deactivated" });
});

// 🟢 Health check
app.get("/", (req, res) => {
  res.send("API is running");
});


// 🖥️ صفحة إدارة الأكواد
app.get("/admin", (req, res) => {
  let html = `
    <html>
    <head>
      <title>License Admin</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background: #eee; }
        button { padding: 5px 10px; cursor: pointer; }
      </style>
    </head>
    <body>
      <h1>License Admin Panel</h1>
      <table>
        <tr>
          <th>License</th>
          <th>Active</th>
          <th>Expires At</th>
          <th>Actions</th>
        </tr>
  `;

  licenses.forEach((lic, i) => {
    html += `
      <tr>
        <td>${lic.code}</td>
        <td>${lic.active ? "✅" : "❌"}</td>
        <td>${lic.expiresAt}</td>
        <td>
          <button onclick="deactivate('${lic.code}')">Deactivate</button>
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
          })
          .then(res => res.json())
          .then(data => {
            alert(data.message);
            location.reload();
          })
          .catch(() => alert('Error'));
        }
      </script>
    </body>
    </html>
  `;

  res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
