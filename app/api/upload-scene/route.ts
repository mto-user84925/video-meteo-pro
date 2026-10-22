import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const BUCKET = "blog-images";

/**
 * Limite volontairement basse : les fonctions Vercel (plan Hobby) rejettent
 * un corps > ~4 Mo avec un HTTP 413 AVANT d'atteindre ce code. Le studio
 * route donc les fichiers de plus de 3 Mo vers /api/upload-sign (envoi direct
 * navigateur -> Supabase). Cette limite n'est qu'un garde-fou de dernier
 * recours pour les appels directs à cette route.
 */
const MAX_BYTES = 4 * 1024 * 1024;

/** Formats autorisés (documentaire : la validation réelle se fait par signature). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

/** Dossiers autorisés : le studio n'écrit que sous `renders/{session}/` et `blog/`. */
const ALLOWED_PREFIX = /^(renders\/[A-Za-z0-9_-]{3,80}\/|blog\/)/;

/**
 * Devine le type d'image à partir de ses premiers octets (signature binaire).
 *
 * Certains exports arrivent avec un content-type inutilisable :
 * « image/jpeg; charset=binary », « application/octet-stream », chaîne vide…
 * Un seul fichier refusé faisait échouer tout l'envoi groupé
 * (« Erreur lors de l'envoi groupé des images »), car le studio envoie les
 * fichiers en Promise.all.
 */
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  // WebP : "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

/** Normalise un content-type déclaré (« image/jpeg; charset=binary » -> « image/jpeg »). */
function normalizeMime(raw: string): string {
  return (raw || "").split(";")[0].trim().toLowerCase();
}

/**
 * Téléversement de cartes depuis le studio.
 *
 * Raison d'être : les policies Storage autorisaient l'écriture anonyme sur
 * `blog-images`, ce qui laissait n'importe qui remplir le bucket. L'écriture
 * est désormais réservée à la clé `service_role`, qui ne doit JAMAIS partir
 * dans le bundle navigateur — d'où ce relais côté serveur.
 */
export async function POST(req: NextRequest) {
  if (!SERVICE_KEY) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY absente côté serveur : téléversement indisponible.",
        hint: "Ajoutez la clé service_role dans les variables d'environnement Vercel (server-side uniquement).",
      },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête multipart/form-data invalide." }, { status: 400 });
  }

  const file = form.get("file");
  const rawPath = String(form.get("path") || "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu (champ 'file')." }, { status: 400 });
  }
  if (!rawPath) {
    return NextResponse.json({ error: "Chemin de destination manquant (champ 'path')." }, { status: 400 });
  }

  // Assainissement : pas de `..`, pas de caractères de contrôle, préfixe autorisé.
  // Une tentative de traversée (`renders/x/../../evil.png`) est REFUSÉE plutôt que
  // silencieusement aplatie : on ne veut pas qu'un chemin malveillant ait l'air
  // d'avoir réussi.
  const rawSegments = rawPath.replace(/\\/g, "/").split("/");
  if (rawSegments.some((seg) => seg === ".." || seg === ".")) {
    return NextResponse.json(
      { error: "Chemin refusé : les segments '.' et '..' sont interdits." },
      { status: 403 }
    );
  }

  const safePath = rawSegments
    .filter((seg) => seg.length > 0)
    .join("/")
    .replace(/[^\w./-]/g, "_");

  if (!ALLOWED_PREFIX.test(safePath)) {
    return NextResponse.json(
      { error: "Chemin refusé : seuls 'renders/<session>/' et 'blog/' sont autorisés." },
      { status: 403 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Fichier vide." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop volumineux pour le relais serveur (${Math.round(file.size / 1024 / 1024)} Mo). Le studio bascule automatiquement sur l'envoi direct.` },
      { status: 413 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Type retenu : on se fie au CONTENU (signature binaire). Si la signature
  // n'est pas reconnue, on ne se rabat JAMAIS sur le content-type déclaré :
  // sinon un fichier texte renommé « .png » avec un type « image/png »
  // passerait la validation. Le content-type ne sert qu'à produire un message
  // d'erreur plus explicite.
  const declared = normalizeMime(file.type);
  const type = sniffImageType(bytes);

  if (!type) {
    return NextResponse.json(
      {
        error: `Le contenu de « ${file.name} » n'est pas une image valide (type déclaré : ${declared || "aucun"}). Formats acceptés : PNG, JPEG, WebP, GIF.`,
      },
      { status: 415 }
    );
  }

  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${safePath}`;

  // POST crée, PUT remplace (upsert) lorsque le nom existe déjà.
  let lastError = "";
  for (const method of ["POST", "PUT"] as const) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": type,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
        body: bytes,
        cache: "no-store",
      });

      if (res.ok) {
        return NextResponse.json({
          success: true,
          path: safePath,
          url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${safePath}`,
          size: file.size,
        });
      }

      lastError = `HTTP ${res.status} ${(await res.text()).slice(0, 300)}`;
      // 401/403 : refus d'authentification, inutile d'insister.
      if (res.status === 401 || res.status === 403) break;
    } catch (err) {
      lastError = (err as Error).message;
    }
  }

  console.error("[upload-scene] échec:", lastError);
  return NextResponse.json({ error: `Téléversement refusé par Supabase : ${lastError}` }, { status: 502 });
}
