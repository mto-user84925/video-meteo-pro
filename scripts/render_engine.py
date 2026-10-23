#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Moteur de rendu broadcast officiel Météo-Climat Pro :
1. Génère la voix off Google Gemini 3.8 Flash TTS (Charon) via OpenRouter
2. Encode la version TikTok (9:16 Vertical 1080x1920)
3. Encode la version Paysage Broadcast (16:9 Horizontal 1920x1080)
4. Zéro écran noir garanti à la fin des deux vidéos
5. Téléverse les vidéos sur Supabase Storage
"""

import os
import sys
import json
import time
import shutil
import argparse
import urllib.request
import urllib.error
import urllib.parse
import subprocess
import wave
from PIL import Image, ImageDraw, ImageFont, ImageStat

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
MUSIC_PATH = os.path.join(ASSETS_DIR, "music", "bg_music.ogg")
BADGE_MP4 = os.path.join(ASSETS_DIR, "badges", "badge_blinking.mp4")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ubdevaemtwbzxksjlhjg.supabase.co")
# Écriture Storage réservée au service_role : la clé publishable n'a plus le
# droit d'insérer depuis le durcissement des policies RLS (docs/supabase-secure-writes.sql).
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_KEY")
    or os.environ.get("SUPABASE_ANON_KEY", "")
)
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

def get_font(name_pref, size):
    candidates = [
        name_pref,
        f"{name_pref}.ttf",
        "arialbd.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "DejaVuSans-Bold.ttf"
    ]
    for c in candidates:
        try:
            return ImageFont.truetype(c, size)
        except Exception:
            continue
    return ImageFont.load_default()

FALLBACK_MAPS = [
    f"{SUPABASE_URL}/storage/v1/object/public/blog-images/blog/1792153060_couverture_deluge_fortes_pluies_16_9.png",
    f"{SUPABASE_URL}/storage/v1/object/public/blog-images/blog/1792152013_MeteoClimatPro_ECMWF_AIFS_0_25__Europe_geopotentiel-500-hpa_1792130672739.png",
    f"{SUPABASE_URL}/storage/v1/object/public/blog-images/blog/1792152014_MeteoClimatPro_ECMWF_AIFS_0_25__France_pluie-periode_1792130457894.png",
    f"{SUPABASE_URL}/storage/v1/object/public/blog-images/blog/1792152016_MeteoClimatPro_ECMWF_AIFS_0_25__France_precipitations-cumulees_1792151648872.png"
]

def _fetch_bytes(url, referer_from_url=True, timeout=45):
    """Récupère une URL d'image et renvoie ses octets (gère anti-hotlink).

    Tente urllib (rapide), puis curl_cffi avec empreinte Chrome (sites protégés).
    Lève RuntimeError si aucune des deux méthodes ne donne une vraie image.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "image/*,*/*;q=0.8",
    }
    if referer_from_url:
        headers["Referer"] = "/".join(url.split("/")[:3]) + "/"

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
        if len(data) > 2000:
            return data
    except Exception as exc:
        print(f"⚠️ urllib a échoué ({exc}) — tentative empreinte Chrome...")

    try:
        from curl_cffi import requests as cffi
        r = cffi.get(url, impersonate="chrome124", headers=headers, timeout=timeout)
        ctype = r.headers.get("content-type", "")
        if r.status_code == 200 and len(r.content) > 2000 and ctype.startswith("image/"):
            print(f"✅ Image récupérée via empreinte Chrome : {url}")
            return r.content
        print(f"⚠️ Empreinte Chrome refusée : HTTP {r.status_code} ({ctype})")
    except Exception as exc2:
        print(f"⚠️ Empreinte Chrome indisponible : {exc2}")

    raise RuntimeError(f"Image inaccessible : {url}")


def download_file(url, out_path, fallback_idx=0):
    """Télécharge un visuel ; bascule sur une carte certifiée Supabase si besoin.

    BUG corrigé : l'appel de secours passait par `download_file(...)` sans
    `fallback_idx`, ce qui provoquait un `UnboundLocalError` (le paramètre est
    local à la portée de la fonction) et faisait tomber tout le rendu dès
    qu'une seule image était injoignable.
    """
    print(f"📥 Téléchargement : {url} -> {out_path}", flush=True)
    try:
        data = _fetch_bytes(url)
        with open(out_path, "wb") as fh:
            fh.write(data)
        print(f"✅ Visuel OK ({len(data) // 1024} Ko)")
        return
    except Exception as exc:
        print(f"⚠️ Échec téléchargement image ({exc})")

    print("🛡️ Bascule automatique sur une carte certifiée Supabase...")
    # Rotation déterministe : une scène différente reçoit une carte différente.
    for offset in range(len(FALLBACK_MAPS)):
        fb_url = FALLBACK_MAPS[(fallback_idx + offset) % len(FALLBACK_MAPS)]
        try:
            data = _fetch_bytes(fb_url, referer_from_url=False)
            with open(out_path, "wb") as fh:
                fh.write(data)
            print(f"✅ Carte de secours injectée : {fb_url}")
            return
        except Exception as exc_fb:
            print(f"⚠️ Carte de secours {offset + 1} indisponible ({exc_fb})")

    raise RuntimeError(
        f"Aucun visuel disponible pour {url} et aucune carte de secours joignable."
    )

