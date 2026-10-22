import { NextResponse } from "next/server";

export const maxDuration = 60;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP";
const GITHUB_PAT = process.env.GITHUB_PAT || process.env.GH_TOKEN || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "mto-user84925/video-meteo-pro";
const WORKFLOW_FILE = process.env.RENDER_WORKFLOW_FILE || "render.yml";
const WORKFLOW_REF = process.env.RENDER_WORKFLOW_REF || "main";

/**
 * Écrit un objet dans le bucket public. Renvoie `true` seulement si l'écriture
 * a réellement été acceptée : auparavant le code ne vérifiait rien et renvoyait
 * `success: true` même quand Supabase refusait (401/403 RLS), produisant un
 * workflow GitHub qui téléchargeait un `job.json` inexistant.
 */
async function uploadToSupabase(remotePath: string, content: string, contentType = "application/json"): Promise<boolean> {
  const url = `${SUPABASE_URL}/storage/v1/object/blog-images/${remotePath}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": contentType,
  };

  for (const method of ["POST", "PUT"] as const) {
    try {
      const res = await fetch(url, { method, headers, body: content, cache: "no-store" });
      if (res.ok) return true;
      const detail = await res.text();
      // 400/409 => l'objet existe déjà, on tente le PUT (upsert).
      if (method === "POST" && (res.status === 400 || res.status === 409)) continue;
      console.error(`[dispatch] Supabase ${method} ${remotePath} -> HTTP ${res.status} ${detail.slice(0, 300)}`);
      if (res.status === 401 || res.status === 403) return false;
    } catch (err) {
      console.error(`[dispatch] Supabase ${method} ${remotePath} exception:`, err);
    }
  }
  return false;
}

interface ScenePayload {
  script_text?: string;
  file?: string;
}

interface JobPayload {
  session_id?: string;
  target_duration?: number;
  scenes?: ScenePayload[];
}

/** Validation minimale : un job incohérent ne doit pas consommer un runner. */
function validateJob(job: JobPayload): string | null {
  if (!Array.isArray(job.scenes) || job.scenes.length < 1) {
    return "Le job ne contient aucune scène.";
  }
  if (job.scenes.length > 12) {
    return "Le job dépasse 12 scènes (maximum supporté par la régie).";
  }
  const withoutFile = job.scenes.findIndex((s) => !s?.file);
  if (withoutFile !== -1) {
    return `La scène ${withoutFile + 1} n'a pas de visuel.`;
  }
  const totalWords = job.scenes.reduce(
    (acc, s) => acc + (s.script_text || "").trim().split(/\s+/).filter(Boolean).length,
    0
  );
  if (totalWords < 10) {
    return "Le script de voix off est vide ou trop court (moins de 10 mots).";
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { session_id, job } = (await req.json()) as { session_id?: string; job?: JobPayload };
    if (!session_id || !job) {
      return NextResponse.json({ error: "session_id ou job manquant" }, { status: 400 });
    }
    if (!/^[A-Za-z0-9_-]{3,80}$/.test(session_id)) {
      return NextResponse.json({ error: "session_id invalide (3 à 80 caractères alphanumériques)." }, { status: 400 });
    }

    const jobError = validateJob(job);
    if (jobError) {
      return NextResponse.json({ error: jobError }, { status: 422 });
    }

    // 1. Enregistrement du job.json dans Supabase Storage
    const jobJson = JSON.stringify({ ...job, session_id }, null, 2);
    const jobWritten = await uploadToSupabase(`renders/${session_id}/job.json`, jobJson, "application/json");
    if (!jobWritten) {
      return NextResponse.json(
        {
          error:
            "Impossible d'enregistrer le job sur Supabase Storage (clé serveur absente ou policy RLS d'écriture manquante).",
          hint: "Vérifiez SUPABASE_KEY côté serveur : une clé `sb_publishable_` ne peut pas écrire sous RLS."
        },
        { status: 502 }
      );
    }

    // 2. Marqueur de lancement : permet à /api/status de distinguer
    //    « en attente de runner » de « aucun job n'a jamais été envoyé ».
    await uploadToSupabase(
      `renders/${session_id}/dispatched.json`,
      JSON.stringify({ session_id, dispatched_at: Math.floor(Date.now() / 1000) }),
      "application/json"
    );

    // 3. Déclenchement de GitHub Actions workflow_dispatch
    let githubTriggered = false;
    let githubError: string | null = null;

    if (!GITHUB_PAT) {
      githubError = "GITHUB_PAT non configuré côté serveur : le rendu cloud ne peut pas être déclenché.";
      console.error(`[dispatch] ${githubError}`);
    } else {
      try {
        const ghRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GITHUB_PAT}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              "User-Agent": "video-meteo-pro-app",
            },
            body: JSON.stringify({
              ref: WORKFLOW_REF,
              inputs: { session_id: String(session_id) },
            }),
            cache: "no-store",
          }
        );

        // workflow_dispatch renvoie 204 No Content en cas de succès.
        githubTriggered = ghRes.status === 204 || ghRes.ok;
        if (!githubTriggered) {
          githubError = `GitHub Actions HTTP ${ghRes.status} : ${(await ghRes.text()).slice(0, 300)}`;
          console.error("[dispatch] GitHub Actions dispatch error:", githubError);
        }
      } catch (err) {
        githubError = `GitHub Actions injoignable : ${(err as Error).message}`;
        console.error("[dispatch]", githubError);
      }
    }

    if (!githubTriggered) {
      // Le job est bien écrit : la régie peut être relancée manuellement, mais on
      // remonte un 502 explicite plutôt qu'un faux succès.
      return NextResponse.json(
        {
          error: "Le rendu n'a pas pu être déclenché sur GitHub Actions.",
          detail: githubError,
          session_id,
          job_saved: true,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      session_id,
      github_triggered: githubTriggered,
      status_url: `${SUPABASE_URL}/storage/v1/object/public/blog-images/renders/${session_id}/status.json`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur dispatch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
