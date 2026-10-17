"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Video, Download, Upload, CheckCircle2, ShieldCheck, RefreshCw, Play, Link as LinkIcon, ExternalLink, Image as ImageIcon, Terminal, Plus, Trash2, Clock } from "lucide-react";

interface LogEntry {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'voice' | 'video' | 'audio' | 'success';
}

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

const BADGE_PRESETS = [
  { badge: "ALERTE MÉTÉO", color: [220, 30, 30] },
  { badge: "ANALYSE SYNOPTIQUE", color: [30, 120, 240] },
  { badge: "CHRONOLOGIE", color: [230, 80, 20] },
  { badge: "CUMULS & IMPACTS", color: [20, 150, 60] },
  { badge: "VIGILANCE & CONSEILS", color: [220, 30, 30] }
];

function createEmptyScenes(count = 5): Scene[] {
  return Array.from({ length: count }, (_, i) => {
    const preset = BADGE_PRESETS[i % BADGE_PRESETS.length];
    return {
      scene_number: i + 1,
      badge: preset.badge,
      badge_color: [...preset.color],
      title: "",
      sub: "",
      location_tag: "",
      ticker: "",
      script_text: "",
      file_url: "",
      file_name: ""
    };
  });
}

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
  "Poussières du Sahara / Qualité de l'air",
  "Tornade / Rafales descendantes",
  "Vagues-submersion / Grandes marées",
  "Brouillard givrant / Inversion thermique",
  "Gel tardif / Risque agrométéo"
];

const DURATION_OPTIONS = [
  { value: 45, label: "⚡ Express (~40-45s)" },
  { value: 60, label: "⏱️ Standard (~55-60s • Recommandé)" },
  { value: 90, label: "📊 Approfondi (~85-90s)" },
  { value: 120, label: "📺 Grand Format (~110-120s)" }
];

