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
import argparse
import urllib.request
import urllib.parse
import subprocess
import wave
from PIL import Image, ImageDraw, ImageFont, ImageStat

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
MUSIC_PATH = os.path.join(ASSETS_DIR, "music", "bg_music.ogg")
BADGE_MP4 = os.path.join(ASSETS_DIR, "badges", "badge_blinking.mp4")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ubdevaemtwbzxksjlhjg.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", os.environ.get("SUPABASE_ANON_KEY", "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP"))
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

def download_file(url, out_path):
    print(f"📥 Téléchargement : {url} -> {out_path}")
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        }
    )
    with urllib.request.urlopen(req, timeout=60) as resp, open(out_path, "wb") as f:
        f.write(resp.read())

def upload_supabase(local_file, remote_path, content_type="video/mp4"):
    url = f"{SUPABASE_URL}/storage/v1/object/blog-images/{remote_path}"
    with open(local_file, "rb") as f:
        data = f.read()

    # Tentative 1 : POST standard
    try:
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": content_type
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            print(f"✅ Téléversé Supabase (POST) : {remote_path}")
            return f"{SUPABASE_URL}/storage/v1/object/public/blog-images/{remote_path}"
    except Exception as e:
        print(f"⚠️ POST Supabase {remote_path} : {e}, tentative PUT...")

    # Tentative 2 : PUT (upsert / remplacement)
    try:
        req_put = urllib.request.Request(
            url,
            data=data,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": content_type
            },
            method="PUT"
        )
        with urllib.request.urlopen(req_put, timeout=60) as resp:
            print(f"✅ Mis à jour Supabase (PUT) : {remote_path}")
            return f"{SUPABASE_URL}/storage/v1/object/public/blog-images/{remote_path}"
    except Exception as e2:
        print(f"⚠️ PUT Supabase {remote_path} : {e2}")

    return f"{SUPABASE_URL}/storage/v1/object/public/blog-images/{remote_path}"

