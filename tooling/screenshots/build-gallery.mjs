// Builds the platform-tour gallery from the screens in docs/demo/tour/screens.
//
//   node build-gallery.mjs           → docs/demo/tour/gallery.html
//        (thin: <img> src references screens/*.jpg — small, viewable on GitHub)
//   node build-gallery.mjs --embed OUT.html
//        (self-contained: images inlined as data URIs — for sharing/hosting)
//
// The section copy below is the written feature rundown; keep it in step with
// the product as screens are added.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const SCREENS = resolve(repoRoot, "docs/demo/tour/screens");

const embed = process.argv.includes("--embed");
const outArg = process.argv[process.argv.indexOf("--embed") + 1];
const OUT = embed
  ? resolve(process.cwd(), outArg)
  : resolve(repoRoot, "docs/demo/tour/gallery.html");

const src = (f) =>
  embed
    ? "data:image/jpeg;base64," +
      readFileSync(`${SCREENS}/${f}.jpg`).toString("base64")
    : `screens/${f}.jpg`;

const roleLabel = {
  director: "Director of Safeguarding",
  dsl: "School DSL",
  admin: "Trust administrator",
  public: "Signed out",
};

const sections = [
  {
    id: "core",
    kicker: "The core loop",
    title: "A signal, its reasoning, and a human decision",
    lede: "Everything funnels to this screen. The risk engine flags a pattern; the DSL sees exactly why, with every underlying data point; and the DSL — never the system — decides what happens next.",
    shots: [
      { f: "15-case-detail", role: "dsl", path: "/case", cap: "The case view. Identity is <strong>sealed by default</strong> (“Pupil 0013”; reveal is a deliberate, audited action). “What Watch sees” traces every indicator to its source record. The decision panel is explicit that <strong>Watch never closes a case</strong> — referral, case file, pastoral review and case notes sit under the DSL’s hand, and a communications thread (outbound + captured replies) files onto the case." },
    ],
  },
  {
    id: "trust",
    kicker: "Trust command",
    title: "The whole trust on one screen",
    lede: "A Director of Safeguarding oversees every school in the trust — with cross-school pattern intelligence no single school can see. The role boundary is enforced at the database with row-level security, not hidden in the UI.",
    shots: [
      { f: "01-trust-overview", role: "director", path: "/dashboard/trust", cap: "Trust overview — pupils, active concerns, and a decision queue across five schools, with <strong>cross-school pattern intelligence</strong> that surfaces the same concern in the same year group across multiple schools at once." },
      { f: "03-trust-concerns", role: "director", path: "/trust/triage", cap: "The trust-wide triage queue, ordered by escalation level — every concern awaiting a decision, across the whole trust." },
      { f: "02-schools", role: "director", path: "/dashboard/schools", cap: "Five schools, each an isolated tenant. One database, tenant-scoped, RLS-enforced." },
      { f: "05-insights", role: "director", path: "/dashboard/insights", cap: "Insights — trends across the trust, for governors and safeguarding leads." },
      { f: "04-reports", role: "director", path: "/dashboard/reports", cap: "Board- and governor-ready reporting." },
    ],
  },
  {
    id: "school",
    kicker: "The school desk",
    title: "Everything a DSL works from",
    lede: "A school DSL sees only their own school. The desk brings the concern queue, the case file, the document library and the compliance surfaces into one place.",
    shots: [
      { f: "13-school-overview", role: "dsl", path: "/dashboard/school", cap: "The school overview — the DSL’s Monday-morning picture." },
      { f: "14-school-concerns", role: "dsl", path: "/triage/active", cap: "The concern queue with status tabs — awaiting a decision, confirmed, escalated, dismissed. Every transition is audited." },
      { f: "16-documents", role: "dsl", path: "/documents", cap: "The document library — MASH responses, training certificates, filed correspondence." },
      { f: "17-document-reader", role: "dsl", path: "/documents/…", cap: "The in-app document reader." },
      { f: "19-school-kcsie", role: "dsl", path: "/kcsie", cap: "KCSIE 2024 compliance — evidence and tasks mapped to the statutory framework." },
      { f: "20-school-inspection", role: "dsl", path: "/inspection", cap: "Inspection view — the evidence an Ofsted conversation needs, on demand." },
    ],
  },
  {
    id: "email",
    kicker: "Email mission control",
    title: "No concern lost in an inbox",
    lede: "Safeguarding mail is captured, auto-threaded onto the right case where it matches, and everything else lands in an intake queue for a human to place — nothing slips through the gaps. Outbound is drafted by the DSL and sent from the case; the platform never sends anything itself.",
    shots: [
      { f: "18-intake", role: "dsl", path: "/intake", cap: "The intake queue. Inbound mail that couldn’t be matched automatically waits here — the DSL assigns each to the right case (filing it as a message on that case) or dismisses it. Matching uses the thread or a <strong>sealed pupil reference</strong>, never a name in plain text. The live mailbox connection is a documented, DPIA-gated stub until sign-off." },
    ],
  },
  {
    id: "ops",
    kicker: "Safeguarding operations",
    title: "Alerts, governance, audit, out-of-hours",
    lede: "The surrounding operational surfaces — how serious signals reach a person, how the trust assures itself, and the append-only record underneath it all.",
    shots: [
      { f: "06-alerts", role: "director", path: "/dashboard/alerts", cap: "Serious-signal alerts — the most urgent concerns escalated to a person, sealed and audited." },
      { f: "07-governance", role: "director", path: "/dashboard/governance", cap: "Governance and assurance — the trust’s safeguarding posture at a glance." },
      { f: "08-oncall", role: "director", path: "/dashboard/oncall", cap: "The out-of-hours on-call view." },
      { f: "09-audit-log", role: "director", path: "/dashboard/audit", cap: "The append-only audit log — who read or wrote what, when, and why. Safeguarding records are never hard-deleted." },
      { f: "12-search", role: "director", path: "/dashboard/search", cap: "Search across pupils, concerns and schools." },
      { f: "10-trust-inspection", role: "director", path: "/trust/inspection", cap: "Trust-level inspection readiness." },
      { f: "11-trust-kcsie", role: "director", path: "/trust/kcsie", cap: "KCSIE compliance rolled up across the trust." },
    ],
  },
  {
    id: "admin",
    kicker: "Commercialisation · administration",
    title: "Ready to onboard, meter, and tune per customer",
    lede: "The commercialisation layer that turns the product into something a trust can be sold, set up on, and billed for — self-serve for a trust administrator, all audited.",
    shots: [
      { f: "21-admin-onboarding", role: "admin", path: "/admin/onboarding", cap: "Guided onboarding — add schools, invite safeguarding leads, and <strong>connect Wonde</strong> to bring in attendance, behaviour and attainment. The platform only ever <em>reads</em> from the MIS; the live connect is DPIA-gated." },
      { f: "22-admin-users", role: "admin", path: "/admin/users", cap: "User management — invite-only accounts, role assignment (director / DSL / admin) and deactivation, every action audited." },
      { f: "23-admin-rules", role: "admin", path: "/admin/rules", cap: "Per-trust rule tuning — the thresholds the risk engine uses to raise a concern, adjustable per trust. The engine still runs first, always; these change only when a rule <em>fires</em>, never whether a human decides." },
      { f: "24-admin-billing", role: "admin", path: "/admin/billing", cap: "Metered billing — cost per pupil plus a flat trust fee, metered from live pupil numbers, every snapshot audited." },
    ],
  },
  {
    id: "access",
    kicker: "Access",
    title: "Invite-only, magic-link sign-in",
    lede: "There is no open sign-up. Accounts are provisioned; sign-in is an emailed magic link, structured so school SSO can replace it later without a schema change.",
    shots: [
      { f: "00-sign-in", role: "public", path: "/sign-in", cap: "The sign-in screen — request a magic link, invite-only." },
    ],
  },
];

