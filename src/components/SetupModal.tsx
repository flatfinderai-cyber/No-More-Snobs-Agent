import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Eye, EyeSlash, X } from "@phosphor-icons/react";

interface Props {
  onComplete: (configured: boolean) => void;
}

export default function SetupModal({ onComplete }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!apiKey.trim().startsWith("sk-ant-")) {
      setError("That doesn't look right. Your key should start with sk-ant-");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await invoke("save_api_key", { key: apiKey.trim() });
      onComplete(true);
    } catch (err) {
      setError("Couldn't save the key. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 relative">
        <button
          onClick={() => onComplete(false)}
          className="absolute top-4 right-4 text-snobs-muted hover:text-snobs-text transition-colors"
        >
          <X weight="light" size={20} />
        </button>

        <h2 className="text-xl font-bold text-snobs-text mb-1">Get started</h2>
        <p className="text-sm text-snobs-muted mb-6 leading-relaxed">
          Paste your Anthropic key below. It's stored securely in your system's keychain — not in any file we can see.
        </p>

        <label className="block text-xs font-semibold text-snobs-text uppercase tracking-wider mb-2">
          Anthropic Key
        </label>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-…"
            className="w-full border border-snobs-border rounded-lg px-4 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-snobs-green text-snobs-text placeholder:text-snobs-muted"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-snobs-muted hover:text-snobs-text transition-colors"
          >
            {showKey ? <EyeSlash weight="light" size={16} /> : <Eye weight="light" size={16} />}
          </button>
        </div>

        {error && (
          <p className="text-xs text-snobs-red mt-2">{error}</p>
        )}

        <p className="text-xs text-snobs-muted mt-3 mb-6 leading-relaxed">
          Don't have one?{" "}
          <a
            href="https://console.anthropic.com"
            className="underline hover:text-snobs-text transition-colors"
            target="_blank"
            rel="noreferrer"
          >
            Get it here
          </a>{" "}
          — takes two minutes.
        </p>

        <button
          onClick={handleSave}
          disabled={!apiKey.trim() || saving}
          className="w-full py-2.5 rounded-lg bg-snobs-text text-white font-semibold text-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-80"
        >
          {saving ? "Saving…" : "Save & continue"}
        </button>
      </div>
    </div>
  );
}
