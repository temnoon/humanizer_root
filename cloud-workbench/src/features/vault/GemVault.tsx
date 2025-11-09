import { useEffect, useState } from "react";
import { api, Gem } from "../../core/adapters/api";

export function GemVault() {
  const [items, setItems] = useState<Gem[]>([]);
  useEffect(()=>{ api.listGems().then(setItems); },[]);
  return (
    <div className="p-2 space-y-2">
      {items.map(g=>(
        <div key={g.id} className="p-2 bg-slate-800 rounded">
          <div className="text-sm font-medium">{g.title}</div>
          <div className="text-xs opacity-70">{g.snippet ?? ""}</div>
        </div>
      ))}
    </div>
  );
}
