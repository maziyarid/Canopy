import type { LocationOption } from "./types";

export const LOCATIONS: LocationOption[] = [
  { id: 0, label: "Global", country: "—" },
  { id: 2840, label: "United States", country: "US" },
  { id: 2826, label: "United Kingdom", country: "GB" },
  { id: 2124, label: "Canada", country: "CA" },
  { id: 2036, label: "Australia", country: "AU" },
  { id: 2276, label: "Germany", country: "DE" },
  { id: 2250, label: "France", country: "FR" },
  { id: 2724, label: "Spain", country: "ES" },
  { id: 2380, label: "Italy", country: "IT" },
  { id: 2528, label: "Netherlands", country: "NL" },
  { id: 2356, label: "India", country: "IN" },
  { id: 2076, label: "Brazil", country: "BR" },
  { id: 2392, label: "Japan", country: "JP" },
  { id: 2702, label: "Singapore", country: "SG" },
  { id: 2372, label: "Ireland", country: "IE" },
  { id: 2554, label: "New Zealand", country: "NZ" },
  { id: 2484, label: "Mexico", country: "MX" },
  { id: 2616, label: "Poland", country: "PL" },
  { id: 2752, label: "Sweden", country: "SE" },
  { id: 2784, label: "United Arab Emirates", country: "AE" },
];

export const LANGUAGES = [
  { id: 1000, code: "en", label: "English" },
  { id: 1001, code: "de", label: "German" },
  { id: 1002, code: "es", label: "Spanish" },
  { id: 1003, code: "fr", label: "French" },
  { id: 1004, code: "it", label: "Italian" },
  { id: 1005, code: "pt", label: "Portuguese" },
  { id: 1006, code: "nl", label: "Dutch" },
  { id: 1007, code: "ja", label: "Japanese" },
  { id: 1008, code: "pl", label: "Polish" },
  { id: 1009, code: "sv", label: "Swedish" },
];

export function locationLabel(id: number) {
  return LOCATIONS.find((l) => l.id === id)?.label ?? String(id);
}

export function languageLabel(id: number) {
  return LANGUAGES.find((l) => l.id === id)?.label ?? String(id);
}
