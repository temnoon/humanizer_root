import ky from "ky";
import { z } from "zod";

/** Toggle at runtime; start with 'v1' */
export type ApiVersion = "v1" | "v2";

export const ApiConfig = {
  version: (import.meta.env.VITE_API_VERSION as ApiVersion) ?? "v1",
  baseUrl: (import.meta.env.VITE_API_BASE as string) ?? "https://api.humanizer.com",
  processing: (import.meta.env.VITE_PROCESSING_TARGET as "remote" | "local") ?? "remote",
};

const http = ky.create({ retry: 0, prefixUrl: ApiConfig.baseUrl });

/** Common shapes (stable across v1/v2) */
export const Gem = z.object({
  id: z.string(),
  title: z.string().default("Untitled"),
  snippet: z.string().optional(),
  tokens: z.number().optional(),
});
export type Gem = z.infer<typeof Gem>;

export const POVMWeights = z.object({
  T: z.number(), F: z.number(), B: z.number(), N: z.number(), alpha: z.number(),
});
export type POVMWeights = z.infer<typeof POVMWeights>;

export const Metrics = z.object({
  deltaCos: z.number().optional(),
  fidelity: z.number().optional(),
  rhoDelta: z.number().optional(),
  povmBefore: POVMWeights.optional(),
  povmAfter: POVMWeights.optional(),
});
export type Metrics = z.infer<typeof Metrics>;

/** API surface the UI expects; filled by v1 or v2 impls */
export interface WorkbenchAPI {
  listGems(q?: string): Promise<Gem[]>;
  getGem(id: string): Promise<{ gem: Gem; text: string }>;
  extractFacets(input: { text?: string; gemId?: string }): Promise<Record<string, unknown>>;
  evalPOVM(input: { text: string; axis: string }): Promise<POVMWeights>;
  rhoInspect(input: { text: string }): Promise<{ projections: number[] }>;
  rhoMove(input: {
    text?: string; gemId?: string;
    params: { axis: string; corner?: string; step?: number };
    guardrails?: { maxEdits?: number; fidelity?: number; toxicity?: boolean };
    chunking?: { strategy: "sentence"|"paragraph"|"window"; size?: number };
  }): Promise<{ text: string; metrics: Metrics }>;
}

/** V1 implementation (uses current routes) */
const v1: WorkbenchAPI = {
  async listGems(q) {
    const res = await http.get(`gems${q ? `?q=${encodeURIComponent(q)}` : ""}`).json<any>();
    return z.array(Gem).parse(res.items ?? res);
  },
  async getGem(id) {
    const res = await http.get(`gems/${id}`).json<any>();
    return { gem: Gem.parse(res.meta), text: String(res.text) };
  },
  async extractFacets(body) {
    const res = await http.post(`facets/extract`, { json: body }).json<any>();
    return res;
  },
  async evalPOVM(body) {
    const res = await http.post(`eval/povm`, { json: body }).json<any>();
    return POVMWeights.parse(res);
  },
  async rhoInspect(body) {
    const res = await http.post(`rho/inspect`, { json: body }).json<any>();
    return { projections: res.projections ?? [] };
  },
  async rhoMove(body) {
    const res = await http.post(`transform/rho-move`, { json: body }).json<any>();
    return { text: res.text, metrics: Metrics.parse(res.metrics ?? {}) };
  },
};

/** V2 implementation (drop-in once endpoints land) */
const v2: WorkbenchAPI = {
  async listGems(q){ const r=await http.get(`v2/narratives`,{searchParams:q?{q}:{}}).json<any>(); return z.array(Gem).parse(r.items); },
  async getGem(id){ const r=await http.get(`v2/narratives/${id}`).json<any>(); return { gem: Gem.parse(r.meta), text: String(r.text) }; },
  async extractFacets(b){ return http.post(`v2/facets/extract`,{json:b}).json<any>(); },
  async evalPOVM(b){ const r=await http.post(`v2/eval/povm`,{json:b}).json<any>(); return POVMWeights.parse(r); },
  async rhoInspect(b){ const r=await http.post(`v2/eval/rho`,{json:b}).json<any>(); return { projections: r.projections ?? [] }; },
  async rhoMove(b){ const r=await http.post(`v2/transform/rho-move`,{json:b}).json<any>(); return { text: r.text, metrics: Metrics.parse(r.metrics ?? {}) }; },
};

export const api: WorkbenchAPI = ApiConfig.version === "v2" ? v2 : v1;
