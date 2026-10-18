import urllib.request
import json
import re

SUPABASE_URL = "https://ubdevaemtwbzxksjlhjg.supabase.co"
ANON_KEY = "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP"
headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json"
}

# 1. Fetch current content
url_get = f"{SUPABASE_URL}/rest/v1/meteo_posts?id=eq.5cb21b4a-8160-435d-9a76-66198f1bcc92"
req = urllib.request.Request(url_get, headers=headers)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode("utf-8"))

content = data[0]["content"]
print("Original length:", len(content))

# 2. Cut off trailing images dumped at the bottom
sources_idx = content.find("Sources : Modèle numérique GFS")
if sources_idx != -1:
    end_p_idx = content.find("</p>", sources_idx)
    if end_p_idx != -1:
        content = content[:end_p_idx + 4] + "</div>"

# 3. Replace IMAGE 1 placeholder
img1_html = """<div style="margin: 28px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
  <img src="https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/renders/session_1792338945043/batch_6_1792338945048_MeteoClimatPro_GFS_0_25__Europe_geopotentiel-500-hpa_1792336702587.png" alt="Géopotentiel à 500 hPa et pression au sol" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
  <p style="font-size: 13px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
    <strong style="color: #f1f5f9;">Figure 1 :</strong> Géopotentiel à 500 hPa et pression au sol, Europe et Atlantique Nord, modèle GFS 0,25°, run 06 UTC, échéance vendredi 23 octobre 2026 à 02 h. Dépression principale à 984 hPa sur l'Atlantique Nord.
  </p>
</div>
<h3 style="font-size: 20px; font-weight: 800; color: #38bdf8; margin: 32px 0 16px 0;">Comprendre pourquoi une dépression peut provoquer des vents violents</h3>"""

content = re.sub(r"<p[^>]*>IMAGE 1 À INSÉRER[^\n<]+</p>", img1_html, content)

# 4. Replace IMAGE 2 placeholder
img2_html = """<div style="margin: 28px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
  <img src="https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/renders/session_1792338945043/batch_5_1792338945048_MeteoClimatPro_GFS_0_25__France_rafales-max-periode_1792338443593.png" alt="Rafales maximales simulées en km/h" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
  <p style="font-size: 13px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
    <strong style="color: #f1f5f9;">Figure 2 :</strong> Rafales maximales simulées en km/h sur la France, période du 18 au 22 octobre 2026, modèle GFS 0,25°, run 06 UTC. La carte montre un renforcement du risque venteux sur la moitié nord et les régions occidentales.
  </p>
</div>
<h3 style="font-size: 20px; font-weight: 800; color: #38bdf8; margin: 32px 0 16px 0;">TROIS SITUATIONS À SURVEILLER</h3>"""

content = re.sub(r"<p[^>]*>IMAGE 2 À INSÉRER[^\n<]+</p>", img2_html, content)

# 5. Replace IMAGE 3 placeholder
img3_html = """<div style="margin: 28px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
  <img src="https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/renders/session_1792338945043/batch_1_1792338945044_MeteoClimatPro_GFS_0_25__France_pluie-periode_1792338574811.png" alt="Cumuls de précipitations prévus en millimètres" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
  <p style="font-size: 13px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
    <strong style="color: #f1f5f9;">Figure 3 :</strong> Cumuls de précipitations prévus en millimètres entre le 18 et le 22 octobre 2026, modèle GFS 0,25°, run 06 UTC. Des cumuls importants sont simulés dans le sud-est et dans plusieurs secteurs occidentaux.
  </p>
</div>
<h3 style="font-size: 20px; font-weight: 800; color: #38bdf8; margin: 32px 0 16px 0;">À ne pas interpréter comme une certitude absolue :</h3>"""

content = re.sub(r"<p[^>]*>IMAGE 3 À INSÉRER[^\n<]+</p>", img3_html, content)

imgs = re.findall(r"<img[^>]+>", content)
print("Repaired content length:", len(content))
print("Final inline image count:", len(imgs))

# 6. Update meteo_posts (Dark theme for monsieurmeteo.com)
patch_req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/meteo_posts?id=eq.5cb21b4a-8160-435d-9a76-66198f1bcc92",
    data=json.dumps({"content": content}).encode("utf-8"),
    headers=headers,
    method="PATCH"
)
with urllib.request.urlopen(patch_req) as resp:
    print("meteo_posts patch response:", resp.status)

# 7. Update posts (Light theme for meteobtp.fr and climat-meteo)
light_content = content
light_replacements = [
    (r"color:\s*#f1f5f9", "color: #1e293b"),
    (r"color:\s*#f8fafc", "color: #0f172a"),
    (r"color:\s*#ffffff", "color: #0f172a"),
    (r"color:\s*#cbd5e1", "color: #334155"),
    (r"color:\s*#94a3b8", "color: #64748b"),
    (r"color:\s*#38bdf8", "color: #0284c7"),
    (r"background:\s*rgba\(15,\s*23,\s*42,\s*0\.[0-9]+\)", "background: #f8fafc; color: #1e293b")
]
for pat, rep in light_replacements:
    light_content = re.sub(pat, rep, light_content, flags=re.IGNORECASE)

patch_posts_req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/posts?id=eq.0bb4d7f4-ee3a-491a-83d0-7f8430ce31ce",
    data=json.dumps({"content": light_content}).encode("utf-8"),
    headers=headers,
    method="PATCH"
)
with urllib.request.urlopen(patch_posts_req) as resp:
    print("posts patch response:", resp.status)

print("SUCCESS: Both tables updated with inline images positioned properly!")
