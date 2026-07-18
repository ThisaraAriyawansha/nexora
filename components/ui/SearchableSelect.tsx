"use client";
import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown, Check } from "lucide-react";

export interface SearchableSelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyText = "No matches",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.sublabel?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="nexora-input w-full flex items-center justify-between text-left gap-2"
      >
        <span className={`truncate ${selected ? "text-black" : "text-zinc-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className="text-zinc-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-64 flex flex-col">
          <div className="relative p-2 border-b border-zinc-100 shrink-0">
            <Search size={13} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              className="nexora-input pl-8 text-sm py-1.5"
              placeholder="Search by name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-4">{emptyText}</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center justify-between gap-2"
                >
                  <span className="truncate">{o.label}</span>
                  {o.id === value && <Check size={13} className="text-green-500 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
