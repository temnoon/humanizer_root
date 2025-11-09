import { ReactNode } from "react";
import { POVMPanel } from "../features/panels/povm/POVMPanel";
import { RhoInspector } from "../features/panels/rho/RhoInspector";

export type ToolKind = "analysis" | "transform" | "pipeline";

export interface ToolDef {
  id: string;
  kind: ToolKind;
  icon: ReactNode;
  label: string;
  panel: React.ComponentType;
}

export const toolRegistry: ToolDef[] = [
  { id: "povm", kind: "analysis", icon: <span>◆</span>, label: "POVM", panel: POVMPanel },
  { id: "rho-inspect", kind: "analysis", icon: <span>↗︎</span>, label: "ρ Inspector", panel: RhoInspector },
  // later: rho-move, personifier, pipeline, etc.
];
