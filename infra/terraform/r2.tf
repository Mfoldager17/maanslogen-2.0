# To buckets: produktion og dev. Previews og lokal udvikling deler dev-bucketen,
# på samme måde som de deler dev-databasen. Så kan en preview ikke overskrive
# et rigtigt billede, og dev-bucketen kan tømmes uden at nogen mister noget.

resource "cloudflare_r2_bucket" "media" {
  account_id = var.account_id
  name       = "maanslogen-media"
  location   = "WEUR"
}

resource "cloudflare_r2_bucket" "media_dev" {
  account_id = var.account_id
  name       = "maanslogen-media-dev"
  location   = "WEUR"
}

# Backupperne. Aldrig offentlig — der er ingen custom domain på denne, og der
# skal ikke sættes en offentlig læsepolitik på den.
#
# Den har sin egen R2-token, adskilt fra den API'et bruger til billeder. Kan
# nøglen der uploader billeder også slette dumps, er backuppen ikke beskyttet
# mod det den er der for at overleve.
resource "cloudflare_r2_bucket" "backup" {
  account_id = var.account_id
  name       = "maanslogen-backup"
  location   = "WEUR"
}

# Arrangementernes billeder.
#
# En helt anden bucket end mediebucketen, og det er ikke en detalje: `media`
# har et offentligt domæne foran, så alt i den kan hentes af enhver der kender
# nøglen. Et billede fra en smagning må ikke kunne deles ved et uheld.
#
# Derfor: intet custom domain, ingen offentlig læsepolitik. API'et udsteder en
# kortlivet signeret URL efter at have tjekket at den der spørger er inviteret.
# Sætter man en gang et domæne foran disse to, er hele den mekanisme forbi —
# billederne ville kunne hentes udenom API'et.
resource "cloudflare_r2_bucket" "arrangementer" {
  account_id = var.account_id
  name       = "maanslogen-arrangementer"
  location   = "WEUR"
}

resource "cloudflare_r2_bucket" "arrangementer_dev" {
  account_id = var.account_id
  name       = "maanslogen-arrangementer-dev"
  location   = "WEUR"
}
