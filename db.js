// db.js — SQLite database operations

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "officers.db");
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS officers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    phone         TEXT UNIQUE,
    name          TEXT DEFAULT '',
    status        TEXT DEFAULT 'pending',
    language      TEXT DEFAULT 'english',
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    phone    TEXT PRIMARY KEY,
    step     TEXT,
    articles TEXT
  );

  -- Tracks every article URL we have already pushed as a breaking alert
  -- so we never send the same story twice
  CREATE TABLE IF NOT EXISTS seen_articles (
    url        TEXT PRIMARY KEY,
    seen_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tracks how many breaking alerts each officer received today
  -- resets automatically by date check in code
  CREATE TABLE IF NOT EXISTS alert_counts (
    phone TEXT PRIMARY KEY,
    date  TEXT,
    count INTEGER DEFAULT 0
  );
`);

// Migrate: add name column to existing DBs
try { db.exec("ALTER TABLE officers ADD COLUMN name TEXT DEFAULT ''"); }
catch { }

// ─── Officers ─────────────────────────────────────────────────────────────────

function registerOfficer(phone, language = "english", name = "") {
    const exists = db.prepare("SELECT id FROM officers WHERE phone=?").get(phone);
    if (exists) {
        db.prepare("UPDATE officers SET status='pending',language=?,name=?,registered_at=CURRENT_TIMESTAMP WHERE phone=?")
            .run(language, name, phone);
    } else {
        db.prepare("INSERT INTO officers (phone,name,status,language) VALUES (?,?,'pending',?)")
            .run(phone, name, language);
    }
    const s = db.prepare("SELECT phone FROM sessions WHERE phone=?").get(phone);
    if (s) {
        db.prepare("UPDATE sessions SET step='waiting_join',articles=NULL WHERE phone=?").run(phone);
    } else {
        db.prepare("INSERT INTO sessions (phone,step,articles) VALUES (?,'waiting_join',NULL)").run(phone);
    }
}

function getOfficer(phone) { return db.prepare("SELECT * FROM officers WHERE phone=?").get(phone); }
function getAllOfficers() { return db.prepare("SELECT * FROM officers ORDER BY registered_at DESC").all(); }
function getActiveOfficers() { return db.prepare("SELECT * FROM officers WHERE status='active'").all(); }

function updateOfficer(phone, fields) {
    const set = Object.keys(fields).map(k => `${k}=?`).join(", ");
    db.prepare(`UPDATE officers SET ${set} WHERE phone=?`).run(...Object.values(fields), phone);
}

function updateOfficerById(id, fields) {
    const set = Object.keys(fields).map(k => `${k}=?`).join(", ");
    db.prepare(`UPDATE officers SET ${set} WHERE id=?`).run(...Object.values(fields), id);
}

function deleteOfficer(id) {
    const o = db.prepare("SELECT phone FROM officers WHERE id=?").get(id);
    if (o) db.prepare("DELETE FROM sessions WHERE phone=?").run(o.phone);
    db.prepare("DELETE FROM officers WHERE id=?").run(id);
}

function resetOfficerStep(phone) {
    db.prepare("UPDATE officers SET status='pending' WHERE phone=?").run(phone);
    const s = db.prepare("SELECT phone FROM sessions WHERE phone=?").get(phone);
    if (s) {
        db.prepare("UPDATE sessions SET step='waiting_join',articles=NULL WHERE phone=?").run(phone);
    } else {
        db.prepare("INSERT INTO sessions (phone,step,articles) VALUES (?,'waiting_join',NULL)").run(phone);
    }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

function getSession(phone) { return db.prepare("SELECT * FROM sessions WHERE phone=?").get(phone); }

function setStep(phone, step) {
    const s = db.prepare("SELECT phone FROM sessions WHERE phone=?").get(phone);
    if (s) db.prepare("UPDATE sessions SET step=? WHERE phone=?").run(step, phone);
    else db.prepare("INSERT INTO sessions (phone,step,articles) VALUES (?,?,NULL)").run(phone, step);
}

function saveArticles(phone, articlesJson) {
    db.prepare("UPDATE sessions SET articles=? WHERE phone=?").run(articlesJson, phone);
}

function getSavedArticles(phone) {
    const s = db.prepare("SELECT articles FROM sessions WHERE phone=?").get(phone);
    if (!s || !s.articles) return null;
    try { return JSON.parse(s.articles); } catch { return null; }
}

// ─── Seen articles (breaking news dedup) ─────────────────────────────────────

/** Returns true if we have already sent an alert for this URL */
function isArticleSeen(url) {
    return !!db.prepare("SELECT url FROM seen_articles WHERE url=?").get(url);
}

/** Mark article URL as seen */
function markArticleSeen(url) {
    db.prepare("INSERT OR IGNORE INTO seen_articles (url) VALUES (?)").run(url);
}

/** Clean up seen articles older than 48 hours */
function cleanOldSeenArticles() {
    db.prepare("DELETE FROM seen_articles WHERE seen_at < datetime('now', '-48 hours')").run();
}

// ─── Alert cooldown (max 3 breaking alerts per officer per day) ───────────────

const MAX_ALERTS_PER_DAY = 3;

function getTodayString() {
    return new Date().toISOString().slice(0, 10); // "2026-05-31"
}

/** Returns true if officer can still receive a breaking alert today */
function canSendAlert(phone) {
    const today = getTodayString();
    const row = db.prepare("SELECT date, count FROM alert_counts WHERE phone=?").get(phone);
    if (!row || row.date !== today) return true;
    return row.count < MAX_ALERTS_PER_DAY;
}

/** Increment the alert count for an officer today */
function incrementAlertCount(phone) {
    const today = getTodayString();
    const row = db.prepare("SELECT date, count FROM alert_counts WHERE phone=?").get(phone);
    if (!row || row.date !== today) {
        db.prepare("INSERT OR REPLACE INTO alert_counts (phone,date,count) VALUES (?,?,1)").run(phone, today);
    } else {
        db.prepare("UPDATE alert_counts SET count=count+1 WHERE phone=?").run(phone);
    }
}

module.exports = {
    registerOfficer, getOfficer, getAllOfficers, getActiveOfficers,
    updateOfficer, updateOfficerById, deleteOfficer, resetOfficerStep,
    getSession, setStep, saveArticles, getSavedArticles,
    isArticleSeen, markArticleSeen, cleanOldSeenArticles,
    canSendAlert, incrementAlertCount,
};