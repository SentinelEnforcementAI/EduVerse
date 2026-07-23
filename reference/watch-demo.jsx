import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldPlus, ShieldCheck, Users, AlertTriangle, TrendingUp, Activity,
  Calendar, User, FileText, GraduationCap, Clock, ChevronDown, ChevronRight,
  ArrowRight, X, Copy, Check, Download, Send, Building2, Eye,
  Brain, Network, ClipboardList, RefreshCw, Heart, Loader2, FolderOpen,
  CheckCircle2, Lock, Unlock, Bell, Moon
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

/* Brand tokens */
const C = {
  bg: '#0c1c13', card: '#13261a', card2: '#173120',
  border: 'rgba(244,237,224,0.09)', borderS: 'rgba(244,237,224,0.18)',
  cream: '#f4ede0', dim: 'rgba(244,237,224,0.60)', faint: 'rgba(244,237,224,0.38)',
  amber: '#e8920a', amberB: '#f5a623', amberSoft: 'rgba(232,146,10,0.12)',
  red: '#d05a3e', redSoft: 'rgba(208,90,62,0.12)', green: '#5f9e72',
};
const PF = "'Playfair Display', Georgia, serif";
const LT = "'Lato', system-ui, -apple-system, sans-serif";
// Sample placeholder names only. Not real people. Swap freely.
const SCHOOL_DSL = 'Priya Sharma';
const DIRECTOR = 'Louise Hartley';
const DSL_BY_SCHOOL = {
  'Bennett Memorial': 'Priya Sharma',
  'Rusthall Academy': 'Daniel Fielding',
  "St Gregory's CofE": 'Anita Brar',
  'Hillview Primary': 'Megan Ellory',
  'Tonbridge Grange': 'Stephen Marsh',
  'Maidstone Park': 'Yusuf Adeyemi',
  'Westgate Junior': 'Caroline Stiles',
  'Edenbridge Primary': 'Rachel Coombe',
};
function dslFor(school) { return DSL_BY_SCHOOL[school] || SCHOOL_DSL; }
function initialsOf(name) { const n = name.trim().split(' '); return n[0][0] + '. ' + n[n.length - 1]; }
function dslInitials(school) { return initialsOf(dslFor(school)); }

// Synthetic pupil names. Revealed only once a case crosses the action threshold.
const PUPIL_NAMES = {
  '4471': 'Aiden Cole', '3328': 'Maya Holt', '5210': 'Ryan Pearce', '6187': 'Chloe Dunn',
  '2207': 'Jordan Hayes', '5512': 'Tyler Bond',
  'p-att-primary': 'Sophie Lane', 'p-welfare-primary': 'Riley Frost', 'p-wellbeing-primary': 'Noah Webb',
  'p-behaviour': 'Kai Reynolds', 'p-wellbeing-sec': 'Ella Hughes', 'p-peer': 'Mason Reid',
  'p-online-serious': 'Hannah Shaw',
};
// Identity unlocks at the action threshold: targeted, specialist, or any serious case.
function canReveal(c) { return c.escalation.level >= 3 || !!c.serious; }
const REVEAL_REASONS = ['Required for a referral', 'Required for parental contact', 'Safeguarding decision recorded'];

// Days Watch surfaced the pattern ahead of a manual process. Synthetic, illustrative.
const DETECTION = {
  '4471': 9, '3328': 7, '5210': 6, '6187': 11, '2207': 6, '5512': 14,
  'p-att-primary': 8, 'p-welfare-primary': 10, 'p-wellbeing-primary': 7,
  'p-behaviour': 6, 'p-wellbeing-sec': 9, 'p-peer': 5, 'p-online-serious': 4,
};
function detectionDays(id) { return DETECTION[id] || 7; }
function detectionVs(c) {
  if (c.serious || c.escalation.level >= 4) return 'the next scheduled safeguarding meeting';
  if (c.escalation.level === 3) return 'a half-termly multi-agency review';
  return 'a routine half-termly pastoral review';
}
function avgDetection(ids) {
  if (!ids || !ids.length) return 8;
  return Math.round(ids.reduce((s, id) => s + detectionDays(id), 0) / ids.length);
}
// Proportionate review date relative to the demo date (28 April 2026).
function reviewByFor(c) {
  if (c.serious || c.escalation.level >= 4) return '29 April 2026 (next working day)';
  if (c.escalation.level === 3) return '2 May 2026 (within 5 working days)';
  return '12 May 2026 (within 10 working days)';
}
function reviewSlots(c) {
  if (c.serious || c.escalation.level >= 4) return ['Tomorrow, 29 Apr · 09:00', 'Tomorrow, 29 Apr · 11:30', 'Tomorrow, 29 Apr · 15:00'];
  if (c.escalation.level === 3) return ['Tomorrow, 29 Apr · 14:00', 'Thu 1 May · 10:00', 'Fri 2 May · 09:30'];
  return ['Thu 1 May · 10:00', 'Mon 6 May · 14:00', 'Wed 8 May · 11:00'];
}
function reviewWindow(c) {
  if (c.serious || c.escalation.level >= 4) return 'the next working day';
  if (c.escalation.level === 3) return '5 working days';
  return '10 working days';
}

// KCSIE annual compliance cycle. Synthetic, illustrative statuses per school.
const KCSIE_STATUS = { ok: { label: 'Up to date', color: '#5f9e72' }, due: { label: 'Action due', color: '#e8920a' }, gap: { label: 'Gap', color: '#d05a3e' } };
function kcsieTier(id) {
  if (id === 'rusthall') return 'pending';
  if (id === 'tonbridge' || id === 'hillview') return 'upcoming';
  return 'ok';
}
function kcsieFor(id) {
  const s = (typeof TRUST !== 'undefined' && TRUST.schools.find(x => x.id === id)) || { pupils: '1,000' };
  const pupils = parseInt(String(s.pupils || '1000').replace(/,/g, '')) || 1000;
  const staff = Math.max(20, Math.round(pupils / 8));
  const tier = kcsieTier(id);
  let comps;
  if (tier === 'ok') {
    comps = [
      { label: 'Safeguarding policy annual review', status: 'ok', detail: 'Reviewed 6 Sep 2025, aligned to KCSIE 2024', due: 'Next due Sep 2026' },
      { label: 'Staff read KCSIE Part 1', status: 'ok', detail: `${staff} of ${staff} staff acknowledged`, due: '100% complete' },
      { label: 'Single Central Record', status: 'ok', detail: 'Complete, no gaps', due: 'Last checked 21 Apr 2026' },
      { label: 'DSL training (2-yearly)', status: 'ok', detail: 'In date', due: 'Renews Mar 2027' },
      { label: 'Whole-staff safeguarding training', status: 'ok', detail: 'Completed Sep 2025', due: 'Next due Sep 2026' },
      { label: 'Governor safeguarding training', status: 'ok', detail: 'In date', due: 'Renews Nov 2026' },
      { label: 'Section 175 self-assessment', status: 'ok', detail: 'Submitted to the local authority', due: 'Submitted 12 Mar 2026' },
    ];
  } else if (tier === 'upcoming') {
    const done = Math.round(staff * 0.95);
    comps = [
      { label: 'Safeguarding policy annual review', status: 'due', detail: 'Review window open', due: 'Due within 21 days' },
      { label: 'Staff read KCSIE Part 1', status: 'due', detail: `${done} of ${staff} staff acknowledged`, due: `${staff - done} outstanding` },
      { label: 'Single Central Record', status: 'ok', detail: 'Complete, no gaps', due: 'Last checked 18 Apr 2026' },
      { label: 'DSL training (2-yearly)', status: 'ok', detail: 'In date', due: 'Renews Jan 2027' },
      { label: 'Whole-staff safeguarding training', status: 'ok', detail: 'Completed Sep 2025', due: 'Next due Sep 2026' },
      { label: 'Governor safeguarding training', status: 'ok', detail: 'In date', due: 'Renews Oct 2026' },
      { label: 'Section 175 self-assessment', status: 'due', detail: 'Not yet started', due: 'Due to the LA by 30 May 2026' },
    ];
  } else {
    const done = Math.round(staff * 0.88);
    comps = [
      { label: 'Safeguarding policy annual review', status: 'due', detail: 'Overdue for review', due: 'Was due this month' },
      { label: 'Staff read KCSIE Part 1', status: 'due', detail: `${done} of ${staff} staff acknowledged`, due: `${staff - done} outstanding` },
      { label: 'Single Central Record', status: 'gap', detail: '1 pre-employment check outstanding', due: 'Action needed' },
      { label: 'DSL training (2-yearly)', status: 'due', detail: 'Expires soon', due: 'Renew before Jun 2026' },
      { label: 'Whole-staff safeguarding training', status: 'ok', detail: 'Completed Oct 2025', due: 'Next due Oct 2026' },
      { label: 'Governor safeguarding training', status: 'ok', detail: 'In date', due: 'Renews Dec 2026' },
      { label: 'Section 175 self-assessment', status: 'due', detail: 'Not yet started', due: 'Due to the LA by 30 May 2026' },
    ];
  }
  const overall = comps.some(c => c.status === 'gap') ? 'gap' : (comps.some(c => c.status === 'due') ? 'due' : 'ok');
  return { tier, overall, comps, staff };
}

// Reasons a DSL can close a flag as reviewed.
const DISMISS_REASONS = ['Spoke with pupil, no concern', 'Known context, already supported', 'Resolved, no further action'];

// Synthetic safeguarding teams per school, used for tagging and collaboration.
const STAFF = {
  bennett: [{ name: 'Priya Sharma', role: 'DSL' }, { name: 'Daniel Owusu', role: 'Deputy DSL' }, { name: 'Helen Carter', role: 'Headteacher' }, { name: 'Iris Quinn', role: 'SENCO' }],
  rusthall: [{ name: 'Daniel Fielding', role: 'DSL' }, { name: 'Sara Whitlock', role: 'Deputy DSL' }, { name: 'Mark Devlin', role: 'Headteacher' }, { name: 'Nadia Rahman', role: 'SENCO' }],
  stgregory: [{ name: 'Anita Brar', role: 'DSL' }, { name: 'Paul Nemeth', role: 'Deputy DSL' }, { name: 'Grace Mbeki', role: 'Headteacher' }, { name: 'Liam Doyle', role: 'SENCO' }],
  hillview: [{ name: 'Megan Ellory', role: 'DSL' }, { name: 'Owen Pryce', role: 'Deputy DSL' }, { name: 'Ruth Hale', role: 'Headteacher' }, { name: 'Femi Okonkwo', role: 'SENCO' }],
  tonbridge: [{ name: 'Stephen Marsh', role: 'DSL' }, { name: 'Claire Brennan', role: 'Deputy DSL' }, { name: 'Adam Salter', role: 'Headteacher' }, { name: 'Lena Boyd', role: 'SENCO' }],
  maidstone: [{ name: 'Yusuf Adeyemi', role: 'DSL' }, { name: 'Erin Kemp', role: 'Deputy DSL' }, { name: 'Neil Ferris', role: 'Headteacher' }, { name: 'Asha Patel', role: 'SENCO' }],
  westgate: [{ name: 'Caroline Stiles', role: 'DSL' }, { name: 'Joe Grant', role: 'Deputy DSL' }, { name: 'Astrid Larsson', role: 'Headteacher' }, { name: 'Chidi Nwosu', role: 'SENCO' }],
  edenbridge: [{ name: 'Rachel Coombe', role: 'DSL' }, { name: 'Hassan Ahmed', role: 'Deputy DSL' }, { name: 'Maria Vance', role: 'Headteacher' }, { name: 'Sadia Khan', role: 'SENCO' }],
};
function directory(schoolId, actor) {
  const school = (STAFF[schoolId] || []).filter(p => p.name !== actor);
  const others = TRUST.schools.filter(s => s.id !== schoolId).slice(0, 3).map(s => ({ name: dslFor(s.name), role: 'DSL, ' + s.name }));
  const trust = [{ name: DIRECTOR, role: 'Director of Safeguarding' }].filter(p => p.name !== actor).concat(others);
  return { school, trust };
}

const TREND = [
  { d: '30 Mar', v: 15 }, { d: '1 Apr', v: 16 }, { d: '3 Apr', v: 14 },
  { d: '5 Apr', v: 18 }, { d: '6 Apr', v: 20 }, { d: '8 Apr', v: 17 },
  { d: '10 Apr', v: 18 }, { d: '12 Apr', v: 22 }, { d: '13 Apr', v: 24 },
  { d: '15 Apr', v: 28 }, { d: '17 Apr', v: 31 }, { d: '19 Apr', v: 30 },
  { d: '20 Apr', v: 34 }, { d: '22 Apr', v: 44 }, { d: '24 Apr', v: 52 },
  { d: '25 Apr', v: 48 }, { d: '27 Apr', v: 45 },
];

const ICONS = { att: Calendar, pas: User, beh: Activity, send: FileText, well: Heart };

const CASES = {
  '4471': {
    ref: '#4471', year: 'Year 9', school: 'Bennett Memorial',
    headline: 'Attendance + behaviour pattern',
    sub: 'Three concerning signals across 14 days',
    confidence: 'High', window: '14 Apr — 28 Apr',
    timeline: [
      { date: '15 Apr', label: 'Attendance dip', src: 'Attendance / SIMS', text: '3 missed periods, no explanation', icon: 'att', tone: 'amber' },
      { date: '18 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Quieter than usual in form group', icon: 'pas', tone: 'red' },
      { date: '22 Apr', label: 'Behaviour shift', src: 'Behaviour / Bromcom', text: 'Two minor incidents in PE', icon: 'beh', tone: 'amber' },
      { date: '25 Apr', label: 'SEND review note', src: 'SEND / Bromcom', text: 'Concentration concerns flagged', icon: 'send', tone: 'amber' },
      { date: '27 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Mentioned home stress to TA', icon: 'pas', tone: 'red' },
    ],
    narrative: 'Individually, each signal is minor. Together, they describe a pupil whose attendance, mood, and behaviour have shifted in the same direction over a fortnight. Three of these five signals occurred outside school hours awareness.',
    recommend: ['Pastoral review within 48 hours', 'Consider parental contact and SENCO consultation'],
    interpretation: [
      { sig: '3 missed periods, no explanation', src: 'SIMS', mean: 'Unexplained absence is the earliest and most common indicator of an unmet need at home or in school.' },
      { sig: 'Quieter than usual in form group', src: 'Watch', mean: 'A change from this pupil\u2019s own baseline, not a fixed trait. The change itself is the signal.' },
      { sig: 'Two minor incidents in PE', src: 'Bromcom', mean: 'Low level behaviour shifts often express stress a pupil cannot yet put into words.' },
      { sig: 'Mentioned home stress to a TA', src: 'Watch', mean: 'A disclosure of pressure at home raises the weight of every other signal considerably.' },
    ],
    overall: 'On their own, none of these would trigger action. Watch links them because they move in the same direction, within the same fortnight, and three occurred outside structured staff awareness. This is a pupil to check on early, not to wait on.',
    escalation: {
      level: 2,
      route: ['Pastoral review (48h)', 'Parental / carer contact', 'SENCO consultation'],
      rationale: 'Signals point to an emerging need, not immediate risk of harm. The proportionate response is school-led Early Help with a SEND view, not a statutory referral. Watch will re-assess the level automatically if new signals are logged.',
    },
    comms: ['parent', 'senco', 'earlyhelp'],
    linked: [
      { icon: Users, label: 'Sibling', detail: 'Pupil 3328 \u2014 flagged this term', to: '3328' },
      { icon: GraduationCap, label: 'Year 9 cohort', detail: '4 active concerns' },
      { icon: Clock, label: 'Last DSL contact', detail: '6 weeks ago' },
    ],
  },

  '3328': {
    ref: '#3328', year: 'Year 7', school: 'Bennett Memorial',
    headline: 'Emotional wellbeing pattern',
    sub: 'Multiple low mood indicators over 10 days',
    confidence: 'Medium-High', window: '17 Apr — 27 Apr',
    timeline: [
      { date: '17 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Tearful at registration', icon: 'well', tone: 'red' },
      { date: '19 Apr', label: 'Lateness', src: 'Attendance / SIMS', text: 'Late three mornings running', icon: 'att', tone: 'amber' },
      { date: '22 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Withdrawn from friendship group', icon: 'pas', tone: 'red' },
      { date: '24 Apr', label: 'Behaviour shift', src: 'Behaviour / Bromcom', text: 'Left class without permission', icon: 'beh', tone: 'amber' },
      { date: '26 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Said "everything feels too much" to form tutor', icon: 'well', tone: 'red' },
    ],
    narrative: 'A consistent low mood pattern across ten days. The pupil has moved from tearful, to withdrawn, to expressing that they are not coping. Friendship withdrawal and lateness sit alongside the mood signals rather than separately from them.',
    recommend: ['Wellbeing check-in within 48 hours', 'Offer school counsellor and consider parental contact'],
    interpretation: [
      { sig: 'Tearful at registration', src: 'Watch', mean: 'A visible distress signal at the start of the day often points to something happening before school or at home.' },
      { sig: 'Withdrawn from friendship group', src: 'Watch', mean: 'Social withdrawal in Year 7 is a recognised early sign of low mood and reduced resilience.' },
      { sig: '"Everything feels too much"', src: 'Watch', mean: 'A direct statement of not coping. This is the pupil telling staff, in their own words, that support is needed now.' },
    ],
    overall: 'The trajectory matters more than any single note. A pupil moving steadily from upset to overwhelmed within ten days needs a warm, low-key conversation quickly, before the pattern hardens.',
    escalation: {
      level: 2,
      route: ['Wellbeing review (48h)', 'School counsellor referral', 'Parental / carer contact'],
      rationale: 'This is an emotional wellbeing need best met through pastoral support and counselling. If signals continue to escalate, Watch will flag a possible GP or CAMHS route for DSL consideration.',
    },
    comms: ['parent', 'wellbeing', 'earlyhelp'],
    linked: [
      { icon: GraduationCap, label: 'Year 7 cohort', detail: '6 active concerns' },
      { icon: User, label: 'Form tutor', detail: 'Two pastoral entries this month' },
      { icon: Clock, label: 'Last DSL contact', detail: 'No prior contact' },
    ],
  },

  '5210': {
    ref: '#5210', year: 'Year 10', school: 'Bennett Memorial',
    headline: 'Peer relationship pattern',
    sub: 'Increased conflict signals across 7 days',
    confidence: 'Medium', window: '21 Apr — 27 Apr',
    timeline: [
      { date: '21 Apr', label: 'Behaviour shift', src: 'Behaviour / Bromcom', text: 'Verbal altercation at break', icon: 'beh', tone: 'amber' },
      { date: '23 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Reported feeling targeted online', icon: 'pas', tone: 'red' },
      { date: '24 Apr', label: 'Behaviour shift', src: 'Behaviour / Bromcom', text: 'Refused to work with group', icon: 'beh', tone: 'amber' },
      { date: '26 Apr', label: 'Absence', src: 'Attendance / SIMS', text: 'Absent, reason unclear', icon: 'att', tone: 'amber' },
      { date: '27 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Asked to eat lunch in the library', icon: 'pas', tone: 'red' },
    ],
    narrative: 'A short, sharp cluster suggesting conflict with peers, with a possible online dimension. The pupil is starting to avoid shared spaces, which often follows a peer or bullying issue rather than a behaviour problem.',
    recommend: ['Pastoral review and restorative approach', 'Check anti-bullying and online safety procedures, consider parental contact'],
    interpretation: [
      { sig: 'Reported feeling targeted online', src: 'Watch', mean: 'An online element means the issue does not stop at the school gate. It needs the online safety lens, not just behaviour management.' },
      { sig: 'Refused to work with group', src: 'Bromcom', mean: 'Read alongside the conflict, this looks like avoidance of specific peers rather than general defiance.' },
      { sig: 'Asked to eat lunch in the library', src: 'Watch', mean: 'Withdrawing from social spaces is a classic protective response to peer conflict or bullying.' },
    ],
    overall: 'The behaviour entries on their own might read as low level disruption. Watch reads them with the pastoral notes and sees a pupil withdrawing to stay safe. The response is restorative and protective, not punitive.',
    escalation: {
      level: 2,
      route: ['Pastoral review', 'Anti-bullying procedure', 'Online safety review', 'Parental / carer contact'],
      rationale: 'Currently a peer and wellbeing matter for school-led resolution. If online harm is confirmed or images are involved, Watch will flag the online CSAE pathway and a possible MASH referral for DSL decision.',
    },
    comms: ['parent', 'antibully'],
    linked: [
      { icon: GraduationCap, label: 'Year 10 cohort', detail: '3 active concerns' },
      { icon: AlertTriangle, label: 'Prior incident', detail: 'Logged March, resolved' },
      { icon: Clock, label: 'Last DSL contact', detail: '11 weeks ago' },
    ],
  },

  '6187': {
    ref: '#6187', year: 'Year 8', school: 'Bennett Memorial',
    headline: 'Attendance + late pattern',
    sub: 'Persistent lateness and absence trend',
    confidence: 'High', window: '14 Apr — 27 Apr',
    timeline: [
      { date: '14 Apr', label: 'Lateness', src: 'Attendance / SIMS', text: 'Late four of five mornings', icon: 'att', tone: 'amber' },
      { date: '17 Apr', label: 'Absence', src: 'Attendance / SIMS', text: 'Unauthorised absence, afternoon', icon: 'att', tone: 'amber' },
      { date: '21 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Visibly tired in lessons', icon: 'pas', tone: 'red' },
      { date: '24 Apr', label: 'Attendance drop', src: 'Attendance / SIMS', text: 'Attendance fallen to 86%', icon: 'att', tone: 'amber' },
      { date: '27 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Mentioned caring for a sibling at home', icon: 'pas', tone: 'red' },
    ],
    narrative: 'A clear attendance decline with a possible young carer dimension. Lateness and tiredness point to responsibilities before school. The comment about caring for a sibling reframes the absence as a likely home circumstance, not disengagement.',
    recommend: ['Attendance support meeting this week', 'Parental contact and consider a young carer assessment via Early Help'],
    interpretation: [
      { sig: 'Late four of five mornings', src: 'SIMS', mean: 'Consistent morning lateness usually reflects what is happening at home before school, not attitude.' },
      { sig: 'Visibly tired in lessons', src: 'Watch', mean: 'Tiredness alongside lateness suggests an early start, disrupted sleep, or caring responsibilities.' },
      { sig: 'Caring for a sibling at home', src: 'Watch', mean: 'A likely young carer. This shifts the whole picture from attendance enforcement to family support.' },
    ],
    overall: 'A punitive attendance response here would miss the point and could make things worse. Watch surfaces the young carer signal so the school leads with support, and considers whether the family needs Early Help.',
    escalation: {
      level: 2,
      route: ['Attendance support meeting', 'Parental / carer contact', 'Young carer assessment', 'Early Help'],
      rationale: 'An emerging family need rather than a safeguarding emergency. Early Help with a young carer assessment is the proportionate route. Watch will raise the level if attendance continues to fall.',
    },
    comms: ['attendance', 'earlyhelp'],
    linked: [
      { icon: GraduationCap, label: 'Year 8 cohort', detail: '2 active concerns' },
      { icon: User, label: 'Attendance officer', detail: 'Monitoring since 14 Apr' },
      { icon: Clock, label: 'Last DSL contact', detail: '8 weeks ago' },
    ],
  },

  '2207': {
    ref: '#2207', year: 'Year 6', school: 'Rusthall Academy',
    headline: 'Welfare cluster with disclosure',
    sub: 'Five welfare indicators and a disclosure across 8 days',
    confidence: 'High', window: '20 Apr — 27 Apr', serious: true,
    timeline: [
      { date: '20 Apr', label: 'Attendance drop', src: 'Attendance / SIMS', text: 'Sudden drop, 5 sessions missed', icon: 'att', tone: 'red' },
      { date: '22 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Arrived hungry and unkempt', icon: 'pas', tone: 'red' },
      { date: '24 Apr', label: 'Behaviour shift', src: 'Behaviour / Bromcom', text: 'Withdrawn, flinched at a raised voice', icon: 'beh', tone: 'red' },
      { date: '26 Apr', label: 'Disclosure', src: 'Pastoral / Watch entry', text: 'Told a TA they "don\u2019t feel safe at home"', icon: 'pas', tone: 'red' },
      { date: '27 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Reluctant to go home at end of day', icon: 'pas', tone: 'red' },
    ],
    narrative: 'A cluster of welfare indicators, ending in a direct disclosure that the child does not feel safe at home. Hunger, presentation, a fear response, and reluctance to go home all point in the same direction. This meets the threshold for specialist intervention.',
    recommend: ['Same day MASH referral', 'Record the disclosure verbatim, inform the headteacher and DDSL, and consider whether informing parents would increase risk before any contact is made'],
    interpretation: [
      { sig: 'Arrived hungry and unkempt', src: 'Watch', mean: 'Possible neglect indicator. Read alone it is a welfare note; read in this cluster it carries far more weight.' },
      { sig: 'Flinched at a raised voice', src: 'Bromcom', mean: 'A fear response that can indicate exposure to anger or violence at home.' },
      { sig: '"Don\u2019t feel safe at home"', src: 'Watch', mean: 'A direct disclosure of feeling unsafe. This alone meets the threshold for a children\u2019s social care referral.' },
      { sig: 'Reluctant to go home', src: 'Watch', mean: 'Behavioural confirmation that aligns with the disclosure. The child is communicating risk through actions as well as words.' },
    ],
    overall: 'Watch does not soften this. A disclosure of feeling unsafe, supported by neglect and fear indicators, is a child protection matter. The platform escalates immediately and surfaces the procedural steps so nothing is missed under pressure.',
    escalation: {
      level: 4,
      route: ['MASH referral (same day)', 'Inform headteacher and DDSL', 'Record disclosure verbatim', 'Seek MASH guidance before any parental contact'],
      rationale: 'A disclosure of feeling unsafe, with corroborating welfare and fear indicators, meets the threshold for a referral to children\u2019s social care under section 17 / 47 of the Children Act 1989. This is a statutory matter, not an Early Help one.',
    },
    comms: ['mash', 'chronology'],
    linked: [
      { icon: Users, label: 'Sibling', detail: 'Pupil #2188 (Year 4) \u2014 flagged April' },
      { icon: FolderOpen, label: 'History', detail: 'Previous CIN episode, 2023' },
      { icon: Clock, label: 'Last DSL contact', detail: '2 days ago' },
    ],
  },

  '5512': {
    ref: '#5512', year: 'Year 9', school: 'Rusthall Academy',
    headline: 'Persistent absence pattern',
    sub: 'Sustained low attendance over three weeks',
    confidence: 'Medium-High', window: '6 Apr — 27 Apr',
    timeline: [
      { date: '8 Apr', label: 'Attendance drop', src: 'Attendance / SIMS', text: 'Attendance below 80%', icon: 'att', tone: 'amber' },
      { date: '16 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Disengaged in form time', icon: 'pas', tone: 'red' },
      { date: '25 Apr', label: 'Absence', src: 'Attendance / SIMS', text: 'Three further unauthorised sessions', icon: 'att', tone: 'amber' },
    ],
    narrative: 'A sustained attendance problem over three weeks with growing disengagement. No single safeguarding signal, but a clear trend that warrants a coordinated, multi-agency Early Help response.',
    recommend: ['Attendance support meeting', 'Open an Early Help assessment and consider a Team Around the Family'],
    interpretation: [
      { sig: 'Attendance below 80%', src: 'SIMS', mean: 'Persistent absence at this level is strongly associated with wider unmet need.' },
      { sig: 'Disengaged in form time', src: 'Watch', mean: 'Disengagement alongside absence suggests the issue is not purely logistical.' },
    ],
    overall: 'This is a targeted Early Help case. The trend is clear enough to coordinate support across agencies before it becomes entrenched.',
    escalation: {
      level: 3,
      route: ['Attendance support meeting', 'Early Help assessment', 'Team Around the Family'],
      rationale: 'Sustained absence with disengagement points to a targeted, multi-agency Early Help response rather than a statutory referral.',
    },
    comms: ['attendance', 'earlyhelp'],
    linked: [
      { icon: GraduationCap, label: 'Year 9 cohort', detail: '5 active concerns' },
      { icon: User, label: 'Attendance officer', detail: 'Active' },
      { icon: Clock, label: 'Last DSL contact', detail: '3 weeks ago' },
    ],
  },
};

