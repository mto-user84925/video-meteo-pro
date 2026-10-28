/**
 * Édition structurée des articles avant publication.
 *
 * L'aperçu HTML produit par `buildWordForWordArticleHtml` était en lecture
 * seule : impossible de corriger une faute de frappe sans repasser par
 * ChatGPT puis tout re-coller. Ce module découpe le HTML en blocs éditables
 * (titre, sous-titre, paragraphes, figures légendées, encadrés, tableaux, FAQ).
 *
 * Principe de fidélité : au moment de la lecture on mémorise la PLAGE
 * [start, end) exacte de chaque bloc dans la chaîne HTML d'origine. À
 * l'écriture on remplace uniquement l'intérieur de cette plage (la balise
 * ouvrante avec tous ses styles et la balise fermante sont conservées).
 * Résultat : un article non modifié est rendu à l'identique, octet pour octet.
 */

export type ArticleBlockKind =
  | "h1"
  | "h2"
  | "h3"
  | "p"
  | "figure"
  | "box"
  | "table"
  | "list"
  | "html";

export interface ArticleBlock {
  id: string;
  kind: ArticleBlockKind;
  /** Libellé lisible dans l'éditeur ("Paragraphe 3") */
  label: string;
  /** Texte éditable (HTML inline autorisé : <strong>, <em>, <a>) */
  text: string;
  /** Texte d'origine : sert à détecter si l'utilisateur a modifié le bloc */
  original: string;
  /** Offset de début dans le HTML source */
  start: number;
  /** Offset de fin (exclu) dans le HTML source */
  end: number;
}

export interface ArticleDraft {
  title: string;
  excerpt: string;
  category: string;
  author: string;
  slug: string;
  coverImageUrl: string;
  blocks: ArticleBlock[];
}

interface BlockMeta {
  kind: ArticleBlockKind;
  label: string;
  /** Bloc dont seul le <figcaption> est éditable */
  captionOnly?: boolean;
  /** Bloc brut : non éditable, affiché informativement */
  raw?: boolean;
}

const BLOCK_META: Record<string, BlockMeta> = {
  h1: { kind: "h1", label: "Titre principal" },
  h2: { kind: "h2", label: "Sous-titre" },
  h3: { kind: "h3", label: "Intertitre" },
  p: { kind: "p", label: "Paragraphe" },
  figure: { kind: "figure", label: "Légende de figure", captionOnly: true },
  figcaption: { kind: "figure", label: "Légende", captionOnly: true },
  ul: { kind: "list", label: "Liste à puces" },
  ol: { kind: "list", label: "Liste numérotée" },
  table: { kind: "table", label: "Tableau", raw: true },
  blockquote: { kind: "box", label: "Citation" },
};

const VOID_TAGS = new Set(["img", "br", "hr", "input", "meta", "link", "source"]);

/** Balises qui portent du contenu rédigé (candidats à l'édition). */
const TEXT_TAGS = new Set(["h1", "h2", "h3", "h4", "p", "ul", "ol", "table", "blockquote", "figcaption"]);

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Ne conserve que les balises inline sûres saisies dans l'éditeur. */
export function sanitizeInlineHtml(value: string): string {
  const allowedTag = /^(strong|b|em|i|u|br|a|span|small|sup|sub)$/i;
  const withoutScripts = value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // On reconstruit chaque balise : on garde le nom s'il est autorisé, sinon on
  // supprime uniquement la balise (pas le texte qu'elle entoure).
  const cleaned = withoutScripts.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_m, slash, name, attrs) => {
    if (!allowedTag.test(name)) return "";
    if (slash) return `</${name.toLowerCase()}>`;
    if (name.toLowerCase() === "br") return "<br>";
    // Sur <a>, on ne garde que href http(s).
    if (name.toLowerCase() === "a") {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
      const url = href ? (href[2] ?? href[3] ?? "") : "";
      return /^https?:\/\//i.test(url) ? `<a href="${escapeHtml(url)}" rel="noopener noreferrer">` : "<span>";
    }
    return `<${name.toLowerCase()}>`;
  });

  // Neutralise les attributs d'événement résiduels.
  return cleaned.replace(/\s(on\w+)\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
}

/** Convertit du texte brut en HTML inline minimal (gras **, emphase *). */
export function textToInlineHtml(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
}

