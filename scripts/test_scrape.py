import urllib.request
import json
import re

slug = "episode-mediterraneen-sud-est-fortes-pluies-cevennes-provence-1792152126"
url = f"https://ubdevaemtwbzxksjlhjg.supabase.co/rest/v1/meteo_posts?select=title,excerpt,content,image_url&slug=eq.{slug}"
headers = {
    "apikey": "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP",
    "Authorization": "Bearer sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP"
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode("utf-8"))
    if data:
        post = data[0]
        print("Titre:", post["title"])
        print("Cover:", post["image_url"])
        imgs = re.findall(r'src=["\'](https://[^"\']+)["\']', post["content"])
        print(f"Total {len(imgs)} images:")
        for idx, img in enumerate(imgs):
            print(f"  {idx+1}: {img}")
