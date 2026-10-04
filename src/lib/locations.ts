export type LocationOption = {
  id: number;
  label: string;
  labelFa: string;
  country: string;
};

export const LOCATIONS: LocationOption[] = [
  { id: 0, label: "Global", labelFa: "جهانی", country: "—" },
  { id: 2364, label: "Iran", labelFa: "ایران", country: "IR" },
  { id: 2840, label: "United States", labelFa: "ایالات متحده", country: "US" },
  { id: 2826, label: "United Kingdom", labelFa: "بریتانیا", country: "GB" },
  { id: 2124, label: "Canada", labelFa: "کانادا", country: "CA" },
  { id: 2036, label: "Australia", labelFa: "استرالیا", country: "AU" },
  { id: 2276, label: "Germany", labelFa: "آلمان", country: "DE" },
  { id: 2250, label: "France", labelFa: "فرانسه", country: "FR" },
  { id: 2724, label: "Spain", labelFa: "اسپانیا", country: "ES" },
  { id: 2380, label: "Italy", labelFa: "ایتالیا", country: "IT" },
  { id: 2528, label: "Netherlands", labelFa: "هلند", country: "NL" },
  { id: 2792, label: "Turkey", labelFa: "ترکیه", country: "TR" },
  { id: 2682, label: "Saudi Arabia", labelFa: "عربستان سعودی", country: "SA" },
  { id: 2784, label: "United Arab Emirates", labelFa: "امارات", country: "AE" },
  { id: 2356, label: "India", labelFa: "هند", country: "IN" },
  { id: 2076, label: "Brazil", labelFa: "برزیل", country: "BR" },
  { id: 2392, label: "Japan", labelFa: "ژاپن", country: "JP" },
  { id: 2702, label: "Singapore", labelFa: "سنگاپور", country: "SG" },
  { id: 2372, label: "Ireland", labelFa: "ایرلند", country: "IE" },
  { id: 2554, label: "New Zealand", labelFa: "نیوزیلند", country: "NZ" },
];

export const LANGUAGES = [
  { id: 1000, code: "en", label: "English", labelFa: "انگلیسی" },
  { id: 1001, code: "de", label: "German", labelFa: "آلمانی" },
  { id: 1002, code: "es", label: "Spanish", labelFa: "اسپانیایی" },
  { id: 1003, code: "fr", label: "French", labelFa: "فرانسوی" },
  { id: 1004, code: "it", label: "Italian", labelFa: "ایتالیایی" },
  { id: 1005, code: "pt", label: "Portuguese", labelFa: "پرتغالی" },
  { id: 1006, code: "nl", label: "Dutch", labelFa: "هلندی" },
  { id: 1007, code: "ja", label: "Japanese", labelFa: "ژاپنی" },
  { id: 1008, code: "pl", label: "Polish", labelFa: "لهستانی" },
  { id: 1009, code: "sv", label: "Swedish", labelFa: "سوئدی" },
];

export function locationLabel(id: number, fa = false) {
  const row = LOCATIONS.find((l) => l.id === id);
  if (!row) return String(id);
  return fa ? row.labelFa : row.label;
}

export function languageLabel(id: number, fa = false) {
  const row = LANGUAGES.find((l) => l.id === id);
  if (!row) return String(id);
  return fa ? row.labelFa : row.label;
}