# ---------------------------------------------------------------------------
# Client HTTP Supabase robuste
# ---------------------------------------------------------------------------
# urllib.urlopen suit les redirections 301/302 en GET : un POST de téléversement
# qui reçoit une redirection serait réémis en GET et perdrait silencieusement le
# corps (fichier absent de Storage alors que le script croit avoir réussi).
# On bloque donc les redirections pour les écritures.

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(
            req.full_url, code, f"Redirection refusée ({code} -> {newurl})", headers, fp
        )

_OPENER_WRITE = urllib.request.build_opener(_NoRedirect)
_OPENER_READ = urllib.request.build_opener()


class StorageError(RuntimeError):
    """Échec définitif d'écriture sur Supabase Storage."""


def _sb_headers(content_type, extra=None):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type,
    }
    if extra:
        headers.update(extra)
    return headers


def _request(method, url, data=None, content_type="application/json",
             headers=None, timeout=30, write=True):
    """Exécute une requête et renvoie (status, body_bytes). Lève sur erreur HTTP."""
    req = urllib.request.Request(
        url, data=data, headers=_sb_headers(content_type, headers), method=method
    )
    opener = _OPENER_WRITE if write else _OPENER_READ
    try:
        with opener.open(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        body = b""
        try:
            body = exc.read()
        except Exception:
            pass
        return exc.code, body


def _http_error_detail(body):
    try:
        return body.decode("utf-8", "replace")[:300]
    except Exception:
        return "<corps illisible>"


def storage_put(remote_path, data, content_type="application/octet-stream",
                upsert=True, retries=3, required=False, label=None):
    """Téléverse un fichier/octets dans le bucket public `blog-images`.

    Stratégie : POST (création) puis PUT (remplacement/upsert) en cas de conflit.
    Les échecs d'authentification/Réponse sont journalisés explicitement : on ne
    renvoie plus une URL « supposée bonne » quand l'écriture a échoué.
    """
    url = f"{SUPABASE_URL}/storage/v1/object/blog-images/{remote_path}"
    name = label or remote_path
    last_error = None

    for attempt in range(1, retries + 1):
        for method in ("POST", "PUT"):
            try:
                status, body = _request(
                    method, url, data=data, content_type=content_type, timeout=120
                )
            except Exception as exc:  # réseau, DNS, TLS, timeouts
                last_error = f"{method}: {exc}"
                continue

            if 200 <= status < 300:
                print(f"✅ Supabase {method} {name}")
                return f"{SUPABASE_URL}/storage/v1/object/public/blog-images/{remote_path}"

            detail = _http_error_detail(body)
            last_error = f"{method} HTTP {status} — {detail}"

            # 400/409 sur POST : l'objet existe déjà -> on tente le PUT (upsert).
            # 401/403 : problème de clé / RLS, inutile de réessayer en boucle.
            if status in (401, 403):
                break

        if attempt < retries:
            time.sleep(min(2 ** attempt, 6))

    print(f"❌ Échec téléversement Supabase {name} : {last_error}")
    if required:
        raise StorageError(f"Téléversement impossible ({name}) : {last_error}")
    return None


def upload_supabase(local_file, remote_path, content_type="video/mp4"):
    """Compatibilité : téléverse un fichier local sur Supabase Storage."""
    with open(local_file, "rb") as fh:
        data = fh.read()
    return storage_put(remote_path, data, content_type=content_type)


def upload_required(local_file, remote_path, content_type="video/mp4"):
    """Comme upload_supabase mais lève une StorageError si l'écriture échoue."""
    with open(local_file, "rb") as fh:
        data = fh.read()
    return storage_put(remote_path, data, content_type=content_type, required=True)


def progress(session_id, pct, text, kind="info"):
    """Publie l'avancement réel (lu par /api/status puis affiché dans le journal).

    Écrit ure du fichier unique `progress.json` (lu en priorité par /api/status) et
    du témoin horodaté `p_{pct:03d}_{ts}.json`. Les échecs sont signalés une seule
    fois pour ne pas polluer le log du workflow.
    """
    print(f"[{pct}%] {text}", flush=True)
    now_ts = int(time.time())
    data = json.dumps({"pct": pct, "text": text, "type": kind, "ts": now_ts},
                      ensure_ascii=False).encode("utf-8")
    base = f"{SUPABASE_URL}/storage/v1/object/blog-images/renders/{session_id}"

    ok = storage_put(f"renders/{session_id}/progress.json", data,
                     content_type="application/json", required=False, label="progress.json")
    if ok:
        storage_put(f"renders/{session_id}/p_{int(pct):03d}_{now_ts}.json", data,
                    content_type="application/json", label=f"p_{pct}")
    else:
        progress.warned = getattr(progress, "warned", False)
        if not progress.warned:
            progress.warned = True
            print("⚠️ Journal de progression non publié (vérifiez SUPABASE_KEY / RLS Storage).")


progress.warned = False

def tts_charon(text, out_wav):
    url = "https://openrouter.ai/api/v1/audio/speech"
    payload = {
        "model": "google/gemini-3.8-flash-tts",
        "input": text,
        "voice": "Charon",
        "language": "fr-FR",
        "instructions": (
            "Voix de présentateur météo professionnel expert pour journal télévisé. "
            "Débit posé, modéré et parfaitement intelligible (environ 150 mots par minute), jamais précipité. "
            "Prononciation impeccable en français standard, diction fluide et naturelle, intonation continue d'un seul tenant, "
            "avec de courtes respirations naturelles entre les phrases. Ton chaleureux et rassurant. "
            "Ne prononce jamais 'celsius', dis toujours 'degrés'."
        )
    }
    pcm = None
    last_error = None
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://video-meteo-pro.vercel.app",
                    "X-Title": "Video Meteo Pro Engine"
                }
            )
            with urllib.request.urlopen(req, timeout=300) as resp:
                ctype = resp.headers.get("content-type", "")
                pcm = resp.read()
            # L'endpoint renvoie du PCM 24 kHz mono brut : ~48 000 octets par seconde.
            # Un corps trop court = réponse d'erreur JSON renvoyée avec un 200.
            if ctype.startswith("application/json") or len(pcm) < 24000:
                raise ValueError(
                    f"réponse TTS inattendue (content-type={ctype}, {len(pcm)} octets)"
                )
            if len(pcm) % 2:
                pcm = pcm[:-1]  # garantit un nombre entier d'échantillons 16 bits
            print(f"🎙️ TTS reçue : {len(pcm) // 1024} Ko PCM mono 24 kHz", flush=True)
            break
        except Exception as e:
            last_error = e
            print(f"⚠️ TTS tentative {attempt}/3 échouée : {e}", flush=True)
            if attempt < 3:
                time.sleep(3 * attempt)

    if pcm is None:
        raise RuntimeError(f"Synthèse vocale impossible après 3 tentatives ({last_error})")

    with wave.open(out_wav, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(pcm)

def media_duration(path):
    """Durée réelle d'un visuel (GIF animé ou vidéo) ; 0.0 pour une image fixe."""
    try:
        out = subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", path
        ], stderr=subprocess.DEVNULL).decode().strip()
        return float(out) if out and out != "N/A" else 0.0
    except Exception:
        return 0.0


