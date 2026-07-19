import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { C } from "../../lib/tokens";

// Renders only the rows actually visible on screen (plus a small
// overscan buffer), regardless of how many items are in the array.
// The full dataset is already in memory (fetched once, cheaply — see
// the callers), so search filters instantly with no extra network
// request; only the DOM cost is windowed, since that's the only part
// that actually gets expensive at large list sizes.
export default function VirtualList({ items, rowHeight = 64, searchKeys = [], searchPlaceholder = "Search…", renderRow, emptyLabel = "Nothing here." }) {
  const [query, setQuery] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  const containerRef = useRef(null);

  useEffect(() => {
    const measure = () => { if (containerRef.current) setViewportHeight(containerRef.current.clientHeight); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => searchKeys.some((k) => String(item[k] || "").toLowerCase().includes(q)));
  }, [items, query, searchKeys]);

  // Typing a search can shrink the list a lot while scrolled far down —
  // the browser doesn't fire a scroll event just because content got
  // shorter, so our windowing math would stay stuck computing a window
  // that no longer exists, showing a blank view until the person
  // manually scrolls. Snap back to the top on every new search instead.
  useEffect(() => {
    setScrollTop(0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [query]);

  const overscan = 6;
  const maxScrollTop = Math.max(0, filtered.length * rowHeight - viewportHeight);
  const clampedScrollTop = Math.min(scrollTop, maxScrollTop);
  const startIndex = Math.max(0, Math.floor(clampedScrollTop / rowHeight) - overscan);
  const endIndex = Math.min(filtered.length, Math.ceil((clampedScrollTop + viewportHeight) / rowHeight) + overscan);
  const visible = filtered.slice(startIndex, endIndex);

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
      <div className="flex items-center gap-2 rounded-xl px-3 mx-5 mb-3" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, flexShrink: 0 }}>
        <Search size={15} color={C.ink40} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder}
          className="flex-1 bg-transparent outline-none" style={{ color: C.parchment, fontSize: 13.5, padding: "10px 4px", border: "none" }} />
        <span style={{ color: C.ink40, fontSize: 11 }}>{filtered.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: C.ink40, fontSize: 13.5, textAlign: "center", marginTop: 24 }}>{emptyLabel}</div>
      ) : (
        <div ref={containerRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} className="flex-1 overflow-y-auto px-5" style={{ minHeight: 0 }}>
          <div style={{ height: filtered.length * rowHeight, position: "relative" }}>
            {visible.map((item, i) => (
              <div key={item.id ?? startIndex + i} style={{ position: "absolute", top: (startIndex + i) * rowHeight, left: 0, right: 0, height: rowHeight - 8, paddingBottom: 8 }}>
                {renderRow(item)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
