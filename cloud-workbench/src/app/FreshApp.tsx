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
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-base-content mb-4">
            humanizer.com
          </h1>
          <p className="text-base-content/70 mb-8">
            Narrative Phenomenology Workbench
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setShowLogin(true)}
          >
            Login to Continue
          </button>
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
