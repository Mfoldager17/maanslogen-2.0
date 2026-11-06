"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GatheringDetail, User } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, NativeSelect, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { STATUS_ETIKETTER } from "@/lib/arrangementer";
import { formatTime } from "@/lib/format";

/**
 * Værtens betjeningspanel. Alt herinde er admin-ruter i API'et; fladen
 * gentager ikke reglerne, den kalder bare og lader svaret bestemme.
 *
 * Hvert kald svarer med hele arrangementet igen, og `router.refresh()` i
 * `useApiMutation` henter server-komponenterne påny — derfor holdes der ingen
 * kopi af listen i state her, som kunne komme ud af trit med databasen.
 */
export function GatheringManager({
  detail,
  kandidater,
}: {
  detail: GatheringDetail;
  kandidater: User[];
}) {
  const router = useRouter();
  const { pending, fieldErrors, run } = useApiMutation();

  const [story, setStory] = useState(detail.story ?? "");
  const [valgtBruger, setValgtBruger] = useState("");

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
                size="sm"
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
                size="sm"
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
                size="sm"
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
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-sunken px-3 py-2"
              >
                <span className="font-mono text-xs text-ink-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {item.displayName}
                </span>
                {item.beverage === null ? <Badge tone="warning">Ikke i kataloget</Badge> : null}
                {item.servedAt ? (
                  <span className="font-mono text-xs text-ink-muted">
                    {formatTime(item.servedAt)}
                  </span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
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
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    void run(() => api.gatherings.removeItem(detail.id, item.id), {
                      success: "Fjernet fra listen",
                    })
                  }
                >
                  Fjern
                </Button>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-3 text-sm text-ink-muted">
          Ting lægges på fra selve arrangementssiden — også af deltagerne, hvis det ikke er en
          smagning.
        </p>
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
              if (result !== null) router.push("/admin/arrangementer");
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
