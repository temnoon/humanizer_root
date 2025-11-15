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
        // The API returns { output: string, metrics: {...} }
        setOutput(result.output || result.humanized_text || JSON.stringify(result));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transformation failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-base-100">
      {/* Header */}
      <header className="navbar bg-base-200 border-b-2 border-base-300 px-6 py-4">
        <div className="flex-1 gap-3">
          <h1 className="text-2xl font-bold text-primary">humanizer.com</h1>
          <div className="badge badge-primary badge-lg">Workbench</div>
        </div>

        <div className="flex-none gap-3">
          {/* Tool Selector */}
          <select
            className="select select-bordered select-primary font-semibold"
            value={selectedTool}
            onChange={(e) => setSelectedTool(e.target.value)}
          >
            <option value="computer-humanizer">🖥️ Computer Humanizer</option>
            <option value="allegorical" disabled>🎭 Allegorical (Coming Soon)</option>
            <option value="round-trip" disabled>🔄 Round-Trip (Coming Soon)</option>
          </select>

          <button
            className="btn btn-primary font-semibold min-w-32"
            onClick={handleTransform}
            disabled={isProcessing || !text.trim()}
          >
            {isProcessing ? (
              <span className="loading loading-spinner"></span>
            ) : (
              "Transform"
            )}
          </button>

          <ThemeToggle />

          <button
            className="btn btn-outline btn-error"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error mx-6 mt-4 shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Input Panel */}
        <div className="flex-1 flex flex-col border-r-2 border-base-300">
          <div className="bg-base-200 px-6 py-4 border-b-2 border-base-300 flex items-center justify-between">
            <h2 className="font-bold text-base-content flex items-center gap-2">
              <span className="badge badge-primary">Input</span>
              Original Text
            </h2>
            <div className="flex gap-3 items-center">
              <span className="text-sm font-semibold text-base-content/60">
                {text.length} characters
              </span>
              {text && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setText('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <textarea
            className="flex-1 w-full resize-none focus:outline-none p-8 font-mono text-base leading-relaxed bg-base-100 border-none"
            placeholder="Paste or type your text here...

Try pasting an AI-generated text and click 'Transform' to humanize it!"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {/* Output Panel */}
        <div className="flex-1 flex flex-col">
          <div className="bg-base-200 px-6 py-4 border-b-2 border-base-300 flex items-center justify-between">
            <h2 className="font-bold text-base-content flex items-center gap-2">
              <span className="badge badge-secondary">Output</span>
              Transformed Text
            </h2>
            {output && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigator.clipboard.writeText(output)}
              >
                📋 Copy
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-8 bg-base-100">
            {output ? (
              <div className="prose prose-lg max-w-none leading-relaxed">
                <ReactMarkdown>{output}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-base-content/30">
                <div className="text-center">
                  <div className="text-6xl mb-4">✨</div>
                  <p className="text-lg font-semibold">Transformed text will appear here</p>
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
