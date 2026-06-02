// newsService.js — RSS feeds + Google News + breaking news detection

const Parser = require("rss-parser");
const parser = new Parser({ timeout: 10000 });

// ─── Daily Digest Feeds (national) ───────────────────────────────────────────

const DIGEST_FEEDS = [
    { name: "NDTV India", url: "https://feeds.feedburner.com/ndtvnews-india-news" },
    { name: "Times of India", url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms" },
    { name: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml" },
    { name: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss" },
];

// ─── Google News RSS — MP / Dhar / Indore focused ────────────────────────────
// Google News RSS: https://news.google.com/rss/search?q=KEYWORD&hl=en-IN&gl=IN&ceid=IN:en
// Completely free, updates within minutes of a story breaking.

const BREAKING_FEEDS = [
    // Location specific
    {
        name: "Indore News",
        url: "https://news.google.com/rss/search?q=Indore&hl=en-IN&gl=IN&ceid=IN:en",
    },
    {
        name: "Dhar News",
        url: "https://news.google.com/rss/search?q=Dhar+Madhya+Pradesh&hl=en-IN&gl=IN&ceid=IN:en",
    },
    {
        name: "Madhya Pradesh News",
        url: "https://news.google.com/rss/search?q=Madhya+Pradesh&hl=en-IN&gl=IN&ceid=IN:en",
    },
    // Crime & law enforcement in MP
    {
        name: "MP Crime",
        url: "https://news.google.com/rss/search?q=Madhya+Pradesh+crime+arrest+police&hl=en-IN&gl=IN&ceid=IN:en",
    },
    {
        name: "Indore Crime",
        url: "https://news.google.com/rss/search?q=Indore+crime+arrest+murder&hl=en-IN&gl=IN&ceid=IN:en",
    },
    // Disasters & emergencies
    {
        name: "MP Disaster",
        url: "https://news.google.com/rss/search?q=Madhya+Pradesh+flood+fire+accident+disaster&hl=en-IN&gl=IN&ceid=IN:en",
    },
    {
        name: "Indore Emergency",
        url: "https://news.google.com/rss/search?q=Indore+fire+accident+flood+blast&hl=en-IN&gl=IN&ceid=IN:en",
    },
    // Court & law
    {
        name: "MP Court",
        url: "https://news.google.com/rss/search?q=Madhya+Pradesh+court+verdict+high+court&hl=en-IN&gl=IN&ceid=IN:en",
    },
];

// ─── Relevance filter keywords (for digest) ───────────────────────────────────

const RELEVANT_KEYWORDS = [
    "arrest", "arrested", "murder", "killed", "crime", "criminal", "theft",
    "robbery", "rape", "assault", "attack", "kidnap", "abduct", "smuggling",
    "drug", "gang", "encounter", "police", "accused", "fir", "custody",
    "court", "verdict", "judgment", "justice", "cbi", "ed", "law",
    "chargesheet", "acquit", "order", "petition",
    "cyclone", "flood", "earthquake", "fire", "explosion", "blast",
    "collapse", "accident", "disaster", "rescue", "dead", "injured",
    "casualt", "emergency", "alert", "warning", "riot", "violence",
];

function isRelevant(article) {
    const text = `${article.title || ""} ${article.contentSnippet || ""}`.toLowerCase();
    return RELEVANT_KEYWORDS.some((kw) => text.includes(kw));
}

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function fetchFeed(feed) {
    try {
        const result = await parser.parseURL(feed.url);
        return (result.items || []).map((item) => ({
            title: item.title || "No title",
            link: item.link || "",
            contentSnippet: item.contentSnippet || item.summary || "",
            source: feed.name,
            pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        }));
    } catch (err) {
        console.warn(`[newsService] Failed to fetch "${feed.name}": ${err.message}`);
        return [];
    }
}

function deduplicateArticles(articles) {
    const seen = new Set();
    return articles.filter((a) => {
        const key = a.title.trim().toLowerCase().slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ─── Daily digest: top 5 relevant national news ───────────────────────────────

async function getTopArticles(count = 5) {
    const all = [];
    for (const feed of DIGEST_FEEDS) {
        const items = await fetchFeed(feed);
        all.push(...items.slice(0, 15));
    }
    const relevant = all.filter(isRelevant);
    const unique = deduplicateArticles(relevant);
    unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    return unique.slice(0, count);
}

// ─── Breaking news: fresh MP/Indore/Dhar articles ────────────────────────────

async function getBreakingCandidates() {
    const all = [];
    for (const feed of BREAKING_FEEDS) {
        const items = await fetchFeed(feed);
        // Only articles published in the last 20 minutes
        const cutoff = Date.now() - 20 * 60 * 1000;
        const fresh = items.filter((a) => new Date(a.pubDate).getTime() > cutoff);
        all.push(...fresh);
    }
    return deduplicateArticles(all);
}

module.exports = { getTopArticles, getBreakingCandidates };