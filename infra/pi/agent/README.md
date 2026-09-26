# Agenten

Pi'en modtager ikke ordrer. Den spørger GitHub hvad der bør køre, og bringer
sig selv i overensstemmelse med svaret.

```
GitHub-hosted runner (ubuntu-24.04-arm, gratis på offentligt repo)
   │  bygger arm64-image
   ▼
GHCR  ghcr.io/mfoldager17/maanslogen-api:{main,pr-42}
   │
   │   Pi'en spørger hvert andet minut:
   │     · hvilke åbne PR'er har label "preview"?
   │     · er der et nyt :main-image?
   ▼
maanslogen-agent  ──  docker pull + docker run
```

Forskellen fra en selvhostet runner er retningen. En runner får tilsendt
workflow-kode og udfører den som en shell på maskinen. Agenten her udfører kun
det den selv står for, og dens egen kode kommer fra `main` — et PR kan ikke
ændre den.

## Tre ting skal være opfyldt, før et PR får en container

1. **Der findes et image i GHCR.** Et PR fra en fork får et skrivebeskyttet
   `GITHUB_TOKEN` og kan derfor ikke lægge et image op. Intet image, intet at
   køre. Det er ikke en regel vi håndhæver — det er noget en fork ikke _kan_.
2. **PR'et har label'en `preview`.** Labels kan kun sættes af nogen med
   skriveadgang.
3. **Grenen ligger i repoet selv.** Tjekkes igen i agenten.

## Containeren er stadig spærret inde

Den kører PR-kode, så den får intet skrivbart rodfilsystem, ingen
capabilities, ingen rettighedsforfremmelse, loft på hukommelse og processer,
og den ligger på `maanslogen-dev`-netværket, hvor produktions-API'et ikke er.
Databasen nås med rollen `maanslogen_dev`, som ikke har CONNECT på
produktionsdatabasen.

## Installation

```bash
sudo useradd -r -G docker -s /usr/sbin/nologin maanslogen
sudo git clone https://github.com/Mfoldager17/maanslogen-2.0 /opt/maanslogen
sudo cp infra/pi/agent/maanslogen-agent.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maanslogen-agent.timer
```

Hold `/opt/maanslogen` på `main` — det er den klon agenten kører fra:

```bash
cd /opt/maanslogen && sudo git pull origin main
```

## Se hvad den laver

```bash
journalctl -u maanslogen-agent -f
systemctl list-timers maanslogen-agent.timer
sudo systemctl start maanslogen-agent    # kør med det samme
```
