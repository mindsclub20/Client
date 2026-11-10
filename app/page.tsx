import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "public", "index.html"), "utf8");
const cofounderTarget = '<b>Joshua</b><span>Co-founder</span></div></div></div></section>';
const cofounderReplacement = '<b>Joshua</b><span>Co-founder</span></div><div><div class="dp"><svg><use href="#u"/></svg></div><b>B.V. Shyam Sundar</b><span>Co-founder</span></div></div></div></section>';
const withShyam = source.includes(cofounderTarget) ? source.replace(cofounderTarget, cofounderReplacement) : source;
const body = withShyam.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
const markup = body
  .replace(/<title>[\s\S]*?<\/title>/gi, "")
  .replace(/<link\b[^>]*>/gi, "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

export default function HomePage() {
  return <div dangerouslySetInnerHTML={{ __html: markup }} />;
}
