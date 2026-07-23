import {
  Database,
  Eye,
  FileLock2,
  Lock,
  MapPin,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { Card } from "@/components/ui/card";

// Governance (spec 5.15): how Watch handles data, access and privacy. Each
// statement describes how the system actually works, not an aspiration.
const SECTIONS = [
  {
    icon: MapPin,
    title: "UK data residency",
    body: "All pupil data and all inference stay on UK infrastructure in AWS London (eu-west-2). No pupil data leaves the UK, and any AI inference runs against UK-resident endpoints only.",
  },
  {
    icon: Database,
    title: "Multi-tenancy by row-level security",
    body: "Every record carries a tenant. Isolation is enforced in the database by row-level security policies, not only in application code, so one school can never read or write another school's data.",
  },
  {
    icon: FileLock2,
    title: "Full, append-only audit",
    body: "Every read and change against a child's record is logged with who, what, when and why. Audit entries can never be edited or deleted. Safeguarding records are never hard-deleted anywhere in the system.",
  },
  {
    icon: Eye,
    title: "Sealed identity",
    body: "A pupil appears as a sealed reference until a case reaches the action threshold. Revealing an identity requires a reason and is written to the audit trail with that reason.",
  },
  {
    icon: UserCheck,
    title: "Human in the loop",
    body: "Watch surfaces, proposes and drafts. A person confirms. Nothing that affects a child changes state without a human action, including when Watch reads an inbound document and proposes an update.",
  },
  {
    icon: Lock,
    title: "Privacy by design for AI",
    body: "Pupil data is pseudonymised before any AI inference: no names, addresses or free-text notes are sent. Every AI output is labelled as advisory and has a deterministic fallback, so a person is never shown an empty panel or an unexplained score.",
  },
  {
    icon: ShieldCheck,
    title: "Access and roles",
    body: "Sign-in is invite-only. A school DSL sees their own school; a trust director sees the schools of their trust, each read through that school's own isolation context. No account has a see-everything path.",
  },
];

export default function GovernancePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Data governance</h1>
      <p className="mt-1 text-base text-muted-foreground">
        How Watch handles data, access and privacy. Each statement describes how
        the system works today.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="p-5">
              <div className="flex items-center gap-2.5">
                <Icon className="size-5 text-cobalt" aria-hidden />
                <h2 className="text-base font-semibold">{section.title}</h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {section.body}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
