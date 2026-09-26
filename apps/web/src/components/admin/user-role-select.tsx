"use client";

import { roleSchema, type Role } from "@maanslogen/contracts";
import { useId } from "react";
import { api } from "@/lib/api/api.browser";
import { NativeSelect } from "@/components/ui/field";
import { useApiMutation } from "@/lib/use-mutation";

/** Rollerne hedder noget på dansk i resten af fladen; enum-værdien er API'ets. */
const ROLLER: Record<Role, string> = {
  USER: "Bruger",
  MODERATOR: "Moderator",
  ADMIN: "Administrator",
};

/**
 * Rolleskift bumper brugerens tokenVersion i API'et, så en degradering
 * slår igennem med det samme frem for når tokenet tilfældigvis udløber.
 */
export function UserRoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: Role;
  disabled?: boolean;
}) {
  const id = useId();
  const mutation = useApiMutation();

  return (
    <>
      <label htmlFor={id} className="sr-only">
        Rolle
      </label>
      <NativeSelect
        id={id}
        defaultValue={role}
        disabled={disabled || mutation.pending}
        onChange={(event) =>
          mutation.run(() => api.users.update(userId, { role: event.target.value as Role }), {
            success: "Rollen er opdateret",
          })
        }
      >
        {roleSchema.options.map((option) => (
          <option key={option} value={option}>
            {ROLLER[option]}
          </option>
        ))}
      </NativeSelect>
    </>
  );
}
