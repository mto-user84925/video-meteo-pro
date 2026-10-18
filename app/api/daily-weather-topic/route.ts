import { NextResponse } from "next/server";

const PHENOMENONS = [
  "Épisode méditerranéen / Cévenol",
  "Tempête / Coup de vent violent",
  "Canicule / Vague de chaleur",
  "Orages violents / Grêle",
  "Neige / Verglas / Grand froid",
  "Inondations / Crues majeures",
  "Point Météo Hebdomadaire 7 jours",
  "Sécheresse / Risque feux de forêt",
  "Cyclone / Tempête tropicale",
  "Poussières du Sahara / Qualité de l'air"
];

export async function GET(req: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY || "";
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    // Si la clé API est disponible, demander à l'IA une suggestion d'actualité météo forte et réaliste pour aujourd'hui
    if (apiKey) {
      const prompt = `Nous sommes le ${dateStr}.
Propose le sujet d'actualité météorologique le plus pertinent, réaliste et marquant pour la France en cette période de l'année.
Choisis STRICTEMENT l'un de ces phénomènes :
${PHENOMENONS.map(p => `- ${p}`).join("\n")}

Format de réponse JSON STRICT uniquement :
{
  "phenomenon": "Le nom exact du phénomène choisi parmi la liste",
  "topic": "Un titre d'actualité accrocheur, journalistique et professionnel (max 15 mots)",
  "target_duration": 60,
  "summary": "Une phrase résumant l'enjeu principal."
}`;

      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://video-meteo-pro.vercel.app",
            "X-Title": "Video Meteo Pro Topic Detector"
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            response_format: { type: "json_object" }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const raw = (data.choices?.[0]?.message?.content || "{}").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
          const parsed = JSON.parse(raw);
          if (parsed.topic && parsed.phenomenon) {
            return NextResponse.json({
              success: true,
              phenomenon: parsed.phenomenon,
              topic: parsed.topic,
              target_duration: parsed.target_duration || 60,
              summary: parsed.summary || ""
            });
          }
        }
      } catch (e: any) {
        console.warn("[daily-weather-topic] Erreur OpenRouter, fallback local:", e.message);
      }
    }

    // Fallback intelligent selon la saison
    const month = now.getMonth(); // 0-11
    let defaultPhenomenon = "Point Météo Hebdomadaire 7 jours";
    let defaultTopic = "Évolution synoptique : perturbation atlantique et coup de vent à surveiller";

    if (month >= 8 && month <= 10) {
      // Automne
      defaultPhenomenon = "Tempête / Coup de vent violent";
      defaultTopic = "Perturbations atlantiques : coup de vent et pluies copieuses attendus cette semaine";
    } else if (month >= 5 && month <= 7) {
      // Été
      defaultPhenomenon = "Orages violents / Grêle";
      defaultTopic = "Dégradation orageuse estivale : fortes pluies et risque de grêle localement";
    } else if (month >= 11 || month <= 1) {
      // Hiver
      defaultPhenomenon = "Neige / Verglas / Grand froid";
      defaultTopic = "Offensive hivernale : baisse marquée des températures et gelées généralisées";
    }

    return NextResponse.json({
      success: true,
      phenomenon: defaultPhenomenon,
      topic: defaultTopic,
      target_duration: 60,
      summary: "Suggestion saisonnière automatique Météo-Climat Pro."
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 });
  }
}
