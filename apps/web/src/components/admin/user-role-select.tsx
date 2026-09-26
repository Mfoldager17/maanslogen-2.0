"use client";

import { roleSchema, type Role } from "@maanslogen/contracts";
import { useId } from "react";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";

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
      <select
        id={id}
        defaultValue={role}
        disabled={disabled || mutation.pending}
        onChange={(event) =>
          mutation.run(() => api.users.update(userId, { role: event.target.value as Role }), {
            success: "Rollen er opdateret",
          })
        }
        className="h-9 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-sm disabled:opacity-60"
      >
        {roleSchema.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </>
  );
}
