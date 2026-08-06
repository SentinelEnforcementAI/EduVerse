import { cn } from "@/lib/utils";

// A quiet loading placeholder: a soft pulsing block in the cloud tone. Used to
// build page-level loading skeletons so a navigation never shows a blank white
// area or a raw spinner.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-cloud/70", className)}
      {...props}
    />
  );
}

export { Skeleton };
