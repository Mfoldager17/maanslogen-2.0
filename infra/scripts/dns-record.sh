#!/usr/bin/env bash
#
# Opretter og fjerner det proxy'ede CNAME der peger et preview-værtsnavn ind i
# tunnelen. Kaldes af workflows.
#
#   dns-record.sh upsert api-pr-42.dev.eksempel.dk
#   dns-record.sh delete api-pr-42.dev.eksempel.dk
#
# Kræver CF_API_TOKEN, CF_ZONE_ID og — ved upsert — CF_TUNNEL_ID.

set -euo pipefail

handling=${1:?brug: dns-record.sh upsert|delete <værtsnavn>}
navn=${2:?mangler værtsnavn}
: "${CF_API_TOKEN:?CF_API_TOKEN mangler}"
: "${CF_ZONE_ID:?CF_ZONE_ID mangler}"

api="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records"
auth=(-H "Authorization: Bearer ${CF_API_TOKEN}" -H 'Content-Type: application/json')

# jq findes på GitHub-runnere og på et almindeligt Raspberry Pi OS.
command -v jq >/dev/null || { echo "jq mangler" >&2; exit 1; }

svar=$(curl -sS --fail-with-body "${auth[@]}" "${api}?type=CNAME&name=${navn}")
id=$(echo "$svar" | jq -r '.result[0].id // empty')

case "$handling" in
  upsert)
    : "${CF_TUNNEL_ID:?CF_TUNNEL_ID mangler}"
    # Proxy'et (orange sky) er påkrævet: cfargotunnel.com kan kun nås gennem
    # Cloudflare, og det er også det der holder Pi'ens IP-adresse skjult.
    krop=$(jq -nc --arg n "$navn" --arg t "${CF_TUNNEL_ID}.cfargotunnel.com" \
      '{type:"CNAME", name:$n, content:$t, proxied:true, comment:"maanslogen preview — ryddes op når PR lukkes"}')
    if [[ -n $id ]]; then
      curl -sS --fail-with-body -X PATCH "${auth[@]}" "${api}/${id}" --data "$krop" >/dev/null
      echo "opdateret $navn"
    else
      curl -sS --fail-with-body -X POST "${auth[@]}" "$api" --data "$krop" >/dev/null
      echo "oprettet $navn"
    fi
    ;;
  delete)
    if [[ -n $id ]]; then
      curl -sS --fail-with-body -X DELETE "${auth[@]}" "${api}/${id}" >/dev/null
      echo "fjernet $navn"
    else
      echo "$navn fandtes ikke — ikke noget at gøre"
    fi
    ;;
  *)
    echo "ukendt handling: $handling" >&2; exit 1 ;;
esac
