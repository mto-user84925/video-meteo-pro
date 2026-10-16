import { NextResponse } from "next/server";

export const maxDuration = 60;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

const DEFAULT_FALLBACK_IMAGES = [
  "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792153060_couverture_deluge_fortes_pluies_16_9.png",
  "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152013_MeteoClimatPro_ECMWF_AIFS_0_25__Europe_geopotentiel-500-hpa_1792130672739.png",
  "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152015_MeteoClimatPro_ECMWF_AIFS_0_25__France_precipitations-cumulees_1792151417749.gif",
  "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152014_MeteoClimatPro_ECMWF_AIFS_0_25__France_pluie-periode_1792130457894.png",
  "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/blog/1792152016_MeteoClimatPro_ECMWF_AIFS_0_25__France_precipitations-cumulees_1792151648872.png"
];

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
      body: buffer
    });
    if (res.ok) {
      return `${SUPABASE_URL}/storage/v1/object/public/blog-images/${remotePath}`;
    }
  } catch (err) {
    console.error("Erreur téléversement Supabase:", err);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { url, target_duration = 60, scene_count = 5 } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
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

    // 1. Détection stricte si l'article est hébergé sur notre propre réseau Supabase
    const isOurNetwork = url.includes("meteobtp.fr") || url.includes("monsieurmeteo.com") || url.includes("climat-meteo.vercel.app");
    
    if (isOurNetwork) {
      const urlParts = url.split("?")[0].replace(/\/+$/, "").split("/");
      const slug = urlParts[urlParts.length - 1];

      const supaUrl = `${SUPABASE_URL}/rest/v1/meteo_posts?select=title,excerpt,content,image_url&slug=eq.${slug}`;
      const supaRes = await fetch(supaUrl, {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`
        }
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
        }
      }
    }

    // 2. Si pas trouvé sur Supabase ou lien externe : Scraping universel haute fidélité
    if (!coverImage || contentImages.length === 0) {
      try {
        const pageRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
          },
          signal: AbortSignal.timeout(10000)
        });
        const html = await pageRes.text();

        // Extraction Titre
        const ogTitleMatch = html.match(/<meta\s+[^>]*(?:property|name)=["'](?:og:title|twitter:title)["'][^>]*content=["']([^"']+)["']/i) ||
                             html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:title|twitter:title)["']/i);
        const titleTagMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
        const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);

        if (ogTitleMatch) title = ogTitleMatch[1];
        else if (h1Match) title = h1Match[1].replace(/<[^>]+>/g, "").trim();
        else if (titleTagMatch) title = titleTagMatch[1].replace(/<[^>]+>/g, "").trim();

        // Récupération de tous les candidats d'images
        const rawCandidates: string[] = [];
        
        // Balises meta (og:image / twitter:image)
        const metaImgMatches = [
          ...html.matchAll(/<meta\s+[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/gi),
          ...html.matchAll(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/gi)
        ];
        for (const m of metaImgMatches) {
          if (m[1]) rawCandidates.push(m[1]);
        }

        // Balises <img> (src, data-src, data-original, srcset, etc.)
        const imgRegex = /<img\b([^>]+)>/gi;
        let imgM;
        while ((imgM = imgRegex.exec(html)) !== null) {
          const tag = imgM[1];
          const attrMatch = tag.match(/(?:src|data-src|data-original|data-lazy-src)=["']([^"']+)["']/i);
          if (attrMatch) rawCandidates.push(attrMatch[1]);

          const srcsetMatch = tag.match(/srcset=["']([^"']+)["']/i);
          if (srcsetMatch) {
            const parts = srcsetMatch[1].split(",").map(p => p.trim().split(/\s+/)[0]);
            if (parts.length > 0) rawCandidates.push(parts[parts.length - 1]);
          }
        }

        // Nettoyage et normalisation des URLs d'images
        const validUrls: string[] = [];
        for (let raw of rawCandidates) {
          if (!raw || raw.startsWith("data:")) continue;
          if (raw.includes("url=")) {
            const uMatch = raw.match(/url=([^&]+)/);
            if (uMatch) raw = decodeURIComponent(uMatch[1]);
          }
          raw = raw.replace(/&amp;/g, "&");
          let resolved = raw;
          try {
            if (raw.startsWith("//")) resolved = "https:" + raw;
            else if (raw.startsWith("/") || !raw.startsWith("http")) resolved = new URL(raw, url).href;
          } catch { continue; }

          const low = resolved.toLowerCase();
          if (low.includes("logo") || low.includes("icon") || low.includes("avatar") || low.includes("favicon") || low.endsWith(".svg")) continue;
          if (!validUrls.includes(resolved)) validUrls.push(resolved);
        }

        // Téléversement miroir EN PARALLÈLE des meilleures images vers Supabase Storage
        const toMirror = validUrls.slice(0, 6);
        const mirrorResults = await Promise.all(
          toMirror.map(async (candidate) => {
            if (candidate.includes("supabase.co/storage")) return candidate;
            try {
              const imgRes = await fetch(candidate, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                  "Referer": url
                },
                signal: AbortSignal.timeout(6000)
              });
              if (imgRes.ok) {
                const buf = await imgRes.arrayBuffer();
                if (buf.byteLength >= 4000) {
                  const cType = imgRes.headers.get("content-type") || "image/jpeg";
                  const ext = cType.includes("png") ? "png" : cType.includes("gif") ? "gif" : "jpg";
                  const supaUrl = await uploadToSupabase(buf, cType, ext);
                  if (supaUrl) return supaUrl;
                }
              }
            } catch (e) {
              console.error("Échec miroir image:", candidate);
            }
            return candidate;
          })
        );

        const cleanMirrored = mirrorResults.filter(Boolean) as string[];
        if (cleanMirrored.length > 0) {
          coverImage = cleanMirrored[0];
          contentImages = cleanMirrored.slice(1);
        } else if (validUrls.length > 0) {
          coverImage = validUrls[0];
          contentImages = validUrls.slice(1);
        }

        // Extraction du texte de l'article
        const textClean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
                              .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
                              .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
                              .replace(/<[^>]+>/g, " ")
                              .replace(/\s+/g, " ");
        articleText = textClean.slice(0, 4500);
      } catch (err) {
        console.error("Erreur scraping web:", err);
      }
    }

    if (!coverImage && contentImages.length > 0) {
      coverImage = contentImages.shift() || "";
    }

    if (!articleText && title) {
      articleText = title;
    }

    // 3. Appel OpenRouter Gemini Flash calibré sur la durée cible
    let generatedScenes: any[] = [];
    let detectedPhenomenon = "";
    if (OPENROUTER_API_KEY && articleText) {
      const systemPrompt = `Tu es le rédacteur météo en chef pour Météo-Climat Pro et Monsieur Météo (Patrick Marlière).
À partir de l'article météo fourni, génère un script vidéo structuré en EXACTEMENT ${numScenes} SCÈNES calibrées pour une durée globale de ${durationSec} SECONDES (soit un total d'environ ${totalWordsTarget} mots), et identifie le phénomène météo principal.

RÈGLES IMPÉRATIVES DE CALIBRAGE :
1. Scène 1 (Accroche percutante) : STRICTEMENT <= 4 secondes de lecture (12 à 15 mots max). Ton d'alerte immédiat.
2. Scènes 2 à ${numScenes - 1} : Chaque scène doit comporter environ ${wordsPerLaterScene} mots avec des détails techniques et pédagogiques fluides :
   - Analyse synoptique d'altitude (gouttes froides, anticyclones, anomalies, flux).
   - Chronologie exacte du front ou de l'épisode météo.
   - Chiffres de modélisation (lames d'eau horaires, cumuls totaux en mm, rafales en km/h).
   - Départements et bassins versants exposés.
3. Scène ${numScenes} (Paroxysme & Signature) : Environ ${wordsPerLaterScene} mots résumant le pic du phénomène, les consignes de vigilance et la signature obligatoire finale : "...et restez connectés avec METEO CLIMAT PRO."
4. Vocabulaire : Ne dis jamais "celsius" mais "degrés". Pas de mention "Météo-France", utilise toujours "Météo-Climat Pro" ou "nos modélisations haute résolution".

Format JSON STRICT :
{
  "phenomenon": "Nom synthétique du phénomène (ex: Épisode méditerranéen / Cévenol, Tempête, Canicule, Orages violents, Sécheresse, etc.)",
  "scenes": [
    {
      "scene_number": 1,
      "badge": "ALERTE MÉTÉO",
      "badge_color": [220, 30, 30],
      "title": "TITRE SCÈNE",
      "sub": "SOUS-TITRE COURT",
      "location_tag": "SUD-EST",
      "ticker": "Bandeau défilant court",
      "script_text": "Accroche percutante"
    },
    ... (${numScenes} scènes au total)
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
          signal: AbortSignal.timeout(15000)
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
          generatedScenes = parsed.scenes || [];
          detectedPhenomenon = parsed.phenomenon || "";
        }
      } catch (aiErr) {
        console.error("Erreur IA Gemini Flash:", aiErr);
      }
    }

    // Répartition et recyclage circulaire des images
    const availableImages = [coverImage, ...contentImages].filter(Boolean);
    const pool = availableImages.length > 0 ? availableImages : DEFAULT_FALLBACK_IMAGES;

    // Si l'IA n'a pas pu générer les scènes, on construit les scènes par défaut
    const baseScenes = (generatedScenes && generatedScenes.length >= 2)
      ? generatedScenes
      : Array.from({ length: numScenes }, (_, idx) => ({
          scene_number: idx + 1,
          badge: idx === 0 ? "ALERTE MÉTÉO" : "ANALYSE MÉTÉO",
          badge_color: idx === 0 ? [220, 30, 30] : [30, 120, 240],
          title: title || `SCÈNE ${idx + 1}`,
          sub: "Prévisions et suivi météorologique • Météo-Climat Pro",
          location_tag: "FRANCE",
          ticker: "Suivi en direct • Modélisations haute résolution • Météo-Climat Pro",
          script_text: idx === 0
            ? (title ? `Attention, ${title}.` : "Attention aux intempéries prévues dans les prochaines heures.")
            : "Suivez attentivement l'évolution des conditions météorologiques et restez connectés avec METEO CLIMAT PRO."
        }));

    const finalScenes = baseScenes.map((sc, i) => {
      const chosenUrl = pool[i % pool.length];
      return {
        ...sc,
        file_url: chosenUrl,
        file_name: `Carte_${(i % pool.length) + 1}`
      };
    });

    return NextResponse.json({
      success: true,
      title: title || "Actualité Météo",
      phenomenon: detectedPhenomenon || "Épisode méditerranéen / Cévenol",
      cover_image: coverImage || pool[0],
      content_images: contentImages.length > 0 ? contentImages : pool.slice(1),
      scenes: finalScenes
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erreur d'importation de l'article" }, { status: 500 });
  }
}
