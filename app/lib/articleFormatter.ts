import { MASTER_PROMPT_V2 } from "./masterPromptV2";
export interface ArticleTheme {
  id: string;
  name: string;
  badge: string;
  primaryDark: string;
  primaryLight: string;
  accentDark: string;
  accentLight: string;
  boxBgDark: string;
  boxBorderDark: string;
  summaryBgDark: string;
  summaryBorderDark: string;
  tableHeaderBgDark: string;
}

export const ARTICLE_THEMES: ArticleTheme[] = [
  {
    id: "alerte",
    name: "⚡ Présentation 1 — Alerte & Vigilance (Rouge & Ambre)",
    badge: "ALERTE & VIGILANCE",
    primaryDark: "#f87171",
    primaryLight: "#b91c1c",
    accentDark: "#fbbf24",
    accentLight: "#92400e",
    boxBgDark: "rgba(220, 38, 38, 0.12)",
    boxBorderDark: "#ef4444",
    summaryBgDark: "rgba(245, 158, 11, 0.12)",
    summaryBorderDark: "#fbbf24",
    tableHeaderBgDark: "rgba(220, 38, 38, 0.2)"
  },
  {
    id: "synoptique",
    name: "📊 Présentation 2 — Analyse Synoptique & Modèles (Cyan & Émeraude)",
    badge: "ANALYSE SYNOPTIQUE",
    primaryDark: "#38bdf8",
    primaryLight: "#0284c7",
    accentDark: "#4ade80",
    accentLight: "#166534",
    boxBgDark: "rgba(22, 101, 52, 0.18)",
    boxBorderDark: "#22c55e",
    summaryBgDark: "rgba(56, 189, 248, 0.12)",
    summaryBorderDark: "#38bdf8",
    tableHeaderBgDark: "rgba(56, 189, 248, 0.18)"
  },
  {
    id: "pedagogique",
    name: "🔍 Présentation 3 — Dossier Pédagogique & Mécanismes (Indigo & Or)",
    badge: "DOSSIER SCIENTIFIQUE",
    primaryDark: "#60a5fa",
    primaryLight: "#1e40af",
    accentDark: "#fbbf24",
    accentLight: "#92400e",
    boxBgDark: "rgba(30, 58, 138, 0.25)",
    boxBorderDark: "#3b82f6",
    summaryBgDark: "rgba(245, 158, 11, 0.12)",
    summaryBorderDark: "#f59e0b",
    tableHeaderBgDark: "rgba(59, 130, 246, 0.2)"
  },
  {
    id: "bilan",
    name: "🌡️ Présentation 4 — Bilan Climatologique & Records (Océan & Cuivre)",
    badge: "BILAN CLIMATOLOGIQUE",
    primaryDark: "#67e8f9",
    primaryLight: "#002147",
    accentDark: "#fbbf24",
    accentLight: "#b45309",
    boxBgDark: "rgba(15, 23, 42, 0.6)",
    boxBorderDark: "#38bdf8",
    summaryBgDark: "rgba(22, 101, 52, 0.18)",
    summaryBorderDark: "#4ade80",
    tableHeaderBgDark: "rgba(14, 165, 233, 0.2)"
  },
  {
    id: "btp",
    name: "🏗️ Présentation 5 — Spécial Opérations BTP & Prévention (Ambre & Acier)",
    badge: "PRÉVENTION BTP & ROUTES",
    primaryDark: "#fbbf24",
    primaryLight: "#92400e",
    accentDark: "#38bdf8",
    accentLight: "#0284c7",
    boxBgDark: "rgba(245, 158, 11, 0.15)",
    boxBorderDark: "#f59e0b",
    summaryBgDark: "rgba(56, 189, 248, 0.12)",
    summaryBorderDark: "#38bdf8",
    tableHeaderBgDark: "rgba(245, 158, 11, 0.2)"
  }
];

export function detectBestArticleTheme(text: string): ArticleTheme {
  const lower = (text || "").toLowerCase();
  if (lower.includes("chantier") || lower.includes("btp") || lower.includes("grue") || lower.includes("terrassement")) {
    return ARTICLE_THEMES[4]; // Spécial Opérations BTP
  }
  if (lower.includes("bilan") || lower.includes("record") || lower.includes("normale") || lower.includes("climatologi")) {
    return ARTICLE_THEMES[3]; // Bilan Climatologique
  }
  if (lower.includes("vigilance") || lower.includes("alerte") || lower.includes("tempête") || lower.includes("inondation") || lower.includes("crue") || lower.includes("orage")) {
    return ARTICLE_THEMES[0]; // Alerte & Vigilance
  }
  if (lower.includes("géopotentiel") || lower.includes("synoptique") || lower.includes("anticyclone") || lower.includes("dépression") || lower.includes("ecmwf") || lower.includes("gfs")) {
    return ARTICLE_THEMES[1]; // Analyse Synoptique & Modèles
  }
  return ARTICLE_THEMES[2]; // Dossier Pédagogique
}

/** Débit de la voix Charon, en mots par seconde (mesuré sur nos rendus). */
export const WORDS_PER_SECOND = 2.85;

export interface PromptCalibration {
  /** Durée cible du bulletin, en secondes. */
  targetDuration: number;
  /** Nombre de scènes (3 à 6). */
  sceneCount: number;
  /** Durée cumulée des animations GIF fournies, en secondes (0 si aucune). */
  animationSeconds: number;
  /** Nombre de GIF animés détectés. */
  animationCount: number;
}

export interface PromptBudget {
  /** Mots visés au total. */
  totalWords: number;
  /** Fourchette autour de la cible. */
  minWords: number;
  maxWords: number;
  /** Mots nécessaires pour commenter les animations. */
  animationWords: number;
  /** Durée que devra réellement faire le bulletin. */
  effectiveDuration: number;
  /** Section CALIBRAGE injectée dans le prompt. */
  calibrageBlock: string;
  /** Section CALIBRAGE DES GIF ANIMÉS injectée dans le prompt. */
  gifBlock: string;
}

/**
 * Calcule le budget de mots du prompt en tenant compte de la durée cible,
 * du nombre de scènes ET de la durée des GIF animés.
 *
 * Problème corrigé : le prompt imposait « 165 à 175 mots » en dur. Avec un GIF
 * de 30 s, la voix off ne couvrait pas l'animation et le spectateur ne voyait
 * jamais la fin de la prévision. La garantie est désormais arithmétique.
 */
export function buildPromptBudget(input: PromptCalibration): PromptBudget {
  const targetDuration = Math.max(10, Number(input.targetDuration) || 60);
  const sceneCount = Math.min(12, Math.max(2, Number(input.sceneCount) || 5));
  const animationSeconds = Math.max(0, Number(input.animationSeconds) || 0);
  const animationCount = Math.max(0, Number(input.animationCount) || 0);

  const baseWords = Math.round(targetDuration * WORDS_PER_SECOND);
  const animationWords = Math.round(animationSeconds * WORDS_PER_SECOND);

  // La voix doit couvrir la durée cible ET toutes les animations (le moteur
  // réserve à chaque GIF sa durée complète).
  const totalWords = Math.max(baseWords, animationWords + Math.round(8 * WORDS_PER_SECOND));
  const effectiveDuration = totalWords / WORDS_PER_SECOND;

  const minWords = Math.round(totalWords * 0.97);
  const maxWords = Math.round(totalWords * 1.03);

  const capShare = Math.round(effectiveDuration * 0.75);

  const calibrageLines = [
    `- Total des ${sceneCount} voix off : **${minWords} à ${maxWords} mots** (cible : ${totalWords} mots).`,
    `- Durée visée : environ **${Math.round(effectiveDuration)} secondes**, selon le débit et les pauses de la voix.`,
  ];
  if (animationSeconds > 0) {
    calibrageLines.push(
      `- Dont **${animationWords} mots minimum réservés aux ${animationCount} animation(s) GIF** (elles totalisent ${Math.round(animationSeconds)} s).`
    );
  }
  if (sceneCount !== 5) {
    calibrageLines.push(
      `- Le bulletin compte **${sceneCount} scènes** (et non cinq) : adapte la progression en conséquence.`
    );
  }

  const gifBlock =
    animationSeconds > 0
      ? [
          `## CALIBRAGE DES GIF ANIMÉS — RÈGLE IMPÉRATIVE`,
          ``,
          ``,
          `Les GIF fournis totalisent **${Math.round(animationSeconds)} secondes d'animation**, soit environ **${animationWords} mots** de voix off nécessaires.`,
          ``,
          `Un GIF animé montre une **chronologie** : si la voix off est trop courte, l'animation défile trop vite ou est coupée, et le spectateur ne voit jamais la fin de la prévision. Pour chaque scène qui utilise un GIF :`,
          ``,
          `1. **Estime la durée de l'animation** à partir du nombre d'images qu'elle contient et de leur cadence (en moyenne **1 seconde par image** pour nos GIF de prévision).`,
          `2. **Calcule la voix off nécessaire** : environ **${WORDS_PER_SECOND} mots par seconde d'animation**, plus 2 à 3 mots de respiration.`,
          `3. **Indique explicitement cette estimation** dans le champ « Durée animation » de la scène.`,
          `4. **Règle de capacité globale** : la somme des durées d'animation ne doit pas dépasser **75 % de la durée du bulletin** (soit environ **${capShare} secondes** ici). Si les GIF dépassent cette limite, choisis une autre carte fixe pour certaines scènes.`,
          `5. Si un GIF dure **plus de 20 secondes**, réserve-lui l'essentiel d'une demi-durée et raccourcis fortement les scènes voisines.`,
          `6. Un GIF ne doit **jamais** être accompagné d'une voix off plus courte que sa durée d'animation : mieux vaut couvrir moins d'échéances que survoler toute l'animation.`,
          ``,
          `Exemple de calcul à reproduire mentalement : un GIF de 30 images à 1 image par seconde dure 30 secondes ; il faut donc environ **${Math.round(30 * WORDS_PER_SECOND)} mots** de voix off (30 × ${WORDS_PER_SECOND}) pour le commenter intégralement.`,
        ].join("\n")
      : [
          `## CALIBRAGE DES GIF ANIMÉS`,
          ``,
          `Aucun GIF animé n'est fourni pour ce bulletin : toutes les scènes utilisent des cartes fixes. Écris « Image fixe » dans le champ « Durée animation ».`,
        ].join("\n");

  return {
    totalWords,
    minWords,
    maxWords,
    animationWords,
    effectiveDuration,
    calibrageBlock: calibrageLines.join("\n"),
    gifBlock,
  };
}

