import { cn } from "@/lib/utils";

// A sealed pupil's avatar: a cobalt-tinted disc showing the reference's number,
// never a photo and never a name (DESIGN.md: initials avatars, no pupil photos).
// It gives a row a visual anchor while the identity stays sealed.
export function SealedAvatar({
  refLabel,
  className,
}: {
  refLabel: string;
  className?: string;
}) {
  const digits = refLabel.replace(/\D/g, "");
  const code = digits ? digits.slice(-2).padStart(2, "0") : "SW";
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-cobalt-tint text-xs font-semibold tabular-nums text-cobalt",
        className,
      )}
    >
      {code}
    </span>
  );
}
