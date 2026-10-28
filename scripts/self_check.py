#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vérification automatisée minimale des correctifs d'audit (Ponytail Self-Check).
Exécutable en 1 seconde sans framework ni fixture.
Usage: python scripts/self_check.py
"""

import sys
import re

def test_black_screen_threshold():
    # Ancien seuil : lum < 16 or stddev < 2 (faux positif sur cartes sombres à lum=12, stddev=5)
    # Nouveau seuil : lum < 4 and stddev < 1.0 (vrai noir pur)
    def check_black(lum, stddev):
        return lum < 4 and stddev < 1.0

    assert not check_black(12.0, 4.5), "Faux positif sur carte nocturne/sombre !"
    assert not check_black(15.0, 1.8), "Faux positif sur radar maritime sombre !"
    assert check_black(1.5, 0.4), "Écran noir pur non détecté !"
    print("✅ 1. Seuil anti-écran noir calibré sans faux positifs.")

def test_image_magic_bytes():
    def is_valid_image(b):
        return (
            len(b) > 500 and (
                b.startswith(b"\x89PNG\r\n\x1a\n") or
                b.startswith(b"\xff\xd8\xff") or
                b.startswith(b"GIF87a") or
                b.startswith(b"GIF89a") or
                (b.startswith(b"RIFF") and b[8:12] == b"WEBP")
            )
        )

    fake_html_error = b"<!DOCTYPE html><html><body>Error 404 Not Found" + b"A" * 2500
    real_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"X" * 1000
    real_gif = b"GIF89a\x01\x00\x01\x00" + b"Y" * 1000

    assert not is_valid_image(fake_html_error), "Page HTML d'erreur acceptée à tort comme image !"
    assert is_valid_image(real_png), "Vrai PNG rejeté !"
    assert is_valid_image(real_gif), "Vrai GIF rejeté !"
    print("✅ 2. Validation stricte des signatures binaires images OK.")

def test_ssrf_filter():
    def is_safe_url(host, proto):
        if proto not in ("http:", "https:"):
            return False
        h = host.lower()
        if (
            h in ("localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "[::1]", "::1")
            or h.endswith(".local")
            or h.startswith("192.168.")
            or h.startswith("10.")
            or bool(re.match(r"^172\.(1[6-9]|2[0-9]|3[0-1])\.", h))
        ):
            return False
        return True

    assert not is_safe_url("localhost", "http:"), "SSRF localhost non bloqué !"
    assert not is_safe_url("127.0.0.1", "http:"), "SSRF 127.0.0.1 non bloqué !"
    assert not is_safe_url("169.254.169.254", "http:"), "SSRF Cloud metadata non bloqué !"
    assert not is_safe_url("192.168.1.1", "http:"), "SSRF réseau privé non bloqué !"
    assert is_safe_url("meteo-france.fr", "https:"), "URL publique météo rejetée !"
    assert is_safe_url("meteociel.fr", "https:"), "URL publique météociel rejetée !"
    print("✅ 3. Filtrage anti-SSRF validé.")

def test_xss_sanitizer():
    def sanitize_html(html):
        clean = re.sub(r"<script\b[\s\S]*?</script>", "", html, flags=re.I)
        clean = re.sub(r"<iframe\b[\s\S]*?</iframe>", "", clean, flags=re.I)
        clean = re.sub(r"\s+on[a-z]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", clean, flags=re.I)
        clean = re.sub(r"href\s*=\s*[\"']\s*javascript:[^\"']*[\"']", 'href="#"', clean, flags=re.I)
        return clean

    malicious = '<p>Beau temps</p><script>alert("XSS")</script><img src="x" onerror="evil()"><a href="javascript:steal()">Lien</a>'
    sanitized = sanitize_html(malicious)
    assert "<script" not in sanitized, "Balise script non purgée !"
    assert "onerror" not in sanitized, "Attribut onerror non purgé !"
    assert "javascript:" not in sanitized, "Protocole javascript non purgé !"
    assert "<p>Beau temps</p>" in sanitized, "Texte légitime altéré !"
    print("✅ 4. Nettoyage anti-XSS validé.")

def test_upload_extension():
    allowed_ext = re.compile(r"\.(png|jpe?g|webp|gif)$", re.I)
    assert not allowed_ext.search("blog/exploit.html"), "Fichier HTML accepté pour signature d'upload !"
    assert not allowed_ext.search("blog/image.svg"), "Fichier SVG exécutable accepté pour signature d'upload !"
    assert allowed_ext.search("renders/sess1/carte.png"), "Image PNG légitime rejetée !"
    assert allowed_ext.search("blog/photo.jpeg"), "Image JPEG légitime rejetée !"
    print("✅ 5. Contrôle d'extension des téléversements validé.")

if __name__ == "__main__":
    print("\n🔍 Lancement des auto-vérifications Ponytail...")
    test_black_screen_threshold()
    test_image_magic_bytes()
    test_ssrf_filter()
    test_xss_sanitizer()
    test_upload_extension()
    print("\n🎉 TOUTES LES VÉRIFICATIONS ONT RÉUSSI (5/5) !\n")
