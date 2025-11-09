import { useState } from "react";
import { api } from "../../../core/adapters/api";

export function RhoInspector() {
  const [text, setText] = useState("");
  const [projections, setProj] = useState<number[]>([]);

  async function run() {
    const res = await api.rhoInspect({ text });
    setProj(res.projections);
  }

  return (
    <div className="panel">
      <h3>ρ Inspector</h3>
      <textarea value={text} onChange={e=>setText(e.target.value)} />
      <button onClick={run}>Inspect</button>
      {!!projections.length && <div className="projections">{projections.map((v,i)=><div key={i}>{v.toFixed(3)}</div>)}</div>}
    </div>
  );
}
