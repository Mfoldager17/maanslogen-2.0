# Cache-reglen der holder R2-regningen nede. Den er grunden til at Terraform
# er besværet værd her: den er nem at klikke forkert sammen i dashboardet, og
# et cache-miss koster en Class B-operation hver gang.
#
# Baggrund og regnestykke: docs/r2-omkostninger.md.

resource "cloudflare_ruleset" "media_cache" {
  zone_id = var.zone_id
  name    = "Billeder caches længe"
  kind    = "zone"
  phase   = "http_request_cache_settings"

  rules = [{
    ref         = "media_immutable"
    description = "Billeder fra R2 caches et år på kanten"
    expression  = "(http.host in {\"media.${var.domain}\" \"media.${local.dev_domain}\"})"
    action      = "set_cache_settings"

    action_parameters = {
      cache = true

      edge_ttl = {
        # Et år er forsvarligt fordi en nøgle aldrig genbruges: hvert upload
        # får sit eget UUID og bliver aldrig overskrevet. Derfor kan vi
        # også se bort fra oprindelsens cache-control.
        mode    = "override_origin"
        default = 31536000
      }

      browser_ttl = {
        mode = "respect_origin"
      }

      # Uden dette laver en forespørgsel med ?foo=bar sin egen cache-post, og
      # den første besøgende med et tilfældigt parameter koster en R2-læsning.
      cache_key = {
        ignore_query_strings_order = true
      }
    }
  }]
}
