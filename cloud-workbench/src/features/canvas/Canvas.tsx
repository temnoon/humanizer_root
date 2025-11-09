import { Tabs } from "./Tabs";
export function Canvas() {
  return (
    <div className="h-full grid grid-rows-[40px_1fr]">
      <Tabs tabs={["Read","Dissect","Transform","Compare"]} />
      <div className="p-4 text-slate-200">Select a narrative from the Vault…</div>
    </div>
  );
}
