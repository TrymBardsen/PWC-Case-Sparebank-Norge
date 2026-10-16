// Sammenleggbar seksjon på startsiden: lukket som standard, så siden kan skummes
export function Seksjon({ tittel, undertittel, children, apen = false }: { tittel: string; undertittel?: string; children: React.ReactNode; apen?: boolean }) {
  return (
    <details open={apen} className="group rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-overskrift text-lg font-bold text-snb-rod">{tittel}</span>
          {undertittel && <span className="block text-xs text-slate-500">{undertittel}</span>}
        </span>
        <span className="text-sm font-semibold text-snb-rod">
          <span className="group-open:hidden">Vis</span>
          <span className="hidden group-open:inline">Skjul</span>
        </span>
      </summary>
      {/* Kortet inni har sin egen overskrift; den skjules så tittelen ikke står to ganger */}
      <div className="px-2 pb-2 [&>section]:border-0 [&>section]:pt-0 [&>section>div:first-child]:hidden">{children}</div>
    </details>
  );
}
