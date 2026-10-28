import { NextResponse } from "next/server";

export const maxDuration = 60;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

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

// Nettoyage et filtrage chirurgical des URLs d'images de l'article (zéro vignette "À lire aussi", zéro pub, zéro page d'erreur)
function cleanCandidateUrls(rawCandidates: string[], baseUrl: string): string[] {
  const validUrls: string[] = [];
  const seenFileNames = new Map<string, number>(); // filename -> index in validUrls

  const hardBannedKeywords = [
    "logo", "icon", "avatar", "favicon", "pixel", "spinner", "badge",
    "ad-", "ads-", "banner", "sponsor", "author", "share", "facebook",
    "twitter", "instagram", "didomi", "cookie", "tracker", "spacer",
    "/menu/", "bckg_", "newsroom", "google-play", "apple-store", "/flags/",
    "autopromo", "bandeau_", "/vignette/", "brief_semaine", "bulletin_meteo",
    "bulletin_temps", "/error/", "maintenance", "fond_ciel"
  ];

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

    // Écarter toute vignette d'article lié ("À lire aussi" / "En continu" : 218x120, 285x160, 436x240, 570x320)
    // Les vraies photos/cartes d'article font >= 600x300 (ex: 658x370, 1200x630, 1316x740, 2000x1126)
    const dimMatches = [...low.matchAll(/(\d{2,4})x(\d{2,4})/g)];
    if (dimMatches.some(m => Number(m[1]) < 600 || Number(m[2]) < 300)) continue;

    if (hardBannedKeywords.some(b => low.includes(b))) continue;
    if (validUrls.includes(resolved)) continue;

    // Dédoublonnage par nom de fichier (ex: Thumbor sert la même photo en 658x370, 1200x630, 1316x740, 2000x1126)
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

function parseJsonSafe(raw: string): unknown {
  const cleaned = (raw || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }
  return JSON.parse(cleaned);
}

// ponytail: Validation SSRF - rejette protocoles non-http(s), localhost et plages IP privées/cloud
function isSafePublicUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "169.254.169.254" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      host === "[::1]" ||
      host === "::1"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { url, target_duration = 60, scene_count = 5 } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL manquante ou invalide" }, { status: 400 });
    }

    const cleanUrl = url.trim();
    if (!isSafePublicUrl(cleanUrl)) {
      return NextResponse.json({ error: "URL non autorisée (http/https public uniquement, adresses locales interdites)." }, { status: 400 });
    }
    const durationSec = Number(target_duration) || 60;
    const numScenes = Math.max(2, Math.min(10, Number(scene_count) || 5));
    const totalWordsTarget = Math.round(durationSec * 2.9);
    const wordsPerLaterScene = Math.round((totalWordsTarget - 14) / (numScenes - 1));

    let title = "";
    let excerpt = "";
    let coverImage = "";
    let contentImages: string[] = [];
    let articleText = "";
    const rawImageCandidates: string[] = [];
    let methodUsed = "none";

    // ========================================================================
    // ÉTAPE 0 : DÉTECTION RAPIDE RÉSEAU SUPABASE (meteobtp, monsieurmeteo, etc.)
    // ========================================================================
    let isOurNetwork = false;
    try {
      const parsedHost = new URL(cleanUrl).hostname.toLowerCase();
      isOurNetwork = parsedHost === "meteobtp.fr" ||
                     parsedHost.endsWith(".meteobtp.fr") ||
                     parsedHost === "monsieurmeteo.com" ||
                     parsedHost.endsWith(".monsieurmeteo.com") ||
                     parsedHost === "climat-meteo.vercel.app";
    } catch {}

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

            // Isoler strictement le corps de l'article (exclure header, nav, aside, footer, "À lire aussi", "Partager")
            let articleHtml = html
              .replace(/<header\b[\s\S]*?<\/header>/gi, "")
              .replace(/<nav\b[\s\S]*?<\/nav>/gi, "")
              .replace(/<aside\b[\s\S]*?<\/aside>/gi, "")
              .replace(/<footer\b[\s\S]*?<\/footer>/gi, "");

            const cutMarkers = [
              /<div\b[^>]*class=["'][^"']*\b(?:share|readMore|related|outbrain|taboola)\b/i,
              />\s*À lire aussi\s*</i,
              />\s*Sur le même sujet\s*</i,
              />\s*Articles recommandés\s*</i
            ];
            for (const marker of cutMarkers) {
              const cm = articleHtml.match(marker);
              if (cm && cm.index && cm.index > 500) {
                articleHtml = articleHtml.slice(0, cm.index);
              }
            }

            const imgRegex = /<img\b([^>]+)>/gi;
            let imgM;
            while ((imgM = imgRegex.exec(articleHtml)) !== null) {
              const tag = imgM[1];

              // Ignorer toute vignette dont l'attribut width HTML est < 450px ou height < 220px
              const wMatch = tag.match(/\bwidth=["']?(\d+)["']?/i);
              const hMatch = tag.match(/\bheight=["']?(\d+)["']?/i);
              if ((wMatch && Number(wMatch[1]) < 450) || (hMatch && Number(hMatch[1]) < 220)) continue;
              if (/weather-news-item-image|avatar|icon|flag|logo/i.test(tag)) continue;

              // Priorité haute définition : data-lightbox-src > data-srcset/srcset > data-hi-res-src/data-src/src (non data:)
              const lbMatch = tag.match(/data-lightbox-src=["']([^"']+)["']/i);
              if (lbMatch && !lbMatch[1].startsWith("data:")) rawImageCandidates.push(lbMatch[1]);

              const dataSrcsetMatch = tag.match(/data-srcset=["']([^"']+)["']/i) || tag.match(/\bsrcset=["']([^"']+)["']/i);
              if (dataSrcsetMatch && dataSrcsetMatch[1].trim()) {
                const parts = dataSrcsetMatch[1].split(",").map(p => p.trim().split(/\s+/)[0]).filter(Boolean);
                if (parts.length > 0) rawImageCandidates.push(parts[parts.length - 1]);
              }

              for (const attr of ["data-hi-res-src", "data-original", "data-src", "data-lazy-src", "src"]) {
                const m = tag.match(new RegExp(`\\b${attr}=["']([^"']+)["']`, "i"));
                if (m && m[1] && !m[1].startsWith("data:")) {
                  rawImageCandidates.push(m[1]);
                }
              }
            }

            if (!articleText || articleText.length < 150) {
              const textClean = articleHtml
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
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
    // Uniquement si le scraping direct a échoué ou n'a trouvé aucune image
    // ========================================================================
    const needJinaFallback = !directFetchOk ||
                             !title ||
                             articleText.length < 120 ||
                             cleanCandidateUrls(rawImageCandidates, cleanUrl).length === 0;

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
            const jData = jinaJson.data;
            const jTitle = (jData.title || "").toString();

            // Ignorer les pages d'erreur / maintenance / anti-bot renvoyées à Jina
            const isJinaErrorPage = /turbulences|maintenance|just a moment|access denied|attention required/i.test(jTitle);
            if (!isJinaErrorPage) {
              methodUsed = "jina_reader";

              if (!title || title.length < 10) {
                title = jTitle || title;
              }

              // Couper le Markdown Jina avant les blocs "Partager" / "À lire aussi" / "En continu"
              let contentStr = (jData.content || "").toString();
              const mdCutMarkers = [
                /\nPartager\n/i,
                /\nÀ lire aussi/i,
                /\nSur le même sujet/i,
                /\nArticles recommandés/i,
                /\nPlus d'actualités/i
              ];
              for (const mm of mdCutMarkers) {
                const match = contentStr.match(mm);
                if (match && match.index && match.index > 200) {
                  contentStr = contentStr.slice(0, match.index);
                }
              }

              if (!articleText || articleText.length < 150) {
                articleText = contentStr.slice(0, 4500);
              }

              // Récupération dans le markdown de l'article uniquement (avec équilibrage des parenthèses)
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

    const generateAiScript = async (): Promise<{ scenes: Array<Record<string, unknown>>; phenomenon: string }> => {
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
          const obj = (parsed ?? {}) as { scenes?: Array<Record<string, unknown>>; phenomenon?: string };
    return { scenes: obj.scenes || [], phenomenon: obj.phenomenon || "" };
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

    // AUCUNE image d'ancien bulletin injectée : uniquement les vraies images extraites de l'article
    coverImage = cleanMirrored[0] || "";
    contentImages = cleanMirrored.slice(1);

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
      const chosenUrl = cleanMirrored.length > 0 ? cleanMirrored[i % cleanMirrored.length] : "";
      return {
        ...sc,
        file_url: chosenUrl,
        file_name: chosenUrl ? `Carte_${(i % cleanMirrored.length) + 1}` : ""
      };
    });

    return NextResponse.json(
      {
        success: true,
        method_used: methodUsed,
        title: title || "Actualité Météo",
        phenomenon: detectedPhenomenon || "",
        cover_image: coverImage,
        content_images: contentImages,
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

  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur d'importation de l'article" }, { status: 500 });
  }
}
