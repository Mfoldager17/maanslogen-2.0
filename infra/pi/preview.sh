#!/usr/bin/env bash
#
# Starter og stopper API-containeren for én PR. Kaldes af GitHub Actions gennem
# runneren der kører på Pi'en.
#
#   ./preview.sh up   42 <web-origin>
#   ./preview.sh down 42
#
# Containeren hedder maanslogen-api-pr-<nummer>, hvilket er præcis det navn
# Caddy udleder af værtsnavnet. Ingen port publiceres: Caddy når den over
# docker-netværket, og resten af verden kun gennem tunnelen.

set -euo pipefail

cd "$(dirname "$0")"
[[ -f .env ]] || { echo "infra/pi/.env mangler" >&2; exit 1; }
set -a; . ./.env; set +a

action=${1:?brug: preview.sh up|down <pr-nummer> [web-origin]}
pr=${2:?mangler PR-nummer}
[[ $pr =~ ^[0-9]+$ ]] || { echo "PR-nummeret skal være cifre, fik '$pr'" >&2; exit 1; }

container="maanslogen-api-pr-${pr}"
image="maanslogen-api:pr-${pr}"

case "$action" in
  up)
    web_origin=${3:?mangler web-origin}
    # Dev-databasen er fælles for alle previews og for lokal udvikling. Den
    # migreres her, så en PR med en ny migrering kan prøves af — bemærk at det
    # rammer alle andre previews samtidig. Se docs/environments.md.
    docker run --rm --network maanslogen \
      -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/maanslogen_dev?schema=public" \
      "$image" ./node_modules/.bin/prisma migrate deploy

    docker rm -f "$container" >/dev/null 2>&1 || true
    docker run -d --name "$container" --network maanslogen --restart unless-stopped \
      --label maanslogen.preview="$pr" \
      -e NODE_ENV=production \
      -e PORT=4000 \
      -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/maanslogen_dev?schema=public" \
      -e JWT_ACCESS_SECRET="${DEV_JWT_ACCESS_SECRET}" \
      -e JWT_REFRESH_SECRET="${DEV_JWT_REFRESH_SECRET}" \
      -e CORS_ORIGINS="${web_origin}" \
      -e STORAGE_DRIVER=r2 \
      -e R2_ACCOUNT_ID="${R2_ACCOUNT_ID}" \
      -e R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
      -e R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
      -e R2_BUCKET="${R2_DEV_BUCKET}" \
      -e R2_PUBLIC_BASE_URL="${DEV_MEDIA_PUBLIC_URL}" \
      -e ENABLE_SWAGGER=true \
      "$image" >/dev/null

    # Vent til den svarer, så workflowet ikke melder klar på en container der
    # stadig er ved at starte — eller er gået ned.
    for _ in $(seq 1 30); do
      if docker exec "$container" node -e \
          "fetch('http://127.0.0.1:4000/api/v1/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
        echo "$container er klar"
        exit 0
      fi
      sleep 2
    done
    echo "$container blev ikke klar:" >&2
    docker logs --tail 40 "$container" >&2
    exit 1
    ;;

  down)
    docker rm -f "$container" >/dev/null 2>&1 || true
    docker image rm -f "$image" >/dev/null 2>&1 || true
    echo "$container fjernet"
    ;;

  *)
    echo "ukendt handling: $action" >&2; exit 1 ;;
esac
