import { useState, useMemo } from "react";
import { FolderOpen, Copy, PaperPlaneTilt, FunnelSimple, CheckCircle } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { Deliverable } from "../types";

interface Props {
  deliverables: Deliverable[];
}

type Filter = { mission: string; date: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function OutputPanel({ deliverables }: Props) {
  const [filter, setFilter] = useState<Filter>({ mission: "", date: "" });
  const [showFilter, setShowFilter] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const uniqueMissions = useMemo(
    () => Array.from(new Set(deliverables.map((d) => d.mission))),
    [deliverables]
  );

  const filtered = useMemo(() => {
    return deliverables.filter((d) => {
      if (filter.mission && d.mission !== filter.mission) return false;
      if (filter.date) {
        const dDate = new Date(d.createdAt).toISOString().split("T")[0];
        if (dDate !== filter.date) return false;
      }
      return true;
    });
  }, [deliverables, filter]);

  const handleOpen = async (deliverable: Deliverable) => {
    if (deliverable.filepath) {
      await invoke("open_file", { path: deliverable.filepath });
    }
  };

  const handleCopy = async (deliverable: Deliverable) => {
    await navigator.clipboard.writeText(deliverable.content);
    setCopiedId(deliverable.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (deliverable: Deliverable) => {
    await invoke("share_deliverable", { id: deliverable.id });
  };

  return (
    <div className="bg-white rounded-xl border border-snobs-border flex flex-col p-5 gap-4 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-snobs-muted uppercase tracking-widest">
          Output
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-snobs-muted">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`transition-colors ${showFilter ? "text-snobs-text" : "text-snobs-muted hover:text-snobs-text"}`}
            title="Filter"
          >
            <FunnelSimple weight={showFilter ? "duotone" : "light"} size={16} />
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="flex gap-2 flex-shrink-0">
          <select
            className="flex-1 text-xs border border-snobs-border rounded-lg px-2.5 py-1.5 bg-white text-snobs-text focus:outline-none focus:ring-1 focus:ring-snobs-green"
            value={filter.mission}
            onChange={(e) => setFilter((f) => ({ ...f, mission: e.target.value }))}
          >
            <option value="">All missions</option>
            {uniqueMissions.map((m) => (
              <option key={m} value={m}>{m.slice(0, 40)}{m.length > 40 ? "…" : ""}</option>
            ))}
          </select>
          <input
            type="date"
            className="text-xs border border-snobs-border rounded-lg px-2.5 py-1.5 bg-white text-snobs-text focus:outline-none focus:ring-1 focus:ring-snobs-green"
            value={filter.date}
            onChange={(e) => setFilter((f) => ({ ...f, date: e.target.value }))}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <FolderOpen weight="duotone" size={32} className="text-snobs-muted opacity-40" />
          <div>
            <p className="text-sm font-medium text-snobs-muted">Nothing here yet</p>
            <p className="text-xs text-snobs-muted mt-1 opacity-70">Finished work will appear here when the factory is done.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto -mr-2 pr-2 flex flex-col gap-3 min-h-0">
          {filtered.map((d) => (
            <div key={d.id} className="rounded-lg border border-snobs-border p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-snobs-text leading-tight truncate">{d.title}</p>
                  <p className="text-[10px] text-snobs-muted mt-0.5">{formatDate(d.createdAt)}</p>
                </div>
                {d.score !== undefined && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${d.score >= 80 ? "bg-green-50 text-snobs-green" : d.score >= 60 ? "bg-amber-50 text-snobs-amber" : "bg-red-50 text-snobs-red"}`}>
                    {d.score}/100
                  </span>
                )}
              </div>
              <p className="text-xs text-snobs-muted line-clamp-2 leading-relaxed mb-2.5">
                {d.content.slice(0, 200)}{d.content.length > 200 ? "…" : ""}
              </p>
              <div className="flex items-center gap-2">
                {d.filepath && (
                  <button
                    onClick={() => handleOpen(d)}
                    className="flex items-center gap-1.5 text-[11px] text-snobs-muted hover:text-snobs-text transition-colors font-medium"
                  >
                    <FolderOpen weight="duotone" size={13} />
                    Open
                  </button>
                )}
                <button
                  onClick={() => handleCopy(d)}
                  className="flex items-center gap-1.5 text-[11px] text-snobs-muted hover:text-snobs-text transition-colors font-medium"
                >
                  {copiedId === d.id
                    ? <><CheckCircle weight="duotone" size={13} className="text-snobs-green" /> Copied</>
                    : <><Copy weight="light" size={13} /> Copy</>
                  }
                </button>
                <button
                  onClick={() => handleSend(d)}
                  className="flex items-center gap-1.5 text-[11px] text-snobs-muted hover:text-snobs-text transition-colors font-medium"
                >
                  <PaperPlaneTilt weight="light" size={13} />
                  Send to…
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
