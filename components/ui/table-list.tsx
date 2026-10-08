import * as React from "react";
import { cn } from "@/lib/utils";

export function DataList({ className, ...props }: React.HTMLAttributes<HTMLDListElement>) {
  return <dl className={cn("grid gap-3 text-sm sm:grid-cols-2", className)} {...props} />;
}

export function DataItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-base">{children}</dd>
    </div>
  );
}
