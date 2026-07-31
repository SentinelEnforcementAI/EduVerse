import { systemDb, type SyncType, type Tenant } from "@sentinel/db";

import type { WondeClient } from "../wonde/client";
import type {
  WondeBehaviour,
  WondeResult,
  WondeSessionAttendance,
  WondeStudent,
} from "../wonde/types";

// Idempotent sync jobs: every record carries a Wonde-derived idempotency key
// (pupils.wonde_id, *.source_id), so re-running a sync converges instead of
// duplicating. Jobs write via the RLS system context and never write back to
// the MIS — ingestion is strictly read-from-source (overlay principle).

export type SyncStats = {
  created: number;
  updated: number;
  skipped: number;
};

function emptyStats(): SyncStats {
  return { created: 0, updated: 0, skipped: 0 };
}

function dateFrom(value: { date?: string | null } | string | null | undefined): Date | null {
  const raw = typeof value === "string" ? value : value?.date;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function yearGroupFrom(student: WondeStudent): number | null {
  const year = student.year?.data;
  const source = year?.code ?? year?.name;
  if (source === null || source === undefined) return null;
  const match = String(source).match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function pupilIdsByWondeId(tenantId: string): Promise<Map<string, string>> {
  const pupils = await systemDb.pupil.findMany({
    where: { tenantId, wondeId: { not: null } },
    select: { id: true, wondeId: true },
  });
  return new Map(pupils.map((p) => [p.wondeId!, p.id]));
}

// Field-presence shape of a student payload, for diagnosing why a real MIS's
// students are being skipped — without logging any pupil-identifying values
// (names, DOB, UPN). Booleans and structural keys only.
function studentShape(student: WondeStudent): string {
  const dob = student.date_of_birth;
  return JSON.stringify({
    keys: Object.keys(student),
    hasForename: Boolean(student.forename),
    hasSurname: Boolean(student.surname),
    dobType: dob === null || dob === undefined ? "missing" : typeof dob,
    dobKeys: dob && typeof dob === "object" ? Object.keys(dob) : undefined,
    yearKeys: student.year ? Object.keys(student.year) : "missing",
    yearDataKeys: student.year?.data ? Object.keys(student.year.data) : "missing",
  });
}

export async function syncStudents(
  client: WondeClient,
  tenant: Tenant,
): Promise<SyncStats> {
  const stats = emptyStats();
  // Attribute skips to a field so a 100%-skipped first pull is diagnosable
  // against the real payload (see studentShape) rather than a silent 0 pupils.
  // Date of birth is optional (the sandbox and some MIS omit it, and the rules
  // engine doesn't use it) — a pupil needs an id, a name and a year group.
  const skipReasons = { noId: 0, noName: 0, noYear: 0 };
  let firstShape: string | null = null;
  for await (const page of client.students(tenant.wondeSchoolId!)) {
    for (const student of page) {
      if (firstShape === null) firstShape = studentShape(student);
      const dateOfBirth = dateFrom(student.date_of_birth);
      const yearGroup = yearGroupFrom(student);
      if (!student.id) {
        skipReasons.noId += 1;
        stats.skipped += 1;
        continue;
      }
      if (!student.forename || !student.surname) {
        skipReasons.noName += 1;
        stats.skipped += 1;
        continue;
      }
      if (yearGroup === null) {
        skipReasons.noYear += 1;
        stats.skipped += 1;
        continue;
      }
      const data = {
        firstName: student.forename,
        lastName: student.surname,
        yearGroup,
        // Some MIS/the sandbox don't expose a registration group include; fall
        // back to a readable year-based label rather than an "unknown" marker.
        registrationGroup: student.registration_group?.data?.name ?? `Yr ${yearGroup}`,
        dateOfBirth,
      };
      const existing = await systemDb.pupil.findUnique({
        where: { tenantId_wondeId: { tenantId: tenant.id, wondeId: student.id } },
        select: { id: true },
      });
      if (existing) {
        await systemDb.pupil.update({ where: { id: existing.id }, data });
        stats.updated += 1;
      } else {
        await systemDb.pupil.create({
          data: {
            ...data,
            tenantId: tenant.id,
            wondeId: student.id,
            upn: student.upi ?? `W-${student.id}`,
          },
        });
        stats.created += 1;
      }
    }
  }
  // A first pull that skipped every student (0 created/updated) almost always
  // means the real payload nests a required field differently than expected.
  // Log the reason breakdown and one non-identifying shape sample so it is
  // diagnosable without another blind round-trip.
  if (stats.created === 0 && stats.updated === 0 && stats.skipped > 0) {
    console.warn(
      `[wonde] all ${stats.skipped} students skipped by mapper — reasons ` +
        `${JSON.stringify(skipReasons)}; sample shape ${firstShape}`,
    );
  }
  return stats;
}

export async function syncAttendance(
  client: WondeClient,
  tenant: Tenant,
): Promise<SyncStats> {
  const stats = emptyStats();
  const pupilIds = await pupilIdsByWondeId(tenant.id);

  for await (const page of client.sessionAttendance(tenant.wondeSchoolId!)) {
    for (const record of page) {
      const studentId = record.student?.data?.id ?? record.student_id;
      const pupilId = studentId ? pupilIds.get(studentId) : undefined;
      const date = dateFrom(record.date ?? null);
      const session = record.session === "AM" || record.session === "PM" ? record.session : null;
      if (!record.id || !pupilId || !date || !session) {
        stats.skipped += 1;
        continue;
      }
      const code = record.attendance_code?.code ?? "/";
      const present =
        record.attendance_code?.is_present ?? (code === "/" || code === "L");
      const authorised = record.attendance_code?.is_authorised ?? present;

      const existing = await systemDb.attendanceRecord.findUnique({
        where: { tenantId_sourceId: { tenantId: tenant.id, sourceId: record.id } },
        select: { id: true },
      });
      try {
        if (existing) {
          await systemDb.attendanceRecord.update({
            where: { id: existing.id },
            data: { pupilId, date, session, code, present, authorised },
          });
          stats.updated += 1;
        } else {
          await systemDb.attendanceRecord.create({
            data: {
              tenantId: tenant.id,
              sourceId: record.id,
              pupilId,
              date,
              session,
              code,
              present,
              authorised,
            },
          });
          stats.created += 1;
        }
      } catch {
        // Unique collision (e.g. duplicate pupil/date/session in feed).
        stats.skipped += 1;
      }
    }
  }
  return stats;
}

const SEVERITY_BY_POINTS = (points: number | null | undefined): number =>
  points === null || points === undefined ? 1 : points >= 4 ? 3 : points >= 2 ? 2 : 1;

export async function syncBehaviour(
  client: WondeClient,
  tenant: Tenant,
): Promise<SyncStats> {
  const stats = emptyStats();
  const pupilIds = await pupilIdsByWondeId(tenant.id);

  for await (const page of client.behaviours(tenant.wondeSchoolId!)) {
    for (const behaviour of page) {
      const date = dateFrom(behaviour.date ?? null);
      const students = behaviour.students?.data ?? [];
      if (!behaviour.id || !date || students.length === 0) {
        stats.skipped += 1;
        continue;
      }
      for (const student of students) {
        const pupilId = student.id ? pupilIds.get(student.id) : undefined;
        if (!pupilId) {
          stats.skipped += 1;
          continue;
        }
        // One incident row per involved pupil.
        const sourceId = `${behaviour.id}:${student.id}`;
        const data = {
          pupilId,
          date,
          category: behaviour.kind?.toLowerCase() ?? "other",
          severity: SEVERITY_BY_POINTS(behaviour.points),
          description: behaviour.comment ?? "",
        };
        const existing = await systemDb.behaviourIncident.findUnique({
          where: { tenantId_sourceId: { tenantId: tenant.id, sourceId } },
          select: { id: true },
        });
        if (existing) {
          await systemDb.behaviourIncident.update({ where: { id: existing.id }, data });
          stats.updated += 1;
        } else {
          await systemDb.behaviourIncident.create({
            data: { ...data, tenantId: tenant.id, sourceId },
          });
          stats.created += 1;
        }
      }
    }
  }
  return stats;
}

export async function syncAttainment(
  client: WondeClient,
  tenant: Tenant,
): Promise<SyncStats> {
  const stats = emptyStats();
  const pupilIds = await pupilIdsByWondeId(tenant.id);

  for await (const page of client.results(tenant.wondeSchoolId!)) {
    for (const result of page) {
      const studentId = result.student?.data?.id ?? result.student_id;
      const pupilId = studentId ? pupilIds.get(studentId) : undefined;
      const assessedAt = dateFrom(result.date ?? null);
      const score = Number(result.value);
      const subject =
        result.subject?.data?.name ?? result.aspect?.data?.name ?? null;
      if (!result.id || !pupilId || !assessedAt || !subject || Number.isNaN(score)) {
        stats.skipped += 1;
        continue;
      }
      const data = { pupilId, subject, assessedAt, score: Math.round(score) };
      const existing = await systemDb.attainmentRecord.findUnique({
        where: { tenantId_sourceId: { tenantId: tenant.id, sourceId: result.id } },
        select: { id: true },
      });
      try {
        if (existing) {
          await systemDb.attainmentRecord.update({ where: { id: existing.id }, data });
          stats.updated += 1;
        } else {
          await systemDb.attainmentRecord.create({
            data: { ...data, tenantId: tenant.id, sourceId: result.id },
          });
          stats.created += 1;
        }
      } catch {
        stats.skipped += 1;
      }
    }
  }
  return stats;
}

const JOBS: Record<SyncType, (client: WondeClient, tenant: Tenant) => Promise<SyncStats>> = {
  STUDENTS: syncStudents,
  ATTENDANCE: syncAttendance,
  BEHAVIOUR: syncBehaviour,
  ATTAINMENT: syncAttainment,
};

export async function runSync(
  client: WondeClient,
  type: SyncType,
  tenantId: string,
): Promise<SyncStats> {
  const tenant = await systemDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error(`Unknown tenant: ${tenantId}`);
  if (!tenant.wondeSchoolId) {
    throw new Error(
      `Tenant ${tenant.slug} is not linked to a Wonde school. ` +
        `Run the trigger CLI with WONDE_SCHOOL_ID set to link it.`,
    );
  }
  return JOBS[type](client, tenant);
}
