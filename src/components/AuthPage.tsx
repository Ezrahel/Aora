import { useState } from "react";
import { authClient } from "../lib/auth-client.ts";
import { LandingThemeProvider } from "./landing/LandingTheme.tsx";

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

  return (
    <LandingThemeProvider>
      <div className="min-h-screen flex items-center justify-center bg-[var(--lp-bg)] px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <button onClick={() => onNavigateTab("landing")} className="cursor-pointer">
              <div className="rounded-lg p-1.5 inline-block" style={{ backgroundColor: "#F5F5F7" }}>
                <img src="/aorahq-logo.png" alt="AoraHQ" className="h-8 w-auto" />
              </div>
            </button>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-8">
            <h1 className="text-xl font-bold text-center mb-6 text-neutral-900 dark:text-white">
              {view === "sign-in" ? "Welcome back" : view === "sign-up" ? "Create account" : "Reset password"}
            </h1>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {view === "sign-up" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-400"
                    placeholder="Your name"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-400"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-400"
                  placeholder="••••••••"
                  required
                  minLength={10}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs rounded-xl transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Please wait…" : view === "sign-in" ? "Sign In" : view === "sign-up" ? "Create Account" : "Send Reset Link"}
              </button>
            </form>

            <div className="mt-6 space-y-2 text-center text-xs text-neutral-500">
              {view === "sign-in" ? (
                <>
                  <button onClick={() => setView("sign-up")} className="hover:text-neutral-900 dark:hover:text-neutral-300 cursor-pointer">
                    Don't have an account? Sign up
                  </button>
                  <br />
                  <button onClick={() => setView("forgot-password")} className="hover:text-neutral-900 dark:hover:text-neutral-300 cursor-pointer">
                    Forgot password?
                  </button>
                </>
              ) : view === "sign-up" ? (
                <button onClick={() => setView("sign-in")} className="hover:text-neutral-900 dark:hover:text-neutral-300 cursor-pointer">
                  Already have an account? Sign in
                </button>
              ) : (
                <button onClick={() => setView("sign-in")} className="hover:text-neutral-900 dark:hover:text-neutral-300 cursor-pointer">
                  Back to sign in
                </button>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800">
              <div className="text-xs text-neutral-400 text-center mb-3">Or continue with</div>
              <div className="flex gap-3">
                {import.meta.env.VITE_GITHUB_CLIENT_ID && (
                  <button
                    type="button"
                    onClick={() => authClient.signIn.social({ provider: "github" })}
                    className="flex-1 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    GitHub
                  </button>
                )}
                {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                  <button
                    type="button"
                    onClick={() => authClient.signIn.social({ provider: "google" })}
                    className="flex-1 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Google
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </LandingThemeProvider>
  );
}
