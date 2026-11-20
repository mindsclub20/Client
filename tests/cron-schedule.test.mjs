import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = JSON.parse(
  await readFile(new URL("../vercel.json", import.meta.url), "utf8")
);

test("Vercel schedules MAXWEB conversation summaries daily at 05:30 IST", () => {
  const jobs = config.crons.filter(
    (job) => job.path === "/api/cron/summarize-conversations"
  );

  assert.equal(jobs.length, 1);
  assert.deepEqual(jobs[0], {
    path: "/api/cron/summarize-conversations",
    schedule: "0 0 * * *",
  });
});
