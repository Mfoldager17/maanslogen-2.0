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
  description = "Zonen navnene lægges i, fx maanslogen.com."
  type        = string
}

locals {
  # Ét niveau under zonen, aldrig to. Cloudflares gratis universalcertifikat
  # dækker *.maanslogen.com, men ikke *.*.maanslogen.com, så et navn som
  # api.dev.maanslogen.com ville stå uden certifikat og kun kunne nås gennem
  # et betalt Advanced Certificate. Derfor bindestreg inde i rollen frem for
  # punktum: api-dev.<zone>, ikke api.dev.<zone>.
  #
  # Da navnene lå i en delt zone, bar de også projektnavnet — api-dev-maanslogen.
  # Med maanslogen.com som sin egen zone er projektet zonen, og leddet er væk.
  #
  # Kun navnene Terraform selv opretter. Sitet ligger på en Worker, og
  # webhook-navnet (deploy.<zone>) laves af infra/scripts/dns-record.sh; de
  # hører derfor ikke til her.
  vaert = {
    api         = "api.${var.domain}"
    api_staging = "api-staging.${var.domain}"
    api_dev     = "api-dev.${var.domain}"
    media       = "media.${var.domain}"
    media_dev   = "media-dev.${var.domain}"
  }
}
