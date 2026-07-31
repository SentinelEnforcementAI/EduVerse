import type {
  WondeBehaviour,
  WondePage,
  WondeResult,
  WondeSchool,
  WondeSessionAttendance,
  WondeStudent,
} from "./types";

// One place for every Wonde endpoint and header. The transport is injectable
// so jobs are tested against fixture data without any network.
//
// VERIFY-AGAINST-SANDBOX: paths and Bearer auth follow Wonde's v1.0 API.
// Confirm against the sandbox school once a key is registered
// (wonde.com/developers); any correction happens here only.

const DEFAULT_BASE_URL = "https://api.wonde.com";
const PER_PAGE = 200;
const MAX_PAGES = 1000;

export interface WondeTransport {
  get(path: string, params: Record<string, string>): Promise<unknown>;
}

export class WondeApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "WondeApiError";
  }
}

// Wonde validates the `include` list per endpoint and 400s the whole request if
// any expansion is unknown for that school's MIS, e.g.
//   {"error":"invalid_include","error_description":"registration_group"}
// Different MIS platforms (and the sandbox) expose different vocabularies, so we
// treat a richer include as best-effort: on invalid_include, drop the named
// expansion and retry, rather than failing the entire sync. Returns the include
// name to remove, or null if the 400 was something else.
function invalidIncludeFrom(error: WondeApiError): string | null {
  if (error.status !== 400 || !error.body) return null;
  try {
    const parsed = JSON.parse(error.body) as {
      error?: string;
      error_description?: string;
    };
    if (parsed.error === "invalid_include" && parsed.error_description) {
      return parsed.error_description.trim();
    }
  } catch {
    // Non-JSON body — fall through.
  }
  return null;
}

// Wonde returns 403 invalid_permissions when the access token's app has not
// been granted a data scope for a school, e.g.
//   {"error":"invalid_permissions","error_description":"Scope attendance.read not enabled"}
// The connect can still proceed with the scopes that ARE enabled (a school with
// only a roll is still a connected school), so callers use this to skip a data
// domain rather than fail. Returns the human-readable scope description, or null
// if the error is a different 403.
export function missingScopeFrom(error: WondeApiError): string | null {
  if (error.status !== 403 || !error.body) return null;
  try {
    const parsed = JSON.parse(error.body) as {
      error?: string;
      error_description?: string;
    };
    if (parsed.error === "invalid_permissions") {
      return parsed.error_description?.trim() ?? "permission not enabled";
    }
  } catch {
    // Non-JSON body — fall through.
  }
  return null;
}

// A data domain a school's MIS does not expose at all: Wonde returns
// 404 resource_not_found for the endpoint, e.g. a school with no assessment
// module answering /results. Like a missing scope, this should skip the domain
// rather than fail the whole connect.
export function resourceNotFoundFrom(error: WondeApiError): string | null {
  if (error.status !== 404 || !error.body) return null;
  try {
    const parsed = JSON.parse(error.body) as {
      error?: string;
      error_description?: string;
    };
    if (parsed.error === "resource_not_found") {
      return parsed.error_description?.trim() || "resource not found";
    }
  } catch {
    // Non-JSON body — fall through.
  }
  return null;
}

// A data domain that cannot be pulled for this school because its scope is not
// granted (403) or its resource does not exist (404). Returns a human-readable
// reason to record against the skipped domain, or null for any other error.
export function domainUnavailableFrom(error: WondeApiError): string | null {
  return missingScopeFrom(error) ?? resourceNotFoundFrom(error);
}

export class HttpWondeTransport implements WondeTransport {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  async get(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new WondeApiError(
        `Wonde API ${response.status} on ${path}: ${body.slice(0, 300)}`,
        response.status,
        body,
      );
    }
    return response.json();
  }
}

export class WondeClient {
  constructor(private readonly transport: WondeTransport) {}

  // Fetch one page, self-healing against invalid `include` expansions: if this
  // school's MIS (or the sandbox) rejects an include, drop it and retry so the
  // sync degrades to fewer fields instead of failing outright. Mutates the
  // caller's params so the dropped include stays dropped for later pages too.
  //
  // Wonde sometimes names the offending include ("registration_group") and
  // sometimes returns a generic "Invalid includes" without saying which. When
  // it names one we drop that; when it doesn't, we drop the last include and
  // retry, narrowing to the largest accepted subset (down to none).
  private async fetchPage(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    for (;;) {
      try {
        return await this.transport.get(path, params);
      } catch (error) {
        if (!(error instanceof WondeApiError)) throw error;
        if (invalidIncludeFrom(error) === null) throw error;
        const current = params.include;
        if (!current) throw error;
        const tokens = current
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        const named = invalidIncludeFrom(error);
        // Drop the named include if it's one we sent; otherwise (generic error)
        // drop the last include to narrow the set.
        const remaining =
          named && tokens.includes(named)
            ? tokens.filter((part) => part !== named)
            : tokens.slice(0, -1);
        const dropped =
          named && tokens.includes(named) ? named : tokens[tokens.length - 1];
        if (remaining.length > 0) {
          params.include = remaining.join(",");
        } else {
          delete params.include;
        }
        console.warn(
          `[wonde] ${path}: dropping unsupported include "${dropped}" and retrying` +
            (remaining.length > 0 ? ` (keeping ${remaining.join(",")})` : " (no includes left)"),
        );
      }
    }
  }

  private async *paginate<T>(
    path: string,
    params: Record<string, string> = {},
  ): AsyncGenerator<T[]> {
    // Copied so include self-healing persists across pages without touching
    // the caller's literal.
    const query = { ...params };
    for (let page = 1; page <= MAX_PAGES; page++) {
      query.per_page = String(PER_PAGE);
      query.page = String(page);
      const raw = (await this.fetchPage(path, query)) as WondePage<T>;
      if (!Array.isArray(raw.data)) {
        throw new WondeApiError(`Unexpected response shape on ${path}`);
      }
      yield raw.data;
      const pagination = raw.meta?.pagination;
      const hasMore = pagination?.more === true || Boolean(pagination?.next);
      if (!hasMore) return;
    }
    throw new WondeApiError(`Pagination did not terminate on ${path}`);
  }

  // The schools the access token can reach. Used by self-connect onboarding to
  // let an admin map each tenant to its Wonde school. Collected across pages
  // (a token that serves a whole MAT can approve many schools).
  async schools(): Promise<WondeSchool[]> {
    const all: WondeSchool[] = [];
    for await (const page of this.paginate<WondeSchool>("/v1.0/schools")) {
      all.push(...page);
    }
    return all;
  }

  students(schoolId: string): AsyncGenerator<WondeStudent[]> {
    return this.paginate<WondeStudent>(
      `/v1.0/schools/${schoolId}/students`,
      { include: "year,registration_group" },
    );
  }

  sessionAttendance(schoolId: string): AsyncGenerator<WondeSessionAttendance[]> {
    return this.paginate<WondeSessionAttendance>(
      `/v1.0/schools/${schoolId}/attendance/session`,
      { include: "student,attendance_code" },
    );
  }

  behaviours(schoolId: string): AsyncGenerator<WondeBehaviour[]> {
    return this.paginate<WondeBehaviour>(
      `/v1.0/schools/${schoolId}/behaviours`,
      { include: "students" },
    );
  }

  results(schoolId: string): AsyncGenerator<WondeResult[]> {
    return this.paginate<WondeResult>(`/v1.0/schools/${schoolId}/results`, {
      include: "aspect,subject,student",
    });
  }
}
