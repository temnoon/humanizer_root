import { useState } from "react";
import { LoginModal } from "../features/auth/LoginModal";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { SimpleLayout } from "./layout/SimpleLayout";
import { AuthProvider, useAuth } from "../core/context/AuthContext";
import { CanvasProvider } from "../core/context/CanvasContext";

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="hero min-h-screen bg-gradient-to-br from-base-100 via-base-200 to-base-300">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-6xl font-bold mb-4">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                humanizer.com
              </span>
            </h1>
            <p className="text-xl text-base-content/70 mb-8">
              Narrative Phenomenology Workbench
            </p>
            <p className="text-base-content/60 mb-8">
              Transform AI-generated text into natural, human-like content
            </p>
            <button
              className="btn btn-primary btn-lg gap-2"
              onClick={() => setShowLogin(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Login to Continue
            </button>
          </div>
        </div>

        {showLogin && (
          <LoginModal
            isOpen={showLogin}
            onClose={() => setShowLogin(false)}
          />
        )}

        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
      </div>
    );
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
