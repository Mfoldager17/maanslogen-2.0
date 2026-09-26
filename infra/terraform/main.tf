terraform {
  required_version = ">= 1.8"

  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      # Fastlåst med vilje. Provideren skiftede mange ressourcenavne i v5
      # (cloudflare_record blev cloudflare_dns_record og 40 andre med den), og
      # et spring til v6 skal være et bevidst valg, ikke noget der sker af sig
      # selv næste gang nogen kører init.
      version = "~> 5.12"
    }
  }

  # Tilstanden i R2 — vi har den alligevel, og så ligger den ikke kun på én
  # maskine. Bucketen `maanslogen-tfstate` skal oprettes i hånden først; den
  # kan ikke oprette sig selv.
  #
  # Kræver i miljøet:
  #   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  (en R2 API-nøgle)
  backend "s3" {
    bucket = "maanslogen-tfstate"
    key    = "cloudflare.tfstate"
    region = "auto"

    # R2 er S3-kompatibel, men er ikke AWS. Uden disse forsøger backenden at
    # slå et AWS-konto-id op og validere regionen, og begge dele fejler.
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}

provider "cloudflare" {
  # Sættes som CLOUDFLARE_API_TOKEN i miljøet, ikke i en fil.
  api_token = var.cloudflare_api_token
}
