#!/bin/sh
#
# Sætter offentlig læsning på udviklings-bucketsene, så browseren kan hente
# billeder direkte fra NEXT_PUBLIC_MEDIA_URL uden nøgler — samme forhold som
# R2's offentlige domæne i produktion.
#
# Alt andet seeder Alarik selv ud fra env i docker-compose.yml: admin,
# adgangsnøglen og de to buckets. Derfor er der kun det her tilbage, og det
# ligger som et engangsjob frem for i en init-container.
#
# Politikken sættes over S3-API'et med SigV4 frem for over Alariks interne
# API. Ikke af nød — begge kan — men fordi det samtidig er en røgprøve: går
# den igennem, signerer og validerer SigV4-stien rigtigt, og det opdages ved
# `pnpm infra:up` i stedet for ved den første upload.
set -eu

: "${ALARIK_URL:=http://alarik:8080}"
: "${S3_REGION:=auto}"
: "${BUCKETS:=maanslogen-dev maanslogen-test}"
: "${PRIVATE_BUCKETS:=maanslogen-privat-dev maanslogen-privat-test}"

forsoeg=0
until curl -fsS "$ALARIK_URL/readyz" >/dev/null 2>&1; do
  forsoeg=$((forsoeg + 1))
  if [ "$forsoeg" -ge 60 ]; then
    echo "Alarik svarede ikke på /readyz inden for 120 sekunder." >&2
    exit 1
  fi
  sleep 2
done

# Arrangementernes billeder. Disse oprettes her frem for kun at stå i
# DEFAULT_BUCKETS, fordi Alarik kun seeder buckets ved FØRSTE boot: har man
# allerede en volume — og det har alle der har kørt projektet før — bliver en
# ny bucket i listen aldrig oprettet, og uploads fejler med NoSuchBucket uden
# at noget andet ser forkert ud.
#
# De får bevidst INGEN politik. Får de offentlig læsning, er hele pointen med
# en privat bucket forbi.
for bucket in $PRIVATE_BUCKETS; do
  status=$(curl -sS -o /tmp/svar.txt -w '%{http_code}' \
    -X PUT "$ALARIK_URL/${bucket}" \
    --aws-sigv4 "aws:amz:${S3_REGION}:s3" \
    --user "${S3_ACCESS_KEY_ID}:${S3_SECRET_ACCESS_KEY}")

  case "$status" in
    # 409 = bucketen findes allerede og er vores. Det er det normale svar fra
    # anden kørsel og frem, og det er ikke en fejl.
    2*|409) echo "$bucket: privat bucket findes." ;;
    *)
      echo "$bucket: kunne ikke oprette privat bucket (HTTP $status)." >&2
      cat /tmp/svar.txt >&2 || true
      echo >&2
      exit 1
      ;;
  esac
done

for bucket in $BUCKETS; do
  # s3:GetObject er den eneste action der skal til, og den eneste vi vil give.
  # Alarik accepterer kun s3:GetObject, s3:GetObjectVersion og s3:ListBucket —
  # listning er bevidst ikke med: filnavnene er uforudsigelige UUID'er, og det
  # er den eneste grund til at et offentligt bucket ikke er et katalog.
  politik="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"OffentligLaesning\",\"Effect\":\"Allow\",\"Principal\":\"*\",\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::${bucket}/*\"}]}"

  status=$(curl -sS -o /tmp/svar.txt -w '%{http_code}' \
    -X PUT "$ALARIK_URL/${bucket}?policy" \
    --aws-sigv4 "aws:amz:${S3_REGION}:s3" \
    --user "${S3_ACCESS_KEY_ID}:${S3_SECRET_ACCESS_KEY}" \
    -H 'content-type: application/json' \
    --data-binary "$politik")

  case "$status" in
    2*) echo "$bucket: offentlig læsning sat." ;;
    *)
      echo "$bucket: kunne ikke sætte bucket-politik (HTTP $status)." >&2
      cat /tmp/svar.txt >&2 || true
      echo >&2
      exit 1
      ;;
  esac
done
