import { Timer, Coins, Activity } from "@phosphor-icons/react";
import { AgentStatus } from "../types";

interface Props {
  status: AgentStatus;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const HEALTH_COLOURS: Record<AgentStatus["health"], string> = {
  green: "bg-snobs-green",
  amber: "bg-snobs-amber",
  red: "bg-snobs-red",
};

const HEALTH_LABELS: Record<AgentStatus["health"], string> = {
  green: "All good",
  amber: "Working hard",
  red: "Needs attention",
};

export default function LiveStatusPanel({ status }: Props) {
  return (
    <div className="bg-white rounded-xl border border-snobs-border flex flex-col p-5 gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-snobs-muted uppercase tracking-widest">
          Live Status
        </h2>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${HEALTH_COLOURS[status.health]} ${status.isRunning ? "animate-pulse" : ""}`} />
          <span className="text-xs text-snobs-muted">{HEALTH_LABELS[status.health]}</span>
        </div>
      </div>

      {/* Current task */}
      <div className="flex-1 flex flex-col gap-1 min-h-0">
        <span className="text-[11px] font-medium text-snobs-muted uppercase tracking-wider">Right now</span>
        <p className="text-sm text-snobs-text leading-relaxed line-clamp-4">
          {status.currentTask}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 border-t border-snobs-border pt-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-snobs-muted">
            <Coins weight="duotone" size={14} />
            <span className="text-[10px] uppercase tracking-wider font-medium">Today</span>
          </div>
          <span className="text-sm font-semibold text-snobs-text">{formatTokens(status.tokenSpendToday)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-snobs-muted">
            <Activity weight="duotone" size={14} />
            <span className="text-[10px] uppercase tracking-wider font-medium">Month</span>
          </div>
          <span className="text-sm font-semibold text-snobs-text">{formatTokens(status.tokenSpendMonth)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-snobs-muted">
            <Timer weight="duotone" size={14} />
            <span className="text-[10px] uppercase tracking-wider font-medium">Uptime</span>
          </div>
          <span className="text-sm font-semibold text-snobs-text">{formatUptime(status.uptimeSeconds)}</span>
        </div>
      </div>
    </div>
  );
}
