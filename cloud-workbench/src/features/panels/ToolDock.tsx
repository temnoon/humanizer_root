import { useState } from "react";
import { toolRegistry } from "../../core/tool-registry";

export function ToolDock() {
  const [active, setActive] = useState<string | null>(toolRegistry[0]?.id || null);
  const tool = toolRegistry.find(t => t.id === active);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tool Selector - Scrollable horizontal on mobile, clear labels */}
      <div className="flex-shrink-0 border-b overflow-x-auto" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex gap-1 p-2 min-w-min">
          {toolRegistry.map(t => (
            <button
              key={t.id}
              className={`
                flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded whitespace-nowrap
                text-xs sm:text-sm transition-colors
                ${active === t.id ? "btn-primary" : "btn-secondary"}
                ${active === t.id ? "font-medium" : ""}
              `}
              onClick={() => setActive(t.id)}
              title={t.label}
            >
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tool Panel - Properly constrained for mobile */}
      <div className="flex-1 overflow-hidden">
        {tool ? <tool.panel /> : (
          <div className="p-4 text-center" style={{ color: 'var(--text-secondary)' }}>
            Select a tool above
          </div>
        )}
      </div>
    </div>
  );
}
