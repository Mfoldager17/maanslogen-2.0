import type { Route } from 'next';

/**
 * Next's `typedRoutes` kan kun verificere stier den kan se på byggetidspunktet.
 * Filtre og pagination bygger stien af query-parametre i browseren, og der må
 * vi sige god for den selv.
 *
 * Alt der *kan* skrives som en konstant sti skal skrives som en konstant sti —
 * så fanger typecheckeren stavefejl. Denne funktion er kun til de stier hvor
 * query-strengen dannes på farten.
 */
export function dynamicRoute(path: string): Route {
  return path as Route;
}
