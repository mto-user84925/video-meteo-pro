import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

// ============================================================================
// MÉTHODE C : CATALOGUE THÉMATIQUE DE SUBSTITUTION HAUTE RÉSOLUTION (SUPABASE)
// Utilisé automatiquement si l'article externe ne comporte pas assez de cartes
// ============================================================================
const THEMATIC_WEATHER_MAPS: Record<string, string[]> = {
  // 1. Épisode méditerranéen / Cévenol / Inondations / Pluies diluviennes
  rain: [
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792153060_couverture_deluge_fortes_pluies_16_9.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152013_MeteoClimatPro_ECMWF_AIFS_0_25__Europe_geopotentiel-500-hpa_1792130672739.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152015_MeteoClimatPro_ECMWF_AIFS_0_25__France_precipitations-cumulees_1792151417749.gif",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152014_MeteoClimatPro_ECMWF_AIFS_0_25__France_pluie-periode_1792130457894.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152016_MeteoClimatPro_ECMWF_AIFS_0_25__France_precipitations-cumulees_1792151648872.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/auto_1788809628_00_COUVERTURE_PLUIE_16_9.png"
  ],
  // 2. Tempête / Coup de vent violent / Rafales
  wind: [
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/auto_1788799092_00_COUVERTURE_BRETAGNE_PEAK_16_9.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/auto_1788802674_00_COUVERTURE_PACIFIQUE_RAFALES_16_9.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/auto_1788798213_00_COUVERTURE_16_9.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152013_MeteoClimatPro_ECMWF_AIFS_0_25__Europe_geopotentiel-500-hpa_1792130672739.png"
  ],
  // 3. Orages violents / Grêle / Foudre
  storm: [
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/auto_1788795366_00_COUVERTURE_16_9.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/auto_1788802918_00_COUVERTURE_ORAGES_16_9.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152015_MeteoClimatPro_ECMWF_AIFS_0_25__France_precipitations-cumulees_1792151417749.gif",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152016_MeteoClimatPro_ECMWF_AIFS_0_25__France_precipitations-cumulees_1792151648872.png"
  ],
  // 4. Canicule / Vague de chaleur / Sécheresse
  heat: [
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1788435712_MeteoClimatPro_GFS_0_25__France_temperature-maximale-tx-24h_1788435284929.jpg",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1788435438_MeteoClimatPro_ARPEGE_France_0_1__temperature-maximale-tx-24h_1788434956994.jpg",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1788206657_GFS_0_25_temperature_850_hpa_europe.gif",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1781571152471_cover.png"
  ],
  // 5. Neige / Verglas / Grand froid
  snow: [
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152013_MeteoClimatPro_ECMWF_AIFS_0_25__Europe_geopotentiel-500-hpa_1792130672739.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1788438222_ChatGPT_Image_3_sept._2026__14_22_54.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/auto_1788810525_00_COUVERTURE_VIGILANCE_16_9.png"
  ],
  // 6. Tendance générale / Synoptique / Vigilance
  default: [
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792153060_couverture_deluge_fortes_pluies_16_9.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152013_MeteoClimatPro_ECMWF_AIFS_0_25__Europe_geopotentiel-500-hpa_1792130672739.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152015_MeteoClimatPro_ECMWF_AIFS_0_25__France_precipitations-cumulees_1792151417749.gif",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152014_MeteoClimatPro_ECMWF_AIFS_0_25__France_pluie-periode_1792130457894.png",
    "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152016_MeteoClimatPro_ECMWF_AIFS_0_25__France_precipitations-cumulees_1792151648872.png"
  ]
};

function getThematicFallbackImages(contextText: string): string[] {
  const low = contextText.toLowerCase();
  if (low.includes("pluie") || low.includes("inond") || low.includes("crue") || low.includes("céven") || low.includes("ceven") || low.includes("méditerran") || low.includes("deluge")) {
    return THEMATIC_WEATHER_MAPS.rain;
  }
  if (low.includes("vent") || low.includes("tempête") || low.includes("tempete") || low.includes("rafale") || low.includes("gale") || low.includes("cyclon") || low.includes("ouragan")) {
    return THEMATIC_WEATHER_MAPS.wind;
  }
  if (low.includes("orage") || low.includes("foudre") || low.includes("grêle") || low.includes("grele") || low.includes("tornad")) {
    return THEMATIC_WEATHER_MAPS.storm;
  }
  if (low.includes("canic") || low.includes("chaleur") || low.includes("fournaise") || low.includes("sécheresse") || low.includes("secheresse") || low.includes("soleil")) {
    return THEMATIC_WEATHER_MAPS.heat;
  }
  if (low.includes("neige") || low.includes("verglas") || low.includes("froid") || low.includes("gel") || low.includes("hiver")) {
    return THEMATIC_WEATHER_MAPS.snow;
  }
  return THEMATIC_WEATHER_MAPS.default;
}

