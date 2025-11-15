import { ThemeToggle } from "../../components/ui/ThemeToggle";
import { useAuth } from "../../core/context/AuthContext";
import { useCanvas } from "../../core/context/CanvasContext";

export function SimpleLayout() {
  const { logout } = useAuth();
  const { text, setText } = useCanvas();

  return (
    <div className="h-screen flex flex-col bg-base-100">
      {/* Header */}
      <header className="bg-base-200 border-b-2 border-base-300">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-base-content">
              humanizer.com
            </h1>
            <span className="badge badge-primary">Workbench</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              className="btn btn-sm btn-outline"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Just Canvas for now */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-base-content mb-2">Canvas</h2>
            <p className="text-sm text-base-content/70">
              Paste or type your text here. Archive and tools coming next.
            </p>
          </div>

          <textarea
            className="textarea textarea-bordered w-full flex-1 font-mono text-sm resize-none"
            placeholder="Paste your text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="mt-4 flex justify-between items-center">
            <span className="text-sm text-base-content/50">
              {text.length} characters
            </span>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setText('')}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
