import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client.ts";
import { LandingThemeProvider, useLandingTheme } from "./landing/LandingTheme.tsx";
import SceneLayer from "./landing/scene/SceneLayer.tsx";
import { POSES, sceneStore } from "./landing/scene/store.ts";

function AuthScene() {
  const { theme } = useLandingTheme();
  useEffect(() => {
    sceneStore.heldPose = POSES.auth;
    return () => {
      sceneStore.heldPose = null;
    };
  }, []);
  return <SceneLayer theme={theme} className="lp-scene-panel" />;
}

type AuthView = "sign-in" | "sign-up" | "forgot-password";

interface AuthPageProps {
  onNavigateTab: (tab: string) => void;
}

export default function AuthPage({ onNavigateTab }: AuthPageProps) {
  const [view, setView] = useState<AuthView>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (view === "sign-in") {
        const { error: signInError } = await authClient.signIn.email({ email, password });
        if (signInError) {
          setError(signInError.message ?? signInError.code ?? "Sign in failed");
          return;
        }
        onNavigateTab("dashboard");
      } else if (view === "sign-up") {
        const { error: signUpError } = await authClient.signUp.email({ email, password, name });
        if (signUpError) {
          setError(signUpError.message ?? signUpError.code ?? "Sign up failed");
          return;
        }
        onNavigateTab("dashboard");
      }
    } catch (err: any) {
      setError(err?.message ?? "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const title = view === "sign-in" ? "Welcome back" : view === "sign-up" ? "Create your account" : "Reset password";
  const submitLabel = view === "sign-in" ? "Sign in" : view === "sign-up" ? "Create account" : "Send reset link";
  const hasSocial = !!(import.meta.env.VITE_GITHUB_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID);

  return (
    <LandingThemeProvider>
      <div className="min-h-svh grid grid-cols-1 lg:grid-cols-2">
        <section className="relative z-10 flex flex-col px-6 lg:px-14 py-8">
          <button onClick={() => onNavigateTab("landing")} className="self-start cursor-pointer" aria-label="Back to AoraHQ home">
            <img src="/aorahq-logo.png" alt="" className="lp-logo" />
          </button>

          <div className="flex-1 flex items-center">
            <div className="w-full max-w-sm mx-auto lg:mx-0 py-10">
              <p className="lp-label">{view === "sign-up" ? "Start billing" : "AoraHQ console"}</p>
              <h1 className="lp-h2 !text-[2.5rem] mt-3">{title}</h1>

              {error && (
                <p role="alert" className="mt-6 p-3 border border-[var(--lp-tick)] lp-data lp-text">
                  {error}
                </p>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                {view === "sign-up" && (
                  <div>
                    <label htmlFor="auth-name" className="lp-label block mb-2">Name</label>
                    <input id="auth-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="lp-input" placeholder="Your name" autoComplete="name" required />
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="lp-label block mb-2">Email</label>
                  <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="lp-input" placeholder="you@example.com" autoComplete="email" required />
                </div>

                <div>
                  <label htmlFor="auth-password" className="lp-label block mb-2">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="lp-input"
                    placeholder="At least 10 characters"
                    autoComplete={view === "sign-up" ? "new-password" : "current-password"}
                    required
                    minLength={10}
                  />
                </div>

                <button type="submit" disabled={loading} className="lp-btn w-full disabled:opacity-50">
                  {loading ? "Please wait..." : submitLabel}
                </button>
              </form>

              <div className="mt-6 space-y-2 lp-data">
                {view === "sign-in" ? (
                  <>
                    <button onClick={() => setView("sign-up")} className="block lp-secondary hover:text-[var(--lp-text)] cursor-pointer">
                      Don't have an account? Sign up
                    </button>
                    <button onClick={() => setView("forgot-password")} className="block lp-secondary hover:text-[var(--lp-text)] cursor-pointer">
                      Forgot password?
                    </button>
                  </>
                ) : view === "sign-up" ? (
                  <button onClick={() => setView("sign-in")} className="block lp-secondary hover:text-[var(--lp-text)] cursor-pointer">
                    Already have an account? Sign in
                  </button>
                ) : (
                  <button onClick={() => setView("sign-in")} className="block lp-secondary hover:text-[var(--lp-text)] cursor-pointer">
                    Back to sign in
                  </button>
                )}
              </div>

              {hasSocial && (
                <div className="mt-6 pt-6 border-t lp-divider">
                  <p className="lp-label mb-3">Or continue with</p>
                  <div className="flex gap-3">
                    {import.meta.env.VITE_GITHUB_CLIENT_ID && (
                      <button type="button" onClick={() => authClient.signIn.social({ provider: "github" })} className="lp-btn lp-btn-ghost flex-1">
                        GitHub
                      </button>
                    )}
                    {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                      <button type="button" onClick={() => authClient.signIn.social({ provider: "google" })} className="lp-btn lp-btn-ghost flex-1">
                        Google
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="lp-data lp-muted">AES-256-GCM encrypted keys. Zero asset custody.</p>
        </section>

        <aside className="hidden lg:block relative border-l lp-divider overflow-hidden" aria-hidden="true">
          <AuthScene />
          <div className="absolute inset-x-0 bottom-0 px-8 pb-7 pt-16 flex justify-between lp-data bg-gradient-to-t from-[var(--lp-bg)] to-transparent">
            <span className="lp-secondary">fig.01 the ledger helix</span>
            <span className="lp-muted">usage + payments, reconciled</span>
          </div>
        </aside>
      </div>
    </LandingThemeProvider>
  );
}
