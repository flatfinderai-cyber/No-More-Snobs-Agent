export interface Skill {
  id: string;
  name: string;
  description: string;
  timesUsed: number;
  lastUsed: string | null;
  enabled: boolean;
  filename: string;
}

export interface Deliverable {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  mission: string;
  skillsUsed: string[];
  filepath?: string;
  score?: number;
}

export interface AgentStatus {
  currentTask: string;
  tokenSpendToday: number;
  tokenSpendMonth: number;
  uptimeSeconds: number;
  health: "green" | "amber" | "red";
  isRunning: boolean;
  dailyTokenCap: number;
}

export interface AppState {
  status: AgentStatus;
  skills: Skill[];
  deliverables: Deliverable[];
  apiKeyConfigured: boolean;
}

export type IpcEvent =
  | { type: "status_update"; payload: AgentStatus }
  | { type: "skill_added"; payload: Skill }
  | { type: "skill_updated"; payload: Skill }
  | { type: "deliverable_ready"; payload: Deliverable }
  | { type: "error"; payload: string };
