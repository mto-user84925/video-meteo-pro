import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP";

const NO_STORE = { cache: "no-store" as const };

interface ProgressPayload {
  pct: number;
  text: string;
  type?: string;
  ts: number;
}

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/blog-images/${path}`;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${publicUrl(path)}?t=${Date.now()}`, NO_STORE);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id requis" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(sessionId)) {
    return NextResponse.json({ error: "session_id invalide" }, { status: 400 });
  }

  try {
    // 1. État terminal écrit par le moteur : completed / failed
    const status = await fetchJson<{ status?: string; message?: string }>(`renders/${sessionId}/status.json`);
    if (status?.status === "completed") {
      return NextResponse.json({ ...status, progress: { pct: 100, text: "Rendu terminé", ts: Math.floor(Date.now() / 1000) } });
    }
    if (status?.status === "failed") {
      return NextResponse.json({ ...status, step: status.message || "Le rendu a échoué." });
    }

    // 2. Ancien marqueur de fin (compatibilité jobs déjà rendus)
    const done = await fetchJson<{ status?: string }>(`renders/${sessionId}/status_done.json`);
    if (done) return NextResponse.json(done);

    // 3. Fallback direct : les deux MP4 existent déjà
    const [tkRes, lsRes] = await Promise.all([
      fetch(publicUrl(`renders/${sessionId}/bulletin_tiktok.mp4`), { method: "HEAD", ...NO_STORE }),
      fetch(publicUrl(`renders/${sessionId}/bulletin_paysage.mp4`), { method: "HEAD", ...NO_STORE }),
    ]);
    if (tkRes.ok && lsRes.ok) {
      return NextResponse.json({
        status: "completed",
        session_id: sessionId,
        tiktok_url: publicUrl(`renders/${sessionId}/bulletin_tiktok.mp4`),
        landscape_url: publicUrl(`renders/${sessionId}/bulletin_paysage.mp4`),
        progress: { pct: 100, text: "Rendu terminé", ts: Math.floor(Date.now() / 1000) },
      });
    }

    // 4. Journal de progression
    let progress = await fetchJson<ProgressPayload>(`renders/${sessionId}/progress.json`);

    if (!progress) {
      // Fichiers incrémentaux p_{pct}_{ts}.json.
      // BUG corrigé : le tri portait sur le nom complet, donc la comparaison
      // lexicographique opposait « p_100_… » à « p_072_… » de façon hasardeuse.
      // On trie désormais sur le pourcentage puis l'horodatage numérique.
      try {
        const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/blog-images`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prefix: `renders/${sessionId}`, limit: 100 }),
          ...NO_STORE,
        });
        if (listRes.ok) {
          const files = (await listRes.json()) as Array<{ name: string }>;
          const parsed = files
            .map((f) => {
              const m = /^p_(\d{1,3})_(\d+)\.json$/.exec(f.name);
              return m ? { name: f.name, pct: Number(m[1]), ts: Number(m[2]) } : null;
            })
            .filter((v): v is { name: string; pct: number; ts: number } => v !== null)
            .sort((a, b) => b.pct - a.pct || b.ts - a.ts);

          if (parsed.length > 0) {
            progress = await fetchJson<ProgressPayload>(`renders/${sessionId}/${parsed[0].name}`);
          }
        }
      } catch {
        /* best-effort */
      }
    }

    // 5. Distinguer « en cours » de « jamais lancé »
    const dispatched = await fetchJson<{ dispatched_at: number }>(`renders/${sessionId}/dispatched.json`);
    if (!dispatched && !progress) {
      return NextResponse.json({
        status: "unknown",
        step: "Aucun job trouvé pour cette session.",
      });
    }

    return NextResponse.json({
      status: "processing",
      step: progress?.text || "Régie vidéo en cours d'encodage...",
      progress,
    });
  } catch (error) {
    console.error("[status] exception:", error);
    return NextResponse.json({ status: "processing", step: "En cours d'encodage..." });
  }
}
