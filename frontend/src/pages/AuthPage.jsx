import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase.js";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";
import "./AuthPage.css";

function authErrorMessage(err) {
  const msg = err?.message?.replace?.(/^Firebase:\s*/i, "") ?? String(err);
  return msg.replace(/\s*\(.*\)\s*$/, "").trim();
}

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLogin = location.pathname === "/login";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError("");
  }, [location.pathname]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) navigate("/app", { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  const toggleAuth = (e) => {
    e.preventDefault();
    navigate(isLogin ? "/signup" : "/login", { replace: true });
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName.trim()) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
        }
      }
      navigate("/app", { replace: true });
    } catch (err) {
      console.error(err);
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/app", { replace: true });
    } catch (err) {
      console.error(err);
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-page ${isLogin ? "auth-page--login" : "auth-page--signup"}`}>
      <div className="auth-page__glow" aria-hidden />

      <div className="auth-page__center">
        <div className="auth-card">
          <aside className="auth-hero" aria-label="DocIntel overview">
            <div className="auth-hero__inner">
              <div className="auth-hero__brand">
                <span className="auth-hero__mark" />
                <span className="auth-hero__name">DocIntel</span>
              </div>
              <h2 className="auth-hero__title">
                {isLogin ? "Back to the console" : "Start processing smarter"}
              </h2>
              <p className="auth-hero__lead">
                OCR, validation, anomaly checks, and confidence scoring — in one workspace.
              </p>
              <ul className="auth-hero__list">
                <li>Secure sign-in with email or Google</li>
                <li>Same Firebase project as the rest of the app</li>
                <li>Built for desktop and mobile review flows</li>
              </ul>
            </div>
          </aside>

          <main className="auth-main">
            <header className="auth-toolbar">
              <Link to="/" className="auth-back-home">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>Home</span>
              </Link>
              <ThemeToggleButton />
            </header>

            <div className="auth-form-wrap">
              <h1 className="auth-title">{isLogin ? "Sign in" : "Create account"}</h1>
              <p className="auth-lead">
                {isLogin ? "Use your work email to open the operations console." : "Create a profile, then jump straight into ingest and dashboards."}
              </p>

              {error ? (
                <div className="auth-error-msg" role="alert">
                  {error}
                </div>
              ) : null}

              <form className="auth-form" onSubmit={handleEmailAuth} noValidate>
                {!isLogin && (
                  <div className="auth-field slide-up">
                    <label className="auth-label" htmlFor="di-fullname">
                      Full name
                    </label>
                    <input
                      id="di-fullname"
                      type="text"
                      placeholder="Ada Lovelace"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                )}
                <div className="auth-field">
                  <label className="auth-label" htmlFor="di-email">
                    Email
                  </label>
                  <input
                    id="di-email"
                    type="email"
                    placeholder="you@institution.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="di-password">
                    Password
                  </label>
                  <input
                    id="di-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                  />
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
                </button>

                <div className="auth-divider">
                  <span>or</span>
                </div>

                <button type="button" className="google-btn" onClick={handleGoogle} disabled={loading}>
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {isLogin ? "Continue with Google" : "Sign up with Google"}
                </button>
              </form>

              <div className="auth-footer">
                <p>
                  {isLogin ? "New to DocIntel?" : "Already registered?"}
                  <button type="button" onClick={toggleAuth} className="toggle-auth-link">
                    {isLogin ? "Create account" : "Sign in"}
                  </button>
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