def tts_charon(text, out_wav):
    url = "https://openrouter.ai/api/v1/audio/speech"
    payload = {
        "model": "google/gemini-3.8-flash-tts",
        "input": text,
        "voice": "Charon",
        "language": "fr-FR",
        "instructions": (
            "Voix de présentateur météo professionnel expert pour journal télévisé et réseaux sociaux. "
            "Prononciation impeccable en français standard parisien, diction fluide, naturelle et enchaînée, "
            "sans aucune pause artificielle ni blanc entre les phrases. Rythme dynamique, chaleureux et direct. "
            "Ne prononce jamais 'celsius', dis toujours 'degrés'."
        )
    }
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
    with urllib.request.urlopen(req, timeout=90) as resp:
        pcm = resp.read()

    with wave.open(out_wav, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(pcm)

def render(job_file):
    with open(job_file, "r", encoding="utf-8") as f:
        job = json.load(f)

    session_id = job.get("session_id", str(int(time.time())))
    scenes_data = job["scenes"]
    work_dir = os.path.join(BASE_DIR, "scratch", f"job_{session_id}")
    os.makedirs(work_dir, exist_ok=True)

    print(f"\n🚀 Démarrage du job {session_id} avec {len(scenes_data)} scènes...")

    # 1. Téléchargement des visuels et génération audio pour chaque scène
    scenes = []
    t_cursor = 0.0

    font_badge_tk = get_font("arialbd", 30)
    font_title_tk = get_font("arialbd", 44)
    font_sub_tk = get_font("arialbd", 28)

    font_ls_tag = get_font("arialbd", 22)
    font_ls_loc = get_font("arialbd", 36)
    font_ls_title = get_font("arialbd", 34)
    font_ls_ticker = get_font("segoeuib", 24)

    audio_segments = []

    for idx, sc_in in enumerate(scenes_data):
        sc_id = f"scene{idx+1}"
        file_input = sc_in["file"]
        local_file = os.path.join(work_dir, f"{sc_id}_{os.path.basename(file_input.split('?')[0])}")
        
        if file_input.startswith("http://") or file_input.startswith("https://"):
            download_file(file_input, local_file)
        else:
            import shutil
            shutil.copyfile(file_input, local_file)

        is_gif = local_file.lower().endswith(".gif")
        
        # Audio TTS pour cette scène
        raw_wav = os.path.join(work_dir, f"{sc_id}_raw.wav")
        clean_wav = os.path.join(work_dir, f"{sc_id}_clean.wav")
        print(f"🎙️ [Scène {idx+1}] Génération voix off Charon : \"{sc_in['script_text'][:40]}...\"")
        tts_charon(sc_in["script_text"], raw_wav)

        # Trimming uniquement des silences de début et de fin (sans couper les respirations internes)
        subprocess.run([
            "ffmpeg", "-y", "-i", raw_wav,
            "-af", "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse",
            "-ar", "48000", "-ac", "2",
            clean_wav
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        dur = float(subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", clean_wav
        ]).decode().strip())
        print(f"   ⏱️ Durée Scène {idx+1} : {dur:.2f}s")

        # Contrainte stricte pour la scène 1 (Accroche <= 4.0s)
        if idx == 0 and dur > 4.0:
            speed_ratio = min(dur / 3.9, 1.35)
            speed_wav = os.path.join(work_dir, f"{sc_id}_speed.wav")
            subprocess.run([
                "ffmpeg", "-y", "-i", clean_wav,
                "-af", f"atempo={speed_ratio:.3f}",
                speed_wav
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            clean_wav = speed_wav
            dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", clean_wav]).decode().strip())
            print(f"   ⚡ Scène 1 ajustée à : {dur:.2f}s")

        audio_segments.append(clean_wav)

        # Création des overlays graphiques
        badge_color = tuple(sc_in.get("badge_color", [220, 30, 30]))

        # TikTok Overlay (1080x1920)
        tk_img = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
        d_tk = ImageDraw.Draw(tk_img)
        box_x1, box_y1, box_x2, box_y2 = 50, 90, 1030, 305
        d_tk.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], radius=24, fill=(8, 14, 28, 225), outline=(255, 215, 60, 200), width=3)
        
        b_text = sc_in.get("badge", "ALERTE MÉTÉO")
        b_bbox = font_badge_tk.getbbox(b_text)
        b_w = (b_bbox[2] - b_bbox[0]) + 54
        b_h = (b_bbox[3] - b_bbox[1]) + 18
        b_x1 = (1080 - b_w) // 2
        b_y1 = box_y1 + 22
        d_tk.rounded_rectangle([b_x1, b_y1, b_x1 + b_w, b_y1 + b_h], radius=12, fill=badge_color)
        d_tk.ellipse([b_x1 + 14, b_y1 + (b_h - 12)//2, b_x1 + 26, b_y1 + (b_h - 12)//2 + 12], fill=(255, 255, 255))
        d_tk.text((b_x1 + 34, b_y1 + 8), b_text, fill=(255, 255, 255), font=font_badge_tk)
        
        t_text = sc_in.get("title", "")
        t_bbox = font_title_tk.getbbox(t_text)
        d_tk.text(((1080 - (t_bbox[2] - t_bbox[0])) // 2, box_y1 + 85), t_text, fill=(255, 255, 255), font=font_title_tk)
        
        s_text = sc_in.get("sub", "")
        s_bbox = font_sub_tk.getbbox(s_text)
        d_tk.text(((1080 - (s_bbox[2] - s_bbox[0])) // 2, box_y1 + 150), s_text, fill=(255, 215, 60), font=font_sub_tk)
        
        overlay_tk = os.path.join(work_dir, f"overlay_tk_{sc_id}.png")
        tk_img.save(overlay_tk)

        # Paysage Overlay (1920x1080)
        ls_img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
        d_ls = ImageDraw.Draw(ls_img)
        d_ls.rectangle([0, 930, 340, 1080], fill=badge_color)
        d_ls.ellipse([30, 952, 44, 966], fill=(255, 255, 255))
        d_ls.text((54, 948), "EN DIRECT", fill=(255, 255, 255), font=font_ls_tag)
        d_ls.text((30, 980), sc_in.get("location_tag", "SUD-EST"), fill=(255, 255, 255), font=font_ls_loc)
        d_ls.text((30, 1032), b_text, fill=(255, 220, 220), font=font_ls_tag)
        
        d_ls.rectangle([340, 930, 1920, 1005], fill=(8, 16, 30, 235))
        d_ls.text((370, 948), f"{t_text} — {s_text}", fill=(255, 255, 255), font=font_ls_title)
        
        d_ls.rectangle([340, 1005, 1920, 1080], fill=(16, 26, 46, 245))
        d_ls.line([340, 1005, 1920, 1005], fill=(255, 215, 60, 180), width=2)
        d_ls.text((370, 1024), f"INFOS MÉTÉO • {sc_in.get('ticker', '')}", fill=(255, 215, 60), font=font_ls_ticker)
        
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

    # Concaténation de l'audio total
    audio_concat_txt = os.path.join(work_dir, "audio_concat.txt")
    with open(audio_concat_txt, "w", encoding="utf-8") as f:
        for a in audio_segments:
            f.write(f"file '{a.replace(os.sep, '/')}'\n")

    raw_master_wav = os.path.join(work_dir, "master_raw.wav")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", audio_concat_txt, "-c", "copy", raw_master_wav], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    master_norm_wav = os.path.join(work_dir, "master_norm.wav")
    subprocess.run([
        "ffmpeg", "-y", "-i", raw_master_wav,
        "-af", "loudnorm=I=-14.5:TP=-1.0:LRA=7.0",
        "-ar", "48000", "-ac", "2",
        master_norm_wav
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    total_speech_dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", master_norm_wav]).decode().strip())
    print(f"🎙️ Piste voix off complète : {total_speech_dur:.2f}s")

    # 2. Encodage TikTok (9:16)
    rendered_tk = []
    for idx, sc in enumerate(scenes):
        clip_path = os.path.join(work_dir, f"tk_{sc['id']}.mp4")
        is_last = (idx == len(scenes) - 1)
        tpad_str = ",tpad=stop_mode=clone:stop_duration=1.5" if is_last else ""
        clip_dur = sc["duration"] + 1.0 if is_last else sc["duration"]

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
    rendered_ls = []
    for idx, sc in enumerate(scenes):
        clip_path = os.path.join(work_dir, f"ls_{sc['id']}.mp4")
        is_last = (idx == len(scenes) - 1)
        tpad_str = ",tpad=stop_mode=clone:stop_duration=1.5" if is_last else ""
        clip_dur = sc["duration"] + 1.0 if is_last else sc["duration"]

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
    TARGET_DUR = round(total_speech_dur - 0.13, 2)
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
        
        # Contrôle qualité : vérifier les 5 dernières images
        qc_dir = os.path.join(work_dir, f"qc_{label}")
        os.makedirs(qc_dir, exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-sseof", "-0.3", "-i", v_out, os.path.join(qc_dir, "f_%02d.png")], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for ef in os.listdir(qc_dir):
            stat = ImageStat.Stat(Image.open(os.path.join(qc_dir, ef)))
            lum = sum(stat.mean[:3]) / 3.0
            assert lum > 30, f"Alerte image sombre détectée dans {label} ({ef})"

    print(f"✅ Rendu terminé sans aucune image noire !")

    # 5. Téléversement Supabase Storage
    tk_url = upload_supabase(output_tk, f"renders/{session_id}/bulletin_tiktok.mp4")
    ls_url = upload_supabase(output_ls, f"renders/{session_id}/bulletin_paysage.mp4")

    # Mettre à jour status.json
    status_payload = {
        "status": "completed",
        "session_id": session_id,
        "tiktok_url": tk_url,
        "landscape_url": ls_url,
        "duration": TARGET_DUR,
        "updated_at": int(time.time())
    }
    status_file = os.path.join(work_dir, "status.json")
    with open(status_file, "w", encoding="utf-8") as f:
        json.dump(status_payload, f, indent=2)

    status_url = upload_supabase(status_file, f"renders/{session_id}/status.json", content_type="application/json")
    upload_supabase(status_file, f"renders/{session_id}/status_done.json", content_type="application/json")
    print(f"🎉 Job {session_id} terminé avec succès ! URLs :\n- TikTok: {tk_url}\n- Paysage: {ls_url}\n- Status: {status_url}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", required=True, help="Chemin vers le fichier job.json")
    args = parser.parse_args()
    render(args.job)
