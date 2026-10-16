import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "session_id requis" }, { status: 400 });
    }

    // 1. Vérification de status.json
    try {
      const statusUrl = `${SUPABASE_URL}/storage/v1/object/public/blog-images/renders/${sessionId}/status.json?t=${Date.now()}`;
      const res = await fetch(statusUrl, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "completed") {
          return NextResponse.json(data);
        }
      }
    } catch (_) {}

    // 2. Vérification de status_done.json
    try {
      const doneUrl = `${SUPABASE_URL}/storage/v1/object/public/blog-images/renders/${sessionId}/status_done.json?t=${Date.now()}`;
      const resDone = await fetch(doneUrl, { cache: "no-store" });
      if (resDone.ok) {
        const dataDone = await resDone.json();
        return NextResponse.json(dataDone);
      }
    } catch (_) {}

    // 3. Fallback direct : Vérification de la présence des fichiers MP4 sur Supabase
    try {
      const tkUrl = `${SUPABASE_URL}/storage/v1/object/public/blog-images/renders/${sessionId}/bulletin_tiktok.mp4`;
      const lsUrl = `${SUPABASE_URL}/storage/v1/object/public/blog-images/renders/${sessionId}/bulletin_paysage.mp4`;
      
      const [tkRes, lsRes] = await Promise.all([
        fetch(tkUrl, { method: "HEAD", cache: "no-store" }),
        fetch(lsUrl, { method: "HEAD", cache: "no-store" })
      ]);

      if (tkRes.ok && lsRes.ok) {
        return NextResponse.json({
          status: "completed",
          session_id: sessionId,
          tiktok_url: tkUrl,
          landscape_url: lsUrl
        });
      }
    } catch (_) {}

    return NextResponse.json({ status: "processing", step: "Régie vidéo en cours d'encodage..." });
  } catch (error: any) {
    return NextResponse.json({ status: "processing", step: "En cours d'encodage..." });
  }
}
