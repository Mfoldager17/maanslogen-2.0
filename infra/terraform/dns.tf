# De faste navne. Preview-navnene (api-pr-42.dev...) hører ikke til her:
# de kommer og går med de enkelte PR'er, og infra/scripts/dns-record.sh
# opretter og fjerner dem. Terraform og et workflow bør ikke redigere de
# samme ressourcer — det ville give drift hver gang et PR åbnes.

locals {
  tunnel_target = "${cloudflare_zero_trust_tunnel_cloudflared.pi.id}.cfargotunnel.com"
}

# API'et i produktion, gennem tunnelen til Pi'en.
resource "cloudflare_dns_record" "api" {
  zone_id = var.zone_id
  name    = "api.${var.domain}"
  type    = "CNAME"
  content = local.tunnel_target
  # Proxy'et er påkrævet: cfargotunnel.com kan kun nås gennem Cloudflare.
  proxied = true
  # 1 = automatisk. Påkrævet felt, og en proxy'et record styrer selv sin TTL.
  ttl     = 1
  comment = "Terraform — API i produktion"
}

# Det delte dev-API. Peger på samme tunnel; Caddy skelner på værtsnavnet.
resource "cloudflare_dns_record" "api_dev" {
  zone_id = var.zone_id
  name    = "api.${local.dev_domain}"
  type    = "CNAME"
  content = local.tunnel_target
  proxied = true
  ttl     = 1
  comment = "Terraform — delt dev-API"
}

resource "cloudflare_dns_record" "api_staging" {
  zone_id = var.zone_id
  name    = "api.${local.staging_domain}"
  type    = "CNAME"
  content = local.tunnel_target
  proxied = true
  ttl     = 1
  comment = "Terraform — staging-API (main-grenen)"
}

# Billeddomænerne foran R2. De skal knyttes til bucketen under
# Settings → Public access → Custom domains, hvilket provideren ikke kan;
# recorden her findes for at domænet er reserveret og dokumenteret.
resource "cloudflare_dns_record" "media" {
  zone_id = var.zone_id
  name    = "media.${var.domain}"
  type    = "CNAME"
  content = "public.r2.dev"
  proxied = true
  ttl     = 1
  comment = "Terraform — R2 foran ${cloudflare_r2_bucket.media.name}"
}

resource "cloudflare_dns_record" "media_dev" {
  zone_id = var.zone_id
  name    = "media.${local.dev_domain}"
  type    = "CNAME"
  content = "public.r2.dev"
  proxied = true
  ttl     = 1
  comment = "Terraform — R2 foran ${cloudflare_r2_bucket.media_dev.name}"
}
