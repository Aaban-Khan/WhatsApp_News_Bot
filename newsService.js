// newsService.js — Fetch and filter news from Indian RSS feeds

const Parser = require("rss-parser");
const parser = new Parser({ timeout: 10000 });

// ─── RSS Feed Sources ─────────────────────────────────────────────────────────

const RSS_FEEDS = [
    {
        name: "NDTV India",
        url: "https://feeds.feedburner.com/ndtvnews-india-news",
    },
    {
        name: "Times of India",
        url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    },
    {
        name: "Hindustan Times",
        url: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
    },
    {
        name: "The Hindu",
        url: "https://www.thehindu.com/news/national/feeder/default.rss",
    },
];

// ─── Relevance Keywords ───────────────────────────────────────────────────────
// Filter for topics relevant to police officers: crime, law, courts, disasters

const RELEVANT_KEYWORDS = [
    // Crime
    "arrest", "arrested", "murder", "killed", "crime", "criminal", "theft",
    "robbery", "rape", "assault", "attack", "kidnap", "abduct", "smuggling",
    "drug", "gang", "encounter", "police", "accused", "fir", "custody",
    "detention", "bail", "conviction", "sentence",

    // Court & Law
    "court", "supreme court", "high court", "verdict", "judgment", "justice",
    "cbi", "ed", "enforcement", "law", "legal", "act", "section", "ipc",
    "chargesheet", "acquit", "order", "petition", "hearing",

    // Disaster & Emergency
    "cyclone", "flood", "earthquake", "fire", "explosion", "blast",
    "collapse", "accident", "disaster", "relief", "rescue", "dead", "injured",
    "casualt", "emergency", "alert", "warning", "riot", "unrest", "violence",
    "protest", "clashes",
];

// ─── Helper: check if article is relevant ────────────────────────────────────

function isRelevant(article) {
    const text = `${article.title || ""} ${article.contentSnippet || ""}`.toLowerCase();
    return RELEVANT_KEYWORDS.some((kw) => text.includes(kw));
}

// ─── Fetch Articles ───────────────────────────────────────────────────────────

/**
 * Fetches top 5 relevant articles from all configured RSS feeds.
 * Returns an array of article objects: { title, link, contentSnippet, source }
 */
async function getTopArticles(count = 5) {
    const allArticles = [];

    for (const feed of RSS_FEEDS) {
        try {
            const result = await parser.parseURL(feed.url);
            const articles = (result.items || []).slice(0, 15).map((item) => ({
                title: item.title || "No title",
                link: item.link || "",
                contentSnippet: item.contentSnippet || item.summary || "",
                source: feed.name,
                pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
            }));
            allArticles.push(...articles);
        } catch (err) {
            console.warn(`[newsService] Failed to fetch ${feed.name}: ${err.message}`);
        }
    }

    // Filter for relevant articles only
    const relevant = allArticles.filter(isRelevant);

    // Deduplicate by title similarity (simple: exact title match)
    const seen = new Set();
    const unique = relevant.filter((a) => {
        const key = a.title.trim().toLowerCase().slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Sort by date descending (most recent first)
    unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // Return top N
    return unique.slice(0, count);
}

module.exports = { getTopArticles };