/**
 * Copy only a validated locale preference. Never migrate tokens, accounts or
 * saved business data between product namespaces; preserve the legacy source.
 * @param {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void }} storage
 */
export function migrateLocalePreference(storage) {
  try {
    if (storage.getItem('msrobot:v1:locale') !== null) return;
    const legacy = JSON.parse(storage.getItem('canopy-lang') ?? 'null');
    const lang = legacy?.state?.lang;
    if (lang !== 'en' && lang !== 'fa') return;
    storage.setItem('msrobot:v1:locale', JSON.stringify({ state: { lang }, version: 0 }));
  } catch { /* Storage may be unavailable or corrupt. Use the ordinary default. */ }
}
