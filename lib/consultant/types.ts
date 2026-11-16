import type { LangCode } from "@/lib/consultant/languages";

export type Localized = Record<LangCode, string>;

export type StepKind = "text" | "longtext" | "email" | "phone" | "url" | "choice" | "multi";

export interface StepOption {
  value: string;
  label: Localized;
}

export interface InterviewStep {
  id: string;
  section: string;
  kind: StepKind;
  required?: boolean;
  maxLength?: number;
  label: Localized;
  prompt: Localized;
  explain?: Localized;
  options?: StepOption[];
}

export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

export interface ReportRow {
  stepId: string;
  label: string;
  value: string;
}

export interface ReportSection {
  key: string;
  title: string;
  rows: ReportRow[];
}

export interface RequirementReport {
  language: LangCode;
  sections: ReportSection[];
  missing: string[];
  summary: string;
}

function pick(loc: Localized, lang: LangCode): string {
  return loc[lang] || loc.en || Object.values(loc)[0] || "";
}

export function buildRequirementReport(
  steps: InterviewStep[],
  answers: Answers,
  language: LangCode
): RequirementReport {
  const sectionsMap = new Map<string, ReportSection>();
  const missing: string[] = [];

  for (const step of steps) {
    const raw = answers[step.id];
    const empty =
      raw == null ||
      (typeof raw === "string" && !raw.trim()) ||
      (Array.isArray(raw) && raw.length === 0);

    if (empty) {
      if (step.required) missing.push(pick(step.label, language));
      continue;
    }

    const value = Array.isArray(raw) ? raw.join(", ") : String(raw);
    const section = sectionsMap.get(step.section) || {
      key: step.section,
      title: step.section,
      rows: [],
    };
    section.rows.push({
      stepId: step.id,
      label: pick(step.label, language),
      value,
    });
    sectionsMap.set(step.section, section);
  }

  const sections = [...sectionsMap.values()];
  const summaryParts = sections.flatMap((s) =>
    s.rows.map((r) => `${r.label}: ${r.value}`)
  );

  return {
    language,
    sections,
    missing,
    summary: summaryParts.slice(0, 12).join(" · "),
  };
}
