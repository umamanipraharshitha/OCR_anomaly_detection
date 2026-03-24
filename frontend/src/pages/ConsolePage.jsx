import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { analyzeDocument, fetchDashboard, submitFeedback } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";
import "../App.css";

function StatusPill({ status }) {
  const ok = status === "OK";
  return (
    <span className={`di-pill ${ok ? "di-pill--ok" : "di-pill--flag"}`}>
      <span className="di-pill-dot" aria-hidden />
      {status}
    </span>
  );
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="di-metric">
      <p className="di-metric-label">{label}</p>
      <p className="di-metric-value">{value}</p>
      {hint ? <p className="di-metric-hint">{hint}</p> : null}
    </div>
  );
}

export default function ConsolePage() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState("analyze");
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const workspaceRef = useRef(null);

  const [docId, setDocId] = useState(() => `doc-${Date.now().toString(36)}`);
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const [dash, setDash] = useState(null);
  const [dashLoading, setDashLoading] = useState(false);

  const [fbDocId, setFbDocId] = useState("");
  const [reviewer, setReviewer] = useState(user?.displayName || "");
  const [fbName, setFbName] = useState("");
  const [fbDate, setFbDate] = useState("");
  const [fbAmount, setFbAmount] = useState("");
  const [fbStatus, setFbStatus] = useState(null);

  useEffect(() => {
    if (user?.displayName && !reviewer) setReviewer(user.displayName);
  }, [user, reviewer]);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    setError(null);
    try {
      const data = await fetchDashboard();
      setDash(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setError(null);
    if (tab === "dashboard") loadDashboard();
  }, [tab, loadDashboard]);

  function openWorkspace(nextTab) {
    setTab(nextTab);
    setMobileNavOpen(false);
    requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function onAnalyze(e) {
    e.preventDefault();
    if (!file) {
      setError("Choose an image or PDF to upload.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await analyzeDocument(docId.trim(), file);
      setResult(data);
      setFbDocId(data.doc_id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onFeedback(e) {
    e.preventDefault();
    if (!fbDocId.trim() || !reviewer.trim()) {
      setFbStatus({ type: "err", text: "Document ID and reviewer are required." });
      return;
    }
    setFbStatus({ type: "pending" });
    try {
      await submitFeedback({
        doc_id: fbDocId.trim(),
        reviewer: reviewer.trim(),
        corrected_name: fbName,
        corrected_date: fbDate,
        corrected_amount: fbAmount,
      });
      setFbStatus({ type: "ok", text: "Corrections saved for the feedback loop." });
    } catch (e) {
      setFbStatus({ type: "err", text: e.message });
    }
  }

  const confidenceScore = result?.confidence_score ?? 0;
  const ocrConfidence = result?.ocr_confidence ?? 0;
  const isFlagged = result?.status === "FLAGGED";

  return (
    <div className="di-page di-console">
      <div className="di-glow-wrap" aria-hidden>
        <div className="di-glow-c1" />
        <div className="di-glow-c2" />
      </div>

      <header className={`di-nav-wrapper ${navScrolled ? "di-nav--scrolled" : ""}`}>
        <div className="section-container">
          <nav className="di-navbar" aria-label="Console">
            <Link to="/" className="di-logo di-logo--link">
              DocIntel
            </Link>

            <button
              type="button"
              className={`di-hamburger ${mobileNavOpen ? "di-hamburger--open" : ""}`}
              aria-expanded={mobileNavOpen}
              aria-label="Menu"
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              <span />
              <span />
              <span />
            </button>

            <ul className={`di-nav-links ${mobileNavOpen ? "di-nav-links--open" : ""}`}>
              <li>
                <Link to="/#pipeline" className="di-nav-link-a" onClick={() => setMobileNavOpen(false)}>
                  Pipeline
                </Link>
              </li>
              <li className="di-nav-sidebar" aria-hidden>
                |
              </li>
              <li>
                <button type="button" aria-current={tab === "analyze" ? "true" : undefined} onClick={() => openWorkspace("analyze")}>
                  Ingest
                </button>
              </li>
              <li>
                <button type="button" aria-current={tab === "dashboard" ? "true" : undefined} onClick={() => openWorkspace("dashboard")}>
                  Dashboard
                </button>
              </li>
              <li>
                <button type="button" aria-current={tab === "feedback" ? "true" : undefined} onClick={() => openWorkspace("feedback")}>
                  Review
                </button>
              </li>
            </ul>

            <ThemeToggleButton />

            <div className="di-console-user">
              <span className="di-console-user-name" title={user?.email || ""}>
                {user?.displayName || user?.email?.split("@")[0] || "Account"}
              </span>
              <button type="button" className="di-console-signout" onClick={() => signOut()}>
                Sign out
              </button>
            </div>

            <div className="di-nav-cta-wrap">
              <button type="button" className="di-btn-nav" onClick={() => openWorkspace("analyze")}>
                Analyze
              </button>
            </div>
          </nav>
        </div>
      </header>

      <section className="di-console-strip">
        <div className="section-container di-console-strip-inner">
          <div>
            <p className="di-console-kicker">Operations console</p>
            <h1 className="di-console-title">Document intelligence workspace</h1>
            <p className="di-console-desc">Upload scans, inspect confidence &amp; anomalies, push dashboard metrics, capture reviewer corrections.</p>
          </div>
          <div className="di-console-strip-actions">
            <button type="button" className="di-btn-large di-btn-primary" onClick={() => openWorkspace("analyze")}>
              New analysis
            </button>
            <button type="button" className="di-btn-large di-btn-ghost" onClick={() => openWorkspace("dashboard")}>
              View metrics
            </button>
          </div>
        </div>
      </section>

      <section className="di-workspace di-workspace--console" id="workspace" ref={workspaceRef}>
        <div className="section-container">
          {error ? (
            <div className="di-banner di-banner--error" role="alert">
              {error}
            </div>
          ) : null}

          {tab === "analyze" && (
            <div className="di-panel" aria-labelledby="analyze-heading">
              <div className="di-panel-head">
                <h2 id="analyze-heading">Ingest &amp; analyze</h2>
                <p className="di-panel-sub">
                  Assign a document ID, upload PNG, JPG, or PDF. The API runs OpenCV/PIL preprocessing, OCR, structured
                  field extraction, validation, anomaly detection, and confidence scoring.
                </p>
              </div>

              <form className="di-form" onSubmit={onAnalyze}>
                <label className="di-field">
                  <span>Document ID</span>
                  <input
                    className="di-input"
                    value={docId}
                    onChange={(e) => setDocId(e.target.value)}
                    placeholder="e.g. CHQ-MUM-2026-00442"
                    autoComplete="off"
                  />
                </label>

                <div
                  className={`di-dropzone ${drag ? "di-dropzone--active" : ""}`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDrag(false);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) setFile(f);
                  }}
                >
                  <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <div className="di-drop-inner">
                    <p className="di-drop-title">{file ? file.name : "Drop a scan here, or click to browse"}</p>
                    <p className="di-drop-hint">Raster images and PDF</p>
                  </div>
                </div>

                <div className="di-form-actions">
                  <button type="submit" className="di-btn-large di-btn-primary" disabled={loading}>
                    {loading ? "Running pipeline…" : "Run full pipeline"}
                  </button>
                </div>
              </form>

              {result && (
                <div className="di-results">
                  <div className="di-results-head">
                    <h3>Analysis result</h3>
                    <StatusPill status={result.status} />
                  </div>

                  {result.ocr_setup_notes?.length > 0 && (
                    <div className="di-setup-notes" role="region" aria-label="OCR setup help">
                      <p>Action required for OCR</p>
                      <ul>
                        {result.ocr_setup_notes.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="di-grid-metrics">
                    <div className="di-confcard">
                      <div className="di-gauge" style={{ "--progress": `${Math.round(confidenceScore)}%` }}>
                        <div className="di-gauge-inner">
                          <strong>{Math.round(confidenceScore)}%</strong>
                          <span>Confidence</span>
                        </div>
                      </div>
                      <div className="di-confmeta">
                        <label>Decision</label>
                        <div className="di-confline">
                          <StatusPill status={result.status} />
                          <code>{result.ocr_provider ?? "—"}</code>
                        </div>
                      </div>
                    </div>
                    <MetricCard
                      label="Mean token confidence"
                      value={`${Math.round(ocrConfidence * 10000) / 100}%`}
                      hint="Derived from OCR token confidences"
                    />
                    <MetricCard
                      label="Anomaly"
                      value={result.anomaly?.is_anomaly || isFlagged ? "Flagged" : "Within range"}
                      hint="IsolationForest + PyOD IForest on document features"
                    />
                  </div>

                  <div className="di-card-grid">
                    <div className="di-card">
                      <h4>Structured fields</h4>
                      <dl className="di-kv">
                        <div>
                          <dt>Payee / name</dt>
                          <dd>{result.fields?.name ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>Instrument date</dt>
                          <dd>{result.fields?.date ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>Amount</dt>
                          <dd>{result.fields?.amount != null ? String(result.fields.amount) : "—"}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="di-card">
                      <h4>Rule validation</h4>
                      <p className={`di-validation ${result.validation?.passed ? "di-validation--ok" : ""}`}>
                        {result.validation?.passed ? "All checks passed" : "Exceptions found"}
                      </p>
                      {result.validation?.missing_fields?.length ? (
                        <p className="di-card-meta">Missing: {result.validation.missing_fields.join(", ")}</p>
                      ) : null}
                      {result.validation?.format_errors?.length ? (
                        <ul className="di-list">
                          {result.validation.format_errors.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>

                  {result.low_confidence_words?.length > 0 && (
                    <div className="di-card di-card--full">
                      <h4>Low-confidence OCR tokens</h4>
                      <div className="di-chips">
                        {result.low_confidence_words.slice(0, 28).map((w, i) => (
                          <span key={i} className="di-chip" title={JSON.stringify(w.bbox)}>
                            {w.word} <span className="di-chip-sub">{Math.round(w.confidence)}%</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <details className="di-details">
                    <summary>Raw OCR text</summary>
                    <pre className="di-pre">{result.text || "—"}</pre>
                  </details>
                </div>
              )}
            </div>
          )}

          {tab === "dashboard" && (
            <div className="di-panel" aria-labelledby="dash-heading">
              <div className="di-panel-head di-panel-head-row">
                <div>
                  <h2 id="dash-heading">Operations dashboard</h2>
                  <p className="di-panel-sub">
                    Throughput and quality KPIs from persisted runs in <code>output/*.json</code>.
                  </p>
                </div>
                <button type="button" className="di-btn-secondary" onClick={loadDashboard} disabled={dashLoading}>
                  {dashLoading ? "Refreshing…" : "Refresh metrics"}
                </button>
              </div>

              {dashLoading && !dash ? <p className="di-empty">Loading dashboard…</p> : null}

              {dash && (
                <>
                  <div className="di-grid-metrics">
                    <MetricCard label="Documents processed" value={dash.documents} />
                    <MetricCard label="Queued / flagged" value={dash.flagged} hint="Below threshold or anomaly" />
                    <MetricCard label="Average confidence" value={`${dash.avg_confidence}%`} />
                  </div>

                  {dash?.charts?.status_pie || dash?.charts?.confidence_histogram ? (
                    <div className="di-chart-grid">
                      {dash?.charts?.status_pie ? (
                        <figure className="di-chart-card">
                          <figcaption>Status split</figcaption>
                          <img src={dash.charts.status_pie} alt="Pie chart showing OK vs FLAGGED document split" loading="lazy" />
                        </figure>
                      ) : null}
                      {dash?.charts?.confidence_histogram ? (
                        <figure className="di-chart-card">
                          <figcaption>Confidence distribution</figcaption>
                          <img src={dash.charts.confidence_histogram} alt="Histogram showing confidence score distribution" loading="lazy" />
                        </figure>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="di-table-wrap">
                    <table className="di-table">
                      <thead>
                        <tr>
                          <th>Document</th>
                          <th>File</th>
                          <th>Status</th>
                          <th className="di-table-num">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(dash?.recent?.length ? dash.recent : []).map((row) => (
                          <tr key={`${row.doc_id}-${row.filename}`}>
                            <td>
                              <code>{row.doc_id}</code>
                            </td>
                            <td>{row.filename}</td>
                            <td>
                              <StatusPill status={row.status} />
                            </td>
                            <td className="di-table-num">{row.confidence_score}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!dash.recent?.length ? <p className="di-empty">No documents yet — run an analysis from Ingest.</p> : null}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "feedback" && (
            <div className="di-panel" aria-labelledby="fb-heading">
              <div className="di-panel-head">
                <h2 id="fb-heading">Human review &amp; feedback loop</h2>
                <p className="di-panel-sub">
                  Corrections append to <code>output/feedback.jsonl</code> for retraining and audit.
                </p>
              </div>

              <form className="di-form di-form-grid" onSubmit={onFeedback}>
                <label className="di-field">
                  <span>Document ID</span>
                  <input
                    className="di-input"
                    value={fbDocId}
                    onChange={(e) => setFbDocId(e.target.value)}
                    placeholder="Same ID as ingestion run"
                  />
                </label>
                <label className="di-field">
                  <span>Reviewer</span>
                  <input
                    className="di-input"
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                    placeholder="Analyst name or staff ID"
                  />
                </label>
                <label className="di-field">
                  <span>Corrected name</span>
                  <input className="di-input" value={fbName} onChange={(e) => setFbName(e.target.value)} />
                </label>
                <label className="di-field">
                  <span>Corrected date</span>
                  <input className="di-input" value={fbDate} onChange={(e) => setFbDate(e.target.value)} />
                </label>
                <label className="di-field">
                  <span>Corrected amount</span>
                  <input
                    className="di-input"
                    value={fbAmount}
                    onChange={(e) => setFbAmount(e.target.value)}
                    placeholder="e.g. 2500.50"
                  />
                </label>
                <div className="di-form-actions di-form-actions--full">
                  <button type="submit" className="di-btn-large di-btn-primary">
                    Save corrections
                  </button>
                </div>
              </form>

              {fbStatus?.type === "ok" ? <div className="di-banner di-banner--ok">{fbStatus.text}</div> : null}
              {fbStatus?.type === "err" ? <div className="di-banner di-banner--error">{fbStatus.text}</div> : null}
            </div>
          )}
        </div>
      </section>

      <footer className="di-footer">
        <div className="section-container di-footer-inner">
          <span>
            <strong>DocIntel</strong> console — authenticated via Firebase
          </span>
          <nav className="di-footer-nav" aria-label="Console footer">
            <Link to="/#contact" className="di-footer-link">
              Contact
            </Link>
            <Link to="/" className="di-footer-link">
              Back to marketing site
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
