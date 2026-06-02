// whatsapp.js — Twilio: format and send WhatsApp messages

const twilio = require("twilio");
require("dotenv").config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = process.env.TWILIO_WHATSAPP_FROM;

async function sendMessage(toPhone, body) {
    const to = `whatsapp:+${toPhone}`;
    try {
        const msg = await client.messages.create({ from: FROM, to, body });
        console.log(`[whatsapp] Sent to ${toPhone} — SID: ${msg.sid}`);
        return msg;
    } catch (err) {
        console.error(`[whatsapp] Failed to ${toPhone}: ${err.message}`);
        throw err;
    }
}

// ─── Templates ────────────────────────────────────────────────────────────────

function msgWelcomeRegister(name = "") {
    const greeting = name ? `Hello *${name}*! 👋` : "Hello! 👋";
    return `${greeting} You have been registered for the *MP Police News Digest*.\n\nReply *JOIN* to start receiving news.\nReply *LEAVE* to opt out.`;
}

function msgChooseLanguage() {
    return "Welcome! 🙏 What language do you prefer?\n\nReply *1* for English 🇬🇧\nReply *2* for Hindi 🇮🇳";
}

function msgSetupComplete(language) {
    const lang = language === "hindi" ? "Hindi (हिंदी) 🇮🇳" : "English 🇬🇧";
    return `✅ *You are all set!*\n\nLanguage: *${lang}*\n\nYou will receive:\n• Daily digest at *8:00 AM IST*\n• 🚨 *Instant alerts* for major incidents in Indore, Dhar & MP\n\nFetching today's news now... 📰`;
}

function msgUnsubscribed() {
    return "You have been *unsubscribed* from MP Police News Digest. 📴\n\nReply *JOIN* anytime to rejoin.";
}

function msgInvalidReply() {
    return "⚠️ Please reply with a number between *1* and *5* to get a story summary.";
}

function msgDailyDigest(headings) {
    const today = new Date().toLocaleDateString("en-IN", {
        day: "numeric", month: "long", timeZone: "Asia/Kolkata",
    });
    let msg = `🇮🇳 *MP Police News Digest — ${today}*\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━━━\n\n";
    headings.forEach((h, i) => { msg += `${i + 1}. ${h}\n`; });
    msg += "\n━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += "_Reply with a number (1–5) for the full story._";
    return msg;
}

function msgStorySummary(num, heading, summary) {
    return `📰 *Story ${num} — Full Summary*\n━━━━━━━━━━━━━━━━━━━━━━\n*${heading}*\n\n${summary}`;
}

/** Breaking news alert message */
function msgBreakingAlert(alertHeadline, summary, score) {
    const urgencyTag = score >= 9 ? "🚨 *URGENT ALERT*" : "⚠️ *BREAKING NEWS*";
    return `${urgencyTag}\n━━━━━━━━━━━━━━━━━━━━━━\n*${alertHeadline}*\n\n${summary}\n\n_This is an automated alert from MP Police News Bot._`;
}

module.exports = {
    sendMessage,
    msgWelcomeRegister, msgChooseLanguage, msgSetupComplete,
    msgUnsubscribed, msgInvalidReply, msgDailyDigest,
    msgStorySummary, msgBreakingAlert,
};