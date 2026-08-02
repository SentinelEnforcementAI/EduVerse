import { systemDb, type SyncType, type Tenant } from "@sentinel/db";

import type { WondeClient, WondeWindow } from "../wonde/client";
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

function addStats(into: SyncStats, from: SyncStats): void {
  into.created += from.created;
  into.updated += from.updated;
  into.skipped += from.skipped;
}

// A row to upsert, keyed by its Wonde-derived source id.
type SourcedRow = { sourceId: string; data: Record<string, unknown> };

// Persist a batch of rows keyed by (tenant_id, source_id) with a fixed, small
// number of round-trips instead of two per row: one findMany to load the
// existing rows, one createMany for the new ones, and per-row updates only
// where a field actually changed. A full-school register is tens of thousands
// of rows — row-at-a-time upserts take tens of minutes and don't scale to a
// MAT; batching brings it down to seconds. createMany(skipDuplicates) also
// absorbs secondary-unique collisions (e.g. a repeated pupil/date/session in
// the feed) without aborting the batch.
async function upsertBatch<E extends { id: string; sourceId: string | null }>(
  rows: SourcedRow[],
  ops: {
    findExisting: (sourceIds: string[]) => Promise<E[]>;
    createMany: (data: Record<string, unknown>[]) => Promise<{ count: number }>;
    update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
    changed: (existing: E, data: Record<string, unknown>) => boolean;
    tenantId: string;
  },
): Promise<SyncStats> {
  const stats = emptyStats();
  if (rows.length === 0) return stats;

  // Dedupe within the batch by source id (feeds can repeat a record); keep the
  // last occurrence so the newest wins.
  const bySource = new Map(rows.map((row) => [row.sourceId, row]));
  const existing = await ops.findExisting([...bySource.keys()]);
  const existingBySource = new Map(existing.map((e) => [e.sourceId, e]));

  const toCreate: Record<string, unknown>[] = [];
  for (const row of bySource.values()) {
    const found = existingBySource.get(row.sourceId);
    if (!found) {
      toCreate.push({ tenantId: ops.tenantId, sourceId: row.sourceId, ...row.data });
    } else {
      // Present already — count as reconciled; only write if a field changed.
      if (ops.changed(found, row.data)) await ops.update(found.id, row.data);
      stats.updated += 1;
    }
  }
  if (toCreate.length > 0) {
    const { count } = await ops.createMany(toCreate);
    stats.created += count;
    // Rows a secondary unique rejected (e.g. duplicate pupil/date/session).
    stats.skipped += toCreate.length - count;
  }
  return stats;
}

