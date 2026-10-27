import { useEffect, useRef, useState } from "react";

import { shouldShowOptionList, type ListOption } from "@/lib/option-list";

type Props = {
  label: string;
  query: string;
  onQueryChange: (q: string) => void;
  placeholder: string;
  options: ListOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  emptyLabel?: string;
  loading?: boolean;
};

/** 搜尋＋可捲清單。揀完清空搜尋並收起，避免清單永遠開住。 */
export function OptionListPicker({
  label,
  query,
  onQueryChange,
  placeholder,
  options,
  selectedId,
  onSelect,
  emptyLabel = "冇符合項目",
  loading = false,
}: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);
  const open = shouldShowOptionList({ selectedId, query, focused });

  useEffect(() => {
    return () => {
      if (blurTimer.current != null) window.clearTimeout(blurTimer.current);
    };
  }, []);

  function choose(id: string) {
    if (blurTimer.current != null) window.clearTimeout(blurTimer.current);
    onSelect(id);
    onQueryChange("");
    setFocused(false);
    inputRef.current?.blur();
  }

  return (
    <div className="min-w-0">
      <label className="mb-1 block text-[11px] font-bold text-ink-2">{label}</label>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={() => {
          if (blurTimer.current != null) window.clearTimeout(blurTimer.current);
          setFocused(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setFocused(false), 200);
        }}
        placeholder={placeholder}
        aria-label={`${label}搜尋`}
        aria-expanded={open}
        autoComplete="off"
        className="w-full rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px]"
      />
      {open ? (
        <ul
          role="listbox"
          aria-label={label}
          className="mt-1 max-h-40 overflow-auto rounded-md border border-hairline bg-paper text-[12px]"
        >
          {loading ? (
            <li className="px-2 py-1.5 text-ink-3">載入清單…</li>
          ) : options.length === 0 ? (
            <li className="px-2 py-1.5 text-ink-3">{emptyLabel}</li>
          ) : (
            options.map((opt) => {
              const selected = opt.id === selectedId;
              return (
                <li key={opt.id || "__any__"} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-left ${
                      selected ? "bg-brown/10 font-bold text-ink" : "hover:bg-paper-2"
                    }`}
                    onPointerDown={(e) => {
                      if (e.pointerType === "mouse" && e.button !== 0) return;
                      e.preventDefault();
                      choose(opt.id);
                    }}
                    onClick={() => choose(opt.id)}
                  >
                    <span className="font-serif-tc">{opt.label}</span>
                    {opt.hint ? <span className="text-[10px] text-ink-3">{opt.hint}</span> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
