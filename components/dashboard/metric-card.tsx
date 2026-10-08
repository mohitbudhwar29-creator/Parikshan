import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ValueFlag } from "@/types/health";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetricCard({
  icon,
  label,
  value,
  unit,
  flagBadge,
  lines,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  flag?: ValueFlag;
  flagBadge?: ReactNode;
  lines: string[];
  tone?: "default" | "attention";
}) {
  return (
    <Card className={cn(tone === "attention" && "border-attention/40")}>
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <span className="text-primary">{icon}</span>
            {label}
          </p>
          {flagBadge}
        </div>
        <p className="text-3xl font-bold tracking-tight">
          {value}
          {unit ? <span className="ml-1 text-base font-medium text-muted-foreground">{unit}</span> : null}
        </p>
        <div className="mt-auto space-y-1 text-sm text-muted-foreground">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function FlagPill({ flag, labels }: { flag: ValueFlag; labels: { high: string; low: string; normal: string; unknown: string } }) {
  if (flag === "HIGH") return <Badge variant="attention">{labels.high}</Badge>;
  if (flag === "LOW") return <Badge variant="attention">{labels.low}</Badge>;
  if (flag === "NORMAL") return <Badge variant="success">{labels.normal}</Badge>;
  return <Badge variant="neutral">{labels.unknown}</Badge>;
}
