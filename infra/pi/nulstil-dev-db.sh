#!/usr/bin/env bash
#
# Giver dev-databasen ren testdata igen. Køres på Pi'en:
#
#   sudo -u maanslogen /opt/maanslogen/infra/pi/nulstil-dev-db.sh
#
# Den lå før som et workflow, men det krævede en selvhostet runner. Nu er der
# ingen, og det er i øvrigt en destruktiv og sjælden handling, der har godt af
# et menneske ved tastaturet.

set -euo pipefail

cd "$(dirname "$0")"
# shellcheck source=infra/pi/load-env.sh
. ./load-env.sh

: "${GHCR_IMAGE:=ghcr.io/mfoldager17/maanslogen-api}"
image="${GHCR_IMAGE}:main"
url="postgresql://maanslogen_dev:${DEV_POSTGRES_PASSWORD}@postgres:5432/maanslogen_dev?schema=public"

read -rp 'Alt i dev-databasen slettes. Skriv "nulstil" for at fortsætte: ' svar
[ "$svar" = nulstil ] || { echo 'afbrudt'; exit 1; }

docker pull -q "$image" >/dev/null

# To trin, ikke ét. Prisma 6's `migrate reset` kørte seed-scriptet til sidst;
# Prisma 7 gør det ikke, og den siger ikke fra — den melder "Database reset
# successful" og efterlader en tom database.
docker run --rm --network maanslogen-dev -e DATABASE_URL="$url" \
  "$image" ./node_modules/.bin/prisma migrate reset --force

docker run --rm --network maanslogen-dev -e DATABASE_URL="$url" \
  "$image" ./node_modules/.bin/prisma db seed

antal=$(docker compose --env-file "$MAANSLOGEN_ENV_FILE" exec -T postgres \
  psql -qtAX -U maanslogen_dev -d maanslogen_dev -c 'SELECT count(*) FROM beverages')
echo "drikkevarer i dev-databasen: $antal"
[ "$antal" -gt 0 ] || { echo 'dev-databasen er tom efter seed' >&2; exit 1; }
