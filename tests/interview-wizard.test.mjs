import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const steps = await readFile(new URL("../lib/consultant/steps.ts", import.meta.url), "utf8");
const languages = await readFile(new URL("../lib/consultant/languages.ts", import.meta.url), "utf8");
const api = await readFile(new URL("../app/api/client/interview/route.ts", import.meta.url), "utf8");
const wizard = await readFile(new URL("../app/client/interview-wizard.tsx", import.meta.url), "utf8");
const client = await readFile(new URL("../app/client/client-dashboard.tsx", import.meta.url), "utf8");

test("consultant supports multiple Indian languages", () => {
  assert.match(languages, /Telugu/);
  assert.match(languages, /Hindi/);
  assert.match(steps, /INTERVIEW_STEPS/);
  assert.match(steps, /website_type/);
});

test("interview API persists structured intake and may call Gemini", () => {
  assert.match(api, /requirement_report/);
  assert.match(api, /completeAI/);
  assert.match(api, /STRUCTURED INTAKE/);
  assert.match(api, /demo_requested_at/);
});

test("client portal mounts interview wizard before free chat", () => {
  assert.match(client, /InterviewWizard/);
  assert.match(wizard, /Submit & chat with AI/);
  assert.match(client, /intakeDone/);
});