const BENNETT = {
  id: 'bennett', name: 'Bennett Memorial', dsl: SCHOOL_DSL,
  kpis: [
    { label: 'Active concerns', value: '47', sub: '+3 since yesterday', icon: Users, tone: 'amber', key: 'active' },
    { label: 'Children flagged this week', value: '12', sub: 'across 8 year groups', icon: Users, tone: 'amber', key: 'flagged' },
    { label: 'Cases requiring action', value: '5', sub: '2 overdue', icon: AlertTriangle, tone: 'red', key: 'action' },
    { label: 'Multi-agency referrals open', value: '3', sub: 'MASH coordination active', icon: Users, tone: 'amber', key: 'mash' },
  ],
  patterns: ['4471', '3328', '5210', '6187'],
  activity: [
    { t: '09:02', icon: FileText, text: 'New pastoral note logged for Pupil #3328' },
    { t: '08:41', icon: AlertTriangle, text: 'Attendance alert escalated for Year 7 cohort' },
    { t: '08:17', icon: Users, text: 'Case #SG-238 updated \u2014 action assigned to KA' },
    { t: 'Yesterday 16:22', icon: FileText, text: 'MASH referral document generated for Case #SG-241', amber: true },
    { t: 'Yesterday 15:48', icon: Calendar, text: 'Multi-agency meeting scheduled for Case #SG-237', amber: true },
  ],
};

const RUSTHALL = {
  id: 'rusthall', name: 'Rusthall Academy', dsl: 'Daniel Fielding',
  kpis: [
    { label: 'Active concerns', value: '41', sub: '+6 this week', icon: Users, tone: 'red', key: 'active' },
    { label: 'Children flagged this week', value: '9', sub: 'across 5 year groups', icon: Users, tone: 'amber', key: 'flagged' },
    { label: 'Cases requiring action', value: '7', sub: '2 overdue', icon: AlertTriangle, tone: 'red', key: 'action' },
    { label: 'Multi-agency referrals open', value: '4', sub: '1 awaiting MASH response', icon: Users, tone: 'amber', key: 'mash' },
  ],
  patterns: ['2207', '5512'],
  activity: [
    { t: '08:54', icon: AlertTriangle, text: 'High-confidence pattern surfaced for Pupil #2207', amber: true },
    { t: '08:30', icon: FileText, text: 'Disclosure recorded for Pupil #2207 by TA' },
    { t: 'Yesterday 15:10', icon: Users, text: 'KCSIE annual review flagged as pending' },
  ],
};

const SCHOOLS = { bennett: BENNETT, rusthall: RUSTHALL };

/* Additional sample cases used across the other trust schools. Display school and
   DSL are driven by the school you are browsing, so these read correctly anywhere. */
const POOL = {
  'p-att-primary': {
    ref: '#3041', year: 'Year 5', school: 'Maidstone Park',
    headline: 'Attendance + punctuality pattern', sub: 'Repeated lateness and missed mornings over 12 days',
    confidence: 'Medium-High', window: '15 Apr — 27 Apr',
    timeline: [
      { date: '15 Apr', label: 'Lateness', src: 'Attendance / SIMS', text: 'Late on five mornings', icon: 'att', tone: 'amber' },
      { date: '21 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Tired and quiet in class', icon: 'pas', tone: 'red' },
      { date: '26 Apr', label: 'Absence', src: 'Attendance / SIMS', text: 'Two unauthorised mornings', icon: 'att', tone: 'amber' },
    ],
    narrative: 'A steady decline in punctuality and attendance over twelve days, with tiredness noted in class. The pattern suggests a change in the morning routine at home rather than disengagement.',
    recommend: ['Attendance support conversation this week', 'Parental contact to understand the morning routine'],
    interpretation: [
      { sig: 'Late on five mornings', src: 'SIMS', mean: 'Consistent lateness in primary almost always reflects the home morning routine.' },
      { sig: 'Tired and quiet in class', src: 'Watch', mean: 'Tiredness with lateness can point to disrupted sleep or early caring duties.' },
    ],
    overall: 'A gentle, supportive conversation with the family is the right first step. Watch flags this early so it does not drift into persistent absence.',
    escalation: { level: 2, route: ['Attendance support conversation', 'Parental / carer contact', 'Monitor for two weeks'], rationale: 'An emerging attendance need best handled by the school with the family. Watch will raise the level if absence continues.' },
    comms: ['attendance', 'parent'],
    linked: [{ icon: GraduationCap, label: 'Year 5 cohort', detail: '2 active concerns' }, { icon: Clock, label: 'Last DSL contact', detail: 'No prior contact' }],
  },
  'p-welfare-primary': {
    ref: '#2654', year: 'Year 3', school: 'Hillview Primary',
    headline: 'Welfare and presentation pattern', sub: 'Recurring welfare indicators over two weeks',
    confidence: 'Medium-High', window: '13 Apr — 27 Apr',
    timeline: [
      { date: '13 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Arrived without a coat in cold weather', icon: 'pas', tone: 'red' },
      { date: '20 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Asked for a second breakfast', icon: 'pas', tone: 'red' },
      { date: '25 Apr', label: 'Attendance drop', src: 'Attendance / SIMS', text: 'Attendance fallen to 88%', icon: 'att', tone: 'amber' },
    ],
    narrative: 'A pattern of low level welfare indicators in a young child, including hunger and dressing for the weather, alongside a dip in attendance. These point to possible unmet need at home that warrants a coordinated look.',
    recommend: ['Open an Early Help assessment', 'Sensitive parental contact and consider a family support referral'],
    interpretation: [
      { sig: 'Without a coat in cold weather', src: 'Watch', mean: 'A practical welfare indicator that, repeated, can signal financial pressure or neglect.' },
      { sig: 'Asked for a second breakfast', src: 'Watch', mean: 'Hunger at school is a recognised indicator of need at home and should not be read in isolation.' },
    ],
    overall: 'No single sign here is alarming. Together, in a Year 3 child, they justify a supportive Early Help conversation with the family rather than waiting.',
    escalation: { level: 3, route: ['Early Help assessment', 'Family support referral', 'Parental / carer contact'], rationale: 'Repeated welfare indicators in a young child point to a targeted, coordinated Early Help response. Watch will escalate to a statutory referral if a safeguarding disclosure follows.' },
    comms: ['parent', 'earlyhelp'],
    linked: [{ icon: GraduationCap, label: 'Year 3 cohort', detail: '1 active concern' }, { icon: Clock, label: 'Last DSL contact', detail: '4 weeks ago' }],
  },
  'p-wellbeing-primary': {
    ref: '#3377', year: 'Year 6', school: 'Edenbridge Primary',
    headline: 'Transition anxiety pattern', sub: 'Rising anxiety signals ahead of secondary transition',
    confidence: 'Medium', window: '17 Apr — 27 Apr',
    timeline: [
      { date: '17 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Worried about moving to secondary', icon: 'well', tone: 'red' },
      { date: '23 Apr', label: 'Behaviour shift', src: 'Behaviour / Bromcom', text: 'Reluctant to join group work', icon: 'beh', tone: 'amber' },
      { date: '27 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Stomach aches before school', icon: 'well', tone: 'red' },
    ],
    narrative: 'A cluster of anxiety signals as the Year 6 transition approaches, including physical symptoms and reluctance to engage. These are common but worth a light, reassuring intervention now.',
    recommend: ['Wellbeing check-in and transition support', 'Reassuring parental contact'],
    interpretation: [
      { sig: 'Stomach aches before school', src: 'Watch', mean: 'Physical symptoms with no medical cause often express anxiety in younger children.' },
      { sig: 'Worried about secondary', src: 'Watch', mean: 'Transition anxiety is common in Year 6 and responds well to early, structured reassurance.' },
    ],
    overall: 'This is a manageable wellbeing need. A bit of transition support and a friendly word with the family will likely settle it. Watch flags it so it is not missed in a busy term.',
    escalation: { level: 2, route: ['Wellbeing check-in', 'Transition support', 'Parental / carer contact'], rationale: 'A common, low level wellbeing need best met with school-led support. Watch will flag if anxiety deepens or attendance is affected.' },
    comms: ['parent', 'wellbeing'],
    linked: [{ icon: GraduationCap, label: 'Year 6 cohort', detail: '3 active concerns' }, { icon: Clock, label: 'Last DSL contact', detail: 'No prior contact' }],
  },
  'p-behaviour': {
    ref: '#5106', year: 'Year 8', school: 'Tonbridge Grange',
    headline: 'Behaviour escalation pattern', sub: 'Rising behaviour incidents over 11 days',
    confidence: 'Medium', window: '16 Apr — 27 Apr',
    timeline: [
      { date: '16 Apr', label: 'Behaviour shift', src: 'Behaviour / Bromcom', text: 'Two low level disruptions', icon: 'beh', tone: 'amber' },
      { date: '22 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Frustrated and short tempered', icon: 'pas', tone: 'red' },
      { date: '27 Apr', label: 'Behaviour shift', src: 'Behaviour / Bromcom', text: 'Sent out of two lessons', icon: 'beh', tone: 'amber' },
    ],
    narrative: 'A rising trend in behaviour incidents over eleven days, with a pastoral note suggesting underlying frustration. The escalation is recent and worth understanding before it becomes a sanction cycle.',
    recommend: ['Pastoral review to understand the trigger', 'Parental contact and a short behaviour support plan'],
    interpretation: [
      { sig: 'Frustrated and short tempered', src: 'Watch', mean: 'A change in temperament often sits underneath a sudden rise in behaviour incidents.' },
      { sig: 'Sent out of two lessons', src: 'Bromcom', mean: 'Escalating sanctions without understanding the cause tend to entrench the behaviour.' },
    ],
    overall: 'Watch reads the behaviour alongside the pastoral note and sees a pupil under strain, not simply misbehaving. The response is to understand the trigger, not to sanction harder.',
    escalation: { level: 2, route: ['Pastoral review', 'Behaviour support plan', 'Parental / carer contact'], rationale: 'A school-led behaviour and pastoral matter. Watch will escalate if a safeguarding cause emerges behind the behaviour.' },
    comms: ['parent', 'antibully'],
    linked: [{ icon: GraduationCap, label: 'Year 8 cohort', detail: '3 active concerns' }, { icon: Clock, label: 'Last DSL contact', detail: '5 weeks ago' }],
  },
  'p-wellbeing-sec': {
    ref: '#4490', year: 'Year 8', school: "St Gregory's CofE",
    headline: 'Low mood pattern', sub: 'Sustained low mood indicators over 9 days',
    confidence: 'Medium', window: '19 Apr — 27 Apr',
    timeline: [
      { date: '19 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Flat and disengaged in form', icon: 'well', tone: 'red' },
      { date: '23 Apr', label: 'Lateness', src: 'Attendance / SIMS', text: 'Late on three mornings', icon: 'att', tone: 'amber' },
      { date: '27 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Said they "can\u2019t be bothered with anything"', icon: 'well', tone: 'red' },
    ],
    narrative: 'A steady low mood across nine days, with disengagement and a comment suggesting loss of motivation. Read together these warrant a gentle wellbeing conversation.',
    recommend: ['Wellbeing check-in within a week', 'Offer school counsellor and consider parental contact'],
    interpretation: [
      { sig: 'Flat and disengaged', src: 'Watch', mean: 'A shift to flatness from a pupil\u2019s baseline is an early low mood indicator.' },
      { sig: '"Can\u2019t be bothered with anything"', src: 'Watch', mean: 'Loss of motivation across the board can signal low mood rather than laziness.' },
    ],
    overall: 'A low key, supportive conversation is the right move. Watch surfaces it before the disengagement becomes entrenched.',
    escalation: { level: 2, route: ['Wellbeing check-in', 'School counsellor referral', 'Parental / carer contact'], rationale: 'An emotional wellbeing need for school-led support. Watch will flag a GP or CAMHS route if mood deepens.' },
    comms: ['parent', 'wellbeing'],
    linked: [{ icon: GraduationCap, label: 'Year 8 cohort', detail: '2 active concerns' }, { icon: Clock, label: 'Last DSL contact', detail: '9 weeks ago' }],
  },
  'p-peer': {
    ref: '#5841', year: 'Year 10', school: 'Tonbridge Grange',
    headline: 'Peer conflict pattern', sub: 'Conflict and avoidance signals across 8 days',
    confidence: 'Medium', window: '20 Apr — 27 Apr',
    timeline: [
      { date: '20 Apr', label: 'Behaviour shift', src: 'Behaviour / Bromcom', text: 'Argument with peers at lunch', icon: 'beh', tone: 'amber' },
      { date: '24 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Avoiding the playground', icon: 'pas', tone: 'red' },
      { date: '27 Apr', label: 'Absence', src: 'Attendance / SIMS', text: 'Absent on a day with PE', icon: 'att', tone: 'amber' },
    ],
    narrative: 'A short cluster suggesting peer conflict, with the pupil starting to avoid shared spaces and lessons. This pattern usually follows a falling out or low level bullying.',
    recommend: ['Pastoral review and restorative approach', 'Check anti-bullying procedure and consider parental contact'],
    interpretation: [
      { sig: 'Avoiding the playground', src: 'Watch', mean: 'Avoidance of social spaces is a protective response to peer conflict.' },
      { sig: 'Absent on a day with PE', src: 'SIMS', mean: 'Targeted absence around specific lessons can indicate where the conflict is happening.' },
    ],
    overall: 'Watch links the conflict to the avoidance and reads it as a pupil keeping themselves safe. A restorative, supportive response fits better than a behaviour sanction.',
    escalation: { level: 2, route: ['Pastoral review', 'Anti-bullying procedure', 'Parental / carer contact'], rationale: 'A peer and wellbeing matter for school-led resolution. Watch will escalate if harm or an online element is confirmed.' },
    comms: ['parent', 'antibully'],
    linked: [{ icon: GraduationCap, label: 'Year 10 cohort', detail: '2 active concerns' }, { icon: Clock, label: 'Last DSL contact', detail: '7 weeks ago' }],
  },
  'p-online-serious': {
    ref: '#5219', year: 'Year 9', school: 'Tonbridge Grange', serious: true,
    headline: 'Online safety disclosure', sub: 'Disclosure of online contact from an unknown adult',
    confidence: 'High', window: '23 Apr — 27 Apr',
    timeline: [
      { date: '23 Apr', label: 'Pastoral note', src: 'Pastoral / Watch entry', text: 'Withdrawn and anxious on phone', icon: 'pas', tone: 'red' },
      { date: '25 Apr', label: 'Behaviour shift', src: 'Behaviour / Bromcom', text: 'Secretive, hid device from staff', icon: 'beh', tone: 'red' },
      { date: '27 Apr', label: 'Disclosure', src: 'Pastoral / Watch entry', text: 'Disclosed an unknown adult asked for images online', icon: 'pas', tone: 'red' },
    ],
    narrative: 'A pupil has disclosed that an unknown adult contacted them online and asked them to share images. Alongside the secretive behaviour and anxiety noted beforehand, this is an online child sexual abuse and exploitation concern that meets the threshold for an immediate referral.',
    recommend: ['Same day MASH referral and report to police or CEOP', 'Preserve evidence, do not delete anything, and avoid questioning the child in detail'],
    interpretation: [
      { sig: 'Secretive, hid device', src: 'Bromcom', mean: 'Sudden secrecy around a device can indicate online pressure or grooming.' },
      { sig: 'Unknown adult asked for images', src: 'Watch', mean: 'A disclosure of an adult soliciting images is a child sexual abuse concern requiring immediate referral.' },
    ],
    overall: 'Watch escalates this immediately. An adult soliciting images from a child is a criminal safeguarding matter. The platform surfaces the steps so evidence is preserved and the right agencies are involved fast.',
    escalation: { level: 4, route: ['MASH referral (same day)', 'Report to police / CEOP', 'Preserve evidence', 'Inform headteacher and DDSL'], rationale: 'Online solicitation of images from a child meets the threshold for an immediate referral to children\u2019s social care and the police under the online CSAE pathway.' },
    comms: ['mash', 'chronology'],
    linked: [{ icon: GraduationCap, label: 'Year 9 cohort', detail: '4 active concerns' }, { icon: AlertTriangle, label: 'Online safety', detail: 'CEOP report advised' }, { icon: Clock, label: 'Last DSL contact', detail: 'Today' }],
  },
};
Object.assign(CASES, POOL);

const EXTRA_PATTERNS = {
  stgregory: ['p-behaviour', 'p-wellbeing-sec'],
  hillview: ['p-welfare-primary'],
  tonbridge: ['p-online-serious', 'p-peer', 'p-behaviour'],
  maidstone: ['p-behaviour', 'p-wellbeing-sec'],
  westgate: ['p-welfare-primary', 'p-att-primary'],
  edenbridge: ['p-att-primary', 'p-wellbeing-primary'],
};

function getSchool(id) {
  if (SCHOOLS[id]) return SCHOOLS[id];
  const s = TRUST.schools.find(x => x.id === id);
  const pats = EXTRA_PATTERNS[id] || [];
  const actionCount = pats.filter(p => CASES[p] && (CASES[p].escalation.level >= 3 || CASES[p].serious)).length;
  const mashCount = pats.filter(p => CASES[p] && CASES[p].escalation.level === 4).length;
  return {
    id, name: s.name, dsl: dslFor(s.name),
    kpis: [
      { label: 'Active concerns', value: s.concerns, sub: s.status === 'Stable' ? 'within normal range' : 'above normal range', icon: Users, tone: parseInt(s.concerns) > 30 ? 'red' : 'amber', key: 'active' },
      { label: 'Children flagged this week', value: String(Math.max(2, Math.round(parseInt(s.concerns) / 4))), sub: 'this week', icon: Users, tone: 'amber', key: 'flagged' },
      { label: 'Cases requiring action', value: String(Math.max(actionCount, parseInt(s.overdue))), sub: s.overdue !== '0' ? `${s.overdue} overdue` : 'none overdue', icon: AlertTriangle, tone: (actionCount > 0 || s.overdue !== '0') ? 'red' : 'amber', key: 'action' },
      { label: 'Multi-agency referrals open', value: String(mashCount), sub: mashCount ? 'awaiting response' : 'none open', icon: Users, tone: 'amber', key: 'mash' },
    ],
    patterns: pats,
    activity: pats.slice(0, 3).map((p, i) => ({ t: `0${8 + i}:${10 + i * 7}`, icon: FileText, text: `Pattern surfaced for Pupil ${CASES[p] ? CASES[p].ref : ''}` })),
  };
}

const TRUST_CASE_INDEX = [
  { id: '2207', sid: 'rusthall', level: 4, action: true },
  { id: 'p-online-serious', sid: 'tonbridge', level: 4, action: true },
  { id: '5512', sid: 'rusthall', level: 3, action: true },
  { id: 'p-welfare-primary', sid: 'hillview', level: 3, action: true },
  { id: '4471', sid: 'bennett', level: 2, action: true },
  { id: '6187', sid: 'bennett', level: 2, action: true },
  { id: 'p-peer', sid: 'tonbridge', level: 2, action: true },
  { id: '3328', sid: 'bennett', level: 2, action: false },
  { id: '5210', sid: 'bennett', level: 2, action: false },
  { id: 'p-behaviour', sid: 'tonbridge', level: 2, action: false },
  { id: 'p-wellbeing-sec', sid: 'stgregory', level: 2, action: false },
  { id: 'p-att-primary', sid: 'edenbridge', level: 2, action: false },
];

const ACTION_IDS = new Set(TRUST_CASE_INDEX.filter(r => r.action).map(r => r.id));

const LEVEL_META = {
  4: { label: 'Specialist / CP', color: C.red },
  3: { label: 'Targeted', color: C.amber },
  2: { label: 'Early Help', color: C.amber },
  1: { label: 'Universal', color: C.green },
};

const TRIAGE_META = {
  active: { title: 'Active concerns across the trust', subtitle: 'Every flagged pupil, highest priority first. Click any row to open the case.', note: 'Showing the 12 highest-priority concerns of 184 active across the trust.' },
  flagged: { title: 'Pupils flagged this term', subtitle: 'Pupils Watch has surfaced this term, highest priority first.', note: 'Showing 12 of 62 pupils flagged this term.' },
  action: { title: 'Cases requiring action', subtitle: 'Cases that need a decision now, highest priority first.', note: 'Plus 2 further cases already in progress.' },
  mash: { title: 'Open MASH referrals', subtitle: 'Referrals to children\u2019s social care. Click to open the case behind each one.', note: '3 further referrals are open and awaiting a response across the trust.' },
};
const SCHOOL_TRIAGE_META = {
  active: { title: 'Active concerns', subtitle: 'Flagged pupils at this school, highest priority first.' },
  flagged: { title: 'Children flagged this week', subtitle: 'Pupils surfaced this week, highest priority first.' },
  action: { title: 'Cases requiring action', subtitle: 'Cases at this school that need a decision now.' },
  mash: { title: 'Multi-agency referrals', subtitle: 'Referrals to children\u2019s social care from this school.' },
};

function trustRows(key) {
  let rows = TRUST_CASE_INDEX.slice();
  if (key === 'action') rows = rows.filter(r => r.action);
  if (key === 'mash') rows = rows.filter(r => r.level === 4);
  rows.sort((a, b) => b.level - a.level);
  return rows.map(r => {
    const c = CASES[r.id];
    return { id: r.id, sid: r.sid, schoolName: getSchool(r.sid).name, ref: c.ref, year: c.year, headline: c.headline, level: r.level, confidence: c.confidence, serious: !!c.serious };
  });
}
function schoolRows(sid, key) {
  const pats = getSchool(sid).patterns || [];
  let rows = pats.map(id => {
    const c = CASES[id];
    return { id, sid, schoolName: getSchool(sid).name, ref: c.ref, year: c.year, headline: c.headline, level: c.escalation.level, confidence: c.confidence, serious: !!c.serious };
  });
  if (key === 'action') rows = rows.filter(r => r.level >= 3 || r.serious || ACTION_IDS.has(r.id));
  if (key === 'mash') rows = rows.filter(r => r.level === 4);
  rows.sort((a, b) => b.level - a.level);
  return rows;
}

const TRUST = {
  name: 'Tenax Schools Trust', count: '8 schools', director: DIRECTOR,
  kpis: [
    { label: 'Active concerns across trust', value: '184', sub: '+11 since last week', icon: Users, tone: 'amber', key: 'active' },
    { label: 'Pupils flagged this term', value: '62', sub: 'across 8 schools', icon: Users, tone: 'amber', key: 'flagged' },
    { label: 'Cases requiring action', value: '9', sub: '3 escalated', icon: AlertTriangle, tone: 'red', key: 'action' },
    { label: 'MASH referrals open', value: '5', sub: '2 awaiting response', icon: Users, tone: 'amber', key: 'mash' },
  ],
  schools: [
    { id: 'bennett', name: 'Bennett Memorial', pupils: '1,240', status: 'Stable', concerns: '24', overdue: '0', kcsie: 'ok' },
    { id: 'stgregory', name: "St Gregory's CofE", pupils: '980', status: 'Stable', concerns: '18', overdue: '0', kcsie: 'ok' },
    { id: 'hillview', name: 'Hillview Primary', pupils: '620', status: 'Stable', concerns: '12', overdue: '0', kcsie: 'ok' },
    { id: 'tonbridge', name: 'Tonbridge Grange', pupils: '1,105', status: 'Elevated', concerns: '28', overdue: '1', kcsie: 'ok' },
    { id: 'maidstone', name: 'Maidstone Park', pupils: '1,340', status: 'Stable', concerns: '21', overdue: '0', kcsie: 'ok' },
    { id: 'westgate', name: 'Westgate Junior', pupils: '430', status: 'Stable', concerns: '9', overdue: '0', kcsie: 'ok' },
    { id: 'edenbridge', name: 'Edenbridge Primary', pupils: '710', status: 'Elevated', concerns: '22', overdue: '1', kcsie: 'ok' },
    { id: 'rusthall', name: 'Rusthall Academy', pupils: '1,020', status: 'Requires attention', concerns: '41', overdue: '2', kcsie: 'pending' },
  ],
  cross: [
    { icon: TrendingUp, title: 'Year 9 attendance dipping across 4 schools', detail: 'Possible cohort signal.', key: 'attendance' },
    { icon: ClipboardList, title: "Pastoral notes mentioning 'home stress'", detail: 'Up 18% this term.', key: 'homestress' },
    { icon: Calendar, title: '3 schools approaching KCSIE annual review window', detail: 'Annual review window.', key: 'kcsie' },
  ],
};

