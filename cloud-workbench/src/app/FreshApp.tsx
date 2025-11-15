import { useState } from "react";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { SimpleLayout } from "./layout/SimpleLayout";
import { AuthProvider, useAuth } from "../core/context/AuthContext";
import { CanvasProvider } from "../core/context/CanvasContext";

function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("demo@humanizer.com");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      {/* Header */}
      <header className="p-6">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-primary">humanizer.com</h1>
          <ThemeToggle />
        </div>
      </header>

      {/* Centered Login Card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-3xl font-bold text-center mb-6">Welcome Back</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Email</span>
                </label>
                <input
                  type="email"
                  className="input input-bordered w-full bg-base-300"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Password</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered w-full bg-base-300"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "Log In"
                )}
              </button>

              <div className="text-center">
                <a href="#" className="link link-primary text-sm">
                  Need an account? Sign up
                </a>
              </div>

              <div className="divider text-xs">Demo Account</div>

              <div className="text-center text-sm text-base-content/60">
                <div>Email: demo@humanizer.com</div>
                <div>Password: testpass123</div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer footer-center p-6 text-base-content/60 text-sm">
        <div>
          <p>Narrative Projection Engine © 2025 · Transform narratives through allegory, translation, and dialogue</p>
        </div>
      </footer>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, login } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <CanvasProvider>
      <SimpleLayout />
    </CanvasProvider>
  );
}

export default function FreshApp() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
