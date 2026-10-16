"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Video, Download, Upload, CheckCircle2, Clock, AlertTriangle, ShieldCheck, RefreshCw, Play } from "lucide-react";

interface Scene {
  scene_number: number;
  badge: string;
  badge_color: number[];
  title: string;
  sub: string;
  location_tag: string;
  ticker: string;
  script_text: string;
  file_url?: string;
  file_name?: string;
}

const DEFAULT_SCENES: Scene[] = [
  {
    scene_number: 1,
    badge: "ALERTE MÉTÉO",
    badge_color: [220, 30, 30],
    title: "ÉPISODE MÉDITERRANÉEN",
    sub: "De très fortes pluies attendues dans le Sud-Est",
    location_tag: "SUD-EST",
    ticker: "Alerte fortes pluies • Cévennes, Languedoc, Provence • Météo-Climat Pro",
    script_text: "Attention, un épisode méditerranéen marqué va frapper le Sud-Est de la France."
  },
  {
    scene_number: 2,
    badge: "ANALYSE SYNOPTIQUE",
    badge_color: [30, 120, 240],
    title: "GOUTTE FROIDE IBÉRIQUE",
    sub: "Remontée d'air très doux et saturé en humidité",
    location_tag: "EUROPE",
    ticker: "Dépression d'altitude bloquée au sud-ouest • Flux de sud très dynamique",
    script_text: "En altitude, une vaste goutte froide plonge vers la péninsule Ibérique et fait remonter un flux de sud très dynamique et chargé d'humidité méditerranéenne."
  },
  {
    scene_number: 3,
    badge: "CHRONOLOGIE DU FRONT",
    badge_color: [230, 80, 20],
    title: "DÉBUT DES INTEMPÉRIES",
    sub: "Dimanche en Provence, extension lundi en Languedoc",
    location_tag: "SUD-EST",
    ticker: "Premières pluies dimanche 18 • Intensification lundi 19 sur le golfe du Lion",
    script_text: "Les pluies orageuses vont rapidement s'intensifier et se bloquer durablement contre le relief."
  },
  {
    scene_number: 4,
    badge: "INTENSITÉ HORAIRE",
    badge_color: [20, 150, 60],
    title: "LAMES D'EAU INTENSES",
    sub: "Pluies orageuses et saturation rapide des sols",
    location_tag: "SUD-EST",
    ticker: "Modélisation ECMWF AIFS 0.25° • Lames d'eau horaires soutenues • Risque ruissellement",
    script_text: "Les lames d'eau horaires s'annoncent particulièrement intenses, saturant rapidement les sols déjà humides."
  },
  {
    scene_number: 5,
    badge: "PAROXYSME MARDI & MERCREDI",
    badge_color: [220, 30, 30],
    title: "POUVANT DÉPASSER 160 MM",
    sub: "Crues éclairs pendant les vacances scolaires • Météo-Climat Pro",
    location_tag: "SUD-EST",
    ticker: "Cévennes, Gard, Hérault, Rhône • Risque inondations vacances scolaires • Météo-Climat Pro",
    script_text: "Regardez ce zoom sur le quart Sud-Est : le pic d'intensité est attendu entre mardi et mercredi, avec des pointes locales pouvant dépasser 160 millimètres sur les Cévennes, le Gard, l'Hérault et la vallée du Rhône, provoquant un risque majeur d'inondations et de crues éclairs, pendant les vacances scolaires Soyez très vigilants dans vos déplacements, et restez connectés avec METEO CLIMAT PRO."
  }
];

const PHENOMENONS = [
  "Épisode méditerranéen / Cévenol",
  "Tempête / Coup de vent violent",
  "Canicule / Vague de chaleur",
  "Orages violents / Grêle",
  "Neige / Verglas / Grand froid",
  "Inondations / Crues majeures",
  "Point Météo Hebdomadaire 7 jours"
];

