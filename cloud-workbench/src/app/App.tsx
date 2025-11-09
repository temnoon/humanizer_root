import { WorkbenchLayout } from "./layout/WorkbenchLayout";
import { GemVault } from "../features/vault/GemVault";
import { Canvas } from "../features/canvas/Canvas";
import { ToolDock } from "../features/panels/ToolDock";
import { MetricStrip } from "../features/metrics/MetricStrip";
import { RunLog } from "../features/panels/RunLog";

export default function App() {
  return (
    <WorkbenchLayout
      left={<GemVault />}
      center={<Canvas />}
      right={<ToolDock />}
      bottom={<><MetricStrip /><RunLog /></>}
    />
  );
}
