import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "./types";
import { t, type CopyKey } from "./i18n";

type LocaleState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
};

export const useLocale = create<LocaleState>()(
  persist(
    (set, get) => ({
      lang: "en",
      setLang: (lang) => set({ lang }),
      toggle: () => set({ lang: get().lang === "en" ? "fa" : "en" }),
    }),
    { name: "canopy-lang" },
  ),
);

export function useT() {
  const lang = useLocale((s) => s.lang);
  return (key: CopyKey) => t(lang, key);
}
