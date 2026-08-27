import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AgentSchema = z.object({
  message: z.string().min(1).max(4000),
  domain: z.string().max(200).optional(),
  location: z.string().max(80).optional(),
  keywordsPreview: z.string().max(2500).optional(),
});

export const runResearchAgent = createServerFn({ method: "POST" })
  .validator(AgentSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI is not available in this environment." };
    }

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
      `Request: ${data.message}`,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.4,
        max_tokens: 1200,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false as const, error: `xAI API error ${res.status}` };
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(text);
    if (!parsed) {
      return {
        ok: true as const,
        reply: text || "No response.",
        playbook: null,
      };
    }
    return {
      ok: true as const,
      reply: String(parsed.reply || "Playbook ready."),
      playbook: parsed.playbook ?? null,
    };
  });

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as {
      reply?: string;
      playbook?: {
        title: string;
        summary: string;
        seeds: string[];
        tasks: { agent: string; action: string; input: string }[];
        notes: string;
      };
    };
  } catch {
    return null;
  }
}
