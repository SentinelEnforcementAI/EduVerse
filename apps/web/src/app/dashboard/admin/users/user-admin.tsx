"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/trpc/react";

type Role = "DSL" | "DIRECTOR" | "ADMIN";
type School = { id: string; name: string };

const ROLE_LABEL: Record<Role, string> = {
  DSL: "DSL",
  DIRECTOR: "Director",
  ADMIN: "Admin",
};

const selectClass =
  "rounded-md border border-cloud bg-card px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Invite (provision) a new account. Sign-in stays invite-only: this creates the
// account, the person then requests a magic link.
export function InviteForm({ schools }: { schools: School[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("DSL");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");

  const invite = api.admin.invite.useMutation({
    onSuccess: () => {
      setEmail("");
      setName("");
      router.refresh();
    },
  });

  const needsSchool = role === "DSL";
  const disabled =
    invite.isPending ||
    email.trim().length === 0 ||
    (needsSchool && !schoolId);

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Invite an account</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Creates the account. They then request a sign-in link at the app.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@school.org.uk"
            className={`${selectClass} w-64`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Name (optional)
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${selectClass} w-48`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={selectClass}
          >
            <option value="DSL">DSL (a school)</option>
            <option value="DIRECTOR">Director (whole trust)</option>
            <option value="ADMIN">Admin (whole trust)</option>
          </select>
        </label>
        {needsSchool ? (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            School
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className={selectClass}
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button
          size="sm"
          disabled={disabled}
          onClick={() =>
            invite.mutate({
              email,
              name: name.trim() || undefined,
              role,
              schoolId: needsSchool ? schoolId : undefined,
            })
          }
        >
          <UserPlus className="size-4" aria-hidden />
          {invite.isPending ? "Inviting…" : "Invite"}
        </Button>
      </div>
      {invite.error ? (
        <p className="mt-2 text-sm text-risk">{invite.error.message}</p>
      ) : null}
    </Card>
  );
}

// Per-row role change. The scope moves with the role: a DSL needs a school.
export function RoleControl({
  user,
  schools,
  isSelf,
}: {
  user: { id: string; role: Role };
  schools: School[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(user.role);
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const setRoleMut = api.admin.setRole.useMutation({
    onSuccess: () => router.refresh(),
  });

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</span>;
  }

  const changed = role !== user.role;
  const needsSchool = role === "DSL";

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className={selectClass}
        aria-label="Role"
      >
        <option value="DSL">DSL</option>
        <option value="DIRECTOR">Director</option>
        <option value="ADMIN">Admin</option>
      </select>
      {changed && needsSchool ? (
        <select
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          className={selectClass}
          aria-label="School"
        >
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      ) : null}
      {changed ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={setRoleMut.isPending}
          onClick={() =>
            setRoleMut.mutate({
              userId: user.id,
              role,
              schoolId: needsSchool ? schoolId : undefined,
            })
          }
        >
          Save
        </Button>
      ) : null}
    </div>
  );
}

// Per-row deactivate / reactivate.
export function StatusControl({
  user,
  isSelf,
}: {
  user: { id: string; status: "ACTIVE" | "DEACTIVATED" };
  isSelf: boolean;
}) {
  const router = useRouter();
  const setStatus = api.admin.setStatus.useMutation({
    onSuccess: () => router.refresh(),
  });

  if (isSelf) return null;

  const next = user.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={setStatus.isPending}
      onClick={() => setStatus.mutate({ userId: user.id, status: next })}
    >
      {user.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
