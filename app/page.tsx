import Script from "next/script";
import { SITE_SOURCE_HTML } from "@/lib/generated-site-source";

const source = SITE_SOURCE_HTML;

// Replace Joshua co-founder block with B.V. Shyam Sundar only.
const cofounderSection =
  /<section id="cofounder">[\s\S]*?<\/section>/i;
const cofounderReplacement = `<section id="cofounder"><div class="wrap"><h2>Co-founder</h2><p class="lead">Also happy to talk with you about your project.</p>
<div class="team solo"><div><div class="dp"><svg><use href="#u"/></svg></div><b>B.V. Shyam Sundar</b><span>Co-founder</span></div></div></div></section>`;
const withoutJoshua = source.replace(cofounderSection, cofounderReplacement);

const body = withoutJoshua.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
const markup = body
  .replace(/<title>[\s\S]*?<\/title>/gi, "")
  .replace(/<link\b[^>]*>/gi, "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replaceAll(
    "https://grocery-shop-demo-1.preview.emergentagent.com/?utm_source=share",
    "/demos/restaurant"
  )
  .replaceAll(
    "https://maxweb-website-and-game--charan4950ch.replit.app/",
    "/demos/business"
  )
  .replaceAll(
    "https://12103977-76b7-4e76-b153-b637d396fe70-00-quoy5txei5k3.sisko.replit.dev/",
    "/demos/portfolio"
  )
  .replaceAll('target="_blank" rel="noopener"', "")
  .replaceAll("Grocery shop demo", "Restaurant Website")
  .replaceAll("MAXWEB website and game", "Business Landing Page")
  .replaceAll("Second live demo", "Creative Portfolio")
  .replaceAll(
    "A live demo of an online grocery shop website.",
    "Warm hospitality UI — menu, story and reservation-style sections."
  )
  .replaceAll(
    "A live demo of a website with a built-in game.",
    "Cool corporate UI — services, outcomes and enquiry-focused layout."
  )
  .replaceAll(
    "Another website we built, open it and try it.",
    "Soft creative UI — selected work, personality and contact."
  )
  .replaceAll(
    "Another website built by MAXWEB.",
    "Soft creative UI — selected work, personality and contact."
  );

export default function HomePage() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: markup }} />
      <Script src="/js/script.js" strategy="afterInteractive" />
      <Script src="/js/auth.js" strategy="afterInteractive" />
    </>
  );
}
