import Image from "next/image";

import { cn } from "@/lib/utils";

// Brand lock-up: the supplied mark (never recreated — extracted from the
// brand system, /public/brand) beside the wordmark set in the product sans.
// Mark variant follows the surface: cobalt on light and ink surfaces per the
// brand sheet; white is available for photography/dark-marketing contexts.
export function BrandLockup({
  markVariant = "cobalt",
  wordmarkClassName,
  className,
}: {
  markVariant?: "cobalt" | "ink" | "white";
  wordmarkClassName?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src={`/brand/mark-${markVariant}.svg`}
        alt=""
        width={28}
        height={28}
        priority
      />
      <span
        className={cn("text-lg font-semibold tracking-tight", wordmarkClassName)}
      >
        Sentinel Watch
      </span>
    </span>
  );
}
