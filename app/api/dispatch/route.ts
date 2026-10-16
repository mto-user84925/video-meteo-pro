import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP";
const GITHUB_PAT = process.env.GITHUB_PAT || process.env.GH_TOKEN || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "monsieurmeteo/video-meteo-pro";

async function uploadToSupabase(remotePath: string, content: string, contentType = "application/json") {
  const url = `${SUPABASE_URL}/storage/v1/object/blog-images/${remotePath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": contentType
    },
    body: content
  });
  if (!res.ok) {
    // Tentative en PUT si le fichier existe
    await fetch(url, {
      method: "PUT",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": contentType
      },
      body: content
    });
  }
}

export async function POST(req: Request) {
  try {
    const { session_id, job } = await req.json();
    if (!session_id || !job) {
      return NextResponse.json({ error: "session_id ou job manquant" }, { status: 400 });
    }

    // 1. Enregistrement du job.json dans Supabase Storage
    const jobJson = JSON.stringify(job, null, 2);
    await uploadToSupabase(`renders/${session_id}/job.json`, jobJson, "application/json");

    // 2. Initialisation du status.json
    const statusPayload = JSON.stringify({
      status: "processing",
      session_id,
      step: "Lancement de la régie vidéo...",
      progress: 10,
      created_at: Math.floor(Date.now() / 1000)
    }, null, 2);
    await uploadToSupabase(`renders/${session_id}/status.json`, statusPayload, "application/json");

    // 3. Déclenchement de GitHub Actions workflow_dispatch
    if (GITHUB_PAT) {
      const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/render.yml/dispatches`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GITHUB_PAT}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "video-meteo-pro-app"
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            session_id: String(session_id)
          }
        })
      });

      if (!ghRes.ok) {
        const ghErr = await ghRes.text();
        console.error("GitHub Actions dispatch error:", ghErr);
      }
    }

    return NextResponse.json({
      success: true,
      session_id,
      status_url: `${SUPABASE_URL}/storage/v1/object/public/blog-images/renders/${session_id}/status.json`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erreur dispatch" }, { status: 500 });
  }
}
