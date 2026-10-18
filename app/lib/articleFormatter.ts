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

export const MASTER_PROMPT_ARTICLE_AND_VIDEO = `# PROMPT MAÎTRE — ARTICLE WEB COMPLET + VIDÉO MÉTÉO EN 5 SCÈNES

Tu es journaliste météo-climat senior, rédacteur SEO, vulgarisateur scientifique et directeur artistique broadcast pour **Météo-Climat Pro**.

À partir du texte d’actualité et des images ou GIF fournis, produis en une seule réponse :

1. **Un article web complet**, selon la structure ci-dessous.
2. **Un script vidéo en cinq scènes**, adapté aux formats vertical 9:16 et paysage 16:9.

Les deux livrables doivent être prêts à copier-coller dans notre studio.

---

## 1. FIABILITÉ ET SIGNATURE

- Utilise uniquement les informations et fichiers fournis. Ne recherche pas d’autres sources, sauf demande explicite.
- N’invente aucun chiffre, lieu, horaire, observation, niveau d’alerte ou référence climatologique.
- Distingue observations, prévisions, scénarios et incertitudes. Ne présente jamais un risque comme un événement déjà constaté.
- Ne cite aucun média externe, concurrent ou « Météo-France » dans les textes publiables. Utilise la signature **Météo-Climat Pro**.
- Tu peux écrire « notre analyse » ou « nos analyses synoptiques ». N’attribue pas à Météo-Climat Pro la production d’un modèle externe.
- N’assimile pas une alerte éditoriale à une vigilance officielle. N’attribue aucune couleur départementale officielle sans document explicite fourni.
- N’utilise pas « record », « exceptionnel » ou une comparaison climatique sans référence disponible.
- Rédige dans un français professionnel, accessible, fluide et sans alarmisme. Écris « degrés » plutôt que « °C ».
- Si une information manque, adapte le contenu sans la remplacer par une supposition. N’allonge pas artificiellement une section avec des affirmations non étayées.

## 2. ANALYSE DES FICHIERS AVANT RÉDACTION

Examine chaque fichier et relève :

- Son nom complet exact, extension comprise.
- Le paramètre représenté et son unité.
- Le modèle, le run et l’échéance lorsqu’ils sont lisibles.
- La zone couverte et les principales valeurs visibles.
- La période de cumul, lorsqu’elle est identifiable.
- Ses limites de lecture et sa pertinence pour l’actualité.

Pour les GIF, examine toutes les images accessibles. Si le fichier ne contient qu’une image, traite-le comme une carte fixe. Si tu ne peux pas examiner l’animation entière, signale cette limite sans prétendre l’avoir analysée.

Vérifie la cohérence des dates, des échéances et des cumuls. Ne compare pas deux accumulations sans vérifier qu’elles couvrent des périodes compatibles. N’additionne pas des cumuls dont les périodes se chevauchent.

Écarte les fichiers hors période, illisibles ou incohérents pour l’usage envisagé. Si une limite affecte le résultat, indique-la brièvement avant les livrables ; ne transforme pas l’article en compte rendu de vérification technique.

## 3. CORRESPONDANCE OBLIGATOIRE ENTRE VISUELS ET COMMENTAIRE

Choisis librement les fichiers pour chaque scène. **Aucun numéro d’image n’est imposé à une scène.**

Chaque voix off, titre, sous-titre et bandeau doit être cohérent avec le paramètre, la zone, les valeurs et l’échéance du visuel diffusé.

- Une carte de pression ou de géopotentiel explique la configuration atmosphérique ; elle ne montre pas directement les cumuls de pluie.
- Une carte de précipitations cumulées montre une accumulation jusqu’à une échéance ; elle ne démontre pas l’intensité horaire ni une pluie continue.
- Une carte fixe ne démontre pas à elle seule un déplacement, un ralentissement ou une évolution chronologique.
- Les valeurs chiffrées de prévision annoncées dans une scène doivent être lisibles sur le visuel correspondant.
- Une valeur présente uniquement dans le texte peut figurer dans l’article, en étant présentée comme une prévision fournie. Ne l’attribue pas à une carte qui ne la montre pas.
- Pour commenter plusieurs échéances, indique les fichiers ou images successives à diffuser et l’ordre de passage.
- Si les visuels ne permettent pas de détailler la chronologie, adapte la scène à ce qu’ils montrent réellement.
- Les explications physiques peuvent compléter la lecture d’une carte, mais ne doivent pas être présentées comme des mesures visibles sur celle-ci.
- Les impacts doivent rester des conséquences possibles, sauf observation explicite fournie.

Tu peux réutiliser un fichier avec un cadrage différent. Préserve les repères géographiques, l’échéance et la légende nécessaires à sa compréhension.

Dans chaque champ **« Image à utiliser »**, recopie le nom complet exact du fichier, extension comprise, puis précise l’échéance ou la portion à diffuser et le cadrage utile.

---

# LIVRABLE 1 — ARTICLE WEB COMPLET

Encadre l’article avec **=== DEBUT ARTICLE ===** et **=== FIN ARTICLE ===**.

Respecte l’ordre et la hiérarchie suivants. Remplace tous les éléments entre crochets par le contenu final.

=== DEBUT ARTICLE ===

TITRE SEO : [Une phrase complète, accrocheuse et factuelle résumant l’événement.]

CHAPEAU : [Deux phrases, 35 à 50 mots, résumant les régions, la période et l’enjeu principal.]

CATEGORIE : [Choisir : Actualités Météo / Analyses Climatologiques / Vigilance & Intempéries / Météo BTP]

# [SUJET COURT EN MAJUSCULES]

# [SOUS-TITRE EXPLICATIF EN MAJUSCULES]

[Ouverture de 120 à 180 mots : événement, période, territoires concernés, enjeu et chiffre clé si disponible. Distinguer clairement ce qui est prévu de ce qui est observé.]

**[Information majeure replacée dans son contexte]**

[Développement de 150 à 250 mots expliquant l’intérêt de la situation. Comparer à une référence uniquement si elle est fournie.]

**[EMOJI ADAPTÉ] [INDICATEUR OU THÈME PRINCIPAL]**

## [Description précise des données présentées]

*Zone / période : [Territoire et période correspondants.]*

- **[Indicateur clé 1 : valeur et période.]**
- **[Indicateur clé 2 : valeur et période.]**
- **[Indicateur clé 3 : valeur et période.]**
- **[Indicateur clé 4 : valeur et période.]**

[Un à deux paragraphes expliquant les données, leur répartition et leurs limites. Si moins de quatre indicateurs sont disponibles, conserver uniquement ceux qui sont étayés.]

[IMAGE 1 — Fichier : nom complet exact. Légende : paramètre, unité, territoire, échéance, période de cumul si connue et enseignement principal.]

**Comprendre [le phénomène ou le mécanisme physique]**

[180 à 250 mots de pédagogie claire. Expliquer les mécanismes utiles à la compréhension de cet événement, sans ajouter de caractéristiques locales non documentées.]

**Les conséquences concrètes sur la population, les routes et les chantiers BTP**

[180 à 250 mots sur les impacts possibles : déplacements, travaux extérieurs, accès, réseaux, sols et équipements selon les données disponibles. Ne pas déduire un risque de vent ou une possibilité de levage à partir de cartes de pluie.]

[IMAGE 2 — Fichier : nom complet exact. Légende complète et cohérente avec le passage illustré.]

**[EMOJI] [THÈME] • impacts / niveaux / scénarios**

## [Titre présentant trois situations pédagogiques]

**NIVEAU 1 — [Intitulé]**

[Une à deux phrases.]

**NIVEAU 2 — [Intitulé]**

[Une à deux phrases.]

**NIVEAU 3 — [Intitulé]**

[Une à deux phrases.]

[Préciser que ces niveaux sont pédagogiques et ne constituent pas une échelle de vigilance officielle. Ne pas inventer de seuils chiffrés.]

| Zone ou Scénario | Échéance / Période | Phénomènes & Valeurs | Conséquences & Vigilance |
| --- | --- | --- | --- |
| [Zone ou scénario 1] | [Période] | [Données disponibles] | [Risques possibles] |
| [Zone ou scénario 2] | [Période] | [Données disponibles] | [Risques possibles] |
| [Zone ou scénario 3] | [Période] | [Données disponibles] | [Risques possibles] |

[IMAGE 3 — Si un troisième visuel pertinent est exploitable : nom complet exact et légende complète. Sinon, supprimer cette insertion.]

**À ne pas interpréter comme [une certitude absolue / un seuil uniforme / une observation] :**

[Deux à quatre phrases sur les limites d’interprétation, les variations locales et les incertitudes pertinentes.]

**Les 4 facteurs déterminants à surveiller**

- **[EMOJI] [Facteur 1] :** [Explication courte.]
- **[EMOJI] [Facteur 2] :** [Explication courte.]
- **[EMOJI] [Facteur 3] :** [Explication courte.]
- **[EMOJI] [Facteur 4] :** [Explication courte.]

**Fiabilité des prévisions et échéances**

[120 à 180 mots distinguant les éléments étayés de ceux restant à affiner. Ne pas affirmer un accord entre plusieurs modèles ou runs sans les avoir effectivement comparés. Expliquer les limites météorologiques utiles au lecteur.]

**FAQ sur [sujet principal]**

**1. [Question concrète ?]**

[Réponse directe en deux à trois phrases.]

**2. [Question concrète ?]**

[Réponse directe en deux à trois phrases.]

**3. [Question concrète ?]**

[Réponse directe en deux à trois phrases.]

**4. [Question concrète ?]**

[Réponse directe en deux à trois phrases.]

**5. [Question concrète ?]**

[Réponse directe en deux à trois phrases.]

**Conclusion**

[100 à 150 mots rappelant les régions, la période, les principaux enjeux et les points à surveiller, sans introduire d’information nouvelle.]

**En résumé**

[Un seul paragraphe de 80 à 120 mots permettant de comprendre rapidement l’événement.]

*Pour suivre les prochaines évolutions et disposer des dernières modélisations réactualisées, consultez régulièrement nos bulletins et analyses sur Météo-Climat Pro.*

**Sources :** [Mentionner uniquement les modèles réellement exploités et les documents fournis, sans nom de média externe. Ne pas inventer d’observations ou d’Observatoire.] Analyse : Météo-Climat Pro.

=== FIN ARTICLE ===

---

# LIVRABLE 2 — SCRIPT VIDÉO EN CINQ SCÈNES

Produis immédiatement les cinq scènes après l’article.

## CALIBRAGE

- Total des cinq voix off : **165 à 175 mots**.
- Durée visée : environ 60 secondes, selon le débit et les pauses de la voix.
- Scène 1 : **8 à 14 mots**, avec une accroche immédiatement compréhensible.
- Scènes 2 à 5 : répartir le reste pour former un commentaire continu et fluide.
- Écrire tous les nombres en lettres dans les voix off.
- Privilégier des phrases courtes, naturelles à l’oral.
- Ne pas lire les noms de modèles, les runs ou les échéances techniques sauf nécessité éditoriale.
- Terminer la scène 5 par : **« et restez connectés avec METEO CLIMAT PRO. »**

## CONSTRUCTION

Progression souhaitée, à adapter aux visuels disponibles :

1. Annonce de l’événement.
2. Explication de la configuration météo.
3. Chronologie si elle est représentée ; sinon, lecture d’une échéance précise.
4. Valeurs visibles et conséquences possibles.
5. Incertitudes, prudence et suivi.

La cohérence avec les images prime sur cette progression. N’impose pas un thème à une scène si aucun fichier ne permet de l’illustrer correctement.

## FORMAT DE SORTIE STRICT

SCÈNE 1
- Image à utiliser : [Nom complet exact du fichier — échéance ou portion à diffuser — cadrage utile]
- Badge : [2 à 3 mots en majuscules]
- Titre : [Majuscules, 32 caractères maximum]
- Sous-titre : [Court, en majuscules]
- Localisation : [Zone en majuscules]
- Bandeau Infos Météo : [Phrase courte, cohérente avec le visuel ; chiffres uniquement s’ils sont justifiés]
- Voix off Charon : [Accroche de 8 à 14 mots]

SCÈNE 2
- Image à utiliser : [Nom complet exact du fichier — échéance ou portion à diffuser — cadrage utile]
- Badge : [Adapté au contenu réel]
- Titre : [Majuscules, 32 caractères maximum]
- Sous-titre : [Court, en majuscules]
- Localisation : [Zone en majuscules]
- Bandeau Infos Météo : [Phrase courte et cohérente avec le visuel]
- Voix off Charon : [Commentaire correspondant précisément au visuel]

SCÈNE 3
- Image à utiliser : [Nom complet exact du fichier — échéance ou portion à diffuser — cadrage utile ; si plusieurs visuels, préciser leur ordre]
- Badge : [Adapté au contenu réel]
- Titre : [Majuscules, 32 caractères maximum]
- Sous-titre : [Court, en majuscules]
- Localisation : [Zone en majuscules]
- Bandeau Infos Météo : [Phrase courte et cohérente avec le visuel]
- Voix off Charon : [Chronologie représentée ou commentaire limité à l’échéance affichée]

SCÈNE 4
- Image à utiliser : [Nom complet exact du fichier — échéance ou portion à diffuser — cadrage utile]
- Badge : [Adapté au contenu réel]
- Titre : [Majuscules, 32 caractères maximum]
- Sous-titre : [Court, en majuscules]
- Localisation : [Zone en majuscules]
- Bandeau Infos Météo : [Valeurs visibles et période correspondante, si disponibles]
- Voix off Charon : [Valeurs lisibles sur le visuel et conséquences possibles, clairement distinguées]

SCÈNE 5
- Image à utiliser : [Nom complet exact du fichier — échéance ou portion à diffuser — cadrage utile]
- Badge : [Adapté au contenu réel]
- Titre : [Majuscules, 32 caractères maximum]
- Sous-titre : [Court, en majuscules]
- Localisation : [Zone en majuscules]
- Bandeau Infos Météo : [Phrase courte et cohérente avec le visuel]
- Voix off Charon : [Conclusion adaptée au visuel, terminée par « et restez connectés avec METEO CLIMAT PRO. »]

## VÉRIFICATION FINALE AVANT LIVRAISON

Effectue ces vérifications sans afficher de rapport :

1. Chaque fichier cité existe parmi les pièces fournies et porte son nom exact.
2. Chaque voix off correspond au paramètre, à la zone et à l’échéance du visuel.
3. Chaque chiffre annoncé dans la vidéo est lisible sur le visuel correspondant.
4. Aucune carte fixe n’est décrite comme une animation.
5. Aucun cumul n’est présenté comme une intensité horaire.
6. Aucun impact possible n’est présenté comme un dommage constaté.
7. Les titres, sous-titres et bandeaux respectent les mêmes règles que les voix off.
8. Les cinq voix off totalisent 165 à 175 mots et forment un commentaire continu.
9. Les titres vidéo ne dépassent pas 32 caractères.
10. Aucun champ entre crochets ne reste dans le résultat.

Si une scène échoue à la vérification, change le visuel ou reformule son contenu avant de livrer.

---

# DONNÉES À TRAITER

**TEXTE / INFORMATIONS DE L’ACTUALITÉ :**

[COLLER ICI LE TEXTE, OU INDIQUER « CARTES UNIQUEMENT ».]

**IMAGES / GIF FOURNIS :**

[JOINDRE LES FICHIERS.]

Si aucun texte n’est fourni, construis l’angle éditorial à partir des seules informations lisibles dans les fichiers. Ne déduis aucune observation, vigilance officielle, intensité horaire ou chronologie qui n’y figure pas.
`;

function formatInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #ffffff; font-weight: 700;">$1</strong>')
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export interface ParsedArticleOutput {
  title: string;
  excerpt: string;
  category: string;
  rawBody: string;
  htmlDark: string;
}

/**
 * Convertit MOT POUR MOT le texte de l'article issu de ChatGPT en HTML stylé
 * selon la présentation choisie (1 à 5), en insérant automatiquement Image 1, Image 2, Image 3...
 */
export function buildWordForWordArticleHtml(
  rawText: string,
  theme: ArticleTheme,
  imagesByRef: Record<number, { url: string; name: string }>
): ParsedArticleOutput | null {
  // Extraire la partie article (avant SCÈNE 1 ou entre === DEBUT ARTICLE === et === FIN ARTICLE ===)
  let articleBlock = rawText;
  const explicitMatch = rawText.match(/===\s*DEBUT ARTICLE\s*===([\s\S]*?)(?:===\s*FIN ARTICLE\s*===|(?=(?:^|\n)\s*(?:#+\s*|\*\*)*SC[ÈE]NE\s+1\b)|$)/i);
  if (explicitMatch && explicitMatch[1]?.trim()) {
    articleBlock = explicitMatch[1].trim();
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

  // Si le prompt n'avait pas de préfixe "TITRE SEO :", on prend le premier # Titre comme titre principal
  if (!title) {
    for (let i = 0; i < bodyLines.length; i++) {
      const m = bodyLines[i].trim().match(/^#\s+(.+)$/);
      if (m) {
        title = m[1].replace(/\*\*/g, "").trim();
        bodyLines.splice(i, 1);
        break;
      }
    }
  }

  // Construction HTML fidèle mot pour mot
  const htmlParts: string[] = [];
  htmlParts.push(
    `<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #f1f5f9; line-height: 1.85; font-size: 16px;">`
  );

  // Badge de présentation en haut de l'article
  htmlParts.push(
    `<div style="margin-bottom: 14px;"><span style="display: inline-block; background: ${theme.boxBgDark}; color: ${theme.primaryDark}; border: 1px solid ${theme.boxBorderDark}; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;">${theme.badge} • Météo-Climat Pro</span></div>`
  );

  let i = 0;
  let h1Count = 0;
  const usedImageRefs = new Set<number>();

  while (i < bodyLines.length) {
    const rawLine = bodyLines[i];
    const line = rawLine.trim();

    if (!line || line === "---") {
      i++;
      continue;
    }

    // 1. Détection universelle des balises d'insertion d'image
    // Ex: IMAGE 1 À INSÉRER — nom.png — légende...
    // Ex: [IMAGE 1 — Fichier : nom.png. Légende : ...]
    // Ex: [IMAGE 1 : Légende] ou **Image 1 :** ...
    // Ex: IMAGE 1 (sur sa propre ligne)
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

      // Nettoyer le préfixe du nom de fichier dans la légende
      caption = caption
        .replace(/^(?:IMAGE\s*\d+\s*(?:À|A)\s*INS[ÉE]RER\s*[:—-]\s*)?/i, "")
        .replace(/^(?:Fichier\s*:\s*)?[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|gif|webp)\s*[:—-]\s*/i, "")
        .replace(/^(?:Légende\s*:\s*)/i, "")
        .replace(/\]$/, "")
        .trim();

      // Résolution intelligente de l'image
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

      if (!matchedObj || !matchedObj.url) {
        const allImgs = Object.values(imagesByRef).filter(img => img.url);
        if (allImgs.length > 0) {
          matchedObj = allImgs[(imgNum - 1) % allImgs.length];
        }
      }

      usedImageRefs.add(imgNum);

      if (!caption) {
        caption = matchedObj ? `Modélisation météorologique Météo-Climat Pro (${matchedObj.name.replace(/\.[^.]+$/, "")})` : `Carte météorologique — Figure ${imgNum}`;
      }

      if (matchedObj?.url) {
        htmlParts.push(`
  <div style="margin: 28px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
    <img src="${matchedObj.url}" alt="${caption.replace(/"/g, "&quot;")}" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
    <p style="font-size: 13px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
      <strong style="color: #f1f5f9;">Figure ${imgNum} :</strong> ${formatInlineMarkdown(caption)}
    </p>
  </div>`);
      } else {
        htmlParts.push(`
  <div style="margin: 20px 0; padding: 14px; border: 1px dashed ${theme.primaryDark}; border-radius: 8px; text-align: center; color: #94a3b8; font-size: 13px;">
    📌 Emplacement <strong>Figure ${imgNum}</strong> (${formatInlineMarkdown(caption)}) — <em>Image associée.</em>
  </div>`);
      }
      i++;
      continue;
    }

    // 2. Tableaux Markdown (| Col 1 | Col 2 | ...)
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
          ${headers.map(h => `<th style="padding: 12px 14px; font-weight: 700; color: #ffffff;">${formatInlineMarkdown(h)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${dataRows
          .map(
            r => `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
          ${r
            .map(
              (cell, cIdx) =>
                `<td style="padding: 12px 14px; color: ${cIdx === 0 ? "#ffffff" : "#cbd5e1"}; font-weight: ${cIdx === 0 ? "600" : "400"};">${formatInlineMarkdown(cell)}</td>`
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

    // 3. Listes à puces (- ... ou * ... ou • ...)
    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < bodyLines.length && /^[-*•]\s+/.test(bodyLines[i].trim())) {
        items.push(bodyLines[i].trim().replace(/^[-*•]\s+/, ""));
        i++;
      }
      htmlParts.push(`
  <div style="background: ${theme.boxBgDark}; border-left: 5px solid ${theme.boxBorderDark}; border-radius: 8px; padding: 18px 22px; margin: 22px 0;">
    <ul style="margin: 0; padding-left: 20px; color: #f1f5f9; font-size: 15px; line-height: 1.8;">
      ${items.map(it => `<li style="margin-bottom: 8px; color: #cbd5e1;">${formatInlineMarkdown(it)}</li>`).join("")}
    </ul>
  </div>`);
      continue;
    }

    // 4. Titres Markdown # / ## / ###
    if (line.startsWith("# ")) {
      const hText = line.replace(/^#\s+/, "").trim();
      h1Count++;
      if (h1Count === 1) {
        htmlParts.push(
          `<h2 style="color: ${theme.accentDark}; font-size: 14px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 8px; margin-bottom: 4px;">${formatInlineMarkdown(hText)}</h2>`
        );
      } else {
        htmlParts.push(
          `<h2 style="color: #ffffff; font-size: 23px; font-weight: 800; line-height: 1.35; margin-top: 4px; margin-bottom: 20px;">${formatInlineMarkdown(hText)}</h2>`
        );
      }
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      const h2Text = line.replace(/^##\s+/, "").trim();
      htmlParts.push(
        `<h3 style="color: ${theme.primaryDark}; font-size: 20px; font-weight: 700; margin-top: 30px; margin-bottom: 12px; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 6px;">${formatInlineMarkdown(h2Text)}</h3>`
      );
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      const h3Text = line.replace(/^###\s+/, "").trim();
      htmlParts.push(
        `<h4 style="color: #ffffff; font-size: 17px; font-weight: 700; margin-top: 20px; margin-bottom: 8px;">${formatInlineMarkdown(h3Text)}</h4>`
      );
      i++;
      continue;
    }

    // 5. Détection spéciale "En résumé" ou "À ne pas interpréter comme"
    if (/^\*\*(?:⏱️\s*)?En résumé/i.test(line) || /^En résumé\s*$/i.test(line)) {
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
    <h4 style="color: ${theme.primaryDark}; font-size: 17px; margin-top: 0; margin-bottom: 10px; text-transform: uppercase; font-weight: 800;">⏱️ En résumé en 30 secondes</h4>
    <p style="font-size: 15px; color: #f1f5f9; margin: 0; line-height: 1.75;">
      ${summaryParas.map(p => formatInlineMarkdown(p)).join("<br/><br/>")}
    </p>
  </div>`);
      continue;
    }

    if (/^\*\*À ne pas interpréter comme/i.test(line)) {
      const warningLines: string[] = [line];
      i++;
      while (
        i < bodyLines.length &&
        bodyLines[i].trim() &&
        !bodyLines[i].trim().startsWith("#") &&
        !/^\*\*[^*]+\*\*$/.test(bodyLines[i].trim())
      ) {
        warningLines.push(bodyLines[i].trim());
        i++;
      }
      htmlParts.push(`
  <div style="background: rgba(245, 158, 11, 0.15); border-left: 4px solid #fbbf24; border-radius: 8px; padding: 18px 22px; margin: 26px 0;">
    <p style="font-size: 14.5px; color: #fef3c7; margin: 0; line-height: 1.75;">
      ${warningLines.map(w => formatInlineMarkdown(w)).join("<br/>")}
    </p>
  </div>`);
      continue;
    }

    // 6. Intertitre en gras seul sur une ligne : **[Intertitre]**
    const boldHeadingMatch = line.match(/^\*\*([^*]+)\*\*$/);
    if (boldHeadingMatch) {
      const headingText = boldHeadingMatch[1].trim();
      // Si c'est NIVEAU 1 / 2 / 3 ou une question de FAQ (finit par ?)
      if (/^NIVEAU\s+\d/i.test(headingText) || headingText.endsWith("?")) {
        htmlParts.push(
          `<h4 style="color: ${theme.accentDark}; font-size: 16.5px; font-weight: 700; margin-top: 18px; margin-bottom: 6px;">${headingText}</h4>`
        );
      } else {
        htmlParts.push(
          `<h3 style="color: ${theme.primaryDark}; font-size: 20px; font-weight: 700; margin-top: 32px; margin-bottom: 12px; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 6px;">${headingText}</h3>`
        );
      }
      i++;
      continue;
    }

    // 7. Paragraphe standard (reprise exacte mot pour mot)
    if (!excerpt && line.length > 60 && !line.startsWith("*") && !line.startsWith("#")) {
      excerpt = line.replace(/\*\*/g, "").slice(0, 260);
    }

    htmlParts.push(
      `<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">${formatInlineMarkdown(line)}</p>`
    );
    i++;
  }

  // Uniquement si AUCUNE image n'a été insérée dans le corps du texte (ex: article brut sans aucune mention d'image),
  // on insère alors les cartes disponibles à la fin pour qu'elles restent visibles (maximum 3 cartes)
  if (usedImageRefs.size === 0) {
    const remainingRefs = Object.keys(imagesByRef)
      .map(Number)
      .filter(n => imagesByRef[n]?.url)
      .slice(0, 3);

    if (remainingRefs.length > 0) {
      for (const refNum of remainingRefs) {
        const imgObj = imagesByRef[refNum];
        htmlParts.push(`
  <div style="margin: 28px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
    <img src="${imgObj.url}" alt="Carte météorologique ${refNum}" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
    <p style="font-size: 13px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
      <strong style="color: #f1f5f9;">Figure ${refNum} :</strong> Modélisation numérique Météo-Climat Pro (${imgObj.name.replace(/\.[^.]+$/, "")})
    </p>
  </div>`);
      }
    }
  }

  htmlParts.push(`</div>`);

  return {
    title: title || "Point météo et analyse synoptique — Météo-Climat Pro",
    excerpt: excerpt || title || "Analyse météorologique complète par Météo-Climat Pro.",
    category,
    rawBody: articleBlock,
    htmlDark: htmlParts.join("\n")
  };
}
