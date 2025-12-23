import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 أكواد التفعيل (بيتا)
const VALID_KEYS = [
  "BETA-1234",
  "BETA-5678",
  "HASHIM-ACCESS"
];

// 🧪 Endpoint فحص الكود
app.post("/activate", (req, res) => {
  const { license } = req.body;

  if (!license) {
    return res.status(400).json({ valid: false });
  }

  if (VALID_KEYS.includes(license)) {
    return res.json({
      valid: true,
      message: "Activated successfully"
    });
  }

  return res.json({
    valid: false,
    message: "Invalid license"
  });
});

// 🟢 Health check (مهم ل Render)
app.get("/", (req, res) => {
  res.send("API is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
