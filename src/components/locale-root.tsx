import { useLocale } from "@/lib/locale";
import { useEffect, type ReactNode } from "react";

export function LocaleRoot({ children }: { children: ReactNode }) {
  const lang = useLocale((s) => s.lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  }, [lang]);

  return <>{children}</>;
}