// Téléversement d'une image distante vers Supabase Storage pour contourner CORS et blocages hotlinking
async function uploadToSupabase(buffer: ArrayBuffer, contentType: string, ext = "jpg"): Promise<string | null> {
  const remotePath = `renders/imports/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/blog-images/${remotePath}`;
  try {
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": contentType || "image/jpeg"
      },
      body: Buffer.from(buffer)
    });
    if (res.ok) {
      return `${SUPABASE_URL}/storage/v1/object/public/blog-images/${remotePath}`;
    }
  } catch (err) {
    console.error("Erreur téléversement Supabase:", err);
  }
  return null;
}

// Nettoyage et filtrage intelligent des URLs d'images candidates (avec dédoublonnage par nom de fichier)
function cleanCandidateUrls(rawCandidates: string[], baseUrl: string): string[] {
  const validUrls: string[] = [];
  const seenFileNames = new Map<string, number>(); // filename -> index in validUrls
  const bannedKeywords = [
    "logo", "icon", "avatar", "favicon", "pixel", "spinner", "badge",
    "ad-", "ads-", "banner", "sponsor", "author", "share", "facebook",
    "twitter", "instagram", "didomi", "cookie", "tracker", "spacer",
    "/menu/", "bckg_", "newsroom", "google-play", "apple-store", "/flags/"
  ];
  const weatherWhitelist = ["carte", "radar", "meteo", "vigilance", "cumul", "modele", "satellite", "prevision", "aifs", "ecmwf", "arome", "gfs", "arpege", "reporter"];

  const getPixelArea = (u: string): number => {
    const m = u.toLowerCase().match(/(\d{2,4})x(\d{2,4})/);
    return m ? Number(m[1]) * Number(m[2]) : 0;
  };

  for (let raw of rawCandidates) {
    if (!raw || typeof raw !== "string") continue;
    raw = raw.trim();
    if (raw.startsWith("data:") || raw.startsWith("blob:")) continue;

    // Décodage des URLs encapsulées (ex: cdn-cgi/image/... or url=https%3A...)
    if (raw.includes("url=")) {
      const uMatch = raw.match(/url=([^&]+)/);
      if (uMatch) raw = decodeURIComponent(uMatch[1]);
    }
    raw = raw.replace(/&amp;/g, "&");

    let resolved = raw;
    try {
      if (raw.startsWith("//")) resolved = "https:" + raw;
      else if (raw.startsWith("/") || !raw.startsWith("http")) resolved = new URL(raw, baseUrl).href;
    } catch {
      continue;
    }

    const low = resolved.toLowerCase();
    if (low.endsWith(".svg") || resolved === baseUrl) continue;
    if ((low.match(/\(/g) || []).length !== (low.match(/\)/g) || []).length) continue; // URL tronquée

    // Écarter toute miniature ou bannière UI dont les dimensions WxH dans l'URL sont < 400x200
    const dimMatches = [...low.matchAll(/(\d{2,4})x(\d{2,4})/g)];
    if (dimMatches.some(m => Number(m[1]) < 400 || Number(m[2]) < 200)) continue;

    const hasBanned = bannedKeywords.some(b => low.includes(b));
    const isWhitelisted = weatherWhitelist.some(w => low.includes(w));

    if (hasBanned && !isWhitelisted) continue;

    if (validUrls.includes(resolved)) continue;

    // Dédoublonnage par nom de fichier (ex: Thumbor sert la même photo en 658x370, 1200x630, 1316x740)
    const baseFile = resolved.split("?")[0].split("/").pop()?.toLowerCase() || "";
    if (baseFile.length > 10 && /\.(?:jpe?g|png|webp|gif|avif)$/.test(baseFile)) {
      if (seenFileNames.has(baseFile)) {
        const existingIdx = seenFileNames.get(baseFile)!;
        if (getPixelArea(resolved) > getPixelArea(validUrls[existingIdx])) {
          validUrls[existingIdx] = resolved; // Garder la version la plus haute définition
        }
        continue;
      }
      seenFileNames.set(baseFile, validUrls.length);
    }

    validUrls.push(resolved);
  }

  return validUrls;
}

