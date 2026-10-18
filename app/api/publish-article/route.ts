import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = "https://ubdevaemtwbzxksjlhjg.supabase.co";
const ANON_KEY = "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP";

function sanitizeHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<img([^>]+)>/gi, (match, attrs) => {
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
    [/color:\s*#dcfce7/gi, "color: #14532d"],
    [/color:\s*#4ade80/gi, "color: #166534"],
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
    [/background:\s*rgba\(245,\s*158,\s*11,\s*0\.[0-9]+\)/gi, "background: #fffbeb; border: 1px solid #fde68a"],
    [/background:\s*rgba\(220,\s*38,\s*38,\s*0\.[0-9]+\)/gi, "background: #fef2f2; border: 1px solid #fecaca"],
    [/background:\s*rgba\(56,\s*189,\s*248,\s*0\.[0-9]+\)/gi, "background: #f0f9ff; border: 1px solid #bae6fd"],

    // Borders & dividers
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

    const rawSlug = body.slug ? String(body.slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") : "";
    const slug = rawSlug || slugify(title);
    const cleanExcerpt = (excerpt || title || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
    const darkHtml = sanitizeHtml(content_dark);
    const lightHtml = sanitizeHtml(content_light || adaptToLightTheme(darkHtml));
    const nowIso = new Date().toISOString();

    const headers = {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    };

    // 1. Insertion maîtresse dans meteo_posts (lue par les 3 sites)
    const meteoPostPayload = {
      title,
      slug,
      excerpt: cleanExcerpt,
      content: darkHtml,
      image_url: image_url || null,
      published: true,
      published_at: nowIso,
      category,
      author
    };

    const resMeteo = await fetch(`${SUPABASE_URL}/rest/v1/meteo_posts`, {
      method: "POST",
      headers,
      body: JSON.stringify(meteoPostPayload)
    });

    if (!resMeteo.ok) {
      const errTxt = await resMeteo.text();
      return NextResponse.json({ error: `Erreur Supabase (meteo_posts): ${errTxt}` }, { status: 500 });
    }

    const insertedMeteo = await resMeteo.json();

    // 2. Synchronisation de la version claire dans posts (MétéoBTP Pro & Climat-Météo)
    let postsInserted = false;
    try {
      const resPosts = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...meteoPostPayload,
          content: lightHtml
        })
      });
      postsInserted = resPosts.ok;
      if (!resPosts.ok) {
        console.warn("[publish-article] Note insertion posts:", await resPosts.text());
      }
    } catch (e: any) {
      console.warn("[publish-article] Exception insertion posts:", e?.message);
    }

    return NextResponse.json({
      success: true,
      slug,
      id: insertedMeteo?.[0]?.id,
      synced_tables: {
        meteo_posts: true,
        posts: postsInserted
      },
      urls: {
        meteobtp: `https://meteobtp.fr/actualites/${slug}`,
        monsieurmeteo: `https://monsieurmeteo.com/actualites/${slug}`,
        climatmeteo: `https://climat-meteo.vercel.app/actualites/${slug}`
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
