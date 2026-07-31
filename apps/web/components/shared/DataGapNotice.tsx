// apps/web/components/shared/DataGapNotice.tsx
//
// Banner informativo per pagine/stagioni con dati sorgente mancanti o
// ricostruiti da fonti diverse da quella originale della lega (es. rose
// 2022-2023, senza Rose_fantatopa.xlsx — vedi legacy-seasons-compat.md).
// Componente generico e riusabile: ogni pagina passa il proprio messaggio,
// nessuna logica di quali stagioni/pagine mostrarlo qui dentro.
type DataGapNoticeProps = {
  message: string;
};

export function DataGapNotice({ message }: DataGapNoticeProps) {
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {message}
    </div>
  );
}