const principles = [
  ["Human-in-the-loop", "The system flags. A person always decides. Enforced in schema and code, not copy."],
  ["UK data residency", "All data and inference stays in AWS London. No pupil data leaves UK infrastructure."],
  ["Explainability", "Every signal carries its reasoning — which rule fired, on which data points."],
  ["Full audit", "Every read and write against a child’s record is logged. Append-only. Soft-delete only."],
  ["Overlay-first", "Reads from source systems via Wonde. Never writes back to the school’s MIS."],
];

const stat = [
  ["5", "schools in the demo trust"],
  ["1,100", "synthetic pupils, 12 months of data"],
  ["3", "roles — director, DSL, administrator"],
  ["24", "screens, all running software"],
];

const figure = (s) => `
    <figure class="shot">
      <div class="frame">
        <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="chip">${roleLabel[s.role]}</span><span class="loc">${s.path}</span>
        </div>
        <button class="imgbtn" data-full="${s.f}" aria-label="Expand screenshot">
          <img loading="lazy" src="${src(s.f)}" alt="${s.f}">
        </button>
      </div>
      <figcaption>${s.cap}</figcaption>
    </figure>`;

const section = (sec) => `
  <section class="sec" id="${sec.id}">
    <header class="sechead">
      <p class="kicker">${sec.kicker}</p>
      <h2>${sec.title}</h2>
      <p class="lede">${sec.lede}</p>
    </header>
    <div class="grid${sec.shots.length === 1 ? " one" : ""}">${sec.shots.map(figure).join("")}</div>
  </section>`;

