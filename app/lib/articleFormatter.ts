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

export const MASTER_PROMPT_ARTICLE_AND_VIDEO = `# PROMPT MAÎTRE 2-EN-1 — ARTICLE WEB COMPLET (27 SECTIONS) + SCRIPT VIDÉO (SCÈNES 1 À 5)

Tu es un **journaliste météo-climat senior, rédacteur SEO, vulgarisateur scientifique et directeur artistique broadcast pour METEO CLIMAT PRO**.

Je vais te fournir en bas de ce prompt :
1. **Le texte brut / les informations de l'actualité** ;
2. **Les cartes ou images disponibles** (Image 1, Image 2, Image 3...).

Ton objectif est de produire en UNE SEULE RÉPONSE deux livrables prêts à être collés dans notre studio :
- **PARTIE A : L'ARTICLE WEB COMPLET** (en respectant strictement la structure éditoriale ci-dessous) ;
- **PARTIE B : LE DÉCOUPAGE VIDÉO EN 5 SCÈNES** (SCÈNE 1 à SCÈNE 5) pour notre régie vidéo TikTok 9:16 et Paysage 16:9.

---

## RÈGLES ABSOLUES DE FIABILITÉ & SIGNATURE
1. **N'invente jamais une information, un chiffre, une date ou un lieu.** Utilise uniquement les données fournies.
2. **Interdiction absolue de citer un média externe, un concurrent ou "Météo-France".** Utilise uniquement notre signature : **Météo-Climat Pro**, **nos modélisations numériques**, **nos analyses synoptiques**.
3. Distingue clairement : fait établi, observation, prévision, scénario ou incertitude.

---

# LIVRABLE 1 : L'ARTICLE WEB COMPLET (ENCADRÉ PAR === DEBUT ARTICLE === ET === FIN ARTICLE ===)

Respecte exactement cette structure et cette hiérarchie :

=== DEBUT ARTICLE ===
TITRE SEO : [Une seule phrase complète, forte et accrocheuse qui résume tout l'événement]
CHAPEAU : [Résumé percutant en 2 phrases (35 à 50 mots) pour la vignette d'accueil]
CATEGORIE : [Actualités Météo / Analyses Climatologiques / Vigilance & Intempéries / Météo BTP]

# [SUJET COURT EN MAJUSCULES]
# [SOUS-TITRE EXPLICATIF ET FORT EN MAJUSCULES]

[Paragraphe d'ouverture de 120 à 180 mots : Que se passe-t-il ? Pourquoi est-ce important ? Quel est le chiffre clé ? Qui est concerné ?]

**[L'information majeure replacée dans son contexte ou comparée à une référence]**
[Développement de 150 à 250 mots expliquant pourquoi la situation actuelle est remarquable]

**[EMOJI ADAPTÉ : 🌧️ / 💨 / 🌡️ / ⚡] [INDICATEUR OU THÈME PRINCIPAL]**
## [Description précise de ce que représentent les données]
*Zone / période : [information]*
- **Indicateur clé 1 : [Valeur]**
- **Indicateur clé 2 : [Valeur]**
- **Indicateur clé 3 : [Valeur]**
- **Indicateur clé 4 : [Valeur]**
[1 à 2 paragraphes expliquant ce que montrent les données et leurs limites]

[IMAGE 1 : Légende explicative complète de la première carte ou figure]

**Comprendre [le phénomène / mécanisme physique]**
[Section pédagogique de 180 à 250 mots expliquant simplement les mécanismes en jeu]

**Les conséquences concrètes sur la population, les routes et les chantiers BTP**
[Section de 180 à 250 mots détaillant les impacts concrets : déplacements, chantiers extérieurs, levage, réseaux, sols]

[IMAGE 2 : Légende explicative complète de la deuxième carte ou figure]

**[EMOJI] [THÈME] • impacts / niveaux / scénarios**
## [Titre expliquant les 3 niveaux pédagogiques]
**NIVEAU 1 — [Nom du niveau 1]**
[Explication en 1 à 2 phrases]
**NIVEAU 2 — [Nom du niveau 2]**
[Explication en 1 à 2 phrases]
**NIVEAU 3 — [Nom du niveau 3]**
[Explication en 1 à 2 phrases]

| Zone ou Scénario | Échéance / Période | Phénomènes & Valeurs | Conséquences & Vigilance |
| --- | --- | --- | --- |
| [Ligne 1] | ... | ... | ... |
| [Ligne 2] | ... | ... | ... |
| [Ligne 3] | ... | ... | ... |

[IMAGE 3 : Légende explicative complète de la troisième carte si une 3e carte est fournie]

**À ne pas interpréter comme [une certitude absolue / un seuil uniforme] :**
[Encadré de 2 à 4 phrases rappelant les incertitudes et facteurs locaux]

**Les 4 facteurs déterminants à surveiller**
- **[EMOJI] Facteur 1 :** [Explication courte]
- **[EMOJI] Facteur 2 :** [Explication courte]
- **[EMOJI] Facteur 3 :** [Explication courte]
- **[EMOJI] Facteur 4 :** [Explication courte]

**Fiabilité des prévisions et échéances**
[120 à 180 mots sur ce qui est robuste vs ce qui reste à affiner]

**FAQ sur [sujet principal]**
**1. [Question concrète 1 ?]**
[Réponse directe en 2 à 3 phrases]
**2. [Question concrète 2 ?]**
[Réponse directe en 2 à 3 phrases]
**3. [Question concrète 3 ?]**
[Réponse directe en 2 à 3 phrases]
**4. [Question concrète 4 ?]**
[Réponse directe en 2 à 3 phrases]
**5. [Question concrète 5 ?]**
[Réponse directe en 2 à 3 phrases]

**Conclusion**
[100 à 150 mots rappelant l'essentiel et ce qu'il faut surveiller]

**En résumé**
[Un seul paragraphe synthétique de 80 à 120 mots permettant de tout comprendre en 30 secondes]

*Pour suivre les prochaines évolutions et disposer des dernières modélisations réactualisées, consultez régulièrement nos bulletins et analyses sur Météo-Climat Pro.*

**Sources :** Modélisations numériques haute résolution (ECMWF, GFS, AROME, ARPEGE), Observatoire Météo-Climat Pro.
=== FIN ARTICLE ===

---

# LIVRABLE 2 : LE SCRIPT VIDÉO EN 5 SCÈNES (FORMAT EXACT CI-DESSOUS)

Immédiatement après === FIN ARTICLE ===, génère les 5 scènes vidéo au format strict suivant (Durée totale visée : ~60s, soit ~165-175 mots au total, Scène 1 = Hook court <= 14 mots, nombres écrits en lettres dans la voix off Charon) :

SCÈNE 1
- Image à utiliser : Image 1 — [Description courte de la carte 1]
- Badge : [2-3 MOTS MAJUSCULES]
- Titre : [TITRE COURT MAJUSCULES MAX 32 CARACTÈRES]
- Sous-titre : [SOUS-TITRE COURT MAJUSCULES]
- Localisation : [ZONE GÉOGRAPHIQUE MAJUSCULES]
- Bandeau Infos Météo : [Phrase courte avec chiffres]
- Voix off Charon : [Hook percutant de 12 à 14 mots max]

SCÈNE 2
- Image à utiliser : Image 2 — [Description courte de la carte 2]
- Badge : ANALYSE SYNOPTIQUE
- Titre : [TITRE COURT MAJUSCULES]
- Sous-titre : [SOUS-TITRE COURT MAJUSCULES]
- Localisation : [ZONE GÉOGRAPHIQUE MAJUSCULES]
- Bandeau Infos Météo : [Phrase courte]
- Voix off Charon : [35 à 42 mots max expliquant la cause météo]

SCÈNE 3
- Image à utiliser : Image 3 — [Description courte de la carte 3 ou Image 1]
- Badge : CHRONOLOGIE
- Titre : [TITRE COURT MAJUSCULES]
- Sous-titre : [SOUS-TITRE COURT MAJUSCULES]
- Localisation : [ZONE GÉOGRAPHIQUE MAJUSCULES]
- Bandeau Infos Météo : [Phrase courte]
- Voix off Charon : [38 à 45 mots max sur la chronologie et les régions]

SCÈNE 4
- Image à utiliser : Image 1 — [Description courte]
- Badge : CUMULS & IMPACTS
- Titre : [TITRE COURT MAJUSCULES]
- Sous-titre : [SOUS-TITRE COURT MAJUSCULES]
- Localisation : [ZONE GÉOGRAPHIQUE MAJUSCULES]
- Bandeau Infos Météo : [Phrase courte]
- Voix off Charon : [38 à 45 mots max sur les valeurs chiffrées et impacts]

SCÈNE 5
- Image à utiliser : Image 2 — [Description courte]
- Badge : PRUDENCE & SUIVI
- Titre : [TITRE COURT MAJUSCULES]
- Sous-titre : [SOUS-TITRE COURT MAJUSCULES]
- Localisation : [ZONE GÉOGRAPHIQUE MAJUSCULES]
- Bandeau Infos Météo : [Phrase courte]
- Voix off Charon : [32 à 38 mots max concluant par "...et restez connectés avec METEO CLIMAT PRO."]

---

# DONNÉES DE L'ACTUALITÉ À TRAITER :

**TEXTE / INFORMATIONS DE L'ACTUALITÉ :**
[COLLER ICI L'ACTUALITÉ ENTIÈRE]

**IMAGES / CARTES FOURNIES :**
- Image 1 : [Décrire ou joindre l'Image 1]
- Image 2 : [Décrire ou joindre l'Image 2]
- Image 3 : [Décrire ou joindre l'Image 3]
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
  const explicitMatch = rawText.match(/===\s*DEBUT ARTICLE\s*===([\s\S]*?)(?:===\s*FIN ARTICLE\s*===|(?=(?:^|\n)\s*(?:#+\s*|\*\*)*SC[ÈE]NE\s+1\b))/i);
  if (explicitMatch) {
    articleBlock = explicitMatch[1].trim();
  } else {
    const beforeScene1 = rawText.split(/(?:^|\n)\s*(?:#+\s*|\*\*)*SC[ÈE]NE\s+1\b/i)[0]?.trim();
    if (beforeScene1 && beforeScene1.length > 120) {
      articleBlock = beforeScene1;
    } else if (/^\s*(?:#+\s*|\*\*)*SC[ÈE]NE\s+1\b/i.test(rawText.trim())) {
      // Il n'y a que les scènes vidéo dans le texte collé
      return null;
    }
  }

  articleBlock = articleBlock.replace(/===\s*(?:DEBUT|FIN)\s*ARTICLE\s*===/gi, "").trim();
  if (!articleBlock || articleBlock.length < 40) return null;

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

    // 1. Balise d'insertion d'image explicite : [IMAGE 1 : Légende] ou **Image 1 :** ...
    const imgTagMatch =
      line.match(/^\[?\s*(?:IMAGE|CARTE|FIGURE)\s*(\d+)\s*(?:[:—-]\s*([^\]]*))?\]?$/i) ||
      line.match(/^\*\*(?:Image|Carte|Figure)\s*(\d+)\s*[:—-]\*\*\s*(.+)$/i);

    if (imgTagMatch) {
      const imgNum = Number(imgTagMatch[1]) || 1;
      const caption = (imgTagMatch[2] || `Carte météorologique — Figure ${imgNum}`).replace(/\]$/, "").trim();
      const imgObj = imagesByRef[imgNum];
      usedImageRefs.add(imgNum);

      if (imgObj?.url) {
        htmlParts.push(`
  <div style="margin: 28px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
    <img src="${imgObj.url}" alt="${caption.replace(/"/g, "&quot;")}" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
    <p style="font-size: 13px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
      <strong style="color: #f1f5f9;">Figure ${imgNum} :</strong> ${formatInlineMarkdown(caption)}
    </p>
  </div>`);
      } else {
        htmlParts.push(`
  <div style="margin: 20px 0; padding: 14px; border: 1px dashed ${theme.primaryDark}; border-radius: 8px; text-align: center; color: #94a3b8; font-size: 13px;">
    📌 Emplacement <strong>Image ${imgNum}</strong> (${formatInlineMarkdown(caption)}) — <em>Importez vos images avec le bouton vert pour l'afficher automatiquement ici.</em>
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

  // Si l'utilisateur a importé des cartes (Image 1, 2, 3) mais que le texte de ChatGPT n'avait pas mis de balise [IMAGE 1],
  // on insère proprement les cartes non encore affichées à la fin de l'analyse pour qu'aucune carte ne soit oubliée
  const remainingRefs = Object.keys(imagesByRef)
    .map(Number)
    .filter(n => !usedImageRefs.has(n) && imagesByRef[n]?.url);

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

  htmlParts.push(`</div>`);

  return {
    title: title || "Point météo et analyse synoptique — Météo-Climat Pro",
    excerpt: excerpt || title || "Analyse météorologique complète par Météo-Climat Pro.",
    category,
    rawBody: articleBlock,
    htmlDark: htmlParts.join("\n")
  };
}