const COHORTS = {
  attendance: {
    title: 'Year 9 attendance \u2014 cross-school signal',
    summary: 'Watch has detected a correlated dip in Year 9 attendance across four schools in the same fortnight. Individually each school sits within its normal range. Viewed together, the pattern is large enough to suggest a shared driver rather than coincidence.',
    rows: [
      { school: 'Bennett Memorial', detail: 'Year 9 attendance down 2.4 points', val: '93.1%' },
      { school: 'Tonbridge Grange', detail: 'Year 9 attendance down 3.1 points', val: '91.6%' },
      { school: 'Maidstone Park', detail: 'Year 9 attendance down 2.0 points', val: '93.8%' },
      { school: 'Rusthall Academy', detail: 'Year 9 attendance down 4.2 points', val: '89.4%' },
    ],
    action: 'Recommend a trust-level Year 9 attendance review. Watch suggests checking for shared causes such as local transport changes, term-time pressures, or a social media driver, before each school acts in isolation.',
  },
  homestress: {
    title: "Pastoral notes mentioning 'home stress' \u2014 trust trend",
    summary: 'References to home stress, family pressure, and caring responsibilities in pastoral notes are up 18% across the trust this term. The rise is concentrated in three schools and across all key stages.',
    rows: [
      { school: 'Rusthall Academy', detail: 'Home stress mentions', val: '+34%' },
      { school: 'Edenbridge Primary', detail: 'Home stress mentions', val: '+22%' },
      { school: 'Bennett Memorial', detail: 'Home stress mentions', val: '+15%' },
      { school: 'Trust average', detail: 'All schools', val: '+18%' },
    ],
    action: 'Recommend reviewing Early Help capacity and family support provision across the affected schools. Watch can group the underlying cases for a single coordinated review.',
  },
  kcsie: {
    title: 'KCSIE annual review \u2014 compliance window',
    summary: 'Three schools are approaching their KCSIE annual policy and provision review window. Watch tracks review dates against the trust calendar so nothing lapses.',
    rows: [
      { school: 'Rusthall Academy', detail: 'Review status', val: 'Pending' },
      { school: 'Tonbridge Grange', detail: 'Due within 21 days', val: 'Upcoming' },
      { school: 'Hillview Primary', detail: 'Due within 30 days', val: 'Upcoming' },
    ],
    action: 'Recommend scheduling the Rusthall review first given its current case load. Watch will generate a compliance checklist aligned to KCSIE 2024 for each school.',
  },
};

const COMM_META = {
  mash: { label: 'MASH referral', icon: Send, blurb: 'Statutory referral to children\u2019s social care', primary: true },
  parent: { label: 'Parent / carer contact', icon: Heart, blurb: 'Warm invitation to talk' },
  senco: { label: 'SENCO consultation', icon: Brain, blurb: 'Internal SEND view' },
  earlyhelp: { label: 'Early Help assessment', icon: FileText, blurb: 'Open a coordinated assessment' },
  wellbeing: { label: 'Wellbeing / counsellor referral', icon: Heart, blurb: 'Internal wellbeing support' },
  antibully: { label: 'Anti-bullying record', icon: ShieldCheck, blurb: 'Log under bullying procedure' },
  attendance: { label: 'Attendance support letter', icon: Calendar, blurb: 'Parental attendance contact' },
  chronology: { label: 'Chronology export', icon: FileText, blurb: 'Full signal chronology' },
};

const STATUS_LINES = [
  'Reading the case chronology',
  'Cross-referencing SIMS and Bromcom entries',
  'Applying KCSIE 2024 thresholds',
  'Checking proportionality of language',
  'Drafting the document',
];

function fallbackDraft(type, c) {
  const dsl = dslFor(c.school);
  const chrono = c.timeline.map(t => `- ${t.date}: ${t.text} (source: ${t.src})`).join('\n');
  if (type === 'mash') {
    return `MULTI-AGENCY SAFEGUARDING HUB (MASH) REFERRAL

School: ${c.school}
Referrer: ${dsl}, Designated Safeguarding Lead
Date of referral: 28 April 2026
Pupil reference: ${c.ref} (${c.year})

REASON FOR REFERRAL
This referral follows a disclosure by the child that they do not feel safe at home, alongside a linked cluster of welfare concerns identified over the past eight days. The concerns meet the threshold for specialist intervention under the local continuum of need.

CHRONOLOGY OF CONCERNS
${chrono}

CURRENT ASSESSMENT
Taken individually these signals are low level. Taken together, with the child's disclosure, they indicate a child who may be suffering or at risk of significant harm. Several signals, including the disclosure, were captured outside routine staff awareness.

ACTION REQUESTED
We request a MASH assessment and a decision on next steps under section 17 and section 47 of the Children Act 1989. The school can provide the full chronology and pastoral records on request. We have considered whether informing the parents would increase risk to the child, and we request MASH guidance before any parental contact is made.

The disclosure has been recorded verbatim and this referral is logged on the school safeguarding system with a full audit trail.`;
  }
  if (type === 'parent') {
    return `Subject: A quick chat about your child

Dear Parent or Carer,

I am writing as the Designated Safeguarding Lead at ${c.school}. Over the past couple of weeks, staff have noticed some small changes in how your child has seemed at school. Nothing here is a cause for alarm, and I want to stress that. We simply like to check in early when we notice a few things together, rather than wait.

We would value a short, informal conversation to share what we have seen and to hear how things are at home. This is about understanding how best to support your child, not about anything they have done wrong.

Please let the school office know a time that suits you this week. If a call is easier, I am very happy to phone.

With kind regards,
${dsl}
Designated Safeguarding Lead, ${c.school}`;
  }
  if (type === 'senco') {
    return `INTERNAL NOTE: SENCO CONSULTATION REQUEST

Pupil: ${c.ref} (${c.year})
Raised by: ${dsl}, DSL
Date: 28 April 2026

Watch has identified a pattern combining attendance changes, a behaviour shift, and a SEND review note flagging concentration concerns. I would value a SENCO view on whether these changes are consistent with an unmet learning or sensory need, or whether they are more likely pastoral in origin.

Specifically:
- Are the concentration concerns new or longstanding?
- Would a short period of monitoring against the SEND record be useful?
- Should we align any pastoral review with existing SEND provision?

I have scheduled a pastoral review within 48 hours and will share the outcome with you.`;
  }
  if (type === 'earlyhelp') {
    return `EARLY HELP ASSESSMENT: OPENING SUMMARY

Pupil: ${c.ref} (${c.year})
Lead practitioner: ${dsl}, DSL
Date opened: 28 April 2026

REASON FOR EARLY HELP
Watch has identified an emerging pattern of need over the assessment window. The concerns sit below the threshold for a statutory referral but warrant a coordinated, school-led response with the family.

SUMMARY OF SIGNALS
${chrono}

INITIAL FOCUS
- Understand the family context behind the recent changes.
- Agree practical support with the parents or carers.
- Set a short review point to check whether the plan is working.

NEXT STEPS
Convene an initial conversation with the family, and consider whether a Team Around the Family is needed. Watch will continue to monitor and will flag any change in the level of need.`;
  }
  if (type === 'wellbeing') {
    return `INTERNAL NOTE: WELLBEING SUPPORT REFERRAL

Pupil: ${c.ref} (${c.year})
Raised by: ${dsl}, DSL
Date: 28 April 2026

Watch has identified a consistent low mood pattern over the past ten days, including tearfulness, social withdrawal, and a direct statement that the pupil is not coping.

I would like to:
- Offer the pupil a session with the school counsellor this week.
- Put a light-touch check-in in place with a trusted member of staff.
- Make contact with the parents or carers to share our support and understand home context.

If the pattern continues to escalate, I will consider a GP conversation or a CAMHS route and will consult with you first.`;
  }
  if (type === 'antibully') {
    return `ANTI-BULLYING PROCEDURE: INCIDENT RECORD

Pupil: ${c.ref} (${c.year})
Recorded by: ${dsl}, DSL
Date: 28 April 2026

SUMMARY
Watch has surfaced a cluster suggesting peer conflict with a possible online element, including a report of feeling targeted online and withdrawal from shared spaces.

ACTIONS UNDER PROCEDURE
- Speak with the pupil to understand what has happened and how they feel.
- Apply a restorative approach with the peers involved, handled separately.
- Review the online dimension under the school's online safety policy.
- Make contact with the parents or carers of the pupil affected.

REVIEW
A follow-up check-in will be held within one week to confirm the situation has settled. This record is logged with a full audit trail.`;
  }
  if (type === 'attendance') {
    return `Subject: Supporting your child's attendance

Dear Parent or Carer,

I am writing from ${c.school} about your child's recent attendance. We have noticed a pattern of lateness and absence over the past few weeks, and we would like to work with you to put the right support in place.

We understand that mornings and home life can be difficult, and there may be circumstances we are not aware of. We would welcome a short meeting this week to talk things through and agree a simple plan together. If there are caring responsibilities or other pressures at home, please do let us know, as we may be able to help.

Please contact the school office to arrange a convenient time.

With kind regards,
${dsl}
Designated Safeguarding Lead, ${c.school}`;
  }
  if (type === 'chronology') {
    return `SAFEGUARDING CHRONOLOGY: PUPIL ${c.ref}

School: ${c.school}
Year group: ${c.year}
Window: ${c.window}
Prepared by: ${dsl}, DSL
Confidence: ${c.confidence}

SIGNAL CHRONOLOGY
${chrono}

WATCH ASSESSMENT
${c.narrative}

This chronology is exported from the school safeguarding system and reflects the full audit trail held on file.`;
  }
  return '';
}

async function callClaude(type, c) {
  const dsl = dslFor(c.school);
  const instruction = {
    mash: 'Draft a formal UK MASH (Multi-Agency Safeguarding Hub) referral with sections: school and referrer, reason for referral, chronology of concerns, current assessment, action requested. Reference section 17 and 47 of the Children Act 1989. Note that informing parents was considered against risk.',
    parent: 'Draft a short, warm, professional invitation from the DSL to the parent or carer for an informal conversation. Reassure, do not alarm, focus on support not blame. Include a subject line.',
    senco: 'Draft a concise internal SENCO consultation request from the DSL, with two or three specific questions about whether the pattern reflects an unmet SEND need.',
    earlyhelp: 'Draft an Early Help assessment opening summary with reason, summary of signals, initial focus, and next steps.',
    wellbeing: 'Draft a concise internal wellbeing and counsellor referral note from the DSL.',
    antibully: 'Draft an anti-bullying procedure incident record with summary, actions under procedure, and review.',
    attendance: 'Draft a supportive attendance letter from the DSL to the parent or carer, offering a meeting and acknowledging possible home pressures. Include a subject line.',
    chronology: 'Produce a clean safeguarding chronology export with the signal list and a short Watch assessment.',
  }[type];

  const system = `You are Watch, a UK safeguarding intelligence platform used by Designated Safeguarding Leads in schools. You draft professional safeguarding documents. Always use British English. Never use em dashes. Be factual, proportionate, and aligned to KCSIE 2024 and the local continuum of need. Sign documents as ${dsl}, Designated Safeguarding Lead. Today is 28 April 2026. Output only the document text with no preamble or commentary.`;

  const payload = {
    school: c.school, pupilReference: c.ref, yearGroup: c.year,
    window: c.window, confidence: c.confidence,
    chronology: c.timeline.map(t => ({ date: t.date, signal: t.text, source: t.src })),
    watchAssessment: c.narrative, recommendation: c.recommend,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system,
        messages: [{
          role: 'user',
          content: `${instruction}\n\nKeep it under 320 words. Use the following case data. Refer to the pupil exactly as provided and do not invent any other personal details.\n\n${JSON.stringify(payload, null, 2)}`,
        }],
      }),
    });
    clearTimeout(timer);
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!text) throw new Error('empty');
    return text;
  } catch (e) {
    clearTimeout(timer);
    return fallbackDraft(type, c);
  }
}

/* ---- document repository + contextual search ---- */
const DOC_STATUS = {
  Current: { label: 'Current', color: '#5f9e72' },
  Filed: { label: 'Filed', color: '#7fa8c9' },
  'Review due': { label: 'Review due', color: '#e8920a' },
  Expiring: { label: 'Expiring', color: '#e8920a' },
};
const DOC_ICON = { Policy: FileText, Record: FolderOpen, Training: GraduationCap, Report: ClipboardList, Return: ClipboardList, Referral: Send, Chronology: Clock, Assessment: Heart, Note: User, Letter: Send };
const COMM_DOC = {
  mash: { title: 'MASH Referral', type: 'Referral', themes: ['child protection', 'mash', 'referral'] },
  parent: { title: 'Letter to Parent', type: 'Letter', themes: ['family', 'communication'] },
  senco: { title: 'SENCO Consultation', type: 'Note', themes: ['send', 'consultation'] },
  earlyhelp: { title: 'Early Help Assessment', type: 'Assessment', themes: ['early help', 'family', 'welfare'] },
  wellbeing: { title: 'Wellbeing Referral', type: 'Note', themes: ['welfare', 'wellbeing'] },
  antibully: { title: 'Anti-Bullying Record', type: 'Record', themes: ['bullying', 'child on child', 'behaviour'] },
  attendance: { title: 'Attendance Letter', type: 'Letter', themes: ['attendance', 'welfare'] },
  chronology: { title: 'Safeguarding Chronology', type: 'Chronology', themes: ['chronology', 'welfare', 'timeline'] },
};
const DEFAULT_REFERRAL = { stage: 'submitted', line: 'Submitted 24 Apr 2026, awaiting MASH decision', events: [{ date: '24 Apr 2026', text: 'Referral submitted to MASH' }] };

const DOC_CORPUS = [
  { id: 'd-cp-policy', scope: 'org', title: 'Child Protection and Safeguarding Policy', type: 'Policy', date: '6 Sep 2025', status: 'Current', themes: ['policy', 'child protection', 'online safety', 'behaviour', 'safer recruitment', 'reporting'], summary: 'Annual child protection policy aligned to KCSIE 2024. Sets out reporting routes, the role of the DSL, safer recruitment, online safety and managing allegations.' },
  { id: 'd-online-policy', scope: 'org', title: 'Online Safety and Filtering Policy', type: 'Policy', date: '12 Sep 2025', status: 'Current', themes: ['policy', 'online safety', 'filtering', 'monitoring', 'internet', 'social media', 'child on child'], summary: 'Filtering and monitoring standards and how the school responds to online incidents, harmful content and online child on child abuse.' },
  { id: 'd-behaviour', scope: 'org', title: 'Behaviour and Anti-Bullying Policy', type: 'Policy', date: '3 Sep 2025', status: 'Current', themes: ['policy', 'behaviour', 'bullying', 'child on child', 'peer', 'exclusions'], summary: 'Behaviour expectations and the anti-bullying procedure, including child on child abuse and proportionate sanctions.' },
  { id: 'd-attendance', scope: 'org', title: 'Attendance and Persistent Absence Strategy', type: 'Policy', date: '9 Jan 2026', status: 'Current', themes: ['policy', 'attendance', 'persistent absence', 'children missing education', 'welfare'], summary: 'Strategy for persistent absence and children missing education, including the link between attendance and wider unmet need.' },
  { id: 'd-info-sharing', scope: 'org', title: 'Information Sharing and Consent Procedure', type: 'Policy', date: '20 Feb 2026', status: 'Current', themes: ['policy', 'information sharing', 'consent', 'data protection', 'multi-agency'], summary: 'When and how to share safeguarding information lawfully, including consent, the public task basis and sharing with the local authority and police.' },
  { id: 'd-scr', scope: 'org', title: 'Single Central Record', type: 'Record', date: '21 Apr 2026', status: 'Current', themes: ['safer recruitment', 'dbs', 'pre-employment', 'vetting'], summary: 'Record of pre-employment and vetting checks for all staff and regular volunteers.' },
  { id: 'd-dsl-cert', scope: 'org', title: 'DSL Training Certificate', type: 'Training', date: '14 Mar 2025', status: 'Current', themes: ['training', 'dsl', 'professional development'], summary: 'Designated Safeguarding Lead training to the level required by KCSIE, valid for two years.' },
  { id: 'd-staff-training', scope: 'org', title: 'Whole-Staff Safeguarding Training Record', type: 'Training', date: '2 Sep 2025', status: 'Current', themes: ['training', 'induction', 'kcsie part 1'], summary: 'Record of annual whole-staff safeguarding training and confirmation that staff have read Part 1 of KCSIE.' },
  { id: 'd-gov-report', scope: 'org', title: 'Governor Safeguarding Annual Report', type: 'Report', date: '28 Mar 2026', status: 'Filed', themes: ['governance', 'oversight', 'assurance'], summary: 'Annual safeguarding report to the governing body covering training, the single central record and emerging incident themes.' },
  { id: 'cd-2207-referral', scope: 'case', caseId: '2207', sid: 'rusthall', ref: 'Pupil 2207', school: 'Rusthall Academy', title: 'MASH Referral', type: 'Referral', date: '24 Apr 2026', status: 'Filed', themes: ['neglect', 'home environment', 'disclosure', 'child protection', 'feeling unsafe', 'welfare'], summary: 'Referral to the multi-agency safeguarding hub after a disclosure of feeling unsafe at home, with corroborating neglect and welfare indicators.' },
  { id: 'cd-2207-chronology', scope: 'case', caseId: '2207', sid: 'rusthall', ref: 'Pupil 2207', school: 'Rusthall Academy', title: 'Safeguarding Chronology', type: 'Chronology', date: '24 Apr 2026', status: 'Filed', themes: ['home environment', 'welfare', 'neglect', 'timeline'], summary: 'Chronology of welfare and home environment concerns recorded over an eight day window.' },
  { id: 'cd-4471-earlyhelp', scope: 'case', caseId: '4471', sid: 'bennett', ref: 'Pupil 4471', school: 'Bennett Memorial', title: 'Early Help Assessment', type: 'Assessment', date: '26 Apr 2026', status: 'Filed', themes: ['early help', 'family', 'home environment', 'attendance', 'welfare'], summary: 'Early Help assessment opening summary following a pattern of welfare and attendance signals.' },
  { id: 'cd-3328-note', scope: 'case', caseId: '3328', sid: 'bennett', ref: 'Pupil 3328', school: 'Bennett Memorial', title: 'Pastoral Support Note', type: 'Note', date: '22 Apr 2026', status: 'Filed', themes: ['behaviour', 'wellbeing', 'peer', 'pastoral'], summary: 'Pastoral note recording wellbeing and peer relationship concerns observed in form time.' },
  { id: 'cd-5219-online', scope: 'case', caseId: 'p-online-serious', sid: 'tonbridge', ref: 'Pupil 5219', school: 'Tonbridge Grange', title: 'Online Safety Incident Record', type: 'Record', date: '28 Apr 2026', status: 'Filed', themes: ['online safety', 'csae', 'disclosure', 'child protection', 'social media'], summary: 'Record of an online child sexual abuse and exploitation disclosure, with a CEOP referral advised.' },
];

const CONCEPTS = [
  { terms: ['home', 'house', 'family home', 'home life', 'at home', 'domestic', 'household'], concept: 'home environment' },
  { terms: ['neglect', 'neglected', 'unkempt', 'hungry', 'not fed'], concept: 'neglect' },
  { terms: ['unsafe', 'feeling unsafe', 'not safe', 'scared', 'afraid', 'fear'], concept: 'feeling unsafe' },
  { terms: ['online', 'internet', 'social media', 'device', 'grooming', 'sexting', 'web', 'digital', 'csae'], concept: 'online safety' },
  { terms: ['filter', 'filtering', 'monitoring', 'block'], concept: 'filtering' },
  { terms: ['attendance', 'absence', 'absent', 'truant', 'persistent absence', 'not attending'], concept: 'attendance' },
  { terms: ['missing education', 'cme', 'off roll', 'children missing'], concept: 'children missing education' },
  { terms: ['bully', 'bullying', 'bullied'], concept: 'bullying' },
  { terms: ['peer', 'child on child', 'child-on-child', 'friendship', 'peer group'], concept: 'child on child' },
  { terms: ['training', 'certificate', 'cpd', 'course', 'qualified', 'part 1', 'part one'], concept: 'training' },
  { terms: ['policy', 'procedure', 'policies'], concept: 'policy' },
  { terms: ['recruitment', 'dbs', 'vetting', 'scr', 'single central', 'pre-employment', 'pre employment'], concept: 'safer recruitment' },
  { terms: ['consent', 'sharing', 'information sharing', 'share information', 'gdpr', 'data protection', 'lawful basis'], concept: 'information sharing' },
  { terms: ['governor', 'governance', 'board', 'trustee', 'oversight', 'assurance'], concept: 'governance' },
  { terms: ['disclosure', 'disclosed', 'told a teacher'], concept: 'disclosure' },
  { terms: ['early help', 'taf', 'team around', 'family support'], concept: 'early help' },
  { terms: ['welfare', 'wellbeing', 'well-being', 'mental health', 'low mood'], concept: 'welfare' },
  { terms: ['child protection', 'section 47', 'mash', 'referral'], concept: 'child protection' },
  { terms: ['compliance', 'kcsie', 'inspection', 'ofsted', 'evidence', 'audit'], concept: 'compliance' },
  { terms: ['behaviour', 'behavior', 'conduct', 'disruption'], concept: 'behaviour' },
];

function queryConcepts(q) {
  const s = ' ' + q.toLowerCase().trim() + ' ';
  const found = new Set();
  CONCEPTS.forEach(({ terms, concept }) => { if (terms.some(t => s.includes(t))) found.add(concept); });
  return found;
}
function searchDocs(query, corpus) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const concepts = queryConcepts(query);
  const tokens = q.split(/[^a-z0-9]+/).filter(w => w.length > 2);
  const scored = corpus.map(d => {
    const themeSet = new Set(d.themes);
    const matched = [...concepts].filter(c => themeSet.has(c));
    let score = matched.length * 3;
    const hay = (d.summary + ' ' + d.themes.join(' ')).toLowerCase(); // content and themes, never the title
    tokens.forEach(t => { if (hay.includes(t)) score += 1; });
    return { doc: d, score, matched };
  }).filter(x => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
function searchFallback(query, hits) {
  if (!hits.length) return 'No documents match that yet. Try a broader description of the concern or theme.';
  const concepts = [...queryConcepts(query)];
  const themePart = concepts.length ? concepts.slice(0, 3).join(', ') : 'your search';
  const titles = hits.slice(0, 3).map(h => h.doc.title).join(', ');
  return `Watch found ${hits.length} document${hits.length > 1 ? 's' : ''} related to ${themePart}. The most relevant are: ${titles}. These were matched on what the documents are about, not their file names.`;
}
async function searchSynthesis(query, hits) {
  const docs = hits.slice(0, 6).map(h => ({ title: h.doc.title, type: h.doc.type, about: h.doc.summary, pupil: h.doc.ref || null }));
  const system = 'You are Watch, a UK safeguarding intelligence platform used by Designated Safeguarding Leads. The user has run a contextual search across the school\u2019s safeguarding documents and records. Write a brief answer of two or three sentences, in British English, summarising what the matching documents show in relation to the query. Be factual and proportionate. Do not invent documents, children or details beyond those provided. Refer to any child only by the pupil reference given. Never use em dashes. Output only the answer text with no preamble.';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 24000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: `Query: "${query}"\n\nMatching documents:\n${JSON.stringify(docs, null, 2)}` }],
      }),
    });
    clearTimeout(timer);
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!text) throw new Error('empty');
    return text;
  } catch (e) {
    clearTimeout(timer);
    return searchFallback(query, hits);
  }
}
function buildEvidencePack(docs) {
  const lines = docs.map(d => `- ${d.title} (${d.type}): ${DOC_STATUS[d.status].label}, ${d.date}`).join('\n');
  const text = `SAFEGUARDING EVIDENCE PACK
Assembled by Watch on 28 April 2026

PURPOSE
A single index of the safeguarding policies, records and compliance evidence held in Watch, for inspection or governor review. This is an index of evidence held, not a return to any regulator.

DOCUMENTS
${lines}

NOTE
Each item is held in the repository with its review date and version. Child level files are held separately under access control and are not listed here.

Assembled by Watch. Reviewed by the DSL before sharing.`;
  return { title: 'Inspection evidence pack', subtitle: 'Assembled by Watch from the repository', text, filename: 'Watch_Evidence_Pack.txt' };
}

