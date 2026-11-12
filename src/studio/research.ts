import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ClaimStatus, ClaimVerdict, FetchedPage, SearchResult, TrendItem } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
const USER_AGENT =
  "Pi-Mirror/0.1 (+local research; contact: local workspace)";
const FETCH_TIMEOUT_MS = 15000;
const MAX_BODY_BYTES = 2_000_000;

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, num: string) => String.fromCodePoint(Number(num)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<\/(p|div|section|article|li|h[1-6]|blockquote|tr)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");
}

export function extractTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return decodeEntities(og[1]).trim();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? decodeEntities(stripHtml(title[1])).trim() : "";
}

export function extractPublishedAt(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

export function extractSite(html: string, url: string): string {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  if (og) return decodeEntities(og[1]).trim();
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isPrivateIp(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    );
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80") ||
      lower.startsWith("::ffff:127.") ||
      lower.startsWith("::ffff:10.") ||
      lower.startsWith("::ffff:192.168.")
    );
  }
  return true;
}

export async function assertPublicHttpUrl(input: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Localhost is not allowed.");
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Private network addresses are not allowed.");
    return url;
  }
  const addresses = await lookup(host, { all: true });
  if (!addresses.length) throw new Error("Could not resolve the host.");
  for (const entry of addresses) {
    if (isPrivateIp(entry.address)) throw new Error("The host resolves to a private network address.");
  }
  return url;
}

async function fetchText(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function unwrapBingRedirect(raw: string): string {
  try {
    const url = new URL(raw);
    if (!/(^|\.)bing\.com$/i.test(url.hostname) || !url.pathname.startsWith("/ck/a")) return raw;
    const encoded = url.searchParams.get("u");
    if (!encoded?.startsWith("a1")) return raw;
    const padded = encoded.slice(2).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil((encoded.length - 2) / 4) * 4, "=");
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    return /^https?:\/\//i.test(decoded) ? decoded : raw;
  } catch {
    return raw;
  }
}

export function parseBingResults(html: string, limit = 6): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const pattern =
    /<li class="b_algo"[\s\S]*?<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>([\s\S]*?)(?=<li class="b_algo"|<\/ol>|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && results.length < limit) {
    const url = unwrapBingRedirect(decodeEntities(match[1]));
    if (!url.startsWith("http") || seen.has(url)) continue;
    seen.add(url);
    const title = stripHtml(match[2]).trim();
    const paragraph = match[3].match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const snippet = paragraph ? stripHtml(paragraph[1]).trim() : "";
    let source = "";
    try {
      source = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      source = "";
    }
    results.push({ title, url, snippet, source });
  }
  return results;
}

/**
 * Drop results that share no meaningful term with the query. A query like
 * "Cursor 11 人 62 个 agent" otherwise drags in "Windows 11" and "11（自然数）"
 * pages that only match the bare number.
 */
export function filterRelevant(results: SearchResult[], query: string): SearchResult[] {
  const terms = significantTerms(query);
  if (!terms.length) return results;
  const kept = results.filter((result) => {
    const haystack = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });
  return kept.length ? kept : results;
}

