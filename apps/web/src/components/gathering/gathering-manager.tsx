"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import type { GatheringDetail, User } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, NativeSelect, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { STATUS_ETIKETTER } from "@/lib/arrangementer";
import { formatTime } from "@/lib/format";
import { AddItemSheet } from "./add-item-sheet";

/**
 * Værtens betjeningspanel. Alt herinde er admin-ruter i API'et; fladen
 * gentager ikke reglerne, den kalder bare og lader svaret bestemme.
 *
 * Hvert kald svarer med hele arrangementet igen, og `router.refresh()` i
 * `useApiMutation` henter server-komponenterne påny — derfor holdes der ingen
 * kopi af listen i state her, som kunne komme ud af trit med databasen.
 *
 * Den står to steder: i admin på hovedværten, og i arrangementsfladen, hvor
 * den er den eneste vej til styringen på arrangementsværten. Derfor ligger den
 * her frem for under `components/admin` — og derfor er knapperne 44px. Panelet
 * bliver brugt stående, midt i en smagning, af den der skal trykke "skænk nu".
 *
 * `efterSletning` er hvor man havner når arrangementet er slettet: siden man
 * stod på findes ikke længere bagefter. Den kommer udefra, fordi de to flader
 * hører til hver sit sted.
 */
export function GatheringManager({
  detail,
  kandidater,
  efterSletning,
}: {
  detail: GatheringDetail;
  kandidater: User[];
  efterSletning: Route;
}) {
  const router = useRouter();
  const { pending, fieldErrors, run } = useApiMutation();

  const [story, setStory] = useState(detail.story ?? "");
  const [valgtBruger, setValgtBruger] = useState("");
  const [tilfoejAaben, setTilfoejAaben] = useState(false);

  const inviterede = new Set(detail.attendees.map((attendee) => attendee.userId));
  const kanInviteres = kandidater.filter((bruger) => !inviterede.has(bruger.id));
  const udgivet = detail.publishedAt !== null;

  return (
    <div className="grid gap-6">
      <Panel title="Status" tone="accent">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="neutral">{STATUS_ETIKETTER[detail.status]}</Badge>

          <NativeSelect
            value={detail.status}
            disabled={pending}
            onChange={(event) =>
              void run(
                () =>
                  api.gatherings.update(detail.id, {
                    status: event.target.value as GatheringDetail["status"],
                  }),
                { success: "Status er ændret" },
              )
            }
            className="w-auto"
          >
            <option value="PLANNED">Planlagt — noterne er lukkede</option>
            <option value="LIVE">I gang — deltagerne kan skrive</option>
            <option value="DONE">Slut</option>
          </NativeSelect>

          <div className="ml-auto flex gap-2">
            {udgivet ? (
              <Button
                variant="secondary"
                size="md"
                disabled={pending}
                onClick={() =>
                  void run(() => api.gatherings.unpublish(detail.id), {
                    success: "Låst op igen",
                  })
                }
              >
                Lås op
              </Button>
            ) : (
              <Button
                size="md"
                disabled={pending}
                onClick={() =>
                  void run(() => api.gatherings.publish(detail.id), {
                    success: "Opslaget er udgivet",
                  })
                }
              >
                Udgiv opslaget
              </Button>
            )}
          </div>
        </div>

        <p className="mt-3 text-sm text-ink-muted">
          {udgivet
            ? "Opslaget er ude hos deltagerne, og noterne er låst. Lås op hvis noget skal rettes."
            : "Udgivelse viser teksten til deltagerne og fryser noterne. Uden det kunne aftenen skrives om bagefter."}
        </p>
      </Panel>

      <Panel title="Deltagere">
        <ul className="grid gap-2">
          {detail.attendees.map((attendee) => (
            <li
              key={attendee.id}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-sunken px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {attendee.displayName}
              </span>
              {attendee.joinedAt ? (
                <Badge tone="positive">Var med</Badge>
              ) : (
                <Badge tone="neutral">Inviteret</Badge>
              )}
              <Button
                variant="ghost"
                size="md"
                disabled={pending}
                onClick={() =>
                  void run(() => api.gatherings.uninvite(detail.id, attendee.id), {
                    success: "Deltageren er fjernet",
                  })
                }
              >
                Fjern
              </Button>
            </li>
          ))}
        </ul>

        {/*
         * Fjernelse afvises af API'et hvis deltageren har skrevet noter —
         * historikken slettes ikke ved et uheld. Fejlen kommer som en toast.
         */}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Inviter en bruger" error={fieldErrors.userId} className="min-w-56 flex-1">
            {(props) => (
              <NativeSelect
                {...props}
                value={valgtBruger}
                onChange={(event) => setValgtBruger(event.target.value)}
              >
                <option value="">Vælg …</option>
                {kanInviteres.map((bruger) => (
                  <option key={bruger.id} value={bruger.id}>
                    {bruger.displayName}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>

          <Button
            disabled={pending || valgtBruger === ""}
            onClick={async () => {
              const result = await run(
                () => api.gatherings.invite(detail.id, { userId: valgtBruger }),
                { success: "Invitationen er sendt" },
              );
              if (result !== null) setValgtBruger("");
            }}
          >
            Inviter
          </Button>
        </div>
      </Panel>

      <Panel title="Listen">
        {detail.items.length === 0 ? (
          <p className="text-sm text-ink-muted">Ingenting på listen endnu.</p>
        ) : (
          <ol className="grid gap-2">
            {detail.items.map((item, index) => (
              <li key={item.id} className="rounded-[var(--radius-control)] bg-sunken px-3 py-2.5">
                {/*
                 * Navnet på sin egen linje, knapperne under.
                 *
                 * Alt stod før på én række med `flex-wrap`, og på en telefon
                 * efterlod nummer, mærkat, klokkeslæt og to knapper så lidt
                 * plads til navnet at "Hernö Old Tom" blev til "Hernö O…" —
                 * netop den oplysning man leder efter. En af knapperne faldt
                 * oven i købet ned på en linje for sig.
                 */}
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-ink-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {item.displayName}
                  </span>
                  {item.servedAt ? (
                    <span className="shrink-0 font-mono text-xs text-ink-muted">
                      {formatTime(item.servedAt)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  {item.beverage === null ? <Badge tone="warning">Ikke i kataloget</Badge> : null}

                  <div className="ml-auto flex shrink-0 gap-2">
                    {item.servedAt ? null : (
                      <Button
                        variant="secondary"
                        size="md"
                        disabled={pending}
                        onClick={() =>
                          void run(() => api.gatherings.serveItem(detail.id, item.id), {
                            success: "Skænket",
                          })
                        }
                      >
                        Skænk nu
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="md"
                      disabled={pending}
                      onClick={() =>
                        void run(() => api.gatherings.removeItem(detail.id, item.id), {
                          success: "Fjernet fra listen",
                        })
                      }
                    >
                      Fjern
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {/*
         * Listen kunne før kun fyldes fra selve arrangementssiden, og det
         * læste som om den slet ikke kunne lægges i forvejen. Til en smagning
         * er rækkefølgen bestemt på forhånd — det er hele forskellen på en
         * smagning og en festival — så den hører hjemme her, hvor man
         * forbereder aftenen.
         */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button disabled={pending} onClick={() => setTilfoejAaben(true)}>
            <Plus size={18} />
            Læg noget på listen
          </Button>

          <p className="text-sm text-ink-muted">
            Vælg fra kataloget, eller skriv et navn. Er det ikke en smagning, kan deltagerne også
            selv skrive ind mens det står på.
          </p>
        </div>

        <AddItemSheet
          gatheringId={detail.id}
          open={tilfoejAaben}
          onOpenChange={setTilfoejAaben}
          anledning="paa-forhaand"
        />
      </Panel>

      <Panel title="Opslaget">
        <Field
          label="Teksten"
          hint="Det her er hvad man kommer tilbage til om et år. Tomme linjer bliver til afsnit."
          error={fieldErrors.story}
        >
          {(props) => (
            <Textarea
              {...props}
              rows={10}
              value={story}
              onChange={(event) => setStory(event.target.value)}
              placeholder="Sytten gin på fire timer. Vi begyndte fornuftigt …"
            />
          )}
        </Field>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={pending}
            onClick={() =>
              void run(() => api.gatherings.update(detail.id, { story: story.trim() || null }), {
                success: "Teksten er gemt",
              })
            }
          >
            Gem teksten
          </Button>

          <Button
            variant="danger"
            size="md"
            disabled={pending}
            onClick={async () => {
              const result = await run(() => api.gatherings.remove(detail.id), {
                success: "Arrangementet er slettet",
              });
              if (result !== null) router.push(efterSletning);
            }}
            className="ml-auto"
          >
            Slet arrangementet
          </Button>
        </div>
      </Panel>
    </div>
  );
}
