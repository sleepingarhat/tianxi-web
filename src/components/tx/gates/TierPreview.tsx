import { createContext, useState, type ReactNode } from "react";
export const TierPreviewContext = createContext(false);

/** Development-only downgrade. It cannot grant Pro or change server authorization. */
export function TierPreviewProvider({ children }: { children: ReactNode }) {
  const [registered, setRegistered] = useState(false);
  return <TierPreviewContext.Provider value={import.meta.env.DEV && registered}>
    {children}
    {import.meta.env.DEV && <label className="fixed bottom-20 right-2 z-50 grid gap-1 rounded-md border border-hairline bg-paper px-2 py-1 text-[10px] text-ink-2">
      會籍驗收
      <select aria-label="會籍驗收" value={registered ? "registered" : "actual"} onChange={e => setRegistered(e.target.value === "registered")} className="bg-paper text-ink">
        <option value="actual">真實會籍</option><option value="registered">開閘後第201名・未訂閱</option>
      </select>
    </label>}
  </TierPreviewContext.Provider>;
}