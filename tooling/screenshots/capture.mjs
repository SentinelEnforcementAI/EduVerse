// Captures the platform tour: signs in as each demo role (using the session
// cookies minted by demo-tour-context) and screenshots every screen into
// docs/demo/tour/screens as compressed JPEGs.
//
// Reads its context from tooling/screenshots/.context.json (produced by the
// `demo:tour` pipeline). Requires a local app running at APP_URL and a demo
// database seeded via `db:seed:demo`. See README.md.
//
// Chromium: uses Playwright's resolved browser by default. In sandboxes where
// that path differs, set PW_CHROMIUM to the chrome binary.

import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const OUT = resolve(repoRoot, "docs/demo/tour/screens");
mkdirSync(OUT, { recursive: true });

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const ctx = JSON.parse(readFileSync(resolve(here, ".context.json"), "utf8"));
const { sessions, schoolId, caseSignalId, docId } = ctx;

const roleLabel = {
  director: "Director of Safeguarding",
  dsl: "School DSL",
  admin: "Trust administrator",
  public: "Signed out",
};

// [role, filename, path]. A missing dynamic id skips that shot rather than 404.
const school = `/dashboard/school/${schoolId}`;
const SHOTS = [
  ["public", "00-sign-in", "/sign-in"],
  ["director", "01-trust-overview", "/dashboard/trust"],
  ["director", "02-schools", "/dashboard/schools"],
  ["director", "03-trust-concerns", "/dashboard/trust/triage/active"],
  ["director", "04-reports", "/dashboard/reports"],
  ["director", "05-insights", "/dashboard/insights"],
  ["director", "06-alerts", "/dashboard/alerts"],
  ["director", "07-governance", "/dashboard/governance"],
  ["director", "08-oncall", "/dashboard/oncall"],
  ["director", "09-audit-log", "/dashboard/audit"],
  ["director", "10-trust-inspection", "/dashboard/trust/inspection"],
  ["director", "11-trust-kcsie", "/dashboard/trust/kcsie"],
  ["director", "12-search", "/dashboard/search?q=year%208"],
  ["dsl", "13-school-overview", school],
  ["dsl", "14-school-concerns", `${school}/triage/active`],
  caseSignalId && ["dsl", "15-case-detail", `${school}/case/${caseSignalId}`],
  ["dsl", "16-documents", `${school}/documents`],
  docId && ["dsl", "17-document-reader", `${school}/documents/${docId}`],
  ["dsl", "18-intake", `${school}/intake`],
  ["dsl", "19-school-kcsie", `${school}/kcsie`],
  ["dsl", "20-school-inspection", `${school}/inspection`],
  ["admin", "21-admin-onboarding", "/dashboard/admin/onboarding"],
  ["admin", "22-admin-users", "/dashboard/admin/users"],
  ["admin", "23-admin-rules", "/dashboard/admin/rules"],
  ["admin", "24-admin-billing", "/dashboard/admin/billing"],
].filter(Boolean);

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);

async function contextFor(role) {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  if (role !== "public") {
    await c.addCookies([
      {
        name: "sw_session",
        value: sessions[role],
        domain: new URL(BASE).hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  }
  return c;
}

let ok = 0;
const problems = [];
for (const [role, name, path] of SHOTS) {
  const c = await contextFor(role);
  const page = await c.newPage();
  try {
    const resp = await page.goto(BASE + path, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    await page.waitForTimeout(600);
    const status = resp ? resp.status() : 0;
    const landed = page.url().includes(path.split("?")[0]);
    await page.screenshot({
      path: `${OUT}/${name}.jpg`,
      fullPage: true,
      type: "jpeg",
      quality: 72,
    });
    if (status !== 200 || !landed) {
      problems.push(`${name}: ${status}${landed ? "" : " (redirected)"}`);
    } else {
      ok++;
    }
    console.log(`${status === 200 && landed ? "ok " : "!! "}${name} [${roleLabel[role]}] ${status}`);
  } catch (e) {
    problems.push(`${name}: ${e.message}`);
    console.log(`!! ${name}: ${e.message}`);
  } finally {
    await c.close();
  }
}

await browser.close();
console.log(`\n${ok}/${SHOTS.length} captured into docs/demo/tour/screens`);
if (problems.length) {
  console.log("problems:\n  " + problems.join("\n  "));
  process.exit(1);
}
