import { WorkbenchLayout } from "./layout/WorkbenchLayout";
import { LeftPanel } from "../features/archive/LeftPanel";
import { Canvas } from "../features/canvas/Canvas";
import { ToolDock } from "../features/panels/ToolDock";
import { MetricStrip } from "../features/metrics/MetricStrip";
import { RunLog } from "../features/panels/RunLog";
import { ArchiveProvider } from "../core/context/ArchiveContext";
import { CanvasProvider } from "../core/context/CanvasContext";
import { AuthProvider } from "../core/context/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <ArchiveProvider>
        <CanvasProvider>
          <WorkbenchLayout
            left={<LeftPanel />}
            center={<Canvas />}
            right={<ToolDock />}
            bottom={<><MetricStrip /><RunLog /></>}
          />
        </CanvasProvider>
      </ArchiveProvider>
    </AuthProvider>
  );
}
