import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { phenomenon, topic, notes } = await req.json();

    const apiKey = process.env.OPENROUTER_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "Clé OPENROUTER_API_KEY manquante sur le serveur." }, { status: 500 });
    }

    const systemPrompt = `Tu es le rédacteur météo officiel pour Météo-Climat Pro et Monsieur Météo (Patrick Marlière).
À partir du phénomène météo et des éléments fournis, génère un script vidéo structuré en EXACTEMENT 5 SCÈNES calibrées pour une durée globale de 50 à 60 secondes.

RÈGLES IMPÉRATIVES :
1. Scène 1 (Accroche) : STRICTEMENT <= 4 secondes de lecture (12 à 15 mots maximum). Ton d'alerte immédiat.
2. Scène 2 (Synoptique) : Explication météo physique en altitude (goutte froide, anticyclone, flux, creusement).
3. Scène 3 (Chronologie / Radar) : Arrivée et phasage du phénomène dans le temps.
4. Scène 4 (Intensité / Mesures) : Intensité horaire, rafales, lames d'eau ou températures maximales.
5. Scène 5 (Paroxysme & Signature) : Chiffres clés locaux, départements ou secteurs touchés, appel à la vigilance et signature obligatoire: "...et restez connectés avec METEO CLIMAT PRO."
6. Pas de mot "celsius", toujours "degrés". Pas de mention "Météo-France", toujours "Météo-Climat Pro" ou "nos modèles haute résolution".

Format de réponse : JSON STRICT UNIQUEMENT selon ce schéma :
{
  "scenes": [
    {
      "scene_number": 1,
      "badge": "ALERTE MÉTÉO",
      "badge_color": [220, 30, 30],
      "title": "ÉPISODE MÉDITERRANÉEN",
      "sub": "De très fortes pluies attendues dans le Sud-Est",
      "location_tag": "SUD-EST",
      "ticker": "Alerte fortes pluies • Cévennes, Languedoc, Provence • Météo-Climat Pro",
      "script_text": "Attention, un épisode méditerranéen marqué va frapper le Sud-Est de la France."
    },
    ... (5 scènes au total)
  ]
}`;

    const userPrompt = `Phénomène météo : ${phenomenon || "Épisode méditerranéen / Fortes pluies"}
Sujet / Titre : ${topic || "Arrivée d'intempéries majeures"}
Notes et chiffres particuliers : ${notes || "Pic d'intensité mardi et mercredi, pointes locales > 160 mm sur Cévennes, Gard, Hérault, Rhône, crues éclairs."}`;

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
    const rawContent = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(rawContent);

    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 });
  }
}
