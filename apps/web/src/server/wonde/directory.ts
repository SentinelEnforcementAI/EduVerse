// The Wonde directory: the schools the environment's access token can reach.
// Self-connect onboarding (commercialisation slice 3) uses this to let an admin
// map each tenant to its Wonde school. One token per environment/customer (the
// silo stack's `<project>/wonde-api-key` secret, injected as WONDE_API_KEY); the
// schools listed are the ones that have approved the application.
//
// This talks to a single read-only endpoint (GET /v1.0/schools) with the same
// Bearer auth as the sync package's HttpWondeTransport, kept here as a thin
// fetch so the web server does not pull in the worker's queue/redis stack. The
// canonical multi-endpoint client lives in @sentinel/sync.

const PLACEHOLDER = "not-configured-yet";
const PER_PAGE = 200;
const MAX_PAGES = 50;

export type WondeSchoolRef = { id: string; name: string };

export class WondeDirectoryError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "WondeDirectoryError";
  }
}

function token(): string | null {
  const value = process.env.WONDE_API_KEY?.trim();
  if (!value || value === PLACEHOLDER) return null;
  return value;
}

function baseUrl(): string {
  return process.env.WONDE_BASE_URL?.trim() || "https://api.wonde.com";
}

// Whether a usable access token is configured for this environment. False for
// the demo stack (no key, or the bootstrap placeholder), which the onboarding
// UI shows as "not connected yet".
export function isWondeConfigured(): boolean {
  return token() !== null;
}

type SchoolsPage = {
  data?: { id?: string | null; name?: string | null }[] | null;
  meta?: { pagination?: { more?: boolean; next?: string | null } | null } | null;
};

// The schools the access token can reach, across all pages. Throws
// WondeDirectoryError if no token is configured or the API rejects the call —
// the router maps that to a friendly message.
export async function listWondeSchools(): Promise<WondeSchoolRef[]> {
  const key = token();
  if (!key) {
    throw new WondeDirectoryError("Wonde is not connected for this environment.");
  }

  const out: WondeSchoolRef[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL("/v1.0/schools", baseUrl());
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new WondeDirectoryError(
        `Wonde API ${response.status}: ${body.slice(0, 200)}`,
        response.status,
      );
    }
    const body = (await response.json()) as SchoolsPage;
    for (const s of body.data ?? []) {
      if (s?.id) out.push({ id: s.id, name: s.name?.trim() || s.id });
    }
    const pagination = body.meta?.pagination;
    const hasMore = pagination?.more === true || Boolean(pagination?.next);
    if (!hasMore) break;
  }
  return out;
}
