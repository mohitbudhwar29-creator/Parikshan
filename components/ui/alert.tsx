import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed", {
  variants: {
    variant: {
      default: "border-border bg-card text-foreground",
      info: "border-info/30 bg-info-soft text-foreground",
      warning: "border-warning/40 bg-warning-soft text-foreground",
      success: "border-success/30 bg-success-soft text-foreground",
      attention: "border-attention/40 bg-attention-soft text-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Alert({ className, variant, role, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role={role ?? "note"} className={cn(alertVariants({ variant }), className)} {...props} />;
}
