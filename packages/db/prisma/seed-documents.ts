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
      "Annual child protection policy aligned to KCSIE 2026. Sets out reporting routes, the role of the DSL, safer recruitment, online safety and managing allegations.",
    content: `CHILD PROTECTION AND SAFEGUARDING POLICY

This policy is reviewed annually and is aligned to Keeping Children Safe in Education 2026. It sets out how the school keeps children safe, the role of the Designated Safeguarding Lead, and the routes by which any member of staff reports a concern.

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

The school meets the filtering and monitoring standards expected under KCSIE 2026. Filtering blocks harmful and inappropriate content, and monitoring alerts designated staff to concerning activity.

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

The single central record holds the pre-employment and vetting checks for all staff and regular volunteers, including identity, right to work, DBS, prohibition and reference checks. It is maintained continuously and checked regularly against the requirements of KCSIE 2026 part three.`,
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

Completed by the DSL in line with the two-yearly requirement of KCSIE 2026.`,
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

Delivered to all staff at the start of the academic year, covering KCSIE 2026 part one.`,
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
  {
    key: "governor-report",
    title: "Governor Safeguarding Annual Report",
    type: "Report",
    status: "Current",
    date: "2026-02-05",
    themes: ["governance", "report", "assurance", "dsl", "training"],
    summary:
      "Annual report to the governing board on safeguarding: concern volumes, referrals, training compliance and the single central record.",
    content: `GOVERNOR SAFEGUARDING ANNUAL REPORT

Presented to the governing board by the Designated Safeguarding Lead. The report summarises the year's safeguarding activity: the volume and nature of concerns raised, referrals to children's social care and their outcomes, staff training compliance, and the status of the single central record.

The link governor for safeguarding met with the DSL each term and reviewed a sample of records. The board is assured that arrangements meet KCSIE 2026 and that the culture of the school supports early help and timely referral.`,
  },
  {
    key: "early-help",
    title: "Early Help Offer and Thresholds Guidance",
    type: "Guidance",
    status: "Current",
    date: "2025-10-14",
    themes: ["early help", "thresholds", "multi-agency", "welfare", "family"],
    summary:
      "How the school identifies need early and works with the local threshold document, from universal support to a statutory referral.",
    content: `EARLY HELP OFFER AND THRESHOLDS GUIDANCE

The school offers early help before needs escalate: pastoral support, an Early Help assessment led by a keyworker, and coordinated support with the family's consent. Staff use the local safeguarding partnership threshold document to judge the right level of response.

Where needs are greater than early help can meet, or a child is at risk of significant harm, staff make a referral to children's social care without delay. Consent is sought where safe to do so, but is not required where seeking it would place a child at risk.`,
  },
  {
    key: "lado",
    title: "Managing Allegations Against Staff (LADO) Procedure",
    type: "Procedure",
    status: "Current",
    date: "2025-09-20",
    themes: ["allegations", "lado", "staff conduct", "low-level concerns"],
    summary:
      "How allegations and low-level concerns about adults are handled, including referral to the Local Authority Designated Officer.",
    content: `MANAGING ALLEGATIONS AGAINST STAFF (LADO) PROCEDURE

Any allegation that an adult may have harmed a child, or behaved in a way that indicates they are unsuitable to work with children, is reported to the headteacher and referred to the Local Authority Designated Officer the same day. Where the concern is about the headteacher, it is reported directly to the LADO.

Low-level concerns that do not meet the allegations threshold are recorded and reviewed for patterns, in line with KCSIE 2026 part four. This supports a culture where concerns are shared early.`,
  },
  {
    key: "prevent",
    title: "Prevent Duty Risk Assessment",
    type: "Assessment",
    status: "Current",
    date: "2025-11-03",
    themes: ["prevent", "radicalisation", "risk assessment", "online safety"],
    summary:
      "Assessment of the risk of pupils being drawn into terrorism and the school's protective measures under the Prevent duty.",
    content: `PREVENT DUTY RISK ASSESSMENT

The school assesses the risk of pupils being drawn into terrorism and radicalisation, including online. Protective measures include staff training on recognising the signs, a clear referral route to the DSL, and filtering and monitoring of online activity.

Concerns are handled proportionately: most are met through pastoral support and, where appropriate, a Channel referral made with the same care as any other safeguarding referral.`,
  },
  {
    key: "rshe",
    title: "Relationships, Sex and Health Education Statement",
    type: "Statement",
    status: "Current",
    date: "2025-09-08",
    themes: ["rshe", "curriculum", "online safety", "healthy relationships", "consent"],
    summary:
      "How the curriculum helps pupils recognise healthy relationships, stay safe online and know how to seek help.",
    content: `RELATIONSHIPS, SEX AND HEALTH EDUCATION STATEMENT

The curriculum helps pupils recognise healthy and unhealthy relationships, understand consent, stay safe online, and know how to seek help. It is a protective factor: pupils who understand these things are more likely to disclose and less likely to come to harm.

Content is age-appropriate and delivered alongside the school's safeguarding and online safety work, so that what pupils learn in lessons is reinforced by how the school responds to concerns.`,
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
