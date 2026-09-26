# Tunnelen. Pi'en skaber selv forbindelsen ud til Cloudflare, så der skal
# hverken åbnes en port i routeren eller være en fast IP-adresse — og Pi'ens
# adresse bliver aldrig offentlig.
resource "cloudflare_zero_trust_tunnel_cloudflared" "pi" {
  account_id = var.account_id
  name       = "maanslogen-pi"

  # Ingress-reglerne styres fra dashboardet, ikke herfra. To grunde: der er
  # kun én regel (alt videre til Caddy, som fordeler på Host-headeren), og
  # cloudflare_zero_trust_tunnel_cloudflared_config har kendte fejl hvor
  # apply afviser en konfiguration som plan lige har godkendt.
  config_src = "cloudflare"
}

# Tokenet cloudflared skal starte med. Det er en hemmelighed — læs det ud med
#   terraform output -raw tunnel_token
# og læg det i infra/pi/.env. Det står også i dashboardet.