/**
 * Découpe un fragment HTML en balises de premier niveau, en conservant leur
 * position absolue dans la chaîne d'origine (indispensable pour réinjecter
 * les corrections sans toucher au reste du document).
 */
function splitTopLevelBlocks(html: string, baseOffset = 0): Array<{ html: string; start: number }> {
  const blocks: Array<{ html: string; start: number }> = [];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    const tagMatch = /^<([a-zA-Z][a-zA-Z0-9]*)\b/.exec(html.slice(i, i + 40));
    if (!tagMatch) {
      const next = html.indexOf("<", i + 1);
      const chunk = html.slice(i, next === -1 ? html.length : next);
      if (chunk.trim()) blocks.push({ html: chunk, start: baseOffset + i });
      i = next === -1 ? html.length : next;
      continue;
    }

    const tag = tagMatch[1].toLowerCase();
    if (VOID_TAGS.has(tag)) {
      const end = html.indexOf(">", i);
      const stop = end === -1 ? html.length : end + 1;
      blocks.push({ html: html.slice(i, stop), start: baseOffset + i });
      i = stop;
      continue;
    }

    const openRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
    const closeRe = new RegExp(`</${tag}\\s*>`, "gi");
    let depth = 0;
    let cursor = i;
    let endPos = -1;
    while (cursor < html.length) {
      openRe.lastIndex = cursor;
      closeRe.lastIndex = cursor;
      const open = openRe.exec(html);
      const close = closeRe.exec(html);
      if (!close) break;
      if (open && open.index < close.index) {
        depth += 1;
        cursor = open.index + open[0].length;
        continue;
      }
      depth -= 1;
      cursor = close.index + close[0].length;
      if (depth <= 0) {
        endPos = cursor;
        break;
      }
    }

    if (endPos === -1) {
      blocks.push({ html: html.slice(i), start: baseOffset + i });
      break;
    }
    blocks.push({ html: html.slice(i, endPos), start: baseOffset + i });
    i = endPos;
  }
  return blocks;
}

function tagOf(block: string): string {
  const m = /^<([a-zA-Z][a-zA-Z0-9]*)\b/.exec(block.trim());
  return m ? m[1].toLowerCase() : "";
}

function innerHtml(block: string): string {
  const m = /^<[^>]+>([\s\S]*)<\/[^>]+>$/.exec(block.trim());
  return m ? m[1] : block;
}

function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Un `div` est un ENCADRÉ s'il porte du texte rédigé direct ; c'est un simple
 * CONTENEUR (section, carte graphique) si son contenu direct est uniquement
 * d'autres balises structurantes. On n'éclate que les conteneurs.
 */
function shouldDescendDiv(block: string): boolean {
  const inner = innerHtml(block);
  const children = splitTopLevelBlocks(inner);
  if (children.length === 0) return false;
  // ponytail: calcul du texte libre sans regex replace destructive sur chaînes identiques
  let looseLen = 0;
  let lastEnd = 0;
  for (const child of children) {
    if (child.start > lastEnd) {
      looseLen += plainText(inner.slice(lastEnd, child.start)).length;
    }
    lastEnd = child.start + child.html.length;
  }
  if (lastEnd < inner.length) {
    looseLen += plainText(inner.slice(lastEnd)).length;
  }
  if (looseLen > 40) return false;
  return children.some((child) => {
    const t = tagOf(child.html);
    return TEXT_TAGS.has(t) || t === "img" || t === "figure";
  });
}

/**
 * Parcourt le HTML et renvoie tous les blocs éditables avec leur POSITION
 * exacte dans la chaîne source.
 */
function collectBlocks(
  html: string,
  baseOffset: number,
  out: Array<{ block: string; start: number; end: number; hint: string | null }>
): void {
  for (const part of splitTopLevelBlocks(html, baseOffset)) {
    const trimmed = part.html.trim();
    if (!trimmed) continue;

    const tag = tagOf(trimmed);
    const leading = part.html.length - part.html.trimStart().length;
    const blockStart = part.start + leading;

    if (tag === "div" && shouldDescendDiv(trimmed)) {
      const inner = innerHtml(trimmed);
      // Position du premier caractère après la balise ouvrante.
      const openTagEnd = trimmed.indexOf(">") + 1;
      const innerPrefix = trimmed.slice(openTagEnd, openTagEnd + inner.length) === inner ? openTagEnd : trimmed.indexOf(inner);
      const innerOffset = blockStart + (innerPrefix >= 0 ? innerPrefix : openTagEnd);
      collectBlocks(inner, innerOffset, out);
      continue;
    }

    out.push({ block: trimmed, start: blockStart, end: blockStart + trimmed.length, hint: tag });
  }
}

