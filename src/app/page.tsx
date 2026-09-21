import Link from "next/link";

const securityPoints = [
  {
    number: "01",
    title: "Evidence before action",
    copy: "Every market view is grounded in current PreStocks pricing, company research, and explicit data quality checks.",
  },
  {
    number: "02",
    title: "Conservative by design",
    copy: "Missing data lowers confidence and borrowing capacity. The system can recommend no action instead of inventing certainty.",
  },
  {
    number: "03",
    title: "Solana-native settlement",
    copy: "Wallet connection and future lending actions are designed around user-owned assets and transparent on-chain state.",
  },
  {
    number: "04",
    title: "Auditable decisions",
    copy: "Research, risk inputs, and protocol assumptions are structured so teams can review how a decision was reached.",
  },
];

const docs = [
  { label: "Architecture", detail: "System map and boundaries", href: "/docs/ARCHITECTURE.md" },
  { label: "Lending protocol", detail: "Collateral, LTV, and settlement", href: "/LENDING_PROTOCOL.md" },
  { label: "Deployment guide", detail: "Environment and release notes", href: "/DEPLOYMENT_GUIDE.md" },
];

export default function Page() {
  return (
    <main className="landing-shell">
      <nav className="site-nav" aria-label="Primary navigation">
        <Link className="wordmark" href="/">
          <span className="wordmark-mark">A</span>
          <span>ANALA</span>
        </Link>
        <div className="nav-links">
          <a href="#overview">Overview</a>
          <a href="#security">Security</a>
          <a href="#documentation">Docs</a>
        </div>
        <Link className="button button-dark button-small" href="/lend">
          Launch app <span aria-hidden="true">-&gt;</span>
        </Link>
      </nav>

      <section className="landing-hero" id="overview">
        <div className="hero-copy">
          <p className="eyebrow">PRESTOCKS / SOLANA / RISK INFRASTRUCTURE</p>
          <h1>Private-market access, with a public standard.</h1>
          <p className="hero-lede">
            Anala is a research and lending layer for tokenized pre-IPO assets. It turns live market data,
            company signals, and protocol rules into a clear next action.
          </p>
          <div className="hero-actions">
            <Link className="button button-dark" href="/lend">
              Launch app <span aria-hidden="true">-&gt;</span>
            </Link>
            <a className="text-link" href="#documentation">
              Read the docs <span aria-hidden="true">-&gt;</span>
            </a>
          </div>
          <div className="hero-note">
            <span className="status-dot" aria-hidden="true" />
            <span>Research mode is live. Missing data is treated as no trade.</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Anala system overview">
          <div className="visual-header">
            <span>ANALA / SYSTEM VIEW</span>
            <span className="visual-live">LIVE</span>
          </div>
          <div className="visual-main">
            <p className="visual-kicker">Decision surface</p>
            <p className="visual-value">01</p>
            <p className="visual-caption">signal, risk, settlement</p>
          </div>
          <div className="visual-rows">
            <div><span>Market data</span><strong>CONNECTED</strong></div>
            <div><span>Research quality</span><strong>CHECKED</strong></div>
            <div><span>Wallet state</span><strong>USER CONTROLLED</strong></div>
          </div>
          <div className="visual-rule" />
          <div className="visual-footer">
            <span>DATA PROVENANCE</span>
            <span>PRESTOCKS API</span>
          </div>
        </div>
      </section>

      <section className="intro-section section-rule">
        <div className="section-heading">
          <p className="eyebrow">THE PLATFORM</p>
          <h2>Clarity for a new market category.</h2>
        </div>
        <div className="intro-grid">
          <article className="intro-block">
            <span className="block-index">01 / WHAT IT IS</span>
            <h3>A decision layer for tokenized private companies.</h3>
            <p>
              Anala brings PreStocks instruments, live pricing, company research, and lending constraints into one
              operating surface. It is built to make every decision legible before capital moves.
            </p>
          </article>
          <article className="intro-block">
            <span className="block-index">02 / WHO IT IS FOR</span>
            <h3>For operators who want context, not noise.</h3>
            <p>
              Use it to research emerging companies, evaluate collateral quality, and prepare a lending position from
              a connected Solana wallet. Built for deliberate investors, treasury teams, and protocol contributors.
            </p>
          </article>
        </div>
      </section>

      <section className="security-section section-rule" id="security">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow">SECURITY MODEL</p>
            <h2>Trust is a workflow.</h2>
          </div>
          <p className="section-summary">
            Anala keeps its assumptions visible. The interface separates evidence, confidence, and execution so users
            can make informed choices at every step.
          </p>
        </div>
        <div className="security-grid">
          {securityPoints.map((point) => (
            <article className="security-item" key={point.number}>
              <span className="block-index">{point.number}</span>
              <h3>{point.title}</h3>
              <p>{point.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="launch-section">
        <div className="launch-panel">
          <div>
            <p className="eyebrow">READY WHEN YOU ARE</p>
            <h2>Bring your wallet to the desk.</h2>
            <p>Explore available PreStocks collateral, review the risk readout, and stage a lending position.</p>
          </div>
          <Link className="button button-light" href="/lend">
            Enter the workspace <span aria-hidden="true">-&gt;</span>
          </Link>
        </div>
      </section>

      <section className="docs-section section-rule" id="documentation">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow">DOCUMENTATION</p>
            <h2>Open by default.</h2>
          </div>
          <p className="section-summary">The core assumptions, protocol shape, and release path are available to review.</p>
        </div>
        <div className="docs-grid">
          {docs.map((doc) => (
            <a className="doc-link" href={doc.href} key={doc.label}>
              <span>
                <strong>{doc.label}</strong>
                <small>{doc.detail}</small>
              </span>
              <span className="doc-arrow" aria-hidden="true">-&gt;</span>
            </a>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <Link className="wordmark" href="/">
          <span className="wordmark-mark">A</span>
          <span>ANALA</span>
        </Link>
        <span>Research and lending infrastructure for PreStocks on Solana.</span>
        <span>2026 / DEVNET READY</span>
      </footer>
    </main>
  );
}
