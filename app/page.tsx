import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "public", "site-source.html"), "utf8");
const cofounderTarget = '<b>Joshua</b><span>Co-founder</span></div></div></div></section>';
const cofounderReplacement = '<b>Joshua</b><span>Co-founder</span></div><div><div class="dp"><svg><use href="#u"/></svg></div><b>B.V. Shyam Sundar</b><span>Co-founder</span></div></div></div></section>';
const withShyam = source.includes(cofounderTarget) ? source.replace(cofounderTarget, cofounderReplacement) : source;
const body = withShyam.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
const markup = body
  .replace(/<title>[\s\S]*?<\/title>/gi, "")
  .replace(/<link\b[^>]*>/gi, "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replaceAll("https://grocery-shop-demo-1.preview.emergentagent.com/?utm_source=share", "/demos/restaurant")
  .replaceAll("https://maxweb-website-and-game--charan4950ch.replit.app/", "/demos/business")
  .replaceAll("https://12103977-76b7-4e76-b153-b637d396fe70-00-quoy5txei5k3.sisko.replit.dev/", "/demos/portfolio")
  .replaceAll("Grocery shop demo", "Grocery Shop Demo")
  .replaceAll("MAXWEB website and game", "MAXWEB Website &amp; Game")
  .replaceAll("Second live demo", "Second Live Demo")
  .replaceAll("A live demo of an online grocery shop website.", "Explore this grocery shopping website concept.")
  .replaceAll("A live demo of a website with a built-in game.", "Explore the MAXWEB website concept and interactive game.")
  .replaceAll("Another website built by MAXWEB.", "Explore the second live website demo by MAXWEB.");

export default function HomePage() {
  return <div dangerouslySetInnerHTML={{ __html: markup }} />;
}