export async function searchWeb(query: string, limit = 6): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  // A bare number matches "Windows 11", "11（自然数）" and songs called "11".
  // Refuse it so the model rephrases with an entity instead of citing noise.
  if (!/[a-z]{2,}|[㐀-鿿]/i.test(q)) {
    throw new Error(
      `Query "${q}" is too generic: search a name or phrase (for example "Cursor Projects multiplayer"), not a bare number.`,
    );
  }
  // Ask for a wider page so relevance filtering still leaves a full set.
  const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en&cc=US&mkt=en-US&count=${Math.min(
    Math.max(limit + 4, 8),
    20,
  )}`;
  const response = await fetchText(url);
  if (!response.ok) throw new Error(`Search failed with HTTP ${response.status}.`);
  const html = await response.text();
  return filterRelevant(parseBingResults(html, limit + 4), q).slice(0, limit);
}

export async function fetchPage(input: string): Promise<FetchedPage> {
  const url = await assertPublicHttpUrl(input);
  const response = await fetchText(url.toString());
  if (!response.ok) throw new Error(`Fetch failed with HTTP ${response.status}.`);
  const finalUrl = response.url || url.toString();
  await assertPublicHttpUrl(finalUrl);
  const type = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml|text\/plain|application\/xml/i.test(type)) {
    throw new Error(`Unsupported content type: ${type || "unknown"}.`);
  }
  const raw = await response.text();
  const html = raw.slice(0, MAX_BODY_BYTES);
  const text = stripHtml(html).replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("The page returned no readable text.");
  const title = extractTitle(html) || finalUrl;
  return {
    url: finalUrl,
    title,
    site: extractSite(html, finalUrl),
    publishedAt: extractPublishedAt(html),
    text: text.slice(0, 24000),
    quote: text.replace(/\s+/g, " ").slice(0, 700),
  };
}

function significantTerms(text: string): string[] {
  const terms = new Set<string>();
  const lower = text.toLowerCase();
  for (const word of lower.match(/[a-z][a-z0-9+#.-]{3,}/g) ?? []) {
    if (!["that", "this", "with", "from", "have", "will", "been", "were", "they", "their", "about"].includes(word)) {
      terms.add(word);
    }
  }
  const cjk = lower.replace(/[^㐀-鿿]/g, "");
  for (let index = 0; index < cjk.length - 1; index += 1) {
    const bigram = cjk.slice(index, index + 2);
    if (bigram.length === 2) terms.add(bigram);
  }
  return [...terms].slice(0, 40);
}

function overlapScore(claim: string, text: string): number {
  const terms = significantTerms(claim);
  if (!terms.length) return 0;
  const haystack = text.toLowerCase();
  return terms.filter((term) => haystack.includes(term)).length;
}

const DEBUNK = /false|fake|rumou?r|debunk|denies|denied|not true|misleading|不实|谣言|辟谣|否认|误导/i;

export async function verifyClaim(claim: string): Promise<ClaimVerdict> {
  const text = claim.trim();
  if (!text) throw new Error("Claim is empty.");
  let results: SearchResult[] = [];
  try {
    results = await searchWeb(text, 6);
  } catch (error) {
    return {
      claim: text,
      status: "unverified",
      confidence: "low",
      note: `${(error as Error).message} Do not present this as fact.`,
      sources: [],
    };
  }
  const domains = new Set(results.map((result) => result.source).filter(Boolean));

  if (!results.length) {
    return {
      claim: text,
      status: "unverified",
      confidence: "low",
      note: "No web results. Do not present this as fact.",
      sources: [],
    };
  }

  const debunked = results.some((result) => DEBUNK.test(result.snippet));
  if (debunked) {
    return {
      claim: text,
      status: "disputed",
      confidence: "medium",
      note: "At least one result uses debunking language. Check the disagreement before writing.",
      sources: results,
    };
  }

  if (domains.size === 1) {
    return {
      claim: text,
      status: "single-source",
      confidence: "low",
      note: "Only one domain shows up. Hedge the claim or find an independent source.",
      sources: results,
    };
  }

  const fetchable = results.slice(0, 2);
  const pages = await Promise.allSettled(fetchable.map((result) => fetchPage(result.url)));
  // A claim with numbers is only supported by a page that actually shows those numbers.
  const numbers = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const hasNumbers = (value: string) => numbers.every((number) => value.includes(number));
  let supported = 0;
  for (const page of pages) {
    if (page.status !== "fulfilled") continue;
    if (overlapScore(text, page.value.text) >= 2 && hasNumbers(page.value.text)) supported += 1;
  }
  const snippetSupport = results.filter(
    (result) => overlapScore(text, result.snippet) >= 2 && hasNumbers(result.snippet),
  ).length;
  const support = Math.max(supported, snippetSupport);

  if (domains.size >= 2 && support >= 2) {
    return {
      claim: text,
      status: "confirmed",
      confidence: domains.size >= 3 ? "high" : "medium",
      note: "Multiple independent domains carry matching details. Still read the wording before quoting.",
      sources: results,
    };
  }

  return {
    claim: text,
    status: "single-source",
    confidence: "low",
    note: "Several results exist, but they do not clearly support the claim. Treat it as single-source.",
    sources: results,
  };
}

function decodeXml(value: string): string {
  return decodeEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function parseRssItems(xml: string, limit = 8): TrendItem[] {
  const items: TrendItem[] = [];
  const pattern = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) && items.length < limit) {
    const block = match[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/i);
    const link = block.match(/<link>([\s\S]*?)<\/link>/i);
    const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const description = block.match(/<description>([\s\S]*?)<\/description>/i);
    if (!title) continue;
    const date = pub ? new Date(pub[1]) : null;
    const parsedDate = date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
    items.push({
      title: decodeXml(title[1]),
      url: link ? decodeXml(link[1]) : null,
      source: "Techmeme",
      publishedAt: parsedDate,
      summary: description ? decodeXml(description[1]).slice(0, 500) : "",
      heat: null,
    });
  }
  return items;
}

interface TrendPack {
  date?: string;
  source?: string;
  items?: Array<{
    topic?: string;
    summary?: string;
    heat?: string;
    url?: string;
    posts?: Array<{ url?: string; author?: string; text?: string; observedAt?: string }>;
  }>;
}

function trendPackDir(): string {
  const candidates = [
    resolve(here, "..", "..", "demo", "trends"),
    resolve(process.cwd(), "demo", "trends"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export function loadTrendPacks(limit = 3): TrendItem[] {
  const dir = trendPackDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, limit);
  const items: TrendItem[] = [];
  for (const file of files) {
    try {
      const pack = JSON.parse(readFileSync(resolve(dir, file), "utf8")) as TrendPack;
      for (const item of pack.items ?? []) {
        if (!item.topic) continue;
        items.push({
          title: item.topic,
          url: item.url ?? item.posts?.[0]?.url ?? null,
          source: pack.source ?? "x.com",
          publishedAt: pack.date ? `${pack.date}T00:00:00.000Z` : null,
          summary: item.summary ?? "",
          heat: item.heat ?? null,
          posts: (item.posts ?? []).map((post) => ({
            url: post.url ?? "",
            author: post.author,
            text: post.text,
            observedAt: post.observedAt,
          })),
        });
      }
    } catch {
      // A malformed pack must not break research.
    }
  }
  return items;
}

export async function trendScan(options: { query?: string; limit?: number } = {}): Promise<TrendItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 20);
  const query = (options.query ?? "").toLowerCase().trim();
  const local = loadTrendPacks(3);
  const filteredLocal = query
    ? local.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(query))
    : local;
  const items = filteredLocal.slice(0, limit);

  if (items.length < limit) {
    try {
      const response = await fetchText("https://www.techmeme.com/feed.xml");
      if (response.ok) {
        const rss = parseRssItems(await response.text(), limit);
        for (const item of rss) {
          if (items.length >= limit) break;
          if (query && !`${item.title} ${item.summary}`.toLowerCase().includes(query)) continue;
          items.push(item);
        }
      }
    } catch {
      // Local packs and the rest of the run still work without the feed.
    }
  }
  return items;
}
