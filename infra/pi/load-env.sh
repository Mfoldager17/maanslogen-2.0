# shellcheck shell=bash
# Finder og indlæser Pi'ens hemmeligheder. Tænkt til at blive source'et:
#
#   . infra/pi/load-env.sh
#
# Bagefter er variablerne eksporteret, og $MAANSLOGEN_ENV_FILE peger på den fil
# de kom fra — brug den til `docker compose --env-file "$MAANSLOGEN_ENV_FILE"`.
#
# Grunden til at filen ikke bare hedder infra/pi/.env: en GitHub-runner tjekker
# repoet ud i sit eget arbejdsbibliotek, og .env er git-ignoreret. Der ville
# den altså aldrig være. Derfor ligger den ét fast sted uden for ethvert
# checkout, og et klonet repo på Pi'en kan stadig bruge sin egen .env.

_maanslogen_find_env() {
  if [ -n "${MAANSLOGEN_ENV_FILE:-}" ]; then
    echo "$MAANSLOGEN_ENV_FILE"; return
  fi
  if [ -f /etc/maanslogen/pi.env ]; then
    echo /etc/maanslogen/pi.env; return
  fi
  # Sidste udvej: ved siden af docker-compose.yml, til manuel brug på Pi'en.
  echo "$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)/.env"
}

MAANSLOGEN_ENV_FILE="$(_maanslogen_find_env)"

if [ ! -f "$MAANSLOGEN_ENV_FILE" ]; then
  echo "Ingen miljøfil fundet. Kig efter /etc/maanslogen/pi.env, eller sæt" >&2
  echo "MAANSLOGEN_ENV_FILE. Se docs/environments.md." >&2
  return 1 2>/dev/null || exit 1
fi

set -a
# shellcheck disable=SC1090
. "$MAANSLOGEN_ENV_FILE"
set +a
export MAANSLOGEN_ENV_FILE
