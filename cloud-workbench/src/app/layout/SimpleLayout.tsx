import { useState } from "react";
import { ThemeToggle } from "../../components/ui/ThemeToggle";
import { useAuth } from "../../core/context/AuthContext";
import { useCanvas } from "../../core/context/CanvasContext";
import { api } from "../../core/adapters/api";
import ReactMarkdown from "react-markdown";

export function SimpleLayout() {
  const { logout } = useAuth();
  const { text, setText } = useCanvas();
  const [selectedTool, setSelectedTool] = useState<string>("computer-humanizer");
  const [output, setOutput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");

  const handleTransform = async () => {
    if (!text.trim()) {
      setError("Please enter some text first");
      return;
    }

    setError("");
    setIsProcessing(true);

    try {
      if (selectedTool === "computer-humanizer") {
        const result = await api.computerHumanizer({
          text,
          intensity: "moderate",
          enableLLMPolish: true,
        });
        setOutput(result.humanized_text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transformation failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-base-100 to-base-200">
      {/* Header */}
      <header className="navbar bg-base-300 shadow-lg">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl font-bold">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              humanizer.com
            </span>
          </a>
          <div className="badge badge-primary badge-lg ml-2">Workbench</div>
        </div>

        <div className="flex-none gap-2">
          {/* Tool Selector */}
          <select
            className="select select-bordered select-sm"
            value={selectedTool}
            onChange={(e) => setSelectedTool(e.target.value)}
          >
            <option value="computer-humanizer">🖥️ Computer Humanizer</option>
            <option value="allegorical" disabled>🎭 Allegorical (Coming Soon)</option>
            <option value="round-trip" disabled>🔄 Round-Trip (Coming Soon)</option>
          </select>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleTransform}
            disabled={isProcessing || !text.trim()}
          >
            {isProcessing ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              "Transform"
            )}
          </button>

          <ThemeToggle />

          <button
            className="btn btn-outline btn-sm btn-error"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error mx-4 mt-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Input Panel */}
        <div className="flex-1 flex flex-col border-r border-base-300">
          <div className="bg-base-200 px-4 py-3 border-b border-base-300 flex items-center justify-between">
            <h2 className="font-semibold text-base-content flex items-center gap-2">
              <span className="badge badge-primary badge-sm">Input</span>
              Original Text
            </h2>
            <div className="flex gap-2">
              <span className="text-sm text-base-content/60">
                {text.length} characters
              </span>
              {text && (
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => setText('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <textarea
            className="flex-1 textarea textarea-ghost w-full resize-none focus:outline-none p-6 font-mono text-sm bg-base-100"
            placeholder="Paste or type your text here...

Try pasting an AI-generated text and click 'Transform' to humanize it!"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {/* Output Panel */}
        <div className="flex-1 flex flex-col">
          <div className="bg-base-200 px-4 py-3 border-b border-base-300 flex items-center justify-between">
            <h2 className="font-semibold text-base-content flex items-center gap-2">
              <span className="badge badge-secondary badge-sm">Output</span>
              Transformed Text
            </h2>
            {output && (
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => navigator.clipboard.writeText(output)}
              >
                📋 Copy
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-6 bg-base-100">
            {output ? (
              <div className="prose max-w-none">
                <ReactMarkdown>{output}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-base-content/30">
                <div className="text-center">
                  <div className="text-6xl mb-4">✨</div>
                  <p className="text-lg">Transformed text will appear here</p>
                  <p className="text-sm mt-2">Enter text and click Transform</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <footer className="footer footer-center p-4 bg-base-300 text-base-content border-t border-base-300">
        <div className="flex gap-4">
          <div className="stat place-items-center p-0">
            <div className="stat-title text-xs">Input</div>
            <div className="stat-value text-lg">{text.length}</div>
          </div>
          <div className="divider divider-horizontal m-0"></div>
          <div className="stat place-items-center p-0">
            <div className="stat-title text-xs">Output</div>
            <div className="stat-value text-lg">{output.length}</div>
          </div>
          <div className="divider divider-horizontal m-0"></div>
          <div className="stat place-items-center p-0">
            <div className="stat-title text-xs">Tool</div>
            <div className="stat-value text-sm">🖥️</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
