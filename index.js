// index.js — Express server, cron job, webhook handler

require("dotenv").config();
const express = require("express");
const cron = require("node-cron");

const db = require("./db");
const { getTopArticles } = require("./newsService");
const {
    getOneLineHeading,
    getOneLineHeadingHindi,
    getFullSummary,
    getFullSummaryHindi,
    translateToHindi,
} = require("./aiService");
const {
    sendMessage,
    msgChooseLanguage,
    msgSetupComplete,
    msgUnsubscribed,
    msgInvalidReply,
    msgDailyDigest,
    msgStorySummary,
} = require("./whatsapp");
const adminRouter = require("./adminPanel");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use("/admin", adminRouter);
app.get("/", (req, res) => res.redirect("/admin"));

// ─── Daily Digest Cron (8 AM IST = 2:30 UTC) ─────────────────────────────────

cron.schedule("30 2 * * *", async () => {
    console.log("[cron] Starting daily digest...");
    await sendDailyDigest();
}, { timezone: "UTC" });

// ─── Core digest sender ───────────────────────────────────────────────────────

async function sendDailyDigest(targetPhone = null) {
    let articles;
    try {
        articles = await getTopArticles(5);
    } catch (err) {
        console.error("[digest] Failed to fetch articles:", err.message);
        return;
    }

    if (articles.length === 0) {
        console.warn("[digest] No relevant articles found.");
        return;
    }

    const officers = targetPhone
        ? [db.getOfficer(targetPhone)].filter(Boolean)
        : db.getActiveOfficers();

    console.log(`[digest] Sending to ${officers.length} officer(s).`);

    for (const officer of officers) {
        try {
            const isHindi = officer.language === "hindi";

            // Generate headings in the right language directly
            const headings = await Promise.all(
                articles.map((a) =>
                    isHindi ? getOneLineHeadingHindi(a) : getOneLineHeading(a)
                )
            );

            let digestMsg = msgDailyDigest(headings);

            // Translate the date/template parts to Hindi too
            if (isHindi) {
                digestMsg = await translateToHindi(digestMsg);
            }

            await sendMessage(officer.phone, digestMsg);
            db.saveArticles(officer.phone, JSON.stringify(articles));
            console.log(`[digest] Sent to ${officer.phone} (${officer.language})`);
        } catch (err) {
            console.error(`[digest] Error for ${officer.phone}: ${err.message}`);
        }
    }
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

app.post("/webhook", async (req, res) => {
    res.sendStatus(200);

    const rawFrom = req.body.From || "";
    const messageBody = (req.body.Body || "").trim();
    const phone = rawFrom.replace(/\D/g, "");

    if (!phone) return;
    console.log(`[webhook] From ${phone}: "${messageBody}"`);

    const input = messageBody.toUpperCase().trim();
    const session = db.getSession(phone);
    const step = session ? session.step : null;

    // ── LEAVE ─────────────────────────────────────────────────────────────────
    if (input === "LEAVE") {
        db.updateOfficer(phone, { status: "left" });
        db.setStep(phone, "waiting_join");
        await sendMessage(phone, msgUnsubscribed());
        return;
    }

    // ── waiting_join ──────────────────────────────────────────────────────────
    if (!step || step === "waiting_join") {
        if (input === "JOIN") {
            db.setStep(phone, "waiting_language");
            await sendMessage(phone, msgChooseLanguage());
        }
        return;
    }

    // ── waiting_language ──────────────────────────────────────────────────────
    if (step === "waiting_language") {
        if (input === "1" || input === "2") {
            const language = input === "1" ? "english" : "hindi";
            db.updateOfficer(phone, { status: "active", language });
            db.setStep(phone, "active");
            await sendMessage(phone, msgSetupComplete(language));

            // Send immediate digest in chosen language
            console.log(`[webhook] Sending immediate digest to ${phone} in ${language}`);
            await sendDailyDigest(phone);
        } else {
            await sendMessage(phone, "Please reply *1* for English or *2* for Hindi.");
        }
        return;
    }

    // ── active — 1-5 for summaries ────────────────────────────────────────────
    if (step === "active") {
        const num = parseInt(input, 10);

        if (!isNaN(num) && num >= 1 && num <= 5) {
            const articles = db.getSavedArticles(phone);

            if (!articles || articles.length < num) {
                await sendMessage(phone, "No digest found yet. Your next digest arrives at 8 AM IST! ⏰");
                return;
            }

            const article = articles[num - 1];
            const officer = db.getOfficer(phone);
            const isHindi = officer && officer.language === "hindi";

            try {
                const heading = isHindi
                    ? await getOneLineHeadingHindi(article)
                    : await getOneLineHeading(article);

                const summary = isHindi
                    ? await getFullSummaryHindi(article)
                    : await getFullSummary(article);

                await sendMessage(phone, msgStorySummary(num, heading, summary));
            } catch (err) {
                console.error(`[webhook] Summary error for ${phone}: ${err.message}`);
                await sendMessage(phone, "Sorry, could not fetch the summary. Please try again.");
            }
        } else {
            await sendMessage(phone, msgInvalidReply());
        }
        return;
    }
});

// ─── Manual trigger ───────────────────────────────────────────────────────────

app.post("/admin/trigger-digest", async (req, res) => {
    res.json({ message: "Digest triggered. Check logs." });
    await sendDailyDigest();
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   WhatsApp News Bot — Running                ║
║   Admin Panel : http://localhost:${PORT}/admin    ║
║   Webhook     : POST /webhook                ║
║   Daily cron  : 08:00 AM IST                 ║
╚══════════════════════════════════════════════╝
  `);
});

module.exports = { sendDailyDigest };