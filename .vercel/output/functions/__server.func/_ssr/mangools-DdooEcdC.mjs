import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import { a as lazy, c as object, d as union, i as boolean, l as record, n as _null, r as array, s as number, t as _enum, u as string } from "../_libs/zod.mjs";
import { t as BASE_URL } from "./api-catalog-BBUji59b.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/mangools-DdooEcdC.js
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
var mangoolsRequest_createServerFn_handler = createServerRpc({
	id: "db4438b6ba10af6a780134d542f6ebbf5864d1ed44e8cdac6b1803e487453678",
	name: "mangoolsRequest",
	filename: "src/lib/server/mangools.ts"
}, (opts) => mangoolsRequest.__executeServer(opts));
var mangoolsRequest = createServerFn({ method: "POST" }).validator(RequestSchema).handler(mangoolsRequest_createServerFn_handler, async ({ data }) => {
	const url = new URL(data.path.startsWith("http") ? data.path : `${BASE_URL}${data.path}`);
	if (data.query) for (const [k, v] of Object.entries(data.query)) {
		if (v === void 0 || v === "") continue;
		url.searchParams.set(k, String(v));
	}
	const res = await fetch(url, {
		method: data.method,
		headers: {
			"X-Access-Token": data.apiKey,
			Accept: "application/json",
			...data.body ? { "Content-Type": "application/json" } : {}
		},
		body: data.body ? JSON.stringify(data.body) : void 0
	});
	const text = await res.text();
	let json = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = { raw: text.slice(0, 800) };
	}
	if (!res.ok) {
		const obj = json && typeof json === "object" && !Array.isArray(json) ? json : {};
		const err = typeof obj.message === "string" && obj.message || typeof obj.error === "string" && obj.error || text.slice(0, 400);
		return {
			ok: false,
			status: res.status,
			error: `Mangools ${res.status}: ${err}`
		};
	}
	return {
		ok: true,
		status: res.status,
		data: json
	};
});
//#endregion
export { mangoolsRequest_createServerFn_handler };
