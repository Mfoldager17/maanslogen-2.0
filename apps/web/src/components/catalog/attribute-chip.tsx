import type { BeverageAttribute } from "@maanslogen/contracts";
import { Badge } from "@/components/ui/badge";

/**
 * Viser en attributværdi. `displayValue` kommer færdigformateret fra API'et,
 * som formaterer med præcis den samme funktion frontend gør — så en enhed
 * eller et enum-label aldrig ser forskelligt ud de to steder.
 */
export function AttributeChip({ attribute }: { attribute: BeverageAttribute }) {
  const tone =
    attribute.dataType === "BOOLEAN" && attribute.value === true ? "positive" : "neutral";
  const label = attribute.dataType === "BOOLEAN" ? attribute.displayName : attribute.displayValue;

  return (
    <Badge tone={tone} title={`${attribute.displayName}: ${attribute.displayValue}`}>
      {label}
    </Badge>
  );
}
