import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Om projektet",
  description: "Hvordan Maanslogen er bygget, og hvorfor attributterne er dynamiske.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Om Maanslogen</h1>

      <div className="mt-6 flex flex-col gap-5 leading-relaxed text-ink-soft">
        <p>
          Maanslogen er et anmeldelsessystem for drikkevarer, bygget på én idé: en øl og en vin skal
          ikke beskrives med de samme felter. Derfor er både egenskaber og anmeldelsesspørgsmål data
          frem for kode.
        </p>
        <p>
          En <strong className="text-ink">attributdefinition</strong> siger hvad en drikkevare
          <em> kan</em> have — alkoholprocent, bitterhed, fadtype — og hvilke kategorier og typer
          den gælder for. Et <strong className="text-ink">spørgsmål</strong> gør det samme for
          anmeldelserne. Begge dele redigeres i admin, og ingen af delene kræver en udrulning eller
          en datamigrering.
        </p>
        <p>
          Konsekvensen er, at kataloget kan filtrere på felter der ikke fandtes i sidste uge, og at
          smagsprofilen på en drikkevare kan sammenfatte 200 menneskers svar på “hvor bitter er
          den?” — fordi svaret er gemt som et tal og ikke som fritekst.
        </p>
        <p>
          Gamle anmeldelser bliver aldrig ændret. Tilføjes et spørgsmål i dag, har gårsdagens
          anmeldelser bare ikke besvaret det.
        </p>
      </div>
    </div>
  );
}
