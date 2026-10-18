import { NextRequest, NextResponse } from "next/server";
import { MASTER_PROMPT_ARTICLE_AND_VIDEO } from "@/app/lib/articleFormatter";

// Autoriser jusqu'à 60 secondes pour la génération complète de l'article et des scènes
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { text, phenomenon, topic } = await req.json();

    const apiKey = process.env.OPENROUTER_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "Clé OPENROUTER_API_KEY manquante sur le serveur." }, { status: 500 });
    }

    const promptUser = `${MASTER_PROMPT_ARTICLE_AND_VIDEO}

==================================================
DONNÉES TRANSMISES PAR L'UTILISATEUR :
==================================================
PHÉNOMÈNE : ${phenomenon || "Épisode météorologique"}
TITRE / SUJET : ${topic || "Actualité météo"}
TEXTE / INFORMATIONS BRUTES DE L'ACTUALITÉ :
${text || topic || phenomenon || "Épisode pluvieux et venteux avec nette dégradation par l'ouest."}

RÉDIGE MAINTENANT L'ARTICLE WEB COMPLET (ENTRE === DEBUT ARTICLE === ET === FIN ARTICLE ===) ET LES SCÈNES 1 À 5.
`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://video-meteo-pro.vercel.app",
        "X-Title": "Video Meteo Pro DeepSeek Article Generator"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-v4.1-flash-1017",
        messages: [
          {
            role: "system",
            content: "Tu es un journaliste météo-climat senior pour METEO CLIMAT PRO. Rédige de façon directe, synthétique et percutante (format article web professionnel de 400 à 600 mots) sans digression ni réflexion interminable, suivi immédiatement du script vidéo en 5 scènes (SCÈNE 1 à SCÈNE 5)."
          },
          {
            role: "user",
            content: promptUser
          }
        ],
        temperature: 0.3,
        max_tokens: 4500
      })
    });

    if (!res.ok) {
      const errTxt = await res.text();
      return NextResponse.json({ error: `Erreur OpenRouter (DeepSeek): ${errTxt}` }, { status: res.status });
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning || "";

    if (!rawContent) {
      return NextResponse.json({ error: "Aucun texte généré par le modèle." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      model: "deepseek/deepseek-v4.1-flash-1017",
      content: rawContent
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur interne serveur" }, { status: 500 });
  }
}