export default function StudioMeteoPage() {
  const [articleUrl, setArticleUrl] = useState("");
  const [importingArticle, setImportingArticle] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState("");

  const [phenomenon, setPhenomenon] = useState(PHENOMENONS[0]);
  const [customPhenomenon, setCustomPhenomenon] = useState("");
  const [isCustomPhenomenon, setIsCustomPhenomenon] = useState(false);

  const effectivePhenomenon = (isCustomPhenomenon && customPhenomenon.trim())
    ? customPhenomenon.trim()
    : phenomenon;

  const [targetDuration, setTargetDuration] = useState<number>(60);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [scenes, setScenes] = useState<Scene[]>(() => createEmptyScenes(5));

  const [generatingScript, setGeneratingScript] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progressStep, setProgressStep] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [resultTiktok, setResultTiktok] = useState<string | null>(null);
  const [resultLandscape, setResultLandscape] = useState<string | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Vider tout cache navigateur éventuel à chaque ouverture du studio
  useEffect(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  }, []);

  const handleResetAll = () => {
    setArticleUrl("");
    setTopic("");
    setNotes("");
    setImportSuccessMessage("");
    setScenes(createEmptyScenes(5));
    setResultTiktok(null);
    setResultLandscape(null);
    setLogs([]);
    setSessionId(null);
  };

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // IMPORT AUTOMATIQUE EN 1 CLIC DEPUIS N'IMPORTE QUEL LIEN WEB D'ARTICLE
  const handleImportArticle = async (urlToFetch?: string) => {
    const targetUrl = urlToFetch || articleUrl;
    if (!targetUrl.trim()) {
      alert("Veuillez coller le lien de l'article météo.");
      return;
    }

    const currentCount = scenes.length;
    setImportingArticle(true);
    setImportSuccessMessage("");
    // On vide immédiatement les anciennes scènes et images avant l'import
    setScenes(createEmptyScenes(currentCount));
    setTopic("");
    setNotes("");
    setResultTiktok(null);
    setResultLandscape(null);

    try {
      const res = await fetch(`/api/import-article?t=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        body: JSON.stringify({
          url: targetUrl.trim(),
          target_duration: targetDuration,
          scene_count: currentCount
        })
      });

      if (!res.ok) {
        throw new Error("Impossible d'extraire les données depuis cette URL.");
      }

      const data = await res.json();
      if (data.title) setTopic(data.title);

      if (data.phenomenon) {
        const found = PHENOMENONS.find(p => p.toLowerCase().includes(data.phenomenon.toLowerCase()) || data.phenomenon.toLowerCase().includes(p.toLowerCase()));
        if (found) {
          setPhenomenon(found);
          setIsCustomPhenomenon(false);
        } else {
          setIsCustomPhenomenon(true);
          setCustomPhenomenon(data.phenomenon);
        }
      }

      if (data.scenes && Array.isArray(data.scenes) && data.scenes.length >= 2) {
        setScenes(data.scenes);
        const methodLabel = data.method_used === "supabase_direct"
          ? "Réseau Interne Supabase"
          : (data.method_used === "jina_reader" ? "Proxy IA Universel (Bypass Anti-Bot)" : "Scraping HD Direct");
        const countInfo = data.mirrored_count ? ` (${data.mirrored_count} carte(s) extraite(s))` : "";
        setImportSuccessMessage(`🎉 Article importé via ${methodLabel} : les ${data.scenes.length} scènes${countInfo} et le script calibré sur ${targetDuration}s sont prêts !`);
      } else {
        const allImgs = [data.cover_image, ...(data.content_images || [])].filter(Boolean);
        const updated = createEmptyScenes(currentCount).map((sc, i) => {
          const chosenUrl = allImgs.length > 0 ? allImgs[i % allImgs.length] : "";
          return {
            ...sc,
            file_url: chosenUrl,
            file_name: allImgs.length > 0 ? `Carte_${(i % allImgs.length) + 1}` : ""
          };
        });
        setScenes(updated);
        setImportSuccessMessage("✅ Cartes extraites avec succès !");
      }
    } catch (e: any) {
      alert(e.message || "Erreur lors de l'import de l'article.");
    } finally {
      setImportingArticle(false);
    }
  };

  // Génération du script par IA seule (sans lien)
  const handleGenerateScript = async () => {
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phenomenon: effectivePhenomenon,
          topic,
          notes,
          target_duration: targetDuration,
          scene_count: scenes.length
        })
      });
      const data = await res.json();
      if (data.scenes && Array.isArray(data.scenes)) {
        const merged = data.scenes.map((newSc: any, i: number) => ({
          ...newSc,
          file_url: scenes[i]?.file_url || (scenes.length > 0 ? scenes[i % scenes.length]?.file_url : "") || "",
          file_name: scenes[i]?.file_name || `Carte_${i + 1}`
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

  // Upload manuel d'une image vers Supabase Storage
  const handleFileUpload = async (index: number, file: File) => {
    const sId = sessionId || `session_${Date.now()}`;
    if (!sessionId) setSessionId(sId);

    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const remotePath = `renders/${sId}/scene_${index + 1}_${Date.now()}_${safeName}`;
    const uploadUrl = `https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/blog-images/${remotePath}`;

    try {
      await fetch(uploadUrl, {
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

  // Ajout manuel d'une nouvelle scène
  const handleAddScene = () => {
    const nextNum = scenes.length + 1;
    const newScene: Scene = {
      scene_number: nextNum,
      badge: "ÉVOLUTION DU PHÉNOMÈNE",
      badge_color: [30, 120, 240],
      title: `SCÈNE ${nextNum}`,
      sub: "Précisions et évolution météo",
      location_tag: "FRANCE",
      ticker: "Suivi météorologique en direct • Météo-Climat Pro",
      script_text: "Décrivez ici les conditions météorologiques ou prévisions détaillées pour cette scène.",
      file_url: "",
      file_name: ""
    };
    setScenes([...scenes, newScene]);
  };

  // Suppression d'une scène
  const handleRemoveScene = (indexToRemove: number) => {
    if (scenes.length <= 2) {
      alert("Une vidéo doit comporter au moins 2 scènes.");
      return;
    }
    const updated = scenes
      .filter((_, idx) => idx !== indexToRemove)
      .map((sc, idx) => ({
        ...sc,
        scene_number: idx + 1
      }));
    setScenes(updated);
  };

  // Lancement du rendu double format
  const handleStartRender = async () => {
    const missing = scenes.find(s => !s.file_url);
    if (missing) {
      alert(`Veuillez vérifier que chaque scène possède une carte (manquante en Scène ${missing.scene_number}).`);
      return;
    }

    const sId = `session_${Date.now()}`;
    setSessionId(sId);
    setRendering(true);
    setProgressPercent(8);
    setElapsedSeconds(0);
    setProgressStep("Lancement de la régie vidéo...");
    setResultTiktok(null);
    setResultLandscape(null);

    const startTime = Date.now();
    const getNowStr = () => new Date().toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setLogs([
      { id: "init_1", time: getNowStr(), text: "🚀 Démarrage du job de rendu et envoi à la régie cloud...", type: "info" }
    ]);



    try {
      const payload = {
        session_id: sId,
        job: {
          session_id: sId,
          phenomenon: effectivePhenomenon,
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

      // 1. Timer régulier pour les logs et l'horloge
      let lastProgressTs = 0;
      const timerInterval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // 2. Polling de statut toutes les 2.5 secondes
      let attempts = 0;
      const statusInterval = setInterval(async () => {
        attempts++;
        try {
          const stRes = await fetch(`/api/status?session_id=${sId}`);
          if (stRes.ok) {
            const stData = await stRes.json();
            if (stData.status === "completed") {
              clearInterval(timerInterval);
              clearInterval(statusInterval);
              setLogs(prev => [
                ...prev,
                { id: `done_${Date.now()}`, time: getNowStr(), text: "🎉 Rendu terminé avec succès ! Vos 2 vidéos (TikTok 9:16 & Paysage 16:9) sont prêtes.", type: "success" }
              ]);
              setProgressPercent(100);
              setResultTiktok(stData.tiktok_url);
              setResultLandscape(stData.landscape_url);
              setRendering(false);
              setProgressStep("Rendu terminé avec succès !");
            } else if (stData.progress && stData.progress.ts !== lastProgressTs) {
              lastProgressTs = stData.progress.ts;
              setLogs(prev => [...prev, { id: `p_${stData.progress.ts}`, time: getNowStr(), text: stData.progress.text, type: (stData.progress.type || "info") as any }]);
              setProgressPercent(stData.progress.pct);
              setProgressStep(stData.progress.text);
            }
          }
        } catch (err) {
          console.error(err);
        }

        if (attempts > 360) {
          clearInterval(timerInterval);
          clearInterval(statusInterval);
          setRendering(false);
          alert("Le rendu a pris plus de temps que prévu. Veuillez vérifier la console.");
        }
      }, 2500);

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
              <Video className="w-8 h-8 text-sky-400" /> Studio Vidéo Automatique Double Format
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-1">
              Collez simplement le lien d'un article météo : les <strong>cartes</strong>, le <strong>script</strong> et les <strong>vidéos TikTok & Paysage</strong> sont générés automatiquement.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetAll}
            className="self-start md:self-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/80 text-slate-200 hover:text-rose-200 border border-slate-700 hover:border-rose-500/40 text-xs font-bold flex items-center gap-2 transition shadow-lg shrink-0"
            title="Vider le cache et remettre toutes les scènes à zéro"
          >
            <Trash2 className="w-4 h-4 text-rose-400" /> Vider / Nouveau bulletin
          </button>
        </header>

        {/* 🌟 ACTION PRINCIPALE : IMPORTATION EN 1 CLIC DEPUIS UN LIEN D'ARTICLE WEB */}
        <section className="bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border-2 border-sky-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-sky-500 text-slate-950 mb-1.5 inline-block">
                Mode Rapide 1 Clic
              </span>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-sky-400" /> Coller le lien d'un article météo
              </h2>
              <p className="text-slate-400 text-xs md:text-sm mt-0.5">
                Le système extrait automatiquement la photo de couverture, les cartes météo, les cumuls chiffrés et rédige les 5 scènes avec l'IA.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="url"
                placeholder="Collez n'importe quelle URL (meteobtp.fr, ouest-france, infoclimat, actu.fr, etc.)"
                value={articleUrl}
                onChange={e => setArticleUrl(e.target.value)}
                className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all font-mono"
              />
            </div>
            <button
              onClick={() => handleImportArticle()}
              disabled={importingArticle}
              className="px-6 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer flex-shrink-0"
            >
              {importingArticle ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {importingArticle ? "Extraction en cours..." : "⚡ Importer tout en 1 clic"}
            </button>
          </div>

          {/* EXEMPLE PRÊT À TESTER */}
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-500">Exemple direct :</span>
            <button
              onClick={() => {
                const exUrl = "https://meteobtp.fr/actualites/episode-mediterraneen-sud-est-fortes-pluies-cevennes-provence-1792152126";
                setArticleUrl(exUrl);
                handleImportArticle(exUrl);
              }}
              className="text-sky-400 hover:text-sky-300 underline flex items-center gap-1 cursor-pointer truncate max-w-md"
            >
              Épisode méditerranéen Sud-Est (Cévennes, Provence) <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </button>
          </div>

          {importSuccessMessage && (
            <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs md:text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              {importSuccessMessage}
            </div>
          )}
        </section>

        {/* ÉTAPE 1 (OPTIONNELLE) : PARAMÈTRES DU SUJET */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <span>📝 Titre & Phénomène de l'actualité</span>
            </h3>
            <button
              onClick={handleGenerateScript}
              disabled={generatingScript}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generatingScript ? 'animate-spin' : ''}`} />
              Régénérer le texte avec l'IA
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Type de phénomène</label>
                {isCustomPhenomenon && (
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                    Saisie libre
                  </span>
                )}
              </div>
              <select
                value={isCustomPhenomenon ? "OTHER_CUSTOM" : phenomenon}
                onChange={e => {
                  const val = e.target.value;
                  if (val === "OTHER_CUSTOM") {
                    setIsCustomPhenomenon(true);
                  } else {
                    setIsCustomPhenomenon(false);
                    setPhenomenon(val);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {PHENOMENONS.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="OTHER_CUSTOM">➕ Autre phénomène (saisie libre...)</option>
              </select>

              {isCustomPhenomenon && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Tapez le phénomène (ex: Incendie de forêt, Sable saharien, Gel...)"
                    value={customPhenomenon}
                    onChange={e => setCustomPhenomenon(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-500/60 rounded-xl px-3 py-2 text-xs text-amber-300 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    L'IA adaptera le vocabulaire météo sur-mesure pour ce phénomène.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-400" /> Durée de la vidéo
              </label>
              <select
                value={targetDuration}
                onChange={e => setTargetDuration(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-sky-300 font-bold focus:outline-none focus:border-sky-500"
              >
                {DURATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Calibre automatiquement le volume de texte et le débit de la voix off.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Titre de l'alerte</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-semibold"
              />
            </div>
          </div>
        </section>

        {/* ÉTAPE 2 : LES SCÈNES DU BULLETIN (DYNAMIQUES : AJOUT / SUPPRESSION LIBRE) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>
                  🖼️ Les Scènes du Bulletin ({scenes.length} scènes • ~{Math.round(scenes.reduce((acc, s) => acc + s.script_text.trim().split(/\s+/).filter(Boolean).length, 0) / 2.9)}s / Cible {targetDuration}s)
                </span>
              </h2>
              <span className="text-xs text-slate-400">Ajoutez, supprimez ou personnalisez chaque scène, carte et voix off à volonté.</span>
            </div>
            <button
              type="button"
              onClick={handleAddScene}
              className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all w-fit cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" /> Ajouter une scène
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {scenes.map((sc, i) => (
              <div key={i} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between space-y-3 relative group hover:border-slate-700 transition-all shadow-md">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-300">Scène {i + 1}</span>
                      {i === 0 && <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded">Accroche ≤ 4s</span>}
                    </div>
                    {scenes.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveScene(i)}
                        title={`Supprimer la scène ${i + 1}`}
                        className="text-slate-500 hover:text-red-400 p-1 rounded-md hover:bg-red-500/10 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* APERÇU VIGNETTE DE LA CARTE */}
                  <div className="w-full h-36 rounded-xl overflow-hidden relative border border-slate-700 bg-slate-950 group shadow-inner">
                    {sc.file_url ? (
                      <>
                        <img
                          src={sc.file_url}
                          alt={`Scène ${i + 1}`}
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            if (!target.dataset.fallback && sc.file_url) {
                              target.dataset.fallback = "true";
                              target.src = `https://images.weserv.nl/?url=${encodeURIComponent(sc.file_url)}&output=jpg&w=800`;
                            }
                          }}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                        />
                        <div className="absolute top-1.5 left-1.5 bg-slate-950/80 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400 border border-emerald-500/40 flex items-center gap-1 shadow">
                          <CheckCircle2 className="w-3 h-3" /> {i === 0 ? "Couverture" : `Carte ${i + 1}`}
                        </div>
                        <label className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-xs text-white font-bold gap-1.5 cursor-pointer backdrop-blur-xs">
                          <Upload className="w-4 h-4 text-sky-400" /> Remplacer
                          <input
                            type="file"
                            accept="image/*,.gif"
                            className="hidden"
                            onChange={e => e.target.files?.[0] && handleFileUpload(i, e.target.files[0])}
                          />
                        </label>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900/80 transition-all p-2 text-center border-2 border-dashed border-slate-800 hover:border-sky-500 rounded-xl">
                        <input
                          type="file"
                          accept="image/*,.gif"
                          className="hidden"
                          onChange={e => e.target.files?.[0] && handleFileUpload(i, e.target.files[0])}
                        />
                        <ImageIcon className="w-5 h-5 text-slate-500 mb-1" />
                        <span className="text-[11px] font-semibold text-slate-400">{i === 0 ? "Photo Couverture" : "Ajouter une carte"}</span>
                        <span className="text-[9px] text-slate-600">PNG, JPG, GIF</span>
                      </label>
                    )}
                  </div>

                  {/* TITRE & SOUS-TITRE */}
                  <div className="mt-2 space-y-1.5">
                    <input
                      type="text"
                      placeholder="BADGE"
                      value={sc.badge}
                      onChange={e => {
                        const copy = [...scenes];
                        copy[i].badge = e.target.value;
                        setScenes(copy);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-amber-400 font-bold uppercase tracking-wider"
                    />
                    <input
                      type="text"
                      placeholder="TITRE DE LA SCÈNE"
                      value={sc.title}
                      onChange={e => {
                        const copy = [...scenes];
                        copy[i].title = e.target.value;
                        setScenes(copy);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Sous-titre court..."
                      value={sc.sub || ""}
                      onChange={e => {
                        const copy = [...scenes];
                        copy[i].sub = e.target.value;
                        setScenes(copy);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-400"
                    />
                  </div>
                </div>

                {/* TEXTE VOIX OFF */}
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Voix Off Charon</label>
                    <span className={`text-[10px] font-bold ${
                      i === 0
                        ? (sc.script_text.trim().split(/\s+/).filter(Boolean).length <= 15 ? 'text-emerald-400' : 'text-amber-400')
                        : 'text-slate-400'
                    }`}>
                      {sc.script_text.trim().split(/\s+/).filter(Boolean).length} mots (~{(sc.script_text.trim().split(/\s+/).filter(Boolean).length / 3.2).toFixed(1)}s)
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={sc.script_text}
                    onChange={e => {
                      const copy = [...scenes];
                      copy[i].script_text = e.target.value;
                      setScenes(copy);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 resize-none focus:outline-none focus:border-sky-500 leading-relaxed font-sans"
                  />
                  {i === 0 && sc.script_text.trim().split(/\s+/).filter(Boolean).length > 15 && (
                    <p className="text-[9px] text-amber-400/90 mt-0.5 font-medium">
                      ⚠️ Visez 12 à 15 mots max pour l'accroche ≤ 4s.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ÉTAPE 3 : BOUTON DE LANCEMENT */}
        <section className="text-center py-4">
          <button
            onClick={handleStartRender}
            disabled={rendering}
            className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-lg rounded-2xl shadow-2xl shadow-sky-500/25 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-3 mx-auto"
          >
            {rendering ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
            {rendering ? "Régie vidéo en cours d'encodage..." : "🎬 Générer les 2 Vidéos (TikTok 9:16 + Paysage 16:9)"}
          </button>

          {/* JOURNAL DE LOGS EN DIRECT (CONSOLE RÉGIE BROADCAST) */}
          {(rendering || logs.length > 0) && (
            <div className="mt-6 bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 max-w-3xl mx-auto text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Journal d'Exécution Régie en Direct</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Suivi seconde par seconde de la synthèse vocale Charon et des encodages FFmpeg.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono text-slate-300 font-bold bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                    ⏱️ {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
                  </span>
                  {rendering ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      Encodage en cours
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Rendu terminé
                    </span>
                  )}
                </div>
              </div>

              {/* BARRE DE PROGRESSION */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono font-semibold text-slate-400">
                  <span>Progression régie</span>
                  <span className={progressPercent === 100 ? "text-emerald-400 font-bold" : "text-sky-400"}>{progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      progressPercent === 100
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 animate-pulse'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* FENÊTRE TERMINAL SCROLLABLE */}
              <div
                ref={logsContainerRef}
                className="bg-slate-950/90 rounded-xl border border-slate-800/80 p-3.5 max-h-56 overflow-y-auto font-mono text-xs space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700"
              >
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-500 flex-shrink-0 select-none">[{log.time}]</span>
                    <span className={
                      log.type === 'success' ? 'text-emerald-400 font-bold' :
                      log.type === 'voice' ? 'text-amber-300' :
                      log.type === 'video' ? 'text-sky-300' :
                      log.type === 'audio' ? 'text-indigo-300' :
                      'text-slate-300'
                    }>
                      {log.text}
                    </span>
                  </div>
                ))}
                {rendering && (
                  <div className="flex items-center gap-2 text-slate-500 animate-pulse pt-1">
                    <span className="inline-block w-2 h-3.5 bg-sky-400" />
                    <span className="text-[11px] text-slate-400">Traitement en cours dans le cloud...</span>
                  </div>
                )}
              </div>
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
                      href={`${resultTiktok}${resultTiktok.includes('?') ? '&' : '?'}download=BULLETIN_TIKTOK_METEO.mp4`}
                      download="BULLETIN_TIKTOK_METEO.mp4"
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
                      href={`${resultLandscape}${resultLandscape.includes('?') ? '&' : '?'}download=BULLETIN_PAYSAGE_METEO.mp4`}
                      download="BULLETIN_PAYSAGE_METEO.mp4"
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
