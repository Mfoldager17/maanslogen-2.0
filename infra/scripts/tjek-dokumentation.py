#!/usr/bin/env python3
"""Holder docs/environments.md op mod koden.

Guiden er skredet fra virkeligheden tre gange: den beskrev en selvhostet
runner efter at den var fjernet, byggede et image på Pi'en efter at det kom
fra GHCR, og migrerede dev på et netværk der var blevet delt op. Hver gang
ville den have stoppet en installation.

Den slags fanges ikke af tests, fordi det er prosa. Derfor det her.
"""

import pathlib
import re
import sys

import yaml

ROD = pathlib.Path(__file__).resolve().parents[2]
guide = (ROD / "docs/environments.md").read_text()
fejl: list[str] = []


def tjek(betingelse: bool, besked: str) -> None:
    if not betingelse:
        fejl.append(besked)


# ---- Netværk guiden bruger, skal findes i compose ------------------------
compose = yaml.safe_load((ROD / "infra/pi/docker-compose.yml").read_text())
netvaerk = set(compose["networks"])
for n in sorted(set(re.findall(r"--network ([a-z][a-z-]*)", guide))):
    tjek(n in netvaerk, f'guiden bruger netværket "{n}", som ikke findes i compose')

# ---- Netværk og database skal passe sammen ------------------------------
# Den her er den lumske. Begge netværk findes, så et opslag i compose fanger
# ikke at dev bliver migreret på produktionens netværk — kommandoen ville bare
# ikke kunne nå databasen.
for kommando in re.findall(r"docker run[^\n]*(?:\\\n[^\n]*)*", guide):
    fladt = kommando.replace("\\\n", " ")
    net = re.search(r"--network (\S+)", fladt)
    if not net:
        continue
    rammer_dev = "maanslogen_dev" in fladt or "dev_url" in fladt
    if rammer_dev:
        tjek(
            net.group(1) == "maanslogen-dev",
            f'dev-databasen nås på netværket "{net.group(1)}" — skal være maanslogen-dev',
        )
    elif "/maanslogen?schema" in fladt:
        tjek(
            net.group(1) == "maanslogen",
            f'produktionsdatabasen nås på netværket "{net.group(1)}" — skal være maanslogen',
        )

# ---- Ingen workflows må køre på Pi'en -----------------------------------
for f in sorted((ROD / ".github/workflows").glob("*.yml")):
    d = yaml.safe_load(f.read_text())
    for navn, job in d.get("jobs", {}).items():
        tjek(
            "self-hosted" not in str(job.get("runs-on")),
            f"{f.name}:{navn} kører self-hosted — Pi'en skal ikke køre workflow-kode",
        )

# ---- Filer guiden beder dig kopiere, skal findes -------------------------
for sti in sorted(set(re.findall(r"(infra/pi/agent/[\w-]+)\.\{service,timer\}", guide))):
    for endelse in (".service", ".timer"):
        tjek((ROD / (sti + endelse)).exists(), f"guiden kopierer {sti}{endelse}, som ikke findes")
for sti in sorted(set(re.findall(r"/opt/maanslogen/(infra/pi/[\w/.-]+\.(?:sh|service|py))", guide))):
    tjek((ROD / sti).exists(), f"guiden henviser til {sti}, som ikke findes")

# ---- Intervallet i prosaen skal passe med timeren ------------------------
timer = (ROD / "infra/pi/agent/maanslogen-agent.timer").read_text()
interval = re.search(r"OnUnitActiveSec=(\S+)", timer).group(1)
forkerte = {"2min": "to minutter", "5min": "fem minutter", "30min": "en halv time"}
tjek(
    forkerte.get(interval, "") in guide,
    f'timeren er {interval}, men guiden skriver ikke "{forkerte.get(interval, "?")}"',
)
for vaerdi, tekst in forkerte.items():
    if vaerdi != interval:
        tjek(tekst not in guide, f'guiden siger stadig "{tekst}", men timeren er {interval}')

# ---- Imaget guiden nævner, skal være det compose bruger -----------------
env = (ROD / "infra/pi/.env.example").read_text()
ghcr = re.search(r"GHCR_IMAGE=(\S+)", env).group(1)
tjek(ghcr in guide, f"guiden nævner ikke image-navnet {ghcr}")

# ---- Intet må bygge API-imaget på Pi'en ---------------------------------
tjek(
    "docker build -f apps/api" not in guide,
    "guiden bygger API-imaget på Pi'en — det kommer fra GHCR, og den sparse klon har ikke apps/",
)

if fejl:
    print("Dokumentationen passer ikke til koden:\n", file=sys.stderr)
    for f in fejl:
        print(f"  · {f}", file=sys.stderr)
    sys.exit(1)
print("docs/environments.md stemmer med koden")