def rebalance_for_animations(scene_durs, gif_durs, voice_dur):
    """Ajuste la durée des scènes contenant un GIF animé.

    Problème corrigé : la durée d'une scène était répartie uniquement selon le
    nombre de caractères de sa voix off. Un GIF de 30 s illustrant 46 mots
    (~15 s) était donc coupé au milieu, sans jamais montrer la fin de la
    prévision. Désormais :

      1. on alloue au GIF la durée de SON animation (jamais moins) ;
      2. on retire ce temps aux autres scènes au prorata ;
      3. si la voix off est trop courte pour couvrir tous les GIF, on signale
         précisément combien de mots manquent (le moteur boucle l'animation,
         mais la voix et l'image se désynchronisent).
    """
    if not gif_durs or all(d <= 0 for d in gif_durs):
        return scene_durs, []

    # Défense : une liste de durées plus longue que le nombre de scènes
    # faisait planter l'indexation (IndexError). On la recadre sur la taille
    # réelle, et on complète par des zéros si elle est trop courte.
    gif_durs = list(gif_durs)
    if len(gif_durs) > len(scene_durs):
        gif_durs = gif_durs[: len(scene_durs)]
    while len(gif_durs) < len(scene_durs):
        gif_durs.append(0.0)

    warnings = []
    adjusted = list(scene_durs)

    # 1. Durée plancher = durée de l'animation pour chaque scène GIF.
    for i, gdur in enumerate(gif_durs):
        if gdur > 0 and adjusted[i] < gdur:
            warnings.append((i, gdur, adjusted[i]))
            adjusted[i] = gdur

    # 2. Les scènes fixes absorbent la différence au prorata de leur poids,
    #    sans jamais descendre sous MIN_SCENE_DUR (lisibilité broadcast).
    MIN_SCENE_DUR = 2.0
    free_idx = [i for i, d in enumerate(gif_durs) if d <= 0]
    total = sum(adjusted)
    extra = total - sum(scene_durs)

    if free_idx and abs(extra) > 0.01:
        free_total = sum(scene_durs[i] for i in free_idx)
        if free_total > 0:
            ratio = (free_total - extra) / free_total
            if ratio > 0:
                for i in free_idx:
                    adjusted[i] = max(MIN_SCENE_DUR, scene_durs[i] * ratio)

    # 3. Si le total obtenu dépasse la durée de la voix off, la demande est
    #    irréalisable : les animations sont trop longues pour ce bulletin.
    #    On conserve alors la répartition d'origine et l'appelant avertit
    #    qu'il faut rallonger la voix off (ou raccourcir l'animation).
    total = sum(adjusted)
    if total > voice_dur + 0.5:
        return list(scene_durs), warnings

    # 4. Renormalisation finale sur la durée réelle de la voix.
    if total > 0:
        adjusted = [d * voice_dur / total for d in adjusted]

    return adjusted, warnings


