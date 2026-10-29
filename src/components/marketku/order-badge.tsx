import { CheckCircle2 } from "lucide-react";
import { ORDER_LABEL } from "@/lib/market";

export function StatusBadge({ status }: { status: string }) {
  const cls = status === "completed" ? "bg-success/15 text-success" : status === "pending" ? "bg-warning/20 text-warning" : ["cancelled", "failed"].includes(status) ? "bg-destructive/10 text-destructive" : "bg-accent text-primary";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{status === "completed" && <CheckCircle2 className="mr-1 inline h-3 w-3" />}{ORDER_LABEL[status] ?? status}</span>;
}