/** Découpe le HTML d'article en blocs éditables. */
export function buildArticleBlocks(htmlDark: string): ArticleBlock[] {
  if (!htmlDark) return [];

  const raw: Array<{ block: string; start: number; end: number; hint: string | null }> = [];
  collectBlocks(htmlDark, 0, raw);

  const blocks: ArticleBlock[] = [];
  const counters: Record<string, number> = {};

  raw.forEach(({ block, start, end }, index) => {
    const tag = tagOf(block);
    const meta = BLOCK_META[tag];

    if (!meta) {
      // Bloc non éditable (image seule, div complexe...) : on l'ignore
      // silencieusement plutôt que d'exposer du HTML brut.
      if (tag === "img") return;
      return;
    }

    counters[meta.label] = (counters[meta.label] || 0) + 1;
    const label =
      meta.raw || meta.captionOnly ? meta.label : `${meta.label} ${counters[meta.label]}`;

    const text = meta.raw
      ? plainText(block)
      : meta.captionOnly
        ? plainText(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(block)?.[1] ?? plainText(block))
        : innerHtml(block);

    blocks.push({
      id: `blk_${index}`,
      kind: meta.kind,
      label,
      text,
      original: text,
      start,
      end,
    });
  });

  return blocks;
}

/**
 * Réinjecte les corrections. Seuls les blocs réellement modifiés sont touchés ;
 * une balise ouvrante avec ses styles et la balise fermante sont conservées.
 */
export function applyArticleEdits(htmlDark: string, blocks: ArticleBlock[]): string {
  const edits = blocks
    .filter((b) => normalizeForCompare(b.text) !== normalizeForCompare(b.original))
    .sort((a, b) => b.start - a.start); // de droite à gauche : offsets stables

  let result = htmlDark;
  for (const edit of edits) {
    const original = htmlDark.slice(edit.start, edit.end);
    if (!original.trim()) continue;

    const tag = tagOf(original);
    const meta = BLOCK_META[tag];
    if (!meta || meta.raw) continue;

    const safe = sanitizeInlineHtml(edit.text);

    if (meta.captionOnly) {
      const captionRe = /<figcaption[^>]*>[\s\S]*?<\/figcaption>/i;
      if (!captionRe.test(original)) continue;
      result =
        result.slice(0, edit.start) +
        original.replace(captionRe, `<figcaption>${safe}</figcaption>`) +
        result.slice(edit.end);
      continue;
    }

    let replaced = original;
    const match = /^(\s*<[a-zA-Z][^>]*>)([\s\S]*)(<\/[a-zA-Z]+\s*>\s*)$/.exec(original);
    if (match) {
      replaced = `${match[1]}${safe}${match[3]}`;
    } else {
      // ponytail: repli robuste si balise fermante atypique, évitant l'abandon silencieux
      const openMatch = /^(\s*<[a-zA-Z][^>]*>)/.exec(original);
      const closeMatch = /(<\/[a-zA-Z]+\s*>\s*)$/.exec(original);
      if (openMatch && closeMatch) {
        replaced = `${openMatch[1]}${safe}${closeMatch[1]}`;
      } else if (openMatch) {
        replaced = `${openMatch[1]}${safe}</${tag}>`;
      } else {
        replaced = safe;
      }
    }
    result = result.slice(0, edit.start) + replaced + result.slice(edit.end);
  }
  return result;
}

/** Comparaison tolérante (espaces, balises inline vides) pour détecter une vraie modification. */
function normalizeForCompare(value: string): string {
  return value.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

/** Slug SEO stable, identique à la règle serveur `/api/publish-article`. */
export function buildArticleSlug(title: string, suffix = ""): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 75)
    .replace(/^-+|-+$/g, "");
  return `${base || "actualite-meteo"}${suffix ? `-${suffix}` : ""}`;
}

/** Tronque proprement une chaîne pour l'extrait SEO. */
export function buildExcerpt(excerpt: string, title: string, max = 300): string {
  const clean = plainText(excerpt || title).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 100 ? lastSpace : max).trim()}…`;
}
