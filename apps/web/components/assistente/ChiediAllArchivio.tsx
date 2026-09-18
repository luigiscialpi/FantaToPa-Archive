"use client";

import { useState, useRef, useEffect, useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Search,
  Loader2,
  AlertCircle,
  ServerCrash,
  Wifi,
  WifiOff,
  ChevronDown,
} from "lucide-react";

// ─── Tipi ────────────────────────────────────────────────────────────────────

type TipoErrore =
  | "fuori_tema"
  | "identita_mancante"
  | "non_generabile"
  | "errore_servizio_ia"
  | "errore_temporaneo";

interface ModelloUtilizzato {
  id: string;
  fallback: boolean;
}

interface Risultato {
  risposta: string;
  sql?: string;
  righe?: unknown;
  tipoErrore?: TipoErrore;
  modello?: ModelloUtilizzato;
  modelloSql?: ModelloUtilizzato;
}

type StatoPing = "idle" | "loading" | "online" | "offline";

interface DatiPing {
  latenzaMs: number;
  errore?: string;
}

// ─── Errore visivo ────────────────────────────────────────────────────────────

function useErroreVisivo(tipoErrore: TipoErrore | undefined) {
  if (tipoErrore === "errore_servizio_ia") {
    return {
      bordo: "border-amber-200/80 bg-amber-50/70",
      testo: "text-amber-900",
      Icona: ServerCrash,
      iconaClasse: "text-amber-500",
      titolo: "Servizio temporaneamente non disponibile",
    };
  }

  if (tipoErrore) {
    return {
      bordo: "border-red-200/80 bg-red-50/70",
      testo: "text-red-900",
      Icona: AlertCircle,
      iconaClasse: "text-red-500",
      titolo: "Non è stato possibile completare la ricerca",
    };
  }

  return null;
}

// ─── Stato IA ─────────────────────────────────────────────────────────────────

function StatoPill() {
  const [stato, setStato] = useState<StatoPing>("idle");
  const [dati, setDati] = useState<DatiPing | null>(null);

  async function eseguiPing() {
    if (stato === "loading") return;

    setStato("loading");
    setDati(null);

    try {
      const res = await fetch("/api/assistente/ping");
      const json = (await res.json()) as {
        ok: boolean;
        latenzaMs: number;
        errore?: string;
      };

      setDati({
        latenzaMs: json.latenzaMs,
        errore: json.errore,
      });

      setStato(json.ok ? "online" : "offline");
    } catch {
      setDati(null);
      setStato("offline");
    }
  }

  const config = {
    idle: {
      pill: "border-stone-200 bg-white text-stone-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700",
      label: "Verifica IA",
    },

    loading: {
      pill: "border-stone-200 bg-white text-stone-400",
      label: "Verifico…",
    },

    online: {
      pill: "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
      label: dati ? `Online · ${dati.latenzaMs} ms` : "Online",
    },

    offline: {
      pill: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
      label: "Non disponibile",
    },
  }[stato];

  return (
    <button
      type="button"
      onClick={eseguiPing}
      disabled={stato === "loading"}
      title={
        stato === "offline" && dati?.errore
          ? dati.errore
          : stato === "idle"
            ? "Verifica se l'assistente IA è raggiungibile"
            : undefined
      }
      aria-label={
        stato === "idle"
          ? "Verifica disponibilità dell'assistente IA"
          : config.label
      }
      className={[
        "inline-flex items-center gap-1.5",
        "rounded-full border px-2.5 py-1",
        "text-[11px] font-medium leading-none",
        "transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2",
        "focus-visible:ring-brand-300 focus-visible:ring-offset-1",
        config.pill,
      ].join(" ")}
    >
      {stato === "loading" ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : stato === "online" ? (
        <span className="relative flex h-3 w-3 items-center justify-center">
          <span className="absolute h-2 w-2 rounded-full bg-green-400 opacity-40 animate-ping" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-green-500" />
        </span>
      ) : stato === "offline" ? (
        <WifiOff className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Wifi className="h-3 w-3" aria-hidden="true" />
      )}

      <span>{config.label}</span>
    </button>
  );
}

