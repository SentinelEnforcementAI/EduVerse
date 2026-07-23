import { systemDb } from "../src";

// Org-level document vault seed (spec 5.9). Real content, not just titles, so
// contextual search matches on what a document says and the themes it covers,
// which is the whole point: filename matching is worthless here. All synthetic.
//
// Seeded per school with a deterministic id so re-running is idempotent.

type SeedDoc = {
  key: string;
  title: string;
  type: string;
  status: string;
  date: string;
  themes: string[];
  summary: string;
  content: string;
};

const DOCS: SeedDoc[] = [
  {
    key: "cp-policy",
    title: "Child Protection and Safeguarding Policy",
    type: "Policy",
    status: "Current",
    date: "2025-09-06",
    themes: ["policy", "child protection", "online safety", "reporting", "dsl"],
    summary:
      "Annual child protection policy aligned to KCSIE 2024. Sets out reporting routes, the role of the DSL, safer recruitment, online safety and managing allegations.",
    content: `CHILD PROTECTION AND SAFEGUARDING POLICY

This policy is reviewed annually and is aligned to Keeping Children Safe in Education 2024. It sets out how the school keeps children safe, the role of the Designated Safeguarding Lead, and the routes by which any member of staff reports a concern.

Any adult who is worried about a child records the concern on the school safeguarding system on the same day and informs the DSL. The DSL decides on the proportionate response, from monitoring through Early Help to a statutory referral to children's social care. Where a child is at risk of significant harm, a referral is made without delay.

The policy covers online safety, peer on peer abuse, and the specific safeguarding needs of vulnerable groups. It is read alongside the behaviour policy, the online safety policy and the information sharing procedure.`,
  },
  {
    key: "online-policy",
    title: "Online Safety and Filtering Policy",
    type: "Policy",
    status: "Current",
    date: "2025-09-12",
    themes: ["policy", "online safety", "filtering", "monitoring", "child on child"],
    summary:
      "Filtering and monitoring standards and how the school responds to online incidents, harmful content and online child on child abuse.",
    content: `ONLINE SAFETY AND FILTERING POLICY

The school meets the filtering and monitoring standards expected under KCSIE 2024. Filtering blocks harmful and inappropriate content, and monitoring alerts designated staff to concerning activity.

Where an online safety incident arises, including a disclosure of contact from an unknown adult or the sharing of images, staff preserve evidence, avoid questioning the child in detail, and escalate to the DSL immediately. Online child on child abuse is treated as seriously as any other form of abuse.

This policy is read alongside the child protection policy and the behaviour and anti-bullying policy.`,
  },
  {
    key: "behaviour",
    title: "Behaviour and Anti-Bullying Policy",
    type: "Policy",
    status: "Current",
    date: "2025-09-03",
    themes: ["policy", "behaviour", "bullying", "child on child", "exclusions"],
    summary:
      "Behaviour expectations and the anti-bullying procedure, including child on child abuse and proportionate sanctions.",
    content: `BEHAVIOUR AND ANTI-BULLYING POLICY

The school promotes positive behaviour and treats bullying, including online bullying and child on child abuse, as a safeguarding matter. Staff record incidents and apply a restorative approach alongside proportionate sanctions.

Where a change in behaviour may reflect an unmet need or distress, staff are expected to look beyond the behaviour and consider a pastoral or safeguarding response rather than sanction alone.`,
  },
  {
    key: "attendance",
    title: "Attendance and Persistent Absence Strategy",
    type: "Policy",
    status: "Current",
    date: "2026-01-09",
    themes: ["policy", "attendance", "persistent absence", "children missing education", "welfare"],
    summary:
      "Strategy for persistent absence and children missing education, including the link between attendance and wider unmet need.",
    content: `ATTENDANCE AND PERSISTENT ABSENCE STRATEGY

The school treats attendance as a safeguarding issue. A pattern of lateness or absence is often the earliest indicator of an unmet need at home, including young carer responsibilities or financial pressure.

Staff lead with support before sanction. Where attendance falls, the school offers an attendance support conversation, involves the family, and considers an Early Help assessment. Children missing education are reported to the local authority in line with statutory guidance.`,
  },
  {
    key: "info-sharing",
    title: "Information Sharing and Consent Procedure",
    type: "Policy",
    status: "Current",
    date: "2026-02-20",
    themes: ["policy", "information sharing", "consent", "data protection", "multi-agency"],
    summary:
      "When and how to share safeguarding information lawfully, including consent, the public task basis and sharing with the local authority and police.",
    content: `INFORMATION SHARING AND CONSENT PROCEDURE

Staff share safeguarding information lawfully and proportionately. The absence of consent does not prevent sharing where a child may be at risk of harm. The lawful basis for sharing pupil safeguarding data is the public task, and special category data is shared under the safeguarding condition.

Information is shared with children's social care, the police and other agencies on a need to know basis, and every disclosure is recorded with who shared what, with whom, when and why.`,
  },
  {
    key: "scr",
    title: "Single Central Record",
    type: "Record",
    status: "Current",
    date: "2026-04-21",
    themes: ["safer recruitment", "dbs", "pre-employment", "vetting"],
    summary:
      "Record of pre-employment and vetting checks for all staff and regular volunteers.",
    content: `SINGLE CENTRAL RECORD

The single central record holds the pre-employment and vetting checks for all staff and regular volunteers, including identity, right to work, DBS, prohibition and reference checks. It is maintained continuously and checked regularly against the requirements of KCSIE 2024 part three.`,
  },
  {
    key: "dsl-training",
    title: "DSL Training Certificate",
    type: "Training",
    status: "Current",
    date: "2025-03-01",
    themes: ["training", "dsl", "kcsie"],
    summary: "Designated Safeguarding Lead training, two-yearly. Renews March 2027.",
    content: `TRAINING RECORD

Course: Designated Safeguarding Lead training
Renews March 2027

Completed by the DSL in line with the two-yearly requirement of KCSIE 2024.`,
  },
  {
    key: "staff-training",
    title: "Whole-Staff Safeguarding Training",
    type: "Training",
    status: "Current",
    date: "2025-09-01",
    themes: ["training", "safeguarding", "kcsie"],
    summary: "Annual whole-staff safeguarding training. Next due September 2026.",
    content: `TRAINING RECORD

Course: Whole-staff safeguarding training
Renews September 2026

Delivered to all staff at the start of the academic year, covering KCSIE 2024 part one.`,
  },
  {
    key: "s175",
    title: "Section 175 Self-Assessment",
    type: "Return",
    status: "Filed",
    date: "2026-03-12",
    themes: ["compliance", "return", "local authority", "section 175"],
    summary: "Section 175 safeguarding self-assessment submitted to the local authority.",
    content: `SECTION 175 SELF-ASSESSMENT

The school's annual section 175 safeguarding self-assessment was completed and submitted to the local authority on 12 March 2026. It confirms arrangements are in place across the safeguarding standards.`,
  },
];

export async function seedDocuments(tenantId: string): Promise<number> {
  for (const doc of DOCS) {
    const id = `seed-${tenantId.slice(-8)}-${doc.key}`;
    await systemDb.document.upsert({
      where: { id },
      update: {
        title: doc.title,
        summary: doc.summary,
        content: doc.content,
        themes: doc.themes,
        status: doc.status,
      },
      create: {
        id,
        tenantId,
        scope: "ORG",
        title: doc.title,
        type: doc.type,
        docDate: new Date(doc.date),
        status: doc.status,
        themes: doc.themes,
        summary: doc.summary,
        content: doc.content,
        source: "seed",
      },
    });
  }
  return DOCS.length;
}
