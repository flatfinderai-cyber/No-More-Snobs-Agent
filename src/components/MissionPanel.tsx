import { Play, Square } from "@phosphor-icons/react";

interface Props {
  mission: string;
  onMissionChange: (v: string) => void;
  onStart: () => void;
  onStop: () => void;
  isRunning: boolean;
  apiKeyConfigured: boolean;
  dailyTokenCap: number;
  onTokenCapChange: (cap: number) => void;
}

const CAP_MIN = 10_000;
const CAP_MAX = 1_000_000;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export default function MissionPanel({
  mission,
  onMissionChange,
  onStart,
  onStop,
  isRunning,
  apiKeyConfigured,
  dailyTokenCap,
  onTokenCapChange,
}: Props) {
  const canStart = mission.trim().length > 0 && apiKeyConfigured && !isRunning;

  return (
    <div className="bg-white rounded-xl border border-snobs-border flex flex-col p-5 gap-4 overflow-hidden">
      <h2 className="text-sm font-semibold text-snobs-muted uppercase tracking-widest">
        Mission
      </h2>

      <textarea
        className="flex-1 resize-none text-base text-snobs-text placeholder:text-snobs-muted focus:outline-none font-sans leading-relaxed"
        placeholder="What do you want the factory to do?"
        value={mission}
        onChange={(e) => onMissionChange(e.target.value)}
        disabled={isRunning}
      />

      <div className="flex gap-3">
        <button
          onClick={onStart}
          disabled={!canStart}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-snobs-green text-white font-semibold text-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
        >
          <Play weight="fill" size={16} />
          Start
        </button>
        <button
          onClick={onStop}
          disabled={!isRunning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-snobs-red text-white font-semibold text-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
        >
          <Square weight="fill" size={16} />
          Stop
        </button>
      </div>

      {/* Daily limit slider */}
      <div className="border-t border-snobs-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-snobs-muted">Daily limit</span>
          <span className="text-xs font-medium text-snobs-text">{formatTokens(dailyTokenCap)}</span>
        </div>
        <input
          type="range"
          min={CAP_MIN}
          max={CAP_MAX}
          step={10_000}
          value={dailyTokenCap}
          onChange={(e) => onTokenCapChange(Number(e.target.value))}
          className="w-full h-1.5 accent-snobs-green cursor-pointer"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-snobs-muted">{formatTokens(CAP_MIN)}</span>
          <span className="text-[10px] text-snobs-muted">{formatTokens(CAP_MAX)}</span>
        </div>
      </div>
    </div>
  );
}
