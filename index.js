// index.js — Express server, daily digest cron, breaking news monitor, webhook

require("dotenv").config();
const express = require("express");
const cron = require("node-cron");

const db = require("./db");
const { getTopArticles, getBreakingCandidates } = require("./newsService");
const {
    getOneLineHeading, getOneLineHeadingHindi,
    getFullSummary, getFullSummaryHindi,
    translateToHindi, scoreUrgency,
} = require("./aiService");
const {
    sendMessage,
    msgChooseLanguage, msgSetupComplete, msgUnsubscribed,
    msgInvalidReply, msgDailyDigest, msgStorySummary,
    msgBreakingAlert,
} = require("./whatsapp");
const adminRouter = require("./adminPanel");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use("/admin", adminRouter);
app.get("/", (req, res) => res.redirect("/admin"));

// ─── Urgency threshold: score >= this triggers immediate push ─────────────────
const URGENCY_THRESHOLD = 7;

// ─── CRON 1: Daily digest — 8 AM IST (2:30 UTC) ──────────────────────────────

cron.schedule("30 2 * * *", async () => {
    console.log("[cron] Daily digest starting...");
    await sendDailyDigest();
}, { timezone: "UTC" });

// ─── CRON 2: Breaking news monitor — every 10 minutes ────────────────────────

cron.schedule("*/10 * * * *", async () => {
    console.log("[cron] Checking for breaking news...");
    await checkBreakingNews();
}, { timezone: "UTC" });

// ─── CRON 3: Clean old seen articles every 24 hours ──────────────────────────

cron.schedule("0 0 * * *", () => {
    db.cleanOldSeenArticles();
    console.log("[cron] Cleaned old seen articles.");
}, { timezone: "UTC" });

// ─── Daily digest sender ──────────────────────────────────────────────────────

async function sendDailyDigest(targetPhone = null) {
    let articles;
    try { articles = await getTopArticles(5); }
    catch (err) { console.error("[digest] Fetch failed:", err.message); return; }

    if (!articles.length) { console.warn("[digest] No articles found."); return; }

    const officers = targetPhone
        ? [db.getOfficer(targetPhone)].filter(Boolean)
        : db.getActiveOfficers();

    console.log(`[digest] Sending to ${officers.length} officer(s).`);

    for (const officer of officers) {
        try {
            const isHindi = officer.language === "hindi";
            const headings = await Promise.all(
                articles.map((a) => isHindi ? getOneLineHeadingHindi(a) : getOneLineHeading(a))
            );
            let digestMsg = msgDailyDigest(headings);
            if (isHindi) digestMsg = await translateToHindi(digestMsg);

            await sendMessage(officer.phone, digestMsg);
            db.saveArticles(officer.phone, JSON.stringify(articles));
            console.log(`[digest] Sent to ${officer.phone} (${officer.language})`);
        } catch (err) {
            console.error(`[digest] Error for ${officer.phone}: ${err.message}`);
        }
    }
}

// ─── Breaking news checker ────────────────────────────────────────────────────

