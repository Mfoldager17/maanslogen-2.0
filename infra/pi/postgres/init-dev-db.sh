#!/bin/sh
# Kører kun første gang postgres-volumen er tom.
#
# Produktionsdatabasen laver billedet selv ud fra POSTGRES_DB. Her oprettes
# dev-databasen — og vigtigere: en rolle der KUN kan nå den.
#
# Uden den adskillelse fik dev-API'et præcis de samme credentials som
# produktionen, og kun databasenavnet i forbindelses-URL'en skilte dem ad.
# Det kan ændres inde fra containeren, så dev — der kører kode fra et PR —
# kunne læse og skrive produktionsdatabasen. Det skulle ikke engang et angreb
# til; en fejl i et almindeligt PR var nok.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
-- Postgres giver som udgangspunkt alle roller CONNECT på alle databaser.
-- Den skal væk, ellers hjælper en separat rolle ingenting.
REVOKE CONNECT ON DATABASE $POSTGRES_DB FROM PUBLIC;

CREATE ROLE maanslogen_dev LOGIN PASSWORD '$DEV_POSTGRES_PASSWORD';
CREATE DATABASE maanslogen_dev OWNER maanslogen_dev;

REVOKE CONNECT ON DATABASE maanslogen_dev FROM PUBLIC;
GRANT CONNECT ON DATABASE maanslogen_dev TO maanslogen_dev;
SQL

# Skemaet i den nye database skal også tilhøre dev-rollen, ellers kan Prisma
# ikke migrere i den.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname maanslogen_dev <<SQL
ALTER SCHEMA public OWNER TO maanslogen_dev;
SQL
