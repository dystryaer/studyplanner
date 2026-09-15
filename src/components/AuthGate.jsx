import { useEffect, useRef, useState } from "react";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "../api/supabaseClient";

const OWNER_KEY = "studyplanner:local-owner";

function readRememberedAccount() {
  try {
    const value = JSON.parse(localStorage.getItem(OWNER_KEY));
    if (value?.signedOut === true) return { user: null, signedOut: true };
    if (value?.authorizing === true) return { user: null, signedOut: false };
    if (typeof value?.user?.id === "string" && typeof value.user.email === "string") {
      return { user: { id: value.user.id, email: value.user.email }, signedOut: false };
    }
  } catch {}
  return { user: null, signedOut: true };
}

function rememberAccount(user) {
  try {
    localStorage.removeItem(OWNER_KEY);
    localStorage.setItem(OWNER_KEY, JSON.stringify({
      user: user ? { id: user.id, email: user.email } : null,
      signedOut: !user,
    }));
  } catch {}
}

function PlannerMark() {
  return (
    <div className="auth-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" role="img" aria-label="Study Planner Logo">
        <rect
          x="6"
          y="8"
          width="36"
          height="32"
          rx="8"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
        />
        <path
          d="M16 18h16M16 24h10M16 30h8"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function AuthGate({ children }) {
  const isDemo = import.meta.env.VITE_DEV_DEMO === "true";
  const [remembered] = useState(readRememberedAccount);
  const allowSession = useRef(!remembered.signedOut);
  const [user, setUser] = useState(remembered.user);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(() => !remembered.signedOut && !remembered.user);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    let changed = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !allowSession.current) return;
      if (!session && event === "INITIAL_SESSION") return;
      changed = true;
      rememberAccount(session?.user ?? null);
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active || changed || !allowSession.current) return;
      const account = session?.user ?? (isAuthRetryableFetchError(error) ? remembered.user : null);
      if (session?.user) rememberAccount(session.user);
      else if (!isAuthRetryableFetchError(error)) rememberAccount(null);
      setUser(account);
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [remembered]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        setMessage("Account created. You can sign in now.");
        setMode("login");
        setPassword("");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        allowSession.current = true;
        rememberAccount(data.user);
        setUser(data.user);
      }
    } catch (error) {
      setMessage(error.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    allowSession.current = false;
    rememberAccount(null);
    setUser(null);
    await supabase.auth.signOut();
  }

  async function handleGoogleLogin() {
    setSubmitting(true);
    setMessage("");

    try {
      localStorage.setItem(OWNER_KEY, JSON.stringify({ authorizing: true }));
      allowSession.current = true;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
    } catch (error) {
      setMessage(error.message ?? "Google login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="auth-loading">Loading...</div>;
  }

  if (!user) {
    const isSignup = mode === "signup";

    return (
      <div className="auth-layout">
        <section className="auth-hero">
          <div className="auth-hero-inner">
            <PlannerMark />

            <div className="auth-kicker">Study Planner</div>

            <h1 className="auth-hero-title">
              Plan your week.
              <br />
              Keep it synced.
            </h1>

            <p className="auth-hero-copy">
              Organize tasks, events and daily routines in one clean planner and
              pick up exactly where you left off on any device.
            </p>

            <div className="auth-feature-list">
              <div className="auth-feature">
                <span className="auth-feature-dot" />
                <span>Task backlog and weekly planning</span>
              </div>
              <div className="auth-feature">
                <span className="auth-feature-dot" />
                <span>Calendar events and daily tasks</span>
              </div>
              <div className="auth-feature">
                <span className="auth-feature-dot" />
                <span>Secure sync with your own account</span>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-panel-wrap">
          <div className="auth-card">
            <div className="auth-card-head">
              <div>
                <p className="auth-eyebrow">
                  {isSignup ? "Create account" : "Welcome back"}
                </p>
                <h2>{isSignup ? "Start syncing your planner" : "Sign in"}</h2>
              </div>

              <PlannerMark />
            </div>

            <p className="auth-copy">
              {isSignup
                ? "Create your account to keep your planner available across laptop, tablet and PC."
                : "Sign in to access your saved tasks, events and daily routines."}
            </p>

            <form className="form-grid auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="auth-field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  minLength={8}
                  required
                />
              </label>

              {message && (
                <p
                  className={
                    message.toLowerCase().includes("created")
                      ? "auth-message success"
                      : "auth-message error"
                  }
                >
                  {message}
                </p>
              )}
              {isDemo && <p>Local demo: alice@planner.test or bob@planner.test. Password: PlannerDev-2026!</p>}
              <div className="submit-btns-row">
                <button type="submit" disabled={submitting}>
                  {submitting
                    ? "Please wait..."
                    : isSignup
                    ? "Create account"
                    : "Sign in"}
                </button>
                {!isDemo && <button type="button" onClick={handleGoogleLogin} disabled={submitting}>
                  Continue with Google
                </button>}
              </div>
              
            </form>

            {!isDemo && <div className="auth-footer">
              <span>
                {isSignup ? "Already have an account?" : "No account yet?"}
              </span>

              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setMode((prev) => (prev === "login" ? "signup" : "login"));
                  setMessage("");
                  setPassword("");
                }}
              >
                {isSignup ? "Sign in instead" : "Create one"}
              </button>
            </div>}
          </div>
        </section>
      </div>
    );
  }

  return children({ user, logout: handleLogout });
}