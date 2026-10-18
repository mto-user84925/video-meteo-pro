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
  image_ref?: number;
  image_hint?: string;
}

const BADGE_PRESETS = [
  { badge: "ALERTE MÉTÉO", color: [220, 30, 30] },
  { badge: "ANALYSE SYNOPTIQUE", color: [30, 120, 240] },
  { badge: "CHRONOLOGIE", color: [230, 80, 20] },
  { badge: "CUMULS & IMPACTS", color: [20, 150, 60] },
  { badge: "VIGILANCE & CONSEILS", color: [220, 30, 30] }
];

function getBadgeColor(badgeText: string, sceneIndex: number): number[] {
  const b = (badgeText || "").toUpperCase();
  if (b.includes("SYNOPTIQUE") || b.includes("ANALYSE") || b.includes("ALTITUDE")) return [30, 120, 240];
  if (b.includes("CHRONOLOGIE") || b.includes("CALENDRIER") || b.includes("PHASAGE")) return [230, 80, 20];
  if (b.includes("CUMUL") || b.includes("VENT") || b.includes("IMPACT") || b.includes("PLUIE")) return [20, 150, 60];
  if (b.includes("ALERTE") || b.includes("VIGILANCE") || b.includes("PRUDENCE") || b.includes("CHANGEMENT")) return [220, 30, 30];
  return [...BADGE_PRESETS[sceneIndex % BADGE_PRESETS.length].color];
}

