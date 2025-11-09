import { useState } from "react";
import { api } from "../../../core/adapters/api";

export function POVMPanel() {
  const [axis, setAxis] = useState("catuskoti");
  const [text, setText] = useState("");
  const [out, setOut] = useState<any>(null);

  async function run() {
    const res = await api.evalPOVM({ text, axis });
    setOut(res);
  }

  return (
    <div className="panel">
      <h3>POVM Evaluator</h3>
      <select value={axis} onChange={e=>setAxis(e.target.value)}>
        <option value="catuskoti">Catuṣkoṭi</option>
        <option value="agency">Agency</option>
      </select>
      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Paste text or use selection…" />
      <button onClick={run}>Evaluate</button>
      {out && <pre>{JSON.stringify(out,null,2)}</pre>}
    </div>
  );
}