async function checkBreakingNews() {
    let candidates;
    try { candidates = await getBreakingCandidates(); }
    catch (err) { console.error("[breaking] Fetch failed:", err.message); return; }

    if (!candidates.length) {
        console.log("[breaking] No fresh articles found.");
        return;
    }

    console.log(`[breaking] ${candidates.length} fresh candidate(s) to evaluate.`);

    const officers = db.getActiveOfficers();
    if (!officers.length) return;

    for (const article of candidates) {
        // Skip if already sent
        if (db.isArticleSeen(article.link)) continue;

        // Score urgency with AI
        const { score, reason, alert } = await scoreUrgency(article);
        console.log(`[breaking] Score ${score}/10 — "${article.title.slice(0, 50)}" (${reason})`);

        if (score < URGENCY_THRESHOLD) {
            // Not urgent enough — mark as seen so we don't re-evaluate
            db.markArticleSeen(article.link);
            continue;
        }

        // High urgency — send to all active officers
        console.log(`[breaking] 🚨 Sending alert to ${officers.length} officer(s)!`);
        db.markArticleSeen(article.link);

        for (const officer of officers) {
            // Check daily cooldown
            if (!db.canSendAlert(officer.phone)) {
                console.log(`[breaking] Cooldown reached for ${officer.phone} — skipping.`);
                continue;
            }

            try {
                const isHindi = officer.language === "hindi";
                let headline, summary;

                if (isHindi) {
                    headline = await getOneLineHeadingHindi(article);
                    summary = await getFullSummaryHindi(article);
                } else {
                    headline = await getOneLineHeading(article);
                    summary = await getFullSummary(article);
                }

                let message = msgBreakingAlert(headline, summary, score);
                if (isHindi) message = await translateToHindi(msgBreakingAlert(alert, summary, score));

                await sendMessage(officer.phone, message);
                db.incrementAlertCount(officer.phone);
                console.log(`[breaking] Alert sent to ${officer.phone}`);
            } catch (err) {
                console.error(`[breaking] Error for ${officer.phone}: ${err.message}`);
            }
        }
    }
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

app.post("/webhook", async (req, res) => {
    res.sendStatus(200);

    const phone = (req.body.From || "").replace(/\D/g, "");
    const messageBody = (req.body.Body || "").trim();
    if (!phone) return;

    console.log(`[webhook] From ${phone}: "${messageBody}"`);

    const input = messageBody.toUpperCase().trim();
    const session = db.getSession(phone);
    const step = session ? session.step : null;

    if (input === "LEAVE") {
        db.updateOfficer(phone, { status: "left" });
        db.setStep(phone, "waiting_join");
        await sendMessage(phone, msgUnsubscribed());
        return;
    }

    if (!step || step === "waiting_join") {
        if (input === "JOIN") {
            db.setStep(phone, "waiting_language");
            await sendMessage(phone, msgChooseLanguage());
        }
        return;
    }

    if (step === "waiting_language") {
        if (input === "1" || input === "2") {
            const language = input === "1" ? "english" : "hindi";
            db.updateOfficer(phone, { status: "active", language });
            db.setStep(phone, "active");
            await sendMessage(phone, msgSetupComplete(language));
            await sendDailyDigest(phone);
        } else {
            await sendMessage(phone, "Please reply *1* for English or *2* for Hindi.");
        }
        return;
    }

    if (step === "active") {
        const num = parseInt(input, 10);
        if (!isNaN(num) && num >= 1 && num <= 5) {
            const articles = db.getSavedArticles(phone);
            if (!articles || articles.length < num) {
                await sendMessage(phone, "No digest yet. Your next digest arrives at 8 AM IST! ⏰");
                return;
            }
            const article = articles[num - 1];
            const officer = db.getOfficer(phone);
            const isHindi = officer && officer.language === "hindi";
            try {
                const heading = isHindi ? await getOneLineHeadingHindi(article) : await getOneLineHeading(article);
                const summary = isHindi ? await getFullSummaryHindi(article) : await getFullSummary(article);
                await sendMessage(phone, msgStorySummary(num, heading, summary));
            } catch (err) {
                console.error(`[webhook] Summary error: ${err.message}`);
                await sendMessage(phone, "Sorry, could not fetch summary. Please try again.");
            }
        } else {
            await sendMessage(phone, msgInvalidReply());
        }
    }
});

// ─── Manual triggers ──────────────────────────────────────────────────────────

app.post("/admin/trigger-digest", async (req, res) => {
    res.json({ message: "Digest triggered." });
    await sendDailyDigest();
});

app.post("/admin/trigger-breaking", async (req, res) => {
    res.json({ message: "Breaking news check triggered." });
    await checkBreakingNews();
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║   MP Police WhatsApp News Bot — Running          ║
║   Admin Panel  : http://localhost:${PORT}/admin       ║
║   Webhook      : POST /webhook                   ║
║   Daily digest : 08:00 AM IST                    ║
║   Breaking news: every 10 minutes                ║
╚══════════════════════════════════════════════════╝
  `);
});

module.exports = { sendDailyDigest, checkBreakingNews };