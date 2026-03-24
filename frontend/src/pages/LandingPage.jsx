import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { PIPELINE_STEPS } from "../pipelineData.js";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";
import ContactSection from "../components/ContactSection.jsx";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pipelineRef = useRef(null);
  const contactRef = useRef(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const hash = (location.hash || "").replace(/^#/, "");
    if (hash === "contact") {
      requestAnimationFrame(() => contactRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [location.hash, location.pathname]);

  function goConsole() {
    if (user) navigate("/app");
    else navigate("/login");
  }

  return (
    <div className="di-page di-landing">
      <div className="di-glow-wrap" aria-hidden>
        <div className="di-glow-c1" />
        <div className="di-glow-c2" />
      </div>

      <header className={`di-nav-wrapper ${navScrolled ? "di-nav--scrolled" : ""}`}>
        <div className="section-container">
          <nav className="di-navbar" aria-label="Marketing">
            <Link to="/" className="di-logo di-logo--link">
              DocIntel
            </Link>

            <button
              type="button"
              className={`di-hamburger ${mobileOpen ? "di-hamburger--open" : ""}`}
              aria-expanded={mobileOpen}
              aria-label="Menu"
              onClick={() => setMobileOpen((o) => !o)}
            >
              <span />
              <span />
              <span />
            </button>

            <ul className={`di-nav-links ${mobileOpen ? "di-nav-links--open" : ""}`}>
              <li>
                <button type="button" onClick={() => pipelineRef.current?.scrollIntoView({ behavior: "smooth" })}>
                  Pipeline
                </button>
              </li>
              <li>
                <Link to="/#contact" className="di-nav-link-a" onClick={() => setMobileOpen(false)}>
                  Contact
                </Link>
              </li>
              <li className="di-nav-sidebar" aria-hidden>
                |
              </li>
              <li>
                <Link to="/login" className="di-nav-link-a" onClick={() => setMobileOpen(false)}>
                  Sign in
                </Link>
              </li>
              <li>
                <Link to="/signup" className="di-nav-link-a" onClick={() => setMobileOpen(false)}>
                  Create account
                </Link>
              </li>
            </ul>

            <ThemeToggleButton />

            <div className="di-nav-cta-wrap di-nav-cta-wrap--dual">
              <button type="button" className="di-btn-nav-secondary" onClick={() => navigate("/login")}>
                Sign in
              </button>
              <button type="button" className="di-btn-nav" onClick={goConsole}>
                {loading ? "…" : user ? "Open console" : "Get started"}
              </button>
            </div>
          </nav>
        </div>
      </header>

      <section className="di-hero" id="top">
        <div className="section-container">
          <div className="di-hero-grid">
            <div className="di-hero-copy">
              <div className="di-announce">
                <span className="di-announce-tag">Bank-grade</span>
                <span className="di-announce-text">Digitize &amp; validate scanned financial documents</span>
              </div>

              <h1 className="di-hero-title">
                Clarity for every
                <br />
                <span className="di-accent-gradient">scan &amp; submission.</span>
              </h1>

              <p className="di-hero-lead">
                DocIntel ingests branch scans, normalizes image quality, extracts structured fields, runs hybrid rule +
                ML anomaly checks, and surfaces a confidence score your ops team can trust — with human review and
                continuous learning built in.
              </p>

              <div className="di-hero-ctas">
                <button type="button" className="di-btn-large di-btn-primary" onClick={goConsole}>
                  {user ? "Open console" : "Get started free"}
                </button>
                <button
                  type="button"
                  className="di-btn-large di-btn-ghost"
                  onClick={() => pipelineRef.current?.scrollIntoView({ behavior: "smooth" })}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" />
                  </svg>
                  View pipeline
                </button>
              </div>

              <div className="di-trust">
                <div className="di-trust-label">DESIGNED FOR</div>
                <div className="di-trust-strip">
                  <span>Clearing</span>
                  <span>KYC ops</span>
                  <span>Loan processing</span>
                  <span>Claims review</span>
                </div>
              </div>
            </div>

            <div className="di-hero-visual" aria-hidden>
              <div className="di-visual-frame">
                <div className="di-mock-browser">
                  <div className="di-mock-bar">
                    <span className="di-mock-dot" />
                    <span className="di-mock-dot" />
                    <span className="di-mock-dot" />
                    <div className="di-mock-url">app.docintel.local / queue / flagged</div>
                  </div>
                  <div className="di-mock-body">
                    <div className="di-flow">
                      <div className="di-flow-row">
                        <span className="di-flow-ic di-flow-ic--1">📄</span>
                        <span>Scanned cheque ingested</span>
                        <span className="di-flow-meta">OK</span>
                      </div>
                      <div className="di-flow-row">
                        <span className="di-flow-ic di-flow-ic--2">⚙</span>
                        <span>OCR + field parse (payee, date, amount)</span>
                        <span className="di-flow-meta">Live</span>
                      </div>
                      <div className="di-flow-row">
                        <span className="di-flow-ic di-flow-ic--3">✓</span>
                        <span>Rules + anomaly layer + confidence</span>
                        <span className="di-flow-meta">Score</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="di-glass-float di-float-conf">
                  <div className="di-flow-ic di-flow-ic--1" style={{ fontSize: "18px" }}>
                    🔍
                  </div>
                  <div>
                    <strong>Low-confidence region</strong>
                    <span>Bounding boxes for manual QA</span>
                  </div>
                </div>

                <div className="di-glass-float di-float-score">
                  <div className="di-score-ring" title="Illustrative">
                    <small>78</small>
                  </div>
                  <div>
                    <strong>Doc score</strong>
                    <span className="di-score-sub">Weighted fusion</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="di-pipeline" id="pipeline" ref={pipelineRef}>
        <div className="section-container">
          <div className="di-section-head">
            <h2>Seven-layer digitization pipeline</h2>
            <p>
              From branch scan to audited decision — preprocessing, OCR, parallel validation engines, unified scoring,
              and analyst-facing insights.
            </p>
          </div>
          <div className="di-steps">
            {PIPELINE_STEPS.map((step) => (
              <article key={step.n} className="di-step">
                <div className="di-step-num">Layer {step.n}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                <div className="di-step-tags">
                  {step.tags.map((t) => (
                    <span key={t} className="di-tag">
                      {t}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ContactSection ref={contactRef} />

      <section className="di-landing-cta">
        <div className="section-container di-landing-cta-inner">
          <div>
            <h2>Ready to run the pipeline?</h2>
            <p>Sign in to upload documents, view the ops dashboard, and log reviewer feedback.</p>
          </div>
          <button type="button" className="di-btn-large di-btn-primary" onClick={goConsole}>
            {user ? "Open console" : "Create account"}
          </button>
        </div>
      </section>

      <footer className="di-footer">
        <div className="section-container di-footer-inner">
          <div className="di-footer-brand">
            <span className="di-footer-line">
              <strong>DocIntel</strong> — FastAPI · OpenCV / PIL · Tesseract / Azure · pandas · scikit-learn · PyOD · React · Firebase
            </span>
            <span className="di-footer-tagline">Document control &amp; fraud-ops ready.</span>
          </div>
          <nav className="di-footer-nav" aria-label="Footer">
            <Link to="/#contact" className="di-footer-link">
              Contact
            </Link>
            <Link to="/login" className="di-footer-link">
              Sign in
            </Link>
            <Link to="/signup" className="di-footer-link">
              Create account
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
