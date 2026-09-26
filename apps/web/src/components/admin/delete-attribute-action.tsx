"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api/api.browser";
import { ConfirmDelete } from "./confirm-delete";

export function DeleteAttributeAction({ id, label }: { id: string; label: string }) {
  const router = useRouter();

  return (
    <ConfirmDelete
      label={label}
      description="Attributten arkiveres. API'et afviser det, hvis den stadig har værdier på drikkevarer."
      onDelete={async () => {
        await api.attributes.remove(id);
        router.push("/admin/attributter");
      }}
    />
  );
}
