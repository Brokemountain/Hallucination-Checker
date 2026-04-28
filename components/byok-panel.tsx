"use client";

import { useEffect, useState } from "react";

const storageKey = "legalcheck:byok";

type StoredKey = {
  provider: string;
  key: string;
  remember: boolean;
};

function readStoredKey(): StoredKey | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue =
    window.sessionStorage.getItem(storageKey) ?? window.localStorage.getItem(storageKey);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredKey;
  } catch {
    return null;
  }
}

export function ByokPanel() {
  const [provider, setProvider] = useState("OpenAI");
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState("No key loaded");

  useEffect(() => {
    const stored = readStoredKey();

    if (!stored) {
      return;
    }

    setProvider(stored.provider);
    setApiKey(stored.key);
    setRemember(stored.remember);
    setStatus(`${stored.provider} key ready in this browser`);
  }, []);

  async function saveKey() {
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      setStatus("Paste a provider key first");
      return;
    }

    setStatus(`Validating ${provider} key...`);

    try {
      const response = await fetch("/api/byok/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          apiKey: trimmedKey,
        }),
      });
      const payload = (await response.json()) as {
        valid?: boolean;
        message?: string;
        error?: {
          message?: string;
        };
      };

      if (!response.ok || !payload.valid) {
        setStatus(payload.message ?? payload.error?.message ?? "This key is not valid.");
        return;
      }
    } catch {
      setStatus("Could not validate this key. Check your connection and provider.");
      return;
    }

    const payload = JSON.stringify({
      provider,
      key: trimmedKey,
      remember,
    } satisfies StoredKey);

    window.sessionStorage.setItem(storageKey, payload);

    if (remember) {
      window.localStorage.setItem(storageKey, payload);
    } else {
      window.localStorage.removeItem(storageKey);
    }

    setApiKey(trimmedKey);
    setStatus(`${provider} key validated and ready in this browser`);
  }

  function clearKey() {
    window.sessionStorage.removeItem(storageKey);
    window.localStorage.removeItem(storageKey);
    setApiKey("");
    setRemember(false);
    setStatus("No key loaded");
  }

  return (
    <form
      className="byok-panel"
      onSubmit={(event) => {
        event.preventDefault();
        void saveKey();
      }}
    >
      <label>
        Provider
        <select value={provider} onChange={(event) => setProvider(event.target.value)}>
          <option>OpenAI</option>
          <option>Anthropic</option>
          <option>Google AI</option>
          <option>OpenRouter</option>
          <option>Local endpoint</option>
        </select>
      </label>

      <label>
        API key
        <input
          autoComplete="off"
          inputMode="text"
          name="apiKey"
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Paste your key"
          type="password"
          value={apiKey}
        />
      </label>

      <label className="byok-toggle">
        <input
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          type="checkbox"
        />
        Remember on this device
      </label>

      <div className="byok-actions">
        <button type="submit">Validate Key</button>
        <button className="button-ghost" onClick={clearKey} type="button">
          Clear
        </button>
      </div>

      <p className="byok-status">{status}</p>
    </form>
  );
}
