#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Publie un statut terminal `failed` pour une session de rendu.

Utilisé par le workflow GitHub Actions (étape `if: failure() || cancelled()`),
afin que la régie web n'attende jamais indéfiniment un runner annulé.

Usage : python scripts/publish_failure_status.py --session-id <id> [--message "..."]
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

DEFAULT_MESSAGE = (
    "Le runner GitHub Actions s'est arrêté avant la fin du rendu "
    "(annulé, timeout ou échec d'installation). Consultez le journal du workflow."
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session-id", default=os.environ.get("SESSION_ID", ""))
    parser.add_argument("--message", default=DEFAULT_MESSAGE)
    args = parser.parse_args()

    session_id = (args.session_id or "").strip()
    url = os.environ.get("SUPABASE_URL", "")
    # Écriture Storage réservée au service_role depuis le durcissement RLS :
    # avec la seule clé publishable, POST et PUT renvoyaient HTTP 400 et le site
    # restait bloqué sur « encodage en cours » après un échec du workflow.
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "") or os.environ.get("SUPABASE_KEY", "")

    if not session_id:
        print("publish_failure_status : aucun session_id, rien à publier.", file=sys.stderr)
        return 0
    if not (url and key):
        print("publish_failure_status : SUPABASE_URL/SUPABASE_KEY absents.", file=sys.stderr)
        return 0

    payload = json.dumps(
        {
            "status": "failed",
            "session_id": session_id,
            "message": args.message,
            "updated_at": int(time.time()),
        },
        ensure_ascii=False,
    ).encode("utf-8")

    path = f"{url}/storage/v1/object/blog-images/renders/{session_id}/status.json"
    for method in ("POST", "PUT"):
        req = urllib.request.Request(
            path,
            data=payload,
            method=method,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
        )
        try:
            urllib.request.urlopen(req, timeout=20).read()
            print(f"Statut d'échec publié ({method}) pour {session_id}.")
            return 0
        except urllib.error.HTTPError as exc:
            print(f"{method} -> HTTP {exc.code}", file=sys.stderr)
        except Exception as exc:  # réseau
            print(f"{method} -> {exc}", file=sys.stderr)

    print("Statut d'échec non publié.", file=sys.stderr)
    return 0  # ne jamais masquer l'échec d'origine du workflow


if __name__ == "__main__":
    raise SystemExit(main())