const nav = sections
  .map((s) => `<a href="#${s.id}">${s.kicker.split(" ·")[0]}</a>`)
  .join("");

const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>Sentinel Watch — platform tour</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root{
    --bg:#f6f7fb; --panel:#fff; --ink:#141726; --muted:#5b6072;
    --line:#e6e8f0; --line-2:#eef0f6;
    --accent:#4f46e5; --accent-soft:#eef0ff; --accent-ink:#3730a3;
    --shadow:0 1px 2px rgba(20,23,38,.04),0 8px 28px rgba(20,23,38,.06);
    --maxw:1120px;
    --sans:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  }
  @media (prefers-color-scheme:dark){:root{
    --bg:#0c0e16;--panel:#151826;--ink:#eceefb;--muted:#9aa0b6;--line:#242840;
    --line-2:#1c2032;--accent:#8b8cf8;--accent-soft:#1c1f39;--accent-ink:#c3c4fb;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 34px rgba(0,0,0,.45);}}
  :root[data-theme="dark"]{
    --bg:#0c0e16;--panel:#151826;--ink:#eceefb;--muted:#9aa0b6;--line:#242840;
    --line-2:#1c2032;--accent:#8b8cf8;--accent-soft:#1c1f39;--accent-ink:#c3c4fb;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 34px rgba(0,0,0,.45);}
  :root[data-theme="light"]{
    --bg:#f6f7fb;--panel:#fff;--ink:#141726;--muted:#5b6072;--line:#e6e8f0;
    --line-2:#eef0f6;--accent:#4f46e5;--accent-soft:#eef0ff;--accent-ink:#3730a3;
    --shadow:0 1px 2px rgba(20,23,38,.04),0 8px 28px rgba(20,23,38,.06);}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);
    line-height:1.6;-webkit-font-smoothing:antialiased}
  .wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}
  .top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 82%,transparent);
    backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
  .top .wrap{display:flex;align-items:center;gap:20px;height:56px}
  .brand{display:flex;align-items:center;gap:10px;font-weight:650;letter-spacing:-.01em}
  .brand .mk{width:20px;height:20px;border-radius:6px;
    background:conic-gradient(from 210deg,var(--accent),#8b8cf8 60%,var(--accent));
    box-shadow:inset 0 0 0 3px var(--panel)}
  .topnav{margin-left:auto;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}
  .topnav::-webkit-scrollbar{display:none}
  .topnav a{font-size:13px;color:var(--muted);text-decoration:none;padding:6px 10px;
    border-radius:8px;white-space:nowrap}
  .topnav a:hover{color:var(--ink);background:var(--line-2)}
  .hero{padding:72px 0 40px}
  .eyebrow{font:600 12px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;
    color:var(--accent);margin:0 0 18px}
  .hero h1{font-size:clamp(32px,5vw,52px);line-height:1.05;letter-spacing:-.03em;
    margin:0 0 18px;text-wrap:balance;font-weight:680}
  .hero p{font-size:clamp(16px,2vw,19px);color:var(--muted);max-width:64ch;margin:0}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:40px 0 8px}
  .stat{background:var(--panel);border:1px solid var(--line);border-radius:14px;
    padding:18px 20px;box-shadow:var(--shadow)}
  .stat b{display:block;font-size:26px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .stat span{font-size:12.5px;color:var(--muted)}
  @media(max-width:720px){.stats{grid-template-columns:repeat(2,1fr)}}
  .principles{border-top:1px solid var(--line);border-bottom:1px solid var(--line);
    background:var(--panel);margin-top:36px}
  .principles .wrap{display:grid;grid-template-columns:repeat(5,1fr);gap:0;padding:0}
  .pr{padding:26px 22px;border-left:1px solid var(--line-2)}
  .pr:first-child{border-left:0}
  .pr h3{margin:0 0 6px;font-size:14px;letter-spacing:-.01em}
  .pr p{margin:0;font-size:12.5px;color:var(--muted);line-height:1.5}
  @media(max-width:900px){.principles .wrap{grid-template-columns:repeat(2,1fr)}
    .pr{border-left:0;border-top:1px solid var(--line-2)}
    .pr:first-child,.pr:nth-child(2){border-top:0}}
  @media(max-width:520px){.principles .wrap{grid-template-columns:1fr}}
  .sec{padding:64px 0}
  .sec+.sec{border-top:1px solid var(--line)}
  .sechead{max-width:70ch}
  .kicker{font:600 12px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;
    color:var(--accent);margin:0 0 14px}
  .sechead h2{font-size:clamp(24px,3.4vw,34px);letter-spacing:-.025em;margin:0 0 14px;
    text-wrap:balance;font-weight:660}
  .lede{font-size:16.5px;color:var(--muted);margin:0}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px;margin-top:40px}
  .grid.one{grid-template-columns:1fr;max-width:940px}
  @media(max-width:760px){.grid{grid-template-columns:1fr}}
  .shot{margin:0;display:flex;flex-direction:column;gap:14px}
  .frame{border:1px solid var(--line);border-radius:14px;overflow:hidden;
    background:var(--panel);box-shadow:var(--shadow)}
  .bar{display:flex;align-items:center;gap:7px;padding:10px 14px;
    border-bottom:1px solid var(--line-2);background:var(--panel)}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--line);flex:none}
  .chip{margin-left:8px;font-size:11px;font-weight:600;color:var(--accent-ink);
    background:var(--accent-soft);border-radius:999px;padding:3px 9px;white-space:nowrap}
  .loc{margin-left:auto;font:12px var(--mono);color:var(--muted);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40%}
  .imgbtn{display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in}
  .imgbtn img{display:block;width:100%;height:auto;max-height:560px;object-fit:cover;
    object-position:top}
  .grid.one .imgbtn img{max-height:none}
  figcaption{font-size:13.5px;color:var(--muted);line-height:1.55;padding:0 2px}
  figcaption strong{color:var(--ink);font-weight:600}
  figcaption em{color:var(--accent-ink);font-style:normal;font-weight:500}
  .lb{position:fixed;inset:0;z-index:50;background:rgba(8,9,15,.86);display:none;
    padding:28px;overflow:auto}
  .lb.open{display:block}
  .lb img{display:block;max-width:1200px;width:100%;margin:0 auto;border-radius:10px;
    box-shadow:0 20px 60px rgba(0,0,0,.5)}
  .lb .x{position:fixed;top:18px;right:22px;font:600 14px var(--sans);color:#fff;
    background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);
    border-radius:999px;padding:8px 16px;cursor:pointer}
  footer{border-top:1px solid var(--line);padding:40px 0 64px;color:var(--muted);font-size:13px}
  .foot{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .tag{font:11px var(--mono);letter-spacing:.04em;border:1px solid var(--line);
    border-radius:999px;padding:4px 10px;color:var(--muted)}
  html{scroll-behavior:smooth}
  @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
  :focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}
