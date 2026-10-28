"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Video,
  Download,
  Upload,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Play,
  Link as LinkIcon,
  ExternalLink,
  Image as ImageIcon,
  Terminal,
  Plus,
  Trash2,
  Clock,
  Copy,
  FileText,
  Globe,
  Eye,
  AlertTriangle,
  X,
  Layers,
  ArrowRight,
  Wand2,
  Sliders
} from "lucide-react";
import {
  ARTICLE_THEMES,
  buildWordForWordArticleHtml,
  buildPromptBudget,
  detectBestArticleTheme,
  parseFullVideoScript,
  ParsedArticleOutput
} from "./lib/articleFormatter";
import { MASTER_PROMPT_V2 } from "./lib/masterPromptV2";
import {
  ArticleBlock,
  buildArticleBlocks,
  applyArticleEdits,
  buildArticleSlug,
  buildExcerpt,
  sanitizeInlineHtml,
  textToInlineHtml
} from "./lib/articleEditor";
import { resolveSceneCount, describeSceneCount, MAX_SCENES } from "./lib/scenePlan";
import type { Scene } from "./lib/scenePlanTypes";
import { completeScenesWithImages } from "./lib/completeScenes";
import { readTextFile, isSupportedTextFile } from "./lib/readTextFile";
import { auditSceneImages, summarizeImageAudit } from "./lib/imageAudit";

interface LogEntry {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'voice' | 'video' | 'audio' | 'success' | 'error';
}

interface ArticleLogEntry {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'ia' | 'theme' | 'images' | 'publish' | 'success' | 'error';
}

interface ToastNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
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

function matchImageForScene(
  ps: { fileName?: string; scene_number: number },
  idx: number,
  existingImagesByRef: Record<number, { url: string; name: string }>,
  currentScene?: Scene,
  usedUrls: Set<string> = new Set(),
  coverImage?: { url: string; name: string }
): { url: string; name: string } {
  const allImages = Object.entries(existingImagesByRef)
    .filter(([_, img]) => img && img.url)
    .map(([refStr, img]) => ({ ref: Number(refStr), url: img.url, name: img.name }));

  // Détection prioritaire de la photo de couverture (Hook Scène 1)
  const hintLower = (ps.fileName || "").toLowerCase();
  const isCoverRequested = hintLower.includes("couvert") || hintLower.includes("cover");

  if (coverImage?.url && (isCoverRequested || (ps.scene_number === 1 && (!ps.fileName || isCoverRequested || !/\.(png|jpg|jpeg|gif|webp)/i.test(ps.fileName))))) {
    return { url: coverImage.url, name: coverImage.name || "Photo de couverture 16:9" };
  }

  if (allImages.length === 0) {
    if (coverImage?.url && (ps.scene_number === 1 || isCoverRequested)) {
      return { url: coverImage.url, name: coverImage.name || "Photo de couverture 16:9" };
    }
    if (currentScene && currentScene.file_url) {
      return { url: currentScene.file_url, name: currentScene.file_name || ps.fileName || "" };
    }
    return { url: "", name: ps.fileName || "" };
  }

  // Si une seule image existe au total
  if (allImages.length === 1) {
    if (coverImage?.url && (ps.scene_number === 1 || isCoverRequested)) {
      return { url: coverImage.url, name: coverImage.name || "Photo de couverture 16:9" };
    }
    return allImages[0];
  }

  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_\s]*copie[-_\s]*/gi, "")
      .replace(/[^a-z0-9]/g, "");

  // 1. Extraction du nom de fichier exact depuis le champ (ex: "MeteoClimatPro...png — Vue d'ensemble...")
  let targetFileOnly = ps.fileName || "";
  const fileMatch = targetFileOnly.match(/(?:Image\s*\d+\s*[-—–]\s*)?([^—–\n:]+\.(?:png|jpg|jpeg|gif|webp))/i);
  if (fileMatch) {
    targetFileOnly = fileMatch[1].trim();
  }

  // 1a. Correspondance EXACTE de nom de fichier (priorité absolue pour les intitulés conformes)
  const cleanTarget = normalize(targetFileOnly);
  if (cleanTarget.length >= 3) {
    for (const img of allImages) {
      if (usedUrls.has(img.url)) continue;
      const cleanImg = normalize(img.name);
      if (cleanImg === cleanTarget) {
        usedUrls.add(img.url);
        return img;
      }
    }
  }

  // 1b. Correspondance par inclusion de nom nettoyé (sans extension, sans _copie)
  if (cleanTarget.length >= 5) {
    for (const img of allImages) {
      if (usedUrls.has(img.url)) continue;
      const cleanImg = normalize(img.name);
      if (cleanImg.includes(cleanTarget) || cleanTarget.includes(cleanImg)) {
        usedUrls.add(img.url);
        return img;
      }
    }
  }

  // 2. Essai par mots-clés météo (geopotentiel, 500hpa, rafales, vent, pluie, precip, sat, radar)
  if (ps.fileName) {
    const psLower = ps.fileName.toLowerCase();
    const keywords = ["geopotentiel", "500-hpa", "500hpa", "rafale", "vent", "gust", "pluie", "precip", "rain", "cumul", "radar", "sat"];
    for (const kw of keywords) {
      if (psLower.includes(kw)) {
        for (const img of allImages) {
          if (usedUrls.has(img.url)) continue;
          if (img.name.toLowerCase().includes(kw)) {
            usedUrls.add(img.url);
            return img;
          }
        }
      }
    }
  }

  // 3. Essai direct par numéro de scène ou ref (Scène 1 -> Image 1, Scène 2 -> Image 2...)
  const directByScene = existingImagesByRef[ps.scene_number];
  if (directByScene && directByScene.url && !usedUrls.has(directByScene.url)) {
    usedUrls.add(directByScene.url);
    return directByScene;
  }

  const directByIdx = existingImagesByRef[idx + 1];
  if (directByIdx && directByIdx.url && !usedUrls.has(directByIdx.url)) {
    usedUrls.add(directByIdx.url);
    return directByIdx;
  }

  // 4. Première image disponible non encore assignée (garantit zéro doublon si N images pour N scènes)
  const firstUnused = allImages.find(img => !usedUrls.has(img.url));
  if (firstUnused) {
    usedUrls.add(firstUnused.url);
    return firstUnused;
  }

  // 5. Fallback par index modulo
  return allImages[idx % allImages.length];
}

