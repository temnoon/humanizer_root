import { ReactNode } from "react";
export function WorkbenchLayout({
  left, center, right, bottom,
}: { left: ReactNode; center: ReactNode; right: ReactNode; bottom?: ReactNode }) {
  return (
    <div className="grid h-screen grid-rows-[1fr_auto] bg-slate-950 text-slate-100">
      <div className="grid grid-cols-[320px_1fr_360px] gap-2 p-2">
        <aside className="rounded-lg bg-slate-900">{left}</aside>
        <main  className="rounded-lg bg-slate-900">{center}</main>
        <aside className="rounded-lg bg-slate-900">{right}</aside>
      </div>
      {bottom && <div className="p-2">{bottom}</div>}
    </div>
  );
}
