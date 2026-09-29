/**
 * Arrangementsfladen har hverken sidehoved eller sidefod.
 *
 * Den bruges stående, med en telefon i den ene hånd og et glas i den anden.
 * Sidehovedet er 56 px plus en mobil-navrække på ~36 px, og sidefoden ligger
 * nedenunder — omkring en tredjedel af en telefonskærm brugt på navigation væk
 * fra netop den side man står og bruger. Her er der i stedet én slank bjælke
 * med vej tilbage, og resten er arrangementet.
 *
 * Det er en rutegruppe, så adressen er uændret: `/arrangementer/{slug}`.
 * Der skal altså ikke noget subdomæne til for at få fladen ren.
 *
 * `id="indhold"` skal med: rodlayoutets "Spring til indhold" peger på den, og
 * uden den ville springet lande ingen steder.
 */
export default function ArrangementLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main id="indhold" className="flex-1">
        {children}
      </main>
    </div>
  );
}