const LAST_USER_PROMPT_SAMPLE = `=== DEBUT ARTICLE ===
TITRE SEO : Météo : retour de la pluie et d'un coup de vent dès ce mercredi sur la moitié nord de la France

CHAPEAU : Après plusieurs semaines d'accalmie anticyclonique et de sécheresse persistante, un net changement de temps s'amorce dès ce mercredi 21 octobre. Le rail océanique dépressionnaire reprend ses droits avec pluies soutenues et risque de coup de vent vendredi.

CATEGORIE : Vigilance & Intempéries

# RETOUR DE LA PLUIE ET DU VENT
# NETTE DÉGRADATION OCÉANIQUE DÈS MERCREDI SUR LA MOITIÉ NORD

Après plusieurs semaines dominées par un puissant anticyclone de blocage, la situation météorologique s'apprête à basculer radicalement sur l'Europe occidentale. Dès ce mercredi 21 octobre, les perturbations océaniques vont s'engouffrer sur la France, marquant la fin brutale de la période calme et sèche sur la moitié nord.

**Une rupture synoptique majeure orchestrée par l'Atlantique**
En altitude, un vaste creux dépressionnaire atlantique se rapproche des îles Britanniques et repousse l'anticyclone vers les Açores. Ce décrochage permet au courant d'ouest de reprendre progressivement sa place, ouvrant un véritable couloir perturbé actif jusqu'au week-end.

[IMAGE 1]

**🌧️ CHRONOLOGIE DES INTEMPÉRIES**
## Les perturbations vont balayer la France d'ouest en est
*Période : Du mercredi 21 au vendredi 23 octobre*
- **Mercredi 21 : Arrivée des premières pluies sur la Bretagne et la Normandie (15 à 30 mm)**
- **Jeudi 22 : Progression des averses vers le Bassin parisien et les Hauts-de-France**
- **Vendredi 23 : Risque d'un coup de vent soutenu le long des côtes de la Manche**
- **Cumuls globaux : 30 à 60 mm attendus sur les reliefs et littoraux exposés**

[IMAGE 2]

**💨 RISQUE DE COUP DE VENT : LES ZONES SOUS SURVEILLANCE**
Les modélisations numériques haute résolution de Météo-Climat Pro surveillent particulièrement la journée de vendredi. Un resserrement isobarique marqué pourrait provoquer des rafales de 80 à 90 km/h dans les terres et jusqu'à 100 à 110 km/h sur les caps exposés de la Manche et du Finistère.

[IMAGE 3]

| Zone géographique | Risque principal | Cumuls de pluie prévus | Rafales maximales modélisées |
| :--- | :--- | :--- | :--- |
| **Bretagne & Cotentin** | Pluie forte & vent | 30 à 50 mm | 90 à 105 km/h |
| **Hauts-de-France** | Pluie soutenue | 20 à 40 mm | 80 à 95 km/h |
| **Bassin Parisien** | Pluies régulières | 15 à 25 mm | 65 à 80 km/h |
| **Sud de la France** | Temps plus calme | 0 à 10 mm | Moins de 50 km/h |

**⚠️ Conséquences et précautions pour les chantiers et déplacements :**
Ces précipitations abondantes constituent une excellente nouvelle pour recharger les sols superficiels, mais appellent à la vigilance sur le réseau routier et pour les chantiers du BTP (arrimage des bâches et échafaudages, interruption des travaux de levage sous fortes rafales).

**FAQ MÉTÉO EXPRESS**
**1. Quand débutera l'épisode pluvieux ?**
Dès mercredi matin par la pointe bretonne, avant de traverser le pays d'ouest en est au fil des heures.

**2. Le coup de vent est-il une tempête ?**
Non, il s'agit pour l'heure d'un coup de vent automnal classique mais dynamique, à affiner selon la trajectoire exacte du centre dépressionnaire.

**En résumé**
Le calme automnal prend fin ce mercredi avec le retour du rail dépressionnaire atlantique. Pluies régulières et rafales de vent marqueront la seconde partie de semaine sur la moitié nord, apportant une hydratation bienvenue tout en nécessitant une prudence le long de la Manche.

=== FIN ARTICLE ===

SCÈNE 1
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
  // Navigation entre les deux modes
  const [activeTab, setActiveTab] = useState<'url' | 'prompt'>('url');

  // Notification Toast non-bloquante
  const [toast, setToast] = useState<ToastNotification | null>(null);

  const notify = (message: string, type: ToastNotification['type'] = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToast({ id, message, type });
    setTimeout(() => {
      setToast(curr => (curr?.id === id ? null : curr));
    }, 5000);
  };

  // Option A : Import par URL
  const [articleUrl, setArticleUrl] = useState("");
  const [importingArticle, setImportingArticle] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState("");

  // Option B : Prompt Maître / DeepSeek
  const [manualPromptText, setManualPromptText] = useState("");
  const [uploadingBatch, setUploadingBatch] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string>("auto");
  const [parsedArticle, setParsedArticle] = useState<ParsedArticleOutput | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string>("");
  const [coverImageName, setCoverImageName] = useState<string>("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [batchUploadedImages, setBatchUploadedImages] = useState<Array<{ url: string; name: string; ref: number }>>([]);
  const [publishingArticle, setPublishingArticle] = useState(false);
  const [publishedUrls, setPublishedUrls] = useState<{ meteobtp: string; monsieurmeteo: string; climatmeteo: string; slug: string } | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [showArticlePreview, setShowArticlePreview] = useState(true);
  const [generatingWithDeepseek, setGeneratingWithDeepseek] = useState(false);

  // ✏️ ÉDITION STRUCTURÉE AVANT PUBLICATION
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editExcerpt, setEditExcerpt] = useState("");
  const [editCategory, setEditCategory] = useState("Actualités Météo");
  const [editAuthor, setEditAuthor] = useState("Patrick Marlière & Météo-Climat Pro");
  const [editSlug, setEditSlug] = useState("");
  const [editBlocks, setEditBlocks] = useState<ArticleBlock[]>([]);
  const [editHistory, setEditHistory] = useState<Array<{ title: string; excerpt: string; category: string; author: string; blocks: ArticleBlock[] }>>([]);
  // Bloc de partage réseaux sociaux (TITRE PARTAGE / PARAGRAPHE PARTAGE / HASHTAGS)
  const [editSocialTitle, setEditSocialTitle] = useState("");
  const [editSocialDescription, setEditSocialDescription] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  // Posts par plateforme (Facebook / LinkedIn / TikTok / Twitter)
  const [editFacebookPost, setEditFacebookPost] = useState("");
  const [editLinkedinPost, setEditLinkedinPost] = useState("");
  const [editTiktokPost, setEditTiktokPost] = useState("");
  const [editFacebookHashtags, setEditFacebookHashtags] = useState("");
  const [editLinkedinHashtags, setEditLinkedinHashtags] = useState("");
  const [editTiktokHashtags, setEditTiktokHashtags] = useState("");
  const [editTwitterPost, setEditTwitterPost] = useState("");
  const [editTwitterHashtags, setEditTwitterHashtags] = useState("");

  /** Charge l'article parsé dans l'éditeur (à chaque nouveau parse / changement de thème). */
  const hydrateEditor = useCallback((article: ParsedArticleOutput) => {
    setEditTitle(article.title || "");
    setEditExcerpt(article.excerpt || "");
    setEditCategory(article.category || "Actualités Météo");
    setEditSlug("");
    setEditSocialTitle(article.socialTitle || "");
    setEditSocialDescription(article.socialDescription || "");
    setEditHashtags(article.hashtags || "");
    setEditFacebookPost(article.facebookPost || "");
    setEditLinkedinPost(article.linkedinPost || "");
    setEditTiktokPost(article.tiktokPost || "");
    setEditFacebookHashtags(article.facebookHashtags || "");
    setEditLinkedinHashtags(article.linkedinHashtags || "");
    setEditTiktokHashtags(article.tiktokHashtags || "");
    setEditTwitterPost(article.twitterPost || "");
    setEditTwitterHashtags(article.twitterHashtags || "");
    setEditBlocks(buildArticleBlocks(article.htmlDark));
    setEditHistory([]);
  }, []);

  /** HTML corrigé à publier : reconstruit depuis les blocs édités. */
  const editedHtml = parsedArticle
    ? applyArticleEdits(parsedArticle.htmlDark, editBlocks)
    : "";
  const hasArticleEdits = parsedArticle ? editedHtml !== parsedArticle.htmlDark : false;

  // Configuration Principale
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

  // Auto-détection intelligente du Sujet & Phénomène
  const [autoDetectedBadge, setAutoDetectedBadge] = useState<string | null>(null);
  const [detectingDailyTopic, setDetectingDailyTopic] = useState(false);

  const autoDetectAndUpdateMetadata = (text: string) => {
    if (!text || text.trim().length < 15) return;
    const clean = text.trim();

    // 1. Titre extraction
    let detectedTitle = "";
    const seoMatch = clean.match(/(?:TITRE\s*SEO|TITRE\s*DE\s*L['’]ARTICLE|TITRE|SUJET)\s*:\s*([^\n\r]+)/i);
    if (seoMatch && seoMatch[1]) {
      detectedTitle = seoMatch[1].replace(/^\*\*|\*\*$/g, "").replace(/^["«]|["»]$/g, "").trim();
    } else {
      const h1Match = clean.match(/(?:^|\n)#+\s+([^\n\r]+)/);
      if (h1Match && h1Match[1] && !h1Match[1].toUpperCase().includes("DEBUT ARTICLE") && !h1Match[1].toUpperCase().includes("SCÈNE") && !h1Match[1].toUpperCase().includes("SCENE")) {
        detectedTitle = h1Match[1].replace(/^\*\*|\*\*$/g, "").replace(/^["«]|["»]$/g, "").trim();
      }
    }

    if (detectedTitle && detectedTitle.length >= 5) {
      setTopic(detectedTitle);
    }

    // 2. Phénomène météo détection
    const lower = clean.toLowerCase();
    let matchedPhenomenon = "";

    if (/cévenol|cevenol|cévennes|cevennes|méditerranéen|mediterraneen|gard|hérault|herault|ardèche|ardeche|vaucluse/.test(lower)) {
      matchedPhenomenon = "Épisode méditerranéen / Cévenol";
    } else if (/coup de vent|tempête|tempete|rafales?|bourrasque|vent violent|vent fort|depression atlantique|dépression atlantique|vents d['’]ouest/.test(lower)) {
      matchedPhenomenon = "Tempête / Coup de vent violent";
    } else if (/canicule|dôme de chaleur|dome de chaleur|vague de chaleur|chaleur extrême|forte chaleur|torride|record de chaleur/.test(lower)) {
      matchedPhenomenon = "Canicule / Vague de chaleur";
    } else if (/orages? violents?|grêle|grele|supercellule|impacts? de foudre|foudre|tonnerre/.test(lower)) {
      matchedPhenomenon = "Orages violents / Grêle";
    } else if (/neige|verglas|grand froid|polaire|gelée|blizzard/.test(lower)) {
      matchedPhenomenon = "Neige / Verglas / Grand froid";
    } else if (/inondations?|crues?|ruissellement|lame d['’]eau|pluies diluviennes|trombes d['’]eau/.test(lower)) {
      matchedPhenomenon = "Inondations / Crues majeures";
    } else if (/sécheresse|secheresse|feux de forêt|incendies?|déficit en eau|déficit pluviométrique/.test(lower)) {
      matchedPhenomenon = "Sécheresse / Risque feux de forêt";
    } else if (/cyclone|ouragan|typhon|dépression tropicale/.test(lower)) {
      matchedPhenomenon = "Cyclone / Tempête tropicale";
    } else if (/poussières du sahara|poussiere du sahara|sable du sahara|particules fines/.test(lower)) {
      matchedPhenomenon = "Poussières du Sahara / Qualité de l'air";
    } else if (/point météo|point meteo|tendance 7 jours|tendance hebdomadaire|modélisations?/.test(lower)) {
      matchedPhenomenon = "Point Météo Hebdomadaire 7 jours";
    } else if (/pluies?|perturbations?|front pluvieux/.test(lower)) {
      if (/vent/.test(lower)) {
        matchedPhenomenon = "Tempête / Coup de vent violent";
      } else {
        matchedPhenomenon = "Inondations / Crues majeures";
      }
    }

    if (matchedPhenomenon) {
      setPhenomenon(matchedPhenomenon);
      setIsCustomPhenomenon(false);
    }

    // 3. Durée cible détection
    const sceneMatches = clean.match(/(?:^|\n)\s*(?:#+\s*|\*\*)*SC[ÈE]NE\s+\d+/gi);
    if (sceneMatches && sceneMatches.length >= 2) {
      const voiceLines = clean.match(/(?:voix off|script|texte|charon)\s*:\s*([^\n]+)/gi);
      let wordCount = 0;
      if (voiceLines) {
        wordCount = voiceLines.join(" ").split(/\s+/).length;
      } else {
        wordCount = Math.round(clean.split(/\s+/).length * 0.25);
      }
      if (wordCount < 140) {
        setTargetDuration(45);
      } else if (wordCount <= 210) {
        setTargetDuration(60);
      } else if (wordCount <= 300) {
        setTargetDuration(90);
      } else {
        setTargetDuration(120);
      }
    }

    if (detectedTitle || matchedPhenomenon) {
      const info = `Auto-détecté : ${matchedPhenomenon || "Titre extrait"}`;
      setAutoDetectedBadge(info);
      notify(`🪄 Auto-détection : ${matchedPhenomenon || "Titre extrait"} !`, "info");
      setTimeout(() => setAutoDetectedBadge(null), 7000);
    }
  };

  const handleFetchDailyTopic = async () => {
    setDetectingDailyTopic(true);
    notify("Détection de l'actualité météo du jour...", "info");
    try {
      const res = await fetch("/api/daily-weather-topic");
      if (!res.ok) throw new Error("Erreur lors de la détection de l'actualité");
      const data = await res.json();
      if (data.phenomenon) {
        setPhenomenon(data.phenomenon);
        setIsCustomPhenomenon(false);
      }
      if (data.topic) {
        setTopic(data.topic);
      }
      if (data.target_duration) {
        setTargetDuration(data.target_duration);
      }
      const badgeText = `Actualité du jour : ${data.phenomenon}`;
      setAutoDetectedBadge(badgeText);
      notify(`⚡ Actualité du jour : "${data.topic}" !`, "success");
      addArticleLog(`⚡ Actualité du jour détectée : [${data.phenomenon}] "${data.topic}"`, "success");
      setTimeout(() => setAutoDetectedBadge(null), 8000);
    } catch (err: any) {
      notify(err.message || "Erreur lors de la détection", "warning");
    } finally {
      setDetectingDailyTopic(false);
    }
  };

  // Régie Vidéo & Rendu
  const [generatingScript, setGeneratingScript] = useState(false);
  const [rendering, setRendering] = useState(false);
  // Intervalles de la régie (polling) : conservés en refs pour pouvoir
  // stopper l'attente depuis le bouton « Arrêter l'attente ».
  const renderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const renderPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [renderStatus, setRenderStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [progressStep, setProgressStep] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [resultTiktok, setResultTiktok] = useState<string | null>(null);
  const [resultLandscape, setResultLandscape] = useState<string | null>(null);

  // Journal Régie Vidéo
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Journal Rédaction & Déploiement d'Actualités
  const [articleLogs, setArticleLogs] = useState<ArticleLogEntry[]>([]);
  const [articleElapsedSeconds, setArticleElapsedSeconds] = useState(0);
  const [articleProgressPercent, setArticleProgressPercent] = useState(0);
  const [articleActionRunning, setArticleActionRunning] = useState(false);
  const [articleActionStatus, setArticleActionStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [articleActionTitle, setArticleActionTitle] = useState("");
  const articleLogsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (articleLogsContainerRef.current) {
      articleLogsContainerRef.current.scrollTop = articleLogsContainerRef.current.scrollHeight;
    }
  }, [articleLogs]);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addArticleLog = (text: string, type: ArticleLogEntry['type'] = 'info') => {
    const d = new Date();
    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    setArticleLogs(prev => [
      ...prev,
      {
        id: `alog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        time,
        text,
        type
      }
    ]);
  };

  const handleResetAll = useCallback((silent: boolean | React.MouseEvent = false) => {
    setArticleUrl("");
    setManualPromptText("");
    setTopic("");
    setNotes("");
    setImportSuccessMessage("");
    setScenes(createEmptyScenes(5));
    setParsedArticle(null);
    setIsEditMode(false);
    setEditTitle("");
    setEditExcerpt("");
    setEditCategory("Actualités Météo");
    setEditSlug("");
    setEditBlocks([]);
    setEditHistory([]);
    setEditSocialTitle("");
    setEditSocialDescription("");
    setEditHashtags("");
    setEditFacebookPost("");
    setEditLinkedinPost("");
    setEditTiktokPost("");
    setEditFacebookHashtags("");
    setEditLinkedinHashtags("");
    setEditTiktokHashtags("");
    setEditTwitterPost("");
    setEditTwitterHashtags("");
    setCoverImageUrl("");
    setCoverImageName("");
    setBatchUploadedImages([]);
    setPublishedUrls(null);
    setResultTiktok(null);
    setResultLandscape(null);
    setLogs([]);
    setArticleLogs([]);
    setArticleProgressPercent(0);
    setArticleElapsedSeconds(0);
    setArticleActionStatus('idle');
    setRenderStatus('idle');
    setSessionId(null);
    setPhenomenon(PHENOMENONS[0]);
    setCustomPhenomenon("");
    setIsCustomPhenomenon(false);
    setTargetDuration(60);
    setSelectedThemeId("auto");
    setAutoDetectedBadge(null);
    setPromptCopied(false);

    try {
      if (typeof window !== "undefined") {
        window.localStorage?.clear();
        window.sessionStorage?.clear();
      }
    } catch {}

    if (silent !== true) {
      notify("Studio réinitialisé avec succès.", "info");
    }
  }, []);

  // 🧹 SUPPRESSION SYSTÉMATIQUE DU CACHE ET RÉINITIALISATION TOTALE À CHAQUE OUVERTURE DU SITE
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        // 1. Purge intégrale de tout stockage local navigateur
        window.localStorage?.clear();
        window.sessionStorage?.clear();

        // 2. Vider les caches CacheStorage du navigateur
        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          }).catch(() => {});
        }

        // 3. Désenregistrer d'éventuels Service Workers résiduels
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((r) => r.unregister());
          }).catch(() => {});
        }

        // 4. Vider les valeurs de formulaires restaurées par le navigateur (bfcache / session restore)
        document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
          "textarea, input[type='text'], input[type='url']"
        ).forEach((el) => {
          el.value = "";
        });
      }
    } catch {}

    // 5. Réinitialisation complète de tous les états (zéro voix off mémorisée, scènes vierges)
    handleResetAll(true);

    // 6. Écouter également l'événement pageshow pour vider si l'utilisateur revient en arrière
    const handlePageShow = (e: PageTransitionEvent) => {
      try {
        window.localStorage?.clear();
        window.sessionStorage?.clear();
      } catch {}
      handleResetAll(true);
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      if (renderTimerRef.current) clearInterval(renderTimerRef.current);
      if (renderPollRef.current) clearInterval(renderPollRef.current);
    };
  }, [handleResetAll]);

  /**
   * Estime la durée cumulée des GIF animés présents dans les scènes.
   * Un GIF dure ≈ (nombre de blocs image) secondes pour nos cartes de
   * prévision (1 image = 1 heure d'échéance). L'extension `.gif` suffit ici :
   * le moteur Python mesure ensuite la durée réelle avec ffprobe.
   */
  const estimateAnimationSeconds = useCallback((): { seconds: number; count: number } => {
    const gifScenes = scenes.filter(s => (s.file_url || "").toLowerCase().split("?")[0].endsWith(".gif"));
    if (gifScenes.length === 0) return { seconds: 0, count: 0 };
    // Sans métadonnées côté navigateur, on applique la durée moyenne constatée
    // sur nos lots AROME (30 images ≈ 30 s).
    const DEFAULT_GIF_SECONDS = 30;
    return { seconds: gifScenes.length * DEFAULT_GIF_SECONDS, count: gifScenes.length };
  }, [scenes]);

  /**
   * Import d'un fichier .txt / .md produit par ChatGPT.
   * Plus fiable qu'un copier-coller (pas de caractères invisibles) et
   * l'encodage est détecté puis normalisé.
   *
   * NOTE : `handleParseManualPrompt` est déclaré plus bas (const, donc non
   * hissé). On passe par une ref pour éviter une ReferenceError si l'import
   * est déclenché avant que la déclaration soit évaluée.
   */
  const parsePromptRef = useRef<((text: string, options?: { silent?: boolean; imagesOverride?: Array<{ url: string; name: string; ref: number }> }) => Promise<unknown>) | null>(null);

  const handleImportTextFile = async (file: File) => {
    if (!isSupportedTextFile(file.name)) {
      notify(`Format non supporté : « ${file.name} ». Utilisez un fichier .txt ou .md.`, "warning");
      return;
    }
    try {
      addArticleLog(`📂 Lecture du fichier « ${file.name} »...`, "info");
      const { text, encoding, converted } = await readTextFile(file);

      setManualPromptText(text);
      autoDetectAndUpdateMetadata(text);
      addArticleLog(
        `✅ Fichier lu : ${text.length.toLocaleString("fr-FR")} caractères` +
          (converted ? ` (converti depuis ${encoding})` : ` (${encoding})`),
        "success"
      );
      if (!parsePromptRef.current) {
        throw new Error("Le moteur d'analyse n'est pas encore prêt.");
      }
      await parsePromptRef.current(text, { silent: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lecture impossible";
      addArticleLog(`❌ ${msg}`, "error");
      notify(msg, "error");
    }
  };

  const handleCopyMasterPrompt = async () => {
    try {
      // Le prompt V2 est fourni par l'utilisateur et repris tel quel : les
      // publications sociales sont désormais affichées dans le CHAT ChatGPT,
      // pas dans le fichier .txt. Le calibrage dynamique (durée, scènes, GIF)
      // reste appliqué en remplaçant les valeurs fixes du bloc CALIBRAGE.
      const anim = estimateAnimationSeconds();
      const budget = buildPromptBudget({
        targetDuration,
        sceneCount: scenes.length,
        animationSeconds: anim.seconds,
        animationCount: anim.count,
      });
      const prompt = MASTER_PROMPT_V2
        .replace(
          /- Total des 5 voix off : \*\*166 à 176 mots\*\* \(cible : 171 mots\)\./,
          `- Total des ${scenes.length} voix off : **${budget.minWords} à ${budget.maxWords} mots** (cible : ${budget.totalWords} mots).`
        )
        .replace(
          /- Durée visée : environ \*\*60 secondes\*\*/,
          `- Durée visée : environ **${Math.round(budget.effectiveDuration)} secondes**`
        )
        .replace(
          /8\. Les 5 voix off totalisent 166 à 176 mots/,
          `8. Les ${scenes.length} voix off totalisent ${budget.minWords} à ${budget.maxWords} mots`
        );

      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 3000);
      const animInfo = anim.count > 0
        ? ` (${anim.count} GIF ≈ ${Math.round(anim.seconds)}s pris en compte)`
        : "";
      addArticleLog(`📋 Prompt Maître V2 copié : ${targetDuration}s / ${scenes.length} scènes${animInfo}. Les posts sociaux seront dans le CHAT.`, "success");
      notify(`Prompt Maître V2 copié (${targetDuration}s, ${scenes.length} scènes) !`, "success");
    } catch {
      notify("Veuillez copier le texte du prompt manuellement.", "warning");
    }
  };

  // 🤖 GÉNÉRATION DIRECTE AVEC DEEPSEEK V4.1 FLASH (OpenRouter)
  const handleGenerateWithDeepseek = async () => {
    const rawToUse = manualPromptText.trim() || notes.trim() || topic.trim() || effectivePhenomenon;
    if (!rawToUse) {
      notify("Veuillez saisir des notes, un sujet ou du texte brut avant de lancer DeepSeek.", "warning");
      return;
    }
    const tStart = Date.now();
    setGeneratingWithDeepseek(true);
    setArticleActionRunning(true);
    setArticleActionStatus('running');
    setArticleActionTitle("Rédaction DeepSeek V4.1 Flash");
    setArticleProgressPercent(15);
    setArticleElapsedSeconds(0);

    addArticleLog("🤖 Connexion à l'API OpenRouter (Modèle : deepseek/deepseek-v4.1-flash-1017)...", "ia");
    addArticleLog("📜 Chargement du Prompt Maître Officiel ACTUBTP (Règle Zéro Média externe, Météo-Climat Pro)...", "info");
    addArticleLog(`⏱️ Calibrage vidéo : ${targetDuration}s (~${Math.round(targetDuration * 2.9)} mots ciblés pour les scènes)`, "info");
    addArticleLog(`🎯 Sujet analysé : "${rawToUse.slice(0, 90)}${rawToUse.length > 90 ? '...' : ''}"`, "info");

    const timer = setInterval(() => {
      setArticleElapsedSeconds(Math.floor((Date.now() - tStart) / 1000));
    }, 1000);

    const progTimer = setInterval(() => {
      setArticleProgressPercent(prev => (prev < 85 ? prev + 10 : prev));
    }, 2000);

    try {
      addArticleLog(`⏳ Rédaction journalistique en cours (titre SEO, chapeau, corps 500 mots, ${scenes.length} scènes calibrées)...`, "ia");
      const animForPrompt = estimateAnimationSeconds();
      const res = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawToUse,
          phenomenon: effectivePhenomenon,
          topic,
          notes,
          target_duration: targetDuration,
          scene_count: scenes.length,
          animation_seconds: animForPrompt.seconds,
          animation_count: animForPrompt.count
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de génération.");

      clearInterval(progTimer);
      setArticleProgressPercent(90);
      addArticleLog(`📥 Réponse reçue de DeepSeek V4.1 Flash (${data.content?.length || 0} caractères) !`, "ia");

      setManualPromptText(data.content);
      await handleParseManualPrompt(data.content, { silent: true });

      setArticleProgressPercent(100);
      setArticleActionStatus('success');
      addArticleLog("✨ Article et Scènes rédigés et mis en page avec succès ! Prêt à être publié sur les 3 sites.", "success");
      addArticleLog("👉 Cliquez ci-dessous sur '🚀 Charger & Publier DIRECTEMENT sur les 3 sites' pour mettre en ligne.", "publish");
      notify("✨ Article et scènes rédigés avec succès par DeepSeek V4.1 !", "success");
    } catch (e: any) {
      setArticleActionStatus('error');
      addArticleLog(`❌ Erreur DeepSeek : ${e.message}`, "error");
      notify(e.message || "Erreur lors de l'appel à DeepSeek.", "error");
    } finally {
      clearInterval(timer);
      clearInterval(progTimer);
      setGeneratingWithDeepseek(false);
      setArticleActionRunning(false);
    }
  };

  // UPLOAD COUVERTURE 16:9
  /**
   * Téléverse un fichier via la route serveur /api/upload-scene.
   * L'écriture directe depuis le navigateur est fermée : seuls la clé
   * service_role (côté serveur) et le studio peuvent désormais écrire.
   *
   * Au-delà de PROXY_LIMIT, on passe par une URL signée : les fonctions Vercel
   * (plan Hobby) refusent un corps > ~4 Mo, ce qui faisait échouer les cartes
   * AROME HD et les GIF lourds par un HTTP 413 avant même notre code.
   */
  const PROXY_LIMIT = 3 * 1024 * 1024; // 3 Mo : marge sous la limite Vercel

  const uploadViaSignedUrl = async (file: File, remotePath: string): Promise<string> => {
    const signRes = await fetch("/api/upload-sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: remotePath })
    });
    const sign = await signRes.json().catch(() => ({}));
    if (!signRes.ok) {
      throw new Error(sign?.error || `Signature refusée (HTTP ${signRes.status})`);
    }

    // Envoi direct navigateur -> Supabase : aucun octet ne traverse Vercel.
    const putRes = await fetch(sign.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file
    });
    if (!putRes.ok) {
      const detail = await putRes.text().catch(() => "");
      throw new Error(`Téléversement direct refusé (HTTP ${putRes.status}) ${detail.slice(0, 120)}`);
    }
    return sign.public_url as string;
  };

  const uploadSceneFile = async (file: File, remotePath: string): Promise<string> => {
    if (file.size > PROXY_LIMIT) {
      return uploadViaSignedUrl(file, remotePath);
    }

    const form = new FormData();
    form.append("file", file);
    form.append("path", remotePath);

    const res = await fetch("/api/upload-scene", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));

    // Repli automatique : si Vercel rejette le corps (413) malgré la marge,
    // on bascule sur l'URL signée plutôt que d'échouer.
    if (res.status === 413) {
      return uploadViaSignedUrl(file, remotePath);
    }
    if (!res.ok) {
      throw new Error(data?.error || `Téléversement refusé (HTTP ${res.status})`);
    }
    return data.url as string;
  };

  const handleCoverUpload = async (file: File) => {
    const sId = sessionId || `session_${Date.now()}`;
    if (!sessionId) setSessionId(sId);
    setUploadingCover(true);
    addArticleLog(`📸 Téléversement de la photo de couverture 16:9 : "${file.name}"...`, "images");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const remotePath = `blog/${Date.now()}_couverture_${safeName}`;
      const pubUrl = await uploadSceneFile(file, remotePath);
      setCoverImageUrl(pubUrl);
      setCoverImageName(file.name);

      // Auto-assignation directe de la couverture en Scène 1 (Hook d'ouverture)
      setScenes(prev => {
        if (!prev || prev.length === 0) return prev;
        const copy = [...prev];
        copy[0] = {
          ...copy[0],
          file_url: pubUrl,
          file_name: file.name,
          image_hint: copy[0].image_hint || "Photo de couverture 16:9"
        };
        return copy;
      });

      addArticleLog(`✓ Photo de couverture enregistrée sur Supabase Storage.`, "success");
      addArticleLog(`🎬 Photo de couverture automatiquement assignée à la Scène 1 (Hook d'ouverture).`, "images");
      notify("Photo de couverture 16:9 enregistrée et assignée à la Scène 1 !", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de l'envoi de la photo de couverture.";
      addArticleLog(`❌ ${msg}`, "error");
      notify(msg, "error");
    } finally {
      setUploadingCover(false);
    }
  };

  // PUBLICATION DE L'ACTUALITÉ SUR LES 3 SITES (0-BUILD)
  const handlePublishArticle = async (articleToPublish?: ParsedArticleOutput | null) => {
    const source = articleToPublish || parsedArticle;
    // Quand l'article courant est celui affiché, on publie la version ÉDITÉE
    // (titre, chapeau, catégorie et texte corrigés dans l'éditeur).
    const isCurrent = !articleToPublish || articleToPublish === parsedArticle;
    const publishTitle = isCurrent && editTitle.trim() ? editTitle.trim() : (source?.title || "");
    const publishHtml = isCurrent && editBlocks.length > 0 ? editedHtml : (source?.htmlDark || "");
    const publishExcerpt = isCurrent && editExcerpt.trim() ? editExcerpt.trim() : (source?.excerpt || "");
    const publishCategory = isCurrent && editCategory.trim() ? editCategory.trim() : (source?.category || "Actualités Météo");

    if (!source || !publishTitle || !publishHtml) {
      notify("Aucun article à publier. Collez d'abord le résultat de votre Prompt IA ou rédigez avec DeepSeek.", "warning");
      return;
    }
    const tStart = Date.now();
    setPublishingArticle(true);
    setArticleActionRunning(true);
    setArticleActionStatus('running');
    setArticleActionTitle("Publication multi-sites 0-Build");
    setArticleProgressPercent(20);
    setArticleElapsedSeconds(0);

    addArticleLog("🚀 Lancement de la publication simultanée 0-Build...", "publish");
    addArticleLog(`📝 Titre : "${publishTitle}"`, "info");
    addArticleLog(`🏷️ Catégorie : ${publishCategory}`, "info");
    if (hasArticleEdits) {
      addArticleLog("✏️ Version corrigée dans l'éditeur publiée (corrections manuelles incluses).", "info");
    }

    const timer = setInterval(() => {
      setArticleElapsedSeconds(Math.floor((Date.now() - tStart) / 1000));
    }, 1000);

    try {
      setArticleProgressPercent(45);
      addArticleLog("🌐 Adaptation des styles : Dark Glass (Monsieur Météo) & Thème Clair Pro (MétéoBTP)...", "theme");
      const coverUrl = coverImageUrl || scenes[0]?.file_url || null;
      if (coverUrl) {
        addArticleLog(`📸 Photo de couverture associée : ${coverImageName || 'Couverture active'}`, "images");
      }

      // Slug stable : ré-utilisé tel quel après la première publication, ce qui
      // transforme une re-publication en MISE À JOUR au lieu d'un doublon.
      const explicitSlug = editSlug.trim() || buildArticleSlug(publishTitle, String(Math.floor(Date.now() / 1000)));

      const res = await fetch("/api/publish-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: publishTitle,
          excerpt: buildExcerpt(publishExcerpt, publishTitle),
          category: publishCategory,
          author: editAuthor.trim() || undefined,
          slug: explicitSlug,
          content_dark: publishHtml,
          image_url: coverUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de publication.");

      if (data.slug) setEditSlug(data.slug);
      setArticleProgressPercent(90);
      addArticleLog(
        data.updated
          ? "☁️ Article existant mis à jour sur Supabase (aucun doublon créé) !"
          : "☁️ Synchronisation Supabase Cloud terminée (tables meteo_posts & posts) !",
        "publish"
      );
      addArticleLog(`✨ meteobtp.fr (Thème Clair Pro) : ${data.urls.meteobtp}`, "success");
      addArticleLog(`✨ monsieurmeteo.com (Dark Glass) : ${data.urls.monsieurmeteo}`, "success");
      addArticleLog(`✨ climat-meteo.vercel.app : ${data.urls.climatmeteo}`, "success");

      setPublishedUrls({
        meteobtp: data.urls.meteobtp,
        monsieurmeteo: data.urls.monsieurmeteo,
        climatmeteo: data.urls.climatmeteo,
        slug: data.slug
      });
      setArticleProgressPercent(100);
      setArticleActionStatus('success');
      addArticleLog(`🎉 Publication instantanée 0-Build terminée avec succès ! Slug : ${data.slug}`, "success");
      setImportSuccessMessage(`🎉 Article publié avec succès sur MétéoBTP, Monsieur Météo et Climat-Météo !`);
      notify("🎉 Article publié en ligne avec succès sur les 3 sites !", "success");
    } catch (e: any) {
      setArticleActionStatus('error');
      addArticleLog(`❌ Erreur de publication : ${e.message}`, "error");
      notify(e.message || "Erreur lors de la publication.", "error");
    } finally {
      clearInterval(timer);
      setPublishingArticle(false);
      setArticleActionRunning(false);
    }
  };

  // CHARGEMENT & PUBLICATION SIMULTANÉE EN 1 CLIC SUR LES 3 SITES
  const handleLoadAndPublish = async (textOverride?: string) => {
    const raw = (textOverride ?? manualPromptText).trim();
    if (!raw) {
      notify("Veuillez coller ou rédiger l'article dans la boîte avant de publier.", "warning");
      return;
    }

    const tStart = Date.now();
    setPublishingArticle(true);
    setArticleActionRunning(true);
    setArticleActionStatus('running');
    setArticleActionTitle("Chargement & Publication 3-en-1");
    setArticleProgressPercent(15);
    setArticleElapsedSeconds(0);

    const timer = setInterval(() => {
      setArticleElapsedSeconds(Math.floor((Date.now() - tStart) / 1000));
    }, 1000);

    try {
      addArticleLog("📥 Analyse mot pour mot du texte collé...", "info");
      await new Promise(r => setTimeout(r, 150));

      const existingImagesByRef: Record<number, { url: string; name: string }> = {};
      batchUploadedImages.forEach(img => {
        existingImagesByRef[img.ref] = { url: img.url, name: img.name };
      });
      scenes.forEach((sc, idx) => {
        if (sc.file_url) {
          const refNum = sc.image_ref || idx + 1;
          if (!existingImagesByRef[refNum]) {
            existingImagesByRef[refNum] = { url: sc.file_url, name: sc.file_name || `Image_${refNum}` };
          }
        }
      });

      const activeTheme = selectedThemeId === "auto"
        ? detectBestArticleTheme(raw)
        : (ARTICLE_THEMES.find(t => t.id === selectedThemeId) || ARTICLE_THEMES[0]);
      addArticleLog(`🎨 Thème visuel sélectionné : ${activeTheme.name}`, "theme");
      setArticleProgressPercent(35);
      await new Promise(r => setTimeout(r, 150));

      const art = buildWordForWordArticleHtml(raw, activeTheme, existingImagesByRef);
      if (art) {
        setParsedArticle(art);
        hydrateEditor(art);
        if (art.title) setTopic(art.title);
        addArticleLog(`📰 Article web structuré mot pour mot : "${art.title}"`, "success");
        addArticleLog(`🏷️ Catégorie : ${art.category} • Chapeau : "${art.excerpt?.slice(0, 80)}..."`, "info");
      }

      // Parser les scènes avec le moteur broadcast universel
      const parsedVideoScenes = parseFullVideoScript(raw);
      if (parsedVideoScenes.length >= 2) {
        const usedUrls = new Set<string>();
        const coverObj = coverImageUrl ? { url: coverImageUrl, name: coverImageName } : undefined;
        const parsedScenes: Scene[] = parsedVideoScenes.map((ps, idx) => {
          const matched = matchImageForScene(ps, idx, existingImagesByRef, scenes[idx], usedUrls, coverObj);
          return {
            scene_number: ps.scene_number,
            badge: ps.badge,
            badge_color: getBadgeColor(ps.badge, idx),
            title: ps.title,
            sub: ps.sub,
            location_tag: ps.location_tag,
            ticker: ps.ticker,
            script_text: ps.script_text,
            file_url: matched.url,
            file_name: matched.name,
            image_ref: ps.scene_number,
            image_hint: ps.fileName
          };
        });
        setScenes(parsedScenes);
        addArticleLog(`🎬 ${parsedScenes.length} scènes vidéo broadcast synchronisées avec titre, badge, bandeau et voix off Charon.`, "success");

        // 1 visuel = 1 scène : complète si le script cite moins de scènes que
        // de cartes fournies, pour qu'aucune carte ne reste invisible.
        const completion = completeScenesWithImages({
          parsed: parsedScenes,
          images: Object.entries(existingImagesByRef)
            .filter(([, img]) => img?.url)
            .map(([ref, img]) => ({ url: img.url, name: img.name, ref: Number(ref) })),
          maxScenes: MAX_SCENES,
          emptyScenes: createEmptyScenes
        });
        if (completion.added > 0) {
          setScenes(completion.scenes);
          addArticleLog(
            `➕ ${completion.added} scène(s) ajoutée(s) pour afficher les cartes non citées par le script (${completion.scenes.length} scènes au total).`,
            "images"
          );
        }
        if (completion.ignoredImages > 0) {
          addArticleLog(
            `⚠️ ${completion.ignoredImages} carte(s) non utilisée(s) : plafond de ${MAX_SCENES} scènes atteint.`,
            "info"
          );
        }
      } else if (art) {
        // Auto-création des scènes broadcast si ChatGPT s'est arrêté à la fin de l'article (zéro texte en dur, dérivé de l'article)
        const usedUrls = new Set<string>();
        const autoScenes: Scene[] = [
          {
            scene_number: 1,
            badge: (art.category || "ACTUALITÉ MÉTÉO").slice(0, 24).toUpperCase(),
            badge_color: BADGE_PRESETS[0].color,
            title: (art.title || "BULLETIN MÉTÉO").slice(0, 32).toUpperCase(),
            sub: (art.category || "PRÉVISIONS").slice(0, 32).toUpperCase(),
            location_tag: "FRANCE",
            ticker: (art.excerpt || art.title || "").slice(0, 75),
            script_text: (art.excerpt || art.title || "").slice(0, 160),
            file_url: existingImagesByRef[1]?.url || "",
            file_name: existingImagesByRef[1]?.name || "",
            image_ref: 1
          },
          {
            scene_number: 2,
            badge: "ANALYSE SYNOPTIQUE",
            badge_color: BADGE_PRESETS[1].color,
            title: "SITUATION GÉNÉRALE",
            sub: "MODÉLISATION NUMÉRIQUE",
            location_tag: "FRANCE & EUROPE",
            ticker: (art.excerpt || "").slice(0, 75),
            script_text: "",
            file_url: existingImagesByRef[2]?.url || "",
            file_name: existingImagesByRef[2]?.name || "",
            image_ref: 2
          },
          {
            scene_number: 3,
            badge: "CHRONOLOGIE",
            badge_color: BADGE_PRESETS[2].color,
            title: "ÉVOLUTION PRÉVUE",
            sub: "PROCHAINES 48 HEURES",
            location_tag: "RÉGIONS CONCERNÉES",
            ticker: "Suivi météorologique haute résolution.",
            script_text: "",
            file_url: existingImagesByRef[3]?.url || existingImagesByRef[1]?.url || "",
            file_name: existingImagesByRef[3]?.name || existingImagesByRef[1]?.name || "",
            image_ref: 3
          },
          {
            scene_number: 4,
            badge: "POINTS D'ATTENTION",
            badge_color: BADGE_PRESETS[3].color,
            title: "IMPACTS & RISQUES",
            sub: "ZONES SOUS VIGILANCE",
            location_tag: "SECTEURS EXPOSÉS",
            ticker: "Prudence sur les chantiers et réseaux routiers.",
            script_text: "",
            file_url: existingImagesByRef[2]?.url || existingImagesByRef[1]?.url || "",
            file_name: existingImagesByRef[2]?.name || existingImagesByRef[1]?.name || "",
            image_ref: 2
          },
          {
            scene_number: 5,
            badge: "PRUDENCE & SUIVI",
            badge_color: BADGE_PRESETS[4].color,
            title: "ÉVOLUTION À SUIVRE",
            sub: "BULLETINS ACTUALISÉS",
            location_tag: "TOUTES RÉGIONS",
            ticker: "Restez connectés avec METEO CLIMAT PRO.",
            script_text: "Restez informés de l'évolution avec METEO CLIMAT PRO.",
            file_url: "",
            file_name: "",
            image_ref: 5
          }
        ].map((sc, i) => {
          const coverObj = coverImageUrl ? { url: coverImageUrl, name: coverImageName } : undefined;
          const matched = matchImageForScene({ scene_number: sc.scene_number }, i, existingImagesByRef, scenes[i], usedUrls, coverObj);
          return {
            ...sc,
            file_url: matched.url,
            file_name: matched.name
          };
        });
        setScenes(autoScenes);
        addArticleLog(`🎬 ${autoScenes.length} scènes vidéo adaptées automatiquement à partir de l'article pour votre régie vidéo.`, "success");
      }

      setArticleProgressPercent(55);
      await new Promise(r => setTimeout(r, 150));

      // Si le texte ne contenait que les scènes et pas d'article web complet
      if (!art || !art.title || !art.htmlDark) {
        setArticleProgressPercent(100);
        setArticleActionStatus('success');
        addArticleLog("ℹ️ Scènes vidéo prêtes pour la régie vidéo (aucun texte d'article web complet détecté).", "info");
        addArticleLog("💡 Pour publier également un article web sur les 3 sites, collez le texte contenant l'article (avec === DEBUT ARTICLE ===) ou utilisez 'Rédiger avec DeepSeek'.", "info");
        notify("🎬 Les scènes vidéo ont été synchronisées dans le studio ! (Pour publier un article web sur les 3 sites, utilisez DeepSeek ou le format d'article complet).", "info");
        return;
      }

      // Envoi vers Supabase Cloud
      setArticleProgressPercent(70);
      addArticleLog("🌐 Déploiement en cours sur meteobtp.fr, monsieurmeteo.com et climat-meteo.vercel.app...", "publish");
      const coverUrl = coverImageUrl || scenes[0]?.file_url || null;
      if (coverUrl) {
        addArticleLog(`📸 Photo de couverture associée : ${coverImageName || 'Couverture active'}`, "images");
      }

      const res = await fetch("/api/publish-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: art.title,
          excerpt: art.excerpt,
          category: art.category,
          content_dark: art.htmlDark,
          image_url: coverUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de publication.");

      setArticleProgressPercent(90);
      addArticleLog("☁️ Synchronisation Supabase Cloud terminée (meteo_posts & posts) !", "publish");
      addArticleLog(`✨ meteobtp.fr : ${data.urls.meteobtp}`, "success");
      addArticleLog(`✨ monsieurmeteo.com : ${data.urls.monsieurmeteo}`, "success");
      addArticleLog(`✨ climat-meteo.vercel.app : ${data.urls.climatmeteo}`, "success");

      setPublishedUrls({
        meteobtp: data.urls.meteobtp,
        monsieurmeteo: data.urls.monsieurmeteo,
        climatmeteo: data.urls.climatmeteo,
        slug: data.slug
      });
      setArticleProgressPercent(100);
      setArticleActionStatus('success');
      addArticleLog(`🎉 Article publié avec succès en Zéro-Build ! Slug : ${data.slug}`, "success");
      setImportSuccessMessage(`🎉 Article publié avec succès sur MétéoBTP, Monsieur Météo et Climat-Météo !`);
      notify("🎉 Article publié en ligne avec succès sur les 3 sites !", "success");
    } catch (e: any) {
      setArticleActionStatus('error');
      addArticleLog(`❌ Erreur de publication : ${e.message}`, "error");
      notify(e.message || "Erreur lors de la publication.", "error");
    } finally {
      clearInterval(timer);
      setPublishingArticle(false);
      setArticleActionRunning(false);
    }
  };

  // Re-formater l'article à la volée quand l'utilisateur change de thème
  const handleThemeChange = (newThemeId: string) => {
    setSelectedThemeId(newThemeId);
    if (parsedArticle && manualPromptText) {
      const existingImagesByRef: Record<number, { url: string; name: string }> = {};
      batchUploadedImages.forEach(img => {
        existingImagesByRef[img.ref] = { url: img.url, name: img.name };
      });
      scenes.forEach((sc, idx) => {
        if (sc.file_url) {
          const refNum = sc.image_ref || idx + 1;
          if (!existingImagesByRef[refNum]) {
            existingImagesByRef[refNum] = { url: sc.file_url, name: sc.file_name || `Image_${refNum}` };
          }
        }
      });
      const activeTheme = newThemeId === "auto"
        ? detectBestArticleTheme(manualPromptText)
        : (ARTICLE_THEMES.find(t => t.id === newThemeId) || ARTICLE_THEMES[0]);
      const reParsed = buildWordForWordArticleHtml(manualPromptText, activeTheme, existingImagesByRef);
      if (reParsed) {
        // Les corrections textuelles saisies par l'utilisateur sont conservées :
        // on réapplique ses modifications de texte sur le nouveau thème visuel.
        const usersEdits = editBlocks
          .filter(b => b.text !== b.original)
          .map(b => ({ label: b.label, text: b.text }));
        let repaired = reParsed;
        if (usersEdits.length > 0) {
          const freshBlocks = buildArticleBlocks(reParsed.htmlDark).map(fb => {
            const match = usersEdits.find(u => u.label === fb.label);
            return match ? { ...fb, text: match.text } : fb;
          });
          repaired = { ...reParsed, htmlDark: applyArticleEdits(reParsed.htmlDark, freshBlocks) };
          notify(`🎨 Thème « ${activeTheme.badge} » appliqué, ${usersEdits.length} correction(s) conservée(s).`, "info");
        }
        setParsedArticle(repaired);
        setEditBlocks(buildArticleBlocks(repaired.htmlDark));
        setEditTitle(repaired.title || "");
        setEditExcerpt(repaired.excerpt || "");
        setEditCategory(repaired.category || "Actualités Météo");
      }
    }
  };

  // PARSEUR UNIVERSEL 1-CLIC DU RÉSULTAT DE PROMPT IA
  const handleParseManualPrompt = async (
    textOverride?: string,
    options?: {
      silent?: boolean;
      imagesOverride?: Array<{ url: string; name: string; ref?: number }>;
    }
  ): Promise<ParsedArticleOutput | null> => {
    const raw = (textOverride ?? manualPromptText).trim();
    if (!raw) {
      notify("Veuillez coller ou rédiger l'article dans la boîte avant d'analyser.", "warning");
      return null;
    }
    if (textOverride) setManualPromptText(textOverride);

    const isSilent = options?.silent === true;
    let timer: NodeJS.Timeout | null = null;

    if (!isSilent) {
      const tStart = Date.now();
      setArticleActionRunning(true);
      setArticleActionStatus('running');
      setArticleActionTitle("Prévisualisation Mot pour Mot");
      setArticleProgressPercent(20);
      setArticleElapsedSeconds(0);

      timer = setInterval(() => {
        setArticleElapsedSeconds(Math.floor((Date.now() - tStart) / 1000));
      }, 1000);
    }

    try {
      addArticleLog("📥 Début de l'analyse du texte collé (Mode Mot pour Mot)...", "info");
      await new Promise(r => setTimeout(r, 150));

      const imageList = (options?.imagesOverride && options.imagesOverride.length > 0)
        ? options.imagesOverride
        : (batchUploadedImages && batchUploadedImages.length > 0 ? batchUploadedImages : []);

      const existingImagesByRef: Record<number, { url: string; name: string }> = {};
      imageList.forEach((img, i) => {
        const r = img.ref || i + 1;
        existingImagesByRef[r] = { url: img.url, name: img.name };
      });
      scenes.forEach((sc, idx) => {
        if (sc.file_url) {
          const refNum = sc.image_ref || idx + 1;
          if (!existingImagesByRef[refNum]) {
            existingImagesByRef[refNum] = { url: sc.file_url, name: sc.file_name || `Image_${refNum}` };
          }
        }
      });

      // A. Extraction et formatage de l'Article Web MOT POUR MOT
      const activeTheme = selectedThemeId === "auto"
        ? detectBestArticleTheme(raw)
        : (ARTICLE_THEMES.find(t => t.id === selectedThemeId) || ARTICLE_THEMES[0]);
      addArticleLog(`🎨 Thème visuel sélectionné : ${activeTheme.name}`, "theme");

      if (!isSilent) setArticleProgressPercent(45);
      await new Promise(r => setTimeout(r, 150));

      const art = buildWordForWordArticleHtml(raw, activeTheme, existingImagesByRef);
      if (art) {
        setParsedArticle(art);
        hydrateEditor(art);
        if (art.title) setTopic(art.title);
        addArticleLog(`📰 Article web structuré mot pour mot : "${art.title}"`, "success");
        addArticleLog(`🏷️ Catégorie : ${art.category} • Chapeau : "${art.excerpt?.slice(0, 80)}..."`, "info");
        const imgCount = Object.keys(existingImagesByRef).length;
        if (imgCount > 0) {
          addArticleLog(`🖼️ ${imgCount} carte(s) météo reliée(s) aux légendes de l'article`, "images");
        }
      } else {
        addArticleLog("ℹ️ Aucun bloc d'article web complet détecté (uniquement scènes vidéo).", "info");
      }

      await new Promise(r => setTimeout(r, 150));

      // B. Extraction des scènes avec le moteur broadcast universel
      const parsedVideoScenes = parseFullVideoScript(raw);
      if (parsedVideoScenes.length >= 2) {
        if (!isSilent) setArticleProgressPercent(75);
        const usedUrls = new Set<string>();
        const coverObj = coverImageUrl ? { url: coverImageUrl, name: coverImageName } : undefined;
        const parsedScenes: Scene[] = parsedVideoScenes.map((ps, idx) => {
          const matched = matchImageForScene(ps, idx, existingImagesByRef, scenes[idx], usedUrls, coverObj);
          return {
            scene_number: ps.scene_number,
            badge: ps.badge,
            badge_color: getBadgeColor(ps.badge, idx),
            title: ps.title,
            sub: ps.sub,
            location_tag: ps.location_tag,
            ticker: ps.ticker,
            script_text: ps.script_text,
            file_url: matched.url,
            file_name: matched.name,
            image_ref: ps.scene_number,
            image_hint: ps.fileName
          };
        });

        setScenes(parsedScenes);
        if (parsedScenes[0]?.title && !art?.title) setTopic(parsedScenes[0].title);
        addArticleLog(`🎬 ${parsedScenes.length} scènes vidéo broadcast synchronisées avec titre, badge, bandeau et voix off Charon.`, "success");

        // Contrôle de cohérence scènes ↔ cartes : détecte les noms mal recopiés
        // par l'IA, les cartes oubliées ou utilisées deux fois, et l'ordre.
        const uploadedList = Object.entries(existingImagesByRef)
          .filter(([, img]) => img?.url)
          .map(([ref, img]) => ({ name: img.name, ref: Number(ref) }));
        const audit = auditSceneImages(
          parsedScenes.map((s) => ({
            sceneNumber: s.scene_number,
            declaredName: s.image_hint || s.file_name || "",
            matchedName: s.file_name || "",
          })),
          uploadedList
        );
        if (audit.issues.length === 0) {
          addArticleLog(summarizeImageAudit(audit, parsedScenes.length), "images");
        } else {
          for (const issue of audit.issues) {
            addArticleLog(
              `${issue.level === "error" ? "❌" : issue.level === "warning" ? "⚠️" : "ℹ️"} ${issue.message}`,
              issue.level === "error" ? "error" : "info"
            );
          }
          if (audit.issues.some((i) => i.level === "error")) {
            notify(
              `${audit.issues.filter((i) => i.level === "error").length} incohérence(s) détectée(s) entre les scènes et les cartes — voir le journal.`,
              "warning"
            );
          }
        }

        // 1 visuel = 1 scène (règle identique au parcours "Charger & Publier").
        const completion = completeScenesWithImages({
          parsed: parsedScenes,
          images: Object.entries(existingImagesByRef)
            .filter(([, img]) => img?.url)
            .map(([ref, img]) => ({ url: img.url, name: img.name, ref: Number(ref) })),
          maxScenes: MAX_SCENES,
          emptyScenes: createEmptyScenes
        });
        if (completion.added > 0) {
          setScenes(completion.scenes);
          addArticleLog(
            `➕ ${completion.added} scène(s) ajoutée(s) pour afficher les cartes non citées par le script (${completion.scenes.length} scènes au total).`,
            "images"
          );
        }
        if (completion.ignoredImages > 0) {
          addArticleLog(
            `⚠️ ${completion.ignoredImages} carte(s) non utilisée(s) : plafond de ${MAX_SCENES} scènes atteint.`,
            "info"
          );
        }

        if (!isSilent) {
          setArticleProgressPercent(100);
          setArticleActionStatus('success');
        }

        if (art) {
          addArticleLog(`🎉 Article mot pour mot et ${parsedScenes.length} scènes vidéo prêts ! Cliquez sur 'Publier' pour mettre en ligne.`, "success");
        } else {
          addArticleLog(`⚠️ ${parsedScenes.length} scènes vidéo prêtes (aucun article web complet détecté dans le texte).`, "info");
        }
        
        const msg = art
          ? `✅ Article web complet (mot pour mot en présentation « ${activeTheme.badge} ») + ${parsedScenes.length} scènes vidéo chargés en 1 clic !`
          : `✅ Les ${parsedScenes.length} scènes vidéo ont été remplies automatiquement en 1 clic !`;
        setImportSuccessMessage(msg);
        notify(msg, "success");
        return art;
      }

      if (art) {
        // Auto-création des scènes broadcast si aucun bloc SCÈNE explicite (zéro texte en dur, dérivé de l'article)
        const usedUrls = new Set<string>();
        const autoScenes: Scene[] = [
          {
            scene_number: 1,
            badge: (art.category || "ACTUALITÉ MÉTÉO").slice(0, 24).toUpperCase(),
            badge_color: BADGE_PRESETS[0].color,
            title: (art.title || "BULLETIN MÉTÉO").slice(0, 32).toUpperCase(),
            sub: (art.category || "PRÉVISIONS").slice(0, 32).toUpperCase(),
            location_tag: "FRANCE",
            ticker: (art.excerpt || art.title || "").slice(0, 75),
            script_text: (art.excerpt || art.title || "").slice(0, 160),
            file_url: existingImagesByRef[1]?.url || "",
            file_name: existingImagesByRef[1]?.name || "",
            image_ref: 1
          },
          {
            scene_number: 2,
            badge: "ANALYSE SYNOPTIQUE",
            badge_color: BADGE_PRESETS[1].color,
            title: "SITUATION GÉNÉRALE",
            sub: "MODÉLISATION NUMÉRIQUE",
            location_tag: "FRANCE & EUROPE",
            ticker: (art.excerpt || "").slice(0, 75),
            script_text: "",
            file_url: existingImagesByRef[2]?.url || "",
            file_name: existingImagesByRef[2]?.name || "",
            image_ref: 2
          },
          {
            scene_number: 3,
            badge: "CHRONOLOGIE",
            badge_color: BADGE_PRESETS[2].color,
            title: "ÉVOLUTION PRÉVUE",
            sub: "PROCHAINES 48 HEURES",
            location_tag: "RÉGIONS CONCERNÉES",
            ticker: "Suivi météorologique haute résolution.",
            script_text: "",
            file_url: existingImagesByRef[3]?.url || existingImagesByRef[1]?.url || "",
            file_name: existingImagesByRef[3]?.name || existingImagesByRef[1]?.name || "",
            image_ref: 3
          },
          {
            scene_number: 4,
            badge: "POINTS D'ATTENTION",
            badge_color: BADGE_PRESETS[3].color,
            title: "IMPACTS & RISQUES",
            sub: "ZONES SOUS VIGILANCE",
            location_tag: "SECTEURS EXPOSÉS",
            ticker: "Prudence sur les chantiers et réseaux routiers.",
            script_text: "",
            file_url: existingImagesByRef[2]?.url || existingImagesByRef[1]?.url || "",
            file_name: existingImagesByRef[2]?.name || existingImagesByRef[1]?.name || "",
            image_ref: 2
          },
          {
            scene_number: 5,
            badge: "PRUDENCE & SUIVI",
            badge_color: BADGE_PRESETS[4].color,
            title: "ÉVOLUTION À SUIVRE",
            sub: "BULLETINS ACTUALISÉS",
            location_tag: "TOUTES RÉGIONS",
            ticker: "Restez connectés avec METEO CLIMAT PRO.",
            script_text: "Restez informés de l'évolution avec METEO CLIMAT PRO.",
            file_url: "",
            file_name: "",
            image_ref: 5
          }
        ].map((sc, i) => {
          const coverObj = coverImageUrl ? { url: coverImageUrl, name: coverImageName } : undefined;
          const matched = matchImageForScene({ scene_number: sc.scene_number }, i, existingImagesByRef, scenes[i], usedUrls, coverObj);
          return {
            ...sc,
            file_url: matched.url,
            file_name: matched.name
          };
        });
        setScenes(autoScenes);
        if (!isSilent) {
          setArticleProgressPercent(100);
          setArticleActionStatus('success');
        }
        addArticleLog(`🎉 Article web structuré mot pour mot + ${scenes.length} scènes vidéo adaptées pour la régie !`, "success");
        addArticleLog("👉 Cliquez sur '🚀 Charger & Publier DIRECTEMENT sur les 3 sites' pour mettre en ligne.", "publish");
        const msg = `✅ L'article web complet a été structuré mot pour mot dans la présentation « ${activeTheme.badge} » et ${scenes.length} scènes vidéo ont été préparées !`;
        setImportSuccessMessage(msg);
        notify(msg, "success");
        return art;
      }

      // Fallback JSON si l'utilisateur a collé le bloc JSON
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

          // 1 visuel = 1 scène : complète si le JSON décrit moins de scènes
          // que de cartes fournies.
          const completion = completeScenesWithImages({
            parsed: parsedScenes,
            images: Object.entries(existingImagesByRef)
              .filter(([, img]) => img?.url)
              .map(([ref, img]) => ({ url: img.url, name: img.name, ref: Number(ref) })),
            maxScenes: MAX_SCENES,
            emptyScenes: createEmptyScenes
          });
          if (completion.added > 0) setScenes(completion.scenes);

          const finalCount = completion.added > 0 ? completion.scenes.length : parsedScenes.length;
          const msg = `✅ ${finalCount} scènes (1 image = 1 scène) remplies automatiquement en 1 clic !`;
          setImportSuccessMessage(msg);
          notify(msg, "success");
          return null;
        }
      } catch {}

      notify("Format non reconnu. Collez le texte contenant 'SCÈNE 1 ... SCÈNE 5' ou le bloc JSON.", "warning");
      return null;
    } finally {
      if (timer) clearInterval(timer);
      if (!isSilent) {
        setArticleActionRunning(false);
      }
    }
  };

  // Expose l'analyseur pour l'import de fichier (déclaré plus haut).
  parsePromptRef.current = async (text, options) => {
    await handleParseManualPrompt(text, options);
  };

  // Auto-parsing réactif : dès que l'utilisateur colle ou tape un prompt complet avec scènes/article
  useEffect(() => {
    if (!manualPromptText || manualPromptText.trim().length < 40) return;
    const hasScript = manualPromptText.includes("SCÈNE") || manualPromptText.includes("Voix off") || manualPromptText.includes("LIVRABLE 2");
    const hasArticle = manualPromptText.includes("TITRE SEO") || manualPromptText.includes("CHAPEAU") || manualPromptText.includes("DEBUT ARTICLE");
    if (!hasScript && !hasArticle) return;

    const timer = setTimeout(() => {
      const scenesEmpty = scenes.every(s => !s.script_text.trim());
      if (scenesEmpty || !parsedArticle) {
        handleParseManualPrompt(manualPromptText, { silent: true });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [manualPromptText]);

  // IMPORT AUTOMATIQUE EN 1 CLIC DEPUIS N'IMPORTE QUEL LIEN WEB D'ARTICLE (OPTION A)
  const handleImportArticle = async (urlToFetch?: string) => {
    const targetUrl = urlToFetch || articleUrl;
    if (!targetUrl.trim()) {
      notify("Veuillez coller le lien de l'article météo.", "warning");
      return;
    }

    const currentCount = scenes.length;
    setImportingArticle(true);
    setArticleActionRunning(true);
    setArticleActionStatus('running');
    setArticleActionTitle("Import URL & Extraction Météo");
    setArticleProgressPercent(20);
    setArticleElapsedSeconds(0);
    setImportSuccessMessage("");
    setScenes(createEmptyScenes(currentCount));
    setTopic("");
    setNotes("");
    setResultTiktok(null);
    setResultLandscape(null);

    const tStart = Date.now();
    const timer = setInterval(() => {
      setArticleElapsedSeconds(Math.floor((Date.now() - tStart) / 1000));
    }, 1000);

    const progTimer = setInterval(() => {
      setArticleProgressPercent(prev => (prev < 85 ? prev + 15 : prev));
    }, 1500);

    addArticleLog(`🌐 Début de l'extraction de l'article : "${targetUrl.slice(0, 80)}${targetUrl.length > 80 ? '...' : ''}"`, "info");
    addArticleLog(`⏱️ Calibrage vidéo ciblé : ${targetDuration}s (~${Math.round(targetDuration * 2.9)} mots pour les scènes)`, "info");

    try {
      addArticleLog("🔍 Scraping haute résolution et miroir d'images vers Supabase...", "images");
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

      clearInterval(progTimer);
      setArticleProgressPercent(90);

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

      if (data.cover_image) {
        setCoverImageUrl(data.cover_image);
        setCoverImageName("Couverture importée");
      }

      if (data.scenes && Array.isArray(data.scenes) && data.scenes.length >= 2) {
        setScenes(data.scenes);
        const methodLabel = data.method_used === "supabase_direct"
          ? "Réseau Interne Supabase"
          : (data.method_used === "jina_reader" ? "Proxy IA Universel (Bypass Anti-Bot)" : "Scraping HD Direct");
        const countInfo = data.mirrored_count ? ` (${data.mirrored_count} carte(s) extraite(s))` : "";
        const msg = `🎉 Article importé via ${methodLabel} : les ${data.scenes.length} scènes${countInfo} et le script calibré sur ${targetDuration}s sont prêts !`;
        setImportSuccessMessage(msg);
        addArticleLog(msg, "success");
        notify(msg, "success");
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
        const msg = `✅ ${allImgs.length} carte(s) extraite(s) avec succès !`;
        setImportSuccessMessage(msg);
        addArticleLog(msg, "success");
        notify(msg, "success");
      }
      setArticleProgressPercent(100);
      setArticleActionStatus('success');
    } catch (e: any) {
      setArticleActionStatus('error');
      addArticleLog(`❌ Erreur d'import : ${e.message}`, "error");
      notify(e.message || "Erreur lors de l'import de l'article.", "error");
    } finally {
      clearInterval(timer);
      clearInterval(progTimer);
      setImportingArticle(false);
      setArticleActionRunning(false);
    }
  };

  // Génération du script par IA seule (sans lien)
  const handleGenerateScript = async () => {
    // Si un script est déjà présent dans la boîte texte, le resynchroniser immédiatement
    if (manualPromptText && (manualPromptText.includes("SCÈNE") || manualPromptText.includes("Voix off") || manualPromptText.includes("LIVRABLE 2"))) {
      addArticleLog(`🎬 Synchronisation instantanée des scènes à partir de votre script ChatGPT / DeepSeek (${scenes.length} scènes détectées)...`, "info");
      await handleParseManualPrompt(manualPromptText);
      notify("✨ Scènes synchronisées depuis votre script !", "success");
      return;
    }

    setGeneratingScript(true);
    notify(`Régénération du script par IA calibré sur ${targetDuration}s...`, "info");
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
        notify(`✨ ${merged.length} scènes régénérées et calibrées sur ${targetDuration}s !`, "success");
      }
    } catch {
      notify("Erreur lors de la génération du script.", "error");
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

    try {
      const publicUrl = await uploadSceneFile(file, remotePath);
      const nextScenes = scenes.map((sc, i) => {
        if (i === index) {
          return { ...sc, file_url: publicUrl, file_name: file.name };
        }
        return sc;
      });
      setScenes(nextScenes);
      notify(`Carte pour la scène ${index + 1} téléversée !`, "success");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur d'upload vers Supabase.", "error");
    }
  };

  // Upload en lot de plusieurs images
  const handleBatchFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const sId = sessionId || `session_${Date.now()}`;
    if (!sessionId) setSessionId(sId);
    setUploadingBatch(true);
    addArticleLog(`🖼️ Téléversement groupé de ${files.length} carte(s) météo vers Supabase Storage...`, "images");

    try {
      // Tolérance aux fichiers isolés : un seul refus (format exotique, fichier
      // corrompu) ne doit plus faire échouer tout le lot. On collecte les
      // réussites et on signale les échecs individuellement.
      const results = await Promise.all(
        files.map(async (file, idx) => {
          const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
          const remotePath = `renders/${sId}/batch_${idx + 1}_${Date.now()}_${safeName}`;
          try {
            const url = await uploadSceneFile(file, remotePath);
            return { ok: true as const, url, name: file.name };
          } catch (err) {
            return {
              ok: false as const,
              name: file.name,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        })
      );

      const uploaded = results.filter((r) => r.ok).map((r) => ({ url: r.url, name: r.name }));
      const failed = results.filter((r) => !r.ok);

      if (uploaded.length === 0) {
        const detail = failed.map((f) => `${f.name} : ${f.error}`).join(" • ");
        throw new Error(detail || "Aucun fichier n'a pu être téléversé.");
      }
      if (failed.length > 0) {
        addArticleLog(
          `⚠️ ${failed.length} fichier(s) ignoré(s) : ${failed.map((f) => `${f.name} (${f.error})`).join(" • ")}`,
          "error"
        );
      }

      // Détection automatique si une photo de couverture 16:9 figure dans le lot
      const coverCandidate = uploaded.find(u => /couvert|cover/i.test(u.name));
      if (coverCandidate && !coverImageUrl) {
        setCoverImageUrl(coverCandidate.url);
        setCoverImageName(coverCandidate.name);
        addArticleLog(`📸 Photo de couverture 16:9 détectée dans le lot : "${coverCandidate.name}"`, "images");
      }

      const normalize = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

      const usedUrlsInUpload = new Set<string>();

      // RÈGLE « 1 visuel = 1 scène » appliquée automatiquement : 10 cartes
      // fournies produisent 10 scènes, 3 cartes en produisent 3.
      const MAX_SCENES = resolveSceneCount({ imageCount: uploaded.length, currentCount: scenes.length });
      const targetCount = MAX_SCENES;
      const baseScenes: Scene[] = [...scenes];
      while (baseScenes.length < targetCount) {
        const n = baseScenes.length + 1;
        const preset = BADGE_PRESETS[(n - 1) % BADGE_PRESETS.length];
        baseScenes.push({
          scene_number: n,
          badge: preset.badge,
          badge_color: [...preset.color],
          title: "",
          sub: "",
          location_tag: "",
          ticker: "",
          script_text: "",
          file_url: "",
          file_name: ""
        });
      }

      const nextScenes = baseScenes.map((sc, i) => {
        // Scène 1 : prioritairement la photo de couverture si présente ou demandée
        const effectiveCover = coverCandidate || (coverImageUrl ? { url: coverImageUrl, name: coverImageName } : null);
        if (i === 0 && effectiveCover && (!sc.image_hint || /couvert|cover/i.test(sc.image_hint) || !/\.(png|jpg|jpeg|gif|webp)/i.test(sc.image_hint))) {
          usedUrlsInUpload.add(effectiveCover.url);
          return {
            ...sc,
            file_url: effectiveCover.url,
            file_name: effectiveCover.name,
            image_ref: 1,
            image_hint: sc.image_hint || "Photo de couverture 16:9"
          };
        }

        let chosen = uploaded[(sc.image_ref ? sc.image_ref - 1 : i) % uploaded.length];

        if (sc.image_hint) {
          let targetHintFile = sc.image_hint;
          const fnM = targetHintFile.match(/(?:Image\s*\d+\s*[-—–]\s*)?([^—–\n:]+\.(?:png|jpg|jpeg|gif|webp))/i);
          if (fnM) targetHintFile = fnM[1].trim();

          const normHint = normalize(targetHintFile);
          // 1. Match exact si les intitulés correspondent parfaitement
          const exactUp = uploaded.find(up => !usedUrlsInUpload.has(up.url) && normalize(up.name) === normHint);
          if (exactUp) {
            chosen = exactUp;
          } else {
            // 2. Match par mots-clés du hint
            const hintWords = normHint
              .split(/\s+/)
              .filter(w => w.length >= 3 && w !== "image" && w !== "carte" && !/^\d+$/.test(w));

            let bestScore = 0;
            for (const up of uploaded) {
              if (usedUrlsInUpload.has(up.url) && uploaded.length >= scenes.length) continue;
              const normFile = normalize(up.name.replace(/\.[^.]+$/, ""));
              const score = hintWords.filter(hw => normFile.includes(hw)).length;
              if (score > bestScore) {
                bestScore = score;
                chosen = up;
              }
            }
          }
        }

        // Si l'image a déjà été utilisée et qu'il reste des images non attribuées
        if (usedUrlsInUpload.has(chosen.url) && uploaded.length > usedUrlsInUpload.size) {
          const unused = uploaded.find(u => !usedUrlsInUpload.has(u.url));
          if (unused) chosen = unused;
        }

        usedUrlsInUpload.add(chosen.url);

        return {
          ...sc,
          file_url: chosen.url,
          file_name: chosen.name
        };
      });
      setScenes(nextScenes);

      addArticleLog(describeSceneCount(uploaded.length, nextScenes.length), "images");

      const batchWithRefs = uploaded.map((u, i) => ({ ...u, ref: i + 1 }));
      setBatchUploadedImages(batchWithRefs);
      if (!coverImageUrl && uploaded[0]) {
        setCoverImageUrl(uploaded[0].url);
        setCoverImageName(uploaded[0].name);
      }

      if (manualPromptText) {
        await handleParseManualPrompt(manualPromptText, { silent: true, imagesOverride: batchWithRefs });
      }

      addArticleLog(`✓ ${uploaded.length} carte(s) météo téléversée(s) et reliée(s) aux scènes et à l'article.`, "success");
      setImportSuccessMessage(`✅ ${uploaded.length} image(s) téléversée(s) et associées intelligemment à l'article et aux scènes !`);
      notify(`✅ ${uploaded.length} image(s) téléversée(s) et synchronisées !`, "success");
    } catch (e) {
      // Le catch masquait l'erreur réelle : on l'expose dans le journal.
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleBatchFilesUpload]", e);
      addArticleLog(`❌ Envoi groupé impossible : ${msg}`, "error");
      notify(`Envoi des images impossible : ${msg}`, "error");
    } finally {
      setUploadingBatch(false);
    }
  };

  // Ajout manuel d'une nouvelle scène
  const handleAddScene = () => {
    // La régie (/api/dispatch) refuse plus de MAX_SCENES scènes : on bloque ici
    // pour éviter un échec au moment du rendu.
    if (scenes.length >= MAX_SCENES) {
      notify(`Limite atteinte : ${MAX_SCENES} scènes maximum par bulletin.`, "warning");
      return;
    }
    const nextNum = scenes.length + 1;
    const newScene: Scene = {
      scene_number: nextNum,
      badge: "ÉVOLUTION DU PHÉNOMÈNE",
      badge_color: [30, 120, 240],
      title: "",
      sub: "",
      location_tag: "FRANCE",
      ticker: "",
      script_text: "",
      file_url: "",
      file_name: ""
    };
    setScenes([...scenes, newScene]);
    notify(`Scène ${nextNum} ajoutée.`, "info");
  };

  // Suppression d'une scène
  const handleRemoveScene = (indexToRemove: number) => {
    if (scenes.length <= 2) {
      notify("Une vidéo doit comporter au moins 2 scènes.", "warning");
      return;
    }
    const updated = scenes
      .filter((_, idx) => idx !== indexToRemove)
      .map((sc, idx) => ({
        ...sc,
        scene_number: idx + 1
      }));
    setScenes(updated);
    notify(`Scène ${indexToRemove + 1} supprimée.`, "info");
  };

  /** Débloque l'interface sans attendre la fin du rendu cloud. */
  const handleStopRender = () => {
    if (renderTimerRef.current) clearInterval(renderTimerRef.current);
    if (renderPollRef.current) clearInterval(renderPollRef.current);
    renderTimerRef.current = null;
    renderPollRef.current = null;
    setRendering(false);
    setRenderStatus('error');
    setLogs(prev => [
      ...prev,
      {
        id: `stop_${Date.now()}`,
        time: new Date().toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text: "⏹️ Attente interrompue. Le rendu cloud peut continuer : relancez plus tard ou reprenez l'édition.",
        type: "info"
      }
    ]);
    notify("Attente arrêtée. Vous pouvez relancer le rendu.", "info");
  };

  // Lancement du rendu double format
  const handleStartRender = async () => {
    const missing = scenes.find(s => !s.file_url);
    if (missing) {
      notify(`Veuillez vérifier que chaque scène possède une carte (manquante en Scène ${missing.scene_number}).`, "warning");
      return;
    }

    const sId = `session_${Date.now()}`;
    setSessionId(sId);
    setRendering(true);
    setRenderStatus('running');
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
          target_duration: targetDuration,
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

      let lastProgressTs = 0;
      const timerInterval = (renderTimerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000));

      let attempts = 0;
      const statusInterval = (renderPollRef.current = setInterval(async () => {
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
              setRenderStatus('success');
              setResultTiktok(stData.tiktok_url);
              setResultLandscape(stData.landscape_url);
              setRendering(false);
              setProgressStep("Rendu terminé avec succès !");
              notify("🎉 Vos 2 vidéos (TikTok 9:16 + Paysage 16:9) sont prêtes !", "success");
              } else if (stData.status === "failed") {
                // Un rendu en échec laissait auparavant le site attendre
                // 15 minutes sans message : seul « completed » était traité.
                clearInterval(timerInterval);
                clearInterval(statusInterval);
                const reason = stData.message || stData.step || "Le rendu a échoué côté serveur.";
                setLogs(prev => [
                  ...prev,
                  { id: `fail_${Date.now()}`, time: getNowStr(), text: `❌ Rendu en échec : ${reason}`, type: "error" }
                ]);
                setRenderStatus('error');
                setRendering(false);
                setProgressStep("Rendu en échec");
                notify(`Rendu en échec : ${reason}`, "error");
            } else if (stData.status === "unknown") {
                clearInterval(timerInterval);
                clearInterval(statusInterval);
                setLogs(prev => [
                  ...prev,
                  { id: `unk_${Date.now()}`, time: getNowStr(), text: "❌ Aucun job trouvé pour cette session. Relancez le rendu.", type: "error" }
                ]);
                setRenderStatus('error');
                setRendering(false);
                notify("Aucun job trouvé pour cette session.", "error");
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
          setRenderStatus('error');
          notify("Le rendu a pris plus de temps que prévu. Veuillez vérifier la console.", "warning");
        }
      }, 2500));

    } catch (e: any) {
      setRenderStatus('error');
      notify(e.message || "Erreur de démarrage du rendu.", "error");
      setRendering(false);
    }
  };

  const totalWords = scenes.reduce((acc, s) => acc + s.script_text.trim().split(/\s+/).filter(Boolean).length, 0);
  const totalDurationEst = Math.round(totalWords / 2.9);
  const targetWords = Math.round(targetDuration * 2.9);
  const laterSceneTargetWords = Math.round((targetWords - 14) / Math.max(1, scenes.length - 1));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER OFFICIEL */}
        <header className="border-b border-slate-800 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">
                Météo-Climat Pro & Monsieur Météo
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Zéro Écran Noir Garanti
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> DeepSeek V4.1 Flash Intégré
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Video className="w-8 h-8 text-sky-400 shrink-0" /> Studio Vidéo & Rédaction 2-en-1
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1">
              Générez vos articles web 27 sections 0-Build et vos vidéos broadcast TikTok 9:16 & Paysage 16:9 en synchronisation parfaite.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleResetAll(false)}
            className="self-start md:self-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/80 text-slate-200 hover:text-rose-200 border border-slate-700 hover:border-rose-500/40 text-xs font-bold flex items-center gap-2 transition shadow-lg shrink-0 cursor-pointer"
            title="Vider le cache et remettre toutes les scènes à zéro"
          >
            <Trash2 className="w-4 h-4 text-rose-400" /> Vider / Nouveau bulletin
          </button>
        </header>

        {/* 🎛️ BARRE DE PILOTAGE & CALIBRAGE GLOBAL (DURÉE, PHÉNOMÈNE, TITRE) */}
        <section className="bg-slate-900/90 border-2 border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-sky-400" /> Paramètres Éditoriaux & Vidéo
              </span>
              {autoDetectedBadge ? (
                <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/50 animate-pulse flex items-center gap-1">
                  <Wand2 className="w-3 h-3 text-emerald-400" /> {autoDetectedBadge}
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-medium hidden md:inline">
                  (Remplissage 100% automatique au copier-coller ou via le bouton ci-contre)
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleFetchDailyTopic}
              disabled={detectingDailyTopic}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-sky-500/20 hover:from-amber-500/30 hover:to-sky-500/30 text-amber-300 border border-amber-500/40 text-xs font-extrabold flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50 shrink-0"
              title="Détecter l'événement météo marquant du jour en France et pré-remplir instantanément la durée, le phénomène et le titre"
            >
              {detectingDailyTopic ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
              {detectingDailyTopic ? "Détection en cours..." : "⚡ Actualité météo du jour en 1 clic"}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* 1. SÉLECTEUR DE DURÉE CIBLE (MIS EN AVANT AU SOMMET) */}
            <div className="w-full lg:w-72">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" /> 1. Durée Cible Vidéo
                </label>
                <span className="text-[10px] font-mono font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded-md border border-sky-400/40">
                  Cible ~{targetWords} mots
                </span>
              </div>
              <select
                value={targetDuration}
                onChange={e => setTargetDuration(Number(e.target.value))}
                className="w-full bg-slate-950 border-2 border-sky-500/60 rounded-xl px-3 py-2 text-xs text-sky-200 font-extrabold focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition cursor-pointer shadow-inner"
              >
                {DURATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 2. PHÉNOMÈNE MÉTÉO */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 2. Phénomène Météo
                </label>
                {autoDetectedBadge && (
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/40">
                    ✓ Auto-détecté
                  </span>
                )}
              </div>
              <div className="flex gap-2">
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
                  className={`flex-1 bg-slate-950 border ${autoDetectedBadge ? 'border-emerald-500/70 ring-1 ring-emerald-500/40' : 'border-slate-700'} rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-sky-500 transition cursor-pointer`}
                >
                  {PHENOMENONS.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="OTHER_CUSTOM">➕ Autre phénomène (saisie libre...)</option>
                </select>
                {isCustomPhenomenon && (
                  <input
                    type="text"
                    placeholder="Phénomène personnalisé..."
                    value={customPhenomenon}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={e => setCustomPhenomenon(e.target.value)}
                    className="flex-1 bg-slate-950 border border-amber-500/60 rounded-xl px-3 py-2 text-xs text-amber-300 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    autoFocus
                  />
                )}
              </div>
            </div>

            {/* 3. TITRE / SUJET DE L'ALERTE */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  3. Titre / Sujet de l'actualité
                </label>
                {topic && autoDetectedBadge && (
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/40">
                    ✓ Titre extrait
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Ex: Nette dégradation pluvieuse et venteuse dès mercredi..."
                value={topic}
                autoComplete="off"
                spellCheck={false}
                onChange={e => setTopic(e.target.value)}
                className={`w-full bg-slate-950 border ${autoDetectedBadge ? 'border-emerald-500/70 ring-1 ring-emerald-500/40' : 'border-slate-700'} rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-semibold transition placeholder-slate-600`}
              />
            </div>

          </div>

          {/* RAPPEL CALIBRAGE SYNCHRONISÉ */}
          <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Cadence voix off Charon (2.9 mots/s) : <strong>Scène 1 (Accroche ≤ 14 mots / 4s)</strong> + <strong>{scenes.length - 1} scènes de ~{laterSceneTargetWords} mots</strong>.
              </span>
            </div>
            <div className="text-slate-500 font-medium">
              Synchronisé avec Option A (Import URL), Option B (DeepSeek) et la Régie Vidéo
            </div>
          </div>
        </section>

        {/* 🔀 ONGLETS DE SÉLECTION DU MODE (OPTION A vs OPTION B) */}
        <div className="flex rounded-2xl bg-slate-900/90 p-1.5 border border-slate-800 shadow-xl gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
              activeTab === 'url'
                ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg shadow-sky-500/25 ring-2 ring-sky-400/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <LinkIcon className="w-4 h-4 text-sky-300" />
            <span>Option A • ⚡ Import Automatique par Lien d'Article</span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-sky-950/80 text-sky-300 border border-sky-400/30">
              Article déjà en ligne
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('prompt')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
              activeTab === 'prompt'
                ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Option B • 🤖 Rédacteur 2-en-1 (DeepSeek & Prompt Maître)</span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-950/80 text-amber-300 border border-amber-400/30">
              Web + Vidéo 0-Build
            </span>
          </button>
        </div>

        {/* 🌟 VUE OPTION A : IMPORTATION EN 1 CLIC DEPUIS UN LIEN D'ARTICLE WEB */}
        {activeTab === 'url' && (
          <section className="bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border-2 border-sky-500/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-sky-500 text-slate-950 mb-1.5 inline-block">
                  Option A • Mode Rapide 1 Clic
                </span>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-sky-400" /> Coller le lien d'un article météo
                </h2>
                <p className="text-slate-400 text-xs md:text-sm mt-0.5">
                  Le système extrait automatiquement les cartes météo HD, les cumuls chiffrés et rédige le script vidéo calibré pour <strong>{targetDuration}s</strong> (~{targetWords} mots).
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="url"
                  placeholder="Collez n'importe quelle URL (meteobtp.fr, ouest-france, infoclimat, actu.fr, etc.)"
                  value={articleUrl}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={e => setArticleUrl(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all font-mono"
                />
              </div>
              <button
                onClick={() => handleImportArticle()}
                disabled={importingArticle}
                className="px-6 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer flex-shrink-0"
              >
                {importingArticle ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {importingArticle ? "Extraction en cours..." : "⚡ Importer tout en 1 clic"}
              </button>
            </div>

            {/* EXEMPLE PRÊT À TESTER */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
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
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs md:text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                {importSuccessMessage}
              </div>
            )}
          </section>
        )}

        {/* 🌟 VUE OPTION B : PROMPT MAÎTRE 2-EN-1 & DEEPSEEK V4.1 FLASH */}
        {activeTab === 'prompt' && (
          <section className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-orange-950/40 border-2 border-amber-500/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 mb-1.5 inline-block">
                  Option B • Prompt Maître 2-en-1 & DeepSeek V4.1
                </span>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" /> Rédiger l'Article 27 sections & le Script Vidéo
                </h2>
                <p className="text-slate-400 text-xs md:text-sm mt-0.5">
                  Rédigez avec <strong>DeepSeek V4.1 Flash</strong> ou copiez le Prompt Maître vers ChatGPT. Tout est repris mot pour mot pour la publication multi-sites et la vidéo !
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyMasterPrompt}
                  className="text-xs px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition"
                  title="Copier le Prompt Maître officiel pour ChatGPT"
                >
                  <Copy className="w-3.5 h-3.5" /> {promptCopied ? "✓ Prompt Copié !" : "📋 Copier le Prompt Maître"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    autoDetectAndUpdateMetadata(LAST_USER_PROMPT_SAMPLE);
                    handleParseManualPrompt(LAST_USER_PROMPT_SAMPLE);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Exemple « Pluie & Vent »
                </button>
              </div>
            </div>

            <textarea
              rows={4}
              placeholder="Collez ici le résultat de ChatGPT ou vos notes brutes (le Titre, le Phénomène et la Durée seront automatiquement détectés et remplis au sommet !)..."
              value={manualPromptText}
              autoComplete="off"
              spellCheck={false}
              onChange={e => {
                setManualPromptText(e.target.value);
                autoDetectAndUpdateMetadata(e.target.value);
              }}
              onPaste={e => {
                const pasted = e.clipboardData.getData("text");
                if (pasted) {
                  setManualPromptText(pasted);
                  autoDetectAndUpdateMetadata(pasted);
                  if (pasted.length >= 30 && (pasted.includes("SCÈNE") || pasted.includes("Voix off") || pasted.includes("TITRE") || pasted.includes("DEBUT ARTICLE") || pasted.includes("LIVRABLE"))) {
                    setTimeout(() => {
                      handleParseManualPrompt(pasted, { silent: true });
                    }, 50);
                  }
                }
              }}
              onDragOver={e => {
                // Glisser-déposer d'un fichier .txt / .md généré par ChatGPT
                if (e.dataTransfer.types.includes("Files")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }
              }}
              onDrop={e => {
                const file = e.dataTransfer.files?.[0];
                if (!file) return;
                e.preventDefault();
                handleImportTextFile(file);
              }}
              className="w-full bg-slate-950/90 border border-slate-700 border-dashed rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono leading-relaxed"
            />
            <p className="text-[10px] text-slate-500 -mt-1 flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              Vous pouvez aussi <strong className="text-slate-400">glisser un fichier .txt ou .md</strong> ici,
              ou utiliser le bouton « Importer un fichier » ci-dessous.
            </p>

            {/* BARRE D'ACTIONS ÉDITORIALES & PUBLICATION */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              
              {/* 1. BOUTON RÉDIGER AVEC DEEPSEEK */}
              <button
                type="button"
                onClick={handleGenerateWithDeepseek}
                disabled={generatingWithDeepseek || publishingArticle || articleActionRunning}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 text-xs md:text-sm cursor-pointer disabled:opacity-50 ring-1 ring-indigo-400/50"
                title={`Générer l'article 27 sections et les scènes calibrées sur ${targetDuration}s avec DeepSeek V4.1 Flash`}
              >
                {generatingWithDeepseek ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                {generatingWithDeepseek ? "DeepSeek rédige..." : `🤖 Rédiger avec DeepSeek (${targetDuration}s)`}
              </button>

              {/* 2. IMPORTER CARTES */}
              <label className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg shadow-sky-600/20 transition-all flex items-center gap-2 text-xs md:text-sm cursor-pointer">
                {uploadingBatch ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadingBatch ? "Téléversement..." : "🖼️ Importer cartes (Image 1, 2, 3...)"}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => handleBatchFilesUpload(e.target.files)}
                />
              </label>

              {/* 2 bis. IMPORTER UN FICHIER .txt / .md DE CHATGPT */}
              <label
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 text-xs md:text-sm cursor-pointer"
                title="Importer directement le fichier .txt ou .md de la réponse ChatGPT (encodage détecté automatiquement)"
              >
                <FileText className="w-4 h-4" />
                📂 Importer un fichier (.txt / .md)
                <input
                  type="file"
                  accept=".txt,.md,.markdown,text/plain"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleImportTextFile(f);
                    e.target.value = "";
                  }}
                />
              </label>

              {/* 3. PHOTO COUVERTURE */}
              <label className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 text-xs md:text-sm cursor-pointer">
                {uploadingCover ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                {uploadingCover ? "Upload couverture..." : "📸 Photo couverture 16:9"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleCoverUpload(e.target.files[0])}
                />
              </label>

              {/* 4. BOUTON PRÉVISUALISER SANS PUBLIER */}
              <button
                type="button"
                onClick={() => handleParseManualPrompt()}
                disabled={publishingArticle || articleActionRunning || generatingWithDeepseek}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 hover:border-amber-400 font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 text-xs md:text-sm cursor-pointer disabled:opacity-50"
                title="Analyser et charger les scènes et l'article sans publier immédiatement"
              >
                <Eye className="w-4 h-4" /> 👁️ Prévisualiser seulement
              </button>

              {/* 5. BOUTON MAÎTRE 1-CLIC : CHARGER & DÉPLOYER IMMÉDIATEMENT SUR LES 3 SITES */}
              <button
                type="button"
                onClick={() => handleLoadAndPublish()}
                disabled={publishingArticle || articleActionRunning || generatingWithDeepseek}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl shadow-xl shadow-emerald-500/30 transition-all flex items-center gap-2 text-xs md:text-sm cursor-pointer disabled:opacity-50 ring-2 ring-emerald-400/40 ml-auto"
                title="Charge les scènes, formate l'article mot pour mot et déploie instantanément sur meteobtp.fr, monsieurmeteo.com et climat-meteo.vercel.app"
              >
                {publishingArticle ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                {publishingArticle ? "Publication en direct..." : "🚀 Charger & Publier DIRECTEMENT sur les 3 sites"}
              </button>
            </div>

            {/* SÉLECTEUR RAPIDE DE COUVERTURE PARMI LES CARTES DÉJÀ UPLOADÉES */}
            {batchUploadedImages.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-slate-400 font-semibold">Couverture 16:9 active :</span>
                {batchUploadedImages.map((img) => (
                  <button
                    key={img.ref}
                    type="button"
                    onClick={() => {
                      setCoverImageUrl(img.url);
                      setCoverImageName(img.name);
                      notify(`Image ${img.ref} sélectionnée comme couverture.`, "info");
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                      coverImageUrl === img.url
                        ? "bg-sky-500 text-slate-950 border-sky-400 shadow"
                        : "bg-slate-900 text-slate-300 border-slate-700 hover:border-sky-400"
                    }`}
                  >
                    {coverImageUrl === img.url && <CheckCircle2 className="w-3 h-3" />}
                    Utiliser Image {img.ref}
                  </button>
                ))}
                {coverImageName && (
                  <span className="text-[11px] text-emerald-400 ml-1">
                    ✓ {coverImageName}
                  </span>
                )}
              </div>
            )}
          </section>
        )}

        {/* 📟 JOURNAL DE LOGS EN DIRECT (CONSOLE RÉDACTION & DÉPLOIEMENT ARTICLE) */}
        {(articleActionRunning || articleLogs.length > 0) && (
          <section className="bg-slate-950 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-2xl space-y-3.5 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Journal de Rédaction & Déploiement d'Actualités</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Suivi en direct des imports, de DeepSeek V4.1 et de la publication 0-Build.</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono text-slate-300 font-bold bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                  ⏱️ {Math.floor(articleElapsedSeconds / 60).toString().padStart(2, '0')}:{(articleElapsedSeconds % 60).toString().padStart(2, '0')}
                </span>
                {articleActionStatus === 'running' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    {articleActionTitle || "Traitement en cours"}
                  </span>
                ) : articleActionStatus === 'error' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-3 py-1.5 rounded-full">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    Erreur rencontrée
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Opération terminée
                  </span>
                )}
                {articleLogs.length > 0 && !articleActionRunning && (
                  <button
                    type="button"
                    onClick={() => setArticleLogs([])}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition cursor-pointer"
                    title="Effacer le journal d'actualités"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* BARRE DE PROGRESSION */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono font-semibold text-slate-400">
                <span>Progression</span>
                <span className={articleActionStatus === 'error' ? 'text-rose-400 font-bold' : articleProgressPercent === 100 ? "text-emerald-400 font-bold" : "text-amber-400"}>
                  {articleProgressPercent}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    articleActionStatus === 'error'
                      ? 'bg-rose-500'
                      : articleProgressPercent === 100
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-sky-500 animate-pulse'
                  }`}
                  style={{ width: `${articleProgressPercent}%` }}
                />
              </div>
            </div>

            {/* FENÊTRE TERMINAL SCROLLABLE */}
            <div
              ref={articleLogsContainerRef}
              className="bg-slate-950/90 rounded-xl border border-slate-800/80 p-3.5 max-h-52 overflow-y-auto font-mono text-xs space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700"
            >
              {articleLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-500 flex-shrink-0 select-none">[{log.time}]</span>
                  <span className={
                    log.type === 'error' ? 'text-rose-400 font-bold' :
                    log.type === 'success' ? 'text-emerald-400 font-bold' :
                    log.type === 'ia' ? 'text-purple-300 font-semibold' :
                    log.type === 'theme' ? 'text-sky-300' :
                    log.type === 'images' ? 'text-amber-300' :
                    log.type === 'publish' ? 'text-teal-300 font-semibold' :
                    'text-slate-300'
                  }>
                    {log.text}
                  </span>
                </div>
              ))}
              {articleActionRunning && (
                <div className="flex items-center gap-2 text-slate-500 animate-pulse pt-1">
                  <span className="inline-block w-2 h-3.5 bg-amber-400" />
                  <span className="text-[11px] text-slate-400">Traitement en cours...</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 📰 CARTE DE PUBLICATION DE L'ACTUALITÉ SUR LES 3 SITES */}
        {parsedArticle && (
          <section className="p-5 bg-slate-900/90 border-2 border-amber-500/50 rounded-2xl shadow-2xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950">
                    {parsedArticle.category || "Actualités Météo"}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    Article structuré mot pour mot
                  </span>
                </div>
                <h3 className="text-base md:text-lg font-black text-white">
                  {parsedArticle.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 italic">
                  {parsedArticle.excerpt}
                </p>
              </div>

              {/* SÉLECTEUR DES 5 PRÉSENTATIONS VISUELLES ACTUBTP */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    🎨 Présentation Visuelle
                  </label>
                  <select
                    value={selectedThemeId}
                    onChange={e => handleThemeChange(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="auto">🎲 Détection automatique (selon le sujet)</option>
                    {ARTICLE_THEMES.map(th => (
                      <option key={th.id} value={th.id}>{th.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowArticlePreview(!showArticlePreview)}
                  className="self-end px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> {showArticlePreview ? "Masquer l'aperçu" : "Voir l'aperçu"}
                </button>
              </div>
            </div>

            {/* BOUTON OFFICIEL DE PUBLICATION SUR LES 3 SITES (0-BUILD) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-300">
                <span className="font-bold text-white block mb-0.5">🚀 Prêt à être mis en ligne simultanément sur :</span>
                <span className="text-slate-400">meteobtp.fr (Thème Clair Pro) • monsieurmeteo.com (Dark Glass) • climat-meteo.vercel.app</span>
              </div>

              <button
                type="button"
                onClick={() => handlePublishArticle()}
                disabled={publishingArticle}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 shrink-0"
              >
                {publishingArticle ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                {publishingArticle ? "Publication en cours..." : "🚀 Publier l'Actualité sur les 3 sites"}
              </button>
            </div>

            {/* LIENS DIRECTS APRÈS PUBLICATION */}
            {publishedUrls && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs md:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Article publié et immédiatement accessible en ligne :
                </div>
                <div className="flex flex-wrap gap-2 pt-1 text-xs font-semibold">
                  <a
                    href={publishedUrls.meteobtp}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-700 rounded-lg flex items-center gap-1 transition"
                  >
                    MétéoBTP Pro <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={publishedUrls.monsieurmeteo}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-700 rounded-lg flex items-center gap-1 transition"
                  >
                    Monsieur Météo <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={publishedUrls.climatmeteo}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-700 rounded-lg flex items-center gap-1 transition"
                  >
                    Climat-Météo <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* APERÇU / ÉDITION DU CONTENU AVANT PUBLICATION (MOT POUR MOT) */}
            {showArticlePreview && (
              <div className="mt-3 bg-slate-950 p-6 rounded-xl border border-slate-800">
                <div className="text-[11px] uppercase tracking-wider font-bold mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <span className="text-slate-500">
                    {isEditMode ? "✏️ Édition de l'article avant publication" : "Aperçu de l'article (Rendu Dark Glass Monsieur Météo)"}
                  </span>
                  <div className="flex items-center gap-2">
                    {hasArticleEdits && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 normal-case font-bold">
                        {editBlocks.filter(b => b.text !== b.original).length} bloc(s) corrigé(s)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditMode(v => !v)}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer normal-case ${
                        isEditMode
                          ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                          : "bg-slate-800 text-sky-300 hover:bg-slate-700 border border-slate-700"
                      }`}
                      title="Corriger le titre, le chapeau et chaque paragraphe avant de publier"
                    >
                      {isEditMode ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Wand2 className="w-3.5 h-3.5" />}
                      {isEditMode ? "Terminer l'édition" : "✏️ Modifier l'article"}
                    </button>
                  </div>
                </div>

                {isEditMode ? (
                  <div className="space-y-4">
                    {/* MÉTADONNÉES ÉDITABLES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">Titre SEO</label>
                        <input
                          value={editTitle}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={e => setEditTitle(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Chapeau / Extrait ({editExcerpt.length} caractères)
                        </label>
                        <textarea
                          rows={3}
                          value={editExcerpt}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={e => setEditExcerpt(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Catégorie</label>
                        <input
                          value={editCategory}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={e => setEditCategory(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Auteur</label>
                        <input
                          value={editAuthor}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={e => setEditAuthor(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Slug / URL {editSlug ? "(article déjà publié : le modifier crée une NOUVELLE URL)" : "(généré automatiquement)"}
                        </label>
                        <input
                          value={editSlug}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={e => setEditSlug(e.target.value)}
                          placeholder="meteo-retour-de-la-pluie-1792667167"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      {/* BLOC PARTAGE RÉSEAUX SOCIAUX */}
                      <div className="md:col-span-2 border-t border-slate-800 pt-3 mt-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                            📱 Partage réseaux sociaux
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const payload = [editSocialTitle, editSocialDescription, editHashtags].filter(Boolean).join("\n\n");
                              if (payload) {
                                navigator.clipboard.writeText(payload);
                                notify("Bloc de partage copié dans le presse-papier !", "success");
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            title="Copier titre + paragraphe + hashtags pour les réseaux"
                          >
                            <Copy className="w-3 h-3" /> Copier
                          </button>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Titre partage ({editSocialTitle.length} car.)
                          </label>
                          <input
                            value={editSocialTitle}
                            autoComplete="off"
                            spellCheck={false}
                            onChange={e => setEditSocialTitle(e.target.value)}
                            placeholder="À copier depuis le chat ChatGPT ou à saisir manuellement"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-sky-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Paragraphe partage ({editSocialDescription.length} car.)
                          </label>
                          <textarea
                            rows={2}
                            value={editSocialDescription}
                            autoComplete="off"
                            spellCheck={false}
                            onChange={e => setEditSocialDescription(e.target.value)}
                            placeholder="Accroche pour les réseaux sociaux"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Hashtags
                          </label>
                          <input
                            value={editHashtags}
                            autoComplete="off"
                            spellCheck={false}
                            onChange={e => setEditHashtags(e.target.value)}
                            placeholder="#meteo #previsions #France #MeteoClimatPro"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-sky-300 focus:outline-none focus:border-sky-400"
                          />
                        </div>

                        {/* POSTS PAR PLATEFORME */}
                        <div className="border-t border-slate-800 pt-3 space-y-3">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                            📣 Posts prêts à publier
                          </span>
                          {([
                            { label: "Facebook", post: editFacebookPost, setPost: setEditFacebookPost, tags: editFacebookHashtags, setTags: setEditFacebookHashtags, color: "text-blue-400", max: 200 },
                            { label: "LinkedIn", post: editLinkedinPost, setPost: setEditLinkedinPost, tags: editLinkedinHashtags, setTags: setEditLinkedinHashtags, color: "text-sky-400", max: 300 },
                            { label: "TikTok", post: editTiktokPost, setPost: setEditTiktokPost, tags: editTiktokHashtags, setTags: setEditTiktokHashtags, color: "text-rose-400", max: 120 },
                            { label: "Twitter / X", post: editTwitterPost, setPost: setEditTwitterPost, tags: editTwitterHashtags, setTags: setEditTwitterHashtags, color: "text-slate-300", max: 280 },
                          ] as const).map(({ label, post, setPost, tags, setTags, color, max }) => (
                            <div key={label} className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-black uppercase tracking-wider ${color}`}>{label}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-mono ${post.length > max ? "text-rose-400 font-bold" : "text-slate-500"}`}>
                                    {post.length}/{max}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const payload = [post, tags].filter(Boolean).join("\n\n");
                                      if (payload) {
                                        navigator.clipboard.writeText(payload);
                                        notify(`Post ${label} copié !`, "success");
                                      }
                                    }}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                                    title={`Copier le post ${label} + ses hashtags`}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <textarea
                                rows={2}
                                value={post}
                                autoComplete="off"
                                spellCheck={false}
                                onChange={e => setPost(e.target.value)}
                                placeholder={`Post ${label} (à copier depuis le chat ChatGPT)`}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-400"
                              />
                              <input
                                value={tags}
                                autoComplete="off"
                                spellCheck={false}
                                onChange={e => setTags(e.target.value)}
                                placeholder={`#hashtags ${label}`}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[10px] font-mono text-sky-300 focus:outline-none focus:border-emerald-400"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* BLOCS ÉDITABLES */}
                    <div className="max-h-[460px] overflow-y-auto space-y-2 pr-1">
                      {editBlocks.map((block, i) => (
                        <div key={block.id} className="bg-slate-900/40 border border-slate-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                              block.kind === "h1" ? "text-amber-400"
                                : block.kind === "h2" || block.kind === "h3" ? "text-sky-400"
                                : block.kind === "table" ? "text-slate-500"
                                : "text-slate-400"
                            }`}>
                              {block.label}
                              {block.kind === "table" && " (non éditable)"}
                            </span>
                            {block.text !== block.original && (
                              <button
                                type="button"
                                onClick={() => setEditBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, text: b.original } : b))}
                                className="text-[10px] text-slate-500 hover:text-rose-400 font-bold cursor-pointer"
                                title="Annuler la correction de ce bloc"
                              >
                                ↺ Annuler
                              </button>
                            )}
                          </div>
                          {block.kind === "table" ? (
                            <p className="text-[11px] text-slate-500 italic">Tableau publié tel quel (modifiez-le dans le texte source si nécessaire).</p>
                          ) : block.kind === "h1" || block.kind === "h2" || block.kind === "h3" ? (
                            <input
                              value={block.text}
                              onChange={e => setEditBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, text: e.target.value } : b))}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-amber-400"
                            />
                          ) : (
                            <textarea
                              rows={Math.min(10, Math.max(2, Math.ceil(block.text.length / 100)))}
                              value={block.text}
                              onChange={e => setEditBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, text: e.target.value } : b))}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-amber-400"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                      <span className="text-[11px] text-slate-500">
                        Balises inline autorisées : <code className="text-slate-300">&lt;strong&gt;</code>, <code className="text-slate-300">&lt;em&gt;</code>, <code className="text-slate-300">&lt;a href&gt;</code>. Le thème visuel est conservé.
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditMode(false)}
                          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"
                        >
                          ✓ Valider les corrections
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto">
                    {coverImageUrl && (
                      <div className="mb-6 rounded-xl overflow-hidden border border-slate-800 shadow-lg max-w-xl mx-auto">
                        <img src={coverImageUrl} alt="Couverture" className="w-full h-auto object-cover" />
                        <div className="p-2 bg-slate-900 text-[11px] text-slate-400 text-center italic">
                          Photo de couverture 16:9 affichée en en-tête des 3 sites
                        </div>
                      </div>
                    )}
                    <div
                      dangerouslySetInnerHTML={{ __html: editedHtml || parsedArticle.htmlDark }}
                      className="prose prose-invert max-w-none text-sm"
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* 🎬 ÉTAPE 2 : LES SCÈNES DU BULLETIN (DYNAMIQUES : AJOUT / SUPPRESSION LIBRE) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>
                  🖼️ Les Scènes du Bulletin ({scenes.length} scènes • ~{totalDurationEst}s / Cible {targetDuration}s)
                </span>
              </h2>
              <span className="text-xs text-slate-400">
                Total estimé : <strong>{totalWords} mots</strong> (~{totalDurationEst}s). Cible officielle : <strong>{targetWords} mots</strong> ({targetDuration}s).
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateScript}
                disabled={generatingScript}
                className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title={`Régénérer uniquement les textes des scènes selon la durée cible de ${targetDuration}s`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generatingScript ? 'animate-spin' : ''}`} />
                Régénérer textes ({targetDuration}s)
              </button>
              <button
                type="button"
                onClick={handleAddScene}
                className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" /> Ajouter une scène
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {scenes.map((sc, i) => {
              const wordCount = sc.script_text.trim().split(/\s+/).filter(Boolean).length;
              const sceneDurationEst = (wordCount / 2.9).toFixed(1);
              return (
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

                    {i === 0 && coverImageUrl && sc.file_url !== coverImageUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const copy = [...scenes];
                          copy[0] = { ...copy[0], file_url: coverImageUrl, file_name: coverImageName || "Photo de couverture 16:9", image_hint: "Photo de couverture 16:9" };
                          setScenes(copy);
                          notify("Photo de couverture 16:9 assignée à la Scène 1 !", "success");
                        }}
                        className="w-full mb-2 py-1 px-2 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/50 hover:border-indigo-400 text-indigo-200 hover:text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        ✨ Utiliser la photo de couverture en Scène 1
                      </button>
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
                            <CheckCircle2 className="w-3 h-3" /> {sc.file_url === coverImageUrl ? "🌟 Couverture 16:9" : (sc.image_ref ? `Image ${sc.image_ref}` : (i === 0 ? "Couverture" : `Carte ${i + 1}`))}
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
                        autoComplete="off"
                        spellCheck={false}
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
                        autoComplete="off"
                        spellCheck={false}
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
                        autoComplete="off"
                        spellCheck={false}
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
                          ? (wordCount <= 14 ? 'text-emerald-400' : 'text-amber-400')
                          : 'text-slate-400'
                      }`}>
                        {wordCount} mots (~{sceneDurationEst}s)
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      value={sc.script_text}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={e => {
                        const copy = [...scenes];
                        copy[i].script_text = e.target.value;
                        setScenes(copy);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 resize-none focus:outline-none focus:border-sky-500 leading-relaxed font-sans"
                    />
                    {i === 0 && wordCount > 14 && (
                      <p className="text-[9px] text-amber-400/90 mt-0.5 font-medium">
                        ⚠️ Visez 12 à 14 mots max pour l'accroche ≤ 4s.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 🎬 ÉTAPE 3 : BOUTON DE LANCEMENT DE LA RÉGIE VIDÉO */}
        <section className="text-center py-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleStartRender}
              disabled={rendering}
              className="px-8 py-4 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-lg rounded-2xl shadow-2xl shadow-sky-500/25 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-3"
            >
              {rendering ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
              {rendering ? "Régie vidéo en cours d'encodage..." : "🎬 Générer les 2 Vidéos (TikTok 9:16 + Paysage 16:9)"}
            </button>

            {rendering && (
              <button
                type="button"
                onClick={handleStopRender}
                className="px-5 py-4 bg-rose-600/90 hover:bg-rose-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-rose-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                title="Arrêter d'attendre et revenir à l'édition (le rendu cloud peut continuer côté serveur)"
              >
                <X className="w-5 h-5" />
                Arrêter l'attente
              </button>
            )}
          </div>
          {rendering && (
            <p className="text-[11px] text-slate-500 mt-2">
              Bloqué ? « Arrêter l'attente » débloque l'interface : vous pouvez relancer ou reprendre l'édition.
            </p>
          )}

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
                  {renderStatus === 'running' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      Encodage en cours
                    </span>
                  ) : renderStatus === 'error' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-3 py-1.5 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      Erreur d'encodage
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Rendu terminé
                    </span>
                  )}
                  {logs.length > 0 && !rendering && (
                    <button
                      type="button"
                      onClick={() => setLogs([])}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition cursor-pointer"
                      title="Effacer le journal de la régie"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* BARRE DE PROGRESSION */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono font-semibold text-slate-400">
                  <span>Progression régie</span>
                  <span className={renderStatus === 'error' ? 'text-rose-400 font-bold' : progressPercent === 100 ? "text-emerald-400 font-bold" : "text-sky-400"}>
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      renderStatus === 'error'
                        ? 'bg-rose-500'
                        : progressPercent === 100
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
                      log.type === 'error' ? 'text-rose-400 font-bold' :
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

        {/* 📱 ÉTAPE 4 : RÉSULTATS & TÉLÉCHARGEMENT */}
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

      {/* 🔔 NOTIFICATION TOAST FLOTTANTE NON-BLOQUANTE */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-xl ${
            toast.type === 'success' ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200' :
            toast.type === 'error' ? 'bg-rose-950/95 border-rose-500/50 text-rose-200' :
            toast.type === 'warning' ? 'bg-amber-950/95 border-amber-500/50 text-amber-200' :
            'bg-slate-900/95 border-sky-500/50 text-sky-200'
          }`}>
            <div className="mt-0.5 shrink-0">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
              {toast.type === 'warning' && <Sparkles className="w-5 h-5 text-amber-400" />}
              {toast.type === 'info' && <Terminal className="w-5 h-5 text-sky-400" />}
            </div>
            <div className="flex-1 text-xs md:text-sm font-semibold leading-relaxed">
              {toast.message}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
