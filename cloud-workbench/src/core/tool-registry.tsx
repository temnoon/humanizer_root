import type { ReactNode } from "react";
import { POVMPanel } from "../features/panels/povm/POVMPanel";
import { RhoInspector } from "../features/panels/rho/RhoInspector";
import { MultiReadingPanel } from "../features/panels/MultiReadingPanel";
import { AllegoricalPanel } from "../features/panels/allegorical/AllegoricalPanel";
import { RoundTripPanel } from "../features/panels/round-trip/RoundTripPanel";
import { HistoryPanel } from "../features/history/HistoryPanel";
import { SessionBrowser } from "../features/quantum/SessionBrowser";
import { AIDetectionPanel } from "../features/panels/ai-detection/AIDetectionPanel";
import { PersonalizerPanel } from "../features/panels/personalizer/PersonalizerPanel";
import { MaieuticPanel } from "../features/panels/maieutic/MaieuticPanel";

export type ToolKind = "analysis" | "transform" | "pipeline";

export interface ToolDef {
  id: string;
  kind: ToolKind;
  icon: ReactNode;
  label: string;
  panel: React.ComponentType;
}

export const toolRegistry: ToolDef[] = [
  // Transformations
  { id: "allegorical", kind: "transform", icon: <span>🌟</span>, label: "Allegorical", panel: AllegoricalPanel },
  { id: "round-trip", kind: "transform", icon: <span>🌍</span>, label: "Round-Trip", panel: RoundTripPanel },
  { id: "ai-detection", kind: "transform", icon: <span>🔍</span>, label: "AI Detection", panel: AIDetectionPanel },
  { id: "personalizer", kind: "transform", icon: <span>🎭</span>, label: "Personalizer", panel: PersonalizerPanel },
  { id: "maieutic", kind: "transform", icon: <span>🤔</span>, label: "Maieutic", panel: MaieuticPanel },

  // Analysis
  { id: "multi-reading", kind: "analysis", icon: <span>◈</span>, label: "Multi-Reading", panel: MultiReadingPanel },
  { id: "povm", kind: "analysis", icon: <span>◆</span>, label: "Perspective Analysis", panel: POVMPanel },
  { id: "rho-inspect", kind: "analysis", icon: <span>↗︎</span>, label: "Embedding Profile", panel: RhoInspector },

  // Pipeline (History & Sessions)
  { id: "history", kind: "pipeline", icon: <span>📜</span>, label: "History", panel: HistoryPanel },
  { id: "sessions", kind: "pipeline", icon: <span>◈</span>, label: "Sessions", panel: SessionBrowser },
];
