// Shapes of Wonde API v1.0 responses, as consumed by the sync jobs.
// Fields are deliberately optional/defensive: the mapping layer in each job
// tolerates missing nesting and counts what it skips.
//
// VERIFY-AGAINST-SANDBOX: written from Wonde's published v1.0 API structure
// (data/meta envelopes, {data: ...} nesting on includes). Confirm field
// nesting against the sandbox school once WONDE_API_KEY is configured —
// adjustments belong in the job mapping functions, not callers.

export type WondePage<T> = {
  data: T[];
  meta?: {
    pagination?: {
      next?: string | null;
      more?: boolean;
    };
  };
};

export type WondeStudent = {
  id: string;
  upi?: string | null;
  forename?: string | null;
  surname?: string | null;
  date_of_birth?: { date?: string | null } | string | null;
  year?: { data?: { code?: string | number | null; name?: string | null } | null } | null;
  registration_group?: { data?: { name?: string | null } | null } | null;
};

export type WondeSessionAttendance = {
  id: string;
  date?: string | null;
  session?: string | null;
  student?: { data?: { id?: string | null } | null } | null;
  student_id?: string | null;
  attendance_code?: {
    code?: string | null;
    is_present?: boolean | null;
    is_authorised?: boolean | null;
  } | null;
};

export type WondeBehaviour = {
  id: string;
  date?: { date?: string | null } | string | null;
  kind?: string | null;
  comment?: string | null;
  points?: number | null;
  students?: { data?: { id?: string | null }[] | null } | null;
};

export type WondeResult = {
  id: string;
  value?: string | number | null;
  date?: { date?: string | null } | string | null;
  aspect?: { data?: { name?: string | null } | null } | null;
  subject?: { data?: { name?: string | null } | null } | null;
  student?: { data?: { id?: string | null } | null } | null;
  student_id?: string | null;
};
