/**
 * Campo de texto com autocomplete de clientes/leads.
 * Sugestões vêm de duas fontes com badge de origem.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useCRM } from "../state/crm-context";

type Suggestion = {
  nome: string;
  origem: "cliente" | "lead";
  detalhe?: string; // telefone ou etapa do lead
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function ClientAutocomplete({ value, onChange, placeholder = "Nome do cliente", className }: Props) {
  const { clients, leads } = useCRM();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── build suggestion list ───────────────────────────────────────────── */
  const suggestions = useMemo<Suggestion[]>(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];

    const seen = new Set<string>();
    const results: Suggestion[] = [];

    // Clientes cadastrados
    for (const c of clients) {
      if (c.nome.toLowerCase().includes(q) && !seen.has(c.nome)) {
        seen.add(c.nome);
        const phones = [c.telefone, c.telefone2, c.telefone3].filter(Boolean).join(" · ");
        results.push({ nome: c.nome, origem: "cliente", detalhe: phones || c.telefone });
      }
    }

    // Leads
    for (const l of leads) {
      if (l.nome.toLowerCase().includes(q) && !seen.has(l.nome)) {
        seen.add(l.nome);
        results.push({ nome: l.nome, origem: "lead", detalhe: l.origem });
      }
    }

    return results.slice(0, 8);
  }, [value, clients, leads]);

  // Reset active index when suggestions change
  useEffect(() => {
    setActiveIdx(0);
  }, [suggestions.length]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function pick(nome: string) {
    onChange(nome);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && suggestions[activeIdx]) {
      e.preventDefault();
      pick(suggestions[activeIdx].nome);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        className={className}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {showDropdown && (
        <ul className="autocomplete-list" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s.nome}
              role="option"
              aria-selected={i === activeIdx}
              className={`autocomplete-item ${i === activeIdx ? "active" : ""}`}
              onMouseDown={(e) => {
                // mousedown before blur so we can pick before input loses focus
                e.preventDefault();
                pick(s.nome);
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="autocomplete-nome">{highlight(s.nome, value)}</span>
              <span className="autocomplete-meta">
                {s.detalhe && <span className="autocomplete-detalhe">{s.detalhe}</span>}
                <span className={`autocomplete-badge ${s.origem}`}>
                  {s.origem === "cliente" ? "Cliente" : "Lead"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Highlight matching text ──────────────────────────────────────────────── */

function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
