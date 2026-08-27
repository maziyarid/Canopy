import { i as __toESM } from "../_runtime.mjs";
import { y as require_jsx_runtime, z as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { a as lazy, c as object, d as union, i as boolean, l as record, n as _null, r as array, s as number, t as _enum, u as string } from "../_libs/zod.mjs";
import { i as RATE_NOTES, n as ENDPOINTS, r as FIELD_MAP } from "./api-catalog-BBUji59b.mjs";
import { a as LoaderCircle, c as ExternalLink, d as ClipboardList, f as Check, h as ArrowDownRight, i as Plus, l as Download, m as ArrowUpRight, n as Sparkles, o as LayoutGrid, p as BookOpen, r as Send, s as KeyRound, u as Copy } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DOQ4MUzl.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function Button({ variant = "primary", size = "md", className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		className: cn("inline-flex items-center justify-center gap-2 font-medium transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-40", size === "sm" && "h-9 rounded-sm px-3 text-sm", size === "md" && "h-10 rounded-md px-4 text-sm", size === "lg" && "h-11 rounded-md px-5 text-base", variant === "primary" && "bg-accent text-accent-fg hover:opacity-90", variant === "ghost" && "bg-raised text-fg shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]", variant === "paper" && "bg-paper text-ink hover:opacity-90", variant === "danger" && "bg-bad/20 text-bad hover:opacity-90", variant === "quiet" && "text-muted hover:bg-raised hover:text-fg", className),
		...props
	});
}
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("h-10 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle", className),
		...props
	});
}
function Textarea({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		className: cn("min-h-24 w-full rounded-lg bg-raised px-3 py-2 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle", className),
		...props
	});
}
function Badge({ tone = "muted", className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", tone === "good" && "bg-good/15 text-good", tone === "warn" && "bg-warn/15 text-warn", tone === "bad" && "bg-bad/15 text-bad", tone === "muted" && "bg-raised text-muted", tone === "accent" && "bg-accent/15 text-accent", tone === "paper" && "bg-paper/10 text-paper", className),
		...props
	});
}
function Field({ label, hint, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "grid gap-1.5 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-medium text-fg",
				children: label
			}),
			children,
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs text-muted",
				children: hint
			}) : null
		]
	});
}
/** Opportunity = volume weighted by inverse difficulty and PPC competition. */
function opportunityScore(volume, kd, ppc) {
	const difficulty = kd == null ? 45 : kd;
	const competition = Math.min(100, Math.max(0, ppc)) / 100;
	const raw = volume / (difficulty + 8) * (1 - competition * .45);
	return Math.round(raw * 10) / 10;
}
function kdTone(kd) {
	if (kd == null) return "muted";
	if (kd < 30) return "good";
	if (kd < 50) return "warn";
	return "bad";
}
function rankDelta(rank, prev) {
	if (rank == null || prev == null) return 0;
	return prev - rank;
}
function formatVolume(n) {
	if (n >= 1e6) return `${(n / 1e6).toFixed(1)}m`;
	if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
	return String(n);
}
function formatCpc(n) {
	return `$${n.toFixed(2)}`;
}
function sparkPath(values, width = 72, height = 22) {
	if (!values.length) return "";
	const max = Math.max(...values, 1);
	const min = Math.min(...values, 0);
	const span = Math.max(max - min, 1);
	const step = values.length === 1 ? 0 : width / (values.length - 1);
	return values.map((v, i) => {
		const x = i * step;
		const y = height - (v - min) / span * (height - 2) - 1;
		return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
	}).join(" ");
}
function row(partial) {
	const opportunity = opportunityScore(partial.volume, partial.kd, partial.ppc);
	return {
		id: partial.id ?? partial.keywordId,
		opportunity,
		...partial
	};
}
var DEMO_KEYWORDS = [
	row({
		seed: "field notebook",
		keyword: "waterproof field notebook",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 2400,
		msv: [
			1800,
			1900,
			2100,
			2e3,
			2200,
			2300,
			2500,
			2600,
			2400,
			2200,
			2100,
			2400
		],
		kd: 18,
		cpc: 1.42,
		ppc: 22,
		status: "tracked",
		lastFetched: "2026-08-27 09:14",
		keywordId: "k_wnb_01",
		notes: "Hero product term. Brief ready.",
		agent: "Assessor"
	}),
	row({
		seed: "field notebook",
		keyword: "best hiking journal",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 1900,
		msv: [
			1400,
			1500,
			1600,
			1700,
			1800,
			2100,
			2400,
			2200,
			1900,
			1700,
			1600,
			1900
		],
		kd: 27,
		cpc: .88,
		ppc: 31,
		status: "briefed",
		lastFetched: "2026-08-27 09:14",
		keywordId: "k_hj_02",
		notes: "Roundup intent. Seasonal peak Jun–Aug.",
		agent: "Brief"
	}),
	row({
		seed: "field notebook",
		keyword: "rugged pocket notebook",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 880,
		msv: [
			720,
			740,
			760,
			800,
			820,
			860,
			900,
			920,
			880,
			840,
			800,
			880
		],
		kd: 14,
		cpc: 1.05,
		ppc: 18,
		status: "new",
		lastFetched: "2026-08-27 09:14",
		keywordId: "k_rpn_03",
		notes: "Easy win. Thin SERP.",
		agent: "Scout"
	}),
	row({
		seed: "trail map",
		keyword: "printable trail log",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 590,
		msv: [
			400,
			420,
			480,
			520,
			560,
			610,
			680,
			640,
			600,
			540,
			500,
			590
		],
		kd: 11,
		cpc: .41,
		ppc: 9,
		status: "new",
		lastFetched: "2026-08-26 18:02",
		keywordId: "k_ptl_04",
		notes: "Lead-magnet candidate.",
		agent: "Scout"
	}),
	row({
		seed: "trail map",
		keyword: "national park journal",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 3200,
		msv: [
			2100,
			2300,
			2500,
			2800,
			3100,
			3600,
			4200,
			3900,
			3400,
			2900,
			2500,
			3200
		],
		kd: 44,
		cpc: 1.76,
		ppc: 48,
		status: "ignored",
		lastFetched: "2026-08-26 18:02",
		keywordId: "k_npj_05",
		notes: "Amazon-heavy SERP.",
		agent: "Assessor"
	}),
	row({
		seed: "field notebook",
		keyword: "surveyor field book",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 1300,
		msv: [
			1200,
			1250,
			1280,
			1300,
			1320,
			1290,
			1270,
			1260,
			1280,
			1310,
			1300,
			1300
		],
		kd: 22,
		cpc: 2.18,
		ppc: 35,
		status: "tracked",
		lastFetched: "2026-08-27 09:14",
		keywordId: "k_sfb_06",
		notes: "B2B adjacent. High CPC.",
		agent: "Rival"
	}),
	row({
		seed: "outdoor stationery",
		keyword: "all weather notebook",
		location: "United Kingdom",
		locationId: 2826,
		language: "English",
		languageId: 1e3,
		volume: 720,
		msv: [
			500,
			520,
			540,
			580,
			620,
			700,
			780,
			760,
			700,
			640,
			600,
			720
		],
		kd: 19,
		cpc: .94,
		ppc: 24,
		status: "new",
		lastFetched: "2026-08-25 11:40",
		keywordId: "k_awn_07",
		notes: "UK volume. Localize packing copy.",
		agent: "Expander"
	}),
	row({
		seed: "outdoor stationery",
		keyword: "write in the rain notebook",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 8100,
		msv: [
			6200,
			6400,
			6800,
			7200,
			7600,
			8400,
			9100,
			8800,
			8200,
			7600,
			7200,
			8100
		],
		kd: 61,
		cpc: 1.12,
		ppc: 67,
		status: "ignored",
		lastFetched: "2026-08-25 11:40",
		keywordId: "k_wir_08",
		notes: "Brand-dominated SERP.",
		agent: "Assessor"
	}),
	row({
		seed: "field notebook",
		keyword: "geology field notebook",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 480,
		msv: [
			450,
			460,
			470,
			480,
			490,
			500,
			510,
			500,
			480,
			470,
			460,
			480
		],
		kd: 9,
		cpc: .63,
		ppc: 12,
		status: "briefed",
		lastFetched: "2026-08-27 09:14",
		keywordId: "k_gfn_09",
		notes: "Niche, loyal searchers.",
		agent: "Brief"
	}),
	row({
		seed: "trail map",
		keyword: "backcountry trip log template",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 210,
		msv: [
			160,
			170,
			180,
			190,
			200,
			230,
			260,
			250,
			220,
			200,
			180,
			210
		],
		kd: 6,
		cpc: .29,
		ppc: 4,
		status: "new",
		lastFetched: "2026-08-24 08:11",
		keywordId: "k_btl_10",
		notes: "Template download page.",
		agent: "Scout"
	})
];
var DEMO_RELATED = [
	row({
		seed: "waterproof field notebook",
		keyword: "waterproof notebook for hiking",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 1100,
		msv: [
			800,
			850,
			900,
			950,
			1e3,
			1200,
			1400,
			1300,
			1100,
			950,
			900,
			1100
		],
		kd: 16,
		cpc: 1.21,
		ppc: 20,
		status: "new",
		lastFetched: "2026-08-27 09:16",
		keywordId: "r_01",
		notes: "",
		agent: "Expander"
	}),
	row({
		seed: "waterproof field notebook",
		keyword: "stone paper notebook",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 1600,
		msv: [
			1400,
			1450,
			1500,
			1550,
			1600,
			1700,
			1800,
			1750,
			1650,
			1580,
			1520,
			1600
		],
		kd: 33,
		cpc: .77,
		ppc: 28,
		status: "new",
		lastFetched: "2026-08-27 09:16",
		keywordId: "r_02",
		notes: "",
		agent: "Expander"
	}),
	row({
		seed: "waterproof field notebook",
		keyword: "field notes waterproof",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 2900,
		msv: [
			2500,
			2550,
			2600,
			2700,
			2800,
			3e3,
			3200,
			3100,
			2900,
			2700,
			2600,
			2900
		],
		kd: 48,
		cpc: .54,
		ppc: 41,
		status: "ignored",
		lastFetched: "2026-08-27 09:16",
		keywordId: "r_03",
		notes: "Competitor brand query.",
		agent: "Expander"
	}),
	row({
		seed: "surveyor field book",
		keyword: "engineering field book",
		location: "United States",
		locationId: 2840,
		language: "English",
		languageId: 1e3,
		volume: 720,
		msv: [
			700,
			710,
			720,
			730,
			720,
			710,
			700,
			710,
			720,
			730,
			720,
			720
		],
		kd: 21,
		cpc: 2.44,
		ppc: 38,
		status: "new",
		lastFetched: "2026-08-27 09:16",
		keywordId: "r_04",
		notes: "",
		agent: "Expander"
	})
];
var DEMO_TRACKING = [
	{
		id: "t1",
		trackingId: "trk_northline_us",
		domain: "northline.studio",
		keyword: "waterproof field notebook",
		location: "United States",
		device: "desktop",
		rank: 7,
		prev: 11,
		best: 6,
		visits: 186,
		volume: 2400,
		url: "https://northline.studio/notebooks/field",
		lastCheck: "2026-08-27 06:02"
	},
	{
		id: "t2",
		trackingId: "trk_northline_us",
		domain: "northline.studio",
		keyword: "surveyor field book",
		location: "United States",
		device: "desktop",
		rank: 14,
		prev: 14,
		best: 12,
		visits: 41,
		volume: 1300,
		url: "https://northline.studio/notebooks/survey",
		lastCheck: "2026-08-27 06:02"
	},
	{
		id: "t3",
		trackingId: "trk_northline_us",
		domain: "northline.studio",
		keyword: "geology field notebook",
		location: "United States",
		device: "mobile",
		rank: 4,
		prev: 9,
		best: 4,
		visits: 96,
		volume: 480,
		url: "https://northline.studio/journal/geology",
		lastCheck: "2026-08-27 06:02"
	},
	{
		id: "t4",
		trackingId: "trk_northline_uk",
		domain: "northline.studio",
		keyword: "all weather notebook",
		location: "United Kingdom",
		device: "desktop",
		rank: 21,
		prev: 18,
		best: 16,
		visits: 12,
		volume: 720,
		url: "https://northline.studio/notebooks/field",
		lastCheck: "2026-08-27 06:04"
	}
];
var DEMO_COMPETITORS = [
	{
		id: "c1",
		domain: "riteintherain.com",
		keyword: "all weather notebook",
		volume: 8100,
		kd: 61,
		cpc: 1.12,
		position: 1,
		visitsEst: 2400
	},
	{
		id: "c2",
		domain: "fieldnotesbrand.com",
		keyword: "pocket notebook",
		volume: 12100,
		kd: 54,
		cpc: .66,
		position: 2,
		visitsEst: 1800
	},
	{
		id: "c3",
		domain: "moleskine.com",
		keyword: "national park journal",
		volume: 3200,
		kd: 44,
		cpc: 1.76,
		position: 3,
		visitsEst: 410
	},
	{
		id: "c4",
		domain: "leuchtturm1917.us",
		keyword: "hiking journal",
		volume: 1900,
		kd: 27,
		cpc: .88,
		position: 5,
		visitsEst: 160
	}
];
var DEMO_GAPS = [
	{
		id: "g1",
		keyword: "coastal survey notebook",
		volume: 320,
		cpc: 1.9,
		yourPosition: null,
		competitor: "riteintherain.com",
		competitorPosition: 4
	},
	{
		id: "g2",
		keyword: "forestry field book",
		volume: 540,
		cpc: 1.55,
		yourPosition: 28,
		competitor: "riteintherain.com",
		competitorPosition: 2
	},
	{
		id: "g3",
		keyword: "birding life list journal",
		volume: 880,
		cpc: .72,
		yourPosition: null,
		competitor: "moleskine.com",
		competitorPosition: 6
	},
	{
		id: "g4",
		keyword: "waterproof lab notebook",
		volume: 410,
		cpc: 2.3,
		yourPosition: null,
		competitor: "riteintherain.com",
		competitorPosition: 3
	}
];
var DEMO_LISTS = [
	{
		id: "l1",
		name: "Northline — core catalog",
		count: 18,
		updated: "2026-08-27"
	},
	{
		id: "l2",
		name: "Q3 content briefs",
		count: 7,
		updated: "2026-08-22"
	},
	{
		id: "l3",
		name: "UK localization",
		count: 11,
		updated: "2026-08-19"
	}
];
var DEMO_LOG = [
	{
		id: "log1",
		at: "2026-08-27 09:16",
		level: "info",
		action: "related-keywords",
		detail: "seed=waterproof field notebook · 48 ideas · US/en",
		credits: 1
	},
	{
		id: "log2",
		at: "2026-08-27 09:14",
		level: "info",
		action: "keyword-imports",
		detail: "10 keywords scored",
		credits: 1
	},
	{
		id: "log3",
		at: "2026-08-27 06:04",
		level: "info",
		action: "serpwatcher.stats",
		detail: "trk_northline_uk · 1 keyword",
		credits: 0
	},
	{
		id: "log4",
		at: "2026-08-26 18:02",
		level: "warn",
		action: "rate-limit",
		detail: "429 · backed off 1.6s and retried",
		credits: 0
	}
];
var DEMO_QUOTA = {
	lookups: {
		limit: 500,
		remaining: 412
	},
	serps: {
		limit: 500,
		remaining: 478
	},
	tracked: {
		limit: 200,
		remaining: 184
	},
	resetHours: 11,
	live: false
};
var AGENT_ROSTER = [
	{
		id: "scout",
		name: "Scout",
		job: "Propose seed keywords from a topic, product, or URL.",
		uses: "Grok · no Mangools credits"
	},
	{
		id: "expander",
		name: "Expander",
		job: "Pull related keywords for every seed (up to 700 ideas).",
		uses: "GET /kwfinder/related-keywords"
	},
	{
		id: "assessor",
		name: "Assessor",
		job: "Bulk-score a list: volume, KD, CPC, opportunity, keep/drop.",
		uses: "POST /kwfinder/keyword-imports"
	},
	{
		id: "rival",
		name: "Rival",
		job: "Mine a domain and run gap analysis against 1–5 rivals.",
		uses: "competitor-keywords · gap-analysis"
	},
	{
		id: "watch",
		name: "Watch",
		job: "Create or refresh SERPWatcher trackings and write ranks.",
		uses: "SERPWatcher trackings + stats"
	},
	{
		id: "brief",
		name: "Brief",
		job: "Turn a winning keyword into a content brief on the sheet.",
		uses: "Grok · optional SERP lookup"
	}
];
var LOCATIONS = [
	{
		id: 0,
		label: "Global",
		country: "—"
	},
	{
		id: 2840,
		label: "United States",
		country: "US"
	},
	{
		id: 2826,
		label: "United Kingdom",
		country: "GB"
	},
	{
		id: 2124,
		label: "Canada",
		country: "CA"
	},
	{
		id: 2036,
		label: "Australia",
		country: "AU"
	},
	{
		id: 2276,
		label: "Germany",
		country: "DE"
	},
	{
		id: 2250,
		label: "France",
		country: "FR"
	},
	{
		id: 2724,
		label: "Spain",
		country: "ES"
	},
	{
		id: 2380,
		label: "Italy",
		country: "IT"
	},
	{
		id: 2528,
		label: "Netherlands",
		country: "NL"
	},
	{
		id: 2356,
		label: "India",
		country: "IN"
	},
	{
		id: 2076,
		label: "Brazil",
		country: "BR"
	},
	{
		id: 2392,
		label: "Japan",
		country: "JP"
	},
	{
		id: 2702,
		label: "Singapore",
		country: "SG"
	},
	{
		id: 2372,
		label: "Ireland",
		country: "IE"
	},
	{
		id: 2554,
		label: "New Zealand",
		country: "NZ"
	},
	{
		id: 2484,
		label: "Mexico",
		country: "MX"
	},
	{
		id: 2616,
		label: "Poland",
		country: "PL"
	},
	{
		id: 2752,
		label: "Sweden",
		country: "SE"
	},
	{
		id: 2784,
		label: "United Arab Emirates",
		country: "AE"
	}
];
var LANGUAGES = [
	{
		id: 1e3,
		code: "en",
		label: "English"
	},
	{
		id: 1001,
		code: "de",
		label: "German"
	},
	{
		id: 1002,
		code: "es",
		label: "Spanish"
	},
	{
		id: 1003,
		code: "fr",
		label: "French"
	},
	{
		id: 1004,
		code: "it",
		label: "Italian"
	},
	{
		id: 1005,
		code: "pt",
		label: "Portuguese"
	},
	{
		id: 1006,
		code: "nl",
		label: "Dutch"
	},
	{
		id: 1007,
		code: "ja",
		label: "Japanese"
	},
	{
		id: 1008,
		code: "pl",
		label: "Polish"
	},
	{
		id: 1009,
		code: "sv",
		label: "Swedish"
	}
];
function locationLabel(id) {
	return LOCATIONS.find((l) => l.id === id)?.label ?? String(id);
}
function languageLabel(id) {
	return LANGUAGES.find((l) => l.id === id)?.label ?? String(id);
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var AgentSchema = object({
	message: string().min(1).max(4e3),
	domain: string().max(200).optional(),
	location: string().max(80).optional(),
	keywordsPreview: string().max(2500).optional()
});
var runResearchAgent = createServerFn({ method: "POST" }).validator(AgentSchema).handler(createSsrRpc("5b738a0d7db0c8f22a3da300c948d1433c0c697de7162b763d83c97c20e8bc9b"));
var defaultSettings = {
	apiKey: "",
	domain: "northline.studio",
	locationId: 2840,
	languageId: 1e3,
	trackingId: "",
	llmKey: "",
	llmBase: "https://api.x.ai/v1",
	webhookSecret: "",
	dailyTrigger: true
};
function uid() {
	return Math.random().toString(36).slice(2, 10);
}
var useCanopy = create()(persist((set, get) => ({
	view: "workspace",
	sheetTab: "keywords",
	settings: defaultSettings,
	keywords: DEMO_KEYWORDS,
	related: DEMO_RELATED,
	tracking: DEMO_TRACKING,
	competitors: DEMO_COMPETITORS,
	gaps: DEMO_GAPS,
	lists: DEMO_LISTS,
	log: DEMO_LOG,
	quota: DEMO_QUOTA,
	selected: [],
	messages: [{
		id: "welcome",
		role: "assistant",
		at: (/* @__PURE__ */ new Date()).toISOString(),
		content: "I run Canopy's research desk. Give me a topic, a domain, or a sheet goal and I will draft seeds, score opportunities, and write the agent playbook your Google Sheet will execute against Mangools.",
		playbook: null
	}],
	setView: (view) => set({ view }),
	setSheetTab: (sheetTab) => set({ sheetTab }),
	patchSettings: (patch) => set({ settings: {
		...get().settings,
		...patch
	} }),
	setKeywords: (keywords) => set({ keywords }),
	mergeKeywords: (rows) => {
		const map = new Map(get().keywords.map((k) => [k.keyword.toLowerCase(), k]));
		for (const row of rows) map.set(row.keyword.toLowerCase(), row);
		set({ keywords: [...map.values()] });
	},
	setRelated: (related) => set({ related }),
	setTracking: (tracking) => set({ tracking }),
	setCompetitors: (competitors) => set({ competitors }),
	setGaps: (gaps) => set({ gaps }),
	setLists: (lists) => set({ lists }),
	setQuota: (quota) => set({ quota }),
	addLog: (row) => set({ log: [{
		...row,
		id: uid()
	}, ...get().log].slice(0, 80) }),
	toggleSelected: (id) => {
		const selected = get().selected;
		set({ selected: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] });
	},
	clearSelected: () => set({ selected: [] }),
	addMessage: (msg) => set({ messages: [...get().messages, {
		...msg,
		id: uid(),
		at: (/* @__PURE__ */ new Date()).toISOString()
	}] }),
	updateStatus: (id, status) => set({ keywords: get().keywords.map((k) => k.id === id ? {
		...k,
		status
	} : k) }),
	addSeeds: (seeds) => {
		const existing = new Set(get().keywords.map((k) => k.keyword.toLowerCase()));
		const { settings } = get();
		const rows = seeds.map((s) => s.trim()).filter((s) => s && !existing.has(s.toLowerCase())).map((keyword) => ({
			id: uid(),
			seed: keyword,
			keyword,
			location: "United States",
			locationId: settings.locationId,
			language: "English",
			languageId: settings.languageId,
			volume: 0,
			msv: [],
			kd: null,
			cpc: 0,
			ppc: 0,
			opportunity: opportunityScore(0, null, 0),
			status: "new",
			lastFetched: "—",
			keywordId: "",
			notes: "Added by agent",
			agent: "Scout"
		}));
		if (rows.length) set({ keywords: [...rows, ...get().keywords] });
	},
	resetDemo: () => set({
		keywords: DEMO_KEYWORDS,
		related: DEMO_RELATED,
		tracking: DEMO_TRACKING,
		competitors: DEMO_COMPETITORS,
		gaps: DEMO_GAPS,
		lists: DEMO_LISTS,
		log: DEMO_LOG,
		quota: DEMO_QUOTA,
		selected: []
	})
}), {
	name: "canopy-ledger",
	skipHydration: true,
	partialize: (s) => ({
		settings: s.settings,
		keywords: s.keywords,
		related: s.related,
		tracking: s.tracking,
		competitors: s.competitors,
		gaps: s.gaps,
		lists: s.lists,
		log: s.log,
		messages: s.messages.slice(-24)
	})
}));
function Agents() {
	const messages = useCanopy((s) => s.messages);
	const addMessage = useCanopy((s) => s.addMessage);
	const addSeeds = useCanopy((s) => s.addSeeds);
	const setView = useCanopy((s) => s.setView);
	const keywords = useCanopy((s) => s.keywords);
	const settings = useCanopy((s) => s.settings);
	const [text, setText] = (0, import_react.useState)("Map a 90-day content plan for waterproof field notebooks in the US.");
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function send() {
		const message = text.trim();
		if (!message || busy) return;
		addMessage({
			role: "user",
			content: message
		});
		setText("");
		setBusy(true);
		try {
			const preview = keywords.slice(0, 12).map((k) => `${k.keyword} (vol ${k.volume}, kd ${k.kd ?? "—"})`).join("\n");
			const res = await runResearchAgent({ data: {
				message,
				domain: settings.domain,
				location: locationLabel(settings.locationId),
				keywordsPreview: preview
			} });
			if (!res.ok) {
				addMessage({
					role: "assistant",
					content: res.error
				});
				toast.error(res.error);
				return;
			}
			addMessage({
				role: "assistant",
				content: res.reply,
				playbook: res.playbook
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Agent failed";
			addMessage({
				role: "assistant",
				content: msg
			});
			toast.error(msg);
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "flex min-h-0 flex-col",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium uppercase tracking-widest text-muted",
					children: "Desk"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl font-medium tracking-tight sm:text-4xl",
					children: "Research agents"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-2xl text-sm text-muted",
					children: "Grok plans the run. The Google Sheet executes it against Mangools on a trigger or via the web app webhook your other agents can POST to."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-1 flex-col overflow-hidden rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 space-y-4 overflow-auto px-1 py-2",
						children: [messages.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: m.role === "user" ? "ml-8 rounded-xl rounded-tr-sm bg-raised px-4 py-3 text-sm" : "mr-4 rounded-xl rounded-tl-sm bg-bg px-4 py-3 text-sm shadow-[var(--shadow-border)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "whitespace-pre-wrap text-pretty",
								children: m.content
							}), m.playbook ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlaybookCard, {
								playbook: m.playbook,
								onApply: () => {
									addSeeds(m.playbook.seeds);
									toast.success("Seeds written to the Keywords sheet");
									setView("workspace");
								}
							}) : null]
						}, m.id)), busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "flex items-center gap-2 text-sm text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), "Drafting playbook"]
						}) : null]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "mt-2 flex flex-col gap-2 sm:flex-row sm:items-end",
						onSubmit: (e) => {
							e.preventDefault();
							send();
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							value: text,
							onChange: (e) => setText(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									send();
								}
							},
							placeholder: "Topic, domain, or a job for the sheet",
							className: "min-h-20 flex-1"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "submit",
							disabled: busy || !text.trim(),
							className: "h-11 shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-4" }), "Run"]
						})]
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
			className: "grid h-fit gap-3",
			children: AGENT_ROSTER.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-lg font-medium",
							children: a.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: a.id })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: a.job
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 font-mono text-xs text-subtle",
						children: a.uses
					})
				]
			}, a.id))
		})]
	});
}
function PlaybookCard({ playbook, onApply }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-3 rounded-lg bg-raised p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-display text-base font-medium",
					children: playbook.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					onClick: onApply,
					children: "Write seeds to sheet"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: playbook.summary
			}),
			playbook.seeds?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: playbook.seeds.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: "accent",
					children: s
				}) }, s))
			}) : null,
			playbook.tasks?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-3 space-y-1.5 text-sm",
				children: playbook.tasks.map((t, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "w-16 shrink-0 font-medium text-accent",
						children: t.agent
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-muted",
						children: [
							t.action,
							" — ",
							t.input
						]
					})]
				}, i))
			}) : null,
			playbook.notes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs text-subtle",
				children: playbook.notes
			}) : null
		]
	});
}
var GROUPS = [
	"All",
	"KWFinder",
	"SERPChecker",
	"SERPWatcher",
	"Locations",
	"Quota"
];
function Atlas() {
	const [q, setQ] = (0, import_react.useState)("");
	const [group, setGroup] = (0, import_react.useState)("All");
	const list = (0, import_react.useMemo)(() => {
		return ENDPOINTS.filter((e) => {
			if (group !== "All" && e.group !== group) return false;
			if (!q.trim()) return true;
			return `${e.name} ${e.path} ${e.notes}`.toLowerCase().includes(q.toLowerCase());
		});
	}, [q, group]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-1 flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium uppercase tracking-widest text-muted",
					children: "Reference"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl font-medium tracking-tight sm:text-4xl",
					children: "Mangools API"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 max-w-2xl text-sm text-muted",
					children: [
						"Base URL ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "font-mono text-accent",
							children: "https://api.mangools.com/v3"
						}),
						". Header ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "font-mono text-accent",
							children: "X-Access-Token"
						}),
						". Every endpoint the workbook implements, plus the metric dictionary."
					]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 sm:flex-row sm:items-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter endpoints",
					className: "sm:max-w-sm"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-1",
					children: GROUPS.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setGroup(g),
						className: cn("h-9 rounded-md px-3 text-sm", group === g ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
						children: g
					}, g))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 lg:grid-cols-2",
				children: list.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: e.method === "GET" ? "accent" : "warn",
									children: e.method
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "font-mono text-xs text-muted",
									children: e.path
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									className: "ml-auto",
									tone: "muted",
									children: e.sheet
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-2 font-display text-xl font-medium",
							children: e.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: e.notes
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-xs text-subtle",
							children: ["Credits: ", e.credits]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 space-y-1 text-sm",
							children: e.params.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
									className: "w-28 shrink-0 font-mono text-xs text-accent",
									children: [p.name, p.required ? "" : "?"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted",
									children: p.hint
								})]
							}, p.name))
						}),
						e.body ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
							className: "mt-3 overflow-auto rounded-lg bg-bg p-3 font-mono text-[11px] text-muted",
							children: e.body
						}) : null
					]
				}, e.method + e.path))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl font-medium",
					children: "Response fields"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 overflow-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[520px] text-left text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "text-muted",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Key"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Sheet column"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Meaning"
								})
							] })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: FIELD_MAP.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 font-mono text-xs text-accent",
									children: f.key
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2",
									children: f.label
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 text-muted",
									children: f.meaning
								})
							]
						}, f.key)) })]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-2xl bg-raised p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl font-medium",
					children: "Rate limits & credits"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2",
					children: RATE_NOTES.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "rounded-lg bg-bg/50 px-3 py-2",
						children: n
					}, n))
				})]
			})
		]
	});
}
var Code_default = "/**\n * CANOPY — Mangools × Google Sheets\n * ---------------------------------\n * Keyword research, rank tracking, list sync, and AI-agent automation\n * against the Mangools REST API (KWFinder, SERPChecker, SERPWatcher).\n *\n * Install: Extensions → Apps Script → paste this file + appsscript.json\n *          → Save → reload the spreadsheet → Canopy menu → Setup workbook.\n *\n * Auth:    Script Properties key MANGOOLS_API_KEY  (X-Access-Token)\n * Docs:    https://apidocs.mangools.com/\n * Token:   https://mangools.com/api-token\n *\n * Web app: Deploy → New deployment → Web app. Your AI agents POST JSON\n *          with { secret, action, payload } to drive this workbook.\n */\n\nvar CANOPY = {\n  BASE: 'https://api.mangools.com/v3',\n  MAX_BULK: 700,\n  SHORT_PAUSE_MS: 450,\n  MAX_RETRIES: 5,\n  EXEC_BUDGET_MS: 5 * 60 * 1000,\n  SHEETS: {\n    SETTINGS: 'Settings',\n    KEYWORDS: 'Keywords',\n    RELATED: 'Related',\n    TRACKING: 'Tracking',\n    COMPETITORS: 'Competitors',\n    GAPS: 'Gaps',\n    SERP: 'SERP',\n    LISTS: 'Lists',\n    AGENTS: 'Agents',\n    LOCATIONS: 'Locations',\n    QUOTA: 'Quota',\n    LOG: 'Log'\n  }\n};\n\n/* ------------------------------------------------------------------ */\n/*  Menu                                                              */\n/* ------------------------------------------------------------------ */\n\nfunction onOpen() {\n  SpreadsheetApp.getUi()\n    .createMenu('Canopy')\n    .addItem('Setup workbook', 'canopySetup')\n    .addItem('Save API key…', 'canopyPromptApiKey')\n    .addItem('Check quota', 'canopyRefreshQuota')\n    .addSeparator()\n    .addItem('Score selected / Keywords sheet (bulk import)', 'canopyBulkImport')\n    .addItem('Expand related keywords', 'canopyRelated')\n    .addItem('Fetch SERP + live KD', 'canopySerp')\n    .addSeparator()\n    .addItem('Competitor keywords', 'canopyCompetitorKeywords')\n    .addItem('Keyword gap analysis', 'canopyGapAnalysis')\n    .addItem('Suggested keywords for URL', 'canopySuggested')\n    .addSeparator()\n    .addItem('Refresh rank tracking', 'canopyRefreshTracking')\n    .addItem('Create tracking from Keywords', 'canopyCreateTracking')\n    .addItem('Sync KWFinder lists', 'canopySyncLists')\n    .addItem('Search locations…', 'canopySearchLocations')\n    .addSeparator()\n    .addItem('Run due agent tasks', 'canopyRunAgents')\n    .addItem('Install daily trigger', 'canopyInstallTriggers')\n    .addItem('Remove triggers', 'canopyRemoveTriggers')\n    .addToUi();\n}\n\nfunction onInstall(e) {\n  onOpen();\n}\n\n/* ------------------------------------------------------------------ */\n/*  Setup                                                             */\n/* ------------------------------------------------------------------ */\n\nfunction canopySetup() {\n  var ss = SpreadsheetApp.getActive();\n  ensureSheet_(ss, CANOPY.SHEETS.SETTINGS, [\n    ['Key', 'Value', 'Notes'],\n    ['MANGOOLS_API_KEY', getProp_('MANGOOLS_API_KEY', ''), 'Also stored in Script Properties. Never share this file.'],\n    ['DEFAULT_LOCATION_ID', getProp_('DEFAULT_LOCATION_ID', '2840'), '2840 = United States. Search via Canopy → Search locations.'],\n    ['DEFAULT_LANGUAGE_ID', getProp_('DEFAULT_LANGUAGE_ID', '1000'), '1000 = English'],\n    ['HOME_DOMAIN', getProp_('HOME_DOMAIN', ''), 'Your site for gap analysis and tracking'],\n    ['COMPETITORS', getProp_('COMPETITORS', ''), 'Comma-separated, max 5'],\n    ['TRACKING_ID', getProp_('TRACKING_ID', ''), 'SERPWatcher project id'],\n    ['PLATFORM_ID', getProp_('PLATFORM_ID', '1'), '1 desktop, 2 mobile'],\n    ['LLM_BASE_URL', getProp_('LLM_BASE_URL', 'https://api.x.ai/v1'), 'OpenAI-compatible chat endpoint'],\n    ['LLM_API_KEY', getProp_('LLM_API_KEY', ''), 'Optional. Used by Brief / Scout agents.'],\n    ['LLM_MODEL', getProp_('LLM_MODEL', 'grok-4.5'), 'Model id'],\n    ['WEBHOOK_SECRET', getProp_('WEBHOOK_SECRET', randomSecret_()), 'Required for doPost agent automation'],\n    ['DAILY_HOUR', getProp_('DAILY_HOUR', '6'), 'Hour (spreadsheet timezone) for Watch trigger']\n  ]);\n  ensureSheet_(ss, CANOPY.SHEETS.KEYWORDS, [[\n    'Seed', 'Keyword', 'Location ID', 'Language ID', 'Volume', 'KD', 'CPC', 'PPC',\n    'Opportunity', 'Status', 'Last fetched', 'Keyword ID', 'Notes', 'Agent'\n  ]]);\n  ensureSheet_(ss, CANOPY.SHEETS.RELATED, [[\n    'Seed', 'Keyword', 'Location ID', 'Volume', 'KD', 'CPC', 'PPC', 'Opportunity',\n    'Keyword ID', 'Fetched'\n  ]]);\n  ensureSheet_(ss, CANOPY.SHEETS.TRACKING, [[\n    'Tracking ID', 'Domain', 'Keyword', 'Location ID', 'Device', 'Rank', 'Prev',\n    'Change', 'Best', 'Visits', 'Volume', 'URL', 'Last check'\n  ]]);\n  ensureSheet_(ss, CANOPY.SHEETS.COMPETITORS, [[\n    'Domain', 'Keyword', 'Volume', 'KD', 'CPC', 'PPC', 'Position', 'Keyword ID'\n  ]]);\n  ensureSheet_(ss, CANOPY.SHEETS.GAPS, [[\n    'Keyword', 'Volume', 'CPC', 'Your position', 'Competitor', 'Competitor position'\n  ]]);\n  ensureSheet_(ss, CANOPY.SHEETS.SERP, [[\n    'Keyword', 'Position', 'URL', 'Title', 'Domain', 'KD', 'SERP features', 'Fetched'\n  ]]);\n  ensureSheet_(ss, CANOPY.SHEETS.LISTS, [['List ID', 'Name', 'Keywords', 'Updated']]);\n  ensureSheet_(ss, CANOPY.SHEETS.AGENTS, [\n    ['Agent', 'Action', 'Input', 'Status', 'Output', 'Last run', 'Auto'],\n    ['Scout', 'seeds', 'waterproof field notebook for hikers', 'idle', '', '', 'FALSE'],\n    ['Expander', 'related', 'Keywords!B2:B', 'idle', '', '', 'TRUE'],\n    ['Assessor', 'bulk', 'Keywords!B2:B', 'idle', '', '', 'TRUE'],\n    ['Rival', 'gap', '', 'idle', '', '', 'FALSE'],\n    ['Watch', 'track', '', 'idle', '', '', 'TRUE'],\n    ['Brief', 'brief', 'Keywords!B2', 'idle', '', '', 'FALSE']\n  ]);\n  ensureSheet_(ss, CANOPY.SHEETS.LOCATIONS, [['ID', 'Label', 'Country', 'Type', 'Google domain']]);\n  ensureSheet_(ss, CANOPY.SHEETS.QUOTA, [['Resource', 'Limit', 'Remaining', 'Reset (s)', 'Checked']]);\n  ensureSheet_(ss, CANOPY.SHEETS.LOG, [['When', 'Level', 'Action', 'Detail', 'HTTP', 'Credits']]);\n\n  syncSettingsToProps_();\n  styleWorkbook_(ss);\n  canopyRefreshQuota();\n  ss.toast('Canopy workbook is ready. Add your API key if you have not.', 'Canopy', 6);\n}\n\nfunction canopyPromptApiKey() {\n  var ui = SpreadsheetApp.getUi();\n  var res = ui.prompt(\n    'Mangools API key',\n    'Paste the token from mangools.com/api-token. It is stored in Script Properties, not in cells, after save.',\n    ui.ButtonSet.OK_CANCEL\n  );\n  if (res.getSelectedButton() !== ui.Button.OK) return;\n  var key = res.getResponseText().trim();\n  if (!key) return;\n  setProp_('MANGOOLS_API_KEY', key);\n  writeSetting_('MANGOOLS_API_KEY', '(stored in Script Properties)');\n  canopyRefreshQuota();\n  SpreadsheetApp.getActive().toast('API key saved.', 'Canopy', 4);\n}\n\n/* ------------------------------------------------------------------ */\n/*  HTTP client                                                       */\n/* ------------------------------------------------------------------ */\n\nfunction mangoolsFetch_(path, opt) {\n  opt = opt || {};\n  var key = getApiKey_();\n  var url = CANOPY.BASE + path;\n  if (opt.query) url += (url.indexOf('?') === -1 ? '?' : '&') + toQuery_(opt.query);\n  var method = (opt.method || 'get').toUpperCase();\n  var payload = opt.body ? JSON.stringify(opt.body) : null;\n  var attempt = 0;\n  var wait = 600;\n\n  while (true) {\n    attempt++;\n    var params = {\n      method: method,\n      muteHttpExceptions: true,\n      followRedirects: true,\n      headers: {\n        'X-Access-Token': key,\n        'Accept': 'application/json'\n      }\n    };\n    if (payload) {\n      params.contentType = 'application/json';\n      params.payload = payload;\n    }\n    var res = UrlFetchApp.fetch(url, params);\n    var code = res.getResponseCode();\n    var text = res.getContentText();\n    if (code === 429 && attempt <= CANOPY.MAX_RETRIES) {\n      log_('warn', path, '429 Too Many Requests — backing off ' + wait + 'ms', code, 0);\n      Utilities.sleep(wait);\n      wait = Math.min(wait * 2, 8000);\n      continue;\n    }\n    if (code >= 500 && attempt <= CANOPY.MAX_RETRIES) {\n      Utilities.sleep(wait);\n      wait = Math.min(wait * 2, 8000);\n      continue;\n    }\n    var json = {};\n    try { json = text ? JSON.parse(text) : {}; } catch (err) { json = { raw: text }; }\n    if (code >= 400) {\n      var msg = (json && (json.message || json.error || json.detail)) || text.slice(0, 400);\n      log_('error', path, msg, code, 0);\n      throw new Error('Mangools ' + code + ' on ' + method + ' ' + path + ': ' + msg);\n    }\n    log_('info', path, method + ' ok', code, opt.credits || 0);\n    return json;\n  }\n}\n\nfunction toQuery_(obj) {\n  var parts = [];\n  Object.keys(obj).forEach(function (k) {\n    if (obj[k] === undefined || obj[k] === null || obj[k] === '') return;\n    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));\n  });\n  return parts.join('&');\n}\n\nfunction getApiKey_() {\n  syncSettingsToProps_();\n  var key = getProp_('MANGOOLS_API_KEY', '');\n  if (!key || key.indexOf('stored') !== -1) {\n    throw new Error('Set MANGOOLS_API_KEY via Canopy → Save API key.');\n  }\n  return key;\n}\n\n/* ------------------------------------------------------------------ */\n/*  Keyword research                                                  */\n/* ------------------------------------------------------------------ */\n\nfunction canopyBulkImport() {\n  var ss = SpreadsheetApp.getActive();\n  var sheet = ss.getSheetByName(CANOPY.SHEETS.KEYWORDS);\n  var rows = readObjects_(sheet);\n  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));\n  var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));\n  var selected = getSelectedKeywords_(sheet, rows, 1);\n  if (!selected.length) throw new Error('Select keyword cells in column B, or fill the Keywords sheet.');\n  var chunks = chunk_(unique_(selected), CANOPY.MAX_BULK);\n  var started = Date.now();\n  var written = 0;\n  chunks.forEach(function (keywords, i) {\n    if (Date.now() - started > CANOPY.EXEC_BUDGET_MS) {\n      log_('warn', 'keyword-imports', 'Stopped to stay under the 6-minute Apps Script cap. Re-run to continue.', 0, 0);\n      return;\n    }\n    var data = mangoolsFetch_('/kwfinder/keyword-imports', {\n      method: 'post',\n      body: { keywords: keywords, location_id: loc, language_id: lang },\n      credits: 1\n    });\n    written += upsertKeywordMetrics_(sheet, rows, data.keywords || [], loc, lang, 'Assessor');\n    if (i < chunks.length - 1) Utilities.sleep(CANOPY.SHORT_PAUSE_MS);\n  });\n  ss.toast('Scored ' + written + ' keywords.', 'Canopy', 5);\n}\n\nfunction canopyRelated() {\n  var ss = SpreadsheetApp.getActive();\n  var seed = getActiveKeyword_() || getSetting_('LAST_SEED', '');\n  if (!seed) {\n    var ui = SpreadsheetApp.getUi();\n    var res = ui.prompt('Related keywords', 'Seed keyword:', ui.ButtonSet.OK_CANCEL);\n    if (res.getSelectedButton() !== ui.Button.OK) return;\n    seed = res.getResponseText().trim();\n  }\n  if (!seed) return;\n  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));\n  var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));\n  var data = mangoolsFetch_('/kwfinder/related-keywords', {\n    query: { kw: seed, location_id: loc, language_id: lang },\n    credits: 1\n  });\n  var out = ss.getSheetByName(CANOPY.SHEETS.RELATED);\n  var values = (data.keywords || []).map(function (k) {\n    return [\n      seed,\n      k.kw,\n      k.lid || loc,\n      num_(k.sv),\n      k.seo == null ? '' : num_(k.seo),\n      num_(k.cpc),\n      num_(k.ppc),\n      opportunity_(num_(k.sv), k.seo, num_(k.ppc)),\n      k._id || '',\n      new Date()\n    ];\n  });\n  writeBelowHeader_(out, values, true);\n  setProp_('LAST_SEED', seed);\n  ss.toast((values.length) + ' related keywords for \"' + seed + '\".', 'Canopy', 5);\n}\n\nfunction canopySerp() {\n  var kw = getActiveKeyword_();\n  if (!kw) throw new Error('Select a keyword cell first.');\n  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));\n  var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));\n  var data = mangoolsFetch_('/serpchecker/serps', {\n    query: { kw: kw, location_id: loc, language_id: lang },\n    credits: 1\n  });\n  var items = data.organic || data.results || data.serps || data.items || [];\n  var kd = data.seo || data.kd || (data.keyword && data.keyword.seo) || '';\n  var features = serializeFeatures_(data);\n  var rows = items.map(function (item, i) {\n    return [\n      kw,\n      item.position || item.pos || (i + 1),\n      item.url || item.link || '',\n      item.title || '',\n      item.domain || host_(item.url || item.link || ''),\n      kd,\n      features,\n      new Date()\n    ];\n  });\n  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.SERP), rows, true);\n  patchKeywordKd_(kw, kd);\n  SpreadsheetApp.getActive().toast('SERP stored (' + rows.length + ' URLs). KD=' + kd, 'Canopy', 5);\n}\n\nfunction canopySuggested() {\n  var domain = getSetting_('HOME_DOMAIN', '');\n  if (!domain) throw new Error('Set HOME_DOMAIN on the Settings sheet.');\n  var data = mangoolsFetch_('/kwfinder/suggested-keywords', {\n    query: { url: domain },\n    credits: 1\n  });\n  var kws = (data.keywords || data.items || []).map(function (k) { return k.kw || k.keyword || k; });\n  appendSeeds_(kws, 'suggested');\n  SpreadsheetApp.getActive().toast('Suggested ' + kws.length + ' keywords for ' + domain, 'Canopy', 5);\n}\n\n/* ------------------------------------------------------------------ */\n/*  Competitors & gaps                                                */\n/* ------------------------------------------------------------------ */\n\nfunction canopyCompetitorKeywords() {\n  var ui = SpreadsheetApp.getUi();\n  var res = ui.prompt('Competitor keywords', 'Domain, subdomain, or URL:', ui.ButtonSet.OK_CANCEL);\n  if (res.getSelectedButton() !== ui.Button.OK) return;\n  var url = res.getResponseText().trim();\n  if (!url) return;\n  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));\n  var data = mangoolsFetch_('/kwfinder/competitor-keywords', {\n    query: { url: url, location_id: loc },\n    credits: 1\n  });\n  var rows = (data.keywords || []).map(function (k) {\n    return [\n      url,\n      k.kw,\n      num_(k.sv),\n      k.seo == null ? '' : num_(k.seo),\n      num_(k.cpc),\n      num_(k.ppc),\n      (k.h && k.h[0] && k.h[0][2]) || '',\n      k._id || ''\n    ];\n  });\n  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.COMPETITORS), rows, true);\n  SpreadsheetApp.getActive().toast(rows.length + ' competitor keywords for ' + url, 'Canopy', 5);\n}\n\nfunction canopyGapAnalysis() {\n  var domain = getSetting_('HOME_DOMAIN', '');\n  var comps = getSetting_('COMPETITORS', '')\n    .split(',')\n    .map(function (s) { return s.trim(); })\n    .filter(Boolean)\n    .slice(0, 5);\n  if (!domain) throw new Error('Set HOME_DOMAIN on Settings.');\n  if (!comps.length) throw new Error('Set COMPETITORS on Settings (comma-separated, max 5).');\n  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));\n  var data = mangoolsFetch_('/kwfinder/gap-analysis', {\n    method: 'post',\n    body: { domain: domain, competitors: comps, location_id: loc },\n    credits: 1\n  });\n  var rows = [];\n  (data.results || []).forEach(function (block) {\n    (block.items || []).forEach(function (item) {\n      rows.push([\n        item.keyword || item.kw,\n        num_(item.search_volume || item.sv),\n        num_(item.cpc),\n        item.your_position == null ? '' : item.your_position,\n        block.domain || item.competitor || '',\n        item.competitor_position || ''\n      ]);\n    });\n  });\n  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.GAPS), rows, true);\n  SpreadsheetApp.getActive().toast(rows.length + ' gap keywords.', 'Canopy', 5);\n}\n\n/* ------------------------------------------------------------------ */\n/*  Rank tracking                                                     */\n/* ------------------------------------------------------------------ */\n\nfunction canopyRefreshTracking() {\n  var id = getSetting_('TRACKING_ID', '');\n  if (!id) {\n    var trackings = mangoolsFetch_('/serpwatcher/trackings');\n    var list = trackings.trackings || trackings.items || trackings || [];\n    if (!Array.isArray(list) || !list.length) throw new Error('No SERPWatcher trackings. Create one first.');\n    id = list[0]._id || list[0].id;\n    writeSetting_('TRACKING_ID', id);\n  }\n  var detail = mangoolsFetch_('/serpwatcher/trackings/' + encodeURIComponent(id) + '/detail');\n  var stats = mangoolsFetch_('/serpwatcher/trackings/' + encodeURIComponent(id) + '/stats', { method: 'post', body: {} });\n  var domain = (detail.domain || getSetting_('HOME_DOMAIN', ''));\n  var loc = detail.location_id || getSetting_('DEFAULT_LOCATION_ID', '');\n  var device = Number(detail.platform_id || getSetting_('PLATFORM_ID', 1)) === 2 ? 'mobile' : 'desktop';\n  var byKw = indexBy_(stats.keywords || stats.items || [], function (k) { return (k.kw || k.keyword || '').toLowerCase(); });\n  var rows = (detail.keywords || detail.tracked_keywords || stats.keywords || []).map(function (k) {\n    var kw = k.kw || k.keyword;\n    var s = byKw[(kw || '').toLowerCase()] || k;\n    var rank = firstNum_(s.rank, s.position, s.current_rank);\n    var prev = firstNum_(s.prev, s.previous_rank, s.rank_previous);\n    var change = (rank != null && prev != null) ? (prev - rank) : '';\n    return [\n      id,\n      domain,\n      kw,\n      loc,\n      device,\n      rank == null ? '' : rank,\n      prev == null ? '' : prev,\n      change,\n      firstNum_(s.best, s.best_rank, '') || '',\n      num_(s.visits || s.estimated_visits),\n      num_(s.sv || s.search_volume),\n      s.url || s.ranking_url || '',\n      new Date()\n    ];\n  });\n  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.TRACKING), rows, true);\n  SpreadsheetApp.getActive().toast('Tracking refreshed (' + rows.length + ' keywords).', 'Canopy', 5);\n}\n\nfunction canopyCreateTracking() {\n  var domain = getSetting_('HOME_DOMAIN', '');\n  if (!domain) throw new Error('Set HOME_DOMAIN on Settings.');\n  var sheet = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.KEYWORDS);\n  var kws = unique_(readObjects_(sheet).map(function (r) { return r.Keyword; }).filter(Boolean)).slice(0, 50);\n  if (!kws.length) throw new Error('Add keywords before creating a tracking.');\n  var body = {\n    domain: domain,\n    location_id: Number(getSetting_('DEFAULT_LOCATION_ID', 2840)),\n    platform_id: Number(getSetting_('PLATFORM_ID', 1)),\n    keywords: kws\n  };\n  var data = mangoolsFetch_('/serpwatcher/trackings', { method: 'post', body: body, credits: kws.length });\n  var id = data._id || data.id || (data.tracking && (data.tracking._id || data.tracking.id));\n  if (id) writeSetting_('TRACKING_ID', id);\n  SpreadsheetApp.getActive().toast('Tracking created' + (id ? ': ' + id : ''), 'Canopy', 6);\n}\n\n/* ------------------------------------------------------------------ */\n/*  Lists, locations, quota                                           */\n/* ------------------------------------------------------------------ */\n\nfunction canopySyncLists() {\n  var data = mangoolsFetch_('/kwfinder/lists');\n  var lists = data.lists || data.items || data || [];\n  var rows = (Array.isArray(lists) ? lists : []).map(function (l) {\n    return [l._id || l.id, l.name || l.title, l.count || (l.keywords && l.keywords.length) || '', new Date()];\n  });\n  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.LISTS), rows, true);\n  SpreadsheetApp.getActive().toast(rows.length + ' lists synced.', 'Canopy', 4);\n}\n\nfunction canopySearchLocations() {\n  var ui = SpreadsheetApp.getUi();\n  var res = ui.prompt('Locations', 'City, region, or country:', ui.ButtonSet.OK_CANCEL);\n  if (res.getSelectedButton() !== ui.Button.OK) return;\n  var q = res.getResponseText().trim();\n  if (!q) return;\n  var data = mangoolsFetch_('/mangools/locations', { query: { query: q } });\n  var items = data.locations || data.items || data || [];\n  var rows = (Array.isArray(items) ? items : []).map(function (l) {\n    return [l._id || l.id, l.label || l.name || l.canonical_name, l.country_code || l.code, l.type || '', l.google_domain || ''];\n  });\n  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.LOCATIONS), rows, true);\n  SpreadsheetApp.getActive().toast(rows.length + ' locations. Copy an ID into DEFAULT_LOCATION_ID.', 'Canopy', 6);\n}\n\nfunction canopyRefreshQuota() {\n  var data = mangoolsFetch_('/kwfinder/limits');\n  var now = new Date();\n  var rows = [];\n  Object.keys(data).forEach(function (k) {\n    var v = data[k];\n    if (v && typeof v === 'object' && 'limit' in v) {\n      rows.push([k, v.limit, v.remaining, v.reset, now]);\n    }\n  });\n  if (data.resources && data.resources.limit != null) {\n    rows.unshift(['keyword lookups (resources)', data.resources.limit, data.resources.remaining, data.resources.reset, now]);\n  }\n  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.QUOTA), rows, true);\n}\n\n/* ------------------------------------------------------------------ */\n/*  Custom functions (use in cells)                                   */\n/* ------------------------------------------------------------------ */\n\n/**\n * Average monthly search volume for a keyword.\n * @param {string} keyword\n * @param {number} location_id Optional. Default from Settings.\n * @param {number} language_id Optional.\n * @return {number}\n * @customfunction\n */\nfunction MANGOOLS_VOLUME(keyword, location_id, language_id) {\n  var k = fetchOne_(keyword, location_id, language_id);\n  return num_(k.sv);\n}\n\n/**\n * Keyword difficulty (cached). Empty if Mangools has not computed KD yet —\n * run Canopy → Fetch SERP + live KD to recompute.\n * @param {string} keyword\n * @customfunction\n */\nfunction MANGOOLS_KD(keyword, location_id, language_id) {\n  var k = fetchOne_(keyword, location_id, language_id);\n  return k.seo == null ? '' : num_(k.seo);\n}\n\n/**\n * Cost per click.\n * @param {string} keyword\n * @customfunction\n */\nfunction MANGOOLS_CPC(keyword, location_id, language_id) {\n  var k = fetchOne_(keyword, location_id, language_id);\n  return num_(k.cpc);\n}\n\n/**\n * PPC competition 0–100.\n * @param {string} keyword\n * @customfunction\n */\nfunction MANGOOLS_PPC(keyword, location_id, language_id) {\n  var k = fetchOne_(keyword, location_id, language_id);\n  return num_(k.ppc);\n}\n\n/**\n * Opportunity score: volume / (KD+8) × (1 − 0.45·PPC).\n * @param {string} keyword\n * @customfunction\n */\nfunction MANGOOLS_SCORE(keyword, location_id, language_id) {\n  var k = fetchOne_(keyword, location_id, language_id);\n  return opportunity_(num_(k.sv), k.seo, num_(k.ppc));\n}\n\nfunction fetchOne_(keyword, location_id, language_id) {\n  if (!keyword) return {};\n  var loc = Number(location_id || getSetting_('DEFAULT_LOCATION_ID', 2840));\n  var lang = Number(language_id || getSetting_('DEFAULT_LANGUAGE_ID', 1000));\n  var cache = CacheService.getDocumentCache();\n  var ck = 'kw_' + loc + '_' + lang + '_' + String(keyword).toLowerCase();\n  var hit = cache.get(ck);\n  if (hit) return JSON.parse(hit);\n  var data = mangoolsFetch_('/kwfinder/keyword-imports', {\n    method: 'post',\n    body: { keywords: [String(keyword)], location_id: loc, language_id: lang },\n    credits: 1\n  });\n  var k = (data.keywords && data.keywords[0]) || {};\n  cache.put(ck, JSON.stringify(k), 21600);\n  return k;\n}\n\n/* ------------------------------------------------------------------ */\n/*  Triggers                                                          */\n/* ------------------------------------------------------------------ */\n\nfunction canopyInstallTriggers() {\n  canopyRemoveTriggers();\n  var hour = Number(getSetting_('DAILY_HOUR', 6));\n  ScriptApp.newTrigger('canopyDailyJob').timeBased().atHour(hour).everyDays(1).create();\n  SpreadsheetApp.getActive().toast('Daily trigger installed at hour ' + hour + '.', 'Canopy', 5);\n}\n\nfunction canopyRemoveTriggers() {\n  ScriptApp.getProjectTriggers().forEach(function (t) {\n    var h = t.getHandlerFunction();\n    if (h === 'canopyDailyJob' || h === 'canopyRunAgents') ScriptApp.deleteTrigger(t);\n  });\n}\n\nfunction canopyDailyJob() {\n  var lock = LockService.getScriptLock();\n  if (!lock.tryLock(10000)) return;\n  try {\n    canopyRefreshQuota();\n    try { canopyRefreshTracking(); } catch (e) { log_('warn', 'daily.track', e.message, 0, 0); }\n    canopyRunAgents(true);\n  } finally {\n    lock.releaseLock();\n  }\n}\n\n/* ------------------------------------------------------------------ */\n/*  Agents                                                            */\n/* ------------------------------------------------------------------ */\n\nfunction canopyRunAgents(autoOnly) {\n  var sheet = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.AGENTS);\n  if (!sheet) return;\n  var rows = readObjects_(sheet);\n  rows.forEach(function (row, i) {\n    if (autoOnly && String(row.Auto).toUpperCase() !== 'TRUE') return;\n    var status = String(row.Status || 'idle').toLowerCase();\n    if (status === 'skip' || status === 'done') return;\n    var agent = String(row.Agent || '').toLowerCase();\n    var action = String(row.Action || agent).toLowerCase();\n    var input = String(row.Input || '');\n    try {\n      var output = runAgentTask_(agent, action, input);\n      sheet.getRange(i + 2, 4, 1, 3).setValues([['ok', String(output).slice(0, 400), new Date()]]);\n    } catch (err) {\n      sheet.getRange(i + 2, 4, 1, 3).setValues([['error', err.message.slice(0, 400), new Date()]]);\n    }\n  });\n}\n\nfunction runAgentTask_(agent, action, input) {\n  if (action === 'related' || agent === 'expander') {\n    if (input.indexOf('!') !== -1) {\n      var seeds = flattenRange_(input);\n      seeds.slice(0, 5).forEach(function (s, idx) {\n        SpreadsheetApp.getActive().setActiveRange(\n          SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.KEYWORDS).getRange('B2')\n        );\n        setProp_('LAST_SEED', s);\n        if (idx) Utilities.sleep(CANOPY.SHORT_PAUSE_MS);\n        var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));\n        var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));\n        mangoolsFetch_('/kwfinder/related-keywords', {\n          query: { kw: s, location_id: loc, language_id: lang },\n          credits: 1\n        });\n      });\n      return 'Expanded ' + Math.min(5, seeds.length) + ' seeds';\n    }\n    setProp_('LAST_SEED', input);\n    canopyRelated();\n    return 'related ' + input;\n  }\n  if (action === 'bulk' || agent === 'assessor') {\n    canopyBulkImport();\n    return 'bulk scored';\n  }\n  if (action === 'gap' || agent === 'rival') {\n    canopyGapAnalysis();\n    return 'gap analysis';\n  }\n  if (action === 'track' || agent === 'watch') {\n    canopyRefreshTracking();\n    return 'tracking refreshed';\n  }\n  if (action === 'seeds' || agent === 'scout' || action === 'brief' || agent === 'brief') {\n    return llmAgent_(agent || action, input);\n  }\n  throw new Error('Unknown agent action: ' + action);\n}\n\nfunction llmAgent_(role, input) {\n  var key = getSetting_('LLM_API_KEY', '');\n  if (!key) {\n    if (role === 'scout' || role === 'seeds') {\n      var guesses = String(input).split(/[,\\n]/).map(function (s) { return s.trim(); }).filter(Boolean);\n      appendSeeds_(guesses, 'Scout');\n      return 'Queued ' + guesses.length + ' seeds (no LLM key; used input as list)';\n    }\n    return 'No LLM_API_KEY set — skipped ' + role;\n  }\n  var base = getSetting_('LLM_BASE_URL', 'https://api.x.ai/v1').replace(/\\/$/, '');\n  var model = getSetting_('LLM_MODEL', 'grok-4.5');\n  var system = role === 'brief' || role === 'Brief'\n    ? 'You write concise SEO content briefs. Return markdown: search intent, outline (H2s), questions to answer, internal links, and a title. 250 words max.'\n    : 'You are an SEO keyword researcher. Return 15 seed keywords as a JSON array of strings. No commentary.';\n  var res = UrlFetchApp.fetch(base + '/chat/completions', {\n    method: 'post',\n    contentType: 'application/json',\n    muteHttpExceptions: true,\n    headers: { Authorization: 'Bearer ' + key },\n    payload: JSON.stringify({\n      model: model,\n      temperature: 0.4,\n      max_tokens: 700,\n      messages: [\n        { role: 'system', content: system },\n        { role: 'user', content: String(input) }\n      ]\n    })\n  });\n  if (res.getResponseCode() >= 400) throw new Error('LLM ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 240));\n  var body = JSON.parse(res.getContentText());\n  var text = (((body.choices || [])[0] || {}).message || {}).content || '';\n  if (role === 'scout' || role === 'seeds') {\n    var seeds = parseJsonArray_(text);\n    appendSeeds_(seeds, 'Scout');\n    return 'Scout added ' + seeds.length + ' seeds';\n  }\n  return text.slice(0, 500);\n}\n\n/* ------------------------------------------------------------------ */\n/*  Web app API — for Cursor, Claude, custom agents                   */\n/* ------------------------------------------------------------------ */\n\nfunction doGet(e) {\n  return jsonOut_({ ok: true, service: 'canopy', hint: 'POST JSON { secret, action, payload }' });\n}\n\nfunction doPost(e) {\n  var body = {};\n  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) {\n    return jsonOut_({ ok: false, error: 'invalid json' }, 400);\n  }\n  var secret = getSetting_('WEBHOOK_SECRET', '');\n  if (!secret || body.secret !== secret) return jsonOut_({ ok: false, error: 'unauthorized' }, 401);\n  var action = String(body.action || '');\n  var payload = body.payload || {};\n  try {\n    var result = dispatchAction_(action, payload);\n    return jsonOut_({ ok: true, action: action, result: result });\n  } catch (err) {\n    return jsonOut_({ ok: false, action: action, error: err.message });\n  }\n}\n\nfunction dispatchAction_(action, payload) {\n  switch (action) {\n    case 'quota':\n      canopyRefreshQuota();\n      return readObjects_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.QUOTA)).slice(0, 20);\n    case 'read':\n      return readObjects_(SpreadsheetApp.getActive().getSheetByName(payload.sheet || CANOPY.SHEETS.KEYWORDS)).slice(0, payload.limit || 200);\n    case 'write':\n      appendSeeds_(payload.keywords || [], payload.agent || 'api');\n      return { added: (payload.keywords || []).length };\n    case 'related':\n      setProp_('LAST_SEED', payload.keyword || payload.kw);\n      canopyRelated();\n      return { seed: payload.keyword || payload.kw };\n    case 'bulk':\n      if (payload.keywords) appendSeeds_(payload.keywords, 'api');\n      canopyBulkImport();\n      return { ok: true };\n    case 'competitor':\n      if (payload.url) {\n        var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));\n        return mangoolsFetch_('/kwfinder/competitor-keywords', { query: { url: payload.url, location_id: loc }, credits: 1 });\n      }\n      throw new Error('payload.url required');\n    case 'gap':\n      canopyGapAnalysis();\n      return { ok: true };\n    case 'track':\n      canopyRefreshTracking();\n      return { ok: true };\n    case 'agent':\n      return runAgentTask_(payload.agent || '', payload.action || payload.agent || '', payload.input || '');\n    case 'setting':\n      if (!payload.key) throw new Error('payload.key required');\n      writeSetting_(payload.key, String(payload.value || ''));\n      return { key: payload.key };\n    default:\n      throw new Error('Unknown action. Use quota|read|write|related|bulk|competitor|gap|track|agent|setting');\n  }\n}\n\nfunction jsonOut_(obj) {\n  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);\n}\n\n/* ------------------------------------------------------------------ */\n/*  Sheet helpers                                                     */\n/* ------------------------------------------------------------------ */\n\nfunction ensureSheet_(ss, name, headerAndSeed) {\n  var sh = ss.getSheetByName(name);\n  if (!sh) sh = ss.insertSheet(name);\n  if (sh.getLastRow() === 0 && headerAndSeed && headerAndSeed.length) {\n    sh.getRange(1, 1, headerAndSeed.length, headerAndSeed[0].length).setValues(headerAndSeed);\n  } else if (headerAndSeed && headerAndSeed[0] && sh.getRange(1, 1).getValue() === '') {\n    sh.getRange(1, 1, 1, headerAndSeed[0].length).setValues([headerAndSeed[0]]);\n  }\n  return sh;\n}\n\nfunction styleWorkbook_(ss) {\n  var names = Object.keys(CANOPY.SHEETS).map(function (k) { return CANOPY.SHEETS[k]; });\n  names.forEach(function (name) {\n    var sh = ss.getSheetByName(name);\n    if (!sh) return;\n    var lastCol = Math.max(sh.getLastColumn(), 1);\n    sh.setFrozenRows(1);\n    sh.getRange(1, 1, 1, lastCol)\n      .setFontFamily('Google Sans')\n      .setFontWeight('bold')\n      .setBackground('#1c1914')\n      .setFontColor('#f3f0e7');\n    sh.setRowHeight(1, 28);\n  });\n}\n\nfunction writeBelowHeader_(sheet, values, clear) {\n  if (clear && sheet.getLastRow() > 1) {\n    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();\n  }\n  if (!values.length) return;\n  sheet.getRange(2, 1, values.length, values[0].length).setValues(values);\n}\n\nfunction readObjects_(sheet) {\n  var data = sheet.getDataRange().getValues();\n  if (data.length < 2) return [];\n  var headers = data[0].map(function (h) { return String(h).trim(); });\n  var out = [];\n  for (var i = 1; i < data.length; i++) {\n    var obj = { _row: i + 1 };\n    var empty = true;\n    headers.forEach(function (h, c) {\n      obj[h] = data[i][c];\n      if (data[i][c] !== '' && data[i][c] != null) empty = false;\n    });\n    if (!empty) out.push(obj);\n  }\n  return out;\n}\n\nfunction getSelectedKeywords_(sheet, rows, colIndex) {\n  var range = SpreadsheetApp.getActiveRange();\n  var picked = [];\n  if (range && range.getSheet().getName() === sheet.getName()) {\n    range.getValues().forEach(function (r) {\n      r.forEach(function (v) { if (v) picked.push(String(v).trim()); });\n    });\n  }\n  if (picked.length) return picked.filter(function (v) { return v && v !== 'Keyword' && v !== 'Seed'; });\n  return rows.map(function (r) { return String(r.Keyword || r.Seed || '').trim(); }).filter(Boolean);\n}\n\nfunction getActiveKeyword_() {\n  var v = SpreadsheetApp.getActiveRange() && SpreadsheetApp.getActiveRange().getValue();\n  if (v && typeof v !== 'object') return String(v).trim();\n  return '';\n}\n\nfunction upsertKeywordMetrics_(sheet, existing, keywords, loc, lang, agent) {\n  var byKw = {};\n  existing.forEach(function (r) { byKw[String(r.Keyword).toLowerCase()] = r; });\n  var writes = 0;\n  keywords.forEach(function (k) {\n    var key = String(k.kw || '').toLowerCase();\n    if (!key) return;\n    var opp = opportunity_(num_(k.sv), k.seo, num_(k.ppc));\n    var line = [\n      (byKw[key] && byKw[key].Seed) || k.kw,\n      k.kw,\n      k.lid || loc,\n      lang,\n      num_(k.sv),\n      k.seo == null ? '' : num_(k.seo),\n      num_(k.cpc),\n      num_(k.ppc),\n      opp,\n      (byKw[key] && byKw[key].Status) || 'new',\n      new Date(),\n      k._id || '',\n      (byKw[key] && byKw[key].Notes) || '',\n      agent\n    ];\n    if (byKw[key]) {\n      sheet.getRange(byKw[key]._row, 1, 1, line.length).setValues([line]);\n    } else {\n      sheet.appendRow(line);\n    }\n    writes++;\n  });\n  return writes;\n}\n\nfunction appendSeeds_(keywords, agent) {\n  var sheet = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.KEYWORDS);\n  var have = {};\n  readObjects_(sheet).forEach(function (r) { have[String(r.Keyword).toLowerCase()] = true; });\n  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));\n  var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));\n  keywords.forEach(function (kw) {\n    kw = String(kw || '').trim();\n    if (!kw || have[kw.toLowerCase()]) return;\n    sheet.appendRow([kw, kw, loc, lang, '', '', '', '', '', 'new', '', '', 'Added by ' + agent, agent]);\n    have[kw.toLowerCase()] = true;\n  });\n}\n\nfunction patchKeywordKd_(kw, kd) {\n  if (kd === '' || kd == null) return;\n  var sheet = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.KEYWORDS);\n  readObjects_(sheet).forEach(function (r) {\n    if (String(r.Keyword).toLowerCase() === String(kw).toLowerCase()) {\n      sheet.getRange(r._row, 6).setValue(kd);\n    }\n  });\n}\n\nfunction getSetting_(key, fallback) {\n  var sh = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.SETTINGS);\n  if (sh) {\n    var data = sh.getDataRange().getValues();\n    for (var i = 1; i < data.length; i++) {\n      if (String(data[i][0]).trim() === key) {\n        var val = String(data[i][1] == null ? '' : data[i][1]).trim();\n        if (val && val.indexOf('stored in Script') === -1) return val;\n      }\n    }\n  }\n  return getProp_(key, fallback);\n}\n\nfunction writeSetting_(key, value) {\n  setProp_(key, value);\n  var sh = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.SETTINGS);\n  if (!sh) return;\n  var data = sh.getDataRange().getValues();\n  for (var i = 1; i < data.length; i++) {\n    if (String(data[i][0]).trim() === key) {\n      sh.getRange(i + 1, 2).setValue(key === 'MANGOOLS_API_KEY' ? '(stored in Script Properties)' : value);\n      return;\n    }\n  }\n  sh.appendRow([key, value, '']);\n}\n\nfunction syncSettingsToProps_() {\n  var sh = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.SETTINGS);\n  if (!sh) return;\n  var data = sh.getDataRange().getValues();\n  for (var i = 1; i < data.length; i++) {\n    var k = String(data[i][0] || '').trim();\n    var v = String(data[i][1] == null ? '' : data[i][1]).trim();\n    if (!k || !v) continue;\n    if (k === 'MANGOOLS_API_KEY' && v.indexOf('stored') !== -1) continue;\n    setProp_(k, v);\n  }\n}\n\nfunction getProp_(k, fallback) {\n  var v = PropertiesService.getScriptProperties().getProperty(k);\n  return v == null || v === '' ? fallback : v;\n}\n\nfunction setProp_(k, v) {\n  PropertiesService.getScriptProperties().setProperty(k, String(v));\n}\n\nfunction log_(level, action, detail, http, credits) {\n  try {\n    var sh = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.LOG);\n    if (!sh) return;\n    sh.insertRowAfter(1);\n    sh.getRange(2, 1, 1, 6).setValues([[new Date(), level, action, String(detail).slice(0, 500), http || '', credits || 0]]);\n  } catch (err) {}\n}\n\nfunction opportunity_(volume, kd, ppc) {\n  var d = kd == null || kd === '' ? 45 : Number(kd);\n  var c = Math.min(100, Math.max(0, Number(ppc) || 0)) / 100;\n  var raw = (Number(volume) || 0) / (d + 8) * (1 - c * 0.45);\n  return Math.round(raw * 10) / 10;\n}\n\nfunction num_(v) {\n  if (v == null || v === '') return 0;\n  var n = Number(v);\n  return isNaN(n) ? 0 : n;\n}\n\nfunction firstNum_() {\n  for (var i = 0; i < arguments.length; i++) {\n    if (arguments[i] === '' || arguments[i] == null) continue;\n    var n = Number(arguments[i]);\n    if (!isNaN(n)) return n;\n  }\n  return null;\n}\n\nfunction unique_(arr) {\n  var seen = {};\n  var out = [];\n  arr.forEach(function (v) {\n    var k = String(v).toLowerCase();\n    if (!k || seen[k]) return;\n    seen[k] = true;\n    out.push(String(v));\n  });\n  return out;\n}\n\nfunction chunk_(arr, size) {\n  var out = [];\n  for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));\n  return out;\n}\n\nfunction indexBy_(arr, fn) {\n  var o = {};\n  (arr || []).forEach(function (x) { o[fn(x)] = x; });\n  return o;\n}\n\nfunction host_(url) {\n  try { return String(url).replace(/^https?:\\/\\//, '').split('/')[0]; } catch (e) { return ''; }\n}\n\nfunction serializeFeatures_(data) {\n  var f = data.features || data.serp_features || [];\n  if (Array.isArray(f)) return f.join(', ');\n  if (f && typeof f === 'object') return Object.keys(f).filter(function (k) { return f[k]; }).join(', ');\n  return '';\n}\n\nfunction flattenRange_(a1) {\n  try {\n    return SpreadsheetApp.getActive().getRange(a1).getValues()\n      .reduce(function (acc, r) { return acc.concat(r); }, [])\n      .map(function (v) { return String(v || '').trim(); })\n      .filter(Boolean);\n  } catch (e) {\n    return [a1];\n  }\n}\n\nfunction parseJsonArray_(text) {\n  var m = String(text).match(/\\[[\\s\\S]*\\]/);\n  if (m) {\n    try {\n      var arr = JSON.parse(m[0]);\n      if (Array.isArray(arr)) return arr.map(function (x) { return String(x); });\n    } catch (e) {}\n  }\n  return String(text).split(/\\n/).map(function (s) { return s.replace(/^[\\-\\*\\d\\.\\s]+/, '').trim(); }).filter(Boolean).slice(0, 20);\n}\n\nfunction randomSecret_() {\n  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';\n  var s = 'cnp_';\n  for (var i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));\n  return s;\n}\n";
var appsscript_default = "{\n  \"timeZone\": \"America/New_York\",\n  \"runtimeVersion\": \"V8\",\n  \"exceptionLogging\": \"STACKDRIVER\",\n  \"oauthScopes\": [\n    \"https://www.googleapis.com/auth/spreadsheets\",\n    \"https://www.googleapis.com/auth/script.scriptapp\",\n    \"https://www.googleapis.com/auth/script.external_request\",\n    \"https://www.googleapis.com/auth/script.container.ui\"\n  ],\n  \"webapp\": {\n    \"access\": \"ANYONE_ANONYMOUS\",\n    \"executeAs\": \"USER_DEPLOYING\"\n  }\n}\n";
var CODE_GS = Code_default;
var APPSSCRIPT_JSON = appsscript_default;
var FUNCTIONS = [
	{
		name: "canopySetup",
		does: "Create all sheets, headers, formatting, quota check"
	},
	{
		name: "canopyPromptApiKey",
		does: "Store X-Access-Token in Script Properties"
	},
	{
		name: "canopyBulkImport",
		does: "POST /kwfinder/keyword-imports up to 700 kws"
	},
	{
		name: "canopyRelated",
		does: "GET /kwfinder/related-keywords for the active cell"
	},
	{
		name: "canopySerp",
		does: "GET /serpchecker/serps and live KD"
	},
	{
		name: "canopyCompetitorKeywords",
		does: "GET /kwfinder/competitor-keywords"
	},
	{
		name: "canopyGapAnalysis",
		does: "POST /kwfinder/gap-analysis vs Settings competitors"
	},
	{
		name: "canopyRefreshTracking",
		does: "SERPWatcher detail + stats → Tracking tab"
	},
	{
		name: "canopyCreateTracking",
		does: "POST /serpwatcher/trackings from Keywords"
	},
	{
		name: "canopySyncLists",
		does: "GET /kwfinder/lists"
	},
	{
		name: "canopySearchLocations",
		does: "GET /mangools/locations"
	},
	{
		name: "canopyRunAgents",
		does: "Execute due rows on the Agents sheet"
	},
	{
		name: "canopyDailyJob",
		does: "Quota + ranks + auto agents (time trigger)"
	},
	{
		name: "doPost",
		does: "JSON webhook for Cursor / Claude / custom agents"
	}
];
var CUSTOM_FNS = [
	{
		sig: "=MANGOOLS_VOLUME(\"waterproof notebook\")",
		out: "Average monthly search volume"
	},
	{
		sig: "=MANGOOLS_KD(A2)",
		out: "Cached keyword difficulty (empty until SERP/KD)"
	},
	{
		sig: "=MANGOOLS_CPC(A2, 2840, 1000)",
		out: "CPC for US English"
	},
	{
		sig: "=MANGOOLS_PPC(A2)",
		out: "Paid competition 0–100"
	},
	{
		sig: "=MANGOOLS_SCORE(A2)",
		out: "Volume / (KD+8) × (1 − 0.45·PPC)"
	}
];
function ScriptStudio() {
	const [copied, setCopied] = (0, import_react.useState)(null);
	function copy(label, text) {
		navigator.clipboard.writeText(text);
		setCopied(label);
		toast.success("Copied");
		setTimeout(() => setCopied(null), 1500);
	}
	function download(name, text, type) {
		const blob = new Blob([text], { type });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = name;
		a.click();
		URL.revokeObjectURL(url);
	}
	const curl = `curl -sS -X POST "$WEBAPP_URL" \\
  -H "Content-Type: application/json" \\
  -d '{
    "secret": "YOUR_WEBHOOK_SECRET",
    "action": "related",
    "payload": { "keyword": "waterproof field notebook" }
  }'`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-widest text-muted",
				children: "Install"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight sm:text-4xl",
				children: "Apps Script"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-2xl text-sm text-muted",
				children: "One file. Paste into Extensions → Apps Script, save, reload the spreadsheet, then Canopy → Setup workbook. The script talks to api.mangools.com/v3 with X-Access-Token, retries 429s, and chunks work under the 6-minute cap."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => copy("gs", CODE_GS),
						children: [copied === "gs" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" }), "Copy Code.gs"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						onClick: () => copy("json", APPSSCRIPT_JSON),
						children: [copied === "json" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" }), "Copy appsscript.json"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "quiet",
						onClick: () => download("Code.gs", CODE_GS, "text/plain"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), "Download"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "mt-4 max-h-[min(62vh,720px)] overflow-auto rounded-2xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-paper shadow-[var(--shadow-border)]",
				children: CODE_GS
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "grid h-fit gap-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-medium",
						children: "Menu map"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-2 text-sm",
						children: FUNCTIONS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "font-mono text-xs text-accent",
							children: f.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted",
							children: f.does
						})] }, f.name))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-medium",
						children: "Sheet formulas"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-2 text-sm",
						children: CUSTOM_FNS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "font-mono text-xs text-fg",
							children: f.sig
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted",
							children: f.out
						})] }, f.sig))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-display text-lg font-medium",
								children: "Agent webhook"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "accent",
								children: "doPost"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: "Deploy → Web app → execute as you, anyone with the link. Actions: quota, read, write, related, bulk, competitor, gap, track, agent, setting."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
							className: "mt-3 overflow-auto rounded-lg bg-bg p-3 font-mono text-[11px] text-muted",
							children: curl
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "ghost",
							className: "mt-2",
							onClick: () => copy("curl", curl),
							children: [copied === "curl" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" }), "Copy curl"]
						})
					]
				})
			]
		})]
	});
}
var jsonSchema = lazy(() => union([
	string(),
	number(),
	boolean(),
	_null(),
	array(jsonSchema),
	record(string(), jsonSchema)
]));
var RequestSchema = object({
	apiKey: string().min(8),
	method: _enum([
		"GET",
		"POST",
		"PUT",
		"PATCH",
		"DELETE"
	]).default("GET"),
	path: string().min(1),
	query: record(string(), union([string(), number()])).optional(),
	body: jsonSchema.optional()
});
var mangoolsRequest = createServerFn({ method: "POST" }).validator(RequestSchema).handler(createSsrRpc("db4438b6ba10af6a780134d542f6ebbf5864d1ed44e8cdac6b1803e487453678"));
function num(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}
function monthly(msv) {
	if (!Array.isArray(msv)) return [];
	if (msv.length && typeof msv[0] === "number" && msv.length <= 24 && msv.every((x) => typeof x === "number")) {
		if (msv.length % 3 === 0 && msv[0] > 2e3 && msv[0] < 2100) {
			const vols = [];
			for (let i = 2; i < msv.length; i += 3) vols.push(num(msv[i]));
			return vols;
		}
		return msv.map(num);
	}
	return [];
}
function mapKeywords(raw, seed, locationId, languageId, agent) {
	const list = extractKeywordList(raw);
	const now = stamp$1();
	return list.map((k, i) => {
		const keyword = String(k.kw ?? k.keyword ?? "");
		const volume = num(k.sv ?? k.search_volume);
		const kd = k.seo == null ? null : num(k.seo);
		const cpc = num(k.cpc);
		const ppc = num(k.ppc);
		return {
			id: String(k._id ?? `${keyword}-${i}`),
			seed,
			keyword,
			location: locationLabel(num(k.lid) || locationId),
			locationId: num(k.lid) || locationId,
			language: languageLabel(languageId),
			languageId,
			volume,
			msv: monthly(k.msv),
			kd,
			cpc,
			ppc,
			opportunity: opportunityScore(volume, kd, ppc),
			status: "new",
			lastFetched: now,
			keywordId: String(k._id ?? ""),
			notes: "",
			agent
		};
	});
}
function mapCompetitors(raw, domain) {
	return extractKeywordList(raw).map((k, i) => ({
		id: String(k._id ?? i),
		domain,
		keyword: String(k.kw ?? k.keyword ?? ""),
		volume: num(k.sv),
		kd: k.seo == null ? null : num(k.seo),
		cpc: num(k.cpc),
		position: Array.isArray(k.h) && Array.isArray(k.h[0]) ? num(k.h[0][2]) : null,
		visitsEst: num(k.svn)
	}));
}
function mapGaps(raw) {
	const data = raw;
	const rows = [];
	for (const block of data.results ?? []) for (const item of block.items ?? []) rows.push({
		id: `${block.domain}-${item.keyword}`,
		keyword: String(item.keyword ?? item.kw ?? ""),
		volume: num(item.search_volume ?? item.sv),
		cpc: num(item.cpc),
		yourPosition: item.your_position == null ? null : num(item.your_position),
		competitor: String(block.domain ?? item.competitor ?? ""),
		competitorPosition: num(item.competitor_position)
	});
	return rows;
}
function mapQuota(raw) {
	const data = raw;
	const resources = data.resources ?? {};
	const serps = data.serps ?? {};
	const tracked = data.tracked_keywords ?? data["tracked-keywords"] ?? {};
	return {
		lookups: {
			limit: num(resources.limit) || 500,
			remaining: num(resources.remaining) || 0
		},
		serps: {
			limit: num(serps.limit) || 500,
			remaining: num(serps.remaining) || 0
		},
		tracked: {
			limit: typeof tracked === "number" ? tracked : num(tracked.limit) || 200,
			remaining: typeof tracked === "number" ? tracked : num(tracked.remaining) || 0
		},
		resetHours: Math.max(1, Math.round(num(resources.reset) / 3600) || 12),
		live: true
	};
}
function extractKeywordList(raw) {
	if (Array.isArray(raw)) return raw;
	const data = raw;
	return data.keywords ?? data.items ?? [];
}
function stamp$1() {
	const d = /* @__PURE__ */ new Date();
	const p = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
async function call(path, init) {
	const apiKey = useCanopy.getState().settings.apiKey;
	if (!apiKey) throw new Error("Add your Mangools API key in Setup.");
	const res = await mangoolsRequest({ data: {
		apiKey,
		path,
		method: init.method ?? "GET",
		query: init.query,
		body: init.body
	} });
	if (!("ok" in res) || !res.ok) throw new Error("error" in res ? String(res.error) : "Mangools request failed");
	return res.data;
}
async function liveQuota() {
	const quota = mapQuota(await call("/kwfinder/limits", {}));
	useCanopy.getState().setQuota(quota);
	useCanopy.getState().addLog({
		at: stamp(),
		level: "info",
		action: "limits",
		detail: `${quota.lookups.remaining}/${quota.lookups.limit} lookups remaining`,
		credits: 0
	});
	return quota;
}
async function liveRelated(seed) {
	const { settings } = useCanopy.getState();
	const rows = mapKeywords(await call("/kwfinder/related-keywords", { query: {
		kw: seed,
		location_id: settings.locationId,
		language_id: settings.languageId
	} }), seed, settings.locationId, settings.languageId, "Expander");
	useCanopy.getState().setRelated(rows);
	useCanopy.getState().addLog({
		at: stamp(),
		level: "info",
		action: "related-keywords",
		detail: `seed=${seed} · ${rows.length} ideas`,
		credits: 1
	});
	return rows;
}
async function liveBulk(keywords) {
	const { settings } = useCanopy.getState();
	const unique = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))].slice(0, 700);
	if (!unique.length) throw new Error("No keywords to score.");
	const rows = mapKeywords(await call("/kwfinder/keyword-imports", {
		method: "POST",
		body: {
			keywords: unique,
			location_id: settings.locationId,
			language_id: settings.languageId
		}
	}), unique[0] ?? "", settings.locationId, settings.languageId, "Assessor");
	useCanopy.getState().mergeKeywords(rows);
	useCanopy.getState().addLog({
		at: stamp(),
		level: "info",
		action: "keyword-imports",
		detail: `${rows.length} keywords scored`,
		credits: 1
	});
	return rows;
}
async function liveCompetitor(url) {
	const { settings } = useCanopy.getState();
	const rows = mapCompetitors(await call("/kwfinder/competitor-keywords", { query: {
		url,
		location_id: settings.locationId
	} }), url);
	useCanopy.getState().setCompetitors(rows);
	useCanopy.getState().addLog({
		at: stamp(),
		level: "info",
		action: "competitor-keywords",
		detail: `${url} · ${rows.length} keywords`,
		credits: 1
	});
	return rows;
}
async function liveGap(competitors) {
	const { settings } = useCanopy.getState();
	if (!settings.domain) throw new Error("Set a home domain in Setup.");
	const list = competitors.map((s) => s.trim()).filter(Boolean).slice(0, 5);
	if (!list.length) throw new Error("Need at least one competitor.");
	const rows = mapGaps(await call("/kwfinder/gap-analysis", {
		method: "POST",
		body: {
			domain: settings.domain,
			competitors: list,
			location_id: settings.locationId
		}
	}));
	useCanopy.getState().setGaps(rows);
	useCanopy.getState().addLog({
		at: stamp(),
		level: "info",
		action: "gap-analysis",
		detail: `${settings.domain} vs ${list.join(", ")} · ${rows.length} gaps`,
		credits: 1
	});
	return rows;
}
function stamp() {
	const d = /* @__PURE__ */ new Date();
	const p = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
var STEPS = [
	{
		n: "01",
		title: "Get a Mangools token",
		body: "Create a free Mangools account and copy the key from mangools.com/api-token. Every request uses the X-Access-Token header — never put it in a URL.",
		href: "https://mangools.com/api-token",
		hrefLabel: "Open API token page"
	},
	{
		n: "02",
		title: "Paste it here to trial live calls",
		body: "Stored only in this browser. Canopy proxies lookups from the Sheet tab so you can verify credits before wiring Google."
	},
	{
		n: "03",
		title: "New Google Sheet → Apps Script",
		body: "Extensions → Apps Script. Delete the stub. Paste Code.gs. Add appsscript.json via Project settings → Show appsscript.json, then paste the manifest. Save."
	},
	{
		n: "04",
		title: "Reload and run Setup workbook",
		body: "Back in Sheets, Canopy appears in the menu. Run Setup workbook, then Save API key. Authorize UrlFetch and Spreadsheets when asked."
	},
	{
		n: "05",
		title: "Install the daily trigger",
		body: "Canopy → Install daily trigger. Watch refreshes ranks; Assessor/Expander rows with Auto=TRUE run inside the 6-minute budget."
	},
	{
		n: "06",
		title: "Point your other agents at doPost",
		body: "Deploy → New deployment → Web app. Anyone with the link + WEBHOOK_SECRET can read the sheet, expand keywords, or run a named agent. Pair with Mangools MCP in Cursor if you want the same data in chat.",
		href: "https://mangools.com/mcp",
		hrefLabel: "Mangools MCP"
	}
];
function Setup() {
	const settings = useCanopy((s) => s.settings);
	const patch = useCanopy((s) => s.patchSettings);
	const quota = useCanopy((s) => s.quota);
	const resetDemo = useCanopy((s) => s.resetDemo);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [keyDraft, setKeyDraft] = (0, import_react.useState)(settings.apiKey);
	const [done, setDone] = (0, import_react.useState)({});
	async function testKey() {
		patch({ apiKey: keyDraft.trim() });
		setBusy(true);
		try {
			const q = await liveQuota();
			toast.success(`Connected · ${q.lookups.remaining} lookups left`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not reach Mangools");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-widest text-muted",
				children: "Connect"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight sm:text-4xl",
				children: "Wire the workbook"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted",
				children: "Six steps from a blank spreadsheet to a daily Mangools pipeline your AI agents can drive."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-6 space-y-4",
				children: STEPS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex gap-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-2xl text-subtle",
						children: s.n
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-xl font-medium",
									children: s.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "size-10 shrink-0 rounded-md text-muted hover:bg-raised hover:text-accent",
									onClick: () => setDone((d) => ({
										...d,
										[s.n]: !d[s.n]
									})),
									"aria-label": done[s.n] ? "Mark incomplete" : "Mark complete",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: done[s.n] ? "mx-auto size-5 text-good" : "mx-auto size-5" })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm text-muted",
								children: s.body
							}),
							s.href ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: s.href,
								target: "_blank",
								rel: "noreferrer",
								className: "mt-2 inline-flex h-10 items-center gap-1 text-sm text-accent",
								children: [s.hrefLabel, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" })]
							}) : null
						]
					})]
				}, s.n))
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "grid h-fit gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]",
				onSubmit: (e) => {
					e.preventDefault();
					testKey();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-medium",
						children: "Mangools key"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "API token",
						hint: "Browser only. The Apps Script stores its own copy in Script Properties.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "password",
							autoComplete: "off",
							value: keyDraft,
							onChange: (e) => setKeyDraft(e.target.value),
							placeholder: "Paste X-Access-Token"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Home domain",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: settings.domain,
							onChange: (e) => patch({ domain: e.target.value }),
							placeholder: "yoursite.com"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Location",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							className: "h-10 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]",
							value: settings.locationId,
							onChange: (e) => patch({ locationId: Number(e.target.value) }),
							children: LOCATIONS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: l.id,
								children: [
									l.label,
									" (",
									l.id,
									")"
								]
							}, l.id))
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Language",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							className: "h-10 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]",
							value: settings.languageId,
							onChange: (e) => patch({ languageId: Number(e.target.value) }),
							children: LANGUAGES.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: l.id,
								children: l.label
							}, l.id))
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "submit",
						disabled: busy || keyDraft.trim().length < 8,
						children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : null, "Test quota"]
					}),
					quota.live ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-good",
						children: [
							"Live · ",
							quota.lookups.remaining,
							" lookups · ",
							quota.serps.remaining,
							" SERPs · reset ~",
							quota.resetHours,
							"h"
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Demo quota until you test a key."
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl bg-raised p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-medium",
						children: "What the sheet stores"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "mt-2 space-y-1.5 text-sm text-muted",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								className: "mr-1",
								children: "Settings"
							}), " location, domain, secrets, model"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								className: "mr-1",
								children: "Keywords"
							}), " seeds, metrics, opportunity, status"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								className: "mr-1",
								children: "Tracking"
							}), " SERPWatcher ranks and deltas"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								className: "mr-1",
								children: "Agents"
							}), " Scout → Brief playbook rows"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								className: "mr-1",
								children: "Log"
							}), " HTTP, credits, 429 backoffs"] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "quiet",
						size: "sm",
						className: "mt-3",
						onClick: () => resetDemo(),
						children: "Reset demo ledger"
					})
				]
			})]
		})]
	});
}
function Mark({ className = "size-7" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 32 32",
		className,
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				width: "32",
				height: "32",
				rx: "8",
				fill: "currentColor",
				className: "text-raised"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "17",
				r: "7.2",
				fill: "currentColor",
				className: "text-accent"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "20",
				cy: "17",
				r: "7.2",
				fill: "currentColor",
				className: "text-accent"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "16",
				cy: "12",
				r: "7.4",
				fill: "currentColor",
				className: "text-accent"
			})
		]
	});
}
var NAV = [
	{
		id: "workspace",
		label: "Sheet",
		icon: LayoutGrid
	},
	{
		id: "agents",
		label: "Agents",
		icon: Sparkles
	},
	{
		id: "script",
		label: "Apps Script",
		icon: ClipboardList
	},
	{
		id: "atlas",
		label: "API",
		icon: BookOpen
	},
	{
		id: "setup",
		label: "Setup",
		icon: KeyRound
	}
];
function Shell({ children }) {
	const view = useCanopy((s) => s.view);
	const setView = useCanopy((s) => s.setView);
	const quota = useCanopy((s) => s.quota);
	const apiKey = useCanopy((s) => s.settings.apiKey);
	const connected = Boolean(apiKey);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh flex-col bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex min-h-11 items-center gap-2.5",
						onClick: () => setView("workspace"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, { className: "size-8" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-display text-xl font-medium tracking-tight",
							children: "Canopy"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "ml-2 hidden items-center gap-1 md:flex",
						children: NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setView(item.id),
							className: cn("inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium", view === item.id ? "bg-raised text-fg" : "text-muted hover:text-fg"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, {
								className: "size-4",
								strokeWidth: 1.75
							}), item.label]
						}, item.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-auto flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "hidden items-center gap-3 rounded-md bg-raised px-3 py-1.5 text-xs tabular-nums text-muted shadow-[var(--shadow-border)] sm:flex",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									"Lookups",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", {
										className: "font-medium text-fg",
										children: [
											quota.lookups.remaining,
											"/",
											quota.lookups.limit
										]
									})
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-subtle",
									children: "·"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									"SERP",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", {
										className: "font-medium text-fg",
										children: [
											quota.serps.remaining,
											"/",
											quota.serps.limit
										]
									})
								] })
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: connected ? "ghost" : "primary",
							onClick: () => setView("setup"),
							children: connected ? "Connected" : "Connect Mangools"
						})]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex gap-1 overflow-x-auto px-3 pb-2 md:hidden",
				children: NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setView(item.id),
					className: cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium", view === item.id ? "bg-raised text-fg" : "text-muted"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, {
						className: "size-4",
						strokeWidth: 1.75
					}), item.label]
				}, item.id))
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
			className: "mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6",
			children
		})]
	});
}
function Spark({ values, className }) {
	const d = sparkPath(values);
	if (!d) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "text-subtle",
		children: "—"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 72 22",
		className: className ?? "h-5 w-[72px]",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d,
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.6",
			className: "text-ink-muted"
		})
	});
}
var TABS = [
	{
		id: "keywords",
		label: "Keywords"
	},
	{
		id: "related",
		label: "Related"
	},
	{
		id: "tracking",
		label: "Tracking"
	},
	{
		id: "competitors",
		label: "Competitors"
	},
	{
		id: "gaps",
		label: "Gaps"
	},
	{
		id: "lists",
		label: "Lists"
	},
	{
		id: "log",
		label: "Log"
	}
];
function Workspace() {
	const tab = useCanopy((s) => s.sheetTab);
	const setTab = useCanopy((s) => s.setSheetTab);
	const keywords = useCanopy((s) => s.keywords);
	const related = useCanopy((s) => s.related);
	useCanopy((s) => s.tracking);
	const competitors = useCanopy((s) => s.competitors);
	const gaps = useCanopy((s) => s.gaps);
	const lists = useCanopy((s) => s.lists);
	const log = useCanopy((s) => s.log);
	const selected = useCanopy((s) => s.selected);
	const settings = useCanopy((s) => s.settings);
	const addSeeds = useCanopy((s) => s.addSeeds);
	const toggleSelected = useCanopy((s) => s.toggleSelected);
	const [seed, setSeed] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(null);
	const [rival, setRival] = (0, import_react.useState)("");
	const [sort, setSort] = (0, import_react.useState)({
		key: "opportunity",
		dir: "desc"
	});
	const ranked = (0, import_react.useMemo)(() => {
		const rows = [...keywords];
		rows.sort((a, b) => {
			const av = a[sort.key];
			const bv = b[sort.key];
			const an = typeof av === "number" ? av : String(av ?? "");
			const bn = typeof bv === "number" ? bv : String(bv ?? "");
			if (an < bn) return sort.dir === "asc" ? -1 : 1;
			if (an > bn) return sort.dir === "asc" ? 1 : -1;
			return 0;
		});
		return rows;
	}, [keywords, sort]);
	async function run(label, fn) {
		setBusy(label);
		try {
			await fn();
			toast.success(label + " complete");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Request failed");
		} finally {
			setBusy(null);
		}
	}
	const picked = keywords.filter((k) => selected.includes(k.id));
	const pickKws = (picked.length ? picked : keywords).map((k) => k.keyword);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-1 flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium uppercase tracking-widest text-muted",
						children: "Workbook"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-3xl font-medium tracking-tight text-fg sm:text-4xl",
						children: "Keyword ledger"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 max-w-xl text-sm text-muted",
						children: "Same tabs the Apps Script builds in Google Sheets. Demo data is loaded for northline.studio — connect Mangools to score live."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "ghost",
							disabled: Boolean(busy),
							onClick: () => run("Bulk score", () => liveBulk(pickKws)),
							children: [busy === "Bulk score" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : null, "Score list"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							disabled: Boolean(busy),
							onClick: () => {
								const kw = picked[0]?.keyword ?? keywords[0]?.keyword;
								if (!kw) return toast.error("Add a keyword first");
								setTab("related");
								run("Related", () => liveRelated(kw));
							},
							children: "Expand related"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "paper",
							onClick: () => useCanopy.getState().setView("script"),
							children: "Copy Apps Script"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "flex flex-col gap-2 sm:flex-row",
				onSubmit: (e) => {
					e.preventDefault();
					const list = seed.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
					if (!list.length) return;
					addSeeds(list);
					setSeed("");
					toast.success(`Added ${list.length} seed${list.length === 1 ? "" : "s"}`);
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: seed,
					onChange: (e) => setSeed(e.target.value),
					placeholder: "Add seeds — comma or newline separated",
					className: "sm:flex-1"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "submit",
					variant: "ghost",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Add to sheet"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 overflow-hidden rounded-2xl bg-paper p-2 text-ink shadow-[var(--shadow-paper)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1 overflow-x-auto rounded-xl bg-ink/5 p-1",
					children: [TABS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setTab(t.id),
						className: cn("h-9 shrink-0 rounded-lg px-3 text-sm font-medium", tab === t.id ? "bg-paper text-ink shadow-sm" : "text-ink-muted hover:text-ink"),
						children: t.label
					}, t.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ml-auto hidden px-2 text-xs text-ink-muted sm:inline",
						children: [
							settings.domain || "no domain",
							" · loc ",
							settings.locationId
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 max-h-[min(70vh,720px)] overflow-auto rounded-xl",
					children: [
						tab === "keywords" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeywordTable, {
							rows: ranked,
							selected,
							onToggle: toggleSelected,
							sort,
							onSort: (key) => setSort((s) => ({
								key,
								dir: s.key === key && s.dir === "desc" ? "asc" : "desc"
							}))
						}),
						tab === "related" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RelatedTable, { rows: related }),
						tab === "tracking" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrackingTable, {}),
						tab === "competitors" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
								className: "mb-3 flex gap-2",
								onSubmit: (e) => {
									e.preventDefault();
									if (!rival.trim()) return;
									run("Competitor", () => liveCompetitor(rival.trim()));
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: rival,
									onChange: (e) => setRival(e.target.value),
									placeholder: "Competitor domain",
									className: "bg-paper text-ink shadow-none ring-1 ring-rule"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "submit",
									size: "sm",
									children: "Pull keywords"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTable, {
								columns: [
									"Domain",
									"Keyword",
									"Volume",
									"KD",
									"CPC",
									"Pos"
								],
								rows: competitors.map((c) => [
									c.domain,
									c.keyword,
									formatVolume(c.volume),
									c.kd ?? "—",
									formatCpc(c.cpc),
									c.position ?? "—"
								])
							})]
						}),
						tab === "gaps" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								className: "mb-3",
								onClick: () => {
									const raw = window.prompt("Competitors, comma-separated (max 5)") ?? "";
									run("Gap analysis", () => liveGap(raw.split(",")));
								},
								children: "Run gap analysis"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTable, {
								columns: [
									"Keyword",
									"Volume",
									"CPC",
									"You",
									"Competitor",
									"Their pos"
								],
								rows: gaps.map((g) => [
									g.keyword,
									formatVolume(g.volume),
									formatCpc(g.cpc),
									g.yourPosition ?? "—",
									g.competitor,
									g.competitorPosition
								])
							})]
						}),
						tab === "lists" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTable, {
							columns: [
								"List",
								"Keywords",
								"Updated"
							],
							rows: lists.map((l) => [
								l.name,
								l.count,
								l.updated
							])
						}),
						tab === "log" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTable, {
							columns: [
								"When",
								"Level",
								"Action",
								"Detail",
								"Credits"
							],
							rows: log.map((l) => [
								l.at,
								l.level,
								l.action,
								l.detail,
								l.credits
							])
						})
					]
				})]
			})
		]
	});
}
function KeywordTable({ rows, selected, onToggle, sort, onSort }) {
	const updateStatus = useCanopy((s) => s.updateStatus);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
		className: "sheet-grid w-full min-w-[760px] border-collapse text-left text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
			className: "bg-paper text-ink-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "w-10 px-3 py-2" }), [
				{
					key: "keyword",
					label: "Keyword"
				},
				{
					key: "volume",
					label: "Volume"
				},
				{
					key: "msv",
					label: "Trend"
				},
				{
					key: "kd",
					label: "KD"
				},
				{
					key: "cpc",
					label: "CPC"
				},
				{
					key: "opportunity",
					label: "Score"
				},
				{
					key: "status",
					label: "Status"
				},
				{
					key: "agent",
					label: "Agent"
				}
			].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
				className: "px-3 py-2 font-medium",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onSort(h.key),
					className: "hover:text-ink",
					children: [h.label, sort.key === h.key ? sort.dir === "desc" ? " ↓" : " ↑" : ""]
				})
			}, h.key))]
		}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
			className: cn("border-t border-rule", i % 2 === 1 && "bg-ink/5", selected.includes(row.id) && "bg-accent/20"),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "px-3 py-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						className: "size-4 accent-ink",
						checked: selected.includes(row.id),
						onChange: () => onToggle(row.id),
						"aria-label": `Select ${row.keyword}`
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
					className: "px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-medium",
						children: row.keyword
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-ink-muted",
						children: row.seed
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "px-3 py-2 tabular-nums",
					children: formatVolume(row.volume)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "px-3 py-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spark, { values: row.msv })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "px-3 py-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KdCell, { kd: row.kd })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "px-3 py-2 tabular-nums",
					children: formatCpc(row.cpc)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "px-3 py-2 font-medium tabular-nums",
					children: row.opportunity
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "px-3 py-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: row.status,
						onChange: (e) => updateStatus(row.id, e.target.value),
						className: "h-8 rounded-sm bg-transparent text-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "new",
								children: "new"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "tracked",
								children: "tracked"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "briefed",
								children: "briefed"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "ignored",
								children: "ignored"
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "px-3 py-2 text-ink-muted",
					children: row.agent
				})
			]
		}, row.id)) })]
	});
}
function RelatedTable({ rows }) {
	if (!rows.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "p-6 text-sm text-ink-muted",
		children: "Expand a seed to fill this tab."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleTable, {
		columns: [
			"Seed",
			"Keyword",
			"Volume",
			"KD",
			"CPC",
			"Score"
		],
		rows: rows.map((r) => [
			r.seed,
			r.keyword,
			formatVolume(r.volume),
			r.kd ?? "—",
			formatCpc(r.cpc),
			r.opportunity
		])
	});
}
function TrackingTable() {
	const rows = useCanopy((s) => s.tracking);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
		className: "sheet-grid w-full min-w-[720px] border-collapse text-left text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
			className: "bg-paper text-ink-muted",
			children: [
				"Keyword",
				"Loc",
				"Device",
				"Rank",
				"Change",
				"Best",
				"Visits",
				"URL"
			].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
				className: "px-3 py-2 font-medium",
				children: h
			}, h))
		}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((r, i) => {
			const delta = rankDelta(r.rank, r.prev);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: cn("border-t border-rule", i % 2 === 1 && "bg-ink/5"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-3 py-2 font-medium",
						children: r.keyword
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-3 py-2 text-ink-muted",
						children: r.location
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-3 py-2",
						children: r.device
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-3 py-2 tabular-nums",
						children: r.rank ?? "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-3 py-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: cn("inline-flex items-center gap-0.5 tabular-nums", delta > 0 && "text-good", delta < 0 && "text-bad"),
							children: [
								delta > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "size-3.5" }) : null,
								delta < 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownRight, { className: "size-3.5" }) : null,
								delta === 0 ? "—" : Math.abs(delta)
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-3 py-2 tabular-nums",
						children: r.best ?? "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-3 py-2 tabular-nums",
						children: r.visits
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "max-w-[180px] truncate px-3 py-2 text-ink-muted",
						children: r.url
					})
				]
			}, r.id);
		}) })]
	});
}
function SimpleTable({ columns, rows }) {
	if (!rows.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "p-6 text-sm text-ink-muted",
		children: "Nothing on this tab yet."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
		className: "sheet-grid w-full min-w-[640px] border-collapse text-left text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
			className: "bg-paper text-ink-muted",
			children: columns.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
				className: "px-3 py-2 font-medium",
				children: c
			}, c))
		}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
			className: cn("border-t border-rule", i % 2 === 1 && "bg-ink/5"),
			children: r.map((cell, j) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: cn("px-3 py-2", j === 0 && "font-medium"),
				children: cell
			}, j))
		}, i)) })]
	});
}
function KdCell({ kd }) {
	const tone = kdTone(kd);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-w-16 items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "w-6 tabular-nums",
			children: kd ?? "—"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "kd-bar w-12",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				style: { width: `${kd == null ? 0 : Math.min(100, kd)}%` },
				className: cn(tone === "good" && "bg-good", tone === "warn" && "bg-warn", tone === "bad" && "bg-bad", tone === "muted" && "bg-rule")
			})
		})]
	});
}
function Home() {
	const view = useCanopy((s) => s.view);
	(0, import_react.useEffect)(() => {
		useCanopy.persist.rehydrate();
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		view === "workspace" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Workspace, {}) : null,
		view === "agents" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Agents, {}) : null,
		view === "script" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScriptStudio, {}) : null,
		view === "atlas" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Atlas, {}) : null,
		view === "setup" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Setup, {}) : null
	] });
}
//#endregion
export { Home as component };
