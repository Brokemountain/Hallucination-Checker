"use client";

import { useMemo, useRef, useState } from "react";

import type { ReviewExportArtifact, ReviewSession } from "../lib/legal-review/contracts";

type UploadResponse = {
  session?: ReviewSession;
  artifact?: ReviewExportArtifact;
  error?: {
    message?: string;
  };
};

async function parseJson(response: Response) {
  const payload = (await response.json()) as UploadResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "The review request failed.");
  }

  return payload;
}

export function ReviewIntake() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [matterName, setMatterName] = useState("New citation review");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [artifact, setArtifact] = useState<ReviewExportArtifact | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileSummary = useMemo(
    () =>
      files.length
        ? `${files.length} file${files.length === 1 ? "" : "s"} queued`
        : "PDF, DOCX, TXT, Markdown, or HTML",
    [files.length],
  );

  function addFiles(nextFiles: FileList | File[]) {
    setFiles((current) => {
      const incoming = Array.from(nextFiles);
      const unique = incoming.filter(
        (file) =>
          !current.some(
            (existing) => existing.name === file.name && existing.size === file.size,
          ),
      );

      return [...current, ...unique].slice(0, 10);
    });
    setArtifact(null);
    setError(null);
  }

  function loadSample() {
    setMatterName("Mata v. Avianca sample review");
    setNotes(
      "The draft argues that a federal court may rely on Varghese v. China Southern Airlines, 925 F.3d 1339 (11th Cir. 2019), for a tolling rule under the Montreal Convention. It also cites Martinez v. Delta Airlines, 2019 WL 4639462, for the same proposition. The pleading standard is framed through Ashcroft v. Iqbal, 556 U.S. 662 (2009).",
    );
    setFiles([]);
    setArtifact(null);
    setError(null);
  }

  async function createSession() {
    if (!files.length && !notes.trim()) {
      setError("Drop a file or paste text before starting.");
      return;
    }

    setPending("Creating review session");
    setError(null);
    setArtifact(null);

    try {
      const formData = new FormData();
      formData.append("matterName", matterName.trim() || "New citation review");
      formData.append("owner", "BYOK user");

      for (const file of files) {
        formData.append("files", file);
      }

      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }

      const payload = await parseJson(
        await fetch("/api/review-sessions/upload", {
          method: "POST",
          body: formData,
        }),
      );

      setSession(payload.session ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Upload failed.");
    } finally {
      setPending(null);
    }
  }

  async function runAction(action: "verify" | "support") {
    if (!session) {
      return;
    }

    setPending(action === "verify" ? "Verifying authorities" : "Reviewing support");
    setError(null);
    setArtifact(null);

    try {
      const payload = await parseJson(
        await fetch(`/api/review-sessions/${session.id}/${action}`, {
          method: "POST",
        }),
      );

      setSession(payload.session ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Review action failed.");
    } finally {
      setPending(null);
    }
  }

  async function exportHtml() {
    if (!session) {
      return;
    }

    setPending("Building HTML export");
    setError(null);

    try {
      const payload = await parseJson(
        await fetch(`/api/review-sessions/${session.id}/export`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ format: "html" }),
        }),
      );

      setSession(payload.session ?? session);
      setArtifact(payload.artifact ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Export failed.");
    } finally {
      setPending(null);
    }
  }

  const statusLine =
    session && session.metrics.totalCitations === 0
      ? "No citations were detected. Add a citation list, use a text-based file, or paste the relevant legal references."
      : session
        ? `${session.summary}. Phase: ${session.phase.replaceAll("_", " ")}. Readiness ${session.metrics.readinessScore}%.`
        : "";

  return (
    <div className="review-intake">
      <div className="review-intake-head">
        <p className="section-kicker">Start A Review</p>
        <h2>Drop files or notes here.</h2>
        <p>
          PDF, DOCX, TXT, Markdown, or HTML. Create a session, verify citations,
          check support, then export without leaving the page.
        </p>
      </div>

      <form
        className="upload-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void createSession();
        }}
      >
        <label>
          Matter name
          <input
            onChange={(event) => setMatterName(event.target.value)}
            type="text"
            value={matterName}
          />
        </label>

        <button
          className="drop-zone"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
          type="button"
        >
          <strong>Drop files here</strong>
          <span>{fileSummary}</span>
        </button>

        <input
          ref={inputRef}
          accept=".pdf,.docx,.txt,.md,.markdown,.html,.htm,text/plain,text/markdown,text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden-file-input"
          multiple
          onChange={(event) => {
            if (event.target.files) {
              addFiles(event.target.files);
              event.currentTarget.value = "";
            }
          }}
          type="file"
        />

        {files.length ? (
          <div className="file-list">
            {files.map((file, index) => (
              <button
                key={`${file.name}-${file.size}`}
                onClick={() =>
                  setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }
                type="button"
              >
                {file.name}
              </button>
            ))}
          </div>
        ) : null}

        <label>
          Or paste text
          <textarea
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Paste a brief excerpt, memo section, or citation list."
            value={notes}
          />
        </label>

        <button className="sample-button" onClick={loadSample} type="button">
          No file yet? Load AI-citation sample
        </button>

        <div className="review-actions">
          <button disabled={Boolean(pending)} type="submit">
            Create Session
          </button>
          <button
            disabled={!session || Boolean(pending)}
            onClick={() => void runAction("verify")}
            type="button"
          >
            Verify
          </button>
          <button
            disabled={!session || Boolean(pending)}
            onClick={() => void runAction("support")}
            type="button"
          >
            Support
          </button>
          <button disabled={!session || Boolean(pending)} onClick={() => void exportHtml()} type="button">
            Export
          </button>
        </div>

        <div className="review-status">
          {pending ? <p>{pending}</p> : null}
          {error ? <p className="review-error">{error}</p> : null}
          {statusLine ? <p>{statusLine}</p> : null}
          {artifact ? <p>{artifact.fileName} is ready.</p> : null}
        </div>

        {session ? (
          <div className="citation-preview">
            <div className="citation-preview-head">
              <strong>Citations</strong>
              <span>{session.metrics.totalCitations} total</span>
            </div>
            {session.metrics.totalCitations === 0 ? (
              <p className="empty-citation-note">No citation candidates found in this session.</p>
            ) : (
              session.documents.flatMap((document) =>
                document.citations.slice(0, 8).map((citation) => (
                  <div className="citation-preview-row" key={citation.id}>
                    <span className={`mini-status mini-status-${citation.status}`} />
                    <div>
                      <strong>{citation.reference}</strong>
                      <p>
                        {citation.status.replaceAll("_", " ")} ·{" "}
                        {citation.supportVerdict.replaceAll("_", " ")}
                      </p>
                    </div>
                  </div>
                )),
              )
            )}
          </div>
        ) : null}
      </form>
    </div>
  );
}
