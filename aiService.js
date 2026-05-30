// aiService.js — Mistral AI: translate, summarise news

const Mistral = require("@mistralai/mistralai").default;
require("dotenv").config();

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const MODEL = "mistral-small-latest";

// ─── Helper ───────────────────────────────────────────────────────────────────

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

// ─── Functions ────────────────────────────────────────────────────────────────

async function getOneLineHeading(article) {
    const system = "You are a news editor for Indian police officers. Write a single short headline (max 12 words) capturing the key fact. No punctuation at the end. Be direct and factual. Always respond in English.";
    const user = `Article title: ${article.title}\nSnippet: ${article.contentSnippet || ""}`;
    try {
        return await callMistral(system, user, 80);
    } catch (err) {
        console.error("[aiService] getOneLineHeading error:", err.message);
        return article.title.slice(0, 80);
    }
}

async function getFullSummary(article) {
    const system = "You are a news summariser for Indian police officers. Write a clear, factual summary in exactly 4-5 sentences. Include: what happened, who is involved, where it occurred, and the current status. Use plain language. Do not add opinions. Always respond in English.";
    const user = `Title: ${article.title}\nContent: ${article.contentSnippet || article.title}\nSource: ${article.source}`;
    try {
        return await callMistral(system, user, 400);
    } catch (err) {
        console.error("[aiService] getFullSummary error:", err.message);
        return article.contentSnippet || article.title;
    }
}

/**
 * Translate any English text to Hindi (Devanagari script).
 */
async function translateToHindi(text) {
    const system = "You are a professional Hindi translator. Translate the following English text to Hindi in Devanagari script. Preserve all numbers, names, and proper nouns as-is. Output ONLY the Hindi translation in Devanagari script. Do not include any English text or explanation.";
    try {
        const result = await callMistral(system, text, 600);
        console.log("[aiService] Hindi translation result:", result.slice(0, 60));
        return result;
    } catch (err) {
        console.error("[aiService] translateToHindi error:", err.message);
        return text;
    }
}

/**
 * Generate heading AND summary both directly in Hindi in one call.
 * More reliable than translating English output.
 */
async function getOneLineHeadingHindi(article) {
    const system = "आप एक भारतीय पुलिस अधिकारियों के लिए समाचार संपादक हैं। नीचे दिए गए समाचार का एक छोटा शीर्षक हिंदी में लिखें (अधिकतम 12 शब्द)। केवल हिंदी में उत्तर दें।";
    const user = `शीर्षक: ${article.title}\nविवरण: ${article.contentSnippet || ""}`;
    try {
        return await callMistral(system, user, 100);
    } catch (err) {
        console.error("[aiService] getOneLineHeadingHindi error:", err.message);
        return await translateToHindi(article.title.slice(0, 80));
    }
}

async function getFullSummaryHindi(article) {
    const system = "आप एक भारतीय पुलिस अधिकारियों के लिए समाचार सारांश लेखक हैं। नीचे दिए गए समाचार का 4-5 वाक्यों में स्पष्ट और तथ्यात्मक सारांश हिंदी में लिखें। क्या हुआ, कौन शामिल है, कहाँ हुआ और वर्तमान स्थिति क्या है — यह जरूर बताएं। केवल हिंदी में उत्तर दें।";
    const user = `शीर्षक: ${article.title}\nसामग्री: ${article.contentSnippet || article.title}`;
    try {
        return await callMistral(system, user, 500);
    } catch (err) {
        console.error("[aiService] getFullSummaryHindi error:", err.message);
        return await translateToHindi(article.contentSnippet || article.title);
    }
}

module.exports = {
    getOneLineHeading,
    getFullSummary,
    translateToHindi,
    getOneLineHeadingHindi,
    getFullSummaryHindi,
};