import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// DESIGN.md v2 buttons: primary = cobalt fill / white text; secondary =
// white with cloud border and ink text; destructive-adjacent actions
// (Dismiss) = ink outline, never red — red is for children at risk, not UI
// actions. All targets ≥ 44px; cobalt 2px focus ring; 150ms transitions.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-cobalt-deep",
        destructive:
          "border border-ink bg-transparent text-ink hover:bg-cloud/60",
        outline: "border border-cloud bg-card text-ink hover:bg-accent",
        secondary: "border border-cloud bg-card text-ink hover:bg-accent",
        ghost: "hover:bg-cloud/60 hover:text-accent-foreground",
        link: "text-cobalt underline-offset-4 hover:underline",
      },
      size: {
        // Accessibility floor: touch targets ≥ 44px.
        default: "h-11 px-5 py-2",
        sm: "h-11 rounded-md px-4",
        lg: "h-12 rounded-md px-8",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
