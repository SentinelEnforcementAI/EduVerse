import { redirect } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { serverApi } from "@/trpc/server";

import { InviteForm, RoleControl, StatusControl } from "./user-admin";

const ROLE_LABEL: Record<string, string> = {
  DSL: "DSL",
  DIRECTOR: "Director",
  ADMIN: "Admin",
};

function initials(name: string | null, email: string): string {
  const src = name?.trim() || email;
  return src
    .split(/[\s@.]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// User management (commercialisation slice 1). Trust administrators invite,
// re-role and deactivate accounts here — replacing the CLI-only provisioning.
// Admin-only: a non-admin who reaches this URL is sent back to their dashboard.
export default async function UsersAdminPage() {
  const api = await serverApi();

  let data;
  try {
    data = await api.admin.users();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Who can access Sentinel Watch for this trust. Invite, change role, or
        deactivate. Every change is audited.
      </p>

      <div className="mt-6">
        <InviteForm schools={data.schools} />
      </div>

      <h2 className="mt-8 text-xl font-semibold">
        Accounts{" "}
        <span className="text-base font-normal text-muted-foreground">
          ({data.users.length})
        </span>
      </h2>
      <ul className="mt-3 overflow-hidden rounded-xl border border-cloud bg-card">
        {data.users.map((u) => {
          const isSelf = u.id === data.selfId;
          const deactivated = u.status === "DEACTIVATED";
          return (
            <li
              key={u.id}
              className="flex flex-wrap items-center gap-4 border-b border-cloud px-4 py-4 last:border-b-0"
            >
              <span
                aria-hidden
                className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  deactivated
                    ? "bg-cloud text-muted-foreground"
                    : "bg-cobalt-tint text-cobalt"
                }`}
              >
                {initials(u.name, u.email)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{u.name ?? u.email}</span>
                  {isSelf ? (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  ) : null}
                  <span className="rounded-full bg-cobalt-tint px-2 py-0.5 text-xs font-semibold text-cobalt">
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                  {deactivated ? (
                    <span className="rounded-full bg-cloud px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      Deactivated
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {u.name ? `${u.email} · ` : ""}
                  {u.scope}
                </div>
              </div>
              <RoleControl
                user={{ id: u.id, role: u.role as "DSL" | "DIRECTOR" | "ADMIN" }}
                schools={data.schools}
                isSelf={isSelf}
              />
              <StatusControl
                user={{ id: u.id, status: u.status }}
                isSelf={isSelf}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
