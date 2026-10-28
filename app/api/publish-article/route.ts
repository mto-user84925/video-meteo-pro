import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";
// La clé d'écriture vit côté serveur uniquement (jamais dans le bundle client).
// Depuis le durcissement des policies RLS (docs/supabase-secure-writes.sql),
// seule la clé service_role peut insérer ou modifier un article.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

interface UpsertResult {
  ok: boolean;
  id?: string;
  updated: boolean;
  error?: string;
}

/**
 * Écrit un article de façon IDEMPOTENTE : on cherche d'abord le slug, puis on
 * met à jour s'il existe, sinon on insère. Aucun doublon possible en cas de
 * double clic ou de re-publication après correction.
 */
async function upsertArticle(
  table: "meteo_posts" | "posts",
  payload: Record<string, unknown>,
  headers: Record<string, string>
): Promise<UpsertResult> {
  const slug = String(payload.slug);
  const authHeaders = { ...headers, apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  try {
    const findRes = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?slug=eq.${encodeURIComponent(slug)}&select=id`,
      { headers: authHeaders, cache: "no-store" }
    );

    if (findRes.ok) {
      const found = (await findRes.json()) as Array<{ id: string }>;
      if (found.length > 0) {
        const putRes = await fetch(
          `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(found[0].id)}`,
          {
            method: "PATCH",
            headers: authHeaders,
            body: JSON.stringify(payload),
            cache: "no-store",
          }
        );
        if (!putRes.ok) {
          return { ok: false, updated: false, error: await putRes.text() };
        }
        return { ok: true, id: found[0].id, updated: true };
      }
    }

    const postRes = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!postRes.ok) {
      return { ok: false, updated: false, error: await postRes.text() };
    }
    const inserted = (await postRes.json().catch(() => [])) as Array<{ id: string }>;
    return { ok: true, id: inserted?.[0]?.id, updated: false };
  } catch (err) {
    return { ok: false, updated: false, error: (err as Error).message };
  }
}

function sanitizeHtml(html: string): string {
  if (!html) return "";
  // ponytail: neutralisation stricte XSS des balises exécutables et gestionnaires inline
  let clean = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[\s\S]*?<\/embed>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');

  return clean.replace(/<img([^>]+)>/gi, (match, attrs) => {
    if (/onerror=/i.test(attrs)) return match;
    return `<img${attrs} onerror="this.style.display='none'">`;
  });
}

function adaptToLightTheme(html: string): string {
  if (!html) return "";
  const replacements: Array<[RegExp, string]> = [
    // Text colors (Dark Glass -> High Contrast Light Theme)
    [/color:\s*#f1f5f9/gi, "color: #1e293b"],
    [/color:\s*#f8fafc/gi, "color: #0f172a"],
    [/color:\s*#ffffff/gi, "color: #0f172a"],
    [/color:\s*#e2e8f0/gi, "color: #1e293b"],
    [/color:\s*#dcfce7/gi, "color: #14532d"],
    [/color:\s*#4ade80/gi, "color: #15803d"],
    [/color:\s*#fef08a/gi, "color: #854d0e"],
    [/color:\s*#fef3c7/gi, "color: #78350f"],
    [/color:\s*#fbbf24/gi, "color: #92400e"],
    [/color:\s*#fca5a5/gi, "color: #b91c1c"],
    [/color:\s*#f87171/gi, "color: #dc2626"],
    [/color:\s*#67e8f9/gi, "color: #002147"],
    [/color:\s*#38bdf8/gi, "color: #0284c7"],
    [/color:\s*#60a5fa/gi, "color: #1e40af"],
    [/color:\s*#dbeafe/gi, "color: #1e3a8a"],
    [/color:\s*#cbd5e1/gi, "color: #334155"],
    [/color:\s*#94a3b8/gi, "color: #64748b"],

    // Backgrounds - Dark containers to clean slate / light boxes (Themes 1 to 5)
    [/background:\s*rgba\(15,\s*23,\s*42,\s*0\.[0-9]+\)/gi, "background: #f8fafc; color: #1e293b"],
    [/background:\s*rgba\(30,\s*41,\s*59,\s*0\.[0-9]+\)/gi, "background: #f1f5f9; color: #1e293b"],
    [/background:\s*rgba\(30,\s*58,\s*138,\s*0\.[0-9]+\)/gi, "background: #eff6ff; border: 1px solid #bfdbfe"],
    [/background:\s*rgba\(59,\s*130,\s*246,\s*0\.[0-9]+\)/gi, "background: #eff6ff; color: #1e40af"],
    [/background:\s*rgba\(14,\s*165,\s*233,\s*0\.[0-9]+\)/gi, "background: #f0f9ff; color: #0369a1"],
    [/background:\s*rgba\(22,\s*101,\s*52,\s*0\.[0-9]+\)/gi, "background: #f0fdf4; border: 1px solid #bbf7d0"],
    [/background:\s*rgba\(34,\s*197,\s*94,\s*0\.[0-9]+\)/gi, "background: #f0fdf4; border: 1px solid #bbf7d0"],
    [/background:\s*rgba\(245,\s*158,\s*11,\s*0\.[0-9]+\)/gi, "background: #fffbeb; border: 1px solid #fde68a"],
    [/background:\s*rgba\(251,\s*191,\s*36,\s*0\.[0-9]+\)/gi, "background: #fffbeb; border: 1px solid #fde68a"],
    [/background:\s*rgba\(220,\s*38,\s*38,\s*0\.[0-9]+\)/gi, "background: #fef2f2; border: 1px solid #fecaca"],
    [/background:\s*rgba\(239,\s*68,\s*68,\s*0\.[0-9]+\)/gi, "background: #fef2f2; border: 1px solid #fecaca"],
    [/background:\s*rgba\(56,\s*189,\s*248,\s*0\.[0-9]+\)/gi, "background: #f0f9ff; border: 1px solid #bae6fd"],

    // Borders & dividers
    [/border-bottom:\s*2px solid #38bdf8/gi, "border-bottom: 2px solid #0284c7"],
    [/border-bottom:\s*2px solid #fbbf24/gi, "border-bottom: 2px solid #d97706"],
    [/border-bottom:\s*2px solid #f87171/gi, "border-bottom: 2px solid #dc2626"],
    [/border-left:\s*5px solid #22c55e/gi, "border-left: 5px solid #16a34a"],
    [/border-left:\s*5px solid #f59e0b/gi, "border-left: 5px solid #d97706"],
    [/border-left:\s*5px solid #ef4444/gi, "border-left: 5px solid #dc2626"],
    [/border-left:\s*5px solid #fbbf24/gi, "border-left: 5px solid #d97706"],
    [/border-left:\s*4px solid #38bdf8/gi, "border-left: 4px solid #0284c7"],
    [/rgba\(56,\s*189,\s*248,\s*0\.[0-9]+\)/gi, "#cbd5e1"],
    [/rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\)/gi, "#e2e8f0"],
  ];
  let out = html;
  for (const [pat, rep] of replacements) {
    out = out.replace(pat, rep);
  }
  return out;
}

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 75)
    .replace(/^-+|-+$/g, "");
  const ts = Math.floor(Date.now() / 1000);
  return `${base || "actualite-meteo"}-${ts}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      excerpt,
      content_dark,
      content_light,
      image_url,
      category = "Actualités Météo",
      author = "Patrick Marlière & Météo-Climat Pro"
    } = body;

    if (!title || !content_dark) {
      return NextResponse.json({ error: "Titre et contenu requis." }, { status: 400 });
    }

    if (!SUPABASE_KEY) {
      return NextResponse.json(
        {
          error:
            "Clé d'écriture Supabase absente côté serveur : la publication est désactivée.",
          hint: "Ajoutez SUPABASE_SERVICE_ROLE_KEY dans les variables d'environnement Vercel.",
        },
        { status: 503 }
      );
    }

    // Slug stable : si le client fournit un slug explicite (édition d'un article
    // existant), on le réutilise tel quel au lieu de le re-horodater -> une
    // re-publication MET À JOUR l'article au lieu de créer un doublon.
    const explicitSlug = body.slug
      ? String(body.slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "")
      : "";
    const slug = explicitSlug || slugify(title);
    const cleanExcerpt = (excerpt || title || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
    const darkHtml = sanitizeHtml(content_dark);
    const lightHtml = sanitizeHtml(content_light || adaptToLightTheme(darkHtml));
    const nowIso = new Date().toISOString();

    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    const meteoPostPayload = {
      title,
      slug,
      excerpt: cleanExcerpt,
      content: darkHtml,
      image_url: image_url || null,
      published: true,
      published_at: nowIso,
      category,
      author,
    };

    // 1. Upsert idempotent dans meteo_posts (clé naturelle : slug).
    //    BUG corrigé : l'ancien code faisait toujours un POST, donc chaque clic
    //    sur « Publier » créait un nouvel article en double.
    const published = await upsertArticle("meteo_posts", meteoPostPayload, headers);
    if (!published.ok) {
      return NextResponse.json(
        { error: `Erreur Supabase (meteo_posts): ${published.error}` },
        { status: 502 }
      );
    }

    // 2. Synchronisation de la version claire dans posts (MétéoBTP Pro & Climat-Météo)
    const postsSync = await upsertArticle(
      "posts",
      { ...meteoPostPayload, content: lightHtml },
      headers
    );
    if (!postsSync.ok) {
      console.warn("[publish-article] Note synchronisation posts:", postsSync.error);
    }

    return NextResponse.json({
      success: true,
      slug,
      id: published.id,
      updated: published.updated,
      synced_tables: {
        meteo_posts: true,
        posts: postsSync.ok
      },
      urls: {
        meteobtp: `https://meteobtp.fr/actualites/${slug}`,
        monsieurmeteo: `https://monsieurmeteo.com/actualites/${slug}`,
        climatmeteo: `https://climat-meteo.vercel.app/actualites/${slug}`
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
