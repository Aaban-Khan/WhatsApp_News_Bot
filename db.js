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
`);

// Add name column if it doesn't exist (for existing databases)
try {
    db.exec("ALTER TABLE officers ADD COLUMN name TEXT DEFAULT ''");
    console.log("[db] Added 'name' column to officers table.");
} catch (e) {
    // Column already exists — ignore
}

// ─── Officers ─────────────────────────────────────────────────────────────────

function registerOfficer(phone, language = "english", name = "") {
    const exists = db.prepare("SELECT id FROM officers WHERE phone=?").get(phone);
    if (exists) {
        db.prepare(
            "UPDATE officers SET status='pending', language=?, name=?, registered_at=CURRENT_TIMESTAMP WHERE phone=?"
        ).run(language, name, phone);
    } else {
        db.prepare(
            "INSERT INTO officers (phone, name, status, language) VALUES (?, ?, 'pending', ?)"
        ).run(phone, name, language);
    }
    const sessionExists = db.prepare("SELECT phone FROM sessions WHERE phone=?").get(phone);
    if (sessionExists) {
        db.prepare("UPDATE sessions SET step='waiting_join', articles=NULL WHERE phone=?").run(phone);
    } else {
        db.prepare("INSERT INTO sessions (phone, step, articles) VALUES (?, 'waiting_join', NULL)").run(phone);
    }
}

function getOfficer(phone) {
    return db.prepare("SELECT * FROM officers WHERE phone=?").get(phone);
}

function getAllOfficers() {
    return db.prepare("SELECT * FROM officers ORDER BY registered_at DESC").all();
}

function getActiveOfficers() {
    return db.prepare("SELECT * FROM officers WHERE status='active'").all();
}

function updateOfficer(phone, fields) {
    const setClauses = Object.keys(fields).map((k) => `${k}=?`).join(", ");
    db.prepare(`UPDATE officers SET ${setClauses} WHERE phone=?`).run(...Object.values(fields), phone);
}

function updateOfficerById(id, fields) {
    const setClauses = Object.keys(fields).map((k) => `${k}=?`).join(", ");
    db.prepare(`UPDATE officers SET ${setClauses} WHERE id=?`).run(...Object.values(fields), id);
}

function deleteOfficer(id) {
    const officer = db.prepare("SELECT phone FROM officers WHERE id=?").get(id);
    if (officer) db.prepare("DELETE FROM sessions WHERE phone=?").run(officer.phone);
    db.prepare("DELETE FROM officers WHERE id=?").run(id);
}

function resetOfficerStep(phone) {
    db.prepare("UPDATE officers SET status='pending' WHERE phone=?").run(phone);
    const exists = db.prepare("SELECT phone FROM sessions WHERE phone=?").get(phone);
    if (exists) {
        db.prepare("UPDATE sessions SET step='waiting_join', articles=NULL WHERE phone=?").run(phone);
    } else {
        db.prepare("INSERT INTO sessions (phone, step, articles) VALUES (?, 'waiting_join', NULL)").run(phone);
    }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

function getSession(phone) {
    return db.prepare("SELECT * FROM sessions WHERE phone=?").get(phone);
}

function setStep(phone, step) {
    const exists = db.prepare("SELECT phone FROM sessions WHERE phone=?").get(phone);
    if (exists) {
        db.prepare("UPDATE sessions SET step=? WHERE phone=?").run(step, phone);
    } else {
        db.prepare("INSERT INTO sessions (phone, step, articles) VALUES (?, ?, NULL)").run(phone, step);
    }
}

function saveArticles(phone, articlesJson) {
    db.prepare("UPDATE sessions SET articles=? WHERE phone=?").run(articlesJson, phone);
}

function getSavedArticles(phone) {
    const session = db.prepare("SELECT articles FROM sessions WHERE phone=?").get(phone);
    if (!session || !session.articles) return null;
    try { return JSON.parse(session.articles); } catch { return null; }
}

module.exports = {
    registerOfficer, getOfficer, getAllOfficers, getActiveOfficers,
    updateOfficer, updateOfficerById, deleteOfficer, resetOfficerStep,
    getSession, setStep, saveArticles, getSavedArticles,
};