// ponytail: Calibre dynamiquement le Prompt V2 officiel selon la durée, les scènes et les GIF
export function buildMasterPrompt(calibration?: Partial<PromptCalibration>): string {
  const sceneCount = Math.min(12, Math.max(2, Number(calibration?.sceneCount) || 5));
  const budget = buildPromptBudget({
    targetDuration: calibration?.targetDuration ?? 60,
    sceneCount,
    animationSeconds: calibration?.animationSeconds ?? 0,
    animationCount: calibration?.animationCount ?? 0,
  });

  return MASTER_PROMPT_V2
    .replace(
      /- Total des 5 voix off : \*\*166 à 176 mots\*\* \(cible : 171 mots\)\./,
      `- Total des ${sceneCount} voix off : **${budget.minWords} à ${budget.maxWords} mots** (cible : ${budget.totalWords} mots).`
    )
    .replace(
      /- Durée visée : environ \*\*60 secondes\*\*/,
      `- Durée visée : environ **${Math.round(budget.effectiveDuration)} secondes**`
    )
    .replace(
      /8\. Les 5 voix off totalisent 166 à 176 mots/,
      `8. Les ${sceneCount} voix off totalisent ${budget.minWords} à ${budget.maxWords} mots`
    );
}

function isMostlyUppercase(str: string): boolean {
  const letters = str.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (letters.length < 4) return false;
  const upper = str.replace(/[^A-ZÀ-Ÿ]/g, "");
  return upper.length / letters.length >= 0.72;
}