function ModelloMetadata({
  modello,
  modelloSql,
}: {
  modello?: ModelloUtilizzato;
  modelloSql?: ModelloUtilizzato;
}) {
  if (!modello) return null;

  const modelliDiversi = modelloSql && modelloSql.id !== modello.id;

  return (
    <div className="mt-4 border-t border-stone-100 pt-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-stone-400">
        <span className="inline-flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 rounded-full bg-brand-400"
            aria-hidden="true"
          />
          {modello.id}
        </span>

        {modello.fallback && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-amber-600">fallback</span>
          </>
        )}
      </div>

      {modelliDiversi && (
        <details className="mt-1.5">
          <summary className="cursor-pointer list-none text-[10px] text-stone-400 hover:text-stone-600 [&::-webkit-details-marker]:hidden">
            Dettagli elaborazione
          </summary>

          <div className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-[10px] leading-5 text-stone-500">
            <div>
              Query:{" "}
              <span className="font-mono text-stone-600">{modelloSql.id}</span>
              {modelloSql.fallback && (
                <span className="ml-1 text-amber-600">(fallback)</span>
              )}
            </div>

            <div>
              Risposta:{" "}
              <span className="font-mono text-stone-600">{modello.id}</span>
              {modello.fallback && (
                <span className="ml-1 text-amber-600">(fallback)</span>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Componente principale ────────────────────────────────────────────────────

export function ChiediAllArchivio({
  placeholder = "Es. Quale squadra ha vinto più campionati?",
  isAdmin = false,
}: {
  placeholder?: string;
  isAdmin?: boolean;
}) {
  const [domanda, setDomanda] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [risultato, setRisultato] = useState<Risultato | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const risultatoId = useId();

  // ───────────────────────────────────────────────────────────────────────────
  // Auto-grow controllato.
  //
  // Importante: non nascondiamo mai il testo. Il campo parte da 52px,
  // cresce fino a 140px e poi diventa scrollabile.
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";

    const nextHeight = Math.min(Math.max(el.scrollHeight, 52), 140);

    el.style.height = `${nextHeight}px`;
  }, [domanda]);

  // ───────────────────────────────────────────────────────────────────────────
  // Submit
  // ───────────────────────────────────────────────────────────────────────────

  async function invia() {
    const domandaPulita = domanda.trim();

    if (!domandaPulita || caricamento) return;

    setCaricamento(true);
    setRisultato(null);

    try {
      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domanda: domandaPulita,
        }),
      });

      const data = await res.json();

      setRisultato(
        res.ok
          ? data
          : {
              risposta: data.error ?? "Errore imprevisto.",
              tipoErrore: "errore_temporaneo",
            },
      );
    } catch {
      setRisultato({
        risposta: "Errore di rete, riprova.",
        tipoErrore: "errore_temporaneo",
      });
    } finally {
      setCaricamento(false);
    }
  }

  const erroreVisivo = useErroreVisivo(risultato?.tipoErrore);

  const domandaValida = domanda.trim().length > 0;

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className={[
        "overflow-hidden rounded-2xl",
        "border border-brand-200/80",
        "bg-brand-50",
        "shadow-sm",
      ].join(" ")}
    >
      {/* ─────────────────────────────────────────────────────────────────────
          HEADER
      ───────────────────────────────────────────────────────────────────── */}

      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-500">
              Chiedi all&apos;Archivio
            </p>

            <h2
              id={`${inputId}-title`}
              className="mt-1 font-serif text-lg font-bold leading-tight text-brand-950 sm:text-xl"
            >
              Una domanda, tutte le stagioni
            </h2>

            <p className="mt-1.5 max-w-xl text-xs leading-5 text-stone-500 sm:text-sm">
              Cerca giocatori, squadre, risultati e statistiche storiche.
            </p>
          </div>

          <div className="shrink-0 pt-0.5">
            <StatoPill />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          COMPOSER
      ───────────────────────────────────────────────────────────────────── */}

      <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        <label htmlFor={inputId} className="sr-only">
          La tua domanda
        </label>

        <div
          className={[
            "relative flex items-end",
            "rounded-xl border bg-white",
            "shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
            "transition-all duration-150",
            "border-brand-200",
            "focus-within:border-brand-400",
            "focus-within:ring-4 focus-within:ring-brand-100",
          ].join(" ")}
        >
          {/* Area di scrittura */}
          <textarea
            id={inputId}
            ref={textareaRef}
            value={domanda}
            onChange={(e) => setDomanda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                invia();
              }
            }}
            placeholder={placeholder}
            disabled={caricamento}
            rows={1}
            aria-describedby={`${inputId}-hint`}
            aria-controls={risultatoId}
            aria-busy={caricamento}
            className={[
              "min-h-[52px]",
              "max-h-[140px]",
              "min-w-0 flex-1",
              "resize-none",
              "overflow-y-auto",
              "border-0 bg-transparent",
              "px-3.5 py-3",
              "pr-1",
              "text-sm leading-6",
              "text-brand-950",
              "placeholder:text-stone-400",
              "focus:outline-none focus:ring-0",
              "disabled:cursor-not-allowed",
              "disabled:opacity-60",
              "sm:px-4",
            ].join(" ")}
          />

          {/* CTA */}
          <div className="shrink-0 p-1.5">
            <button
              type="button"
              onClick={invia}
              disabled={caricamento || !domandaValida}
              aria-label={caricamento ? "Ricerca in corso" : "Invia domanda"}
              className={[
                "flex h-10 w-10 items-center justify-center",
                "rounded-lg",
                "transition-all duration-150",
                "focus:outline-none focus-visible:ring-2",
                "focus-visible:ring-brand-300",
                "focus-visible:ring-offset-1",
                domandaValida && !caricamento
                  ? [
                      "bg-brand-400 text-brand-950",
                      "hover:bg-brand-500",
                      "active:scale-[0.97]",
                    ].join(" ")
                  : "bg-stone-100 text-stone-300",
                "disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {caricamento ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Hint tastiera */}
        <div
          id={`${inputId}-hint`}
          className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-stone-400 sm:text-[11px]"
        >
          <span>
            {domandaValida
              ? "Premi Invio per cercare"
              : "Scrivi una domanda per iniziare"}
          </span>

          <span className="hidden sm:inline">
            Shift + Invio per andare a capo
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          RISULTATO
      ───────────────────────────────────────────────────────────────────── */}

      {risultato && (
        <div
          id={risultatoId}
          aria-live="polite"
          className="border-t border-brand-200/70 px-4 pb-4 pt-4 sm:px-5 sm:pb-5"
        >
          {/* Domanda dell'utente */}
          {/*           <div className="mb-3 flex items-start gap-2">
            <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />

            <p className="min-w-0 text-xs leading-5 text-stone-500">
              <span className="font-medium text-stone-600">Hai chiesto:</span>{" "}
              <span className="break-words">{domanda.trim()}</span>
            </p>
          </div> */}

          {/* ────────────────────────────────────────────────────────────────
              ERRORE
          ──────────────────────────────────────────────────────────────── */}

          {erroreVisivo ? (
            <div
              className={["rounded-xl border p-3.5", erroreVisivo.bordo].join(
                " ",
              )}
              role="alert"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <erroreVisivo.Icona
                    className={["h-4 w-4", erroreVisivo.iconaClasse].join(" ")}
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0">
                  <p
                    className={[
                      "text-xs font-semibold",
                      erroreVisivo.testo,
                    ].join(" ")}
                  >
                    {erroreVisivo.titolo}
                  </p>

                  <p
                    className={[
                      "mt-0.5 text-sm leading-5",
                      erroreVisivo.testo,
                    ].join(" ")}
                  >
                    {risultato.risposta}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ──────────────────────────────────────────────────────────
                  RISPOSTA MARKDOWN
              ────────────────────────────────────────────────────────── */}

              <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm sm:p-5">
                <div className="text-sm leading-6 text-stone-700">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p className="mb-3 last:mb-0">{children}</p>
                      ),

                      strong: ({ children }) => (
                        <strong className="font-semibold text-stone-900">
                          {children}
                        </strong>
                      ),

                      em: ({ children }) => (
                        <em className="text-stone-600">{children}</em>
                      ),

                      ul: ({ children }) => (
                        <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">
                          {children}
                        </ul>
                      ),

                      ol: ({ children }) => (
                        <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">
                          {children}
                        </ol>
                      ),

                      li: ({ children }) => (
                        <li className="pl-0.5">{children}</li>
                      ),

                      h1: ({ children }) => (
                        <h1 className="mb-2 mt-4 font-serif text-lg font-bold text-brand-950 first:mt-0">
                          {children}
                        </h1>
                      ),

                      h2: ({ children }) => (
                        <h2 className="mb-2 mt-4 font-serif text-base font-bold text-brand-950 first:mt-0">
                          {children}
                        </h2>
                      ),

                      h3: ({ children }) => (
                        <h3 className="mb-1.5 mt-3 text-sm font-semibold text-brand-950 first:mt-0">
                          {children}
                        </h3>
                      ),

                      blockquote: ({ children }) => (
                        <blockquote className="my-3 border-l-2 border-brand-300 pl-3 text-stone-500">
                          {children}
                        </blockquote>
                      ),

                      code: ({ children, className }) => {
                        const isBlock = className?.includes("language-");

                        if (isBlock) {
                          return (
                            <code
                              className={[
                                "block whitespace-pre",
                                "font-mono text-xs leading-5",
                              ].join(" ")}
                            >
                              {children}
                            </code>
                          );
                        }

                        return (
                          <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.9em] text-stone-700">
                            {children}
                          </code>
                        );
                      },

                      pre: ({ children }) => (
                        <pre className="my-3 overflow-x-auto rounded-lg bg-stone-950 p-3 text-stone-100">
                          {children}
                        </pre>
                      ),

                      table: ({ children }) => (
                        <div className="my-3 -mx-1 overflow-x-auto rounded-lg border border-stone-200">
                          <table className="w-full min-w-max border-collapse text-xs">
                            {children}
                          </table>
                        </div>
                      ),

                      thead: ({ children }) => (
                        <thead className="bg-stone-50">{children}</thead>
                      ),

                      tbody: ({ children }) => <tbody>{children}</tbody>,

                      th: ({ children }) => (
                        <th className="border-b border-stone-200 px-3 py-2 text-left font-semibold whitespace-nowrap text-stone-600">
                          {children}
                        </th>
                      ),

                      td: ({ children }) => (
                        <td className="border-b border-stone-100 px-3 py-2 align-top last:border-0">
                          {children}
                        </td>
                      ),

                      tr: ({ children }) => (
                        <tr className="even:bg-stone-50/50">{children}</tr>
                      ),

                      a: ({ children, href }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 hover:text-brand-800"
                        >
                          {children}
                        </a>
                      ),

                      hr: () => <hr className="my-4 border-stone-200" />,
                    }}
                  >
                    {risultato.risposta}
                  </ReactMarkdown>
                  <ModelloMetadata
                    modello={risultato.modello}
                    modelloSql={risultato.modelloSql}
                  />
                </div>
              </div>

              {/* ──────────────────────────────────────────────────────────
                  SQL (visibile solo per amministratori)
              ────────────────────────────────────────────────────────── */}

              {isAdmin && risultato.sql && (
                <details className="group mt-2.5 overflow-hidden rounded-xl border border-stone-200/80 bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-700 [&::-webkit-details-marker]:hidden">
                    <span>Mostra query generata</span>

                    <ChevronDown
                      className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>

                  <div className="border-t border-stone-200 bg-stone-50 p-3">
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-stone-600">
                      {risultato.sql}
                    </pre>
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