function parseJsonSafe(raw: string): any {
  const cleaned = (raw || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }
  return JSON.parse(cleaned);
}

export async function POST(req: Request) {
  try {
    const { url, target_duration = 60, scene_count = 5 } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL manquante ou invalide" }, { status: 400 });
    }

    const cleanUrl = url.trim();
    const durationSec = Number(target_duration) || 60;
    const numScenes = Math.max(2, Math.min(10, Number(scene_count) || 5));
    const totalWordsTarget = Math.round(durationSec * 2.5);
    const wordsPerLaterScene = Math.round((totalWordsTarget - 14) / (numScenes - 1));

    let title = "";
    let excerpt = "";
    let coverImage = "";
    let contentImages: string[] = [];
    let articleText = "";
    let rawImageCandidates: string[] = [];
    let methodUsed = "none";

    // ========================================================================
    // ÉTAPE 0 : DÉTECTION RAPIDE RÉSEAU SUPABASE (meteobtp, monsieurmeteo, etc.)
    // ========================================================================
    const isOurNetwork = cleanUrl.includes("meteobtp.fr") ||
                         cleanUrl.includes("monsieurmeteo.com") ||
                         cleanUrl.includes("climat-meteo.vercel.app");

    if (isOurNetwork) {
      try {
        const urlParts = cleanUrl.split("?")[0].replace(/\/+$/, "").split("/");
        const slug = urlParts[urlParts.length - 1];

        const supaUrl = `${SUPABASE_URL}/rest/v1/meteo_posts?select=title,excerpt,content,image_url&slug=eq.${encodeURIComponent(slug)}`;
        const supaRes = await fetch(supaUrl, {
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`
          },
          signal: AbortSignal.timeout(6000)
        });

        if (supaRes.ok) {
          const data = await supaRes.json();
          if (data && data.length > 0) {
            const post = data[0];
            title = post.title || "";
            excerpt = post.excerpt || "";
            coverImage = post.image_url || "";
            articleText = `${title}\n${excerpt}\n` + (post.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

            const regex = /src=["'](https:\/\/[^"']+)["']/g;
            let match;
            while ((match = regex.exec(post.content || "")) !== null) {
              contentImages.push(match[1]);
            }
            if (coverImage) rawImageCandidates.push(coverImage);
            rawImageCandidates.push(...contentImages);
            methodUsed = "supabase_direct";
          }
        }
      } catch (err) {
        console.warn("Échec lookup Supabase interne, poursuite en cascade:", err);
      }
    }

    // ========================================================================
    // CASCADE NIVEAU 1 : MÉTHODE A - SCRAPING DIRECT AVEC PARSING EXHAUSTIF
    // ========================================================================
    let directFetchOk = false;
    if (!title || rawImageCandidates.length === 0) {
      try {
        const pageRes = await fetch(cleanUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Cache-Control": "no-cache"
          },
          signal: AbortSignal.timeout(6000)
        });

        if (pageRes.ok) {
          const html = await pageRes.text();
          const isAntiBot = html.includes("Just a moment...") ||
                            html.includes("cf-browser-verification") ||
                            html.includes("challenge-running") ||
                            html.includes("Attention Required! | Cloudflare");

          if (!isAntiBot && html.length > 500) {
            directFetchOk = true;
            methodUsed = "direct_scraping";

            const jsonLdMatches = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
            for (const jm of jsonLdMatches) {
              try {
                const parsed = JSON.parse(jm[1].trim());
                const items = Array.isArray(parsed) ? parsed : (parsed["@graph"] ? parsed["@graph"] : [parsed]);
                for (const item of items) {
                  const itemType = (item["@type"] || "").toString();
                  if (itemType.includes("Article") || itemType.includes("News") || itemType.includes("Post") || itemType.includes("Page")) {
                    if (!title && item.headline) title = item.headline;
                    if (!articleText && item.articleBody) articleText = item.articleBody;
                    if (item.image) {
                      if (typeof item.image === "string") rawImageCandidates.push(item.image);
                      else if (Array.isArray(item.image)) {
                        for (const im of item.image) {
                          if (typeof im === "string") rawImageCandidates.push(im);
                          else if (im && im.url) rawImageCandidates.push(im.url);
                        }
                      } else if (item.image.url) {
                        rawImageCandidates.push(item.image.url);
                      }
                    }
                  }
                }
              } catch {}
            }

            if (!title) {
              const ogTitleMatch = html.match(/<meta\s+[^>]*(?:property|name)=["'](?:og:title|twitter:title)["'][^>]*content=["']([^"']+)["']/i) ||
                                   html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:title|twitter:title)["']/i);
              const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
              const titleTagMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);

              if (ogTitleMatch) title = ogTitleMatch[1];
              else if (h1Match) title = h1Match[1].replace(/<[^>]+>/g, "").trim();
              else if (titleTagMatch) title = titleTagMatch[1].replace(/<[^>]+>/g, "").trim();
            }

            const metaImgMatches = [
              ...html.matchAll(/<meta\s+[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/gi),
              ...html.matchAll(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/gi)
            ];
            for (const m of metaImgMatches) {
              if (m[1]) rawImageCandidates.push(m[1]);
            }

            const imgRegex = /<img\b([^>]+)>/gi;
            let imgM;
            while ((imgM = imgRegex.exec(html)) !== null) {
              const tag = imgM[1];
              const attrMatch = tag.match(/(?:src|data-src|data-original|data-lazy-src|data-hi-res-src)=["']([^"']+)["']/i);
              if (attrMatch) rawImageCandidates.push(attrMatch[1]);

              const srcsetMatch = tag.match(/(?:srcset|data-srcset)=["']([^"']+)["']/i);
              if (srcsetMatch) {
                const parts = srcsetMatch[1].split(",").map(p => p.trim().split(/\s+/)[0]);
                if (parts.length > 0) rawImageCandidates.push(parts[parts.length - 1]);
              }
            }

            if (!articleText || articleText.length < 150) {
              const textClean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
                                    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
                                    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
                                    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
                                    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, "")
                                    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
                                    .replace(/<[^>]+>/g, " ")
                                    .replace(/\s+/g, " ");
              articleText = textClean.slice(0, 4500);
            }
          }
        }
      } catch (directErr) {
        console.warn("Échec requête directe:", directErr);
      }
    }

    // ========================================================================
    // CASCADE NIVEAU 2 : MÉTHODE B - PROXY UNIVERSEL JINA READER (FALLBACK)
    // ========================================================================
    const needJinaFallback = !directFetchOk ||
                             !title ||
                             articleText.length < 120 ||
                             cleanCandidateUrls(rawImageCandidates, cleanUrl).length < 2;

    if (needJinaFallback && !isOurNetwork) {
      try {
        const jinaUrl = `https://r.jina.ai/${encodeURI(cleanUrl)}`;
        const jinaRes = await fetch(jinaUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "X-With-Images-Summary": "true",
            "X-No-Cache": "true"
          },
          signal: AbortSignal.timeout(12000)
        });

        if (jinaRes.ok) {
          const jinaJson = await jinaRes.json();
          if (jinaJson && jinaJson.data) {
            methodUsed = "jina_reader";
            const jData = jinaJson.data;

            if (!title || title.length < 10) {
              title = jData.title || title;
            }

            if (!articleText || articleText.length < 150) {
              articleText = (jData.content || "").slice(0, 4500);
            }

            // Récupération des images complètes via le dictionnaire Jina (non tronqué sans X-Return-Format)
            if (jData.images && typeof jData.images === "object") {
              for (const imgUrl of Object.values(jData.images)) {
                if (typeof imgUrl === "string") {
                  rawImageCandidates.push(imgUrl);
                }
              }
            }

            // Récupération dans le markdown avec équilibrage des parenthèses (gère filters:quality(80) suivi de )Texte)
            const contentStr = jData.content || "";
            const httpRe = /https?:\/\//gi;
            let hm;
            while ((hm = httpRe.exec(contentStr)) !== null) {
              let depth = 0;
              let endIdx = hm.index;
              while (endIdx < contentStr.length) {
                const ch = contentStr[endIdx];
                if (/[\s"'<>\[\]]/.test(ch)) break;
                if (ch === "(") depth++;
                else if (ch === ")") {
                  if (depth > 0) depth--;
                  else break;
                }
                endIdx++;
              }
              const candidateUrl = contentStr.slice(hm.index, endIdx);
              if (/\.(?:jpe?g|png|webp|gif|avif)(?:\?|$)/i.test(candidateUrl)) {
                rawImageCandidates.push(candidateUrl);
              }
            }
          }
        }
      } catch (jinaErr) {
        console.warn("Échec proxy Jina Reader:", jinaErr);
      }
    }

    if (!articleText && title) {
      articleText = title;
    }

    // ========================================================================
    // EXÉCUTION EN PARALLÈLE : MIROIR IMAGES SUPABASE + GÉNÉRATION SCRIPT IA
    // (Divise le temps d'attente par 2 et évite tout timeout)
    // ========================================================================
    const validUrls = cleanCandidateUrls(rawImageCandidates, cleanUrl);
    const toMirror = validUrls.slice(0, 8);
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    const mirrorOne = async (candidate: string): Promise<string | null> => {
      if (candidate.includes("supabase.co/storage")) return candidate;
      const sources = [
        candidate,
        `https://images.weserv.nl/?url=${encodeURIComponent(candidate)}&output=jpg&w=1920`
      ];
      for (const src of sources) {
        try {
          const imgRes = await fetch(src, {
            headers: { "User-Agent": UA, "Referer": cleanUrl, "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" },
            signal: AbortSignal.timeout(4500)
          });
          if (!imgRes.ok) continue;
          const cType = imgRes.headers.get("content-type") || "";
          if (!cType.startsWith("image/")) continue;
          const buf = await imgRes.arrayBuffer();
          if (buf.byteLength < 15000) continue;
          const ext = cType.includes("png") ? "png" : cType.includes("gif") ? "gif" : "jpg";
          const supaUrl = await uploadToSupabase(buf, cType, ext);
          if (supaUrl) return supaUrl;
        } catch {}
      }
      return candidate; // conservée telle quelle : render_engine la téléchargera via empreinte Chrome
    };

    const generateAiScript = async (): Promise<{ scenes: any[]; phenomenon: string }> => {
      if (!OPENROUTER_API_KEY || !articleText) return { scenes: [], phenomenon: "" };
      const systemPrompt = `Tu es le rédacteur météo en chef pour Météo-Climat Pro et Monsieur Météo (Patrick Marlière).
À partir de l'article météo fourni, génère un script vidéo structuré en EXACTEMENT ${numScenes} SCÈNES calibrées pour une durée globale de ${durationSec} SECONDES (soit un total d'environ ${totalWordsTarget} mots), et identifie le phénomène météo principal.

RÈGLES IMPÉRATIVES DE CALIBRAGE :
1. Scène 1 (Accroche percutante) : STRICTEMENT <= 4 secondes de lecture (12 à 15 mots max). Ton d'alerte immédiat.
2. Scènes 2 à ${numScenes - 1} : Chaque scène doit comporter environ ${wordsPerLaterScene} mots avec des détails techniques et pédagogiques fluides :
   - Analyse synoptique d'altitude (gouttes froides, anticyclones, anomalies de géopotentiel, flux directeurs).
   - Chronologie exacte du front ou de l'épisode météo.
   - Chiffres de modélisation (lames d'eau horaires, cumuls totaux en mm, rafales en km/h, anomalies).
   - Départements et bassins versants exposés.
3. Scène ${numScenes} (Paroxysme & Signature) : Environ ${wordsPerLaterScene} mots résumant le pic du phénomène, les consignes de vigilance et la signature obligatoire finale : "...et restez connectés avec METEO CLIMAT PRO."
4. Cartouches courts (zéro débordement) :
   - "badge" : <= 20 caractères (ex: "ALERTE MÉTÉO", "ANALYSE SYNOPTIQUE", "CHRONOLOGIE", "CUMULS & VENTS", "VIGILANCE").
   - "location_tag" : <= 16 caractères (ex: "MOITIÉ NORD", "ATLANTIQUE NORD", "MANCHE / NORD", "SUD-EST", "FRANCE ENTIÈRE").
   - "title" : <= 28 caractères.
   - "sub" : <= 26 caractères.
5. Vocabulaire : Ne dis jamais "celsius" mais "degrés". Pas de mention "Météo-France" ni du site source, utilise toujours "Météo-Climat Pro" ou "nos modélisations haute résolution".

Format JSON STRICT :
{
  "phenomenon": "Nom synthétique du phénomène",
  "scenes": [
    {
      "scene_number": 1,
      "badge": "ALERTE MÉTÉO",
      "badge_color": [220, 30, 30],
      "title": "TITRE SCÈNE",
      "sub": "SOUS-TITRE COURT",
      "location_tag": "MOITIÉ NORD",
      "ticker": "Bandeau défilant court",
      "script_text": "Accroche percutante"
    }
  ]
}`;

      try {
        const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://video-meteo-pro.vercel.app",
            "X-Title": "Video Meteo Pro Auto Import"
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Titre : ${title}\n\nContenu de l'article :\n${articleText}\n\nDurée vidéo ciblée : ${durationSec} secondes (environ ${totalWordsTarget} mots pour ${numScenes} scènes).` }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
          }),
          signal: AbortSignal.timeout(28000)
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const parsed = parseJsonSafe(aiData.choices?.[0]?.message?.content || "{}");
          return { scenes: parsed.scenes || [], phenomenon: parsed.phenomenon || "" };
        }
      } catch (aiErr) {
        console.error("Erreur IA Gemini Flash:", aiErr);
      }
      return { scenes: [], phenomenon: "" };
    };

    const [mirrorResults, aiResult] = await Promise.all([
      Promise.all(toMirror.map(mirrorOne)),
      generateAiScript()
    ]);

    const cleanMirrored = (mirrorResults.filter(Boolean) as string[]).slice(0, 8);
    const generatedScenes = aiResult.scenes;
    const detectedPhenomenon = aiResult.phenomenon;

    // Si l'article possède au moins 1 vraie image, on boucle UNIQUEMENT sur les vraies images de l'article !
    // On n'utilise le catalogue thématique de secours que si 0 image n'a pu être extraite.
    const availablePool = cleanMirrored.length > 0
      ? cleanMirrored
      : getThematicFallbackImages(`${title} ${articleText}`);

    coverImage = availablePool[0];
    contentImages = availablePool.slice(1);

    const pool = availablePool.length > 0 ? availablePool : THEMATIC_WEATHER_MAPS.default;

    const baseScenes = (generatedScenes && generatedScenes.length >= 2)
      ? generatedScenes
      : Array.from({ length: numScenes }, (_, idx) => ({
          scene_number: idx + 1,
          badge: idx === 0 ? "ALERTE MÉTÉO" : "ANALYSE MÉTÉO",
          badge_color: idx === 0 ? [220, 30, 30] : [30, 120, 240],
          title: (title || `SCÈNE ${idx + 1}`).slice(0, 28).toUpperCase(),
          sub: "PRÉVISIONS MÉTÉO-CLIMAT PRO",
          location_tag: "FRANCE",
          ticker: title || "Suivi en direct • Modélisations haute résolution • Météo-Climat Pro",
          script_text: idx === 0
            ? (title ? `Attention ! ${title}.` : "Attention aux intempéries prévues dans les prochaines heures.")
            : "Nos modélisations haute résolution confirment l'évolution rapide de la situation synoptique. Restez connectés avec METEO CLIMAT PRO."
        }));

    const finalScenes = baseScenes.map((sc, i) => {
      const chosenUrl = pool[i % pool.length];
      return {
        ...sc,
        file_url: chosenUrl,
        file_name: `Carte_${(i % pool.length) + 1}`
      };
    });

    return NextResponse.json(
      {
        success: true,
        method_used: methodUsed,
        title: title || "Actualité Météo",
        phenomenon: detectedPhenomenon || "Épisode méditerranéen / Cévenol",
        cover_image: coverImage || pool[0],
        content_images: contentImages.length > 0 ? contentImages : pool.slice(1),
        mirrored_count: cleanMirrored.length,
        scenes: finalScenes
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      }
    );

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erreur d'importation de l'article" }, { status: 500 });
  }
}
