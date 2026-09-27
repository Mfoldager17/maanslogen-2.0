variable "cloudflare_api_token" {
  description = "API-token med Edit på DNS, R2, Cache Rules og Cloudflare Tunnel."
  type        = string
  sensitive   = true
}

variable "account_id" {
  description = "Cloudflare-konto-id."
  type        = string
}

variable "zone_id" {
  description = "Zone-id for domænet."
  type        = string
}

variable "domain" {
  description = "Zonen navnene lægges i, fx mathiasfoldager.com."
  type        = string
}

variable "projekt" {
  description = "Mærkatet projektet samles under. Alle navne ender på <projekt>.<domain>."
  type        = string
  default     = "maanslogen"
}

locals {
  # Ét niveau under zonen, aldrig to. Cloudflares gratis universalcertifikat
  # dækker *.mathiasfoldager.com, men ikke *.*.mathiasfoldager.com, så
  # api.dev.maanslogen.mathiasfoldager.com ville stå uden certifikat og kun
  # kunne nås gennem et betalt Advanced Certificate. Derfor bindestreg mellem
  # rollen og projektet frem for punktum: api-dev-maanslogen.<zone>.
  #
  # Den dag maanslogen.com er købt, er det de fem linjer nedenfor der bliver
  # til "api.maanslogen.com" osv. Alt andet læser herfra.
  #
  # Kun navnene Terraform selv opretter. Webhook-navnet (deploy-...) laves af
  # infra/scripts/dns-record.sh og hører derfor ikke til her.
  vaert = {
    api         = "api-${var.projekt}.${var.domain}"
    api_staging = "api-staging-${var.projekt}.${var.domain}"
    api_dev     = "api-dev-${var.projekt}.${var.domain}"
    media       = "media-${var.projekt}.${var.domain}"
    media_dev   = "media-dev-${var.projekt}.${var.domain}"
  }
}
