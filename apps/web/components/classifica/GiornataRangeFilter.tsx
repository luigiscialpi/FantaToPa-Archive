// apps/web/components/classifica/GiornataRangeFilter.tsx
"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

type GiornataRangeFilterProps = {
  seasonSlug: string;
  competitionSlug: string;
  min: number;
  max: number;
  from: number;
  to: number;
};

export function GiornataRangeFilter({
  seasonSlug,
  competitionSlug,
  min,
  max,
  from,
  to,
}: GiornataRangeFilterProps) {
  const router = useRouter();
  const isDefaultRange = from === min && to === max;

  // Stato locale per tracciare il drag senza navigare ad ogni tick
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  const [isDragging, setIsDragging] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (nextFrom: number, nextTo: number) => {
      startTransition(() => {
        router.push(
          `/stagioni/${seasonSlug}/classifica?competizione=${competitionSlug}&da=${nextFrom}&a=${nextTo}`,
        );
      });
    },
    [router, seasonSlug, competitionSlug],
  );

  // Debounce: naviga solo quando l'utente rilascia lo slider
  const commit = useCallback(
    (nextFrom: number, nextTo: number) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        navigate(nextFrom, nextTo);
      }, 300);
    },
    [navigate],
  );

  function handleFromChange(value: number) {
    const clamped = Math.min(value, localTo);
    setLocalFrom(clamped);
    if (!isDragging) commit(clamped, localTo);
  }

  function handleToChange(value: number) {
    const clamped = Math.max(value, localFrom);
    setLocalTo(clamped);
    if (!isDragging) commit(localFrom, clamped);
  }

  function handlePointerUp() {
    setIsDragging(false);
    commit(localFrom, localTo);
  }

  function handleReset() {
    setLocalFrom(min);
    setLocalTo(max);
    navigate(min, max);
  }

  // Percentuali per la traccia colorata
  const range = max - min || 1;
  const leftPercent = ((localFrom - min) / range) * 100;
  const rightPercent = ((localTo - min) / range) * 100;

  return (
    <div className="mb-4 rounded-xl bg-white border border-stone-200 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-3">
        {isPending && <LoaderCircle size={12} aria-hidden className="shrink-0 animate-spin" />}
        {isPending
          ? "Ricalcolo la classifica sull'intervallo scelto\u2026"
          : "Classifica calcolata sull'intervallo di giornate scelto"}
      </div>

      {/* Valori correnti */}
      <div className="flex items-center justify-between mb-1 text-sm font-medium text-stone-700">
        <span className="tabular-nums">{localFrom}ª giornata</span>
        <span className="tabular-nums">{localTo}ª giornata</span>
      </div>

      {/* Dual range slider */}
      <div className="relative h-6 flex items-center">
        {/* Track di sfondo */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-stone-200" />

        {/* Track selezionata */}
        <div
          className="absolute h-1.5 rounded-full bg-brand-600"
          style={{
            left: `${leftPercent}%`,
            width: `${rightPercent - leftPercent}%`,
          }}
        />

        {/* Input "from" */}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={localFrom}
          onChange={(e) => handleFromChange(Number(e.target.value))}
          onPointerDown={() => setIsDragging(true)}
          onPointerUp={handlePointerUp}
          onKeyUp={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              commit(localFrom, localTo);
            }
          }}
          className="slider-thumb absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none h-1.5"
          aria-label="Giornata iniziale"
        />

        {/* Input "to" */}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={localTo}
          onChange={(e) => handleToChange(Number(e.target.value))}
          onPointerDown={() => setIsDragging(true)}
          onPointerUp={handlePointerUp}
          onKeyUp={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              commit(localFrom, localTo);
            }
          }}
          className="slider-thumb absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none h-1.5"
          aria-label="Giornata finale"
        />
      </div>

      {/* Reset */}
      {!isDefaultRange && (
        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-semibold text-brand-800 hover:underline"
          >
            Reimposta stagione intera
          </button>
        </div>
      )}

      {/* Stili per i thumb (necessari perché Tailwind non copre ::-webkit-slider-thumb) */}
      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          pointer-events: auto;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #fff;
          border: 2px solid #2556b8;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
          cursor: grab;
          transition: box-shadow 0.15s ease;
        }
        .slider-thumb::-webkit-slider-thumb:active {
          cursor: grabbing;
          box-shadow: 0 0 0 4px rgba(37, 86, 184, 0.2);
        }
        .slider-thumb::-moz-range-thumb {
          pointer-events: auto;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #fff;
          border: 2px solid #2556b8;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
          cursor: grab;
        }
        .slider-thumb::-moz-range-thumb:active {
          cursor: grabbing;
          box-shadow: 0 0 0 4px rgba(37, 86, 184, 0.2);
        }
        .slider-thumb:focus-visible::-webkit-slider-thumb {
          outline: 2px solid #2556b8;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