function DocsView({ breadcrumb, searchCorpus, vaultDocs, onCase, onOpenDoc }) {
  const [q, setQ] = useState('');
  const [ran, setRan] = useState(false);
  const [hits, setHits] = useState([]);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const suggestions = ['Children with home environment concerns', 'Online safety', 'Evidence for the annual policy review', 'Persistent absence'];

  async function run(query) {
    const term = (query !== undefined ? query : q).trim();
    if (!term) return;
    setQ(term); setRan(true);
    const h = searchDocs(term, searchCorpus);
    setHits(h);
    if (!h.length) { setAnswer(searchFallback(term, h)); setLoading(false); return; }
    setLoading(true); setAnswer('');
    const a = await searchSynthesis(term, h);
    setAnswer(a); setLoading(false);
  }
  function clearSearch() { setRan(false); setHits([]); setAnswer(''); setQ(''); }
  function openResult(d) {
    if (d.scope === 'case') { onCase(d.caseId, d.sid); return; }
    onOpenDoc({ title: d.title, subtitle: `${d.type} \u00b7 ${d.date} \u00b7 ${DOC_STATUS[d.status].label}`, text: d.text || `${d.title}\n${d.type}, reviewed ${d.date}\n\n${d.summary}\n\nThis document is stored in the Watch repository. In production the full file opens here.`, filename: d.title.replace(/[^a-z0-9]+/gi, '_') + '.txt' });
  }

  return (
    <div className="wt-fade">
      {breadcrumb}
      <h1 className="wt-h1">Documents</h1>
      <div className="wt-sub-italic">Safeguarding records and compliance evidence, searchable by meaning</div>
      <div style={{ height: 18 }} />

      <div className="wt-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Brain size={18} color={C.amber} />
          <span style={{ fontFamily: PF, fontSize: 20, color: C.cream }}>Contextual search</span>
        </div>
        <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginBottom: 14 }}>Search by what you mean, not by file name. Describe a concern, a theme or a question.</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') run(); }} placeholder="for example: which children have home environment concerns" style={{ flex: 1, minWidth: 240, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', color: C.cream, fontFamily: LT, fontSize: 14, outline: 'none' }} />
          <button className="wt-btn-amber" onClick={() => run()}><Eye size={16} /> Search</button>
          {ran && <button className="wt-btn-ghost-sm" onClick={clearSearch}>Clear</button>}
        </div>
        {!ran && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {suggestions.map(s => <button key={s} onClick={() => run(s)} className="wt-chip">{s}</button>)}
          </div>
        )}
      </div>

      {ran ? (
        <div className="wt-fade">
          <div className="wt-card" style={{ marginBottom: 18, background: C.card2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Brain size={16} color={C.amber} />
              <span style={{ fontFamily: LT, fontSize: 12, color: C.amber, fontWeight: 700, letterSpacing: 0.4 }}>WATCH SUMMARY</span>
            </div>
            {loading
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: LT, fontSize: 14, color: C.dim }}><Loader2 size={16} color={C.amber} className="wt-spin" /> Reading the matching documents...</div>
              : <div style={{ fontFamily: LT, fontSize: 14.5, color: C.cream, lineHeight: 1.55 }}>{answer}</div>}
          </div>
          <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim, marginBottom: 12 }}>{hits.length} result{hits.length === 1 ? '' : 's'}, ranked by relevance. Matched on content, not file name.</div>
          <div className="wt-card" style={{ padding: 0, overflow: 'hidden' }}>
            {hits.length === 0 && <div style={{ padding: 20, fontFamily: LT, fontSize: 14, color: C.dim }}>No documents match that yet. Try a broader description.</div>}
            {hits.map(({ doc, matched }, i) => { const Icon = DOC_ICON[doc.type] || FileText;
              return (
                <button key={doc.id} onClick={() => openResult(doc)} className="wt-triage-row" style={{ alignItems: 'flex-start', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: C.card, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={17} color={C.amber} strokeWidth={1.7} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: LT, fontSize: 14.5, color: C.cream, fontWeight: 700 }}>{doc.title}</span>
                        {doc.scope === 'case' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: LT, fontSize: 11.5, color: C.dim }}><Lock size={12} /> {doc.ref}</span>}
                      </div>
                      <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim, marginTop: 2 }}>{doc.type} \u00b7 {doc.scope === 'case' ? doc.school : 'Organisation'} \u00b7 {doc.date}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {matched.map(m => <span key={m} className="wt-themechip">{m}</span>)}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} color={C.faint} style={{ flexShrink: 0, marginTop: 4 }} />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <span style={{ fontFamily: PF, fontSize: 22, color: C.cream }}>Repository</span>
            <button className="wt-btn-amber-o" onClick={() => onOpenDoc(buildEvidencePack(vaultDocs))}><FileText size={16} /> Inspection evidence pack</button>
          </div>
          <div className="wt-card" style={{ padding: 0, overflow: 'hidden' }}>
            {vaultDocs.map((d, i) => { const Icon = DOC_ICON[d.type] || FileText; const sm = DOC_STATUS[d.status];
              return (
                <button key={d.id} onClick={() => openResult(d)} className="wt-triage-row" style={{ borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: C.card2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={17} color={C.amber} strokeWidth={1.7} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: LT, fontSize: 14.5, color: C.cream, fontWeight: 700 }}>{d.title}{d.generated && <span style={{ fontFamily: LT, fontSize: 11, color: C.amber, marginLeft: 8 }}>generated by Watch</span>}</div>
                      <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim, marginTop: 2 }}>{d.type} \u00b7 {d.date}</div>
                    </div>
                  </div>
                  <span className="wt-triage-lvl" style={{ color: sm.color, borderColor: sm.color + '55', flexShrink: 0 }}>{sm.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ fontFamily: LT, fontSize: 12.5, color: C.faint, marginTop: 14 }}>Documents Watch generates land here automatically, versioned and linked to the record. Child level files stay sealed and open inside the case.</div>
        </>
      )}
    </div>
  );
}

/* ---- small UI helpers ---- */
function Shield({ size = 22 }) {
  return <ShieldPlus size={size} color={C.amber} strokeWidth={1.8} />;
}
function Avatar({ name, size = 34 }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('');
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#1d3a27,#244a31)', border: `1px solid ${C.borderS}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cream, fontFamily: LT, fontWeight: 700, fontSize: size * 0.36 }}>{initials}</div>
  );
}
function StatusBadge({ status }) {
  const map = { 'Stable': C.green, 'Elevated': C.amber, 'Requires attention': C.red };
  const col = map[status] || C.dim;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: LT, fontSize: 12.5, color: col, fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, boxShadow: `0 0 8px ${col}55` }} />{status}
    </span>
  );
}
function Header({ user, role, onHome, onSwitch, onGovernance, onOnCall, onDocs, onInspection }) {
  return (
    <div className="wt-header">
      <div className="wt-brand" onClick={onHome} style={{ cursor: 'pointer' }}>
        <span className="wt-watch">Watch</span><span className="wt-by">by Sentinel</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {onInspection && <button className="wt-switch" onClick={onInspection}>Inspection</button>}
        {onDocs && <button className="wt-switch" onClick={onDocs}>Documents</button>}
        {onOnCall && <button className="wt-switch" onClick={onOnCall}>On-call</button>}
        {onGovernance && <button className="wt-switch" onClick={onGovernance}>Governance</button>}
        <button className="wt-switch" onClick={onSwitch}>Switch view</button>
        <Shield />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={user} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontFamily: LT, fontSize: 13.5, color: C.cream, fontWeight: 700 }}>{user}</span>
            <span style={{ fontFamily: LT, fontSize: 12, color: C.dim }}>{role}</span>
          </div>
          <ChevronDown size={16} color={C.dim} />
        </div>
      </div>
    </div>
  );
}
function Footer() {
  return (
    <div className="wt-footer">
      <Shield size={16} />
      <span>KCSIE 2024 aligned&nbsp;&nbsp;·&nbsp;&nbsp;UK GDPR&nbsp;&nbsp;·&nbsp;&nbsp;Data residency: UK</span>
    </div>
  );
}
function KpiCard({ k, i, onClick }) {
  const Icon = k.icon;
  const numCol = k.tone === 'red' ? C.red : C.amber;
  const clickable = !!onClick;
  return (
    <div className={'wt-card wt-rise' + (clickable ? ' wt-hover wt-kpi-click' : '')} onClick={onClick} style={{ position: 'relative', animationDelay: `${i * 70}ms`, cursor: clickable ? 'pointer' : 'default' }}>
      <div style={{ fontFamily: PF, fontSize: 17, color: C.cream, marginBottom: 14 }}>{k.label}</div>
      <div style={{ fontFamily: LT, fontWeight: 700, fontSize: 46, color: numCol, lineHeight: 1 }}>{k.value}</div>
      <div style={{ fontFamily: PF, fontStyle: 'italic', fontSize: 13, color: C.dim, marginTop: 14 }}>{k.sub}</div>
      <Icon size={26} color="rgba(244,237,224,0.16)" strokeWidth={1.5} style={{ position: 'absolute', top: 22, right: 22 }} />
      {clickable && <div className="wt-kpi-hint"><ArrowRight size={13} /> View flags</div>}
    </div>
  );
}
function MiniStat({ label, val, tone }) {
  return (
    <div>
      <div style={{ fontFamily: LT, fontSize: 11, color: C.faint, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: LT, fontSize: 18, fontWeight: 700, color: tone }}>{val}</div>
    </div>
  );
}

