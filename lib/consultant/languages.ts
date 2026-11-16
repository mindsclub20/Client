export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "mr", label: "Marathi", native: "मराठी" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LangCode = "en";

const SCRIPT_RANGES: { lang: LangCode; pattern: RegExp }[] = [
  { lang: "hi", pattern: /[\u0900-\u097F]/g },
  { lang: "te", pattern: /[\u0C00-\u0C7F]/g },
  { lang: "ta", pattern: /[\u0B80-\u0BFF]/g },
  { lang: "kn", pattern: /[\u0C80-\u0CFF]/g },
  { lang: "ml", pattern: /[\u0D00-\u0D7F]/g },
  { lang: "bn", pattern: /[\u0980-\u09FF]/g },
];

const LATIN_PATTERN = /[A-Za-z]/g;

export function detectLanguage(text: string): LangCode | null {
  let best: LangCode | null = null;
  let bestCount = 0;

  for (const { lang, pattern } of SCRIPT_RANGES) {
    const count = text.match(pattern)?.length ?? 0;
    if (count > bestCount) {
      best = lang;
      bestCount = count;
    }
  }

  if (bestCount >= 2) return best;

  const latinCount = text.match(LATIN_PATTERN)?.length ?? 0;
  return latinCount >= 2 ? "en" : null;
}

export function isLangCode(value: string): value is LangCode {
  return LANGUAGES.some((l) => l.code === value);
}
