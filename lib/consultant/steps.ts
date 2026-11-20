import type { InterviewStep } from "@/lib/consultant/types";

const L = {
  en: (s: string) => s,
};

function loc(en: string, hi?: string, te?: string): InterviewStep["label"] {
  return {
    en,
    hi: hi || en,
    te: te || en,
    ta: en,
    kn: en,
    ml: en,
    bn: en,
    mr: en,
  };
}

/** Guided intake used before / alongside Gemini chat. */
export const INTERVIEW_STEPS: InterviewStep[] = [
  {
    id: "customer_name",
    section: "Contact",
    kind: "text",
    required: true,
    maxLength: 120,
    label: loc("Your name", "आपका नाम", "మీ పేరు"),
    prompt: loc("What should we call you?", "हम आपको क्या बुलाएँ?", "మమ్మల్ని ఏమని పిలవాలి?"),
  },
  {
    id: "business_name",
    section: "Contact",
    kind: "text",
    maxLength: 160,
    label: loc("Business / brand name", "व्यवसाय / ब्रांड नाम", "వ్యాపారం / బ్రాండ్ పేరు"),
    prompt: loc("Optional — name of your business or brand."),
  },
  {
    id: "contact_phone",
    section: "Contact",
    kind: "phone",
    maxLength: 20,
    label: loc("Phone / WhatsApp", "फ़ोन / व्हाट्सऐप", "ఫోన్ / వాట్సాప్"),
    prompt: loc("Best number to reach you on WhatsApp."),
  },
  {
    id: "website_type",
    section: "Project",
    kind: "choice",
    required: true,
    label: loc("Website type", "वेबसाइट का प्रकार", "వెబ్‌సైట్ రకం"),
    prompt: loc("What kind of website do you need?"),
    options: [
      { value: "business", label: loc("Business / company") },
      { value: "restaurant", label: loc("Restaurant / cafe") },
      { value: "portfolio", label: loc("Portfolio / personal") },
      { value: "shop", label: loc("Online shop") },
      { value: "landing", label: loc("Landing page") },
      { value: "custom", label: loc("Custom / other") },
    ],
  },
  {
    id: "pages",
    section: "Project",
    kind: "multi",
    label: loc("Pages needed", "जरूरी पेज", "కావాల్సిన పేజీలు"),
    prompt: loc("Select the pages you expect."),
    options: [
      { value: "home", label: loc("Home") },
      { value: "about", label: loc("About") },
      { value: "services", label: loc("Services") },
      { value: "menu", label: loc("Menu") },
      { value: "gallery", label: loc("Gallery") },
      { value: "contact", label: loc("Contact") },
      { value: "shop", label: loc("Shop / products") },
      { value: "blog", label: loc("Blog") },
    ],
  },
  {
    id: "goals",
    section: "Project",
    kind: "longtext",
    required: true,
    maxLength: 800,
    label: loc("Main goal", "मुख्य लक्ष्य", "ప్రధాన లక్ష్యం"),
    prompt: loc(
      "In a few lines, what should this website achieve? (leads, orders, credibility, booking…)"
    ),
  },
  {
    id: "budget_signal",
    section: "Budget",
    kind: "choice",
    label: loc("Budget range", "बजट सीमा", "బడ్జెట్ పరిధి"),
    prompt: loc("MAXWEB packages run ₹15,000 → floor ₹7,000. What feels realistic?"),
    options: [
      { value: "15000", label: loc("Around ₹15,000") },
      { value: "10000", label: loc("Around ₹10,000") },
      { value: "7000", label: loc("Closer to ₹7,000") },
      { value: "unsure", label: loc("Not sure yet") },
    ],
  },
  {
    id: "demo_interest",
    section: "Next step",
    kind: "choice",
    label: loc("Want a live demo?", "लाइव डेमो चाहिए?", "లైవ్ డెమో కావాలా?"),
    prompt: loc("We can walk you through live sample sites."),
    options: [
      { value: "yes", label: loc("Yes, request a demo") },
      { value: "later", label: loc("Maybe later") },
      { value: "no", label: loc("No thanks") },
    ],
  },
];

void L;