const LAST_USER_PROMPT_SAMPLE = `SCÈNE 1
- Image à utiliser : Image 1 — ECMWF AIFS, précipitations cumulées
- Badge : CHANGEMENT MÉTÉO
- Titre : PLUIE ET VENT REVIENNENT
- Sous-titre : CHANGEMENT DÈS MERCREDI
- Localisation : MOITIÉ NORD
- Bandeau Infos Météo : Dès le 21 octobre, retour des perturbations par l’ouest.
- Voix off Charon : Attention, pluie et vent reviennent dès mercredi au nord !
SCÈNE 2
- Image à utiliser : Image 2 — ECMWF IFS, rafales maximales cumulées
- Badge : ANALYSE SYNOPTIQUE
- Titre : LE BLOCAGE RECULE
- Sous-titre : LE FLUX OCÉANIQUE REVIENT
- Localisation : ATLANTIQUE NORD
- Bandeau Infos Météo : Le 21 octobre, le flux atlantique reprend vers la France.
- Voix off Charon : En altitude, un vaste creux dépressionnaire atlantique se rapproche des îles Britanniques. L’anticyclone recule vers les Açores, tandis que le courant d’ouest reprend progressivement sa place, ouvrant le passage aux perturbations sur le nord.
SCÈNE 3
- Image à utiliser : Image 3 — GFS, géopotentiel à 500 hPa
- Badge : CHRONOLOGIE
- Titre : LES PLUIES GAGNENT DU TERRAIN
- Sous-titre : DE MERCREDI À VENDREDI
- Localisation : OUEST PUIS NORD
- Bandeau Infos Météo : Du 21 au 23 octobre, les pluies progressent vers l’intérieur.
- Voix off Charon : Mercredi vingt et un octobre, les premières pluies gagnent la Bretagne, la Normandie et les Pays de la Loire. Jeudi puis vendredi, elles progressent vers le Bassin parisien et le Centre, accompagnées de vent.
SCÈNE 4
- Image à utiliser : Image 1 — ECMWF AIFS, précipitations cumulées
- Badge : VENTS & IMPACTS
- Titre : UN COUP DE VENT POSSIBLE
- Sous-titre : INTENSITÉ ENCORE INCERTAINE
- Localisation : MANCHE / NORD
- Bandeau Infos Météo : Vendredi : scénario à plus de 100 km/h en mer, 80 à terre.
- Voix off Charon : Vendredi, un scénario envisage des rafales dépassant cent kilomètres par heure sur le littoral, contre quatre-vingts dans les terres. Finistère, Manche et Pas-de-Calais sont à surveiller. Ces pluies aideront les sols, sans effacer la sécheresse.
SCÈNE 5
- Image à utiliser : Image 2 — ECMWF IFS, rafales maximales cumulées
- Badge : PRUDENCE
- Titre : VENDREDI SOUS SURVEILLANCE
- Sous-titre : LE SCÉNARIO RESTE À AFFINER
- Localisation : MOITIÉ NORD
- Bandeau Infos Météo : Pic venteux possible le 23 octobre : prévisions à suivre.
- Voix off Charon : Le pic venteux reste possible vendredi, mais sa trajectoire et son intensité sont encore incertaines. Fixez les objets exposés, adaptez vos déplacements aux prévisions actualisées… et restez connectés avec METEO CLIMAT PRO.`;

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
  const [manualPromptText, setManualPromptText] = useState("");
  const [uploadingBatch, setUploadingBatch] = useState(false);

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
    setManualPromptText("");
    setTopic("");
    setNotes("");
    setImportSuccessMessage("");
    setScenes(createEmptyScenes(5));
    setResultTiktok(null);
    setResultLandscape(null);
    setLogs([]);
    setSessionId(null);
  };

  // PARSEUR UNIVERSEL 1-CLIC DU RÉSULTAT DE PROMPT IA (Format Texte SCÈNE 1..5 ou JSON)
  const handleParseManualPrompt = (textOverride?: string) => {
    const raw = (textOverride ?? manualPromptText).trim();
    if (!raw) {
      alert("Veuillez coller le résultat généré par votre prompt IA.");
      return;
    }
    if (textOverride) setManualPromptText(textOverride);

    // Conserver un dictionnaire des images déjà présentes par numéro (Image 1 -> index 0, etc.)
    const existingImagesByRef: Record<number, { url: string; name: string }> = {};
    scenes.forEach((sc, idx) => {
      if (sc.file_url) {
        const refNum = sc.image_ref || idx + 1;
        if (!existingImagesByRef[refNum]) {
          existingImagesByRef[refNum] = { url: sc.file_url, name: sc.file_name || `Image_${refNum}` };
        }
      }
    });

    // 1. Extraction des blocs "SCÈNE 1", "SCÈNE 2"...
    const sceneRegex = /(?:^|\n)\s*(?:#+\s*|\*\*)*SC[ÈE]NE\s+(\d+)[^\n]*\n([\s\S]*?)(?=(?:\n\s*(?:#+\s*|\*\*)*SC[ÈE]NE\s+\d+|\n\s*(?:#+\s*|\*\*)*PARTIE\s+\d+|\n\s*```|$))/gi;
    const matches = [...raw.matchAll(sceneRegex)];

    if (matches.length >= 2) {
      const parsedScenes: Scene[] = matches.map((m, idx) => {
        const sceneNum = Number(m[1]) || idx + 1;
        const body = m[2] || "";
        const lines = body.split("\n");

        let badge = BADGE_PRESETS[idx % BADGE_PRESETS.length].badge;
        let title = "";
        let sub = "";
        let location_tag = "";
        let ticker = "";
        let script_text = "";
        let image_ref: number | undefined = undefined;
        let image_hint: string | undefined = undefined;
        let lastField = "";

        for (const rawLine of lines) {
          const line = rawLine.replace(/^\s*[-*•]+\s*/, "").replace(/\*\*/g, "").trim();
          if (!line) continue;

          const kv = line.match(/^([^:]+):\s*(.+)$/);
          if (kv) {
            const key = kv[1].trim().toLowerCase();
            const val = kv[2].trim();

            if (key.includes("image")) {
              image_hint = val;
              const numM = val.match(/image\s*(\d+)/i) || val.match(/(\d+)/);
              if (numM) image_ref = Number(numM[1]);
              lastField = "image";
            } else if (key.includes("badge")) {
              badge = val.toUpperCase();
              lastField = "badge";
            } else if (key.startsWith("sous-titre") || key.startsWith("sous titre")) {
              sub = val.toUpperCase();
              lastField = "sub";
            } else if (key.startsWith("titre")) {
              title = val.toUpperCase();
              lastField = "title";
            } else if (key.includes("localisation") || key.includes("lieu") || key.includes("région") || key.includes("region")) {
              location_tag = val.toUpperCase();
              lastField = "location";
            } else if (key.includes("bandeau") || key.includes("ticker") || key.includes("infos météo")) {
              ticker = val;
              lastField = "ticker";
            } else if (key.includes("voix off") || key.includes("script") || key.includes("charon") || key.includes("texte")) {
              script_text = val;
              lastField = "script";
            } else if (lastField === "script") {
              script_text += " " + line;
            }
          } else if (lastField === "script") {
            script_text += " " + line;
          }
        }

        const refToUse = image_ref || idx + 1;
        const matchedImg = existingImagesByRef[refToUse];

        return {
          scene_number: sceneNum,
          badge,
          badge_color: getBadgeColor(badge, idx),
          title,
          sub,
          location_tag,
          ticker,
          script_text: script_text.trim(),
          file_url: matchedImg?.url || "",
          file_name: matchedImg?.name || "",
          image_ref: refToUse,
          image_hint
        };
      });

      setScenes(parsedScenes);
      if (parsedScenes[0]?.title) setTopic(parsedScenes[0].title);
      setImportSuccessMessage(`✅ Les ${parsedScenes.length} scènes du prompt ont été remplies automatiquement en 1 clic ! Il ne vous reste plus qu'à glisser vos images (Image 1, 2, 3...).`);
      return;
    }

    // 2. Fallback JSON si l'utilisateur a collé le bloc JSON de la Partie 4
    try {
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      const jsonStr = s !== -1 && e > s ? raw.slice(s, e + 1) : raw;
      const parsed = JSON.parse(jsonStr);
      const arr = Array.isArray(parsed) ? parsed : parsed.scenes;
      if (Array.isArray(arr) && arr.length >= 2) {
        const parsedScenes: Scene[] = arr.map((sc: any, idx: number) => {
          const refToUse = Number(sc.image_index || sc.image_ref) || idx + 1;
          const matchedImg = existingImagesByRef[refToUse];
          const badge = (sc.badge || BADGE_PRESETS[idx % BADGE_PRESETS.length].badge).toUpperCase();
          return {
            scene_number: idx + 1,
            badge,
            badge_color: Array.isArray(sc.badge_color) ? sc.badge_color : getBadgeColor(badge, idx),
            title: (sc.title || "").toUpperCase(),
            sub: (sc.sub || "").toUpperCase(),
            location_tag: (sc.location_tag || "").toUpperCase(),
            ticker: sc.ticker || "",
            script_text: sc.script_text || "",
            file_url: matchedImg?.url || "",
            file_name: matchedImg?.name || "",
            image_ref: refToUse,
            image_hint: sc.image_index ? `Image ${sc.image_index}` : undefined
          };
        });
        setScenes(parsedScenes);
        if (parsed.phenomenon) {
          setIsCustomPhenomenon(true);
          setCustomPhenomenon(parsed.phenomenon);
        }
        if (parsedScenes[0]?.title) setTopic(parsedScenes[0].title);
        setImportSuccessMessage(`✅ Les ${parsedScenes.length} scènes JSON ont été remplies automatiquement en 1 clic !`);
        return;
      }
    } catch {}

    alert("Format non reconnu. Collez le texte contenant 'SCÈNE 1 ... SCÈNE 5' ou le bloc JSON.");
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

  // Upload manuel d'une image vers Supabase Storage (avec propagation automatique aux scènes utilisant la même Image N)
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
      const targetRef = scenes[index]?.image_ref || (index + 1);
      const nextScenes = scenes.map((sc, i) => {
        if (i === index || (sc.image_ref && sc.image_ref === targetRef)) {
          return { ...sc, file_url: publicUrl, file_name: file.name };
        }
        return sc;
      });
      setScenes(nextScenes);
    } catch (e) {
      console.error(e);
      alert("Erreur d'upload vers Supabase.");
    }
  };

  // Upload en lot de plusieurs images (Image 1, Image 2, Image 3...) en un seul clic
  const handleBatchFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const sId = sessionId || `session_${Date.now()}`;
    if (!sessionId) setSessionId(sId);
    setUploadingBatch(true);

    try {
      const uploaded = await Promise.all(
        files.map(async (file, idx) => {
          const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
          const remotePath = `renders/${sId}/batch_${idx + 1}_${Date.now()}_${safeName}`;
          const uploadUrl = `https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/blog-images/${remotePath}`;
          await fetch(uploadUrl, {
            method: "POST",
            headers: {
              "apikey": "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP",
              "Authorization": "Bearer sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP",
              "Content-Type": file.type || "application/octet-stream"
            },
            body: file
          });
          return {
            url: `https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/${remotePath}`,
            name: file.name
          };
        })
      );

      const nextScenes = scenes.map((sc, i) => {
        const refIdx = (sc.image_ref ? sc.image_ref - 1 : i) % uploaded.length;
        const chosen = uploaded[refIdx];
        return {
          ...sc,
          file_url: chosen.url,
          file_name: chosen.name
        };
      });
      setScenes(nextScenes);
      setImportSuccessMessage(`✅ ${uploaded.length} image(s) téléversée(s) et réparties automatiquement sur les ${nextScenes.length} scènes !`);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'envoi groupé des images.");
    } finally {
      setUploadingBatch(false);
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

          {/* 📋 NOUVEAU : COLLER DIRECTEMENT LE RÉSULTAT DU PROMPT IA EN 1 CLIC + UPLOAD GROUPÉ DES IMAGES */}
          <div className="mt-5 pt-5 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 mr-2">
                  Mode Prompt Manuel 1 Clic
                </span>
                <span className="text-xs md:text-sm font-bold text-white">
                  Collez ici le résultat de votre Prompt (SCÈNE 1 à 5 ou JSON) : tout se remplit tout seul !
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleParseManualPrompt(LAST_USER_PROMPT_SAMPLE)}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1.5 cursor-pointer w-fit shrink-0 transition"
              >
                <Sparkles className="w-3.5 h-3.5" /> Charger votre script « Pluie & Vent Mercredi »
              </button>
            </div>

            <textarea
              rows={4}
              placeholder={"Collez ici le texte généré par votre Prompt IA :\nSCÈNE 1\n- Image à utiliser : Image 1...\n- Badge : ...\n- Titre : ...\n- Sous-titre : ...\n- Localisation : ...\n- Bandeau Infos Météo : ...\n- Voix off Charon : ..."}
              value={manualPromptText}
              onChange={e => setManualPromptText(e.target.value)}
              className="w-full bg-slate-950/90 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono leading-relaxed"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleParseManualPrompt()}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 text-xs md:text-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4" /> ⚡ Remplir toutes les scènes en 1 clic
              </button>

              <label className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 text-xs md:text-sm cursor-pointer">
                {uploadingBatch ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadingBatch ? "Téléversement..." : "🖼️ Importer mes images (Image 1, 2, 3...) d'un coup"}
                <input
                  type="file"
                  accept="image/*,.gif"
                  multiple
                  className="hidden"
                  onChange={e => handleBatchFilesUpload(e.target.files)}
                />
              </label>
              <span className="text-[11px] text-slate-400">
                Astuce : sélectionnez vos 3 cartes en même temps, elles se placent automatiquement sur les scènes 1 à 5 (Image 1 → Scènes 1 & 4, Image 2 → Scènes 2 & 5, Image 3 → Scène 3).
              </span>
            </div>
          </div>
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

                  {sc.image_hint && (
                    <div className="mb-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 font-semibold truncate" title={sc.image_hint}>
                      📌 {sc.image_hint}
                    </div>
                  )}

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
                          <CheckCircle2 className="w-3 h-3" /> {sc.image_ref ? `Image ${sc.image_ref}` : (i === 0 ? "Couverture" : `Carte ${i + 1}`)}
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
                        <span className="text-[11px] font-semibold text-slate-400">{sc.image_ref ? `Ajouter Image ${sc.image_ref}` : (i === 0 ? "Photo Couverture" : "Ajouter une carte")}</span>
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
