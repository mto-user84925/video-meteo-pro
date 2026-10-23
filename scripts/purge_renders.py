#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Purge des anciens rendus vidéo sur Supabase Storage.

Contexte : les MP4 générés servent uniquement au téléchargement depuis la
régie, juste après le rendu. Ils n'ont plus d'utilité une fois le bulletin
récupéré, mais s'accumulent (~20 Mo par bulletin).

IMPORTANT : OUTIL MANUEL, non déclenché automatiquement.
  Le projet Supabase est en plan Pro (100 Go inclus) : aucune urgence à purger.
  Le script est là pour un nettoyage ponctuel, quand VOUS le décidez.

Périmètre STRICTEMENT limité :
  - ne cible QUE le dossier `renders/` (copies de travail des bulletins) ;
  - ne touche JAMAIS à `blog/`, qui contient les images publiées sur les sites
    (meteobtp.fr, monsieurmeteo.com, climat-meteo.vercel.app) ;
  - épargne les sessions listées dans PROTECTED.

Règles :
  - supprime les dossiers `renders/session_*` dont le DERNIER fichier a été
    modifié il y a plus de --max-age-hours (défaut : 720 h = 30 jours) ;
  - conserve toujours la session passée à --keep-session ;
  - mode --dry-run pour lister sans rien supprimer (TOUJOURS l'utiliser d'abord).

Usage :
  python scripts/purge_renders.py --dry-run
  python scripts/purge_renders.py --max-age-hours 720
  python scripts/purge_renders.py --max-age-hours 24 --keep-session session_123
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ubdevaemtwbzxksjlhjg.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "") or os.environ.get("SUPABASE_KEY", "")
BUCKET = "blog-images"
RENDERS_PREFIX = "renders/"

# Sessions à ne jamais purger, même anciennes (ex. démonstration).
PROTECTED = {"session_1792666869378"}


def _headers(content_type="application/json"):
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type,
    }


def list_prefix(prefix, limit=500):
    """Liste les objets d'un préfixe dans le bucket."""
    body = json.dumps({"prefix": prefix, "limit": limit, "sortBy": {"column": "name", "order": "asc"}}).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/storage/v1/object/list/{BUCKET}",
        data=body,
        headers=_headers(),
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        print(f"  liste {prefix} -> HTTP {exc.code}", file=sys.stderr)
        return []


def delete_object(path):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        method="DELETE",
    )
    try:
        with urllib.request.urlopen(req, timeout=60):
            return True
    except urllib.error.HTTPError as exc:
        print(f"  suppression {path} -> HTTP {exc.code}", file=sys.stderr)
        return False
    except Exception as exc:  # noqa: BLE001
        print(f"  suppression {path} -> {exc}", file=sys.stderr)
        return False


def parse_iso(ts):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-age-hours", type=float, default=720.0,
                        help="Age minimum (heures) avant suppression (defaut 720 h = 30 jours)")
    parser.add_argument("--keep-session", default="", help="Session a conserver absolument")
    parser.add_argument("--dry-run", action="store_true", help="Lister sans supprimer")
    args = parser.parse_args()

    if not SUPABASE_KEY:
        print("SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_KEY manquante.", file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc)
    max_age = args.max_age_hours * 3600
    keep = {s for s in [args.keep_session.strip()] if s} | PROTECTED

    # 1. Lister les dossiers de session
    roots = list_prefix(RENDERS_PREFIX)
    sessions = [r["name"] for r in roots if r.get("name", "").startswith("session_")]

    print(f"Dossiers de session examines : {len(sessions)}")
    print(f"Regle : suppression si inactif depuis > {args.max_age_hours:.0f} h")
    if keep:
        print(f"Conserves : {', '.join(sorted(keep))}")
    if args.dry_run:
        print("MODE SIMULATION (aucune suppression)")

    to_delete = []
    freed = 0
    for sess in sessions:
        if sess in keep:
            continue

        files = list_prefix(f"{RENDERS_PREFIX}{sess}/")
        if not files:
            continue

        # Age = fichier le plus récent du dossier
        newest = None
        for f in files:
            dt = parse_iso(f.get("updated_at")) or parse_iso(f.get("created_at"))
            if dt and (newest is None or dt > newest):
                newest = dt

        if newest is None:
            continue

        age = (now - newest).total_seconds()
        if age <= max_age:
            continue

        size = sum(int((f.get("metadata") or {}).get("size") or 0) for f in files)
        to_delete.append((sess, len(files), size, newest))
        freed += size

    print(f"\nSessions a purger : {len(to_delete)}")
    for sess, count, size, newest in sorted(to_delete, key=lambda x: x[3]):
        action = "[simulation] " if args.dry_run else ""
        print(f"  {action}{sess} : {count} fichiers, {size / 1024 / 1024:.1f} Mo, "
              f"derniere activite {newest.strftime('%d/%m %H:%M')} UTC")

        if args.dry_run:
            continue

        files = list_prefix(f"{RENDERS_PREFIX}{sess}/")
        for f in files:
            delete_object(f"{RENDERS_PREFIX}{sess}/{f['name']}")

    mb = freed / 1024 / 1024
    if args.dry_run:
        print(f"\nEspace libere si execute : {mb:.1f} Mo")
    else:
        print(f"\nEspace libere : {mb:.1f} Mo")
    return 0


if __name__ == "__main__":
    sys.exit(main())
