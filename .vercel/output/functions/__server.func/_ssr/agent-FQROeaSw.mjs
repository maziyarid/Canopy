import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import { c as object, u as string } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/agent-FQROeaSw.js
var AgentSchema = object({
	message: string().min(1).max(4e3),
	domain: string().max(200).optional(),
	location: string().max(80).optional(),
	keywordsPreview: string().max(2500).optional()
});
var runResearchAgent_createServerFn_handler = createServerRpc({
	id: "5b738a0d7db0c8f22a3da300c948d1433c0c697de7162b763d83c97c20e8bc9b",
	name: "runResearchAgent",
	filename: "src/lib/server/agent.ts"
}, (opts) => runResearchAgent.__executeServer(opts));
var runResearchAgent = createServerFn({ method: "POST" }).validator(AgentSchema).handler(runResearchAgent_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		ok: false,
		error: "AI is not available in this environment."
	};
	const system = `You are Canopy, an SEO operator that drives a Google Sheet wired to the Mangools API (KWFinder, SERPChecker, SERPWatcher).
You plan keyword research and emit a playbook the sheet's agent runner can execute.

Always reply with compact JSON only, no markdown fences:
{
  "reply": "short operator note, 2-5 sentences, plain language",
  "playbook": {
    "title": "short name",
    "summary": "what this run will do",
    "seeds": ["up to 15 seed keywords"],
    "tasks": [
      { "agent": "Scout|Expander|Assessor|Rival|Watch|Brief", "action": "seeds|related|bulk|gap|track|brief", "input": "concrete input" }
    ],
    "notes": "setup reminders (location, credits, SERPWatcher quota)"
  }
}

Rules:
- Prefer long-tail, rankable seeds over head terms.
- Name Mangools endpoints when a task spends credits (related-keywords, keyword-imports, competitor-keywords, gap-analysis, serpchecker/serps, serpwatcher).
- Respect 700-keyword bulk cap and 24h identical-request cache.
- If the user names a domain, include Rival + Watch tasks.
- Do not invent API keys or claim a live Mangools call happened.`;
	const user = [
		data.domain ? `Home domain: ${data.domain}` : "",
		data.location ? `Location: ${data.location}` : "",
		data.keywordsPreview ? `Current sheet keywords:\n${data.keywordsPreview}` : "",
		`Request: ${data.message}`
	].filter(Boolean).join("\n");
	const res = await fetch("https://api.x.ai/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: "grok-4.5",
			temperature: .4,
			max_tokens: 1200,
			messages: [{
				role: "system",
				content: system
			}, {
				role: "user",
				content: user
			}]
		})
	});
	if (!res.ok) return {
		ok: false,
		error: `xAI API error ${res.status}`
	};
	const text = (await res.json()).choices?.[0]?.message?.content ?? "";
	const parsed = extractJson(text);
	if (!parsed) return {
		ok: true,
		reply: text || "No response.",
		playbook: null
	};
	return {
		ok: true,
		reply: String(parsed.reply || "Playbook ready."),
		playbook: parsed.playbook ?? null
	};
});
function extractJson(text) {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	try {
		return JSON.parse(text.slice(start, end + 1));
	} catch {
		return null;
	}
}
//#endregion
export { runResearchAgent_createServerFn_handler };
