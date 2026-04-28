import { ByokPanel } from "../components/byok-panel";
import { ReviewIntake } from "../components/review-intake";

const toolNotes = [
  "Open source",
  "Open access",
  "BYOK",
  "No shared platform key",
];

const workflow = [
  "Drop draft or paste notes",
  "Verify authorities",
  "Review support",
  "Export packet",
];

export default function Home() {
  return (
    <main className="legalcheck-tool">
      <div
        className="tool-backdrop"
        role="img"
        aria-label="Monochrome illustrated city skyline beside a river."
      />
      <div className="tool-backdrop-tint" aria-hidden="true" />

      <header className="tool-header">
        <a className="tool-brand" href="#review">
          <span className="tool-badge">LC</span>
          <span>LegalCheck</span>
        </a>
        <nav className="tool-nav" aria-label="Primary">
          <a href="#review">Review</a>
          <a href="#byok">BYOK</a>
          <a href="/api/legal-review/capabilities">API</a>
        </nav>
      </header>

      <section className="tool-shell" id="review">
        <div className="tool-lead">
          <div>
            <p className="section-kicker">Citation Review Tool</p>
            <h1>Drop a draft. Bring your key. Check the citations.</h1>
          </div>
          <div className="tool-badges" aria-label="Project model">
            {toolNotes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        </div>

        <div className="tool-grid">
          <ReviewIntake />

          <aside className="tool-side">
            <section className="side-card" id="byok">
              <div className="side-card-head">
                <p className="section-kicker">BYOK</p>
                <h2>Your provider, your usage.</h2>
                <p>
                  Paste a key to prepare the provider-backed path. The current
                  deterministic review still runs without a hosted account.
                </p>
              </div>
              <ByokPanel />
            </section>

            <section className="side-card side-card-plain">
              <p className="section-kicker">Flow</p>
              <ol className="workflow-list">
                {workflow.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
