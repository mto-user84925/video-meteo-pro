import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { phenomenon, topic, notes, target_duration = 60, scene_count = 5 } = await req.json();

    const apiKey = process.env.OPENROUTER_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "Clé OPENROUTER_API_KEY manquante sur le serveur." }, { status: 500 });
    }

    const durationSec = Number(target_duration) || 60;
    const numScenes = Math.max(2, Math.min(10, Number(scene_count) || 5));
    const totalWordsTarget = Math.round(durationSec * 2.9);
    const wordsPerLaterScene = Math.round((totalWordsTarget - 14) / (numScenes - 1));

    const systemPrompt = `Tu es le rédacteur météo en chef pour Météo-Climat Pro et Monsieur Météo (Patrick Marlière).
À partir du phénomène météo et des éléments fournis, génère un script vidéo structuré en EXACTEMENT ${numScenes} SCÈNES calibrées pour une durée globale de ${durationSec} SECONDES (soit un total d'environ ${totalWordsTarget} mots).

RÈGLES IMPÉRATIVES DE CALIBRAGE TEMPOREL :
1. Scène 1 (Accroche percutante) : STRICTEMENT <= 4 secondes de lecture (12 à 15 mots maximum). Ton d'alerte immédiat pour capter l'attention.
2. Scènes 2 à ${numScenes - 1} : Chaque scène doit comporter environ ${wordsPerLaterScene} mots avec des explications riches, fluides et rythmées :
   - Analyse synoptique en altitude (gouttes froides, anticyclones, anomalies de géopotentiel, flux directeurs).
   - Chronologie exacte du front ou de l'épisode, phasage heure par heure.
   - Chiffres précis de modélisation (lames d'eau horaires, intensités, cumuls totaux, rafales de vent en km/h, anomalies thermiques).
   - Départements et secteurs particulièrement exposés.
3. Scène ${numScenes} (Paroxysme & Clôture) : Environ ${wordsPerLaterScene} mots résumant le pic d'intensité, les consignes de sécurité/vigilance, et la signature obligatoire finale : "...et restez connectés avec METEO CLIMAT PRO."
4. Vocabulaire : Ne dis JAMAIS "celsius", dis toujours "degrés". Ne cite jamais "Météo-France", utilise toujours "Météo-Climat Pro" ou "nos modélisations haute résolution".

Format de réponse : JSON STRICT UNIQUEMENT selon ce schéma :
{
  "scenes": [
    {
      "scene_number": 1,
      "badge": "ALERTE MÉTÉO",
      "badge_color": [220, 30, 30],
      "title": "TITRE SCÈNE 1",
      "sub": "Sous-titre accrocheur",
      "location_tag": "RÉGION",
      "ticker": "Bandeau défilant court",
      "script_text": "Accroche percutante <= 14 mots"
    },
    ... (${numScenes} scènes au total)
  ]
}`;

    const userPrompt = `Phénomène météo : ${phenomenon || "Épisode méditerranéen / Fortes pluies"}
Sujet / Titre : ${topic || "Arrivée d'intempéries majeures"}
Notes et chiffres particuliers : ${notes || "Pic d'intensité attendu, forts cumuls et rafales."}
Durée totale ciblée : ${durationSec} secondes (environ ${totalWordsTarget} mots au total pour ${numScenes} scènes).`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://video-meteo-pro.vercel.app",
        "X-Title": "Video Meteo Pro Script Generator"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Erreur OpenRouter: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    const rawContent = (data.choices?.[0]?.message?.content || "{}").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const s = rawContent.indexOf("{");
    const e = rawContent.lastIndexOf("}");
    const parsed = JSON.parse(s !== -1 && e > s ? rawContent.slice(s, e + 1) : rawContent);

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur interne" }, { status: 500 });
  }
}