export default function StudioMeteoPage() {
  const [phenomenon, setPhenomenon] = useState(PHENOMENONS[0]);
  const [topic, setTopic] = useState("Arrivée d'un épisode méditerranéen majeur dans le Sud-Est");
  const [notes, setNotes] = useState("Pic d'intensité mardi et mercredi, pointes > 160 mm sur Cévennes, Gard, Hérault, Rhône.");
  const [scenes, setScenes] = useState<Scene[]>(DEFAULT_SCENES);

  const [generatingScript, setGeneratingScript] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progressStep, setProgressStep] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [resultTiktok, setResultTiktok] = useState<string | null>(null);
  const [resultLandscape, setResultLandscape] = useState<string | null>(null);

  // Fonction pour appeler le LLM et générer le script 5 scènes
  const handleGenerateScript = async () => {
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phenomenon, topic, notes })
      });
      const data = await res.json();
      if (data.scenes && Array.isArray(data.scenes)) {
        // Conserver les fichiers déjà uploadés
        const merged = data.scenes.map((newSc: any, i: number) => ({
          ...newSc,
          file_url: scenes[i]?.file_url || "",
          file_name: scenes[i]?.file_name || ""
        }));
        setScenes(merged);
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la génération du script.");
    } finally {
      setGeneratingScript(false);
    }
  };

  // Upload d'une image vers Supabase Storage
  const handleFileUpload = async (index: number, file: File) => {
    const sId = sessionId || `session_${Date.now()}`;
    if (!sessionId) setSessionId(sId);

    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const remotePath = `renders/${sId}/scene_${index + 1}_${safeName}`;
    const uploadUrl = `https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/blog-images/${remotePath}`;

    try {
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "apikey": "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP",
          "Authorization": "Bearer sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP",
          "Content-Type": file.type || "application/octet-stream"
        },
        body: file
      });

      const publicUrl = `https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/${remotePath}`;
      const nextScenes = [...scenes];
      nextScenes[index].file_url = publicUrl;
      nextScenes[index].file_name = file.name;
      setScenes(nextScenes);
    } catch (e) {
      console.error(e);
      alert("Erreur d'upload vers Supabase.");
    }
  };

  // Lancement du rendu double format
  const handleStartRender = async () => {
    const missing = scenes.find(s => !s.file_url);
    if (missing) {
      alert(`Veuillez ajouter une image ou carte pour la Scène ${missing.scene_number}.`);
      return;
    }

    const sId = sessionId || `session_${Date.now()}`;
    setSessionId(sId);
    setRendering(true);
    setProgressStep("Préparation des fichiers et envoi à la régie...");
    setResultTiktok(null);
    setResultLandscape(null);

    try {
      const payload = {
        session_id: sId,
        job: {
          session_id: sId,
          phenomenon,
          topic,
          scenes: scenes.map(s => ({
            badge: s.badge,
            badge_color: s.badge_color,
            title: s.title,
            sub: s.sub,
            location_tag: s.location_tag,
            ticker: s.ticker,
            script_text: s.script_text,
            file: s.file_url
          }))
        }
      };

      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Erreur de dispatch");

      // Polling de statut
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const stRes = await fetch(`/api/status?session_id=${sId}`);
          if (stRes.ok) {
            const stData = await stRes.json();
            if (stData.status === "completed") {
              clearInterval(interval);
              setResultTiktok(stData.tiktok_url);
              setResultLandscape(stData.landscape_url);
              setRendering(false);
              setProgressStep("Rendu terminé avec succès !");
            } else if (stData.step) {
              setProgressStep(stData.step);
            }
          }
        } catch (err) {
          console.error(err);
        }

        if (attempts > 80) { // 4 minutes timeout
          clearInterval(interval);
          setRendering(false);
          alert("Le rendu a pris plus de temps que prévu. Veuillez vérifier la console.");
        }
      }, 3000);

    } catch (e: any) {
      alert(e.message || "Erreur de démarrage du rendu.");
      setRendering(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER OFFICIEL */}
        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">
                Météo-Climat Pro & Monsieur Météo
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Zéro Écran Noir Garanti
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Video className="w-8 h-8 text-sky-400" /> Studio Vidéo Double Format
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-1">
              Générez en 1 clic vos bulletins météo broadcast : <strong>📱 TikTok (9:16)</strong> et <strong>🖥️ Paysage YouTube (16:9)</strong> avec voix off Charon.
            </p>
          </div>
        </header>

        {/* ÉTAPE 1 : SUJET & CONFIGURATION RAPIDE */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center text-xs font-black">1</span>
              Actualité Météo & Génération du Script
            </h2>
            <button
              onClick={handleGenerateScript}
              disabled={generatingScript}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 text-sm cursor-pointer"
            >
              {generatingScript ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              ✨ Rédiger le script avec l'IA
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Type de phénomène</label>
              <select
                value={phenomenon}
                onChange={e => setPhenomenon(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {PHENOMENONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Titre de l'alerte</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes, chiffres remarquables et communes cibles</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </section>

        {/* ÉTAPE 2 : DÉCOUPAGE EN 5 SCÈNES */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center text-xs font-black">2</span>
              Les 5 Scènes du Bulletin (Visuels & Voix Off)
            </h2>
            <span className="text-xs text-slate-400">Glissez ou sélectionnez chaque carte météo</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {scenes.map((sc, i) => (
              <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative group hover:border-slate-700 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400">Scène {i + 1}</span>
                    {i === 0 && <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded">≤ 4s</span>}
                  </div>

                  {/* DROPZONE IMAGE */}
                  <label className={`w-full aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center p-2 cursor-pointer transition-all ${sc.file_url ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-slate-800 hover:border-sky-500 bg-slate-950'}`}>
                    <input
                      type="file"
                      accept="image/*,.gif"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleFileUpload(i, e.target.files[0])}
                    />
                    {sc.file_url ? (
                      <div className="space-y-1">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                        <span className="text-[11px] text-emerald-300 font-semibold truncate block max-w-[120px]">
                          {sc.file_name || "Carte importée"}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1 text-slate-500">
                        <Upload className="w-5 h-5 mx-auto" />
                        <span className="text-[11px] block">Déposer visuel {i === 0 ? "(Photo)" : "(Carte/GIF)"}</span>
                      </div>
                    )}
                  </label>

                  {/* BADGE & TITRE */}
                  <div className="mt-3 space-y-1">
                    <input
                      type="text"
                      value={sc.badge}
                      onChange={e => {
                        const copy = [...scenes];
                        copy[i].badge = e.target.value;
                        setScenes(copy);
                      }}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-[11px] text-amber-400 font-bold uppercase tracking-wider"
                    />
                    <input
                      type="text"
                      value={sc.title}
                      onChange={e => {
                        const copy = [...scenes];
                        copy[i].title = e.target.value;
                        setScenes(copy);
                      }}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-xs text-white font-bold"
                    />
                  </div>
                </div>

                {/* SCRIPT VOIX OFF */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Voix off Charon</label>
                  <textarea
                    rows={4}
                    value={sc.script_text}
                    onChange={e => {
                      const copy = [...scenes];
                      copy[i].script_text = e.target.value;
                      setScenes(copy);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 resize-none focus:outline-none focus:border-sky-500 leading-relaxed"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ÉTAPE 3 : BOUTON DE LANCEMENT & PROGRESSION */}
        <section className="text-center py-4">
          <button
            onClick={handleStartRender}
            disabled={rendering}
            className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-lg rounded-2xl shadow-2xl shadow-sky-500/25 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-3 mx-auto"
          >
            {rendering ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
            {rendering ? "Régie en cours de génération..." : "🎬 Générer les 2 Vidéos (TikTok 9:16 + Paysage 16:9)"}
          </button>

          {rendering && (
            <div className="mt-4 p-4 bg-slate-900 border border-sky-500/30 rounded-xl max-w-lg mx-auto flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-sky-400 animate-spin flex-shrink-0" />
              <span className="text-sm font-semibold text-sky-300">{progressStep}</span>
            </div>
          )}
        </section>

        {/* ÉTAPE 4 : RÉSULTATS & TÉLÉCHARGEMENT */}
        {(resultTiktok || resultLandscape) && (
          <section className="bg-slate-900/80 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-extrabold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6" /> Vos deux vidéos sont prêtes !
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Voix off Charon masterisée, mixage audio broadcast, 0 écran noir final.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LECTEUR TIKTOK */}
              {resultTiktok && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400">📱 Format Vertical (TikTok / Shorts 9:16)</span>
                    <a
                      href={resultTiktok}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" /> Télécharger MP4
                    </a>
                  </div>
                  <div className="max-w-[280px] mx-auto aspect-[9/16] bg-black rounded-lg overflow-hidden border border-slate-800">
                    <video src={resultTiktok} controls className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              {/* LECTEUR PAYSAGE */}
              {resultLandscape && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">🖥️ Format Paysage (YouTube / TV 16:9)</span>
                    <a
                      href={resultLandscape}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" /> Télécharger MP4
                    </a>
                  </div>
                  <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                    <video src={resultLandscape} controls className="w-full h-full object-contain" />
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
