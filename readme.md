#  WhatsApp News Bot

A WhatsApp bot that sends **top 5 India news headlines** every morning at **8 AM IST** to registered users. Users can reply with a number to get a full AI-generated summary. Supports **English and Hindi**.

---

## 🧩 What It Uses

| Tool | Purpose |
|------|---------|
| Node.js | Runs the server |
| Twilio | Sends/receives WhatsApp messages |
| Mistral AI | Summarises and translates news |
| SQLite | Stores officer data |
| RSS Feeds | Gets news from NDTV, TOI, HT, The Hindu |

---

## 📁 Files

```
wpbot/
├── index.js          → Main server + cron job + webhook
├── newsService.js    → Fetches news from RSS feeds
├── aiService.js      → AI summaries and Hindi translation
├── whatsapp.js       → Sends WhatsApp messages via Twilio
├── db.js             → Database read/write
├── adminPanel.js     → Web UI to manage officers
├── package.json      → Project dependencies
├── .env.example      → Template for API keys
└── README.md
```

---

## ⚙️ Setup (Step by Step)

### Step 1 — Clone the repo

```bash
git clone https://github.com/your-username/wpbot.git
cd wpbot
```

### Step 2 — Install dependencies

```bash
npm install
```

> Requires Node.js v18+. On Linux also run:
> `sudo apt-get install -y build-essential python3`

### Step 3 — Add your API keys

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
MISTRAL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT=3000
```

- **Twilio keys** → [console.twilio.com](https://console.twilio.com) → Dashboard
- **Mistral key** → [console.mistral.ai](https://console.mistral.ai) → API Keys

### Step 4 — Start the server

```bash
npm start
```

### Step 5 — Expose to internet (for Twilio webhook)

```bash
ngrok http 3000
```

Copy the URL it gives (e.g. `https://abc123.ngrok-free.app`) and go to:

**Twilio Console → Messaging → Try it out → Send a WhatsApp message → Sandbox Settings**

Set **"When a message comes in"** to:
```
https://abc123.ngrok-free.app/webhook
```

---

## Admin Panel

Open **http://localhost:3000/admin** in your browser.

- Enter officer name + 10-digit number (country code +91 added automatically)
- Choose language (English or Hindi)
- Click **Register & Send Welcome**

---

## 💬 How It Works (User's Side)

```
1. User receives WhatsApp message from bot
2. They reply: JOIN
3. Bot asks: English or Hindi? (reply 1 or 2)
4. Bot confirms and immediately sends today's top 5 headlines
5. User replies "3" → gets full summary of story 3
6. Every morning 8 AM → new digest is sent automatically
7. Reply LEAVE anytime to unsubscribe
```

> ⚠️ **Twilio Sandbox:** Each user must first send the sandbox join code
> (e.g. `join sandy-kitten`) to the Twilio number before the bot can message them.
> This is only needed for testing — production Twilio accounts don't require it.

---

## 🧪 Test Without Waiting for 8 AM

Click **"Send Digest Now"** in the admin panel, or run:

```bash
curl -X POST http://localhost:3000/admin/trigger-digest
```

---

## 📦 Dependencies

Listed in `package.json`. Install all with `npm install`:

- `express` — web server
- `better-sqlite3` — database
- `node-cron` — 8 AM scheduler
- `twilio` — WhatsApp messaging
- `@mistralai/mistralai` — AI summaries
- `rss-parser` — news feeds
- `dotenv` — environment variables