</style>
</head>
<body>
<div class="top"><div class="wrap">
  <div class="brand"><span class="mk"></span> Sentinel Watch</div>
  <nav class="topnav">${nav}</nav>
</div></div>
<header class="hero"><div class="wrap">
  <p class="eyebrow">Platform tour · design-partner MVP</p>
  <h1>Safeguarding intelligence for UK schools and trusts.</h1>
  <p>Sentinel Watch reads the data schools already hold — attendance, behaviour, attainment, pastoral — connects the dots a busy DSL cannot, and surfaces the child who needs attention, with the reasoning attached, days before the next scheduled meeting would have caught it. The system flags; a human always decides. Every screen below is running software against a seeded database — not mockups, and not a real child.</p>
  <div class="stats">${stat.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("")}</div>
</div></header>
<div class="principles"><div class="wrap">${principles.map(([h, p]) => `<div class="pr"><h3>${h}</h3><p>${p}</p></div>`).join("")}</div></div>
<main class="wrap">${sections.map(section).join("")}</main>
<footer><div class="wrap foot">
  <span>Sentinel Watch — design-partner MVP.</span>
  <span class="tag">KCSIE 2024 aligned</span>
  <span class="tag">UK GDPR</span>
  <span class="tag">Data residency: UK (eu-west-2)</span>
  <span class="tag">Synthetic data only</span>
</div></footer>
<div class="lb" id="lb"><button class="x" id="lbx">Close ✕</button><img id="lbimg" alt=""></div>
<script>
  const map={};
  document.querySelectorAll(".imgbtn").forEach(b=>{map[b.dataset.full]=b.querySelector("img").src;});
  const lb=document.getElementById("lb"),lbimg=document.getElementById("lbimg");
  document.querySelectorAll(".imgbtn").forEach(b=>b.addEventListener("click",()=>{
    lbimg.src=map[b.dataset.full];lb.classList.add("open");document.body.style.overflow="hidden";}));
  function close(){lb.classList.remove("open");document.body.style.overflow="";lbimg.src="";}
  document.getElementById("lbx").addEventListener("click",close);
  lb.addEventListener("click",e=>{if(e.target===lb)close();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
</script>
</body>
</html>`;

writeFileSync(OUT, html);
console.log(`wrote ${OUT} (${(html.length / 1024 / 1024).toFixed(2)} MB, ${embed ? "embedded" : "thin"})`);
