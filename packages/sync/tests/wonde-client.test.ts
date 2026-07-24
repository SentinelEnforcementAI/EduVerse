import { describe, expect, it } from "vitest";

import { WondeClient, type WondeTransport } from "../src";

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