def render(job_file):
    with open(job_file, "r", encoding="utf-8") as f:
        job = json.load(f)

    session_id = job.get("session_id", str(int(time.time())))
    target_dur_input = float(job.get("target_duration", 60.0))
    scenes_data = job["scenes"]
    work_dir = os.path.join(BASE_DIR, "scratch", f"job_{session_id}")
    os.makedirs(work_dir, exist_ok=True)

    total_words = sum(len(s.get("script_text", "").split()) for s in scenes_data)
    expected_words = round(target_dur_input * 2.85)
    print(f"\n🚀 Démarrage du job {session_id} avec {len(scenes_data)} scènes ({total_words} mots, durée cible : {target_dur_input:.0f}s, attendu ~{expected_words} mots)...")

    # 1. Téléchargement des visuels et génération audio pour chaque scène
    scenes = []
    t_cursor = 0.0

    def fit_text(text, font_pref, max_size, max_w, min_size=14):
        text = (text or "").strip()
        for sz in range(max_size, min_size - 1, -2):
            f = get_font(font_pref, sz)
            bb = f.getbbox(text)
            w, h = bb[2] - bb[0], bb[3] - bb[1]
            if w <= max_w:
                return text, f, w, h
        f = get_font(font_pref, min_size)
        t = text
        while len(t) > 4:
            t = t[:-1].rstrip()
            cand = t + "…"
            bb = f.getbbox(cand)
            if (bb[2] - bb[0]) <= max_w:
                return cand, f, bb[2] - bb[0], bb[3] - bb[1]
        bb = f.getbbox(t)
        return t, f, bb[2] - bb[0], bb[3] - bb[1]

    # Voix off : UNE SEULE piste continue (intonation fluide), puis durée de chaque scène au prorata du texte
    progress(session_id, 10, "🎙️ Synthèse vocale Charon (piste unique)...", "voice")
    raw_wav = os.path.join(work_dir, "voice_raw.wav")
    master_clean = os.path.join(work_dir, "voice_clean.wav")
    tts_charon(" ".join(s["script_text"].strip() for s in scenes_data), raw_wav)
    subprocess.run([
        "ffmpeg", "-y", "-i", raw_wav,
        "-af", "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse",
        "-ar", "48000", "-ac", "2", master_clean
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    voice_dur = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", master_clean
    ]).decode().strip())
    weights = [max(1, len(s["script_text"].strip())) for s in scenes_data]
    scene_durs = [voice_dur * w / sum(weights) for w in weights]
    print(f"🎙️ Voix off unique : {voice_dur:.1f}s ({sum(len(s['script_text'].split()) for s in scenes_data)} mots)")
    progress(session_id, 18, f"✅ Voix off prête ({voice_dur:.0f}s) - téléchargement des visuels...", "voice")

    unique_files = set(sc_in.get("file", "") for sc_in in scenes_data if sc_in.get("file"))
    is_single_image_mode = (len(unique_files) == 1 and len(scenes_data) > 1)
    if is_single_image_mode:
        print("💡 Mode Visuel Unique Détecté : Application automatique de cadrages broadcast dynamiques multi-angles (Plan large, Zoom Nord-Ouest, Zoom Centre, Focus Cœur, Vue finale) !")
        progress(session_id, 19, "🎬 Adaptation multi-angles broadcast (visuel unique)...", "info")

    # Durée d'animation de chaque scène (0.0 si image fixe), remplie pendant le
    # téléchargement des visuels puis utilisée pour rééquilibrer les scènes.
    gif_durs = [0.0] * len(scenes_data)

    for idx, sc_in in enumerate(scenes_data):
        sc_id = f"scene{idx+1}"
        file_input = sc_in["file"]
        local_file = os.path.join(work_dir, f"{sc_id}_{os.path.basename(file_input.split('?')[0])}")
        
        if file_input.startswith("http://") or file_input.startswith("https://"):
            download_file(file_input, local_file, idx)
        else:
            # BUG corrigé : `import shutil` local dans cette branche faisait de
            # `shutil` une variable LOCALE à render(), ce qui provoquait un
            # UnboundLocalError au nettoyage final (« cannot access local
            # variable 'shutil' ») et faisait échouer le job après l'encodage.
            # shutil est déjà importé au niveau module.
            shutil.copyfile(file_input, local_file)

        is_gif = local_file.lower().endswith(".gif")

        # Durée réelle de l'animation (0.0 pour une image fixe).
        # BUG corrigé : `gif_durs` est déjà dimensionné à une case par scène ;
        # un `.append()` décalait les index (liste de 10 éléments pour 5 scènes)
        # et provoquait un IndexError juste après la préparation des scènes,
        # bloquant la régie à 45 %.
        if is_gif:
            gif_durs[idx] = media_duration(local_file)
            if gif_durs[idx] <= 0:
                print(f"⚠️ Durée du GIF scène {idx + 1} illisible : traité comme une image fixe.")

        # Cadrages broadcast multi-angles si une seule image est fournie
        if is_single_image_mode and not is_gif:
            try:
                with Image.open(local_file) as im:
                    im_w, im_h = im.size
                    framed_file = os.path.join(work_dir, f"{sc_id}_angle.png")
                    if idx == 0:
                        im.save(framed_file)
                    elif idx == 1:
                        crop_box = (0, 0, int(im_w * 0.80), int(im_h * 0.80))
                        im.crop(crop_box).save(framed_file)
                    elif idx == 2:
                        crop_box = (int(im_w * 0.20), int(im_h * 0.08), im_w, int(im_h * 0.88))
                        im.crop(crop_box).save(framed_file)
                    elif idx == 3:
                        crop_box = (int(im_w * 0.16), int(im_h * 0.16), int(im_w * 0.84), int(im_h * 0.84))
                        im.crop(crop_box).save(framed_file)
                    else:
                        im.save(framed_file)
                    local_file = framed_file
            except Exception as e_crop:
                print(f"⚠️ Cadrage dynamique multi-angles ignoré : {e_crop}")
        
        dur = scene_durs[idx]
        progress(session_id, 20 + int(25 * (idx + 1) / len(scenes_data)), f"🖼️ Scène {idx+1}/{len(scenes_data)} préparée ({dur:.1f}s)", "info")

        # Création des overlays graphiques unifiés (Charte Broadcast Météo-Climat Pro)
        badge_color = tuple(sc_in.get("badge_color", [220, 30, 30]))
        b_text = (sc_in.get("badge") or "ALERTE MÉTÉO").upper()
        loc_text = (sc_in.get("location_tag") or "FRANCE").upper()
        t_text = sc_in.get("title") or ""
        s_text = sc_in.get("sub") or ""
        ticker_raw = sc_in.get("ticker") or ""

        # 1) TikTok Overlay (1080x1920) — Cartouche haut + bandeau infos bas assorti au Paysage
        tk_img = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
        d_tk = ImageDraw.Draw(tk_img)
        box_x1, box_y1, box_x2, box_y2 = 40, 85, 1040, 310
        d_tk.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], radius=24, fill=(8, 14, 28, 235), outline=(255, 215, 60, 215), width=3)

        pill_label = f"{b_text} • {loc_text}"
        pill_txt, f_pill, pw, ph = fit_text(pill_label, "arialbd", 26, 860, 16)
        b_w = pw + 56
        b_h = max(38, ph + 18)
        b_x1 = (1080 - b_w) // 2
        b_y1 = box_y1 + 20
        d_tk.rounded_rectangle([b_x1, b_y1, b_x1 + b_w, b_y1 + b_h], radius=12, fill=badge_color)
        d_tk.ellipse([b_x1 + 14, b_y1 + (b_h - 12)//2, b_x1 + 26, b_y1 + (b_h - 12)//2 + 12], fill=(255, 255, 255))
        d_tk.text((b_x1 + 36, b_y1 + (b_h - ph)//2 - 2), pill_txt, fill=(255, 255, 255), font=f_pill)

        t_draw, f_title_tk, tw, th = fit_text(t_text, "arialbd", 42, 940, 20)
        d_tk.text(((1080 - tw) // 2, box_y1 + 86), t_draw, fill=(255, 255, 255), font=f_title_tk)

        s_draw, f_sub_tk, sw, sh = fit_text(s_text, "arialbd", 27, 940, 16)
        d_tk.text(((1080 - sw) // 2, box_y1 + 152), s_draw, fill=(255, 215, 60), font=f_sub_tk)

        if ticker_raw:
            d_tk.rounded_rectangle([40, 1638, 1040, 1702], radius=16, fill=(8, 14, 28, 232), outline=(255, 215, 60, 190), width=2)
            tk_tick_str, f_tk_tick, tkw, tkh = fit_text(f"INFOS MÉTÉO • {ticker_raw}", "segoeuib", 22, 950, 14)
            d_tk.text(((1080 - tkw) // 2, 1638 + (64 - tkh) // 2 - 2), tk_tick_str, fill=(255, 215, 60), font=f_tk_tick)

        overlay_tk = os.path.join(work_dir, f"overlay_tk_{sc_id}.png")
        tk_img.save(overlay_tk)

        # 2) Paysage Overlay (1920x1080) — Même style cartouche arrondi marine & or, zéro débordement
        ls_img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
        d_ls = ImageDraw.Draw(ls_img)

        # Grand cartouche inférieur arrondi
        d_ls.rounded_rectangle([36, 922, 1884, 1068], radius=22, fill=(8, 14, 28, 238), outline=(255, 215, 60, 215), width=3)

        # Cartouche gauche coloré (largeur 430px avec auto-fit strict sur 394px)
        left_x1, left_y1, left_x2, left_y2 = 48, 932, 478, 1058
        left_max_w = (left_x2 - left_x1) - 36
        d_ls.rounded_rectangle([left_x1, left_y1, left_x2, left_y2], radius=16, fill=badge_color)

        f_live = get_font("arialbd", 19)
        d_ls.ellipse([left_x1 + 18, left_y1 + 16, left_x1 + 30, left_y1 + 28], fill=(255, 255, 255))
        d_ls.text((left_x1 + 38, left_y1 + 11), "EN DIRECT", fill=(255, 255, 255), font=f_live)

        loc_draw, f_ls_loc, lw, lh = fit_text(loc_text, "arialbd", 30, left_max_w, 16)
        d_ls.text((left_x1 + 18, left_y1 + 44), loc_draw, fill=(255, 255, 255), font=f_ls_loc)

        b_draw, f_ls_badge, bw, bh = fit_text(b_text, "arialbd", 19, left_max_w, 13)
        d_ls.text((left_x1 + 18, left_y1 + 92), b_draw, fill=(255, 235, 235), font=f_ls_badge)

        # Partie droite : Titre + Sous-titre en haut, Bandeau Infos Météo en bas
        right_x = 502
        right_max_w = 1864 - right_x
        combined_title = f"{t_text} — {s_text}" if s_text else t_text
        ct_draw, f_ls_title, ctw, cth = fit_text(combined_title, "arialbd", 32, right_max_w, 17)
        d_ls.text((right_x, 944), ct_draw, fill=(255, 255, 255), font=f_ls_title)

        d_ls.line([right_x, 1002, 1864, 1002], fill=(255, 215, 60, 180), width=2)

        tick_draw, f_ls_tick, ttw, tth = fit_text(f"INFOS MÉTÉO • {ticker_raw}", "segoeuib", 23, right_max_w, 15)
        d_ls.text((right_x, 1016), tick_draw, fill=(255, 215, 60), font=f_ls_tick)

        overlay_ls = os.path.join(work_dir, f"overlay_ls_{sc_id}.png")
        ls_img.save(overlay_ls)

        scenes.append({
            "id": sc_id,
            "file": local_file,
            "is_gif": is_gif,
            "t_start": t_cursor,
            "duration": dur,
            "card_h": 608 if idx == 0 else 805,
            "overlay_tk": overlay_tk,
            "overlay_ls": overlay_ls
        })
        t_cursor += dur

    # ── Rééquilibrage des scènes animées ────────────────────────────────────
    # Un GIF doit être vu en entier : on étend sa scène à la durée de son
    # animation réelle et on compense sur les autres scènes.
    if any(d > 0 for d in gif_durs):
        total_gif = sum(d for d in gif_durs if d > 0)
        print(f"🎞️ Animation(s) détectée(s) : {sum(1 for d in gif_durs if d > 0)} GIF totalisant {total_gif:.1f}s")
        new_durs, adjusted = rebalance_for_animations(scene_durs, gif_durs, voice_dur)

        if adjusted:
            # La voix off ne couvre pas toutes les animations : on informe
            # précisément de combien de mots il manque.
            needed_words = int(round(total_gif * 2.85)) - sum(
                len(s["script_text"].split()) for s in scenes_data
            )
            print(
                f"⚠️ Voix off trop courte pour couvrir les animations : "
                f"il manque environ {max(0, needed_words)} mots "
                f"({total_gif:.0f}s d'animation pour {voice_dur:.0f}s de voix). "
                f"Les GIF seront joués en boucle."
            )
            progress(session_id, 21,
                     f"⚠️ Voix off courte face aux animations ({max(0, needed_words)} mots manquants)",
                     "info")
        elif new_durs != scene_durs:
            for i, sc in enumerate(scenes):
                sc["duration"] = new_durs[i]
            for i, sc in enumerate(scenes):
                if i + 1 < len(scenes):
                    scenes[i + 1]["t_start"] = scenes[i]["t_start"] + scenes[i]["duration"]
            print("✅ Scènes rééquilibrées : chaque GIF joue son animation en entier.")
            for i, sc in enumerate(scenes):
                if gif_durs[i] > 0:
                    print(f"   Scène {i + 1} (GIF {gif_durs[i]:.1f}s) -> {sc['duration']:.1f}s")

    # Piste voix off unique (déjà générée d'un seul tenant)
    raw_master_wav = master_clean
    progress(session_id, 72, "🎵 Normalisation audio Broadcast (-14.5 LUFS)...", "audio")

    master_norm_wav = os.path.join(work_dir, "master_norm.wav")
    subprocess.run([
        "ffmpeg", "-y", "-i", raw_master_wav,
        "-af", "loudnorm=I=-14.5:TP=-1.0:LRA=7.0",
        "-ar", "48000", "-ac", "2",
        master_norm_wav
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    total_speech_dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", master_norm_wav]).decode().strip())
    print(f"🎙️ Piste voix off complète : {total_speech_dur:.2f}s")

    # Calage broadcast professionnel avec outro musicale et respect de target_duration
    if total_speech_dur >= (target_dur_input - 5.0):
        TARGET_DUR = round(max(total_speech_dur + 1.8, target_dur_input), 2)
    elif total_speech_dur >= (target_dur_input * 0.7):
        TARGET_DUR = round(total_speech_dur + 2.5, 2)
    else:
        TARGET_DUR = round(total_speech_dur + 2.0, 2)
    outro_dur = round(max(1.0, TARGET_DUR - total_speech_dur), 2)
    print(f"⏱️ Durée vidéo finale calibrée : {TARGET_DUR:.2f}s (Voix : {total_speech_dur:.2f}s | Outro musicale : {outro_dur:.2f}s)")

    # 2. Encodage TikTok (9:16)
    progress(session_id, 76, "📱 Encodage vidéo TikTok 9:16...", "video")
    rendered_tk = []
    for idx, sc in enumerate(scenes):
        clip_path = os.path.join(work_dir, f"tk_{sc['id']}.mp4")
        is_last = (idx == len(scenes) - 1)
        tpad_str = f",tpad=stop_mode=clone:stop_duration={outro_dur + 1.5:.2f}" if is_last else ""
        clip_dur = sc["duration"] + outro_dur + 0.5 if is_last else sc["duration"]

        cmd = ["ffmpeg", "-y"]
        if sc["is_gif"]:
            cmd.extend(["-ignore_loop", "0", "-i", sc["file"]])
        else:
            cmd.extend(["-loop", "1", "-i", sc["file"]])

        cmd.extend(["-i", sc["overlay_tk"]])
        if os.path.exists(BADGE_MP4):
            cmd.extend(["-stream_loop", "-1", "-ss", f"{sc['t_start']:.3f}", "-i", BADGE_MP4])
            badge_filter = "[2:v]scale=540:110[badge]; [comp2][badge]overlay=(1080-540)/2:1720"
        else:
            badge_filter = "[comp2]null"

        filter_complex = (
            f"[0:v]scale=1080:1300:force_original_aspect_ratio=decrease[main]; "
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,vflip,boxblur=35:5,eq=brightness=-0.08[bg_mirror]; "
            f"[bg_mirror][main]overlay=(W-w)/2:330+(1350-h)/2[comp1]; "
            f"[comp1][1:v]overlay=0:0[comp2]; "
            f"{badge_filter}{tpad_str}[outv]"
        )

        cmd.extend([
            "-filter_complex", filter_complex,
            "-map", "[outv]",
            "-t", f"{clip_dur:.3f}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-pix_fmt", "yuv420p", "-r", "30",
            clip_path
        ])
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        rendered_tk.append(clip_path)

    # Concat TikTok
    concat_tk_txt = os.path.join(work_dir, "concat_tk.txt")
    with open(concat_tk_txt, "w", encoding="utf-8") as f:
        for c in rendered_tk:
            f.write(f"file '{c.replace(os.sep, '/')}'\n")

    v_tk_only = os.path.join(work_dir, "v_tk_only.mp4")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_tk_txt, "-c", "copy", v_tk_only], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 3. Encodage Paysage (16:9)
    progress(session_id, 86, "🖥️ Encodage vidéo Paysage 16:9...", "video")
    rendered_ls = []
    for idx, sc in enumerate(scenes):
        clip_path = os.path.join(work_dir, f"ls_{sc['id']}.mp4")
        is_last = (idx == len(scenes) - 1)
        tpad_str = f",tpad=stop_mode=clone:stop_duration={outro_dur + 1.5:.2f}" if is_last else ""
        clip_dur = sc["duration"] + outro_dur + 0.5 if is_last else sc["duration"]

        cmd = ["ffmpeg", "-y"]
        if sc["is_gif"]:
            cmd.extend(["-ignore_loop", "0", "-i", sc["file"]])
        else:
            cmd.extend(["-loop", "1", "-i", sc["file"]])

        cmd.extend(["-i", sc["overlay_ls"]])

        filter_complex = (
            f"[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=25:5,eq=brightness=-0.12[bg]; "
            f"[0:v]scale=1920:930:force_original_aspect_ratio=decrease[fg]; "
            f"[bg][fg]overlay=(W-w)/2:(930-h)/2[comp]; "
            f"[comp][1:v]overlay=0:0{tpad_str}[outv]"
        )

        cmd.extend([
            "-filter_complex", filter_complex,
            "-map", "[outv]",
            "-t", f"{clip_dur:.3f}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-pix_fmt", "yuv420p", "-r", "30",
            clip_path
        ])
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        rendered_ls.append(clip_path)

    # Concat Paysage
    concat_ls_txt = os.path.join(work_dir, "concat_ls.txt")
    with open(concat_ls_txt, "w", encoding="utf-8") as f:
        for c in rendered_ls:
            f.write(f"file '{c.replace(os.sep, '/')}'\n")

    v_ls_only = os.path.join(work_dir, "v_ls_only.mp4")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_ls_txt, "-c", "copy", v_ls_only], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 4. Muxing avec calage temporel anti-écran noir
    progress(session_id, 93, "🛡️ Mixage voix + musique et contrôle qualité...", "audio")
    output_tk = os.path.join(work_dir, "bulletin_tiktok.mp4")
    output_ls = os.path.join(work_dir, "bulletin_paysage.mp4")

    for v_in, v_out, label in [(v_tk_only, output_tk, "TikTok"), (v_ls_only, output_ls, "Paysage")]:
        cmd_mux = [
            "ffmpeg", "-y",
            "-i", v_in,
            "-i", master_norm_wav,
            "-stream_loop", "-1", "-i", MUSIC_PATH,
            "-filter_complex",
            f"[2:a]atrim=0:{TARGET_DUR:.3f},asetpts=PTS-STARTPTS,volume=-26dB,afade=t=in:ss=0:d=1.0,afade=t=out:st={max(0.1, TARGET_DUR-1.0):.3f}:d=1.0[m]; "
            f"[1:a]atrim=0:{TARGET_DUR:.3f},asetpts=PTS-STARTPTS[v_speech]; "
            f"[v_speech][m]amix=inputs=2:dropout_transition=0:normalize=0[aout]",
            "-map", "0:v:0",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            "-t", f"{TARGET_DUR:.3f}",
            v_out
        ]
        subprocess.run(cmd_mux, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Contrôle qualité : la consigne « zéro écran noir » est vérifiée sur
        # TOUTE la dernière seconde (et les 3 premières), pas seulement sur
        # quelques images extraites avec un seuil permissif.
        qc_dir = os.path.join(work_dir, f"qc_{label}")
        os.makedirs(qc_dir, exist_ok=True)
        for prefix, seek in (("head", "0"), ("tail", "-1.2")):
            pattern = os.path.join(qc_dir, f"{prefix}_%03d.png")
            subprocess.run(
                ["ffmpeg", "-y", "-v", "error",
                 f"-{('ss' if prefix == 'head' else 'sseof')}", seek,
                 "-i", v_out, "-frames:v", "30", pattern],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
        checked = 0
        for ef in sorted(os.listdir(qc_dir)):
            stat = ImageStat.Stat(Image.open(os.path.join(qc_dir, ef)).convert("L"))
            lum, stddev = stat.mean[0], stat.stddev[0]
            checked += 1
            # < 16/255 = écran noir ; < 2 d'écart-type = image unie/grise
            if lum < 16 or stddev < 2:
                raise RuntimeError(
                    f"Alerte écran noir dans la version {label} ({ef} : luma={lum:.1f}, σ={stddev:.1f})"
                )
        print(f"🛡️ Contrôle {label} : {checked} images analysées (début + fin), aucune image noire.", flush=True)

    print(f"✅ Rendu terminé sans aucune image noire !", flush=True)

    # 5. Téléversement Supabase Storage (téléversement de secours = erreur fatale :
    #    publier un status « completed » sans MP4 ferait boucler la page de prod)
    progress(session_id, 97, "☁️ Téléversement sur Supabase Cloud Storage...", "info")
    tk_url = upload_required(output_tk, f"renders/{session_id}/bulletin_tiktok.mp4")
    ls_url = upload_required(output_ls, f"renders/{session_id}/bulletin_paysage.mp4")

    # Mettre à jour status.json
    status_payload = {
        "status": "completed",
        "session_id": session_id,
        "tiktok_url": tk_url,
        "landscape_url": ls_url,
        "duration": TARGET_DUR,
        "voice_duration": round(total_speech_dur, 2),
        "scenes": len(scenes),
        "updated_at": int(time.time())
    }
    status_file = os.path.join(work_dir, "status.json")
    with open(status_file, "w", encoding="utf-8") as f:
        json.dump(status_payload, f, indent=2, ensure_ascii=False)

    with open(status_file, "rb") as fh:
        payload_bytes = fh.read()
    storage_put(f"renders/{session_id}/status.json", payload_bytes,
                content_type="application/json", required=True, label="status.json")
    storage_put(f"renders/{session_id}/status_done.json", payload_bytes,
                content_type="application/json", label="status_done.json")

    progress(session_id, 100, "🎉 Rendu terminé : 2 vidéos prêtes !", "success")
    print(f"🎉 Job {session_id} terminé avec succès ! URLs :\n- TikTok: {tk_url}\n- Paysage: {ls_url}")

    # 6. Nettoyage des intermédiaires (les MP4 finaux restent pour inspection locale)
    if not os.environ.get("KEEP_WORK_DIR"):
        for name in os.listdir(work_dir):
            if name in ("bulletin_tiktok.mp4", "bulletin_paysage.mp4", "status.json"):
                continue
            path = os.path.join(work_dir, name)
            try:
                if os.path.isdir(path):
                    shutil.rmtree(path, ignore_errors=True)
                else:
                    os.remove(path)
            except OSError:
                pass
        print("🧹 Intermédiaires nettoyés.")


def publish_status(session_id, status, message, extra=None):
    """Publie un état terminal (failed / completed) lu par /api/status.

    Sans cela, un rendu qui casse laissait la page web en « encodage en cours »
    jusqu'au timeout de 15 minutes du workflow.
    """
    payload = {
        "status": status,
        "session_id": session_id,
        "message": message,
        "updated_at": int(time.time()),
    }
    if extra:
        payload.update(extra)
    data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    path = f"renders/{session_id}/status.json"
    ok = storage_put(path, data, content_type="application/json", label="status.json")
    if status == "failed":
        storage_put(f"renders/{session_id}/status_error.json", data,
                    content_type="application/json", label="status_error.json")
    return ok


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", required=True, help="Chemin vers le fichier job.json")
    args = parser.parse_args()

    # session_id lu à l'avance pour pouvoir publier un status d'échec.
    session_id = "unknown"
    try:
        with open(args.job, "r", encoding="utf-8") as fh:
            session_id = json.load(fh).get("session_id") or session_id
    except Exception:
        pass

    try:
        render(args.job)
    except Exception as exc:
        message = f"{type(exc).__name__}: {exc}"
        print(f"❌ Rendu en échec : {message}", file=sys.stderr, flush=True)
        print(f"RENDER_FAILED {message}", flush=True)  # marqueur lisible dans le log GH Actions
        try:
            publish_status(session_id, "failed", message)
        except Exception as exc_status:
            print(f"⚠️ Statut d'échec non publié : {exc_status}", flush=True)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
