"use client";

import { api } from "@/lib/api/api.browser";
import { ConfirmDelete } from "./confirm-delete";

export function DeleteReviewAction({ id, label }: { id: string; label: string }) {
  return (
    <ConfirmDelete
      iconOnly
      label={label}
      description="Anmeldelsen slettes, og drikkevarens gennemsnit genberegnes med det samme."
      onDelete={() => api.reviews.remove(id)}
    />
  );
}
