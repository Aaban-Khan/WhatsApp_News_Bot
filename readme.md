# 🚔 WhatsApp News Bot for Indian Police Officers

A WhatsApp bot that sends a daily top-5 India news digest every morning at **8 AM IST** to registered police officers — with AI-powered summaries via Mistral and Hindi translation support.

---

## 📁 File Structure

```
WhatsAppBot/
├── index.js          → Express server, cron job, webhook handler
├── newsService.js    → Fetch & filter news from Indian RSS feeds
├── aiService.js      → Mistral AI: headline, summary, translation
├── whatsapp.js       → Twilio: format and send WhatsApp messages
├── db.js             → SQLite: all database operations
├── adminPanel.js     → Admin web UI to register officer numbers
├── officers.db       → SQLite database (auto-created on first run)
├── .env              → Your API keys (copy from .env.example)
└── README.md
```

---

## ⚙️ Setup

### 1. Install dependencies

```bash
npm install
```

> **Note:** `better-sqlite3` requires a C++ build toolchain.
> On Ubuntu/Debian: `sudo apt-get install -y build-essential python3`
> On macOS: Xcode Command Line Tools (`xcode-select --install`)

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | From Twilio Console |
| `TWILIO_AUTH_TOKEN` | From Twilio Console |
| `TWILIO_WHATSAPP_FROM` | Your Twilio sandbox number, e.g. `whatsapp:+14155238886` |
| `MISTRAL_API_KEY` | From [console.mistral.ai](https://console.mistral.ai) |
| `PORT` | Default: `3000` |

### 3. Configure Twilio Webhook

In your Twilio Console → Messaging → Sandbox Settings, set:

```
When a message comes in: POST https://your-domain.com/webhook
```

Use **ngrok** for local development:
```bash
ngrok http 3000
# Then set: https://xxxx.ngrok.io/webhook
```

### 4. Run

```bash
npm start
```

---

## 🌐 Admin Panel

Open **http://localhost:3000/admin** to:
- Register officer WhatsApp numbers
- View all officers with their status, language, and registration date
- See live stats (total / active / pending)

Enter phone numbers as **digits only with country code**:
- India example: `919876543210` (91 + 10-digit number)

---

## 💬 Officer Flow (WhatsApp)

```
Admin registers officer
        ↓
Bot: "Reply JOIN to start / LEAVE to opt out"
        ↓
Officer replies JOIN
        ↓
Bot: "Reply 1 for English / 2 for Hindi"
        ↓
Officer replies 1 or 2
        ↓
Bot: "You're set! Daily digest at 8 AM IST"
        ↓
Every morning 8 AM IST:
  Bot sends top 5 headlines
        ↓
Officer replies "3"
        ↓
Bot sends full 4-5 sentence AI summary of story 3
  (in officer's preferred language)
```

**At any time**, officer can reply `LEAVE` to unsubscribe.

---

## 📰 News Sources (RSS Feeds)

| Source | Feed |
|---|---|
| NDTV | India news feed |
| Times of India | Top stories |
| Hindustan Times | India news |
| The Hindu | National news |

**Filtered keywords:** crime, arrest, court, verdict, police, disaster, cyclone, flood, explosion, violence, and 40+ more relevant terms.

---

## 🤖 AI Functions (Mistral)

| Function | Output |
|---|---|
| `getOneLineHeading()` | ~10-word headline for digest list |
| `getFullSummary()` | 4–5 sentence story summary |
| `translateToHindi()` | Full Hindi translation of any text |

Model used: `mistral-small-latest` (fast + cost-effective)

---

## 🧪 Manual Digest Trigger (Testing)

```bash
curl -X POST http://localhost:3000/admin/trigger-digest
```

This immediately runs the daily digest for all active officers — useful for testing without waiting for 8 AM.

---

## 🗄️ Database Schema

**Table: officers**
| Column | Type | Notes |
|---|---|---|
| id | INTEGER | Auto-increment PK |
| phone | TEXT | Unique, digits only |
| status | TEXT | `pending` / `active` / `left` |
| language | TEXT | `english` / `hindi` |
| registered_at | DATETIME | Auto timestamp |

**Table: sessions**
| Column | Type | Notes |
|---|---|---|
| phone | TEXT | Primary key |
| step | TEXT | `waiting_join` / `waiting_language` / `active` |
| articles | TEXT | JSON array of last digest articles |

---

## 📦 Dependencies

- **express** — HTTP server
- **better-sqlite3** — SQLite database (sync, fast)
- **node-cron** — Cron scheduler for 8 AM digest
- **twilio** — WhatsApp message sending
- **@mistralai/mistralai** — AI summaries and translation
- **rss-parser** — Parse RSS feeds from news sources
- **dotenv** — Environment variable management