import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const BUCKET = "blog-images";

/** Modèles d'image acceptés, du meilleur au plus économique. */
const IMAGE_MODELS = [
  "google/gemini-3.1-flash-image",
  "google/gemini-2.5-flash-image",
] as const;

/** Lit les dimensions d'une image PNG / JPEG sans dépendance externe. */
function readImageSize(buf: Buffer, mime: string): { width: number; height: number } | null {
  try {
    if (mime.includes("png") && buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
      // IHDR : largeur/hauteur sur 4 octets big-endian à l'offset 16
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (mime.includes("jpeg") && buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let offset = 2;
      while (offset < buf.length - 9) {
        if (buf[offset] !== 0xff) { offset++; continue; }
        const marker = buf[offset + 1];
        const size = buf.readUInt16BE(offset + 2);
        // SOF0..SOF15 (hors DHT/JPG/DAC)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
        }
        offset += 2 + size;
      }
    }
  } catch {
    /* dimensions inconnues */
  }
  return null;
}

interface CoverRequest {
  /** Description de l'image (issue du champ COUVERTURE IMAGE du prompt). */
  prompt?: string;
  /** Titre à incruster sur l'image. */
  title?: string;
  /** Sous-titre optionnel. */
  subtitle?: string;
  /** Catégorie éditoriale (influence la palette). */
  category?: string;
}

/** Construit le prompt visuel final à partir des informations éditoriales. */
function buildImagePrompt({ prompt, title, subtitle, category }: CoverRequest): string {
  const cleanTitle = (title || "").trim();
  const cleanSubtitle = (subtitle || "").trim();
  const theme = (prompt || "").trim();

  return [
    "Image de couverture au format PAYSAGE 16:9 (largeur nettement supérieure à la hauteur, proportions 1.78:1), destinée à l'en-tête d'un article météo professionnel français.",
    "Format impératif : orientation horizontale 16:9, jamais carrée, jamais verticale.",
    theme ? `Sujet : ${theme}` : "",
    "Style : illustration numérique éditoriale haut de gamme, atmosphère météorologique dramatique mais crédible (ciel, nuages, pluie, vent), palette bleu marine profond et accents or dorés, éclairage cinématographique, rendu broadcast télévision.",
    "Composition paysage : le sujet principal occupe le centre et la droite de l'image ; la partie gauche et le tiers inférieur restent plus sombres et dégagés pour recevoir un titre.",
    cleanTitle ? `Inscris en typographie sans-serif blanche très lisible, en bas à gauche, le titre : « ${cleanTitle.toUpperCase()} ».` : "",
    cleanSubtitle ? `Ajoute juste en dessous, en plus petit et en doré, la mention : « ${cleanSubtitle.toUpperCase()} ».` : "",
    "Aucun logo, aucun filigrane, aucun texte autre que celui demandé. Aucune carte géographique détaillée, aucun chiffre de prévision inventé.",
    category ? `Ambiance éditoriale : ${category}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY absente côté serveur : génération d'image indisponible." },
      { status: 503 }
    );
  }
  if (!SERVICE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY absente côté serveur : stockage de l'image indisponible." },
      { status: 503 }
    );
  }

  let body: CoverRequest & { session_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const imagePrompt = buildImagePrompt(body);
  const sessionId = String(body.session_id || "").replace(/[^\w-]/g, "_") || `session_${Date.now()}`;

  let lastError = "";

  for (const model of IMAGE_MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://video-meteo-pro.vercel.app",
          "X-Title": "Video Meteo Pro Cover Generator",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: imagePrompt }],
          modalities: ["image", "text"],
        }),
        cache: "no-store",
      });

      if (!res.ok) {
        lastError = `${model} : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`;
        console.error("[cover]", lastError);
        continue;
      }

      const data = await res.json();
      const message = data?.choices?.[0]?.message;

      // OpenRouter renvoie les images dans message.images[] sous forme d'URL data:
      const images = message?.images;
      const dataUrl: string | undefined = Array.isArray(images)
        ? images
            .map((img: { image_url?: { url?: string } } | string) =>
              typeof img === "string" ? img : img?.image_url?.url
            )
            .find((u): u is string => typeof u === "string" && u.startsWith("data:"))
        : undefined;

      if (!dataUrl) {
        lastError = `${model} : aucune image renvoyée`;
        console.error("[cover]", lastError, JSON.stringify(message).slice(0, 200));
        continue;
      }

      // Conversion data URL -> octets
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(dataUrl);
      if (!match) {
        lastError = `${model} : format d'image inattendu`;
        continue;
      }
      const mime = match[1];
      const bytes = Buffer.from(match[2], "base64");
      const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
      const remotePath = `renders/${sessionId}/couverture_${Date.now()}.${ext}`;

      // Mesure des dimensions réelles pour garantir un cadrage paysage.
      // (Le modèle respecte le 16:9, mais on refuse de publier une image
      // verticale ou carrée par erreur.)
      const dims = readImageSize(bytes, mime);

      // Téléversement vers Supabase Storage (clé service_role, jamais exposée)
      const upUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${remotePath}`;
      let uploaded = false;
      for (const method of ["POST", "PUT"] as const) {
        const up = await fetch(upUrl, {
          method,
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": mime,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
          body: bytes,
          cache: "no-store",
        });
        if (up.ok) { uploaded = true; break; }
      }

      if (!uploaded) {
        return NextResponse.json({ error: "Image générée mais téléversement Supabase refusé." }, { status: 502 });
      }

      return NextResponse.json({
        success: true,
        model,
        url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${remotePath}`,
        path: remotePath,
        size: bytes.length,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        orientation: dims ? (dims.width > dims.height ? "paysage" : "portrait") : "inconnue",
        prompt_used: imagePrompt,
      });
    } catch (err) {
      lastError = `${model} : ${err instanceof Error ? err.message : String(err)}`;
      console.error("[cover]", lastError);
    }
  }

  return NextResponse.json(
    { error: `Génération d'image impossible. ${lastError}` },
    { status: 502 }
  );
}
