import urllib.request
import json

url = "https://video-meteo-pro.vercel.app/api/import-article"
payload = {"url": "https://meteobtp.fr/actualites/episode-mediterraneen-sud-est-fortes-pluies-cevennes-provence-1792152126"}

req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode("utf-8"))

print("Keys:", list(data.keys()))
print("Title:", data.get("title"))
print("Phenomenon:", data.get("phenomenon"))
print("Cover:", data.get("cover_image"))
print("Content images count:", len(data.get("content_images") or []))
scenes = data.get("scenes") or []
print(f"Scenes ({len(scenes)}):")
for s in scenes:
    print(f"  Scene {s.get('scene_number')}: badge='{s.get('badge')}' title='{s.get('title')}'")
    print(f"    file_url='{s.get('file_url')}'")
    print(f"    script_text='{s.get('script_text')}'")
