export function Tabs({ tabs }: { tabs: string[] }) {
  return (
    <div className="flex gap-2 p-2 border-b border-slate-800">
      {tabs.map(t=> <button key={t} className="px-3 py-1 rounded bg-slate-800">{t}</button>)}
    </div>
  );
}
