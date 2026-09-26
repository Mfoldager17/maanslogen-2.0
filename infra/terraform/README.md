# Terraform — Cloudflare

Opretter det i Cloudflare der ikke ændrer sig: R2-bucketsene, tunnelen, de
faste DNS-navne og cache-reglen foran billederne.

## Hvad der ikke står her, og hvorfor

Alt der laves og fjernes flere gange om dagen holdes uden for Terraform.
Terraform og et workflow, der redigerer de samme ressourcer, giver drift i
tilstanden hver gang et PR åbnes.

| Ting                     | Styres af                        |
| ------------------------ | -------------------------------- |
| Worker'en (web)          | `wrangler` i `.github/workflows` |
| DNS for `api-pr-<n>`     | `infra/scripts/dns-record.sh`    |
| Preview-containere       | `infra/pi/preview.sh`            |
| Tunnelens ingress-regler | Cloudflare-dashboardet           |

Ingress-reglerne er undtaget af to grunde: der er kun én regel — alt videre
til Caddy, som fordeler på Host-headeren — og
`cloudflare_zero_trust_tunnel_cloudflared_config` har kendte fejl hvor `apply`
afviser en konfiguration som `plan` lige har godkendt.

## Kør det

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # udfyld account_id og zone_id
export CLOUDFLARE_API_TOKEN=...                # Edit på DNS, R2, Cache Rules, Tunnel

# Backenden ligger i R2 og bruger S3-protokollen. Bucketen
# maanslogen-tfstate skal oprettes i hånden først — den kan ikke oprette
# sig selv. Nøglerne herunder er en R2 API-nøgle, ikke en AWS-nøgle.
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

terraform init \
  -backend-config="endpoints={s3=\"https://<account-id>.r2.cloudflarestorage.com\"}"
terraform plan
```

Bagefter:

```bash
terraform output -raw tunnel_token   # ind i infra/pi/.env
terraform output tunnel_id           # ind i GitHub som CLOUDFLARE_TUNNEL_ID
```

## Læs planen før du applier

Koden her er **ikke** kørt mod Cloudflare. Den er skrevet og formatteret i et
miljø uden adgang til Terraforms registry — `registry.terraform.io` svarede
`Forbidden` — så `terraform init` og dermed `terraform validate` kunne ikke
køres.

Det betyder konkret:

- HCL'en **er** kontrolleret: `terraform fmt -check` går rent, så syntaksen
  parser.
- Ressource- og feltnavne er **ikke** kontrolleret mod providerens skema.
  Provideren skiftede 40+ navne i v5, og selvom navnene her er v5-navne, kan
  et felt hedde noget andet end antaget.

Så kør `terraform plan` først og læs den. Fejler noget, er det næsten
sikkert et feltnavn i `cache.tf` — `cloudflare_ruleset` har den mest
sammensatte struktur af det hele. Versionen er låst til `~> 5.12`, så skemaet
ikke flytter sig under dig.
