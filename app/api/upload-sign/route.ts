import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "blog-images";

/** Dossiers autorisés : le studio n'écrit que sous `renders/{session}/` et `blog/`. */
const ALLOWED_PREFIX = /^(renders\/[A-Za-z0-9_-]{3,80}\/|blog\/)/;

/** Durée de validité du jeton d'upload (secondes). */
const SIGNED_TTL = 600;

/**
 * Signe un téléversement direct navigateur -> Supabase Storage.
 *
 * POURQUOI CETTE ROUTE EXISTE
 * Les fonctions Vercel (plan Hobby) refusent tout corps de requête supérieur à
 * ~4 Mo : une carte AROME HD ou un GIF de prévision (5 à 15 Mo) était rejeté
 * par un HTTP 413 AVANT même d'atteindre notre code.
 *
 * La solution : le navigateur demande ici une URL signée à usage unique, puis
 * envoie le fichier DIRECTEMENT à Supabase. Le gros du transfert ne traverse
 * donc jamais Vercel, et l'écriture reste réservée à la clé service_role
 * (jamais exposée au navigateur, les policies RLS restent fermées).
 */
export async function POST(req: NextRequest) {
  if (!SERVICE_KEY) {
    return NextResponse.json(
      {
        error: "SUPABASE_SERVICE_ROLE_KEY absente côté serveur : téléversement indisponible.",
        hint: "Ajoutez la clé service_role dans les variables d'environnement Vercel.",
      },
      { status: 503 }
    );
  }

  let body: { path?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const rawPath = String(body.path || "");
  if (!rawPath) {
    return NextResponse.json({ error: "Chemin de destination manquant." }, { status: 400 });
  }

  // Même assainissement que /api/upload-scene.
  const segments = rawPath.replace(/\\/g, "/").split("/");
  if (segments.some((seg) => seg === ".." || seg === ".")) {
    return NextResponse.json(
      { error: "Chemin refusé : les segments '.' et '..' sont interdits." },
      { status: 403 }
    );
  }

  const safePath = segments
    .filter((seg) => seg.length > 0)
    .join("/")
    .replace(/[^\w./-]/g, "_");

  if (!ALLOWED_PREFIX.test(safePath)) {
    return NextResponse.json(
      { error: "Chemin refusé : seuls 'renders/<session>/' et 'blog/' sont autorisés." },
      { status: 403 }
    );
  }

  // ponytail: Contrôle strict de l'extension de fichier autorisée
  if (!/\.(png|jpe?g|webp|gif)$/i.test(safePath)) {
    return NextResponse.json(
      { error: "Extension non autorisée : seules les images (.png, .jpg, .jpeg, .webp, .gif) sont acceptées." },
      { status: 403 }
    );
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${safePath}`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: SIGNED_TTL }),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[upload-sign] Supabase:", res.status, detail.slice(0, 300));
      return NextResponse.json(
        { error: `Signature refusée par Supabase (HTTP ${res.status}).` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { url?: string; signedURL?: string; token?: string };
    // Supabase renvoie soit `url` (relative), soit `signedURL` (ancienne forme).
    const relative = data.url || data.signedURL;
    if (!relative) {
      return NextResponse.json({ error: "Supabase n'a pas renvoyé d'URL signée." }, { status: 502 });
    }

    const uploadUrl = relative.startsWith("http")
      ? relative
      : `${SUPABASE_URL}/storage/v1${relative.startsWith("/") ? "" : "/"}${relative}`;

    return NextResponse.json({
      success: true,
      path: safePath,
      upload_url: uploadUrl,
      // URL publique finale (lisible par les 3 sites)
      public_url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${safePath}`,
      expires_in: SIGNED_TTL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[upload-sign] exception:", message);
    return NextResponse.json({ error: `Signature impossible : ${message}` }, { status: 502 });
  }
}
