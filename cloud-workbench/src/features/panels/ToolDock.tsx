import { useState } from "react";
import { toolRegistry } from "../../core/tool-registry";

export function ToolDock() {
  const [active, setActive] = useState<string | null>("povm");
  const tool = toolRegistry.find(t => t.id === active);

  return (
    <div className="h-full grid grid-rows-[40px_1fr]">
      <div className="flex gap-2 p-2 border-b border-slate-800">
        {toolRegistry.map(t => (
          <button key={t.id}
            className={`px-2 py-1 rounded ${active===t.id ? "bg-slate-800" : "bg-slate-900"}`}
            onClick={()=>setActive(t.id)} title={t.label}>{t.icon}</button>
        ))}
      </div>
      <div className="overflow-auto p-2">{tool ? <tool.panel/> : <div className="p-4">Choose a tool</div>}</div>
    </div>
  );
}
