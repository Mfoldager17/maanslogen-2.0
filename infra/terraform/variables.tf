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
  description = "Rodddomænet, fx maanslogen.dk."
  type        = string
}

variable "dev_domain" {
  description = "Underdomænet dev-miljøet lever under, fx dev.maanslogen.dk."
  type        = string
  default     = null
}

variable "staging_domain" {
  description = "Underdomænet staging lever under, fx staging.maanslogen.dk."
  type        = string
  default     = null
}

locals {
  dev_domain     = coalesce(var.dev_domain, "dev.${var.domain}")
  staging_domain = coalesce(var.staging_domain, "staging.${var.domain}")
}
