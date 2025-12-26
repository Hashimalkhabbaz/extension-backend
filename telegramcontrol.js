import axios from "axios";

export function initTelegramControl(app) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN is not set");
  }

  app.post("/telegram/webhook", async (req, res) => {
    try {
      const update = req.body;

      // Ignore non-message updates
      if (!update.message || !update.message.text) {
        return res.sendStatus(200);
      }

      const chatId = update.message.chat.id;
      const text = update.message.text.trim().toLowerCase();

      // Only ONE command for now
      if (text === "what-is-my-chat-id") {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `${chatId}`
        });
      }

      // Telegram MUST receive 200
      res.sendStatus(200);
    } catch (err) {
      console.error("❌ Telegram webhook error:", err.message);
      res.sendStatus(200);
    }
  });

  console.log("✅ Telegram control initialized");
}
