import { describe, expect, it } from "vitest";

import { WondeApiError, WondeClient, type WondeTransport } from "../src";
import type { WondeStudent } from "../src/wonde/types";

// The self-connect onboarding step lists the schools an access token can reach.
// WondeClient.schools() must page through them all and return the flat list.

// A transport that serves a fixed set of schools with real pagination, so the
// client's page-walking is exercised without any network.
class PagedSchoolsTransport implements WondeTransport {
  public readonly paths: string[] = [];
  constructor(
    private readonly schools: { id: string; name: string }[],
    private readonly pageSize = 2,
  ) {}

  get(path: string, params: Record<string, string>): Promise<unknown> {
    this.paths.push(path);
    if (path !== "/v1.0/schools") {
      throw new Error(`unexpected path ${path}`);
    }
    const page = Number(params.page ?? "1");
    const start = (page - 1) * this.pageSize;
    const data = this.schools.slice(start, start + this.pageSize);
    return Promise.resolve({
      data,
      meta: { pagination: { more: start + this.pageSize < this.schools.length } },
    });
  }
}

describe("WondeClient.schools", () => {
  it("returns every school across pages", async () => {
    const transport = new PagedSchoolsTransport([
      { id: "A1", name: "Downlands" },
      { id: "B2", name: "Patcham" },
      { id: "C3", name: "Coastdown Academy" },
    ]);
    const schools = await new WondeClient(transport).schools();

    expect(schools.map((s) => s.id)).toEqual(["A1", "B2", "C3"]);
    expect(schools.map((s) => s.name)).toContain("Coastdown Academy");
    // Three schools at page size 2 → two page reads.
    expect(transport.paths).toHaveLength(2);
  });

  it("returns an empty list when the token can reach no schools", async () => {
    const schools = await new WondeClient(new PagedSchoolsTransport([])).schools();
    expect(schools).toEqual([]);
  });
});

// A school's MIS (and the Wonde sandbox) validates the `include` list and 400s
// the whole request if any expansion is unknown for that platform. The client
// must drop the offending include and retry, so the sync degrades to fewer
// fields instead of failing outright — this is what unblocked the sandbox
// connect (registration_group is not a valid include there).
class InvalidIncludeTransport implements WondeTransport {
  public readonly includeAttempts: (string | undefined)[] = [];
  constructor(
    private readonly rejected: string,
    private readonly students: WondeStudent[],
  ) {}

  get(path: string, params: Record<string, string>): Promise<unknown> {
    this.includeAttempts.push(params.include);
    const includes = (params.include ?? "").split(",").filter(Boolean);
    if (includes.includes(this.rejected)) {
      return Promise.reject(
        new WondeApiError(
          `Wonde API 400 on ${path}`,
          400,
          JSON.stringify({
            error: "invalid_include",
            error_description: this.rejected,
          }),
        ),
      );
    }
    return Promise.resolve({ data: this.students, meta: { pagination: { more: false } } });
  }
}

describe("WondeClient include self-healing", () => {
  it("drops an unsupported include and retries, still returning data", async () => {
    const transport = new InvalidIncludeTransport("registration_group", [
      {
        id: "WS1",
        forename: "Ada",
        surname: "Lovelace",
        date_of_birth: { date: "2012-03-04" },
        year: { data: { code: 8 } },
      },
    ]);

    const pages: WondeStudent[][] = [];
    for await (const page of new WondeClient(transport).students("A1930499544")) {
      pages.push(page);
    }

    // First attempt carries both includes and 400s; the retry drops the bad one.
    expect(transport.includeAttempts[0]).toBe("year,registration_group");
    expect(transport.includeAttempts[1]).toBe("year");
    expect(pages.flat().map((s) => s.id)).toEqual(["WS1"]);
  });

  it("narrows includes on a generic invalid_include that names no field", async () => {
    // Wonde's attendance endpoint 400s with a generic "Invalid includes" that
    // doesn't say which include is bad. The client must drop includes from the
    // end until the request is accepted (here: keep "student", drop the rest).
    const attempts: (string | undefined)[] = [];
    const transport: WondeTransport = {
      get(_path, params) {
        attempts.push(params.include);
        const includes = (params.include ?? "").split(",").filter(Boolean);
        if (includes.includes("attendance_code")) {
          return Promise.reject(
            new WondeApiError("Wonde API 400", 400, JSON.stringify({
              error: "invalid_include",
              error_description: "Invalid includes",
            })),
          );
        }
        return Promise.resolve({ data: [{ id: "R1" }], meta: { pagination: { more: false } } });
      },
    };

    const pages: unknown[][] = [];
    for await (const page of new WondeClient(transport).sessionAttendance("A1930499544")) {
      pages.push(page);
    }
    expect(attempts[0]).toBe("student,attendance_code");
    expect(attempts[1]).toBe("student");
    expect(pages.flat()).toHaveLength(1);
  });

  it("rethrows a 400 that is not an invalid_include", async () => {
    const transport: WondeTransport = {
      get: () =>
        Promise.reject(
          new WondeApiError("Wonde API 400", 400, JSON.stringify({ error: "bad_request" })),
        ),
    };
    await expect(async () => {
      for await (const _ of new WondeClient(transport).students("A1930499544")) {
        // drain
      }
    }).rejects.toThrow(WondeApiError);
  });
});
