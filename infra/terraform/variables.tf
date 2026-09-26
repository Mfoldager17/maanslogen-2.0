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
  description = "Underdomænet dev-miljøet lever under. Preview-værter bliver api-pr-<n>.<dev_domain>."
  type        = string
  default     = null
}

locals {
  dev_domain = coalesce(var.dev_domain, "dev.${var.domain}")
}
