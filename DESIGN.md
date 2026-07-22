# DESIGN.md v2 — Sentinel Watch UI

Supersedes v1 entirely (forest/cream palette is retired). Read alongside CLAUDE.md. Reference mocks live in /design/mocks/. Brand assets (logos, marks, app icon) live in /public/brand/ — use the provided SVGs, never recreate the mark.

## Brand palette (exact — no other colours)
- `--ink` #0A0B0D — primary text, dark surfaces, logo-black contexts
- `--paper` #F6F7F9 — app background
- `--cloud` #E8EBF0 — borders, dividers, card outlines, table rules, muted fills
- `--cobalt` #3157FF — primary brand. Buttons, active nav, links, focus rings, primary data series
- `--signal-lime` #C8FF4A — accent only. Highlights, selected states on dark, marketing moments. Never for risk meaning, never as text on light backgrounds (fails contrast)
- `--risk-red` #FF4D4D — high risk only
- `--warning-amber` #FFB020 — medium risk only
- `--success-green` #16A36A — resolved/monitor/positive trend only

Status colour discipline:
1. Red, amber and green carry risk meaning exclusively. They never appear decoratively. A red element means high risk on a child — nothing else on screen may be red.
2. Status colours appear as tints/pills/dots with ink or white text meeting AA — red and amber as small text-on-white fails or is marginal; use pill backgrounds or bold dots + labels.
3. Cobalt is the workhorse: all interactive elements, charts that show volume rather than risk, progress bars.
4. Every status colour is paired with a text label (HIGH RISK, MEDIUM, MONITOR). Never colour alone.

## Surfaces
- White cards on paper background, 1px cloud borders, 8-12px radius, shadows minimal or none (mocks use borders, not shadows — follow that).
- Sidebar: white, cobalt tint (#3157FF at ~8%) for active item with cobalt text/icon.
- Dark surfaces (ink) reserved for auth screens, app icon contexts, and marketing — the working app stays light.

## Typography
- Single sans throughout (Inter or the geometric sans in the brand lockup — founder to confirm; default Inter). Playfair Display is retired from product UI.
- Weights: 400 body, 500 labels/nav, 600 headings/KPI numbers. Nothing heavier in-app.
- Scale: 12 metadata / 13 table body / 14 body / 16 card titles / 20 section / 28 page title. KPI stat numbers 28-32, weight 600, tabular-nums.

## Layout (per mocks)
- Left sidebar nav, collapsible, org switcher pinned at bottom.
- Page header: title + context switcher (trust/school), date-range picker, export, notifications, profile.
- KPI stat row at top of overview pages: value, label, 7-day delta with direction arrow (delta colour reflects whether the change is good, not just up/down — rising high-risk is red, rising resolved is green).
- 12-col grid, 24px gutters, max width 1440px.

## Component rules
- **Risk indication:** severity pill (tinted background + label) plus position/ordering. No numeric risk scores anywhere in DSL-facing UI — severity bands only (High / Medium / Monitor), each expandable to its full reasoning. See CLAUDE.md principle 3.
- **Pupil identity:** initials avatars generated from name, cobalt-tinted. No photographs of children anywhere in the product. (Mocks show photos — do not implement.)
- **AI-generated content:** distinct treatment retained from v1 — cloud left border, "AI-generated · advisory" label. Never styled as system fact.
- **Signal/alert rows:** severity pill, pupil, one-line reasoning, school (in trust views), age of signal, chevron. Whole row clickable.
- **Case workspace:** 5-stage progress (Concern Raised → Assessment → Intervention → Review → Closed), cobalt for completed/current stage markers, summary left, next steps right, Add Case Note as primary action.
- **Charts:** cobalt for neutral/volume series; red/amber/green strictly for risk-banded series; lime never in charts. Donut centre shows total. Sparklines coloured by trend meaning.
- **Buttons:** primary cobalt fill/white text; secondary white/cloud border/ink text; destructive-adjacent (Dismiss) outline ink — never red (red is for children at risk, not UI actions).
- **Empty states:** calm, affirmative, no illustration clutter.

## Accessibility floor (unchanged)
- WCAG 2.1 AA. Known traps in this palette: lime on white, red/amber as small text. Resolve with pills, dots, weight.
- Full keyboard navigation, cobalt 2px focus ring, 44px touch targets, severity never by colour alone.

## What not to do
- No photos of pupils. No numeric risk scores in UI. No red outside high-risk meaning.
- No engagement/gamification UI. Trust-level aggregate metrics (resolved this week) are fine; per-DSL performance counters are not.
- No gradients, no glassmorphism. Borders over shadows.
