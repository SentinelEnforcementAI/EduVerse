import type { WondeTransport } from "../src/wonde/client";
import type {
  WondeBehaviour,
  WondeResult,
  WondeSessionAttendance,
  WondeStudent,
} from "../src/wonde/types";

// In-memory Wonde transport serving fixture data with real pagination
// behaviour, so jobs and the queue are tested without any network.

export type FakeSchool = {
  students: WondeStudent[];
  attendance: WondeSessionAttendance[];
  behaviours: WondeBehaviour[];
  results: WondeResult[];
};

export class FakeWondeTransport implements WondeTransport {
  constructor(
    private readonly schoolId: string,
    private readonly school: FakeSchool,
    private readonly pageSize = 2,
  ) {}

  get(path: string, params: Record<string, string>): Promise<unknown> {
    const collection = this.collectionFor(path);
    const page = Number(params.page ?? "1");
    const start = (page - 1) * this.pageSize;
    const data = collection.slice(start, start + this.pageSize);
    return Promise.resolve({
      data,
      meta: { pagination: { more: start + this.pageSize < collection.length } },
    });
  }

  private collectionFor(path: string): unknown[] {
    const base = `/v1.0/schools/${this.schoolId}`;
    switch (path) {
      case `${base}/students`:
        return this.school.students;
      case `${base}/attendance/session`:
        return this.school.attendance;
      case `${base}/behaviours`:
        return this.school.behaviours;
      case `${base}/results`:
        return this.school.results;
      default:
        throw new Error(`FakeWondeTransport: unexpected path ${path}`);
    }
  }
}

export function fixtureSchool(): FakeSchool {
  return {
    students: [
      {
        id: "WS1",
        upi: "UPI-001",
        forename: "Ada",
        surname: "Lovelace",
        date_of_birth: { date: "2012-03-04" },
        year: { data: { code: 8 } },
        registration_group: { data: { name: "8A" } },
      },
      {
        id: "WS2",
        upi: "UPI-002",
        forename: "Alan",
        surname: "Turing",
        date_of_birth: { date: "2011-06-23" },
        year: { data: { name: "Year 9" } },
        registration_group: { data: { name: "9B" } },
      },
      {
        id: "WS3",
        upi: "UPI-003",
        forename: "Grace",
        surname: "Hopper",
        date_of_birth: { date: "2012-12-09" },
        year: { data: { code: 8 } },
        registration_group: { data: { name: "8B" } },
      },
    ],
    attendance: [
      {
        id: "WA1",
        date: "2026-07-13",
        session: "AM",
        student: { data: { id: "WS1" } },
        attendance_code: { code: "/", is_present: true, is_authorised: true },
      },
      {
        id: "WA2",
        date: "2026-07-13",
        session: "PM",
        student: { data: { id: "WS1" } },
        attendance_code: { code: "O", is_present: false, is_authorised: false },
      },
      {
        id: "WA3",
        date: "2026-07-13",
        session: "AM",
        student: { data: { id: "WS2" } },
        attendance_code: { code: "I", is_present: false, is_authorised: true },
      },
      {
        // Unknown student — must be skipped, not fail the job.
        id: "WA4",
        date: "2026-07-13",
        session: "AM",
        student: { data: { id: "WS-UNKNOWN" } },
        attendance_code: { code: "/", is_present: true, is_authorised: true },
      },
    ],
    behaviours: [
      {
        id: "WB1",
        date: { date: "2026-07-10" },
        kind: "Disruption",
        comment: "Disrupting the lesson",
        points: 2,
        // Two pupils involved — becomes one incident row each.
        students: { data: [{ id: "WS1" }, { id: "WS2" }] },
      },
      {
        id: "WB2",
        date: { date: "2026-07-11" },
        kind: "Defiance",
        comment: "Refused instruction",
        points: 5,
        students: { data: [{ id: "WS3" }] },
      },
    ],
    results: [
      {
        id: "WR1",
        value: 72,
        date: { date: "2026-07-01" },
        subject: { data: { name: "Maths" } },
        student: { data: { id: "WS1" } },
      },
      {
        id: "WR2",
        value: "58",
        date: { date: "2026-07-01" },
        aspect: { data: { name: "English" } },
        student: { data: { id: "WS2" } },
      },
    ],
  };
}
