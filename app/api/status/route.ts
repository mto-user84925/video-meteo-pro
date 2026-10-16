import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubdevaemtwbzxksjlhjg.supabase.co";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "session_id requis" }, { status: 400 });
    }

    const statusUrl = `${SUPABASE_URL}/storage/v1/object/public/blog-images/renders/${sessionId}/status.json?t=${Date.now()}`;
    const res = await fetch(statusUrl, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json({ status: "processing", step: "Initialisation du rendu..." });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ status: "processing", step: "En cours..." });
  }
}
