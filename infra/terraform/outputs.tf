output "tunnel_id" {
  description = "Tunnelens id. Skal bruges som CLOUDFLARE_TUNNEL_ID i GitHub."
  value       = cloudflare_zero_trust_tunnel_cloudflared.pi.id
}

output "tunnel_token" {
  description = "Token cloudflared starter med. Ind i infra/pi/.env som CLOUDFLARE_TUNNEL_TOKEN."
  value       = cloudflare_zero_trust_tunnel_cloudflared.pi.token
  sensitive   = true
}

output "r2_buckets" {
  description = "Navnene som API'et skal have i R2_BUCKET. `backup` bruges kun af Pi'ens backup-unit."
  value = {
    prod   = cloudflare_r2_bucket.media.name
    dev    = cloudflare_r2_bucket.media_dev.name
    backup = cloudflare_r2_bucket.backup.name
  }
}

output "api_hosts" {
  description = "Værtsnavnene Caddyfile'en skal kende."
  value = {
    prod    = cloudflare_dns_record.api.name
    staging = cloudflare_dns_record.api_staging.name
    dev     = cloudflare_dns_record.api_dev.name
  }
}

output "media_hosts" {
  description = "Billeddomænerne. Ind i GitHub som PROD_MEDIA_HOST og DEV_MEDIA_HOST."
  value = {
    prod = cloudflare_dns_record.media.name
    dev  = cloudflare_dns_record.media_dev.name
  }
}
