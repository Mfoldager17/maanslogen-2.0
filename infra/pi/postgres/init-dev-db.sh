#!/bin/sh
# Kører kun første gang postgres-volumen er tom. Produktionsdatabasen laver
# billedet selv ud fra POSTGRES_DB; dev-databasen skal vi selv oprette.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE DATABASE maanslogen_dev;
SQL
