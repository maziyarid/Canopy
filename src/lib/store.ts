import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEMO_COMPETITORS,
  DEMO_GAPS,
  DEMO_KEYWORDS,
  DEMO_LISTS,
  DEMO_LOG,
  DEMO_QUOTA,
  DEMO_RELATED,
  DEMO_TRACKING,
} from "./demo-data";
import { opportunityScore } from "./score";
import type {
  AgentMessage,
  CompetitorRow,
  GapRow,
  KeywordRow,
  ListRow,
  LogRow,
  QuotaState,
  Settings,
  SheetTab,
  TrackingRow,
  ViewId,
} from "./types";

const defaultSettings: Settings = {
  apiKey: "",
  domain: "northline.studio",
  locationId: 2840,
  languageId: 1000,
  trackingId: "",
  llmKey: "",
  llmBase: "https://api.x.ai/v1",
  webhookSecret: "",
  dailyTrigger: true,
};

type State = {
  view: ViewId;
  sheetTab: SheetTab;
  settings: Settings;
  keywords: KeywordRow[];
  related: KeywordRow[];
  tracking: TrackingRow[];
  competitors: CompetitorRow[];
  gaps: GapRow[];
  lists: ListRow[];
  log: LogRow[];
  quota: QuotaState;
  selected: string[];
  messages: AgentMessage[];
  setView: (view: ViewId) => void;
  setSheetTab: (tab: SheetTab) => void;
  patchSettings: (patch: Partial<Settings>) => void;
  setKeywords: (rows: KeywordRow[]) => void;
  mergeKeywords: (rows: KeywordRow[]) => void;
  setRelated: (rows: KeywordRow[]) => void;
  setTracking: (rows: TrackingRow[]) => void;
  setCompetitors: (rows: CompetitorRow[]) => void;
  setGaps: (rows: GapRow[]) => void;
  setLists: (rows: ListRow[]) => void;
  setQuota: (quota: QuotaState) => void;
  addLog: (row: Omit<LogRow, "id">) => void;
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  addMessage: (msg: Omit<AgentMessage, "id" | "at">) => void;
  updateStatus: (id: string, status: KeywordRow["status"]) => void;
  addSeeds: (seeds: string[]) => void;
  resetDemo: () => void;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export const useCanopy = create<State>()(
  persist(
    (set, get) => ({
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
      messages: [
        {
          id: "welcome",
          role: "assistant",
          at: new Date().toISOString(),
          content:
            "I run Canopy's research desk. Give me a topic, a domain, or a sheet goal and I will draft seeds, score opportunities, and write the agent playbook your Google Sheet will execute against Mangools.",
          playbook: null,
        },
      ],
      setView: (view) => set({ view }),
      setSheetTab: (sheetTab) => set({ sheetTab }),
      patchSettings: (patch) =>
        set({ settings: { ...get().settings, ...patch } }),
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
      addLog: (row) =>
        set({ log: [{ ...row, id: uid() }, ...get().log].slice(0, 80) }),
      toggleSelected: (id) => {
        const selected = get().selected;
        set({
          selected: selected.includes(id)
            ? selected.filter((x) => x !== id)
            : [...selected, id],
        });
      },
      clearSelected: () => set({ selected: [] }),
      addMessage: (msg) =>
        set({
          messages: [
            ...get().messages,
            { ...msg, id: uid(), at: new Date().toISOString() },
          ],
        }),
      updateStatus: (id, status) =>
        set({
          keywords: get().keywords.map((k) => (k.id === id ? { ...k, status } : k)),
        }),
      addSeeds: (seeds) => {
        const existing = new Set(get().keywords.map((k) => k.keyword.toLowerCase()));
        const { settings } = get();
        const rows: KeywordRow[] = seeds
          .map((s) => s.trim())
          .filter((s) => s && !existing.has(s.toLowerCase()))
          .map((keyword) => ({
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
            agent: "Scout",
          }));
        if (rows.length) set({ keywords: [...rows, ...get().keywords] });
      },
      resetDemo: () =>
        set({
          keywords: DEMO_KEYWORDS,
          related: DEMO_RELATED,
          tracking: DEMO_TRACKING,
          competitors: DEMO_COMPETITORS,
          gaps: DEMO_GAPS,
          lists: DEMO_LISTS,
          log: DEMO_LOG,
          quota: DEMO_QUOTA,
          selected: [],
        }),
    }),
    {
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
        messages: s.messages.slice(-24),
      }),
    },
  ),
);
