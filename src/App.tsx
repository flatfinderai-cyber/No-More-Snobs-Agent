import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import MissionPanel from "./components/MissionPanel";
import LiveStatusPanel from "./components/LiveStatusPanel";
import SkillLibraryPanel from "./components/SkillLibraryPanel";
import OutputPanel from "./components/OutputPanel";
import SetupModal from "./components/SetupModal";
import { AgentStatus, Deliverable, Skill } from "./types";

const DEFAULT_STATUS: AgentStatus = {
  currentTask: "Ready when you are.",
  tokenSpendToday: 0,
  tokenSpendMonth: 0,
  uptimeSeconds: 0,
  health: "green",
  isRunning: false,
  dailyTokenCap: 100000,
};

export default function App() {
  const [mission, setMission] = useState("");
  const [status, setStatus] = useState<AgentStatus>(DEFAULT_STATUS);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    invoke<boolean>("check_api_key").then((configured) => {
      setApiKeyConfigured(configured);
      if (!configured) setShowSetup(true);
    });

    invoke<Skill[]>("get_skills").then(setSkills).catch(console.error);
    invoke<Deliverable[]>("get_deliverables").then(setDeliverables).catch(console.error);
    invoke<AgentStatus>("get_status").then(setStatus).catch(console.error);

    const unlistenStatus = listen<AgentStatus>("status_update", (e) => {
      setStatus(e.payload);
    });

    const unlistenSkillAdded = listen<Skill>("skill_added", (e) => {
      setSkills((prev) => {
        const exists = prev.find((s) => s.id === e.payload.id);
        if (exists) return prev.map((s) => (s.id === e.payload.id ? e.payload : s));
        return [e.payload, ...prev];
      });
    });

    const unlistenDeliverable = listen<Deliverable>("deliverable_ready", (e) => {
      setDeliverables((prev) => [e.payload, ...prev]);
    });

    return () => {
      unlistenStatus.then((f) => f());
      unlistenSkillAdded.then((f) => f());
      unlistenDeliverable.then((f) => f());
    };
  }, []);

  const handleStart = useCallback(async () => {
    if (!mission.trim() || !apiKeyConfigured) return;
    try {
      await invoke("start_task", { mission: mission.trim() });
    } catch (err) {
      console.error("Failed to start task:", err);
    }
  }, [mission, apiKeyConfigured]);

  const handleStop = useCallback(async () => {
    try {
      await invoke("stop_task");
    } catch (err) {
      console.error("Failed to stop task:", err);
    }
  }, []);

  const handleToggleSkill = useCallback(async (skillId: string, enabled: boolean) => {
    try {
      await invoke("toggle_skill", { skillId, enabled });
      setSkills((prev) =>
        prev.map((s) => (s.id === skillId ? { ...s, enabled } : s))
      );
    } catch (err) {
      console.error("Failed to toggle skill:", err);
    }
  }, []);

  const handleDeleteSkill = useCallback(async (skillId: string) => {
    try {
      await invoke("delete_skill", { skillId });
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
    } catch (err) {
      console.error("Failed to delete skill:", err);
    }
  }, []);

  const handleSetupComplete = useCallback((configured: boolean) => {
    setApiKeyConfigured(configured);
    setShowSetup(false);
  }, []);

  const handleTokenCapChange = useCallback(async (cap: number) => {
    try {
      await invoke("set_token_cap", { cap });
      setStatus((prev) => ({ ...prev, dailyTokenCap: cap }));
    } catch (err) {
      console.error("Failed to set token cap:", err);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-snobs-bg font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-snobs-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-snobs-text rounded-sm flex items-center justify-center">
            <span className="text-white text-xs font-bold">N</span>
          </div>
          <span className="font-semibold text-snobs-text text-sm tracking-tight">No More Snobs</span>
        </div>
        <button
          onClick={() => setShowSetup(true)}
          className="text-xs text-snobs-muted hover:text-snobs-text transition-colors"
        >
          Settings
        </button>
      </header>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 p-3 overflow-hidden">
        <MissionPanel
          mission={mission}
          onMissionChange={setMission}
          onStart={handleStart}
          onStop={handleStop}
          isRunning={status.isRunning}
          apiKeyConfigured={apiKeyConfigured}
          dailyTokenCap={status.dailyTokenCap}
          onTokenCapChange={handleTokenCapChange}
        />
        <LiveStatusPanel status={status} />
        <SkillLibraryPanel
          skills={skills}
          onToggle={handleToggleSkill}
          onDelete={handleDeleteSkill}
        />
        <OutputPanel deliverables={deliverables} />
      </div>

      {showSetup && (
        <SetupModal onComplete={handleSetupComplete} />
      )}
    </div>
  );
}
