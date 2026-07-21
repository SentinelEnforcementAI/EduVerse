import type {
  WondeBehaviour,
  WondePage,
  WondeResult,
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
  ) {
    super(message);
    this.name = "WondeApiError";
  }
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
      );
    }
    return response.json();
  }
}

export class WondeClient {
  constructor(private readonly transport: WondeTransport) {}

  private async *paginate<T>(
    path: string,
    params: Record<string, string> = {},
  ): AsyncGenerator<T[]> {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const raw = (await this.transport.get(path, {
        ...params,
        per_page: String(PER_PAGE),
        page: String(page),
      })) as WondePage<T>;
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
