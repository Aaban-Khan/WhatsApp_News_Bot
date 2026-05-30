// whatsapp.js — Twilio: format and send WhatsApp messages

const twilio = require("twilio");
require("dotenv").config();

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);
const FROM = process.env.TWILIO_WHATSAPP_FROM;

async function sendMessage(toPhone, body) {
    const to = `whatsapp:+${toPhone}`;
    try {
        const msg = await client.messages.create({ from: FROM, to, body });
        console.log(`[whatsapp] Sent to ${toPhone} — SID: ${msg.sid}`);
        return msg;
    } catch (err) {
        console.error(`[whatsapp] Failed to send to ${toPhone}: ${err.message}`);
        throw err;
    }
}

// ─── Message Templates ────────────────────────────────────────────────────────

function msgWelcomeRegister(name = "") {
    const greeting = name ? `Hello *${name}*! 👋` : "Hello! 👋";
    return (
        `${greeting} You have been registered for the *India News Digest*.\n\n` +
        "Reply *JOIN* to start receiving daily news.\n" +
        "Reply *LEAVE* to opt out."
    );
}

function msgChooseLanguage() {
    return (
        "Welcome! 🙏 What language do you prefer?\n\n" +
        "Reply *1* for English 🇬🇧\n" +
        "Reply *2* for Hindi 🇮🇳"
    );
}

function msgSetupComplete(language) {
    const lang = language === "hindi" ? "Hindi (हिंदी) 🇮🇳" : "English 🇬🇧";
    return (
        `✅ *You are all set!*\n\n` +
        `Language: *${lang}*\n\n` +
        `You will receive the top 5 India news headlines every morning at *8:00 AM IST*.\n\n` +
        `Fetching today's news for you now... 📰`
    );
}

function msgUnsubscribed() {
    return (
        "You have been *unsubscribed* from India News Digest. 📴\n\n" +
        "Reply *JOIN* anytime to rejoin."
    );
}

function msgInvalidReply() {
    return "⚠️ Please reply with a number between *1* and *5* to get a story summary.";
}

function msgDailyDigest(headings) {
    const today = new Date().toLocaleDateString("en-IN", {
        day: "numeric", month: "long", timeZone: "Asia/Kolkata",
    });
    let msg = `🇮🇳 *India News Digest — ${today}*\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━━━\n\n";
    headings.forEach((h, i) => { msg += `${i + 1}. ${h}\n`; });
    msg += "\n━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += "_Reply with a number (1–5) to read the full story._";
    return msg;
}

function msgStorySummary(num, heading, summary) {
    return (
        `📰 *Story ${num} — Full Summary*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${heading}*\n\n` +
        `${summary}`
    );
}

module.exports = {
    sendMessage,
    msgWelcomeRegister,
    msgChooseLanguage,
    msgSetupComplete,
    msgUnsubscribed,
    msgInvalidReply,
    msgDailyDigest,
    msgStorySummary,
};