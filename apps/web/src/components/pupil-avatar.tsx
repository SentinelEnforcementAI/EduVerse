import { cn } from "@/lib/utils";

// Pupil identity (DESIGN.md v2): initials avatars generated from the name,
// cobalt-tinted. No photographs of children anywhere in the product.
export function PupilAvatar({
  firstName,
  lastName,
  className,
}: {
  firstName: string;
  lastName: string;
  className?: string;
}) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-cobalt-tint text-sm font-semibold text-cobalt",
        className,
      )}
    >
      {initials}
    </span>
  );
}
