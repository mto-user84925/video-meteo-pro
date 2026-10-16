import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
    }

    let title = "";
    let excerpt = "";
    let coverImage = "";
    let contentImages: string[] = [];
    let articleText = "";

    // 1. Détection si c'est un article MétéoBTP / Monsieur Météo / Climat-Météo
    const isOurNetwork = url.includes("meteobtp.fr") || url.includes("monsieurmeteo.com") || url.includes("climat-meteo.vercel.app") || url.includes("actualites/");
    
    if (isOurNetwork) {
      // Extraire le slug depuis l'URL
      const urlParts = url.split("?")[0].replace(/\/+$/, "").split("/");
      const slug = urlParts[urlParts.length - 1];

      // Requête Supabase meteo_posts
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

          // Extraire les URLs d'images depuis le HTML
          const regex = /src=["'](https:\/\/[^"']+)["']/g;
          let match;
          while ((match = regex.exec(post.content || "")) !== null) {
            contentImages.push(match[1]);
          }
        }
      }
    }

    // 2. Si pas trouvé sur Supabase ou lien externe : Scraping web standard
    if (!coverImage || contentImages.length === 0) {
      try {
        const pageRes = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
        });
        const html = await pageRes.text();

        // Extraire og:title et og:image
        const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
        const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);

        if (!title && ogTitleMatch) title = ogTitleMatch[1];
        if (!coverImage && ogImageMatch) coverImage = ogImageMatch[1];

        // Extraire les images
        const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
          const imgUrl = match[1];
          if (!imgUrl.includes("logo") && !imgUrl.includes("icon") && !imgUrl.includes("avatar") && !contentImages.includes(imgUrl)) {
            contentImages.push(imgUrl);
          }
        }

        // Extraire texte brut
        const textClean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
                              .replace(/<[^>]+>/g, " ")
                              .replace(/\s+/g, " ");
        articleText = textClean.slice(0, 3000);
      } catch (err) {
        console.error("Scraping error:", err);
      }
    }

    if (!coverImage && contentImages.length > 0) {
      coverImage = contentImages.shift() || "";
    }

    // 3. Appel OpenRouter Gemini Flash pour générer les 5 scènes avec le contenu exact extrait
    let generatedScenes: any[] = [];
    let detectedPhenomenon = "";
    if (OPENROUTER_API_KEY && articleText) {
      const systemPrompt = `Tu es le rédacteur météo en chef pour Météo-Climat Pro et Monsieur Météo (Patrick Marlière).
À partir de l'article météo fourni, génère un script vidéo structuré en EXACTEMENT 5 SCÈNES calibrées pour une durée globale de 50 à 60 secondes, et identifie le phénomène météo principal.

RÈGLES IMPÉRATIVES :
1. Scène 1 (Accroche) : STRICTEMENT <= 4 secondes de lecture (12 à 15 mots max). Ton d'alerte immédiat.
2. Scène 2 (Synoptique) : Explication météo physique en altitude (goutte froide, anticyclone, dépression).
3. Scène 3 (Chronologie / Radar) : Début et évolution du front dans le temps.
4. Scène 4 (Intensité) : Intensité horaire, rafales ou lames d'eau.
5. Scène 5 (Paroxysme & Signature) : Chiffres clés locaux (ex: 160 mm), départements touchés, appel à la vigilance et signature obligatoire: "...et restez connectés avec METEO CLIMAT PRO."
6. Ne dis jamais "celsius" mais "degrés". Pas de mention "Météo-France", toujours "Météo-Climat Pro".

Format JSON STRICT :
{
  "phenomenon": "Nom synthétique du phénomène (ex: Épisode méditerranéen / Cévenol, Tempête, Canicule, Orages violents, Sécheresse, Feux de forêt, Cyclone, etc.)",
  "scenes": [
    {
      "scene_number": 1,
      "badge": "ALERTE MÉTÉO",
      "badge_color": [220, 30, 30],
      "title": "TITRE SCÈNE",
      "sub": "SOUS-TITRE COURT",
      "location_tag": "SUD-EST",
      "ticker": "Bandeau défilant court",
      "script_text": "Texte court"
    },
    ... (5 scènes)
  ]
}`;

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
            { role: "user", content: `Titre : ${title}\n\nContenu de l'article :\n${articleText}` }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        })
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
        generatedScenes = parsed.scenes || [];
        detectedPhenomenon = parsed.phenomenon || "";
      }
    }

    // Répartir les images trouvées sur les 5 scènes
    const allImages = [coverImage, ...contentImages];
    const finalScenes = generatedScenes.map((sc, i) => ({
      ...sc,
      file_url: allImages[i] || allImages[allImages.length - 1] || "",
      file_name: allImages[i] ? `Carte_${i + 1}` : ""
    }));

    return NextResponse.json({
      success: true,
      title,
      phenomenon: detectedPhenomenon,
      cover_image: coverImage,
      content_images: contentImages,
      scenes: finalScenes.length === 5 ? finalScenes : null
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erreur d'importation de l'article" }, { status: 500 });
  }
}
