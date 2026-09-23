import { useCallback, useEffect, useRef, useState } from "react";
import { getSuggestions, getRecents, getTrending } from "../services/api";

const SearchIcon = () => (
  <svg className="s-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const ClockIcon = () => (
  <svg className="s-icon dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

const TrendIcon = () => (
  <svg className="s-icon dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M21 3h-6v6" />
  </svg>
);

const ArrowIcon = () => (
  <svg className="s-icon dim s-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17L17 7" />
    <path d="M8 7h9v9" />
  </svg>
);

const ClearIcon = () => (
  <svg className="s-icon dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const DEBOUNCE_MS = 120;

const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]); // { text, type }
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const seqRef = useRef(0);

  const resetDropdown = () => {
    setOpen(false);
    setHighlight(-1);
    setItems([]);
  };

  const commit = useCallback(
    (text) => {
      const q = (text ?? "").trim();
      setQuery(q);
      resetDropdown();
      onSearch(q);
    },
    [onSearch]
  );

  // Dropdown content:
  //  - empty query -> recents, then trending (Google-style)
  //  - typing      -> debounced suggestions from the search engine
  const refresh = useCallback(async (value) => {
    const seq = ++seqRef.current;
    const trimmed = value.trim();

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let list = [];
      if (!trimmed) {
        const [r, t] = await Promise.all([getRecents(), getTrending()]);
        if (seq !== seqRef.current) return;
        list = [
          ...r.data.recents.map((text) => ({ text, type: "recent" })),
          ...t.data.trending
            .filter((text) => !r.data.recents.includes(text))
            .map((text) => ({ text, type: "trending" })),
        ].slice(0, 8);
      } else {
        const res = await getSuggestions(trimmed);
        if (seq !== seqRef.current) return;
        list = res.data.suggestions;
      }
      setItems(list);
      setOpen(true);
      setHighlight(-1);
    } catch (err) {
      if (err?.name !== "AbortError" && err?.code !== "ERR_CANCELED") {
        console.warn("[suggest] failed:", err?.message || err);
      }
      /* aborted or backend down — keep the dropdown as-is */
    }
  }, []);

  // Debounce every query change (typing always refreshes suggestions,
  // whether or not the dropdown is currently open).
  useEffect(() => {
    const t = setTimeout(() => refresh(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, refresh]);

  const handleBlur = () => setTimeout(() => setOpen(false), 150);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        refresh(query);
        return;
      }
      setHighlight((h) => {
        const n = items.length;
        if (!n) return -1;
        return e.key === "ArrowDown" ? (h + 1) % n : (h - 1 + n) % n;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlight >= 0 && items[highlight]) commit(items[highlight].text);
      else commit(query);
    } else if (e.key === "Escape") {
      if (open) resetDropdown();
      else commit("");
    }
  };

  // Click outside closes the dropdown.
  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="search-shell" ref={boxRef}>
      <div className={`searchbar ${open ? "is-open" : ""}`}>
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search tasks…"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => refresh(query)}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          aria-label="Search tasks"
          aria-expanded={open}
          role="combobox"
        />
        {query && (
          <button className="s-clear" onClick={() => commit("")} aria-label="Clear search">
            <ClearIcon />
          </button>
        )}
        <button className="btn-primary s-go" onClick={() => commit(query)}>
          Search
        </button>
      </div>

      {open && (
        <ul className="suggestions glass" role="listbox">
          {items.length === 0 ? (
            <li className="s-empty">No matching suggestions</li>
          ) : (
            items.map((item, i) => (
              <li
                key={`${item.type}-${item.text}`}
                role="option"
                aria-selected={highlight === i}
                className={`s-item ${highlight === i ? "is-active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(item.text);
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                {item.type === "recent" ? (
                  <ClockIcon />
                ) : item.type === "trending" ? (
                  <TrendIcon />
                ) : (
                  <SearchIcon />
                )}
                <span className="s-text">{item.text}</span>
                <span className={`s-badge s-${item.type}`}>{item.type}</span>
                <ArrowIcon />
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;
