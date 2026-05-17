import { useState } from "react";
import { Trash, ToggleLeft, ToggleRight, BookOpen } from "@phosphor-icons/react";
import { Skill } from "../types";

interface Props {
  skills: Skill[];
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function SkillLibraryPanel({ skills, onToggle, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setConfirmDelete(id);
  };

  const handleConfirmDelete = (id: string) => {
    onDelete(id);
    setConfirmDelete(null);
  };

  return (
    <div className="bg-white rounded-xl border border-snobs-border flex flex-col p-5 gap-4 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-snobs-muted uppercase tracking-widest">
          Skill Library
        </h2>
        <span className="text-xs text-snobs-muted">{skills.length} skill{skills.length !== 1 ? "s" : ""}</span>
      </div>

      {skills.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <BookOpen weight="duotone" size={32} className="text-snobs-muted opacity-40" />
          <div>
            <p className="text-sm font-medium text-snobs-muted">No skills yet</p>
            <p className="text-xs text-snobs-muted mt-1 opacity-70">Skills appear here as the factory learns from your tasks.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto -mr-2 pr-2 flex flex-col gap-2 min-h-0">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className={`rounded-lg border p-3 transition-opacity ${skill.enabled ? "border-snobs-border" : "border-snobs-border opacity-50"}`}
            >
              {confirmDelete === skill.id ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-snobs-red font-medium">Remove "{skill.name}"?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirmDelete(skill.id)}
                      className="text-xs px-2.5 py-1 rounded bg-snobs-red text-white font-medium hover:opacity-90"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-xs px-2.5 py-1 rounded bg-gray-100 text-snobs-muted font-medium hover:bg-gray-200"
                    >
                      Keep
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-snobs-text leading-tight">{skill.name}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => onToggle(skill.id, !skill.enabled)}
                        className="text-snobs-muted hover:text-snobs-text transition-colors"
                        title={skill.enabled ? "Disable" : "Enable"}
                      >
                        {skill.enabled
                          ? <ToggleRight weight="duotone" size={20} className="text-snobs-green" />
                          : <ToggleLeft weight="duotone" size={20} />
                        }
                      </button>
                      <button
                        onClick={() => handleDeleteClick(skill.id)}
                        className="text-snobs-muted hover:text-snobs-red transition-colors"
                        title="Remove skill"
                      >
                        <Trash weight="light" size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-snobs-muted leading-relaxed mb-2">{skill.description}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-snobs-muted">Used {skill.timesUsed}×</span>
                    <span className="text-[10px] text-snobs-muted">Last: {formatDate(skill.lastUsed)}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