/* ---- school overview ---- */
function SchoolOverview({ school, breadcrumb, onCase, onKpi, dismissed, onReport, onKcsie }) {
  return (
    <div className="wt-fade">
      {breadcrumb}
      <h1 className="wt-h1">Safeguarding overview</h1>
      <div className="wt-sub-italic">Tuesday, 28 April 2026 · 09:14</div>
      <div style={{ fontFamily: LT, fontSize: 12.5, color: C.faint, marginBottom: 26, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="wt-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} />
        Connected: SIMS · Bromcom · Wonde · Arbor — last sync 09:12
      </div>
      <div className="wt-grid-4" style={{ marginBottom: 28 }}>
        {school.kpis.map((k, i) => <KpiCard key={i} k={k} i={i} onClick={onKpi ? () => onKpi(k.key) : undefined} />)}
      </div>
      {onKcsie && (() => { const k = kcsieFor(school.id); const m = KCSIE_STATUS[k.overall]; const out = k.comps.filter(c => c.status !== 'ok').length; return (
        <div className="wt-card" style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <ShieldCheck size={22} color={m.color} />
            <div>
              <div style={{ fontFamily: PF, fontSize: 18, color: C.cream }}>KCSIE annual review</div>
              <div style={{ fontFamily: LT, fontSize: 13, color: C.dim }}>{out ? `${out} action${out > 1 ? 's' : ''} outstanding this year` : 'All components up to date'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="wt-triage-lvl" style={{ color: m.color, borderColor: m.color + '55' }}>{m.label}</span>
            <button className="wt-btn-amber-o" onClick={() => onKcsie(school.id)}>View compliance <ChevronRight size={15} /></button>
          </div>
        </div>
      ); })()}
      <div className="wt-card" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <span style={{ fontFamily: PF, fontSize: 22, color: C.cream }}>Pattern intelligence</span>
            <span style={{ fontFamily: PF, fontStyle: 'italic', fontSize: 16, color: C.amber, marginLeft: 10 }}>emerging risks</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: LT, fontSize: 12.5, color: C.dim, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={14} color={C.amber} /> Avg {avgDetection(school.patterns)} days earlier than manual</span>
            {onReport && <button className="wt-btn-amber-o" onClick={onReport}><FileText size={16} /> Termly report</button>}
          </div>
        </div>
        <div className="wt-grid-4">
          {school.patterns.map(id => {
            const c = CASES[id];
            return (
              <div key={id} className="wt-card wt-hover" style={{ position: 'relative', background: C.card2 }}>
                <TrendingUp size={18} color="rgba(244,237,224,0.22)" style={{ position: 'absolute', top: 18, right: 16 }} />
                <div style={{ fontFamily: PF, fontSize: 16.5, color: C.cream, marginBottom: 8 }}>Pupil {c.ref} <span style={{ color: C.dim }}>— {c.year}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: dismissed && dismissed.has(id) ? C.green : (c.serious ? C.red : C.amber) }} />
                  <span style={{ fontFamily: LT, fontSize: 13.5, color: dismissed && dismissed.has(id) ? C.green : (c.serious ? C.red : C.amber), fontWeight: 600 }}>{c.headline}</span>
                  {dismissed && dismissed.has(id) && <span style={{ fontFamily: LT, fontSize: 11, color: C.green, border: '1px solid rgba(95,158,114,0.4)', borderRadius: 12, padding: '2px 8px' }}>Closed</span>}
                </div>
                <div style={{ fontFamily: PF, fontStyle: 'italic', fontSize: 13.5, color: C.dim, marginBottom: 16, minHeight: 38 }}>{c.sub}</div>
                <button className="wt-btn-ghost" onClick={() => onCase(id)}>Review</button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="wt-grid-2">
        <div className="wt-card">
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: PF, fontSize: 22, color: C.cream }}>Concern volume</span>
            <span style={{ fontFamily: PF, fontStyle: 'italic', fontSize: 16, color: C.amber, marginLeft: 10 }}>30 day trend</span>
          </div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND} margin={{ top: 14, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="amb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.amber} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={C.amber} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(244,237,224,0.06)" vertical={false} />
                <XAxis dataKey="d" ticks={['30 Mar', '6 Apr', '13 Apr', '20 Apr', '27 Apr']} tick={{ fill: 'rgba(244,237,224,0.45)', fontFamily: LT, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 60]} ticks={[0, 15, 30, 45, 60]} tick={{ fill: 'rgba(244,237,224,0.45)', fontFamily: LT, fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={{ background: C.card2, border: `1px solid ${C.borderS}`, borderRadius: 10, fontFamily: LT, color: C.cream }} labelStyle={{ color: C.amber, fontFamily: LT }} cursor={{ stroke: 'rgba(244,237,224,0.2)' }} />
                <Area type="monotone" dataKey="v" stroke={C.amber} strokeWidth={2.5} fill="url(#amb)" dot={false} activeDot={{ r: 4, fill: C.amber }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="wt-card">
          <div style={{ fontFamily: PF, fontSize: 22, color: C.cream, marginBottom: 16 }}>Recent activity</div>
          {school.activity.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                <Icon size={17} color={C.dim} strokeWidth={1.7} />
                <span style={{ fontFamily: LT, fontSize: 13, color: a.amber ? C.amber : C.dim, minWidth: 96 }}>{a.t}</span>
                <span style={{ fontFamily: LT, fontSize: 13.5, color: C.cream }}>{a.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---- trust overview ---- */
function TrustOverview({ onSchool, onCohort, onKpi, onReport }) {
  return (
    <div className="wt-fade">
      <h1 className="wt-h1">Trust safeguarding overview</h1>
      <div className="wt-sub-italic">{TRUST.name} · {TRUST.count} · Tuesday, 28 April 2026</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '14px 0 22px' }}>
        <span style={{ fontFamily: LT, fontSize: 12.5, color: C.dim, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={14} color={C.amber} /> Avg {avgDetection(TRUST_CASE_INDEX.map(r => r.id))} days earlier than manual review</span>
        {onReport && <button className="wt-btn-amber-o" onClick={onReport}><FileText size={16} /> Termly governance report</button>}
      </div>
      <div className="wt-grid-4" style={{ marginBottom: 28 }}>
        {TRUST.kpis.map((k, i) => <KpiCard key={i} k={k} i={i} onClick={onKpi ? () => onKpi(k.key) : undefined} />)}
      </div>
      <div style={{ fontFamily: PF, fontSize: 22, color: C.cream, marginBottom: 16 }}>School-level view</div>
      <div className="wt-grid-4" style={{ marginBottom: 28 }}>
        {TRUST.schools.map(s => (
          <div key={s.id} className="wt-card wt-hover" onClick={() => onSchool(s.id)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <span style={{ fontFamily: PF, fontSize: 17, color: C.cream }}>{s.name}</span>
              <StatusBadge status={s.status} />
            </div>
            <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim, marginBottom: 16 }}>{s.pupils} pupils</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <MiniStat label="Active concerns" val={s.concerns} tone={parseInt(s.concerns) > 30 ? C.red : C.cream} />
              <MiniStat label="Cases overdue" val={s.overdue} tone={parseInt(s.overdue) > 0 ? C.red : C.cream} />
              <div>
                <div style={{ fontFamily: LT, fontSize: 11, color: C.faint, marginBottom: 6 }}>KCSIE</div>
                {s.kcsie === 'ok' ? <CheckCircle2 size={18} color={C.green} /> : <span style={{ fontFamily: LT, fontSize: 11.5, color: C.red }}>Review pending</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="wt-card">
        <div style={{ fontFamily: PF, fontSize: 22, color: C.cream, marginBottom: 16 }}>Cross-school pattern intelligence</div>
        <div className="wt-grid-3">
          {TRUST.cross.map((x, i) => {
            const Icon = x.icon;
            return (
              <div key={i} className="wt-card" style={{ background: C.card2 }}>
                <Icon size={22} color={C.amber} strokeWidth={1.7} style={{ marginBottom: 12 }} />
                <div style={{ fontFamily: LT, fontSize: 14.5, color: C.cream, fontWeight: 600, marginBottom: 6, lineHeight: 1.35 }}>{x.title}</div>
                <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginBottom: 14 }}>{x.detail}</div>
                <button className="wt-link" onClick={() => onCohort(x.key)}>Investigate <ArrowRight size={14} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---- cohort insight ---- */
function CohortView({ cohortKey, breadcrumb }) {
  const co = COHORTS[cohortKey];
  return (
    <div className="wt-fade">
      {breadcrumb}
      <h1 className="wt-h1" style={{ fontSize: 34 }}>{co.title}</h1>
      <div style={{ height: 18 }} />
      <div className="wt-card" style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: LT, fontSize: 15, color: C.cream, lineHeight: 1.6 }}>{co.summary}</div>
      </div>
      <div className="wt-card" style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: PF, fontSize: 20, color: C.cream, marginBottom: 14 }}>By school</div>
        {co.rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
            <div>
              <div style={{ fontFamily: LT, fontSize: 14.5, color: C.cream, fontWeight: 600 }}>{r.school}</div>
              <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim }}>{r.detail}</div>
            </div>
            <div style={{ fontFamily: LT, fontSize: 20, fontWeight: 700, color: C.amber }}>{r.val}</div>
          </div>
        ))}
      </div>
      <div className="wt-watch-sees">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Brain size={20} color={C.amber} />
          <span style={{ fontFamily: PF, fontSize: 20, color: C.cream }}>What Watch recommends</span>
        </div>
        <div style={{ fontFamily: LT, fontSize: 14.5, color: C.cream, lineHeight: 1.6 }}>{co.action}</div>
      </div>
    </div>
  );
}

/* ---- timeline ---- */
function Timeline({ items }) {
  const minW = items.length * 168;
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
      <div style={{ minWidth: minW }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {items.map((n, i) => {
            const Icon = ICONS[n.icon];
            return (
              <div key={i} style={{ flex: 1, minWidth: 150 }}>
                <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 14px', minHeight: 104 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Icon size={16} color={C.amber} strokeWidth={1.8} />
                    <span style={{ fontFamily: LT, fontSize: 11.5, color: C.dim, fontWeight: 600 }}>{n.src}</span>
                  </div>
                  <div style={{ fontFamily: LT, fontSize: 13, color: C.cream, lineHeight: 1.4 }}>{n.text}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 28, margin: '6px 0' }}>
          <div style={{ position: 'absolute', left: '7%', right: '7%', height: 2, background: 'rgba(232,146,10,0.4)', top: '50%' }} />
          {items.map((n, i) => (
            <div key={i} style={{ flex: 1, minWidth: 150, display: 'flex', justifyContent: 'center' }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: n.tone === 'red' ? C.red : C.amber, border: `3px solid ${C.bg}`, boxShadow: `0 0 0 1px ${n.tone === 'red' ? C.red : C.amber}`, zIndex: 1 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {items.map((n, i) => (
            <div key={i} style={{ flex: 1, minWidth: 150, textAlign: 'center' }}>
              <div style={{ fontFamily: LT, fontSize: 13, color: C.cream, fontWeight: 700 }}>{n.date}</div>
              <div style={{ fontFamily: LT, fontSize: 12, color: C.dim }}>{n.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- escalation pathway ---- */
const LEVELS = [
  { n: 1, name: 'Universal' }, { n: 2, name: 'Early Help' },
  { n: 3, name: 'Targeted' }, { n: 4, name: 'Specialist / CP' },
];
function Escalation({ esc, serious }) {
  const col = esc.level === 4 ? C.red : C.amber;
  return (
    <div className="wt-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <Network size={20} color={C.amber} />
        <span style={{ fontFamily: PF, fontSize: 21, color: C.cream }}>Escalation pathway</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {LEVELS.map(l => {
          const active = l.n === esc.level;
          return (
            <div key={l.n} style={{ flex: 1 }}>
              <div style={{ height: 6, borderRadius: 4, background: active ? col : 'rgba(244,237,224,0.1)', boxShadow: active ? `0 0 12px ${col}66` : 'none', marginBottom: 8 }} />
              <div style={{ fontFamily: LT, fontSize: 11.5, textAlign: 'center', color: active ? col : C.faint, fontWeight: active ? 700 : 400 }}>{l.name}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: LT, fontSize: 12, color: C.faint, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Recommended route</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {esc.route.map((r, i) => (
          <span key={i} style={{ fontFamily: LT, fontSize: 13, padding: '7px 13px', borderRadius: 20, background: serious ? C.redSoft : C.amberSoft, border: `1px solid ${serious ? 'rgba(208,90,62,0.35)' : 'rgba(232,146,10,0.3)'}`, color: serious ? C.red : C.amberB, fontWeight: 600 }}>{r}</span>
        ))}
      </div>
      <div style={{ fontFamily: LT, fontSize: 12, color: C.faint, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Why this level</div>
      <div style={{ fontFamily: LT, fontSize: 14, color: C.cream, lineHeight: 1.6 }}>{esc.rationale}</div>
    </div>
  );
}

/* ---- triage list (find flags fast) ---- */
function TriageList({ title, subtitle, note, rows, breadcrumb, onOpen, dismissed }) {
  return (
    <div className="wt-fade">
      {breadcrumb}
      <h1 className="wt-h1" style={{ fontSize: 34 }}>{title}</h1>
      <div className="wt-sub-italic">{subtitle}</div>
      <div style={{ height: 18 }} />
      {rows.length === 0 ? (
        <div className="wt-card" style={{ fontFamily: LT, fontSize: 14, color: C.dim, fontStyle: 'italic' }}>No cases in this category right now.</div>
      ) : (
        <div className="wt-card" style={{ padding: 0, overflow: 'hidden' }}>
          {rows.map((r, i) => {
            const lvl = LEVEL_META[r.level];
            return (
              <button key={i} className="wt-triage-row" onClick={() => onOpen(r.id, r.sid)} style={{ borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.serious ? C.red : lvl.color, flexShrink: 0, boxShadow: r.serious ? `0 0 8px ${C.red}66` : 'none' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: LT, fontSize: 14.5, color: C.cream, fontWeight: 700 }}>Pupil {r.ref} <span style={{ color: C.dim, fontWeight: 400 }}>· {r.year}</span></div>
                    <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.headline} · {r.schoolName}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                  {dismissed && dismissed.has(r.id) && <span className="wt-triage-lvl" style={{ color: C.green, borderColor: 'rgba(95,158,114,0.45)' }}>Closed</span>}
                  <span className="wt-triage-lvl" style={{ color: lvl.color, borderColor: lvl.color + '55' }}>{lvl.label}</span>
                  <span style={{ fontFamily: LT, fontSize: 12.5, color: C.faint, minWidth: 96, textAlign: 'right' }} className="wt-triage-conf">{r.confidence}</span>
                  <span style={{ fontFamily: LT, fontSize: 13, color: C.amber, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>Review <ChevronRight size={15} /></span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {note && <div style={{ fontFamily: LT, fontSize: 12.5, color: C.faint, marginTop: 14 }}>{note}</div>}
    </div>
  );
}

/* ---- case view ---- */
function CaseView({ caseId, schoolName, revealed, onReveal, pupilName, dismissed, onDismiss, notes, onAddNote, colleagues, onOpenCaseFile, caseFileOpen, onScheduleReview, reviews, breadcrumb, audit, onAudit, onWorkflow, toast, onToast, onLinked, caseDocs, onOpenDoc, referral, onRecordResponse, onChase, onReRefer }) {
  const c = CASES[caseId];
  const sch = schoolName || c.school;
  const serious = !!c.serious;
  const threshold = canReveal(c);
  const [revealOpen, setRevealOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [tagSel, setTagSel] = useState([]);
  const dDays = detectionDays(caseId);
  function toggleTag(name) { setTagSel(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name]); }
  return (
    <div className="wt-fade">
      {breadcrumb}
      <h1 className="wt-h1" style={{ fontSize: 34 }}>Pattern detected{' \u2014 '}{revealed ? pupilName : `Pupil ${c.ref}`}, {c.year}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: (threshold && !revealed && revealOpen) ? 14 : 24 }}>
        <span style={{ fontFamily: PF, fontStyle: 'italic', fontSize: 16, color: C.amber }}>{c.sub}</span>
        <span style={{ fontFamily: LT, fontSize: 12.5, color: C.dim, display: 'inline-flex', alignItems: 'center', gap: 6 }}><GraduationCap size={14} color={C.dim} /> {sch}</span>
        <span style={{ fontFamily: LT, fontSize: 12.5, padding: '5px 12px', borderRadius: 8, border: `1px solid ${serious ? 'rgba(208,90,62,0.4)' : 'rgba(232,146,10,0.4)'}`, color: serious ? C.red : C.amber, fontWeight: 600 }}>Confidence: {c.confidence}</span>
        {!threshold && (
          <span style={{ fontFamily: LT, fontSize: 12.5, padding: '5px 12px', borderRadius: 8, background: 'rgba(244,237,224,0.05)', border: `1px solid ${C.border}`, color: C.dim, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lock size={13} /> Identity sealed · below action threshold</span>
        )}
        {threshold && !revealed && (
          <button onClick={() => setRevealOpen(v => !v)} style={{ fontFamily: LT, fontSize: 12.5, fontWeight: 700, padding: '6px 13px', borderRadius: 8, cursor: 'pointer', background: serious ? C.redSoft : C.amberSoft, border: `1px solid ${serious ? 'rgba(208,90,62,0.45)' : 'rgba(232,146,10,0.45)'}`, color: serious ? C.red : C.amberB, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Unlock size={13} /> Reveal pupil identity</button>
        )}
        {revealed && (
          <span style={{ fontFamily: LT, fontSize: 12.5, padding: '5px 12px', borderRadius: 8, background: 'rgba(95,158,114,0.12)', border: '1px solid rgba(95,158,114,0.4)', color: C.green, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Unlock size={13} /> Identity revealed · logged · {c.ref}</span>
        )}
      </div>
      {threshold && !revealed && revealOpen && (
        <div className="wt-card" style={{ marginBottom: 24, borderColor: serious ? 'rgba(208,90,62,0.4)' : 'rgba(232,146,10,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <Lock size={16} color={serious ? C.red : C.amber} />
            <span style={{ fontFamily: PF, fontSize: 17, color: C.cream }}>Reveal pupil identity</span>
          </div>
          <div style={{ fontFamily: LT, fontSize: 13.5, color: C.dim, lineHeight: 1.55, marginBottom: 14 }}>This case has crossed the action threshold. Revealing the pupil&rsquo;s name is recorded against you in the audit trail. Select a reason to continue.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {REVEAL_REASONS.map(r => (
              <button key={r} onClick={() => { onReveal(r); setRevealOpen(false); }} className="wt-btn-amber-o">{r}</button>
            ))}
            <button onClick={() => setRevealOpen(false)} className="wt-btn-ghost-sm">Cancel</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: C.amberSoft, border: '1px solid rgba(232,146,10,0.25)', marginBottom: 22 }}>
        <Clock size={16} color={C.amber} />
        <span style={{ fontFamily: LT, fontSize: 13.5, color: C.cream }}>Time to surface: Watch flagged this pattern <span style={{ color: C.amberB, fontWeight: 700 }}>{dDays} days</span> before {detectionVs(c)} would have reached it.</span>
      </div>
      <div className="wt-case-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {dismissed && (
            <div className="wt-card" style={{ borderColor: 'rgba(95,158,114,0.4)', background: 'rgba(95,158,114,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={20} color={C.green} />
                <span style={{ fontFamily: PF, fontSize: 18, color: C.cream }}>Reviewed and closed{' \u2014 '}no further concern</span>
              </div>
              <div style={{ fontFamily: LT, fontSize: 13.5, color: C.dim, marginTop: 8, lineHeight: 1.55 }}>A DSL has reviewed this pattern and recorded that no further action is needed. Watch has stood the pattern down and will re-flag only if new signals appear. This decision is in the audit trail.</div>
            </div>
          )}
          <div className="wt-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontFamily: PF, fontSize: 21, color: C.cream }}>{c.timeline.length}-day signal timeline</span>
              <span style={{ fontFamily: LT, fontSize: 13, color: C.dim }}>{c.window}</span>
            </div>
            <Timeline items={c.timeline} />
          </div>

          <div className="wt-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Eye size={20} color={C.amber} />
              <span style={{ fontFamily: PF, fontSize: 21, color: C.cream }}>Risk interpretation</span>
            </div>
            {c.interpretation.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ flex: '0 0 38%' }}>
                  <div style={{ fontFamily: LT, fontSize: 13.5, color: C.cream, fontWeight: 600, lineHeight: 1.4 }}>{r.sig}</div>
                  <div style={{ fontFamily: LT, fontSize: 11.5, color: C.amber, marginTop: 3 }}>source: {r.src}</div>
                </div>
                <ArrowRight size={16} color={C.faint} style={{ flexShrink: 0, marginTop: 3 }} />
                <div style={{ flex: 1, fontFamily: LT, fontSize: 13.5, color: C.dim, lineHeight: 1.5 }}>{r.mean}</div>
              </div>
            ))}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: LT, fontSize: 12, color: C.faint, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Watch&rsquo;s overall assessment</div>
              <div style={{ fontFamily: LT, fontSize: 14, color: C.cream, lineHeight: 1.6 }}>{c.overall}</div>
            </div>
          </div>

          <div className="wt-watch-sees">
            <div style={{ fontFamily: PF, fontSize: 24, color: C.cream, marginBottom: 12 }}>What Watch sees</div>
            <div style={{ fontFamily: LT, fontSize: 14.5, color: C.cream, lineHeight: 1.65, marginBottom: 16 }}>{c.narrative}</div>
            <div style={{ marginBottom: 18 }}>
              {c.recommend.map((r, i) => (
                <div key={i} style={{ fontFamily: PF, fontStyle: 'italic', fontSize: 14.5, color: C.amber, lineHeight: 1.6 }}>{i === 0 ? 'Recommended action: ' : 'Then: '}{r}.</div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="wt-btn-amber" onClick={() => onScheduleReview(caseId)}><Calendar size={16} /> Schedule pastoral review</button>
              <button className="wt-btn-amber-o" onClick={() => onOpenCaseFile(caseId)}><FolderOpen size={16} /> {caseFileOpen ? 'View case file' : 'Open case file'}</button>
              {!dismissed && <button className="wt-btn-ghost" onClick={() => setDismissOpen(v => !v)}><Check size={16} /> Mark reviewed, no concern</button>}
            </div>
            {!dismissed && dismissOpen && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.5 }}>Closing a flag tells Watch to stand the pattern down. Your decision and reason are recorded in the audit trail. Choose a reason:</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {DISMISS_REASONS.map(r => (
                    <button key={r} className="wt-btn-amber-o" onClick={() => { onDismiss(r); setDismissOpen(false); }}>{r}</button>
                  ))}
                  <button className="wt-btn-ghost-sm" onClick={() => setDismissOpen(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {reviews && reviews.length > 0 && (
            <div className="wt-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Calendar size={20} color={C.amber} />
                <span style={{ fontFamily: PF, fontSize: 21, color: C.cream }}>Scheduled reviews</span>
              </div>
              {reviews.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: '11px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: C.card2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Calendar size={17} color={C.amber} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: LT, fontSize: 14, color: C.cream, fontWeight: 700 }}>{r.when}</div>
                    {r.attendees && r.attendees.length > 0 && <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim }}>With {r.attendees.join(', ')}</div>}
                    {r.note && <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim, fontStyle: 'italic', marginTop: 3 }}>{r.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Escalation esc={c.escalation} serious={serious} />

          <div className="wt-card">
            <div style={{ fontFamily: PF, fontSize: 21, color: C.cream, marginBottom: 6 }}>Take action</div>
            {dismissed ? (
              <div style={{ fontFamily: LT, fontSize: 13.5, color: C.dim, lineHeight: 1.55 }}>This flag has been reviewed and closed, so no communications are required. Reopen it from the audit trail if circumstances change.</div>
            ) : (
              <>
                <div style={{ fontFamily: LT, fontSize: 13.5, color: C.dim, marginBottom: 16 }}>Watch drafts the communication using this case. You review and finalise.</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {c.comms.map(type => {
                    const m = COMM_META[type]; const Icon = m.icon;
                    return (
                      <button key={type} className={m.primary ? 'wt-btn-red' : 'wt-btn-amber'} onClick={() => onWorkflow(caseId, type)}><Icon size={16} /> {m.label}</button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="wt-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <ClipboardList size={20} color={C.amber} />
              <span style={{ fontFamily: PF, fontSize: 21, color: C.cream }}>Case notes &amp; collaboration</span>
            </div>
            <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginBottom: 16 }}>Log an update and tag colleagues across the school or trust. Every note and tag is written to the audit trail.</div>
            {notes.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                {notes.map((n, i) => (
                  <div key={i} style={{ padding: '12px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <Avatar name={n.author} size={26} />
                      <span style={{ fontFamily: LT, fontSize: 13, color: C.cream, fontWeight: 700 }}>{n.author}</span>
                      <span style={{ fontFamily: LT, fontSize: 12, color: C.faint }}>{n.t}</span>
                    </div>
                    <div style={{ fontFamily: LT, fontSize: 13.5, color: C.cream, lineHeight: 1.55, marginBottom: (n.tags && n.tags.length) ? 8 : 0 }}>{n.body}</div>
                    {n.tags && n.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {n.tags.map((t, j) => (
                          <span key={j} style={{ fontFamily: LT, fontSize: 11.5, color: C.amberB, background: C.amberSoft, border: '1px solid rgba(232,146,10,0.3)', borderRadius: 12, padding: '2px 9px' }}>@ {t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <textarea className="wt-note-input" placeholder="Add a note to this case..." value={noteText} onChange={e => setNoteText(e.target.value)} spellCheck={false} />
            <div style={{ fontFamily: LT, fontSize: 12, color: C.faint, margin: '14px 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tag colleagues</div>
            <div style={{ fontFamily: LT, fontSize: 12, color: C.dim, marginBottom: 7 }}>{sch} team</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {colleagues.school.map(p => (
                <button key={p.name} className={'wt-tag' + (tagSel.includes(p.name) ? ' wt-tag-on' : '')} onClick={() => toggleTag(p.name)}>{p.name} · {p.role}</button>
              ))}
            </div>
            <div style={{ fontFamily: LT, fontSize: 12, color: C.dim, marginBottom: 7 }}>Across {TRUST.name}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {colleagues.trust.map(p => (
                <button key={p.name} className={'wt-tag' + (tagSel.includes(p.name) ? ' wt-tag-on' : '')} onClick={() => toggleTag(p.name)}>{p.name} · {p.role}</button>
              ))}
            </div>
            <button className="wt-btn-amber" style={{ opacity: noteText.trim() ? 1 : 0.5, cursor: noteText.trim() ? 'pointer' : 'default' }} onClick={() => { if (!noteText.trim()) return; onAddNote(noteText.trim(), tagSel); setNoteText(''); setTagSel([]); }}><Send size={16} /> Add note{tagSel.length ? ` & notify ${tagSel.length}` : ''}</button>
          </div>

          <div className="wt-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <ShieldCheck size={20} color={C.green} />
              <span style={{ fontFamily: PF, fontSize: 21, color: C.cream }}>Audit trail</span>
            </div>
            {audit.length === 0
              ? <div style={{ fontFamily: LT, fontSize: 13.5, color: C.faint, fontStyle: 'italic' }}>No actions logged yet. Every action you take is recorded here with a timestamp.</div>
              : audit.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                  <Check size={15} color={C.green} />
                  <span style={{ fontFamily: LT, fontSize: 12.5, color: C.dim, minWidth: 56 }}>{a.t}</span>
                  <span style={{ fontFamily: LT, fontSize: 13.5, color: C.cream }}>{a.text}</span>
                </div>
              ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="wt-card">
            <div style={{ fontFamily: PF, fontSize: 21, color: C.cream, marginBottom: 16 }}>Linked context</div>
            {c.linked.map((l, i) => {
              const Icon = l.icon;
              const linkable = !!(l.to && CASES[l.to] && onLinked);
              const rowStyle = { display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', borderTop: i ? `1px solid ${C.border}` : 'none' };
              const inner = (
                <>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: C.card2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={17} color={linkable ? C.amber : C.dim} strokeWidth={1.7} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: LT, fontSize: 14, color: C.cream, fontWeight: 600 }}>{l.label}</div>
                    <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim }}>{l.detail}</div>
                  </div>
                  {linkable && <span style={{ fontFamily: LT, fontSize: 12.5, color: C.amber, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>Open case <ChevronRight size={15} /></span>}
                </>
              );
              return linkable
                ? <button key={i} onClick={() => onLinked(l.to)} style={{ ...rowStyle, width: '100%', background: 'transparent', border: 'none', borderTop: i ? `1px solid ${C.border}` : 'none', textAlign: 'left', cursor: 'pointer' }}>{inner}</button>
                : <div key={i} style={rowStyle}>{inner}</div>;
            })}
          </div>
          {referral && (
            <div className="wt-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Send size={18} color={C.amber} />
                <span style={{ fontFamily: PF, fontSize: 18, color: C.cream }}>Referral</span>
              </div>
              <div style={{ fontFamily: LT, fontSize: 12, color: C.dim, marginBottom: 4 }}>Status</div>
              <div style={{ fontFamily: LT, fontSize: 14, color: C.cream, fontWeight: 600, lineHeight: 1.45 }}>{referral.line}</div>
              {referral.events && referral.events.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                  {referral.events.map((e, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < referral.events.length - 1 ? 10 : 0 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.amber, marginTop: 5, flexShrink: 0 }} />
                      <div style={{ fontFamily: LT, fontSize: 12.5, color: C.cream, lineHeight: 1.4 }}><span style={{ color: C.dim }}>{e.date}</span> {e.text}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                {referral.stage !== 'decided' ? (
                  <>
                    {onRecordResponse && <button className="wt-btn-amber" onClick={onRecordResponse} style={{ width: '100%', justifyContent: 'center' }}><Brain size={15} /> Record MASH response</button>}
                    {onChase && <button className="wt-btn-ghost-sm" onClick={onChase} style={{ width: '100%', justifyContent: 'center' }}><Clock size={14} /> Log a chase</button>}
                  </>
                ) : (
                  onReRefer && <button className="wt-btn-amber-o" onClick={onReRefer} style={{ width: '100%', justifyContent: 'center' }}><RefreshCw size={14} /> Re-refer with more information</button>
                )}
              </div>
            </div>
          )}
          <div className="wt-card">
            <div style={{ fontFamily: PF, fontSize: 21, color: C.cream, marginBottom: 14 }}>Documents</div>
            {(!caseDocs || caseDocs.length === 0)
              ? <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, lineHeight: 1.5 }}>No documents filed yet. Documents Watch drafts for this child are filed here.</div>
              : caseDocs.map((d, i) => { const Icon = DOC_ICON[d.type] || FileText;
                return (
                  <button key={d.id} onClick={() => onOpenDoc && onOpenDoc(d)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '11px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: C.card2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={15} color={C.amber} strokeWidth={1.7} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: LT, fontSize: 13.5, color: C.cream, fontWeight: 600 }}>{d.title}</div>
                      <div style={{ fontFamily: LT, fontSize: 12, color: C.dim }}>{d.type} \u00b7 {d.date}</div>
                    </div>
                    <ChevronRight size={15} color={C.faint} style={{ flexShrink: 0 }} />
                  </button>
                );
              })}
          </div>
          {serious && (
            <div className="wt-card" style={{ borderColor: 'rgba(208,90,62,0.4)', background: 'rgba(208,90,62,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={18} color={C.red} />
                <span style={{ fontFamily: PF, fontSize: 17, color: C.cream }}>Priority case</span>
              </div>
              <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, lineHeight: 1.55 }}>This case meets the threshold for a same-day statutory referral. Watch has surfaced the procedural steps so nothing is missed under time pressure.</div>
            </div>
          )}
        </div>
      </div>
      {toast && <div className="wt-toast"><Check size={16} color={C.green} /> {toast}</div>}
    </div>
  );
}

/* ---- communications workflow ---- */
function Workflow({ caseId, schoolName, revealedName, initialType, onClose, onLogged }) {
  const c = CASES[caseId];
  const sch = schoolName || c.school;
  const [type, setType] = useState(initialType);
  const [step, setStep] = useState(initialType ? 'draft' : 'select');
  const [loading, setLoading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (step === 'draft' && type) generate();
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line
  }, [step, type]);

  async function generate() {
    setLoading(true); setText(''); setStatusIdx(0);
    intervalRef.current = setInterval(() => setStatusIdx(p => (p + 1) % STATUS_LINES.length), 1100);
    const eff = { ...c, school: sch };
    if (revealedName) eff.ref = `${revealedName} (ref ${c.ref.replace('#', '')})`;
    const result = await callClaude(type, eff);
    clearInterval(intervalRef.current);
    setText(result); setLoading(false);
  }
  function copy() {
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }
  function download() {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Watch_${COMM_META[type].label.replace(/[^a-z]/gi, '_')}_${c.ref.replace('#', '')}.txt`;
    a.click(); URL.revokeObjectURL(url);
  }
  function logIt() { onLogged({ commType: type, label: COMM_META[type].label, text }); setDone(true); }

  const m = type ? COMM_META[type] : null;
  return (
    <>
      <div className="wt-backdrop" onClick={onClose} />
      <div className="wt-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: PF, fontSize: 22, color: C.cream }}>Communications workflow</span>
          <button onClick={onClose} className="wt-x"><X size={20} color={C.dim} /></button>
        </div>
        <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginBottom: 22 }}>{revealedName ? revealedName : 'Pupil ' + c.ref} · {c.year} · {sch}</div>

        {done ? (
          <div style={{ textAlign: 'center', paddingTop: 50 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(95,158,114,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
              <CheckCircle2 size={34} color={C.green} />
            </div>
            <div style={{ fontFamily: PF, fontSize: 24, color: C.cream, marginBottom: 10 }}>Action logged</div>
            <div style={{ fontFamily: LT, fontSize: 14.5, color: C.dim, lineHeight: 1.6, maxWidth: 360, margin: '0 auto 28px' }}>The {m.label.toLowerCase()} has been saved to the case file and the audit trail has been updated. The recommended action is now marked complete.</div>
            <button className="wt-btn-amber" onClick={onClose} style={{ margin: '0 auto' }}>Done</button>
          </div>
        ) : step === 'select' ? (
          <>
            <div style={{ fontFamily: LT, fontSize: 13.5, color: C.cream, marginBottom: 16 }}>Choose what to draft. Watch will use this case as the source.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {c.comms.map(t => {
                const cm = COMM_META[t]; const Icon = cm.icon;
                return (
                  <button key={t} className="wt-select-row" onClick={() => { setType(t); setStep('draft'); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                      <Icon size={20} color={cm.primary ? C.red : C.amber} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontFamily: LT, fontSize: 14.5, color: C.cream, fontWeight: 600 }}>{cm.label}</div>
                        <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim }}>{cm.blurb}</div>
                      </div>
                    </div>
                    <ChevronRight size={18} color={C.faint} />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, padding: '12px 14px', background: C.card2, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <m.icon size={18} color={m.primary ? C.red : C.amber} />
              <span style={{ fontFamily: LT, fontSize: 14, color: C.cream, fontWeight: 600 }}>{m.label}</span>
            </div>
            {loading ? (
              <div style={{ paddingTop: 30, textAlign: 'center' }}>
                <Loader2 size={30} color={C.amber} className="wt-spin" style={{ margin: '0 auto 18px' }} />
                <div className="wt-status-fade" key={statusIdx} style={{ fontFamily: LT, fontSize: 14, color: C.cream }}>{STATUS_LINES[statusIdx]}&hellip;</div>
                <div style={{ fontFamily: LT, fontSize: 12, color: C.faint, marginTop: 8 }}>Watch is drafting from the case chronology</div>
              </div>
            ) : (
              <>
                <textarea className="wt-doc" value={text} onChange={e => setText(e.target.value)} spellCheck={false} />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                  <button className="wt-btn-ghost-sm" onClick={generate}><RefreshCw size={14} /> Regenerate</button>
                  <button className="wt-btn-ghost-sm" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
                  <button className="wt-btn-ghost-sm" onClick={download}><Download size={14} /> Download</button>
                </div>
                <button className="wt-btn-amber" onClick={logIt} style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}><ShieldCheck size={16} /> Log to case file &amp; complete action</button>
                <div style={{ fontFamily: LT, fontSize: 11.5, color: C.faint, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>Draft generated by Watch. Always reviewed and approved by the DSL before it leaves the school.</div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ---- role selector ---- */
function RoleSelector({ onPick }) {
  return (
    <div className="wt-select-screen">
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <span className="wt-watch" style={{ fontSize: 52 }}>Watch</span>
        <span className="wt-by" style={{ fontSize: 22, marginLeft: 10 }}>by Sentinel</span>
      </div>
      <div style={{ fontFamily: PF, fontStyle: 'italic', fontSize: 18, color: C.amber, textAlign: 'center', marginBottom: 6 }}>Every child. Seen. Safe. Supported.</div>
      <div style={{ fontFamily: LT, fontSize: 14.5, color: C.dim, textAlign: 'center', maxWidth: 460, marginBottom: 44, lineHeight: 1.6 }}>Choose a view to explore the demo. Both flows use the same intelligence layer over your existing systems.</div>
      <div className="wt-select-cards">
        <div className="wt-card wt-hover" onClick={() => onPick('school')} style={{ cursor: 'pointer', padding: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: C.amberSoft, border: '1px solid rgba(232,146,10,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <GraduationCap size={26} color={C.amber} />
          </div>
          <div style={{ fontFamily: PF, fontSize: 24, color: C.cream, marginBottom: 10 }}>Single school</div>
          <div style={{ fontFamily: LT, fontSize: 14, color: C.dim, lineHeight: 1.6, marginBottom: 20 }}>The Designated Safeguarding Lead view. Dashboard, pattern intelligence, case drill-down, escalation, and drafting third-party communications.</div>
          <div style={{ fontFamily: LT, fontSize: 13, color: C.amber, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>Bennett Memorial · {SCHOOL_DSL} <ArrowRight size={15} /></div>
        </div>
        <div className="wt-card wt-hover" onClick={() => onPick('mat')} style={{ cursor: 'pointer', padding: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: C.amberSoft, border: '1px solid rgba(232,146,10,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Building2 size={26} color={C.amber} />
          </div>
          <div style={{ fontFamily: PF, fontSize: 24, color: C.cream, marginBottom: 10 }}>Multi-Academy Trust</div>
          <div style={{ fontFamily: LT, fontSize: 14, color: C.dim, lineHeight: 1.6, marginBottom: 20 }}>The Director of Safeguarding view. Trust-wide oversight, school-level status, cross-school pattern intelligence, and drill-down into any school or case.</div>
          <div style={{ fontFamily: LT, fontSize: 13, color: C.amber, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>{TRUST.name} · {DIRECTOR} <ArrowRight size={15} /></div>
        </div>
      </div>
      <div style={{ marginTop: 44, display: 'flex', alignItems: 'center', gap: 18, fontFamily: LT, fontSize: 12.5, color: C.faint }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Shield size={15} /> KCSIE 2024 aligned</span>
        <span>UK GDPR</span>
        <span>Data residency: UK</span>
      </div>
    </div>
  );
}

/* ---- termly governance report ---- */
function buildReport(scope) {
  const isTrust = scope === 'trust';
  if (isTrust) {
    const lv = { 4: 0, 3: 0, 2: 0 };
    TRUST_CASE_INDEX.forEach(r => { lv[r.level] = (lv[r.level] || 0) + 1; });
    const schoolLines = TRUST.schools.map(s => `- ${s.name}: ${s.concerns} active, ${s.overdue} overdue, KCSIE ${s.kcsie === 'ok' ? 'up to date' : 'review pending'}`).join('\n');
    const avg = avgDetection(TRUST_CASE_INDEX.map(r => r.id));
    return `TERMLY SAFEGUARDING REPORT
${TRUST.name}
Spring term 2026 · prepared by Watch on 28 April 2026 for the Trust Board

OVERVIEW
- Active concerns across the trust: 184
- Pupils flagged this term: 62
- Cases requiring action: 9 (3 escalated)
- Open MASH referrals: 5 (2 awaiting response)
- Average time to surface: ${avg} days earlier than a manual review would have reached the same pattern.

CASES SURFACED FOR ACTION, BY LEVEL OF NEED
- Specialist / child protection: ${lv[4]}
- Targeted, multi-agency Early Help: ${lv[3]}
- Early Help, school-led: ${lv[2]}

BY SCHOOL
${schoolLines}

CROSS-SCHOOL PATTERNS
- Year 9 attendance is dipping across four schools in the same fortnight.
- Pastoral notes mentioning home stress are up 18% across the trust this term.
- Three schools are approaching their KCSIE annual review window.

GOVERNANCE NOTES
- Pupil identity stays sealed until a case crosses the action threshold. Every reveal is reason-stamped and recorded.
- All actions are captured in a full audit trail with timestamp and user.
- Data is held in the UK and processed in line with UK GDPR, the Data Protection Act 2018, and KCSIE 2024.

This report is generated by Watch from live safeguarding data to support board oversight. Figures reflect the position on 28 April 2026.`;
  }
  const sc = getSchool(scope);
  const pats = sc.patterns || [];
  const lv = { 4: 0, 3: 0, 2: 0 };
  pats.forEach(id => { const c = CASES[id]; if (c) lv[c.escalation.level] = (lv[c.escalation.level] || 0) + 1; });
  const avg = avgDetection(pats);
  const caseLines = pats.map(id => { const c = CASES[id]; return `- Pupil ${c.ref} (${c.year}): ${c.headline}, ${LEVEL_META[c.escalation.level].label}`; }).join('\n');
  return `TERMLY SAFEGUARDING REPORT
${sc.name}
Spring term 2026 · prepared by Watch on 28 April 2026 for the Headteacher and Governors

OVERVIEW
- Active concerns: ${sc.kpis[0].value}
- Children flagged this week: ${sc.kpis[1].value}
- Cases requiring action: ${sc.kpis[2].value}
- Average time to surface: ${avg} days earlier than a manual review.

CASES SURFACED FOR ACTION, BY LEVEL OF NEED
- Specialist / child protection: ${lv[4]}
- Targeted, multi-agency Early Help: ${lv[3]}
- Early Help, school-led: ${lv[2]}

CURRENT PATTERNS
${caseLines || '- No active patterns surfaced.'}

GOVERNANCE NOTES
- Pupil identity stays sealed until a case crosses the action threshold. Every reveal is reason-stamped and recorded.
- All actions are captured in a full audit trail.
- Data is held in the UK and processed in line with UK GDPR and KCSIE 2024.

This report is generated by Watch from live safeguarding data to support governor oversight.`;
}

function buildKcsiePack(scope) {
  if (scope === 'trust') {
    const lines = TRUST.schools.map(s => { const k = kcsieFor(s.id); return `- ${s.name}: ${KCSIE_STATUS[k.overall].label}`; }).join('\n');
    const actions = [];
    TRUST.schools.forEach(s => { const k = kcsieFor(s.id); k.comps.filter(c => c.status !== 'ok').forEach(c => actions.push(`- ${s.name}: ${c.label} (${c.due})`)); });
    return `KCSIE ANNUAL COMPLIANCE PACK
${TRUST.name}
Prepared by Watch on 28 April 2026 for the Trust Board

PURPOSE
This pack summarises each school's position against the annual safeguarding compliance cycle that sits around Keeping Children Safe in Education 2024. It supports trustee assurance. KCSIE is statutory guidance, not a return, so this is not submitted to the Department for Education.

SCHOOL STATUS
${lines}

OUTSTANDING ACTIONS
${actions.length ? actions.join('\n') : '- None. All schools are up to date.'}

ASSURANCE NOTES
- Concerns are recorded and managed with a full audit trail in Watch.
- Pupil identity is sealed until a case crosses the action threshold, with every reveal logged.
- Section 175 self-assessments are pre-populated by Watch for each school to review and submit to the local authority.

Generated by Watch from live records. Reviewed by the trust safeguarding lead before circulation.`;
  }
  const k = kcsieFor(scope);
  const name = getSchool(scope).name;
  const comps = k.comps.map(c => `- ${c.label}: ${KCSIE_STATUS[c.status].label}. ${c.detail}. ${c.due}.`).join('\n');
  const actions = k.comps.filter(c => c.status !== 'ok').map(c => `- ${c.label} (${c.due})`);
  return `KCSIE ANNUAL COMPLIANCE PACK
${name}
Prepared by Watch on 28 April 2026 for the Headteacher and Governors

PURPOSE
This pack summarises the school's position against the annual safeguarding compliance cycle around Keeping Children Safe in Education 2024. It supports governor assurance.

COMPONENTS
${comps}

OUTSTANDING ACTIONS
${actions.length ? actions.join('\n') : '- None. All components are up to date.'}

ASSURANCE NOTES
- Concerns are recorded and managed with a full audit trail in Watch.
- The section 175 self-assessment is pre-populated by Watch for review and submission to the local authority.

Generated by Watch from live records. Reviewed by the DSL before circulation.`;
}

function buildS175(id) {
  const k = kcsieFor(id);
  const name = getSchool(id).name;
  const dsl = dslFor(name);
  const sc = getSchool(id);
  const pats = sc.patterns || [];
  const lv4 = pats.filter(p => CASES[p] && CASES[p].escalation.level === 4).length;
  const open = pats.length;
  const get = (label) => k.comps.find(c => c.label === label) || { status: 'ok', detail: '' };
  const st = (label) => KCSIE_STATUS[get(label).status].label;
  return `SECTION 175 / 157 SAFEGUARDING SELF-ASSESSMENT
${name}
Prepared by Watch on 28 April 2026 for review and submission to Kent County Council

This self-assessment is pre-populated by Watch from the school's live safeguarding records. It must be reviewed and signed off by the Designated Safeguarding Lead and headteacher before it is submitted to the local authority. Watch does not submit it on the school's behalf.

1. LEADERSHIP AND MANAGEMENT
- A Designated Safeguarding Lead is in place: ${dsl}.
- Safeguarding is a standing item for the governing body.
Status: Up to date

2. SAFEGUARDING POLICIES
- Child protection policy reviewed annually and aligned to KCSIE 2024.
Status: ${st('Safeguarding policy annual review')}

3. SAFER RECRUITMENT AND THE SINGLE CENTRAL RECORD
- A single central record is maintained for all pre-employment checks.
Status: ${st('Single Central Record')}

4. TRAINING
- The DSL is trained to the required level and within the renewal period.
- All staff have read Part 1 of KCSIE: ${get('Staff read KCSIE Part 1').detail}.
Status: ${st('Staff read KCSIE Part 1')}

5. RECORD KEEPING AND INFORMATION SHARING
- Concerns are recorded and managed with a full audit trail in Watch.
- Pupil identity is sealed until a case crosses the action threshold, with every reveal logged.
Status: Up to date

6. CHILD PROTECTION AND EARLY HELP
- Referrals are made in line with the local continuum of need.
- ${open} cases are currently surfaced for action, of which ${lv4} are at the specialist or child protection level.
Status: Up to date

DECLARATION
To be signed by the Designated Safeguarding Lead and the headteacher prior to submission to the local authority.

Pre-populated by Watch from live records on 28 April 2026.`;
}

function DocPanel({ doc, onClose }) {
  const [copied, setCopied] = useState(false);
  function copy() { if (navigator.clipboard) navigator.clipboard.writeText(doc.text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
  function download() {
    const blob = new Blob([doc.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = doc.filename; a.click(); URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="wt-backdrop" onClick={onClose} />
      <div className="wt-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: PF, fontSize: 22, color: C.cream }}>{doc.title}</span>
          <button onClick={onClose} className="wt-x"><X size={20} color={C.dim} /></button>
        </div>
        <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginBottom: 18 }}>{doc.subtitle}</div>
        <pre className="wt-report">{doc.text}</pre>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button className="wt-btn-ghost-sm" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
          <button className="wt-btn-ghost-sm" onClick={download}><Download size={14} /> Download</button>
        </div>
        <div style={{ fontFamily: LT, fontSize: 11.5, color: C.faint, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>Generated by Watch from live data. Reviewed and signed off before use.</div>
      </div>
    </>
  );
}

/* ---- AI document reading (human confirms) ---- */
const MASH_SAMPLE = `KENT COUNTY COUNCIL
MULTI-AGENCY SAFEGUARDING HUB
Decision and feedback to referrer

Date: 1 May 2026
Re: Pupil reference 2207, Year 6

Thank you for your referral dated 24 April 2026 regarding concerns that the above child feels unsafe at home, alongside neglect and welfare indicators.

The information has been screened by a qualified social worker. The threshold for a statutory social work assessment under section 47 is not met at this time. However, the level of need indicates that targeted Early Help is appropriate.

Decision: step down to Early Help.
Recommended next step: the school to lead an Early Help assessment and convene a Team Around the Family, with a review in six weeks. Please contact the duty Early Help coordinator to register the plan and make contact with the family to agree it.`;

const TRAINING_SAMPLE = `NSPCC LEARNING
Certificate of Completion

This certifies that the named delegate has completed:
Designated Safeguarding Lead training (Level 3)

Date completed: 2 May 2026
Valid for two years.
Renewal due: 2 May 2028

Reference: DSL-2026-0512`;

async function readDocument(mode, text) {
  const system = mode === 'mash'
    ? 'You are Watch, a UK safeguarding platform. Read the multi-agency safeguarding hub response letter provided and extract the decision. Return ONLY a JSON object, with no preamble and no code fences, with keys: "decision" (one of "No further action", "Early Help", "Child in Need", "Child Protection"), "rationale" (one short sentence, British English, no em dashes), "nextStep" (one short sentence, British English, no em dashes). Base it only on the text provided.'
    : 'You are Watch, a UK safeguarding platform. Read the training certificate provided and extract the details. Return ONLY a JSON object, with no preamble and no code fences, with keys: "course" (string), "completed" (date as written), "expires" (date as written). Base it only on the text provided.';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 24000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 400, system, messages: [{ role: 'user', content: text }] }),
    });
    clearTimeout(timer);
    const data = await res.json();
    let raw = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const obj = JSON.parse(raw);
    if (mode === 'mash' && !obj.decision) throw new Error('bad');
    if (mode === 'training' && !obj.expires) throw new Error('bad');
    return obj;
  } catch (e) {
    clearTimeout(timer);
    return mode === 'mash'
      ? { decision: 'Early Help', rationale: 'The threshold for a statutory section 47 assessment was not met, but the level of need warrants targeted support.', nextStep: 'Lead an Early Help assessment at school and convene a Team Around the Family, with a review in six weeks.' }
      : { course: 'Designated Safeguarding Lead training (Level 3)', completed: '2 May 2026', expires: '2 May 2028' };
  }
}

function DocReadPanel({ mode, onApply, onClose }) {
  const [text, setText] = useState(mode === 'mash' ? MASH_SAMPLE : TRAINING_SAMPLE);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState(null);
  async function read() { setReading(true); setResult(null); const r = await readDocument(mode, text); setResult(r); setReading(false); }
  const title = mode === 'mash' ? 'Record MASH response' : 'Update from certificate';
  return (
    <>
      <div className="wt-backdrop" onClick={onClose} />
      <div className="wt-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: PF, fontSize: 22, color: C.cream }}>{title}</span>
          <button onClick={onClose} className="wt-x"><X size={20} color={C.dim} /></button>
        </div>
        <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginBottom: 16 }}>Paste the document below. Watch reads it and proposes an update. Nothing changes until you confirm.</div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={mode === 'mash' ? 12 : 9} style={{ width: '100%', boxSizing: 'border-box', background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, color: C.cream, fontFamily: LT, fontSize: 13, lineHeight: 1.5, resize: 'vertical', outline: 'none' }} />
        <button className="wt-btn-amber" onClick={read} disabled={reading} style={{ marginTop: 12 }}>{reading ? <><Loader2 size={15} className="wt-spin" /> Reading...</> : <><Brain size={15} /> Read with Watch</>}</button>

        {result && (
          <div className="wt-card wt-fade" style={{ marginTop: 18, background: C.card2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Brain size={15} color={C.amber} /><span style={{ fontFamily: LT, fontSize: 12, color: C.amber, fontWeight: 700, letterSpacing: 0.4 }}>WATCH READ THIS AND PROPOSES</span>
            </div>
            {mode === 'mash' ? (
              <div style={{ fontFamily: LT, fontSize: 14, color: C.cream, lineHeight: 1.6 }}>
                <div><span style={{ color: C.dim }}>Decision:</span> <strong>{result.decision}</strong></div>
                <div style={{ marginTop: 4 }}><span style={{ color: C.dim }}>Why:</span> {result.rationale}</div>
                <div style={{ marginTop: 4 }}><span style={{ color: C.dim }}>Next step:</span> {result.nextStep}</div>
              </div>
            ) : (
              <div style={{ fontFamily: LT, fontSize: 14, color: C.cream, lineHeight: 1.6 }}>
                <div><span style={{ color: C.dim }}>Course:</span> <strong>{result.course}</strong></div>
                <div style={{ marginTop: 4 }}><span style={{ color: C.dim }}>Completed:</span> {result.completed}</div>
                <div style={{ marginTop: 4 }}><span style={{ color: C.dim }}>Renewal due:</span> <strong>{result.expires}</strong></div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="wt-btn-amber" onClick={() => onApply(result)}><Check size={15} /> Confirm and apply</button>
              <button className="wt-btn-ghost-sm" onClick={onClose}>Discard</button>
            </div>
          </div>
        )}
        <div style={{ fontFamily: LT, fontSize: 11.5, color: C.faint, textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>Watch never updates a record on its own. A person confirms every change.</div>
      </div>
    </>
  );
}

/* ---- KCSIE compliance ---- */
function KcsieView({ scope, breadcrumb, onSchool, onDoc, trainingDue, onRead, onOpenComponent }) {
  const isTrust = scope === 'trust';
  if (isTrust) {
    return (
      <div className="wt-fade">
        {breadcrumb}
        <h1 className="wt-h1" style={{ fontSize: 34 }}>KCSIE annual compliance</h1>
        <div className="wt-sub-italic">{TRUST.name} · the annual safeguarding cycle around KCSIE 2024</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 0' }}>
          <button className="wt-btn-amber-o" onClick={() => onDoc({ title: 'KCSIE compliance pack', subtitle: TRUST.name + ' · board-ready · generated by Watch', text: buildKcsiePack('trust'), filename: 'Watch_KCSIE_Compliance_Pack_Trust.txt' })}><FileText size={16} /> Generate trust compliance pack</button>
        </div>
        <div className="wt-card" style={{ padding: 0, overflow: 'hidden' }}>
          {TRUST.schools.map((s, i) => { const k = kcsieFor(s.id); const m = KCSIE_STATUS[k.overall]; const out = k.comps.filter(c => c.status !== 'ok').length;
            return (
              <button key={s.id} className="wt-triage-row" onClick={() => onSchool(s.id)} style={{ borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: LT, fontSize: 14.5, color: C.cream, fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontFamily: LT, fontSize: 13, color: C.dim }}>{out ? `${out} action${out > 1 ? 's' : ''} outstanding` : 'All components up to date'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                  <span className="wt-triage-lvl" style={{ color: m.color, borderColor: m.color + '55' }}>{m.label}</span>
                  <span style={{ fontFamily: LT, fontSize: 13, color: C.amber, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>Open <ChevronRight size={15} /></span>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ fontFamily: LT, fontSize: 12.5, color: C.faint, marginTop: 14 }}>KCSIE is statutory guidance, not a return. Watch tracks the annual cycle and pre-fills the section 175 self-assessment each school submits to the local authority.</div>
      </div>
    );
  }
  const k = kcsieFor(scope);
  const name = getSchool(scope).name;
  const comps = trainingDue ? k.comps.map(c => c.label === 'DSL training (2-yearly)' ? { ...c, status: 'ok', detail: 'In date, updated from certificate', due: trainingDue } : c) : k.comps;
  return (
    <div className="wt-fade">
      {breadcrumb}
      <h1 className="wt-h1" style={{ fontSize: 34 }}>KCSIE annual review</h1>
      <div className="wt-sub-italic">{name} · aligned to KCSIE 2024</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '18px 0 20px' }}>
        <button className="wt-btn-amber" onClick={() => onDoc({ title: 'KCSIE compliance pack', subtitle: name + ' · for governors · generated by Watch', text: buildKcsiePack(scope), filename: 'Watch_KCSIE_Compliance_Pack_' + name.replace(/[^a-z]/gi, '_') + '.txt' })}><FileText size={16} /> Generate compliance pack</button>
        <button className="wt-btn-amber-o" onClick={() => onDoc({ title: 'Section 175 / 157 self-assessment', subtitle: name + ' · pre-filled for the local authority', text: buildS175(scope), filename: 'Watch_s175_Self_Assessment_' + name.replace(/[^a-z]/gi, '_') + '.txt' })}><ClipboardList size={16} /> Prepare s175 / 157 self-assessment</button>
      </div>
      <div className="wt-card" style={{ padding: 0, overflow: 'hidden' }}>
        {comps.map((c, i) => { const m = KCSIE_STATUS[c.status];
          return (
            <div key={i} className={onOpenComponent ? 'wt-clickrow' : ''} onClick={onOpenComponent ? () => onOpenComponent(c) : undefined} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 20px', borderTop: i ? `1px solid ${C.border}` : 'none', cursor: onOpenComponent ? 'pointer' : 'default' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
                {c.status === 'ok' ? <CheckCircle2 size={18} color={m.color} /> : <AlertTriangle size={18} color={m.color} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: LT, fontSize: 14, color: C.cream, fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim }}>{c.detail}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                {onRead && c.label === 'DSL training (2-yearly)' && <button className="wt-link" onClick={(e) => { e.stopPropagation(); onRead(); }}><Brain size={13} /> Update from certificate</button>}
                <span style={{ fontFamily: LT, fontSize: 12.5, color: C.faint, textAlign: 'right' }} className="wt-triage-conf">{c.due}</span>
                <span className="wt-triage-lvl" style={{ color: m.color, borderColor: m.color + '55' }}>{m.label}</span>
                {onOpenComponent && <ChevronRight size={16} color={C.faint} />}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: LT, fontSize: 12.5, color: C.faint, marginTop: 14 }}>Watch tracks each component through the year and pre-fills the section 175 self-assessment for the DSL and headteacher to review and submit to the local authority.</div>
    </div>
  );
}

/* ---- KCSIE component workspace ---- */
function kcsieOwner(label, dslName) {
  if (label === 'Single Central Record') return 'Office Manager';
  if (label === 'Governor safeguarding training') return 'Safeguarding Governor';
  return dslName;
}
const KCSIE_TASKS = {
  'Safeguarding policy annual review': ['Review the policy against KCSIE 2024 changes', 'Governor sign-off at the next meeting', 'Publish the updated policy to staff and the website'],
  'Staff read KCSIE Part 1': ['Send Part 1 to the staff still outstanding', 'Record acknowledgements as they return', 'Confirm new starters are included'],
  'Single Central Record': ['Audit every column for gaps', 'Complete the outstanding pre-employment check', 'Termly independent check by a governor'],
  'DSL training (2-yearly)': ['Book the refresher before expiry', 'File the certificate on completion'],
  'Whole-staff safeguarding training': ['Schedule the annual training session', 'Arrange a catch-up for any absentees'],
  'Governor safeguarding training': ['Book governor safeguarding training', 'Record completion for each governor'],
  'Section 175 self-assessment': ['Review the pre-filled self-assessment', 'DSL and headteacher sign off', 'Submit to the local authority'],
};
const KCSIE_EVIDENCE = {
  'Safeguarding policy annual review': ['d-cp-policy'],
  'Staff read KCSIE Part 1': ['d-staff-training'],
  'Single Central Record': ['d-scr'],
  'DSL training (2-yearly)': ['d-dsl-cert'],
  'Whole-staff safeguarding training': ['d-staff-training'],
  'Governor safeguarding training': ['d-gov-report'],
  'Section 175 self-assessment': [],
};
function seedKcsieWork(label, dslName) {
  const tasks = (KCSIE_TASKS[label] || []).map((t, i) => ({ id: 't' + i, text: t, done: false }));
  return { owner: kcsieOwner(label, dslName), tasks, docIds: (KCSIE_EVIDENCE[label] || []).slice(), audit: [] };
}

function KcsieWorkspacePanel({ comp, schoolName, work, onAddTask, onToggleTask, onAttachDoc, onOpenDoc, onClose }) {
  const [taskText, setTaskText] = useState('');
  const [picking, setPicking] = useState(false);
  const m = KCSIE_STATUS[comp.status];
  const evidence = work.docIds.map(id => DOC_CORPUS.find(d => d.id === id)).filter(Boolean);
  const pickable = DOC_CORPUS.filter(d => d.scope === 'org' && !work.docIds.includes(d.id));
  const openCount = work.tasks.filter(t => !t.done).length;
  function add() { const t = taskText.trim(); if (!t) return; onAddTask(t); setTaskText(''); }
  return (
    <>
      <div className="wt-backdrop" onClick={onClose} />
      <div className="wt-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
          <span style={{ fontFamily: PF, fontSize: 22, color: C.cream }}>{comp.label}</span>
          <button onClick={onClose} className="wt-x"><X size={20} color={C.dim} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <span style={{ fontFamily: LT, fontSize: 13, color: C.dim }}>{schoolName} \u00b7 {comp.due}</span>
          <span className="wt-triage-lvl" style={{ color: m.color, borderColor: m.color + '55' }}>{m.label}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', background: C.card2, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 22 }}>
          <Avatar name={work.owner} size={34} />
          <div>
            <div style={{ fontFamily: LT, fontSize: 12, color: C.dim }}>Owner</div>
            <div style={{ fontFamily: LT, fontSize: 14, color: C.cream, fontWeight: 700 }}>{work.owner}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: PF, fontSize: 18, color: C.cream }}>Tasks and reminders</span>
          <span style={{ fontFamily: LT, fontSize: 12.5, color: C.dim }}>{openCount} open</span>
        </div>
        <div style={{ marginBottom: 8 }}>
          {work.tasks.map((t, i) => (
            <button key={t.id} onClick={() => onToggleTask(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '11px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${t.done ? C.green : C.dim}`, background: t.done ? C.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{t.done && <Check size={13} color="#0f2419" />}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: LT, fontSize: 13.5, color: t.done ? C.dim : C.cream, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</div>
                {t.due && <div style={{ fontFamily: LT, fontSize: 11.5, color: C.faint }}>{t.due}</div>}
              </div>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <input value={taskText} onChange={e => setTaskText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="Add a task or reminder" style={{ flex: 1, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.cream, fontFamily: LT, fontSize: 13, outline: 'none' }} />
          <button className="wt-btn-amber-o" onClick={add}>Add</button>
        </div>

        <div style={{ fontFamily: PF, fontSize: 18, color: C.cream, marginBottom: 8 }}>Evidence</div>
        {evidence.length === 0 && <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginBottom: 6 }}>No evidence attached yet.</div>}
        {evidence.map((d, i) => { const Icon = DOC_ICON[d.type] || FileText;
          return (
            <button key={d.id} onClick={() => onOpenDoc(d)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '10px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.card2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={15} color={C.amber} strokeWidth={1.7} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: LT, fontSize: 13.5, color: C.cream, fontWeight: 600 }}>{d.title}</div>
                <div style={{ fontFamily: LT, fontSize: 12, color: C.dim }}>{d.type} \u00b7 {d.date}</div>
              </div>
              <ChevronRight size={15} color={C.faint} style={{ flexShrink: 0 }} />
            </button>
          );
        })}
        <button className="wt-btn-ghost-sm" onClick={() => setPicking(v => !v)} style={{ marginTop: 10 }}><FolderOpen size={14} /> Attach document</button>
        {picking && (
          <div className="wt-card wt-fade" style={{ marginTop: 10, padding: 0, overflow: 'hidden', background: C.card2 }}>
            {pickable.length === 0 && <div style={{ padding: 14, fontFamily: LT, fontSize: 13, color: C.dim }}>All repository documents are attached.</div>}
            {pickable.map((d, i) => (
              <button key={d.id} onClick={() => { onAttachDoc(d.id); setPicking(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'transparent', border: 'none', borderTop: i ? `1px solid ${C.border}` : 'none', textAlign: 'left', cursor: 'pointer', padding: '11px 14px' }}>
                <FileText size={14} color={C.amber} />
                <span style={{ fontFamily: LT, fontSize: 13.5, color: C.cream }}>{d.title}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ fontFamily: PF, fontSize: 18, color: C.cream, margin: '24px 0 8px' }}>Activity</div>
        {work.audit.length === 0
          ? <div style={{ fontFamily: LT, fontSize: 13, color: C.dim }}>No activity yet. Tasks, completions and attachments are logged here.</div>
          : work.audit.slice().reverse().map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber, marginTop: 6, flexShrink: 0 }} />
              <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim, lineHeight: 1.45 }}>{a}</div>
            </div>
          ))}
        <div style={{ fontFamily: LT, fontSize: 11.5, color: C.faint, textAlign: 'center', marginTop: 18, lineHeight: 1.5 }}>Worked on in Watch. Due dates are tracked here; reminders by email are on the roadmap.</div>
      </div>
    </>
  );
}

/* ---- inspection readiness (lens over existing data) ---- */
function inspectionOutcome(c) {
  if (c.serious || c.escalation.level >= 4) return 'Referred to the multi-agency safeguarding hub';
  if (c.escalation.level === 3) return 'Targeted support and Early Help in place';
  return 'Early Help opened, monitoring in place';
}
function InspectionView({ scope, breadcrumb, onCase, onKcsie, onEvidence }) {
  const isTrust = scope === 'trust';
  const name = isTrust ? TRUST.name : getSchool(scope).name;
  const rows = isTrust
    ? TRUST_CASE_INDEX.map(r => ({ id: r.id, sid: r.sid, action: r.action }))
    : (getSchool(scope).patterns || []).map(id => ({ id, sid: scope, action: ACTION_IDS.has(id) || (CASES[id] && (CASES[id].escalation.level >= 3 || CASES[id].serious)) }));
  const ids = rows.map(r => r.id);
  const surfaced = rows.length;
  const acted = rows.filter(r => r.action).length;
  const avgDet = avgDetection(ids);
  const sample = rows.filter(r => r.action).slice(0, 4);
  const ov = isTrust ? TRUST.schools.map(s => kcsieFor(s.id).overall) : [];
  const okN = ov.filter(o => o === 'ok').length;
  const compTone = isTrust ? (ov.includes('gap') ? C.red : (ov.includes('due') ? C.amber : C.green)) : KCSIE_STATUS[kcsieFor(scope).overall].color;
  const compVal = isTrust ? `${okN}/${ov.length} up to date` : KCSIE_STATUS[kcsieFor(scope).overall].label;
  const pick = isTrust ? [] : ['Single Central Record', 'DSL training (2-yearly)', 'Safeguarding policy annual review', 'Section 175 self-assessment'].map(l => kcsieFor(scope).comps.find(c => c.label === l)).filter(Boolean);
  return (
    <div className="wt-fade">
      {breadcrumb}
      <h1 className="wt-h1">Inspection readiness</h1>
      <div className="wt-sub-italic">{name} · evidence of safeguarding practice</div>
      <div style={{ fontFamily: LT, fontSize: 13.5, color: C.dim, margin: '12px 0 18px', maxWidth: 760, lineHeight: 1.55 }}>Drawn from your live records. This is the safeguarding work already in place, ready to walk an inspector through, not a report written for inspection.</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="wt-btn-amber-o" onClick={onEvidence}><FileText size={16} /> Generate evidence pack</button>
      </div>

      <div className="wt-card" style={{ marginBottom: 22 }}>
        <div className="wt-grid-4">
          <MiniStat label="Surfaced earlier than manual review" val={`${avgDet} days`} tone={C.amber} />
          <MiniStat label="Concerns surfaced this term" val={String(surfaced)} tone={C.cream} />
          <MiniStat label="Acted on" val={String(acted)} tone={C.cream} />
          <MiniStat label={isTrust ? 'Schools compliant' : 'Annual compliance'} val={compVal} tone={compTone} />
        </div>
      </div>

      <div className="wt-card" style={{ marginBottom: 22, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 12px' }}>
          <div style={{ fontFamily: PF, fontSize: 21, color: C.cream }}>The golden thread</div>
          <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginTop: 4 }}>Each concern, the action taken and the outcome, with timeliness. The trail an inspector follows.</div>
        </div>
        {sample.map((r, i) => { const c = CASES[r.id]; if (!c) return null;
          return (
            <button key={r.id} onClick={() => onCase(r.id, r.sid)} className="wt-clickrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, width: '100%', background: 'transparent', border: 'none', borderTop: `1px solid ${C.border}`, textAlign: 'left', cursor: 'pointer', padding: '14px 22px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Lock size={12} color={C.dim} />
                  <span style={{ fontFamily: LT, fontSize: 13.5, color: C.cream, fontWeight: 700 }}>Pupil {c.ref.replace('#', '')}</span>
                  {isTrust && <span style={{ fontFamily: LT, fontSize: 12, color: C.dim }}>{getSchool(r.sid).name}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: LT, fontSize: 12.5, lineHeight: 1.4 }}>
                  <span style={{ color: C.dim }}>{c.sub}</span>
                  <ArrowRight size={12} color={C.faint} />
                  <span style={{ color: C.cream }}>{c.escalation.route}</span>
                  <ArrowRight size={12} color={C.faint} />
                  <span style={{ color: C.amber, fontWeight: 600 }}>{inspectionOutcome(c)}</span>
                </div>
                <div style={{ fontFamily: LT, fontSize: 11.5, color: C.faint, marginTop: 6 }}>Surfaced {detectionDays(r.id)} days earlier than manual review</div>
              </div>
              <ChevronRight size={16} color={C.faint} style={{ flexShrink: 0 }} />
            </button>
          );
        })}
      </div>

      <div className="wt-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <span style={{ fontFamily: PF, fontSize: 21, color: C.cream }}>Oversight and compliance</span>
          {onKcsie && <button className="wt-link" onClick={onKcsie}>View full KCSIE compliance <ChevronRight size={14} /></button>}
        </div>
        {isTrust ? (
          <div>
            <div style={{ fontFamily: LT, fontSize: 14, color: C.cream, marginBottom: ov.every(o => o === 'ok') ? 0 : 12 }}>{okN} of {ov.length} schools up to date on the annual cycle.</div>
            {TRUST.schools.filter(s => kcsieFor(s.id).overall !== 'ok').map((s, i) => { const m = KCSIE_STATUS[kcsieFor(s.id).overall];
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ fontFamily: LT, fontSize: 13.5, color: C.cream }}>{s.name}</span>
                  <span className="wt-triage-lvl" style={{ color: m.color, borderColor: m.color + '55' }}>{m.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {pick.map((c, i) => { const m = KCSIE_STATUS[c.status];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    {c.status === 'ok' ? <CheckCircle2 size={16} color={m.color} /> : <AlertTriangle size={16} color={m.color} />}
                    <span style={{ fontFamily: LT, fontSize: 13.5, color: C.cream }}>{c.label}</span>
                  </div>
                  <span className="wt-triage-lvl" style={{ color: m.color, borderColor: m.color + '55' }}>{m.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportPanel({ scope, onClose }) {
  const [copied, setCopied] = useState(false);
  const text = buildReport(scope);
  const title = scope === 'trust' ? TRUST.name : getSchool(scope).name;
  function copy() { if (navigator.clipboard) navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
  function download() {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Watch_Safeguarding_Report_${title.replace(/[^a-z]/gi, '_')}.txt`; a.click(); URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="wt-backdrop" onClick={onClose} />
      <div className="wt-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: PF, fontSize: 22, color: C.cream }}>Termly safeguarding report</span>
          <button onClick={onClose} className="wt-x"><X size={20} color={C.dim} /></button>
        </div>
        <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginBottom: 18 }}>{title} · board-ready · generated by Watch</div>
        <pre className="wt-report">{text}</pre>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button className="wt-btn-ghost-sm" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
          <button className="wt-btn-ghost-sm" onClick={download}><Download size={14} /> Download</button>
        </div>
        <div style={{ fontFamily: LT, fontSize: 11.5, color: C.faint, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>Generated by Watch from live data. Reviewed by the safeguarding lead before circulation.</div>
      </div>
    </>
  );
}

/* ---- data governance ---- */
function Governance({ breadcrumb }) {
  const cards = [
    { icon: Lock, title: 'Anonymised by default', body: 'Every pupil is a pattern reference, not a name. Watch analyses behaviour, attendance and pastoral signals without surfacing identity.' },
    { icon: Unlock, title: 'Identity revealed only at the threshold', body: 'A name is unsealed only when a case crosses the action threshold and a DSL needs to act. The reveal requires a reason and is logged.' },
    { icon: ShieldCheck, title: 'Full audit trail', body: 'Every view, reveal, draft and decision is timestamped and attributed. The record stands up to inspection and serious case review.' },
    { icon: Eye, title: 'Human in the loop', body: 'Watch recommends. It never auto-refers and never contacts a family. A person decides, and signs every action.' },
    { icon: Building2, title: 'UK data residency', body: 'Data is hosted in the UK and processed under UK GDPR and the Data Protection Act 2018. Children\u2019s data is not transferred outside the UK.' },
    { icon: Network, title: 'Sits over your systems', body: 'Watch reads from SIMS, Bromcom, Arbor and others through Wonde. It surfaces patterns, it does not create a parallel record.' },
  ];
  const roles = [
    { role: 'Teacher / TA', sees: 'Logs pastoral signals. No analytics layer and no identities revealed.' },
    { role: 'DSL / Deputy DSL', sees: 'Full school view. Can reveal identity with a logged reason.' },
    { role: 'Headteacher', sees: 'School oversight and reports. Reveal on a logged basis.' },
    { role: 'Trust Director of Safeguarding', sees: 'Cross-trust oversight. Identity revealed only on escalation.' },
  ];
  return (
    <div className="wt-fade">
      {breadcrumb}
      <h1 className="wt-h1" style={{ fontSize: 34 }}>How Watch handles data</h1>
      <div className="wt-sub-italic">Privacy by design, built for inspection</div>
      <div style={{ height: 20 }} />
      <div className="wt-grid-3" style={{ marginBottom: 28 }}>
        {cards.map((c, i) => { const Icon = c.icon; return (
          <div key={i} className="wt-card">
            <Icon size={22} color={C.amber} strokeWidth={1.7} style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: PF, fontSize: 18, color: C.cream, marginBottom: 8 }}>{c.title}</div>
            <div style={{ fontFamily: LT, fontSize: 13.5, color: C.dim, lineHeight: 1.55 }}>{c.body}</div>
          </div>
        ); })}
      </div>
      <div className="wt-card">
        <div style={{ fontFamily: PF, fontSize: 21, color: C.cream, marginBottom: 6 }}>Role-based access</div>
        <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginBottom: 16 }}>Who sees what. Identity reveal is limited to senior safeguarding roles and is always logged.</div>
        {roles.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '12px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ flex: '0 0 240px', fontFamily: LT, fontSize: 14, color: C.cream, fontWeight: 700 }}>{r.role}</div>
            <div style={{ flex: 1, minWidth: 200, fontFamily: LT, fontSize: 13.5, color: C.dim, lineHeight: 1.5 }}>{r.sees}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: LT, fontSize: 12.5, color: C.faint, marginTop: 16 }}>KCSIE 2024 aligned · UK GDPR · Data Protection Act 2018 · Data residency: UK</div>
    </div>
  );
}

/* ---- out-of-hours on-call ---- */
function OnCall({ onOpen, onExit }) {
  const dsl = 'Daniel Fielding';
  const alerts = TRUST_CASE_INDEX.filter(r => r.level >= 3).sort((a, b) => b.level - a.level).map(r => {
    const c = CASES[r.id];
    return { id: r.id, sid: r.sid, ref: c.ref, school: getSchool(r.sid).name, headline: c.headline, urgent: r.level >= 4 || c.serious, time: r.level >= 4 ? '21:14' : '20:02' };
  });
  return (
    <div className="wt-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 className="wt-h1" style={{ fontSize: 32, textAlign: 'center' }}>Out-of-hours, on call</h1>
      <div className="wt-sub-italic" style={{ textAlign: 'center' }}>Safeguarding does not keep office hours</div>
      <div style={{ fontFamily: LT, fontSize: 13.5, color: C.dim, textAlign: 'center', maxWidth: 520, margin: '10px auto 26px', lineHeight: 1.6 }}>When a high-risk pattern crosses the threshold outside school hours, the on-call DSL is alerted on their phone. They can open the case and act from anywhere, and every step is logged.</div>
      <div className="wt-phone">
        <div className="wt-phone-notch" />
        <div style={{ padding: '28px 16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: LT, fontSize: 12, color: C.faint, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Moon size={13} /> Out of hours</span>
            <span style={{ fontFamily: LT, fontSize: 12, color: C.faint }}>21:14</span>
          </div>
          <div style={{ fontFamily: PF, fontSize: 20, color: C.cream, marginBottom: 2 }}>Watch alerts</div>
          <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim, marginBottom: 18 }}>On call tonight: {dsl}</div>
          {alerts.map((a, i) => (
            <button key={i} className="wt-alert" onClick={() => onOpen(a.id, a.sid)} style={{ borderColor: a.urgent ? 'rgba(208,90,62,0.5)' : 'rgba(232,146,10,0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Bell size={14} color={a.urgent ? C.red : C.amber} />
                <span style={{ fontFamily: LT, fontSize: 12.5, fontWeight: 700, color: a.urgent ? C.red : C.amber }}>{a.urgent ? 'Urgent safeguarding alert' : 'Safeguarding alert'}</span>
                <span style={{ marginLeft: 'auto', fontFamily: LT, fontSize: 11.5, color: C.faint }}>{a.time}</span>
              </div>
              <div style={{ fontFamily: LT, fontSize: 13.5, color: C.cream, fontWeight: 600 }}>Pupil {a.ref} · {a.school}</div>
              <div style={{ fontFamily: LT, fontSize: 12.5, color: C.dim, marginTop: 2 }}>{a.headline}</div>
              <div style={{ fontFamily: LT, fontSize: 12, color: a.urgent ? C.red : C.amber, fontWeight: 700, marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>Open case <ArrowRight size={13} /></div>
            </button>
          ))}
        </div>
      </div>
      <button className="wt-btn-ghost" onClick={onExit} style={{ marginTop: 26 }}>Exit on-call view</button>
    </div>
  );
}

/* ---- schedule review (side panel) ---- */
function ReviewPanel({ caseId, schoolName, pupilName, colleagues, onSchedule, onClose }) {
  const c = CASES[caseId];
  const sch = schoolName || c.school;
  const [slot, setSlot] = useState('');
  const [att, setAtt] = useState([]);
  const [note, setNote] = useState('');
  const slots = reviewSlots(c);
  const pupilLabel = pupilName ? pupilName : 'Pupil ' + c.ref;
  function toggle(name) { setAtt(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name]); }
  return (
    <>
      <div className="wt-backdrop" onClick={onClose} />
      <div className="wt-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: PF, fontSize: 22, color: C.cream, display: 'inline-flex', alignItems: 'center', gap: 9 }}><Calendar size={20} color={C.amber} /> Schedule pastoral review</span>
          <button onClick={onClose} className="wt-x"><X size={20} color={C.dim} /></button>
        </div>
        <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginBottom: 16 }}>{pupilLabel} · {c.year} · {sch}</div>
        <div style={{ fontFamily: LT, fontSize: 13.5, color: C.dim, lineHeight: 1.6, marginBottom: 18 }}>Watch suggests a review within {reviewWindow(c)} for this level of need. Choose a time and who should attend.</div>

        <div style={{ fontFamily: LT, fontSize: 12, color: C.faint, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Choose a time</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {slots.map(s => (
            <button key={s} className={'wt-tag' + (slot === s ? ' wt-tag-on' : '')} onClick={() => setSlot(s)}>{s}</button>
          ))}
        </div>

        <div style={{ fontFamily: LT, fontSize: 12, color: C.faint, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Who should attend</div>
        <div style={{ fontFamily: LT, fontSize: 12, color: C.dim, marginBottom: 7 }}>{sch} team</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {colleagues.school.map(p => (
            <button key={p.name} className={'wt-tag' + (att.includes(p.name) ? ' wt-tag-on' : '')} onClick={() => toggle(p.name)}>{p.name} · {p.role}</button>
          ))}
        </div>
        <div style={{ fontFamily: LT, fontSize: 12, color: C.dim, marginBottom: 7 }}>Across {TRUST.name}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {colleagues.trust.map(p => (
            <button key={p.name} className={'wt-tag' + (att.includes(p.name) ? ' wt-tag-on' : '')} onClick={() => toggle(p.name)}>{p.name} · {p.role}</button>
          ))}
        </div>

        <div style={{ fontFamily: LT, fontSize: 12, color: C.faint, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Agenda note (optional)</div>
        <textarea className="wt-note-input" placeholder="What should this review cover?" value={note} onChange={e => setNote(e.target.value)} spellCheck={false} />

        <button className="wt-btn-amber" style={{ width: '100%', justifyContent: 'center', marginTop: 18, opacity: slot ? 1 : 0.5, cursor: slot ? 'pointer' : 'default' }} onClick={() => { if (!slot) return; onSchedule(caseId, { when: slot, attendees: att, note: note.trim() }); onClose(); }}><Calendar size={16} /> Schedule review{att.length ? ` & invite ${att.length}` : ''}</button>
        <div style={{ fontFamily: LT, fontSize: 11.5, color: C.faint, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>The review is added to the case and written to the audit trail.</div>
      </div>
    </>
  );
}

/* ---- case file workflow (side panel) ---- */
function CaseFilePanel({ caseId, schoolName, pupilName, file, onOpen, onToggleStep, onClose }) {
  const c = CASES[caseId];
  const sch = schoolName || c.school;
  const serious = !!c.serious;
  const route = c.escalation.route;
  const cat = LEVEL_META[c.escalation.level].label;
  const owner = dslFor(sch);
  const reviewBy = reviewByFor(c);
  const isOpen = !!(file && file.open);
  const doneSet = (file && file.steps) || [];
  const pct = route.length ? Math.round((doneSet.length / route.length) * 100) : 0;
  const pupilLabel = pupilName ? pupilName : 'Pupil ' + c.ref;
  return (
    <>
      <div className="wt-backdrop" onClick={onClose} />
      <div className="wt-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: PF, fontSize: 22, color: C.cream, display: 'inline-flex', alignItems: 'center', gap: 9 }}><FolderOpen size={20} color={C.amber} /> Case file</span>
          <button onClick={onClose} className="wt-x"><X size={20} color={C.dim} /></button>
        </div>
        <div style={{ fontFamily: LT, fontSize: 13, color: C.dim, marginBottom: 18 }}>{pupilLabel} · {c.year} · {sch}</div>

        {!isOpen ? (
          <>
            <div className="wt-card" style={{ background: C.card2, marginBottom: 18 }}>
              <div style={{ fontFamily: LT, fontSize: 13.5, color: C.cream, fontWeight: 700, marginBottom: 4 }}>{c.headline}</div>
              <div style={{ fontFamily: PF, fontStyle: 'italic', fontSize: 13.5, color: C.dim }}>{c.sub}</div>
            </div>
            <div style={{ fontFamily: LT, fontSize: 13.5, color: C.dim, lineHeight: 1.6, marginBottom: 18 }}>Opening a case file creates a managed safeguarding record for this pupil. It assigns an owner, sets a review date, and gives you the recommended actions to work through. Everything is recorded in the audit trail.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 18 }}>
              {[['Category of need', cat, serious ? C.red : C.amber], ['Proposed owner', owner, C.cream], ['Review by', reviewBy, C.cream]].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ fontFamily: LT, fontSize: 12.5, color: C.faint }}>{r[0]}</span>
                  <span style={{ fontFamily: LT, fontSize: 13.5, color: r[2], fontWeight: 600, textAlign: 'right' }}>{r[1]}</span>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: LT, fontSize: 12, color: C.faint, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Recommended route</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
              {route.map((r, i) => (
                <span key={i} style={{ fontFamily: LT, fontSize: 12.5, padding: '6px 12px', borderRadius: 16, background: serious ? C.redSoft : C.amberSoft, border: `1px solid ${serious ? 'rgba(208,90,62,0.35)' : 'rgba(232,146,10,0.3)'}`, color: serious ? C.red : C.amberB, fontWeight: 600 }}>{r}</span>
              ))}
            </div>
            <button className="wt-btn-amber" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onOpen(caseId)}><FolderOpen size={16} /> Open case file</button>
          </>
        ) : (
          <>
            <div className="wt-card" style={{ background: 'rgba(95,158,114,0.06)', borderColor: 'rgba(95,158,114,0.4)', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CheckCircle2 size={18} color={C.green} />
                <span style={{ fontFamily: LT, fontSize: 13.5, color: C.green, fontWeight: 700 }}>Case file open</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px' }}>
                <MiniStat label="Owner" val={owner} tone={C.cream} />
                <MiniStat label="Opened" val={file.openedAt} tone={C.cream} />
                <MiniStat label="Category" val={cat} tone={serious ? C.red : C.amber} />
                <MiniStat label="Review by" val={reviewBy} tone={C.cream} />
              </div>
            </div>
            <div style={{ fontFamily: PF, fontSize: 18, color: C.cream, marginBottom: 12 }}>Actions to work through</div>
            <div style={{ height: 6, borderRadius: 4, background: 'rgba(244,237,224,0.1)', marginBottom: 6 }}>
              <div style={{ width: pct + '%', height: '100%', borderRadius: 4, background: pct === 100 ? C.green : C.amber, transition: 'width .3s ease' }} />
            </div>
            <div style={{ fontFamily: LT, fontSize: 12, color: C.faint, marginBottom: 16 }}>{doneSet.length} of {route.length} actions complete</div>
            {route.map((step, i) => {
              const done = doneSet.includes(i);
              return (
                <button key={i} onClick={() => onToggleStep(caseId, i, step)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: done ? 'rgba(95,158,114,0.08)' : C.card2, border: `1px solid ${done ? 'rgba(95,158,114,0.4)' : C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10, cursor: 'pointer' }}>
                  {done ? <CheckCircle2 size={20} color={C.green} /> : <span style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${C.faint}`, flexShrink: 0 }} />}
                  <span style={{ fontFamily: LT, fontSize: 13.5, color: done ? C.dim : C.cream, textDecoration: done ? 'line-through' : 'none' }}>{step}</span>
                </button>
              );
            })}
            {pct === 100 && (
              <div style={{ fontFamily: LT, fontSize: 13, color: C.green, background: 'rgba(95,158,114,0.08)', border: '1px solid rgba(95,158,114,0.35)', borderRadius: 10, padding: '12px 14px', marginTop: 4, lineHeight: 1.5 }}>All recommended actions are complete. Record the outcome and close the flag from the case using Mark reviewed, no concern.</div>
            )}
            <div style={{ fontFamily: LT, fontSize: 11.5, color: C.faint, textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>Every action you tick is written to the audit trail with a timestamp.</div>
          </>
        )}
      </div>
    </>
  );
}

/* ---- root ---- */
export default function WatchApp() {
  const [tenant, setTenant] = useState(null);
  const [view, setView] = useState('overview');
  const [schoolId, setSchoolId] = useState('bennett');
  const [caseId, setCaseId] = useState(null);
  const [caseFrom, setCaseFrom] = useState('pattern');
  const [cohortKey, setCohortKey] = useState(null);
  const [triageKey, setTriageKey] = useState('active');
  const [triageScope, setTriageScope] = useState('trust');
  const [wf, setWf] = useState(null);
  const [auditMap, setAuditMap] = useState({});
  const [revealed, setRevealed] = useState(() => new Set());
  const [dismissed, setDismissed] = useState(() => new Set());
  const [report, setReport] = useState(null);
  const [notesMap, setNotesMap] = useState({});
  const [caseFiles, setCaseFiles] = useState({});
  const [caseFilePanel, setCaseFilePanel] = useState(null);
  const [reviewsMap, setReviewsMap] = useState({});
  const [reviewPanel, setReviewPanel] = useState(null);
  const [toast, setToast] = useState(null);
  const [kcsieScope, setKcsieScope] = useState('trust');
  const [doc, setDoc] = useState(null);
  const [genDocs, setGenDocs] = useState([]);
  const [caseDocsMap, setCaseDocsMap] = useState({});
  const [referralMap, setReferralMap] = useState({});
  const [kcsieTrainingMap, setKcsieTrainingMap] = useState({});
  const [docRead, setDocRead] = useState(null);
  const [kcsieComp, setKcsieComp] = useState(null);
  const [kcsieWorkMap, setKcsieWorkMap] = useState({});

  function reset() { setTenant(null); setView('overview'); setCaseId(null); setCohortKey(null); setWf(null); setReport(null); setNotesMap({}); setCaseFiles({}); setCaseFilePanel(null); setReviewsMap({}); setReviewPanel(null); setKcsieScope('trust'); setDoc(null); setGenDocs([]); setCaseDocsMap({}); setReferralMap({}); setKcsieTrainingMap({}); setDocRead(null); setKcsieComp(null); setKcsieWorkMap({}); }
  function kcsieWork(sid, label) { return kcsieWorkMap[sid + '::' + label] || seedKcsieWork(label, dslFor(getSchool(sid).name)); }
  function addKcsieTask(sid, label, text) {
    const key = sid + '::' + label;
    setKcsieWorkMap(p => { const cur = p[key] || seedKcsieWork(label, dslFor(getSchool(sid).name)); return { ...p, [key]: { ...cur, tasks: [...cur.tasks, { id: 't' + Date.now(), text, done: false, due: 'Added today' }], audit: [...cur.audit, `Task added: ${text} \u2014 ${initialsOf(user)}`] } }; });
  }
  function toggleKcsieTask(sid, label, taskId) {
    const key = sid + '::' + label;
    setKcsieWorkMap(p => { const cur = p[key] || seedKcsieWork(label, dslFor(getSchool(sid).name)); const tasks = cur.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t); const tk = tasks.find(t => t.id === taskId); return { ...p, [key]: { ...cur, tasks, audit: [...cur.audit, `${tk.done ? 'Task completed' : 'Task reopened'}: ${tk.text} \u2014 ${initialsOf(user)}`] } }; });
  }
  function attachKcsieDoc(sid, label, docId) {
    const key = sid + '::' + label;
    setKcsieWorkMap(p => { const cur = p[key] || seedKcsieWork(label, dslFor(getSchool(sid).name)); if (cur.docIds.includes(docId)) return p; const d = DOC_CORPUS.find(x => x.id === docId); return { ...p, [key]: { ...cur, docIds: [...cur.docIds, docId], audit: [...cur.audit, `Evidence attached: ${d ? d.title : 'document'} \u2014 ${initialsOf(user)}`] } }; });
  }
  const canRefer = (c) => !!c && (c.serious || c.escalation.level >= 4);
  function openDocFor(d) {
    setDoc(d.text
      ? { title: d.title, subtitle: `${d.type} \u00b7 ${d.date}`, text: d.text, filename: d.title.replace(/[^a-z0-9]+/gi, '_') + '.txt' }
      : { title: d.title, subtitle: `${d.type} \u00b7 ${d.date} \u00b7 ${DOC_STATUS[d.status].label}`, text: `${d.title}\n${d.type}, ${d.date}\n\n${d.summary || ''}\n\nThis document is stored in the Watch repository. In production the full file opens here.`, filename: d.title.replace(/[^a-z0-9]+/gi, '_') + '.txt' });
  }
  function applyDocRead(result) {
    if (!docRead) return;
    if (docRead.mode === 'mash') {
      const id = docRead.caseId;
      setReferralMap(p => { const cur = p[id] || DEFAULT_REFERRAL; return { ...p, [id]: { ...cur, stage: 'decided', decision: result.decision, line: `MASH decision: ${result.decision}. ${result.nextStep}`, events: [...cur.events, { date: '1 May 2026', text: `MASH decision recorded: ${result.decision}` }] } }; });
      const resDoc = { id: 'mashresp-' + id, scope: 'case', caseId: id, sid: getSchool(schoolId).id || schoolId, ref: 'Pupil ' + CASES[id].ref.replace('#', ''), school: getSchool(schoolId).name, title: 'MASH Response', type: 'Record', date: '1 May 2026', status: 'Filed', themes: ['child protection', 'mash', 'referral'], summary: `MASH decision: ${result.decision}. ${result.rationale}`, text: `MASH RESPONSE\nDecision: ${result.decision}\n\nRationale: ${result.rationale}\n\nNext step: ${result.nextStep}\n\nRead by Watch and confirmed by the DSL on 1 May 2026.` };
      setCaseDocsMap(p => { const list = (p[id] || []).filter(d => d.id !== resDoc.id); return { ...p, [id]: [...list, resDoc] }; });
      addAudit(id, `MASH response read by Watch and confirmed: ${result.decision} \u2014 ${initialsOf(user)}`);
      showToast('Referral updated from MASH response');
    } else if (docRead.mode === 'training') {
      const sid = docRead.schoolId;
      setKcsieTrainingMap(p => ({ ...p, [sid]: `Renews ${result.expires}` }));
      showToast('Training record updated from certificate');
    }
    setDocRead(null);
  }
  function chaseReferral(id) {
    setReferralMap(p => { const cur = p[id] || DEFAULT_REFERRAL; return { ...p, [id]: { ...cur, stage: 'chased', line: 'Chased 30 Apr 2026, awaiting MASH decision', events: [...cur.events, { date: '30 Apr 2026', text: 'Progress chased with MASH' }] } }; });
    addAudit(id, `MASH referral chased \u2014 ${initialsOf(user)}`);
    showToast('Chase logged to the referral');
  }
  function reReferral(id) {
    setReferralMap(p => { const cur = p[id] || DEFAULT_REFERRAL; return { ...p, [id]: { ...cur, stage: 're-referred', decision: null, line: 'Re-referred 2 May 2026 with further information', events: [...cur.events, { date: '2 May 2026', text: 'Re-referred to MASH with further information' }] } }; });
    addAudit(id, `Case re-referred to MASH \u2014 ${initialsOf(user)}`);
    showToast('Re-referral logged');
  }
  function fileComm(id, payload) {
    const meta = COMM_DOC[payload.commType] || { title: payload.label, type: 'Record', themes: ['document'] };
    const c = CASES[id];
    const docObj = { id: 'comm-' + id + '-' + payload.commType, scope: 'case', caseId: id, sid: getSchool(schoolId).id || schoolId, ref: 'Pupil ' + c.ref.replace('#', ''), school: getSchool(schoolId).name, title: meta.title, type: meta.type, date: '28 Apr 2026', status: 'Filed', themes: meta.themes, summary: (payload.text || '').slice(0, 160).replace(/\n/g, ' '), text: payload.text };
    setCaseDocsMap(p => { const list = (p[id] || []).filter(d => d.id !== docObj.id); return { ...p, [id]: [...list, docObj] }; });
    addAudit(id, `${payload.label} drafted and filed to case \u2014 ${initialsOf(user)}`);
  }
  function emitDoc(d) {
    setDoc(d);
    setGenDocs(p => {
      if (p.some(x => x.title === d.title)) return p;
      const lower = (d.title + ' ' + (d.subtitle || '')).toLowerCase();
      const isReturn = lower.includes('175') || lower.includes('self-assessment');
      const themes = isReturn ? ['compliance', 'return', 'local authority'] : (lower.includes('pack') || lower.includes('kcsie') ? ['compliance', 'governance', 'assurance'] : ['governance', 'report', 'compliance']);
      return [...p, { id: 'gen-' + d.title.replace(/[^a-z0-9]+/gi, '-'), scope: 'org', generated: true, title: d.title, type: isReturn ? 'Return' : 'Report', date: '28 Apr 2026', status: 'Filed', themes, summary: d.subtitle || d.title, text: d.text }];
    });
  }
  function now() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  function addAudit(id, text) { setAuditMap(p => ({ ...p, [id]: [...(p[id] || []), { t: now(), text }] })); }
  function showToast(t) { setToast(t); setTimeout(() => setToast(null), 2600); }
  function goCase(id, sid, from) { if (sid) setSchoolId(sid); setCaseId(id); setCaseFrom(from); setView('case'); }
  function revealId(id, reason) {
    setRevealed(p => { const n = new Set(p); n.add(id); return n; });
    addAudit(id, `Pupil identity revealed \u2014 reason: ${reason} \u2014 ${dslInitials(getSchool(schoolId).name)}`);
    showToast('Pupil identity revealed and logged');
  }
  function dismissId(id, reason) {
    setDismissed(p => { const n = new Set(p); n.add(id); return n; });
    addAudit(id, `Flag reviewed and closed, no further concern \u2014 reason: ${reason} \u2014 ${dslInitials(getSchool(schoolId).name)}`);
    showToast('Flag reviewed and closed');
  }
  function addNote(id, body, tags) {
    setNotesMap(p => ({ ...p, [id]: [...(p[id] || []), { t: now(), body, tags, author: user }] }));
    const tagPart = (tags && tags.length) ? ` and tagged ${tags.join(', ')}` : '';
    addAudit(id, `Case note added${tagPart} \u2014 ${initialsOf(user)}`);
    showToast((tags && tags.length) ? `Note added, ${tags.length} colleague${tags.length > 1 ? 's' : ''} notified` : 'Note added to case file');
  }
  function openCaseFile(id) {
    const ownerName = dslFor(getSchool(schoolId).name);
    setCaseFiles(p => (p[id] && p[id].open) ? p : ({ ...p, [id]: { open: true, owner: ownerName, openedAt: now(), steps: (p[id] && p[id].steps) || [] } }));
    if (!(caseFiles[id] && caseFiles[id].open)) {
      addAudit(id, `Case file opened, owner ${ownerName}, review by ${reviewByFor(CASES[id])} \u2014 ${initialsOf(user)}`);
      showToast('Case file opened');
    }
  }
  function toggleCaseStep(id, idx, label) {
    const had = !!(caseFiles[id] && caseFiles[id].steps && caseFiles[id].steps.includes(idx));
    setCaseFiles(p => {
      const f = p[id] || { open: true, owner: dslFor(getSchool(schoolId).name), openedAt: now(), steps: [] };
      const steps = f.steps.includes(idx) ? f.steps.filter(x => x !== idx) : [...f.steps, idx];
      return { ...p, [id]: { ...f, steps } };
    });
    if (!had) addAudit(id, `Case action completed: ${label} \u2014 ${initialsOf(user)}`);
  }
  function scheduleReview(id, r) {
    setReviewsMap(p => ({ ...p, [id]: [...(p[id] || []), { when: r.when, attendees: r.attendees, note: r.note, by: user, at: now() }] }));
    const withPart = (r.attendees && r.attendees.length) ? ` with ${r.attendees.join(', ')}` : '';
    addAudit(id, `Pastoral review scheduled for ${r.when}${withPart} \u2014 ${initialsOf(user)}`);
    showToast('Pastoral review scheduled');
  }

  const schoolName = getSchool(schoolId).name;
  const orgDocs = DOC_CORPUS.filter(d => d.scope === 'org');
  const caseDocsVisible = DOC_CORPUS.filter(d => d.scope === 'case' && (tenant === 'mat' || d.sid === schoolId));
  const filedCaseDocs = Object.values(caseDocsMap).flat().filter(d => tenant === 'mat' || d.sid === schoolId);
  const vaultDocs = [...orgDocs, ...genDocs];
  const searchCorpus = [...orgDocs, ...genDocs, ...caseDocsVisible, ...filedCaseDocs];
  const currentCaseDocs = caseId ? [...DOC_CORPUS.filter(d => d.scope === 'case' && d.caseId === caseId), ...(caseDocsMap[caseId] || [])] : [];
  const user = tenant === 'mat' ? DIRECTOR : getSchool(schoolId).dsl;
  const role = tenant === 'mat' ? 'Director of Safeguarding' : 'DSL, ' + getSchool(schoolId).name;

  const Crumb = ({ items }) => (
    <div className="wt-crumb">
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {it.go ? <button className="wt-crumb-link" onClick={it.go}>{it.label}</button> : <span style={{ color: C.cream }}>{it.label}</span>}
          {i < items.length - 1 && <ChevronRight size={14} color={C.faint} style={{ margin: '0 4px' }} />}
        </span>
      ))}
    </div>
  );

  function caseCrumb() {
    if (caseFrom === 'oncall') {
      return <Crumb items={[{ label: 'On-call alerts', go: () => setView('oncall') }, { label: 'Pupil ' + CASES[caseId].ref }]} />;
    }
    const items = [];
    if (tenant === 'mat') {
      items.push({ label: 'Trust overview', go: () => setView('overview') });
      if (caseFrom === 'trust-triage') {
        items.push({ label: TRIAGE_META[triageKey].title, go: () => { setTriageScope('trust'); setView('triage'); } });
      } else {
        items.push({ label: schoolName, go: () => setView('school') });
        if (caseFrom === 'school-triage') items.push({ label: SCHOOL_TRIAGE_META[triageKey].title, go: () => { setTriageScope('school'); setView('triage'); } });
      }
    } else {
      items.push({ label: 'Safeguarding overview', go: () => setView('overview') });
      if (caseFrom === 'school-triage') items.push({ label: SCHOOL_TRIAGE_META[triageKey].title, go: () => { setTriageScope('school'); setView('triage'); } });
      else items.push({ label: 'Pattern intelligence', go: () => setView('overview') });
    }
    items.push({ label: 'Pupil ' + CASES[caseId].ref });
    return <Crumb items={items} />;
  }

  if (!tenant) {
    return (<div className="wt-app"><GlobalStyle /><RoleSelector onPick={(t) => { setTenant(t); setView('overview'); if (t === 'school') setSchoolId('bennett'); }} /></div>);
  }

  let body = null;

  if (view === 'case') {
    body = <CaseView caseId={caseId} schoolName={schoolName} revealed={revealed.has(caseId)} pupilName={PUPIL_NAMES[caseId]} onReveal={(reason) => revealId(caseId, reason)} dismissed={dismissed.has(caseId)} onDismiss={(reason) => dismissId(caseId, reason)} notes={notesMap[caseId] || []} onAddNote={(body, tags) => addNote(caseId, body, tags)} colleagues={directory(schoolId, user)} onOpenCaseFile={(id) => setCaseFilePanel(id)} caseFileOpen={!!(caseFiles[caseId] && caseFiles[caseId].open)} onScheduleReview={(id) => setReviewPanel(id)} reviews={reviewsMap[caseId] || []} audit={auditMap[caseId] || []} onAudit={(t) => addAudit(caseId, t)} onWorkflow={(cid, type) => setWf({ caseId: cid, type })} toast={toast} onToast={showToast} onLinked={(id) => goCase(id, schoolId, caseFrom)} caseDocs={currentCaseDocs} onOpenDoc={openDocFor} referral={canRefer(CASES[caseId]) ? (referralMap[caseId] || DEFAULT_REFERRAL) : null} onRecordResponse={canRefer(CASES[caseId]) ? () => setDocRead({ mode: 'mash', caseId }) : null} onChase={canRefer(CASES[caseId]) ? () => chaseReferral(caseId) : null} onReRefer={canRefer(CASES[caseId]) ? () => reReferral(caseId) : null} breadcrumb={caseCrumb()} />;
  } else if (view === 'triage') {
    const isTrust = triageScope === 'trust';
    const meta = isTrust ? TRIAGE_META[triageKey] : SCHOOL_TRIAGE_META[triageKey];
    let rows = isTrust ? trustRows(triageKey) : schoolRows(schoolId, triageKey);
    if (triageKey === 'action' || triageKey === 'mash') rows = rows.filter(r => !dismissed.has(r.id));
    let note = meta.note;
    if (!isTrust && rows.length === 0) { rows = schoolRows(schoolId, 'all'); note = 'No cases currently meet this filter. Showing all active flags for this school.'; }
    const crumbItems = isTrust
      ? [{ label: 'Trust overview', go: () => setView('overview') }, { label: meta.title }]
      : (tenant === 'mat'
        ? [{ label: 'Trust overview', go: () => setView('overview') }, { label: schoolName, go: () => setView('school') }, { label: meta.title }]
        : [{ label: 'Safeguarding overview', go: () => setView('overview') }, { label: meta.title }]);
    body = <TriageList title={meta.title} subtitle={meta.subtitle} note={note} rows={rows} dismissed={dismissed} breadcrumb={<Crumb items={crumbItems} />} onOpen={(id, sid) => goCase(id, sid, isTrust ? 'trust-triage' : 'school-triage')} />;
  } else if (view === 'governance') {
    body = <Governance breadcrumb={<Crumb items={[{ label: tenant === 'mat' ? 'Trust overview' : 'Safeguarding overview', go: () => setView('overview') }, { label: 'Data governance' }]} />} />;
  } else if (view === 'oncall') {
    body = <OnCall onOpen={(id, sid) => goCase(id, sid, 'oncall')} onExit={() => setView('overview')} />;
  } else if (view === 'kcsie') {
    const isTrustScope = kcsieScope === 'trust';
    const crumb = isTrustScope
      ? <Crumb items={[{ label: 'Trust overview', go: () => setView('overview') }, { label: 'KCSIE compliance' }]} />
      : (tenant === 'mat'
        ? <Crumb items={[{ label: 'Trust overview', go: () => setView('overview') }, { label: 'KCSIE compliance', go: () => { setKcsieScope('trust'); setView('kcsie'); } }, { label: getSchool(kcsieScope).name }]} />
        : <Crumb items={[{ label: 'Safeguarding overview', go: () => setView('overview') }, { label: 'KCSIE annual review' }]} />);
    body = <KcsieView scope={kcsieScope} breadcrumb={crumb} onSchool={(id) => { setKcsieScope(id); setView('kcsie'); }} onDoc={emitDoc} trainingDue={kcsieScope !== 'trust' ? kcsieTrainingMap[kcsieScope] : null} onRead={kcsieScope !== 'trust' ? () => setDocRead({ mode: 'training', schoolId: kcsieScope }) : null} onOpenComponent={kcsieScope !== 'trust' ? (comp) => setKcsieComp({ sid: kcsieScope, label: comp.label, comp }) : null} />;
  } else if (view === 'docs') {
    const crumb = <Crumb items={[{ label: tenant === 'mat' ? 'Trust overview' : 'Safeguarding overview', go: () => setView('overview') }, { label: 'Documents' }]} />;
    body = <DocsView breadcrumb={crumb} searchCorpus={searchCorpus} vaultDocs={vaultDocs} onCase={(id, sid) => goCase(id, sid, 'pattern')} onOpenDoc={(d) => setDoc(d)} />;
  } else if (view === 'inspection') {
    const iScope = tenant === 'mat' ? 'trust' : schoolId;
    const crumb = <Crumb items={[{ label: tenant === 'mat' ? 'Trust overview' : 'Safeguarding overview', go: () => setView('overview') }, { label: 'Inspection readiness' }]} />;
    body = <InspectionView scope={iScope} breadcrumb={crumb} onCase={(id, sid) => goCase(id, sid, 'pattern')} onKcsie={() => { setKcsieScope(iScope); setView('kcsie'); }} onEvidence={() => setDoc(buildEvidencePack(vaultDocs))} />;
  } else if (tenant === 'school') {
    body = <SchoolOverview school={getSchool('bennett')} breadcrumb={null} dismissed={dismissed} onReport={() => setReport('bennett')}
      onCase={(id) => goCase(id, 'bennett', 'pattern')}
      onKcsie={(id) => { setKcsieScope(id); setView('kcsie'); }}
      onKpi={(k) => { setTriageKey(k); setTriageScope('school'); setView('triage'); }} />;
  } else if (tenant === 'mat') {
    if (view === 'overview') {
      body = <TrustOverview
        onSchool={(id) => { setSchoolId(id); setView('school'); }}
        onCohort={(k) => { if (k === 'kcsie') { setKcsieScope('trust'); setView('kcsie'); } else { setCohortKey(k); setView('cohort'); } }}
        onReport={() => setReport('trust')}
        onKpi={(k) => { setTriageKey(k); setTriageScope('trust'); setView('triage'); }} />;
    } else if (view === 'cohort') {
      body = <CohortView cohortKey={cohortKey} breadcrumb={<Crumb items={[{ label: 'Trust overview', go: () => setView('overview') }, { label: 'Cross-school pattern' }]} />} />;
    } else if (view === 'school') {
      body = <SchoolOverview school={getSchool(schoolId)} dismissed={dismissed} onReport={() => setReport(schoolId)}
        onCase={(id) => goCase(id, schoolId, 'pattern')}
        onKcsie={(id) => { setKcsieScope(id); setView('kcsie'); }}
        onKpi={(k) => { setTriageKey(k); setTriageScope('school'); setView('triage'); }}
        breadcrumb={<Crumb items={[{ label: 'Trust overview', go: () => setView('overview') }, { label: schoolName }]} />} />;
    }
  }

  return (
    <div className="wt-app">
      <GlobalStyle />
      <Header user={user} role={role} onHome={() => setView('overview')} onSwitch={reset} onGovernance={() => setView('governance')} onOnCall={() => setView('oncall')} onDocs={() => setView('docs')} onInspection={() => setView('inspection')} />
      <div className="wt-wrap">{body}</div>
      <Footer />
      {wf && <Workflow caseId={wf.caseId} schoolName={schoolName} revealedName={revealed.has(wf.caseId) ? PUPIL_NAMES[wf.caseId] : null} initialType={wf.type} onClose={() => setWf(null)} onLogged={(payload) => fileComm(wf.caseId, payload)} />}
      {caseFilePanel && <CaseFilePanel caseId={caseFilePanel} schoolName={schoolName} pupilName={revealed.has(caseFilePanel) ? PUPIL_NAMES[caseFilePanel] : null} file={caseFiles[caseFilePanel]} onOpen={openCaseFile} onToggleStep={toggleCaseStep} onClose={() => setCaseFilePanel(null)} />}
      {reviewPanel && <ReviewPanel caseId={reviewPanel} schoolName={schoolName} pupilName={revealed.has(reviewPanel) ? PUPIL_NAMES[reviewPanel] : null} colleagues={directory(schoolId, user)} onSchedule={scheduleReview} onClose={() => setReviewPanel(null)} />}
      {report && <ReportPanel scope={report} onClose={() => setReport(null)} />}
      {docRead && <DocReadPanel mode={docRead.mode} onApply={applyDocRead} onClose={() => setDocRead(null)} />}
      {kcsieComp && <KcsieWorkspacePanel comp={kcsieComp.comp} schoolName={getSchool(kcsieComp.sid).name} work={kcsieWork(kcsieComp.sid, kcsieComp.label)} onAddTask={(t) => addKcsieTask(kcsieComp.sid, kcsieComp.label, t)} onToggleTask={(id) => toggleKcsieTask(kcsieComp.sid, kcsieComp.label, id)} onAttachDoc={(id) => attachKcsieDoc(kcsieComp.sid, kcsieComp.label, id)} onOpenDoc={openDocFor} onClose={() => setKcsieComp(null)} />}
      {doc && <DocPanel doc={doc} onClose={() => setDoc(null)} />}
      {toast && view !== 'case' && <div className="wt-toast"><Check size={16} color={C.green} /> {toast}</div>}
    </div>
  );
}

/* ---- global styles ---- */
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,400&display=swap');

      * { box-sizing: border-box; }

      .wt-app {
        min-height: 100vh;
        background:
          radial-gradient(1200px 600px at 72% -8%, rgba(232,146,10,0.07), transparent 60%),
          radial-gradient(900px 520px at 8% 108%, rgba(95,158,114,0.06), transparent 60%),
          ${C.bg};
        color: ${C.cream};
        font-family: ${LT};
        position: relative;
      }
      .wt-wrap { max-width: 1280px; margin: 0 auto; padding: 26px 28px 8px; }

      .wt-header {
        max-width: 1280px; margin: 0 auto; padding: 20px 28px;
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 1px solid ${C.border};
      }
      .wt-brand { display: flex; align-items: baseline; gap: 9px; }
      .wt-watch { font-family: ${PF}; font-weight: 600; font-size: 28px; color: ${C.cream}; letter-spacing: .5px; }
      .wt-by { font-family: ${PF}; font-style: italic; font-weight: 400; font-size: 15px; color: ${C.dim}; }

      .wt-switch { background: transparent; border: 1px solid ${C.border}; color: ${C.dim}; font-family: ${LT}; font-size: 12.5px; padding: 7px 14px; border-radius: 8px; cursor: pointer; transition: all .18s ease; }
      .wt-switch:hover { border-color: ${C.borderS}; color: ${C.cream}; }

      .wt-footer { max-width: 1280px; margin: 24px auto 0; padding: 18px 28px 32px; display: flex; align-items: center; gap: 10px; border-top: 1px solid ${C.border}; font-family: ${LT}; font-size: 12.5px; color: ${C.faint}; }

      .wt-h1 { font-family: ${PF}; font-weight: 600; font-size: 34px; color: ${C.cream}; margin: 4px 0 8px; line-height: 1.12; }
      .wt-sub-italic { font-family: ${PF}; font-style: italic; font-size: 16px; color: ${C.amber}; margin-bottom: 6px; }

      .wt-card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; padding: 24px; }
      .wt-hover { transition: transform .2s ease, border-color .2s ease, background .2s ease; }
      .wt-hover:hover { transform: translateY(-2px); border-color: ${C.borderS}; background: ${C.card2}; }

      .wt-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
      .wt-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
      .wt-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .wt-case-grid { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
      @media (max-width: 1100px) { .wt-grid-4 { grid-template-columns: repeat(2,1fr); } }
      @media (max-width: 1000px) { .wt-case-grid { grid-template-columns: 1fr; } .wt-grid-3 { grid-template-columns: 1fr; } .wt-grid-2 { grid-template-columns: 1fr; } }
      @media (max-width: 640px) { .wt-grid-4 { grid-template-columns: 1fr; } .wt-h1 { font-size: 32px; } .wt-wrap { padding: 20px 16px 8px; } .wt-header { padding: 16px; } }

      .wt-btn-ghost { background: transparent; border: 1px solid rgba(232,146,10,.45); color: ${C.amber}; font-family: ${LT}; font-weight: 600; font-size: 13px; padding: 8px 18px; border-radius: 8px; cursor: pointer; transition: all .16s ease; }
      .wt-btn-ghost:hover { background: ${C.amberSoft}; }

      .wt-btn-amber, .wt-btn-amber-o, .wt-btn-red, .wt-btn-ghost-sm { display: inline-flex; align-items: center; gap: 8px; font-family: ${LT}; font-weight: 700; font-size: 13.5px; padding: 11px 18px; border-radius: 9px; cursor: pointer; transition: all .16s ease; border: 1px solid transparent; }
      .wt-btn-amber { background: ${C.amber}; color: #1a1207; }
      .wt-btn-amber:hover { background: ${C.amberB}; transform: translateY(-1px); }
      .wt-btn-amber-o { background: transparent; border-color: rgba(232,146,10,.45); color: ${C.amber}; }
      .wt-btn-amber-o:hover { background: ${C.amberSoft}; }
      .wt-btn-red { background: ${C.red}; color: #fbeee9; }
      .wt-btn-red:hover { background: #dd6549; transform: translateY(-1px); }
      .wt-btn-ghost-sm { background: transparent; border-color: ${C.borderS}; color: ${C.dim}; font-weight: 600; font-size: 12.5px; padding: 8px 14px; }
      .wt-btn-ghost-sm:hover { color: ${C.cream}; border-color: ${C.cream}; }

      .wt-link { background: none; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: ${LT}; font-weight: 700; font-size: 13px; color: ${C.amber}; padding: 0; transition: gap .16s ease; }
      .wt-link:hover { gap: 10px; }

      .wt-crumb { font-family: ${LT}; font-size: 13px; color: ${C.dim}; margin-bottom: 18px; display: flex; flex-wrap: wrap; align-items: center; }
      .wt-crumb-link { background: none; border: none; cursor: pointer; font-family: ${LT}; font-size: 13px; color: ${C.amber}; padding: 0; }
      .wt-crumb-link:hover { text-decoration: underline; }

      .wt-watch-sees { background: ${C.card}; border: 1px solid rgba(232,146,10,.35); border-radius: 14px; padding: 26px; box-shadow: 0 0 30px rgba(232,146,10,.04); }

      .wt-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: ${C.card2}; border: 1px solid ${C.borderS}; border-radius: 10px; padding: 13px 20px; display: flex; align-items: center; gap: 10px; font-family: ${LT}; font-size: 13.5px; color: ${C.cream}; z-index: 200; box-shadow: 0 10px 40px rgba(0,0,0,.4); animation: wt-rise .3s ease; }

      .wt-backdrop { position: fixed; inset: 0; background: rgba(5,12,8,.6); backdrop-filter: blur(2px); z-index: 150; animation: wt-bg .25s ease; }
      .wt-panel { position: fixed; top: 0; right: 0; height: 100vh; width: 540px; max-width: 92vw; background: ${C.bg}; border-left: 1px solid ${C.borderS}; box-shadow: -20px 0 60px rgba(0,0,0,.5); z-index: 160; padding: 26px 28px; overflow-y: auto; animation: wt-slide .32s cubic-bezier(.2,.8,.2,1); }
      .wt-x { background: transparent; border: none; cursor: pointer; padding: 4px; border-radius: 6px; }
      .wt-x:hover { background: rgba(244,237,224,.06); }

      .wt-doc { width: 100%; min-height: 360px; background: ${C.card}; border: 1px solid ${C.border}; border-radius: 12px; padding: 20px; color: ${C.cream}; font-family: ${LT}; font-size: 13.5px; line-height: 1.7; resize: vertical; white-space: pre-wrap; }
      .wt-doc:focus { outline: none; border-color: rgba(232,146,10,.4); }

      .wt-select-row { display: flex; align-items: center; justify-content: space-between; width: 100%; background: ${C.card}; border: 1px solid ${C.border}; border-radius: 12px; padding: 16px 18px; cursor: pointer; transition: all .16s ease; }
      .wt-select-row:hover { border-color: ${C.borderS}; background: ${C.card2}; }

      .wt-select-screen { max-width: 920px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 24px; }
      .wt-select-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width: 100%; }
      @media (max-width: 760px) { .wt-select-cards { grid-template-columns: 1fr; } }

      .wt-kpi-click .wt-kpi-hint { position: absolute; bottom: 18px; right: 20px; display: inline-flex; align-items: center; gap: 5px; font-family: ${LT}; font-size: 11.5px; font-weight: 700; color: ${C.amber}; opacity: 0; transition: opacity .18s ease; }
      .wt-kpi-click:hover .wt-kpi-hint { opacity: 1; }

      .wt-triage-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; background: transparent; border: none; padding: 16px 22px; cursor: pointer; text-align: left; transition: background .14s ease; }
      .wt-triage-row:hover { background: ${C.card2}; }
      .wt-triage-lvl { font-family: ${LT}; font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 14px; border: 1px solid; white-space: nowrap; }
      .wt-chip { background: ${C.card2}; border: 1px solid ${C.border}; color: ${C.cream}; font-family: ${LT}; font-size: 12.5px; padding: 8px 13px; border-radius: 16px; cursor: pointer; transition: all .14s ease; }
      .wt-chip:hover { border-color: rgba(232,146,10,.5); color: ${C.amber}; }
      .wt-themechip { background: ${C.amberSoft}; border: 1px solid rgba(232,146,10,.3); color: ${C.amber}; font-family: ${LT}; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 12px; }
      .wt-clickrow { transition: background .14s ease; }
      .wt-clickrow:hover { background: ${C.card2}; }
      @media (max-width: 720px) { .wt-triage-conf { display: none !important; } }

      .wt-report { white-space: pre-wrap; font-family: ${LT}; font-size: 12.5px; line-height: 1.65; color: ${C.cream}; background: ${C.card}; border: 1px solid ${C.border}; border-radius: 12px; padding: 18px; max-height: calc(100vh - 230px); overflow-y: auto; margin: 0; }

      .wt-phone { width: 360px; max-width: 92vw; background: #0a160e; border: 1px solid ${C.borderS}; border-radius: 30px; box-shadow: 0 30px 80px rgba(0,0,0,.5); position: relative; overflow: hidden; }
      .wt-phone-notch { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 120px; height: 6px; border-radius: 4px; background: rgba(244,237,224,.2); }
      .wt-alert { display: block; width: 100%; text-align: left; background: ${C.card2}; border: 1px solid; border-radius: 14px; padding: 14px; margin-bottom: 12px; cursor: pointer; transition: transform .14s ease; }
      .wt-alert:hover { transform: translateY(-2px); }

      .wt-note-input { width: 100%; min-height: 84px; background: ${C.card2}; border: 1px solid ${C.border}; border-radius: 10px; padding: 12px 14px; color: ${C.cream}; font-family: ${LT}; font-size: 13.5px; line-height: 1.55; resize: vertical; }
      .wt-note-input:focus { outline: none; border-color: rgba(232,146,10,.4); }
      .wt-tag { font-family: ${LT}; font-size: 12px; padding: 5px 11px; border-radius: 14px; cursor: pointer; border: 1px solid ${C.border}; background: transparent; color: ${C.dim}; transition: all .14s ease; }
      .wt-tag:hover { border-color: ${C.borderS}; color: ${C.cream}; }
      .wt-tag-on { background: ${C.amberSoft}; border-color: rgba(232,146,10,.45); color: ${C.amberB}; font-weight: 700; }

      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(244,237,224,.12); border-radius: 6px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(244,237,224,.2); }

      @keyframes wt-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .wt-fade { animation: wt-fade .4s ease; }
      @keyframes wt-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      .wt-rise { animation: wt-rise .5s ease backwards; }
      @keyframes wt-bg { from { opacity: 0; } to { opacity: 1; } }
      @keyframes wt-slide { from { transform: translateX(40px); opacity: .6; } to { transform: translateX(0); opacity: 1; } }
      @keyframes wt-spin { to { transform: rotate(360deg); } }
      .wt-spin { animation: wt-spin 1s linear infinite; }
      @keyframes wt-pulse { 0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(95,158,114,.5); } 50% { opacity: .6; box-shadow: 0 0 0 5px rgba(95,158,114,0); } }
      .wt-pulse { animation: wt-pulse 2.4s ease infinite; }
      @keyframes wt-statusfade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .wt-status-fade { animation: wt-statusfade .4s ease; }
    `}</style>
  );
}
