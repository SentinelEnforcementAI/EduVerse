"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

const inputClass =
  "rounded-md border border-cloud bg-card px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Add a school to the trust during onboarding. Creating a school is a trust
// administrator action; a new school is a new tenant with the same row-level
// security as every other.
export function AddSchoolForm() {
  const router = useRouter();
  const [name, setName] = useState("");

  const addSchool = api.admin.addSchool.useMutation({
    onSuccess: () => {
      setName("");
      router.refresh();
    },
  });

  const disabled = addSchool.isPending || name.trim().length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          School name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Downlands"
            className={`${inputClass} w-64`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !disabled) addSchool.mutate({ name });
            }}
          />
        </label>
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => addSchool.mutate({ name })}
        >
          <Plus className="size-4" aria-hidden />
          {addSchool.isPending ? "Adding…" : "Add school"}
        </Button>
      </div>
      {addSchool.error ? (
        <p className="mt-2 text-sm text-risk">{addSchool.error.message}</p>
      ) : null}
    </div>
  );
}
