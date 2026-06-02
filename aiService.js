// aiService.js — Mistral AI: summarise, translate, score urgency

const Mistral = require("@mistralai/mistralai").default;
require("dotenv").config();

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const MODEL = "mistral-small-latest";

async function callMistral(systemPrompt, userPrompt, maxTokens = 400) {
    const response = await client.chat.complete({
        model: MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens,
    });
    return response.choices[0].message.content.trim();
}

// ─── Digest functions ─────────────────────────────────────────────────────────

async function getOneLineHeading(article) {
    const system = "You are a news editor for Indian police officers. Write a single short headline (max 12 words). No punctuation at end. Be direct and factual. Respond in English only.";
    const user = `Title: ${article.title}\nSnippet: ${article.contentSnippet || ""}`;
    try { return await callMistral(system, user, 80); }
    catch { return article.title.slice(0, 80); }
}

async function getFullSummary(article) {
    const system = "You are a news summariser for Indian police officers. Write a clear factual summary in exactly 4-5 sentences covering: what happened, who is involved, where, and current status. Plain language, no opinions. Respond in English only.";
    const user = `Title: ${article.title}\nContent: ${article.contentSnippet || article.title}`;
    try { return await callMistral(system, user, 400); }
    catch { return article.contentSnippet || article.title; }
}

// ─── Hindi functions ──────────────────────────────────────────────────────────

async function getOneLineHeadingHindi(article) {
    const system = "आप भारतीय पुलिस अधिकारियों के लिए समाचार संपादक हैं। नीचे दिए गए समाचार का एक छोटा शीर्षक हिंदी में लिखें (अधिकतम 12 शब्द)। केवल हिंदी देवनागरी लिपि में उत्तर दें।";
    const user = `शीर्षक: ${article.title}\nविवरण: ${article.contentSnippet || ""}`;
    try { return await callMistral(system, user, 100); }
    catch { return await translateToHindi(article.title.slice(0, 80)); }
}

async function getFullSummaryHindi(article) {
    const system = "आप भारतीय पुलिस अधिकारियों के लिए समाचार सारांश लेखक हैं। 4-5 वाक्यों में स्पष्ट और तथ्यात्मक सारांश हिंदी में लिखें। केवल हिंदी देवनागरी लिपि में उत्तर दें।";
    const user = `शीर्षक: ${article.title}\nसामग्री: ${article.contentSnippet || article.title}`;
    try { return await callMistral(system, user, 500); }
    catch { return await translateToHindi(article.contentSnippet || article.title); }
}

async function translateToHindi(text) {
    const system = "You are a professional Hindi translator. Translate the given English text to Hindi in Devanagari script. Preserve all numbers, names, and proper nouns. Output ONLY the Hindi Devanagari translation, nothing else.";
    try { return await callMistral(system, text, 600); }
    catch { return text; }
}

// ─── Urgency scoring for breaking news ───────────────────────────────────────
//
// Returns a score 1–10:
//   8–10 → push immediately (major incident, disaster, serious crime)
//   5–7  → save for digest
//   1–4  → ignore / routine news
//
// We also get a one-line alert message ready to send.

async function scoreUrgency(article) {
    const system = `You are an urgency classifier for a police news alert system in Madhya Pradesh, India (focused on Indore and Dhar district).

Score the article urgency from 1 to 10:
- 9-10: Mass casualty event, terrorist attack, major riot, serial killer on the loose, major natural disaster (flood/earthquake/storm) with casualties, high-profile murder, large drug bust, major accident with many dead
- 7-8: Single murder, serious assault, kidnapping, significant fire/explosion, road accident with deaths, major court verdict, communal tension
- 5-6: Arrest of criminal, theft, minor accident, court hearing, protest
- 1-4: Political event, inauguration, routine government news, sports, entertainment

Respond ONLY with valid JSON in this exact format (no explanation, no markdown):
{"score": 8, "reason": "one sentence why", "alert": "short 10-word alert headline"}`;

    const user = `Title: ${article.title}\nSource: ${article.source}\nSnippet: ${article.contentSnippet || ""}`;

    try {
        const raw = await callMistral(system, user, 150);
        const clean = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        return {
            score: parseInt(parsed.score) || 1,
            reason: parsed.reason || "",
            alert: parsed.alert || article.title.slice(0, 60),
        };
    } catch (err) {
        console.error("[aiService] scoreUrgency parse error:", err.message);
        return { score: 1, reason: "parse error", alert: article.title.slice(0, 60) };
    }
}

module.exports = {
    getOneLineHeading,
    getFullSummary,
    getOneLineHeadingHindi,
    getFullSummaryHindi,
    translateToHindi,
    scoreUrgency,
};