function sameDate(a: Date | string | null, b: unknown): boolean {
  if (!(b instanceof Date)) return false;
  const av = a instanceof Date ? a.getTime() : a ? new Date(a).getTime() : NaN;
  return av === b.getTime();
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

// A sample of a raw record for diagnosing why a domain's rows are being skipped
// (usually pupil resolution or a differently-nested field). The Wonde sandbox is
// synthetic test data (no real pupils), so a truncated JSON sample is safe and
// is the fastest way to see the real field layout and correct the mapping.
// DIAGNOSTIC: only used on the sandbox/test connection.
function recordShape(record: Record<string, unknown>): string {
  return JSON.stringify(record).slice(0, 900);
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
  window: WondeWindow = {},
): Promise<SyncStats> {
  const stats = emptyStats();
  const pupilIds = await pupilIdsByWondeId(tenant.id);
  let firstShape: string | null = null;

  for await (const page of client.sessionAttendance(tenant.wondeSchoolId!, window)) {
    const rows: SourcedRow[] = [];
    for (const record of page) {
      if (firstShape === null) firstShape = recordShape(record as Record<string, unknown>);
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
      rows.push({ sourceId: record.id, data: { pupilId, date, session, code, present, authorised } });
    }
    addStats(
      stats,
      await upsertBatch(rows, {
        tenantId: tenant.id,
        findExisting: (sourceIds) =>
          systemDb.attendanceRecord.findMany({
            where: { tenantId: tenant.id, sourceId: { in: sourceIds } },
            select: {
              id: true,
              sourceId: true,
              pupilId: true,
              date: true,
              session: true,
              code: true,
              present: true,
              authorised: true,
            },
          }),
        createMany: (data) =>
          systemDb.attendanceRecord.createMany({ data: data as never, skipDuplicates: true }),
        update: (id, data) => systemDb.attendanceRecord.update({ where: { id }, data }),
        changed: (e, d) =>
          e.pupilId !== d.pupilId ||
          !sameDate(d.date as Date, e.date) ||
          e.session !== d.session ||
          e.code !== d.code ||
          e.present !== d.present ||
          e.authorised !== d.authorised,
      }),
    );
  }
  if (stats.created === 0 && stats.updated === 0 && stats.skipped > 0) {
    console.warn(
      `[wonde] all ${stats.skipped} attendance records skipped (pupil link or ` +
        `empty/absent fields) — sample record ${firstShape}`,
    );
  }
  return stats;
}

const SEVERITY_BY_POINTS = (points: number | null | undefined): number =>
  points === null || points === undefined ? 1 : points >= 4 ? 3 : points >= 2 ? 2 : 1;

export async function syncBehaviour(
  client: WondeClient,
  tenant: Tenant,
  window: WondeWindow = {},
): Promise<SyncStats> {
  const stats = emptyStats();
  const pupilIds = await pupilIdsByWondeId(tenant.id);
  let firstShape: string | null = null;

  for await (const page of client.behaviours(tenant.wondeSchoolId!, window)) {
    const rows: SourcedRow[] = [];
    for (const behaviour of page) {
      if (firstShape === null) firstShape = recordShape(behaviour as Record<string, unknown>);
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
        rows.push({
          sourceId: `${behaviour.id}:${student.id}`,
          data: {
            pupilId,
            date,
            category: behaviour.kind?.toLowerCase() ?? "other",
            severity: SEVERITY_BY_POINTS(behaviour.points),
            description: behaviour.comment ?? "",
          },
        });
      }
    }
    addStats(
      stats,
      await upsertBatch(rows, {
        tenantId: tenant.id,
        findExisting: (sourceIds) =>
          systemDb.behaviourIncident.findMany({
            where: { tenantId: tenant.id, sourceId: { in: sourceIds } },
            select: {
              id: true,
              sourceId: true,
              pupilId: true,
              date: true,
              category: true,
              severity: true,
              description: true,
            },
          }),
        createMany: (data) =>
          systemDb.behaviourIncident.createMany({ data: data as never, skipDuplicates: true }),
        update: (id, data) => systemDb.behaviourIncident.update({ where: { id }, data }),
        changed: (e, d) =>
          e.pupilId !== d.pupilId ||
          !sameDate(d.date as Date, e.date) ||
          e.category !== d.category ||
          e.severity !== d.severity ||
          e.description !== d.description,
      }),
    );
  }
  if (stats.created === 0 && stats.updated === 0 && stats.skipped > 0) {
    console.warn(
      `[wonde] all ${stats.skipped} behaviour records skipped (pupil link or ` +
        `empty/absent fields) — sample record ${firstShape}`,
    );
  }
  return stats;
}

export async function syncAttainment(
  client: WondeClient,
  tenant: Tenant,
  window: WondeWindow = {},
): Promise<SyncStats> {
  const stats = emptyStats();
  const pupilIds = await pupilIdsByWondeId(tenant.id);

  for await (const page of client.results(tenant.wondeSchoolId!, window)) {
    const rows: SourcedRow[] = [];
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
      rows.push({
        sourceId: result.id,
        data: { pupilId, subject, assessedAt, score: Math.round(score) },
      });
    }
    addStats(
      stats,
      await upsertBatch(rows, {
        tenantId: tenant.id,
        findExisting: (sourceIds) =>
          systemDb.attainmentRecord.findMany({
            where: { tenantId: tenant.id, sourceId: { in: sourceIds } },
            select: {
              id: true,
              sourceId: true,
              pupilId: true,
              subject: true,
              assessedAt: true,
              score: true,
            },
          }),
        createMany: (data) =>
          systemDb.attainmentRecord.createMany({ data: data as never, skipDuplicates: true }),
        update: (id, data) => systemDb.attainmentRecord.update({ where: { id }, data }),
        changed: (e, d) =>
          e.pupilId !== d.pupilId ||
          e.subject !== d.subject ||
          !sameDate(d.assessedAt as Date, e.assessedAt) ||
          e.score !== d.score,
      }),
    );
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