function formatInlineMarkdown(text: string, primaryColor: string = "#38bdf8"): string {
  if (!text) return "";
  return text
    // 1. Markdown ==surligné== ou <mark>...</mark>
    .replace(/==([^=]+)==/g, `<mark style="background: rgba(251, 191, 36, 0.22); color: #fef08a; font-weight: 700; padding: 1px 6px; border-radius: 4px; border-bottom: 2px solid #fbbf24; box-decoration-break: clone; -webkit-box-decoration-break: clone;">$1</mark>`)
    .replace(/<mark>([^<]+)<\/mark>/gi, `<mark style="background: rgba(251, 191, 36, 0.22); color: #fef08a; font-weight: 700; padding: 1px 6px; border-radius: 4px; border-bottom: 2px solid #fbbf24; box-decoration-break: clone; -webkit-box-decoration-break: clone;">$1</mark>`)
    // 2. Bold **texte** transformé en gras surligné / badge broadcast
    .replace(/\*\*([^*]+)\*\*/g, `<strong style="background: rgba(56, 189, 248, 0.16); color: #ffffff; font-weight: 700; padding: 1px 6px; border-radius: 4px; border-bottom: 2px solid ${primaryColor}; box-decoration-break: clone; -webkit-box-decoration-break: clone;">$1</strong>`)
    // 3. Italic *texte*
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export interface ParsedArticleOutput {
  title: string;
  excerpt: string;
  category: string;
  rawBody: string;
  htmlDark: string;
  /** Titre court pour les réseaux sociaux (TITRE PARTAGE). */
  socialTitle?: string;
  /** Paragraphe d'accroche pour les réseaux sociaux (PARAGRAPHE PARTAGE). */
  socialDescription?: string;
  /** Hashtags prêts à publier (HASHTAGS). */
  hashtags?: string;
  /** Description de l'image de couverture à produire (COUVERTURE IMAGE). */
  coverPrompt?: string;
  /** Ligne de post Facebook (POST FACEBOOK). */
  facebookPost?: string;
  /** Ligne de post LinkedIn (POST LINKEDIN). */
  linkedinPost?: string;
  /** Ligne de post TikTok (POST TIKTOK). */
  tiktokPost?: string;
  /** Hashtags spécifiques par plateforme. */
  facebookHashtags?: string;
  linkedinHashtags?: string;
  tiktokHashtags?: string;
  /** Ligne de post Twitter/X (POST TWITTER). */
  twitterPost?: string;
  /** Hashtags spécifiques Twitter/X. */
  twitterHashtags?: string;
}

/**
 * Convertit MOT POUR MOT le texte de l'article issu de ChatGPT en HTML stylé broadcast
 * selon la présentation choisie (1 à 5), avec titres en majuscules, texte en gras surligné,
 * et insertion automatique d'Image 1, Image 2, Image 3...
 */
export interface ParsedVideoScene {
  scene_number: number;
  badge: string;
  badge_color?: string;
  title: string;
  sub: string;
  location_tag: string;
  ticker: string;
  script_text: string;
  fileName: string;
  animation_duration?: string;
}

export function parseFullVideoScript(text: string): ParsedVideoScene[] {
  // Normalisation préalable : retours chariot Mac (CR isolé) et encadrés de
  // bloc markdown (```text ... ```) que ChatGPT ajoute parfois quand on lui
  // demande un fichier. Sans cela, tout le texte était vu comme une seule
  // ligne et aucune scène n'était reconnue.
  text = text.replace(/\r\n?/g, "\n").replace(/^\s*```[a-zA-Z]*\s*$/gm, "");

  const defaultBadges = ["SURVEILLANCE MÉTÉO", "ANALYSE MÉTÉO", "ZONES EXPOSÉES", "RAFALES MAXIMALES", "FORTES PLUIES"];
  const defaultTitles = ["RISQUE DE TEMPÊTE", "DÉPRESSIONS ATLANTIQUES", "LE NORD-OUEST EXPOSÉ", "POINTES À PLUS DE 100 KM/H", "SITUATION À SURVEILLER"];

  const scenes: ParsedVideoScene[] = [];
  // Découpe du document en blocs (un par scène). Le titre de scène peut être
  // collé au paragraphe précédent (ex. « ...fichier.SCÈNE 3 ») : on accepte
  // la balise en début de ligne OU après une ponctuation forte.
  const blocks: Array<{ num: number; body: string }> = [];
  const positions: Array<{ num: number; start: number; tagStart: number }> = [];
  // Les lignes du bloc de partage (TITRE PARTAGE / PARAGRAPHE PARTAGE /
  // HASHTAGS) ne font PAS partie du script vidéo : sans ce filtre, le
  // « TITRE PARTAGE » écrasait le titre de la dernière scène.
  const SOCIAL_KEYS_RE = /^\s*(?:\*\*)?(?:TITRE\s+PARTAGE|PARAGRAPHE\s+PARTAGE|DESCRIPTION\s+PARTAGE|HASHTAGS?)(?:\*\*)?\s*:/i;
  const headRe = /(?:^|\n|[.!?]\s*)(?:\s*(?:#+\s*|\*\*)*SC[ÈE]NE\s*(\d+)\b[^\n]*)/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headRe.exec(text)) !== null) {
    // On ne conserve que la fin de la balise « SCÈNE N … » : le lookbehind de
    // ponctuation ne fait pas partie du bloc, sinon le titre de la scène
    // suivante se retrouvait avalé dans la voix off précédente.
    const tagStart = hm.index + hm[0].indexOf("SC", Math.max(0, hm[0].toUpperCase().indexOf("SC")));
    positions.push({ num: Number(hm[1]), start: hm.index + hm[0].length, tagStart: tagStart >= 0 ? tagStart : hm.index });
  }
  positions.forEach((p, idx) => {
    const end = idx + 1 < positions.length ? positions[idx + 1].tagStart : text.length;
    blocks.push({ num: p.num, body: text.slice(p.start, end) });
  });

  for (const { num: scNum, body } of blocks) {
    let title = "";
    let sub = "";
    let badge = "";
    let location_tag = "FRANCE";
    let ticker = "";
    let script_text = "";
    let fileName = "";
    let animation_duration = "";
    // Les lignes de la voix off : après « Voix off Charon : », la suite du
    // paragraphe appartient à la même voix off, même si elle contient des
    // deux-points (« ...pour vents violents : le Nord, le Pas-de-Calais »).
    let inVoiceover = false;
    const voiceParts: string[] = [];

    /** Vrai si la ligne est une VRAIE clé de champ (« Image à utiliser : ... »). */
    const KNOWN_KEYS = /^(?:image\s*(?:à|a)?\s*utiliser|images?\b|visuel|fichier|échéance|echeance|durée\s*animation|duree\s*animation|badge|titre|sous-?titre|localisation|lieu|zone|bandeau|ticker|infos\s*m[ée]t[ée]o|voix\s*off|script|charon)/i;
    // La valeur peut être VIDE (« Voix off Charon : » puis le texte à la ligne
    // suivante) : c'est précisément le format renvoyé par ChatGPT et il était
    // ignoré, ce qui faisait perdre la totalité de la voix off.
    const isFieldLine = (line: string): boolean => {
      const kv = line.match(/^([^:]{1,40}):\s*(.*)$/);
      if (!kv) return false;
      const key = kv[1].trim().replace(/\*\*/g, "");
      return key.length <= 32 && KNOWN_KEYS.test(key);
    };

    const lines = body.split(/\r?\n/);
    for (const rawLine of lines) {
      const l = rawLine.trim().replace(/^[-*•]\s*/, "");
      if (!l) continue;

      // Ligne du bloc de partage : hors script vidéo, on l'ignore totalement.
      if (SOCIAL_KEYS_RE.test(l)) {
        inVoiceover = false;
        continue;
      }

      if (!isFieldLine(l)) {
        // Texte libre : suite de la voix off en cours (paragraphe multi-lignes).
        if (inVoiceover) voiceParts.push(l);
        continue;
      }

      const kv = l.match(/^([^:]{1,40}):\s*(.*)$/)!;
      const k = kv[1].toLowerCase().trim().replace(/\*\*/g, "");
      const v = kv[2].trim().replace(/\*\*/g, "");

      if (k.includes("voix off") || k.includes("script") || k === "charon" || k.includes("voix-off")) {
        inVoiceover = true;
        const first = v.replace(/^["«]|["»]$/g, "").trim();
        if (first) voiceParts.push(first);
        continue;
      }

      // Toute autre clé de champ termine la voix off.
      inVoiceover = false;

      if (k.includes("bandeau") || k.includes("ticker") || k.includes("infos meteo")) {
        ticker = v;
      } else if (k.includes("localisation") || k.includes("lieu") || k === "zone") {
        location_tag = v.toUpperCase();
      } else if (k.startsWith("sous-titre") || k.startsWith("sous titre") || k === "sub") {
        sub = v.toUpperCase();
      } else if (k.startsWith("titre") || k === "title") {
        title = v.toUpperCase();
      } else if (k.includes("badge")) {
        badge = v.toUpperCase();
      } else if (k.includes("image") || k.includes("visuel") || k.includes("fichier")) {
        // Détection prioritaire de la photo de couverture
        if (/couvert|cover/i.test(v)) {
          fileName = "Photo de couverture";
        } else {
          // On privilégie « Image à utiliser » sur « Visuel complémentaire ».
          const isMainImage = k.includes("image") && !k.includes("compl");
          const fnM = v.match(/(?:Image\s*\d+\s*[-—–]\s*)?([^—–\n:]+\.(?:png|jpg|jpeg|gif|webp))/i);
          if (fnM && (isMainImage || !fileName)) {
            fileName = fnM[1].trim();
          } else if (!fnM && !fileName) {
            fileName = v;
          }
        }
      } else if (k.includes("duree") || k.includes("durée") || k.includes("animation")) {
        animation_duration = v;
      }
    }
    script_text = voiceParts.join(" ").replace(/\s+/g, " ").trim();

    if (!script_text) {
      const voMatch = body.match(/Voix\s+off(?:\s+Charon)?[^:\n]*:\s*(?:[«"]([^»"]+)[»"]|([^\n]+(?:\n(?!(?:Bandeau|Localisation|Sous-titre|Titre|Badge|Image|Dur[ée]e|SC[ÈE]NE|\*\*))[^\n]+)*))/i);
      if (voMatch) {
        script_text = (voMatch[1] || voMatch[2] || "").trim().replace(/^["«]|["»]$/g, "").trim();
      }
    }

    const idx = scenes.length;
    scenes.push({
      scene_number: scNum,
      title: title || defaultTitles[idx % defaultTitles.length],
      sub: sub || "",
      badge: badge || defaultBadges[idx % defaultBadges.length],
      ticker: ticker || "",
      location_tag: location_tag || "FRANCE",
      fileName: fileName || "",
      script_text: script_text || "",
      animation_duration: animation_duration || ""
    });
  }

  // Fallback si la structure SCÈNE N n'a pas été détectée mais que le texte contient des cartes isolées
  if (scenes.length === 0) {
    const cardSplits = text.split(/(?=(?:^|\n)\s*Bandeau Infos M[ée]t[ée]o\s*:)/i);
    for (let i = 0; i < cardSplits.length; i++) {
      const block = cardSplits[i];
      if (!block.toLowerCase().includes("image à utiliser") && !block.toLowerCase().includes("voix off")) continue;
      const card = { title: "", sub: "", badge: "", ticker: "", location: "FRANCE", fileName: "", script_text: "" };
      const lines = block.split(/\r?\n/);
      for (const l of lines) {
        const kv = l.trim().match(/^([^:]+):\s*(.+)$/);
        if (kv) {
          const k = kv[1].toLowerCase().trim();
          const v = kv[2].trim();
          if (k.includes("bandeau") || k.includes("ticker")) card.ticker = v;
          else if (k.includes("localisation") || k.includes("lieu")) card.location = v.toUpperCase();
          else if (k.startsWith("sous-titre") || k.startsWith("sous titre")) card.sub = v.toUpperCase();
          else if (k.startsWith("titre")) card.title = v.toUpperCase();
          else if (k.includes("badge")) card.badge = v.toUpperCase();
          else if (k.includes("voix off")) card.script_text = v.replace(/^["«]|["»]$/g, "").trim();
          else if (k.includes("image")) {
            const fnM = v.match(/(?:Image\s*\d+\s*[-—–]\s*)?([^—–\n:]+\.(?:png|jpg|jpeg|gif|webp))/i);
            card.fileName = fnM ? fnM[1].trim() : v;
          }
        }
      }
      if (card.title || card.badge || card.script_text) {
        const scNum = scenes.length + 1;
        scenes.push({
          scene_number: scNum,
          title: card.title || defaultTitles[(scNum - 1) % defaultTitles.length],
          sub: card.sub || "",
          badge: card.badge || defaultBadges[(scNum - 1) % defaultBadges.length],
          ticker: card.ticker || "",
          location_tag: card.location || "FRANCE",
          fileName: card.fileName || "",
          script_text: card.script_text || ""
        });
      }
    }
  }

  return scenes;
}

export function buildWordForWordArticleHtml(
  rawText: string,
  theme: ArticleTheme,
  imagesByRef: Record<number, { url: string; name: string }>
): ParsedArticleOutput | null {
  // Normalisation : retours chariot Mac et encadrés de bloc markdown ajoutés
  // par ChatGPT lorsqu'il livre un fichier .txt.
  rawText = rawText.replace(/\r\n?/g, "\n").replace(/^\s*```[a-zA-Z]*\s*$/gm, "");

  // 1. Extraire les scènes complètes du script vidéo (LIVRABLE 2)
  const parsedVideoScenes = parseFullVideoScript(rawText);
  const sceneCount = parsedVideoScenes.length || 5;

  function getVoiceoverForImage(
    imgNum: number,
    imgObj?: { url: string; name: string }
  ): { scene: ParsedVideoScene } | null {
    if (parsedVideoScenes.length === 0) return null;

    const imgName = (imgObj?.name || "").toLowerCase();

    // 1. Par nom de fichier exact dans les scènes vidéo
    for (const sc of parsedVideoScenes) {
      if (sc.fileName) {
        const cleanScFile = sc.fileName.toLowerCase().replace(/\.[^.]+$/, "");
        if (imgName.includes(cleanScFile) || cleanScFile.includes(imgName.replace(/\.[^.]+$/, ""))) {
          return { scene: sc };
        }
      }
    }

    // 2. Par sémantique sur le nom de fichier ou la modélisation
    if (imgName.includes("500-hpa") || imgName.includes("geopotentiel")) {
      const sc2 = parsedVideoScenes.find(s => s.scene_number === 2);
      if (sc2) return { scene: sc2 };
    }
    if (imgName.includes("pluie") || imgName.includes("cumul")) {
      const sc5 = parsedVideoScenes.find(s => s.scene_number === 5);
      if (sc5) return { scene: sc5 };
    }
    if (imgName.includes("1792338497854") || imgName.includes("108")) {
      const sc4 = parsedVideoScenes.find(s => s.scene_number === 4);
      if (sc4) return { scene: sc4 };
    }
    if (imgName.includes("1792338479555")) {
      const sc3 = parsedVideoScenes.find(s => s.scene_number === 3);
      if (sc3) return { scene: sc3 };
    }
    if (imgName.includes("1792338443593")) {
      const sc1 = parsedVideoScenes.find(s => s.scene_number === 1);
      if (sc1) return { scene: sc1 };
    }

    // 3. Correspondance directe par numéro d'image si entre 1 et 5
    if (imgNum >= 1 && imgNum <= 5) {
      const sc = parsedVideoScenes.find(s => s.scene_number === imgNum);
      if (sc) return { scene: sc };
    }

    return null;
  }

  function renderVoiceoverCard(voiceInfo: { scene: ParsedVideoScene } | null): string {
    if (!voiceInfo?.scene?.script_text) return "";
    const sc = voiceInfo.scene;
    const badgeBadge = sc.badge ? `<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">${sc.badge}</span>` : "";
    const titleLabel = sc.title ? ` — ${sc.title}` : "";
    const tickerHtml = sc.ticker ? `
      <div style="font-size: 12.5px; color: #fbbf24; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>📡</span> <span>Bandeau TV : ${sc.ticker}</span>
      </div>` : "";

    return `
    <div style="margin-top: 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.35); border-left: 4px solid #38bdf8; border-radius: 8px; padding: 12px 16px; text-align: left;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 13px;">🎙️</span>
          <span style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.06em;">Séquence Vidéo Broadcast (Scène ${sc.scene_number}${titleLabel}) :</span>
        </div>
        ${badgeBadge}
      </div>
      ${tickerHtml}
      <p style="margin: 0; font-size: 14px; color: #f1f5f9; font-style: italic; line-height: 1.6;">
        « ${sc.script_text} »
      </p>
    </div>`;
  }

  function generateSmartCaption(fileName: string, refNum: number): string {
    const clean = (fileName || "").replace(/\.[^.]+$/, "").toLowerCase();

    if (clean.includes("geopotentiel") || clean.includes("500-hpa") || clean.includes("500hpa")) {
      return "Géopotentiel à 500 hPa et pression au sol (Europe et Atlantique Nord) — Modélisation synoptique Météo-Climat Pro.";
    }
    if (clean.includes("rafales") || clean.includes("vent") || clean.includes("gust")) {
      if (clean.includes("france")) {
        return "Simulation des rafales maximales de vent (km/h) sur la France métropolitaine — Modèle haute résolution Météo-Climat Pro.";
      }
      return "Modélisation des rafales de vent et champs de pression en surface — Météo-Climat Pro.";
    }
    if (clean.includes("pluie") || clean.includes("precip") || clean.includes("rain") || clean.includes("cumul")) {
      return "Modélisation des cumuls de précipitations et précipitations attendues — Météo-Climat Pro.";
    }
    if (clean.includes("temperature") || clean.includes("temp") || clean.includes("2m")) {
      return "Champ des températures modélisées à 2 mètres — Météo-Climat Pro.";
    }
    if (clean.includes("satellite") || clean.includes("radar") || clean.includes("ir")) {
      return "Imagerie satellite et nébulosité modélisée — Météo-Climat Pro.";
    }

    const niceName = fileName
      ? fileName.replace(/\.[^.]+$/, "").replace(/^[a-z0-9]+_\d+_/i, "").replace(/[_-]+/g, " ")
      : `Figure ${refNum}`;
    return `Modélisation cartographique et analyse atmosphérique (${niceName}) — Météo-Climat Pro.`;
  }

  // Extraire la partie article.
  //
  // BUG corrigé : beaucoup de réponses oublient « === DEBUT ARTICLE === » mais
  // conservent « === FIN ARTICLE === » et placent APRÈS elle le bloc de partage
  // (TITRE PARTAGE / PARAGRAPHE PARTAGE / HASHTAGS). L'ancienne découpe
  // s'arrêtait à « SCÈNE 1 », ce qui supprimait ce bloc : les trois champs
  // ressortaient vides et étaient inutilisables pour Facebook/TikTok.
  let articleBlock = rawText;
  const fullMatch = rawText.match(/===\s*DEBUT ARTICLE\s*===([\s\S]*?)===\s*FIN ARTICLE\s*===/i);
  const endOnlyMatch = !fullMatch
    ? rawText.match(/^([\s\S]*?)===\s*FIN ARTICLE\s*===/i)
    : null;

  if (fullMatch && fullMatch[1]?.trim()) {
    articleBlock = fullMatch[1].trim();
  } else if (endOnlyMatch && endOnlyMatch[1]?.trim()) {
    // Pas de marqueur de début : tout ce qui précède === FIN ARTICLE === est
    // l'article (l'en-tête « LIVRABLE 1 » éventuel sera ignoré au parsing).
    articleBlock = endOnlyMatch[1].trim();
  } else {
    const beforeScene1 = rawText.split(/(?:^|\n)\s*(?:#+\s*|\*\*)*SC[ÈE]NE\s+1\b/i)[0]?.trim();
    if (beforeScene1 && beforeScene1.length > 60) {
      articleBlock = beforeScene1;
    } else if (/^\s*(?:#+\s*|\*\*)*SC[ÈE]NE\s+1\b/i.test(rawText.trim())) {
      // Il n'y a que les scènes vidéo dans le texte collé
      return null;
    }
  }

  articleBlock = articleBlock.replace(/===\s*(?:DEBUT|FIN)\s*ARTICLE\s*===/gi, "").trim();
  if (!articleBlock || articleBlock.length < 30) return null;

  // Bloc de partage réseaux sociaux (couverture, titre, paragraphe, hashtags,
  // posts Facebook/LinkedIn/TikTok et leurs hashtags dédiés).
  // Il est EXTRAIT du corps : sans cela, ces lignes brutes (« TITRE PARTAGE :
  // … », « HASHTAGS : #… ») se retrouvaient publiées en clair au bas de
  // l'article sur les sites.
  const social = {
    coverPrompt: "",
    socialTitle: "",
    socialDescription: "",
    hashtags: "",
    facebookPost: "",
    linkedinPost: "",
    tiktokPost: "",
    facebookHashtags: "",
    linkedinHashtags: "",
    tiktokHashtags: "",
    twitterPost: "",
    twitterHashtags: "",
  };
  {
    // Le bloc de partage peut se trouver après « === FIN ARTICLE === »
    // (cas fréquent des réponses ChatGPT) : on cherche dans TOUT le texte,
    // pas seulement dans la partie article déjà découpée.
    const grab = (re: RegExp) => {
      const m = rawText.match(re) || articleBlock.match(re);
      return m ? m[1].replace(/\*\*/g, "").replace(/^["«]|["»]$/g, "").trim() : "";
    };
    const line = (label: string) =>
      new RegExp(`(?:^|\\n)\\s*(?:\\*\\*)?${label}(?:\\*\\*)?\\s*:\\s*([^\\n]+)`, "i");

    social.coverPrompt = grab(line("COUVERTURE\\s+IMAGE"));
    social.socialTitle = grab(line("TITRE\\s+PARTAGE"));
    social.socialDescription = grab(line("(?:PARAGRAPHE|DESCRIPTION)\\s+PARTAGE"));

    // Hashtags : on distingue les variantes par plateforme AVANT la générique,
    // sinon « HASHTAGS FACEBOOK : » serait capté par « HASHTAGS : ».
    social.facebookHashtags = grab(line("HASHTAGS\\s+FACEBOOK"));
    social.linkedinHashtags = grab(line("HASHTAGS\\s+LINKEDIN"));
    social.tiktokHashtags = grab(line("HASHTAGS\\s+TIKTOK"));
    social.twitterHashtags = grab(line("HASHTAGS\\s+(?:TWITTER|X)"));
    social.hashtags = grab(/(?:^|\n)\s*(?:\*\*)?HASHTAGS?(?:\*\*)?\s*:\s*([^\n]+)/i);

    social.facebookPost = grab(line("POST\\s+FACEBOOK"));
    social.linkedinPost = grab(line("POST\\s+LINKEDIN"));
    social.tiktokPost = grab(line("POST\\s+TIKTOK"));
    social.twitterPost = grab(line("POST\\s+(?:TWITTER|X)"));

    // Lignes de plateforme retirées en premier : elles commencent par
    // « HASHTAGS FACEBOOK : » et seraient sinon partiellement retirées par la
    // règle générique « HASHTAGS : ».
    articleBlock = articleBlock
      .replace(/(?:^|\n)\s*(?:\*\*)?COUVERTURE\s+IMAGE(?:\*\*)?\s*:\s*[^\n]+/gi, "")
      .replace(/(?:^|\n)\s*(?:\*\*)?HASHTAGS\s+(?:FACEBOOK|LINKEDIN|TIKTOK)(?:\*\*)?\s*:\s*[^\n]+/gi, "")
      .replace(/(?:^|\n)\s*(?:\*\*)?POST\s+(?:FACEBOOK|LINKEDIN|TIKTOK)(?:\*\*)?\s*:\s*[^\n]+/gi, "")
      .replace(/(?:^|\n)\s*(?:\*\*)?TITRE\s+PARTAGE(?:\*\*)?\s*:\s*[^\n]+/gi, "")
      .replace(/(?:^|\n)\s*(?:\*\*)?(?:PARAGRAPHE|DESCRIPTION)\s+PARTAGE(?:\*\*)?\s*:\s*[^\n]+/gi, "")
      .replace(/(?:^|\n)\s*(?:\*\*)?HASHTAGS?(?:\*\*)?\s*:\s*[^\n]+/gi, "")
      .trim();
  }

  // Le texte du LIVRABLE 2 peut mentionner « cinq scènes » même lorsque le
  // studio en demande un autre nombre : on aligne la formulation.
  if (sceneCount !== 5) {
    articleBlock = articleBlock.replace(/cinq scènes/gi, `${sceneCount} scènes`);
  }

  const lines = articleBlock.split(/\r?\n/);
  let title = "";
  let excerpt = "";
  let category = "Actualités Météo";
  const bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const seoMatch = l.match(/^(?:\*\*)?TITRE(?:\s+SEO|\s+PRINCIPAL)?(?:\*\*)?\s*:\s*(.+)$/i);
    if (seoMatch && !title) {
      title = seoMatch[1].replace(/^["«]|["»]$/g, "").replace(/\*\*/g, "").trim();
      continue;
    }
    const chapMatch = l.match(/^(?:\*\*)?(?:CHAPEAU|EXTRAIT|EXCERPT|RÉSUMÉ COURT)(?:\*\*)?\s*:\s*(.+)$/i);
    if (chapMatch && !excerpt) {
      excerpt = chapMatch[1].replace(/\*\*/g, "").trim();
      continue;
    }
    const catMatch = l.match(/^(?:\*\*)?CAT[ÉE]GORIE(?:\*\*)?\s*:\s*(.+)$/i);
    if (catMatch) {
      category = catMatch[1].replace(/\*\*/g, "").trim();
      continue;
    }
    bodyLines.push(lines[i]);
  }

  // Récupération des sections déterminantes si ChatGPT les a déportées à la fin du prompt
  if (!articleBlock.toLowerCase().includes("facteurs d") && !articleBlock.toLowerCase().includes("facteur")) {
    const factMatch = rawText.match(/(?:^|\n)\s*[-*•]?\s*(?:\*\*)?Facteurs\s+d[ée]terminants[^*:\n]*:\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:Indicateurs|SC[ÈE]NE|\n\n[A-Z]|$))/i);
    if (factMatch && factMatch[1]?.trim()) {
      bodyLines.push("\n**🎯 LES FACTEURS DÉTERMINANTS À SURVEILLER**\n");
      const items = factMatch[1].trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith("-") || l.startsWith("*"));
      bodyLines.push(...items);
    }
  }

  if (!articleBlock.toLowerCase().includes("indicateurs cl") && !articleBlock.toLowerCase().includes("indicateur")) {
    const indMatch = rawText.match(/(?:^|\n)\s*[-*•]?\s*(?:\*\*)?Indicateurs\s+cl[ée]s[^*:\n]*:\s*(?:\*\*)?\s*([\s\S]*?)(?=(?:Facteurs|SC[ÈE]NE|\n\n[A-Z]|$))/i);
    if (indMatch && indMatch[1]?.trim()) {
      bodyLines.push("\n**📊 PRINCIPAUX INDICATEURS CLÉS**\n");
      const items = indMatch[1].trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith("-") || l.startsWith("*"));
      bodyLines.push(...items);
    }
  }

  // Détecter les titres H1 et H2 majuscules en tête d'article (ex: SUJET COURT et SOUS-TITRE EXPLICATIF)
  let topH1 = "";
  let topH2 = "";
  let bodyStartIndex = 0;

  while (bodyStartIndex < bodyLines.length && !bodyLines[bodyStartIndex].trim()) {
    bodyStartIndex++;
  }

  if (bodyStartIndex < bodyLines.length) {
    const l0 = bodyLines[bodyStartIndex].trim();
    const isL0Caps = l0.length >= 4 && l0.length <= 130 && isMostlyUppercase(l0) && !l0.startsWith("-") && !l0.startsWith("*") && !l0.startsWith("|");
    if (l0.startsWith("# ") || isL0Caps) {
      topH1 = l0.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
      bodyStartIndex++;

      while (bodyStartIndex < bodyLines.length && !bodyLines[bodyStartIndex].trim()) {
        bodyStartIndex++;
      }

      if (bodyStartIndex < bodyLines.length) {
        const l1 = bodyLines[bodyStartIndex].trim();
        const isL1Caps = l1.length >= 4 && l1.length <= 160 && isMostlyUppercase(l1) && !l1.startsWith("-") && !l1.startsWith("*") && !l1.startsWith("|");
        if (l1.startsWith("## ") || l1.startsWith("# ") || isL1Caps || /^SOUS-TITRE/i.test(l1)) {
          topH2 = l1.replace(/^#+\s*/, "").replace(/^SOUS-TITRE(?:\s+EXPLICATIF)?\s*:\s*/i, "").replace(/\*\*/g, "").trim();
          bodyStartIndex++;
        }
      }
    }
  }

  if (!title) {
    title = topH1 || "Point météo et analyse synoptique — Météo-Climat Pro";
  }

  // Construction HTML fidèle mot pour mot avec présentation broadcast
  const htmlParts: string[] = [];
  htmlParts.push(
    `<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #f1f5f9; line-height: 1.85; font-size: 16px;">`
  );

  // Badge de présentation en haut de l'article
  htmlParts.push(
    `<div style="margin-bottom: 14px;"><span style="display: inline-block; background: ${theme.boxBgDark}; color: ${theme.primaryDark}; border: 1px solid ${theme.boxBorderDark}; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;">${theme.badge} • Météo-Climat Pro</span></div>`
  );

  if (topH1) {
    htmlParts.push(
      `<h1 style="color: #ffffff; font-size: 26px; font-weight: 900; line-height: 1.35; text-transform: uppercase; letter-spacing: 0.04em; margin: 14px 0 8px 0;">${topH1.toUpperCase()}</h1>`
    );
  }

  if (topH2) {
    htmlParts.push(
      `<h2 style="color: ${theme.primaryDark}; font-size: 18px; font-weight: 800; line-height: 1.4; text-transform: uppercase; letter-spacing: 0.03em; margin: 0 0 24px 0; border-bottom: 2px solid ${theme.primaryDark}; padding-bottom: 8px;">${topH2.toUpperCase()}</h2>`
    );
  }

  let i = bodyStartIndex;
  let hasRenderedChapeau = false;
  const usedImageRefs = new Set<number>();

  // Les cartes non citées par l'article sont réparties uniformément sur tout
  // le corps EN FIN de construction (voir la boucle dédiée plus bas) : un seul
  // point de décision évite les cartes orphelines et les doublons.

  /** File d'attente des cartes restant à placer, dans l'ordre de référence. */
  function buildPendingQueue(): number[] {
    return Object.keys(imagesByRef)
      .map(Number)
      .filter(n => imagesByRef[n]?.url && !usedImageRefs.has(n))
      .sort((a, b) => a - b);
  }

  /** Rend UNE carte (figure + légende + carte voix off). Idempotent. */
  function renderSingleMap(refNum: number): string {
    const imgObj = imagesByRef[refNum];
    if (!imgObj?.url) return "";
    // Garde anti-doublon : une même carte ne peut être rendue deux fois,
    // même si elle est réclamée par deux chemins du parseur.
    if (usedImageRefs.has(refNum)) return "";
    usedImageRefs.add(refNum);
    const voiceInfo = getVoiceoverForImage(refNum, imgObj);
    const voiceCardHtml = renderVoiceoverCard(voiceInfo);
    const caption = generateSmartCaption(imgObj.name, refNum);

    return `
  <div style="margin: 30px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
    <img src="${imgObj.url}" alt="${caption.replace(/"/g, "&quot;")}" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
    <p style="font-size: 13.5px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
      <strong style="background: rgba(56, 189, 248, 0.2); color: #ffffff; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11.5px; margin-right: 6px;">FIGURE ${refNum}</strong> ${caption}
    </p>${voiceCardHtml}
  </div>`;
  }

  /**
   * LEGACY (désactivé) : regroupait toutes les cartes non citées dans un bloc
   * « MODÉLISATIONS CARTOGRAPHIQUES » en fin d'article, ce qui concentrait
   * jusqu'à 6 cartes sur 10 après 68 % du texte. Conservé pour référence.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function renderComplementaryMaps(): string {
    const allProvidedRefs = Object.keys(imagesByRef)
      .map(Number)
      .filter(n => imagesByRef[n]?.url)
      .sort((a, b) => a - b);

    const unusedRefs = allProvidedRefs.filter(n => !usedImageRefs.has(n));
    if (unusedRefs.length === 0) return "";

    const parts: string[] = [];
    parts.push(`
  <h3 style="color: ${theme.primaryDark}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid ${theme.primaryDark}; padding-bottom: 8px;">
    🗺️ MODÉLISATIONS CARTOGRAPHIQUES & ANALYSES COMPLÉMENTAIRES
  </h3>
  <p style="margin-bottom: 16px; color: #cbd5e1; font-size: 15.5px; line-height: 1.8;">
    Retrouvez ci-dessous l'ensemble des modélisations numériques et simulations complémentaires analysées par nos météorologues pour le suivi de cette situation.
  </p>`);

    for (const refNum of unusedRefs) {
      const imgObj = imagesByRef[refNum];
      if (!imgObj?.url) continue;

      usedImageRefs.add(refNum);
      const voiceInfo = getVoiceoverForImage(refNum, imgObj);
      const voiceCardHtml = renderVoiceoverCard(voiceInfo);
      const caption = generateSmartCaption(imgObj.name, refNum);

      parts.push(`
  <div style="margin: 28px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
    <img src="${imgObj.url}" alt="${caption.replace(/"/g, "&quot;")}" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
    <p style="font-size: 13.5px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
      <strong style="background: rgba(56, 189, 248, 0.2); color: #ffffff; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11.5px; margin-right: 6px;">FIGURE ${refNum}</strong> ${caption}
    </p>${voiceCardHtml}
  </div>`);
    }

    return parts.join("\n");
  }

  while (i < bodyLines.length) {
    const rawLine = bodyLines[i];
    const line = rawLine.trim();

    if (!line || line === "---") {
      i++;
      continue;
    }

    // Les cartes non citées sont réparties après coup sur le document complet
    // (voir la boucle finale) : on n'intercale rien ici pour éviter que les
    // dernières cartes ne s'agglutinent dans les sections de fin.

    // 1. Détection universelle des balises d'insertion d'image
    let isImageTag = false;
    let imgNum: number | null = null;
    let rawCaption = "";

    const explicitTagMatch =
      line.match(/^\[?\s*(?:IMAGE|CARTE|FIGURE)\s*(\d+)(?:\s*(?:À|A)\s*INS[ÉE]RER)?\s*(?:[:—-]\s*(.*))?\]?$/i) ||
      line.match(/^\*\*(?:Image|Carte|Figure)\s*(\d+)(?:\s*(?:À|A)\s*INS[ÉE]RER)?\s*[:—-]?\*\*\s*(.*)$/i) ||
      line.match(/^(?:\[?\s*(?:IMAGE|CARTE|FIGURE)\s*(\d+)(?:\s*(?:À|A)\s*INS[ÉE]RER)?[^\]\n]*\]?)\s*[:—-]?\s*(.*)$/i);

    if (explicitTagMatch) {
      isImageTag = true;
      imgNum = Number(explicitTagMatch[1]) || 1;
      rawCaption = explicitTagMatch[2] ? explicitTagMatch[2].replace(/\]$/, "").trim() : "";
    } else {
      const inlineTagMatch = line.match(/(?:\[|\b)(?:IMAGE|CARTE|FIGURE)\s*(\d+)(?:\s*(?:À|A)\s*INS[ÉE]RER)?\s*[:—-]\s*(.*)/i);
      if (inlineTagMatch) {
        isImageTag = true;
        imgNum = Number(inlineTagMatch[1]) || 1;
        rawCaption = inlineTagMatch[2].replace(/\]$/, "").trim();
      } else {
        // Vérifier si la ligne cite directement un des noms de fichiers uploadés
        for (const [refStr, imgInfo] of Object.entries(imagesByRef)) {
          const refN = Number(refStr);
          const cleanName = imgInfo.name.replace(/\.[^.]+$/, "");
          if (cleanName.length > 8 && line.includes(cleanName) && (line.toLowerCase().includes("image") || line.toLowerCase().includes("carte") || line.toLowerCase().includes("figure") || line.toLowerCase().includes("fichier") || line.includes("—") || line.includes(":"))) {
            isImageTag = true;
            imgNum = refN;
            rawCaption = line;
            break;
          }
        }
      }
    }

    if (isImageTag && imgNum !== null) {
      // Découper si un titre ou sous-section a été collé à la fin de la légende
      const splitHeaderRegex = /(?<=[.!?])\s*(?=(?:Comprendre\b|Les conséquences\b|À ne pas interpréter\b|TROIS SITUATIONS\b|NIVEAU\s+\d+|Les\s+\d+\s+facteurs\b|Fiabilité\b|FAQ\b|Conclusion\b|En résumé\b|[A-ZÀ-Ÿ\s]{5,}:?))/;
      const parts = rawCaption.split(splitHeaderRegex);
      let caption = parts[0].trim();
      if (parts.length > 1) {
        const trailingHeader = parts.slice(1).join(" ").trim();
        if (trailingHeader) {
          bodyLines.splice(i + 1, 0, `**${trailingHeader}**`);
        }
      }

      caption = caption
        .replace(/^(?:IMAGE\s*\d+\s*(?:À|A)\s*INS[ÉE]RER\s*[:—-]\s*)?/i, "")
        .replace(/^(?:Fichier\s*:\s*)?[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|gif|webp)\s*[:—-]\s*/i, "")
        .replace(/^(?:Légende\s*:\s*)/i, "")
        .replace(/\]$/, "")
        .trim();

      let matchedObj: { url: string; name: string } | undefined = undefined;
      for (const info of Object.values(imagesByRef)) {
        const cleanName = info.name.replace(/\.[^.]+$/, "");
        if (cleanName.length > 8 && (line.includes(cleanName) || rawCaption.includes(cleanName))) {
          matchedObj = info;
          break;
        }
      }

      if (!matchedObj || !matchedObj.url) {
        matchedObj = imagesByRef[imgNum];
      }

      // Anti-doublon : si l'image résolue est déjà affichée, on prend la
      // première carte encore libre au lieu de la répéter. Auparavant, le
      // fallback ci-dessous réaffichait la même carte sous plusieurs numéros.
      const findRefByUrl = (url: string): number | null => {
        for (const [refStr, info] of Object.entries(imagesByRef)) {
          if (info.url === url) return Number(refStr);
        }
        return null;
      };
      if (matchedObj?.url) {
        const refOfMatch = findRefByUrl(matchedObj.url);
        if (refOfMatch !== null && usedImageRefs.has(refOfMatch)) {
          const freeRef = Object.keys(imagesByRef)
            .map(Number)
            .sort((a, b) => a - b)
            .find(n => imagesByRef[n]?.url && !usedImageRefs.has(n));
          if (freeRef !== undefined) {
            matchedObj = imagesByRef[freeRef];
          } else {
            // Toutes les cartes sont déjà affichées : on saute le doublon.
            i++;
            continue;
          }
        }
      }

      if (!matchedObj || !matchedObj.url) {
        const allImgs = Object.values(imagesByRef).filter(img => img.url);
        if (allImgs.length > 0) {
          matchedObj = allImgs[(imgNum - 1) % allImgs.length];
        }
      }

      usedImageRefs.add(imgNum);
      // Le fallback ci-dessus peut réutiliser une carte déjà affichée :
      // on l'enregistre aussi pour que la file de répartition ne la repose pas.
      for (const [refStr, info] of Object.entries(imagesByRef)) {
        if (matchedObj && info.url === matchedObj.url) usedImageRefs.add(Number(refStr));
      }

      if (!caption) {
        caption = matchedObj ? `Modélisation météorologique Météo-Climat Pro (${matchedObj.name.replace(/\.[^.]+$/, "")})` : `Carte météorologique — Figure ${imgNum}`;
      }

      const voiceInfo = getVoiceoverForImage(imgNum, matchedObj);
      const voiceCardHtml = renderVoiceoverCard(voiceInfo);

      if (matchedObj?.url) {
        htmlParts.push(`
  <div style="margin: 28px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
    <img src="${matchedObj.url}" alt="${caption.replace(/"/g, "&quot;")}" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
    <p style="font-size: 13.5px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
      <strong style="background: rgba(56, 189, 248, 0.2); color: #ffffff; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11.5px; margin-right: 6px;">FIGURE ${imgNum}</strong> ${formatInlineMarkdown(caption, theme.primaryDark)}
    </p>${voiceCardHtml}
  </div>`);
      } else {
        htmlParts.push(`
  <div style="margin: 20px 0; padding: 14px; border: 1px dashed ${theme.primaryDark}; border-radius: 8px; text-align: center; color: #94a3b8; font-size: 13px;">
    📌 Emplacement <strong>FIGURE ${imgNum}</strong> (${formatInlineMarkdown(caption, theme.primaryDark)}) — <em>Image associée.</em>
  </div>`);
      }
      i++;
      continue;
    }

    // 2. Chapeau éditorial (premier paragraphe narratif de l'article)
    if (!hasRenderedChapeau && line.length > 50 && !line.startsWith("-") && !line.startsWith("*") && !line.startsWith("|")) {
      if (!excerpt) {
        excerpt = line.replace(/\*\*/g, "").slice(0, 260);
      }
      htmlParts.push(
        `<div style="font-size: 17px; font-weight: 500; color: #f8fafc; line-height: 1.85; background: rgba(15, 23, 42, 0.45); border-left: 4px solid ${theme.primaryDark}; border-radius: 4px; padding: 16px 20px; margin: 20px 0 26px 0;">${formatInlineMarkdown(line, theme.primaryDark)}</div>`
      );
      hasRenderedChapeau = true;
      i++;
      continue;
    }

    // 3. Tableaux Markdown (| Col 1 | Col 2 | ...)
    if (line.startsWith("|") && line.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < bodyLines.length && bodyLines[i].trim().startsWith("|")) {
        tableLines.push(bodyLines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const rows = tableLines
          .filter(tl => !/^\|[\s:|-]+\|$/.test(tl))
          .map(tl =>
            tl
              .replace(/^\||\|$/g, "")
              .split("|")
              .map(c => c.trim())
          );

        if (rows.length >= 1) {
          const headers = rows[0];
          const dataRows = rows.slice(1);
          htmlParts.push(`
  <div style="overflow-x: auto; margin: 26px 0;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left; background: rgba(15, 23, 42, 0.6); border-radius: 8px; overflow: hidden; border: 1px solid rgba(56, 189, 248, 0.25);">
      <thead>
        <tr style="background: ${theme.tableHeaderBgDark}; color: ${theme.primaryDark}; border-bottom: 1px solid rgba(56, 189, 248, 0.3);">
          ${headers.map(h => `<th style="padding: 12px 14px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em; font-size: 13px;">${formatInlineMarkdown(h, theme.primaryDark)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${dataRows
          .map(
            r => `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
          ${r
            .map(
              (cell, cIdx) =>
                `<td style="padding: 12px 14px; color: ${cIdx === 0 ? "#ffffff" : "#cbd5e1"}; font-weight: ${cIdx === 0 ? "700" : "400"};">${formatInlineMarkdown(cell, theme.primaryDark)}</td>`
            )
            .join("")}
        </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>`);
        }
      }
      continue;
    }

    // 4. Listes à puces avec surlignage des indicateurs clés
    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < bodyLines.length && /^[-*•]\s+/.test(bodyLines[i].trim())) {
        let it = bodyLines[i].trim().replace(/^[-*•]\s+/, "");
        const colonMatch = it.match(/^([^:]{3,65})\s*:\s*(.+)$/);
        if (colonMatch && !colonMatch[1].includes("**") && !colonMatch[1].includes("<strong")) {
          it = `**${colonMatch[1].trim()} :** ${colonMatch[2].trim()}`;
        } else {
          const numPrefixMatch = it.match(/^((?:Jusqu'à\s+)?\d+(?:\s*(?:à|-)\s*\d+)?\s*(?:km\/h|mm|hPa|°C|degrés)[^.,;:]*?)(?:[,—:]|\s{2,}|\b)\s*(.*)$/i);
          if (numPrefixMatch && !it.includes("**") && !it.includes("<strong")) {
            it = `**${numPrefixMatch[1].trim()}** — ${numPrefixMatch[2].trim()}`;
          }
        }
        items.push(it);
        i++;
      }
      htmlParts.push(`
  <div style="background: ${theme.boxBgDark}; border-left: 5px solid ${theme.boxBorderDark}; border-radius: 8px; padding: 18px 22px; margin: 22px 0;">
    <ul style="margin: 0; padding-left: 20px; color: #f1f5f9; font-size: 15.5px; line-height: 1.85;">
      ${items.map(it => `<li style="margin-bottom: 8px; color: #cbd5e1;">${formatInlineMarkdown(it, theme.primaryDark)}</li>`).join("")}
    </ul>
  </div>`);
      continue;
    }

    // 5. NIVEAU 1 / NIVEAU 2 / NIVEAU 3 (Alertes & Scénarios Pédagogiques)
    const niveauMatch = line.match(/^(?:\*\*)?NIVEAU\s*([123])\s*[-—:]\s*(.+?)(?:\*\*)?$/i);
    if (niveauMatch) {
      const lvl = niveauMatch[1];
      const nTitle = niveauMatch[2].replace(/\*\*/g, "").trim();
      i++;
      const descLines: string[] = [];
      while (
        i < bodyLines.length &&
        bodyLines[i].trim() &&
        !/^(?:\*\*)?NIVEAU\s*[123]/i.test(bodyLines[i].trim()) &&
        !bodyLines[i].trim().startsWith("#") &&
        !bodyLines[i].trim().startsWith("|") &&
        !bodyLines[i].trim().startsWith("-") &&
        !isMostlyUppercase(bodyLines[i].trim())
      ) {
        descLines.push(bodyLines[i].trim());
        i++;
      }
      const descText = descLines.join(" ") || "";
      const lvlColors = {
        "1": { bg: "rgba(34, 197, 94, 0.12)", border: "#22c55e", text: "#4ade80", icon: "🟢" },
        "2": { bg: "rgba(245, 158, 11, 0.14)", border: "#f59e0b", text: "#fbbf24", icon: "🟠" },
        "3": { bg: "rgba(239, 68, 68, 0.16)", border: "#ef4444", text: "#f87171", icon: "🔴" }
      };
      const c = lvlColors[lvl as "1" | "2" | "3"] || lvlColors["1"];
      htmlParts.push(`
  <div style="background: ${c.bg}; border-left: 5px solid ${c.border}; border-radius: 8px; padding: 16px 20px; margin: 18px 0;">
    <div style="font-weight: 900; color: ${c.text}; text-transform: uppercase; font-size: 15px; letter-spacing: 0.05em; margin-bottom: 6px;">
      ${c.icon} NIVEAU ${lvl} — ${nTitle.toUpperCase()}
    </div>
    ${descText ? `<div style="color: #f1f5f9; font-size: 15.5px; line-height: 1.75;">${formatInlineMarkdown(descText, theme.primaryDark)}</div>` : ""}
  </div>`);
      continue;
    }

    // 6. Section "Comprendre [le phénomène ou le mécanisme physique]"
    if (/^(?:\*\*)?(?:🔬\s*)?Comprendre\b/i.test(line)) {
      const clean = line.replace(/^\*\*/, "").replace(/\*\*$/, "").replace(/^🔬\s*/, "").trim();
      htmlParts.push(
        `<h3 style="color: #38bdf8; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid rgba(56, 189, 248, 0.35); padding-bottom: 8px;">🔬 ${clean.toUpperCase()}</h3>`
      );
      i++;
      continue;
    }

    // 7. Section "Les conséquences concrètes sur la population, les routes et les chantiers BTP"
    if (/^(?:\*\*)?(?:🏗️\s*)?Les conséquences\b/i.test(line)) {
      const clean = line.replace(/^\*\*/, "").replace(/\*\*$/, "").replace(/^🏗️\s*/, "").trim();
      htmlParts.push(
        `<h3 style="color: #fbbf24; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid rgba(251, 191, 36, 0.35); padding-bottom: 8px;">🏗️ ${clean.toUpperCase()}</h3>`
      );
      i++;
      continue;
    }

    // 8. Section "TROIS SITUATIONS À SURVEILLER" / "SCÉNARIOS"
    if (/^(?:\*\*)?(?:TROIS SITUATIONS|3 SITUATIONS|SC[ÉE]NARIOS|NIVEAUX DE RISQUE)\b/i.test(line)) {
      const clean = line.replace(/^\*\*/, "").replace(/\*\*$/, "").replace(/^[⚠️📊]\s*/, "").trim();
      htmlParts.push(
        `<h3 style="color: ${theme.primaryDark}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid ${theme.primaryDark}; padding-bottom: 8px;">⚠️ ${clean.toUpperCase()}</h3>`
      );
      i++;
      continue;
    }

    // 9. Section "À ne pas interpréter comme..."
    if (/^(?:\*\*)?(?:⚠️\s*)?À ne pas interpréter\b/i.test(line)) {
      const clean = line.replace(/^\*\*/, "").replace(/\*\*$/, "").replace(/^⚠️\s*/, "").trim();
      i++;
      const warningParas: string[] = [];
      while (
        i < bodyLines.length &&
        bodyLines[i].trim() &&
        !bodyLines[i].trim().startsWith("#") &&
        !bodyLines[i].trim().startsWith("|") &&
        !bodyLines[i].trim().startsWith("-") &&
        !/^(?:\*\*)?(?:Les\s*\d+\s*facteurs|Fiabilité|FAQ|Conclusion|En résumé)/i.test(bodyLines[i].trim())
      ) {
        warningParas.push(bodyLines[i].trim());
        i++;
      }
      htmlParts.push(`
  <div style="background: rgba(245, 158, 11, 0.14); border: 1px solid rgba(245, 158, 11, 0.4); border-left: 5px solid #fbbf24; border-radius: 8px; padding: 18px 22px; margin: 28px 0;">
    <div style="font-weight: 900; color: #fbbf24; text-transform: uppercase; font-size: 15px; letter-spacing: 0.05em; margin-bottom: 8px;">
      ⚠️ ${clean.toUpperCase()}
    </div>
    <p style="font-size: 15px; color: #fef3c7; margin: 0; line-height: 1.75;">
      ${warningParas.map(p => formatInlineMarkdown(p, theme.primaryDark)).join("<br/><br/>")}
    </p>
  </div>`);
      continue;
    }

    // 10. Section "Les 4 facteurs déterminants à surveiller"
    if (/^(?:\*\*)?(?:🎯\s*)?Les\s*\d+\s*facteurs\b/i.test(line)) {
      const clean = line.replace(/^\*\*/, "").replace(/\*\*$/, "").replace(/^🎯\s*/, "").trim();
      htmlParts.push(
        `<h3 style="color: ${theme.primaryDark}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid ${theme.primaryDark}; padding-bottom: 8px;">🎯 ${clean.toUpperCase()}</h3>`
      );
      i++;
      continue;
    }

    // 11. Section "Fiabilité des prévisions et échéances"
    if (/^(?:\*\*)?(?:📊\s*)?Fiabilité des prévisions\b/i.test(line)) {
      const clean = line.replace(/^\*\*/, "").replace(/\*\*$/, "").replace(/^📊\s*/, "").trim();
      htmlParts.push(
        `<h3 style="color: ${theme.primaryDark}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid ${theme.primaryDark}; padding-bottom: 8px;">📊 ${clean.toUpperCase()}</h3>`
      );
      i++;
      continue;
    }

    // 12. Section "FAQ sur..." / "Foire aux questions"
    if (/^(?:\*\*)?(?:❓\s*)?(?:FAQ|Foire aux questions)\b/i.test(line)) {
      const clean = line.replace(/^\*\*/, "").replace(/\*\*$/, "").replace(/^❓\s*/, "").trim();
      htmlParts.push(
        `<h3 style="color: ${theme.accentDark}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid ${theme.accentDark}; padding-bottom: 8px;">❓ ${clean.toUpperCase()}</h3>`
      );
      i++;
      continue;
    }

    // 13. Questions FAQ (ex: 1. Une tempête est-elle certaine... ?)
    const faqQMatch = line.match(/^(?:\*\*)?(\d+)\.\s*([^?]+(?:\?|:))\s*(?:\*\*)?$/i);
    if (faqQMatch) {
      const qNum = faqQMatch[1];
      const qText = faqQMatch[2].trim();
      i++;
      const ansLines: string[] = [];
      while (
        i < bodyLines.length &&
        bodyLines[i].trim() &&
        !/^(?:\*\*)?\d+\.\s*[^?]+(?:\?|:)/i.test(bodyLines[i].trim()) &&
        !bodyLines[i].trim().startsWith("#") &&
        !/^(?:\*\*)?(?:Conclusion|En résumé)/i.test(bodyLines[i].trim())
      ) {
        ansLines.push(bodyLines[i].trim());
        i++;
      }
      const ansText = ansLines.join(" ") || "";
      htmlParts.push(`
  <div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-left: 4px solid ${theme.primaryDark}; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
    <div style="font-weight: 800; color: #38bdf8; font-size: 16px; margin-bottom: 6px;">
      ❓ ${qNum}. ${qText}
    </div>
    ${ansText ? `<div style="color: #e2e8f0; font-size: 15px; line-height: 1.75;">${formatInlineMarkdown(ansText, theme.primaryDark)}</div>` : ""}
  </div>`);
      continue;
    }

    // 14. Section "Conclusion"
    if (/^(?:\*\*)?(?:📌\s*)?Conclusion\b/i.test(line)) {
      htmlParts.push(
        `<h3 style="color: #ffffff; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid #64748b; padding-bottom: 8px;">📌 CONCLUSION</h3>`
      );
      i++;
      continue;
    }

    // 15. Zone & Période
    if (/^(?:\*|_)?Zone\s*\/\s*p[ée]riode\s*:\s*(.+?)(?:\*|_)?$/i.test(line)) {
      const zp = line.replace(/^(?:\*|_)?Zone\s*\/\s*p[ée]riode\s*:\s*/i, "").replace(/[*_]$/, "").trim();
      htmlParts.push(
        `<div style="font-size: 13.5px; color: ${theme.primaryDark}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin: -6px 0 14px 0;">📍 ZONE & PÉRIODE : ${zp.toUpperCase()}</div>`
      );
      i++;
      continue;
    }

    // 16. En résumé en 30 secondes
    if (/^(?:\*\*)?(?:⏱️\s*)?En résumé/i.test(line) || /^En résumé\s*$/i.test(line)) {
      const inlineRest = line.replace(/^\*\*(?:⏱️\s*)?En résumé[^*]*\*\*\s*:?\s*/i, "").trim();
      const summaryParas: string[] = [];
      if (inlineRest && inlineRest !== line) summaryParas.push(inlineRest);
      i++;
      while (
        i < bodyLines.length &&
        bodyLines[i].trim() &&
        !bodyLines[i].trim().startsWith("#") &&
        !/^\*\*(?:Sources|Pour suivre)/i.test(bodyLines[i].trim()) &&
        !/^\*Pour suivre/i.test(bodyLines[i].trim())
      ) {
        summaryParas.push(bodyLines[i].trim());
        i++;
      }
      htmlParts.push(`
  <div style="background: ${theme.summaryBgDark}; border: 1px solid ${theme.summaryBorderDark}; border-radius: 10px; padding: 20px 24px; margin: 30px 0;">
    <h4 style="color: ${theme.primaryDark}; font-size: 17px; margin-top: 0; margin-bottom: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em;">⏱️ EN RÉSUMÉ EN 30 SECONDES</h4>
    <p style="font-size: 15px; color: #f1f5f9; margin: 0; line-height: 1.75;">
      ${summaryParas.map(p => formatInlineMarkdown(p, theme.primaryDark)).join("<br/><br/>")}
    </p>
  </div>`);
      continue;
    }

    // 17. Ligne isolée en TOUTES MAJUSCULES (ex: VENTS FORTS ET PLUIES : LES PRINCIPAUX INDICATEURS)
    if (isMostlyUppercase(line) && line.length <= 110 && !line.startsWith("-") && !line.startsWith("*") && !line.startsWith("|")) {
      const clean = line.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
      htmlParts.push(
        `<h3 style="color: ${theme.primaryDark}; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 34px 0 12px 0; border-bottom: 1px solid rgba(56, 189, 248, 0.25); padding-bottom: 6px;">${clean.toUpperCase()}</h3>`
      );
      i++;
      continue;
    }

    // 18. Titres Markdown # / ## / ###
    if (line.startsWith("# ")) {
      const hText = line.replace(/^#\s+/, "").trim();
      htmlParts.push(
        `<h2 style="color: #ffffff; font-size: 23px; font-weight: 900; line-height: 1.35; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 32px; margin-bottom: 16px;">${hText.toUpperCase()}</h2>`
      );
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      const h2Text = line.replace(/^##\s+/, "").trim();
      htmlParts.push(
        `<h3 style="color: ${theme.primaryDark}; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 30px; margin-bottom: 12px; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 6px;">${h2Text.toUpperCase()}</h3>`
      );
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      const h3Text = line.replace(/^###\s+/, "").trim();
      htmlParts.push(
        `<h4 style="color: #ffffff; font-size: 17px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 22px; margin-bottom: 8px;">${h3Text.toUpperCase()}</h4>`
      );
      i++;
      continue;
    }

    // 19. Intertitre en gras seul sur une ligne : **[Intertitre]**
    const boldHeadingMatch = line.match(/^\*\*([^*]+)\*\*$/);
    if (boldHeadingMatch) {
      const headingText = boldHeadingMatch[1].trim();
      htmlParts.push(
        `<h3 style="color: ${theme.primaryDark}; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 32px; margin-bottom: 12px; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 6px;">${headingText.toUpperCase()}</h3>`
      );
      i++;
      continue;
    }

    // 20. Paragraphe standard mot pour mot
    htmlParts.push(
      `<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">${formatInlineMarkdown(line, theme.primaryDark)}</p>`
    );
    i++;
  }

  // Garantie que 100% des images fournies sont incluses.
  //
  // Les cartes non citées par l'article sont désormais RÉPARTIES uniformément
  // sur l'ensemble du corps, et non plus empilées dans un bloc unique en fin
  // d'article (constat initial : 6 cartes sur 10 regroupées après 68 % du texte).
  // On calcule les positions sur le document complet pour garantir un espacement
  // régulier, alors qu'un tel intercalage pendant le parcours laissait les
  // dernières cartes s'agglutiner.
  {
    const stillPending = buildPendingQueue();
    if (stillPending.length > 0) {
      const n = htmlParts.length;
      // Positions cibles : du premier tiers jusqu'à 90 % du document.
      const targets = stillPending.map((_, idx) => {
        const total = stillPending.length + 1;
        return Math.round((0.30 + (0.60 * idx) / Math.max(1, total - 1)) * n);
      });

      // Insertions du plus à droite au plus à gauche pour préserver les index.
      const ordered = stillPending
        .map((refNum, idx) => ({ refNum, slot: targets[idx] }))
        .sort((a, b) => b.slot - a.slot);

      for (const { refNum, slot } of ordered) {
        const html = renderSingleMap(refNum);
        if (!html) continue;
        htmlParts.splice(Math.min(Math.max(0, slot), htmlParts.length), 0, html);
      }
    }
  }

  htmlParts.push(`</div>`);

  return {
    title: title || "Point météo et analyse synoptique — Météo-Climat Pro",
    excerpt: excerpt || title || "Analyse météorologique complète par Météo-Climat Pro.",
    category,
    rawBody: articleBlock,
    htmlDark: htmlParts.join("\n"),
    socialTitle: social.socialTitle,
    socialDescription: social.socialDescription,
    hashtags: social.hashtags,
    coverPrompt: social.coverPrompt,
    facebookPost: social.facebookPost,
    linkedinPost: social.linkedinPost,
    tiktokPost: social.tiktokPost,
    facebookHashtags: social.facebookHashtags,
    linkedinHashtags: social.linkedinHashtags,
    tiktokHashtags: social.tiktokHashtags,
    twitterPost: social.twitterPost,
    twitterHashtags: social.twitterHashtags
  };
}
