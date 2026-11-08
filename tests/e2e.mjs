// End-to-end auth test against a deployed site. Usage:
//   BASE_URL=https://your-site.vercel.app node tests/e2e.mjs
// Creates one throwaway test user in the database (email shown at the end).
const BASE = (process.env.BASE_URL || "").replace(/\/$/, "");
if (!BASE) { console.error("Set BASE_URL"); process.exit(2); }

let jar = {};
function cookieHeader() { return Object.entries(jar).map(([k, v]) => k + "=" + v).join("; "); }
function store(res) {
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    const k = pair.slice(0, i).trim(), v = pair.slice(i + 1);
    if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c) || v === "") delete jar[k]; else jar[k] = v;
  }
}
async function call(path, body) {
  const res = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", origin: BASE, cookie: cookieHeader() },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  store(res);
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const email = "e2e+" + Date.now() + "@example.com", password = "Test-pass-12345";
const results = [];
function check(name, ok, info) { results.push({ name, ok }); console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : "  -> " + info)); }

let r;
r = await call("/api/me");                                          check("unauthenticated /api/me rejected", r.status === 401, r.status);
r = await call("/api/auth/sign-up/email", { name: "E2E Test", email, password }); check("registration creates user", r.status === 200, JSON.stringify(r));
r = await call("/api/me");                                          check("session after registration", r.status === 200 && r.data?.user?.email === email, r.status);
r = await call("/api/auth/sign-out", {});                           check("logout succeeds", r.status === 200, r.status);
r = await call("/api/me");                                          check("access rejected after logout", r.status === 401, r.status);
r = await call("/api/auth/sign-up/email", { name: "E2E Test", email, password }); check("duplicate registration rejected", r.status >= 400 && r.status < 500, r.status);
r = await call("/api/auth/sign-in/email", { email, password: "wrong-password-1" }); check("wrong password rejected", r.status >= 400 && r.status < 500, r.status);
r = await call("/api/auth/sign-in/email", { email, password });     check("valid login succeeds", r.status === 200, r.status);
r = await call("/api/me");                                          check("session restored (refresh)", r.status === 200 && r.data?.user?.email === email, r.status);
r = await call("/api/auth/sign-up/email", { name: "", email: "not-an-email", password: "x" }); check("invalid input rejected", r.status >= 400 && r.status < 500, r.status);
await call("/api/auth/sign-out", {});

const failed = results.filter(x => !x.ok).length;
console.log("\n" + (results.length - failed) + "/" + results.length + " passed. Test user: " + email);
process.exit(failed ? 1 : 0);
