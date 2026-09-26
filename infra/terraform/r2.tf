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
