/**
 * Lecture d'un fichier texte (.txt / .md) avec détection d'encodage.
 *
 * Le risque principal : un fichier exporté depuis Windows peut être en
 * UTF-16 LE / BE ou en ANSI (Windows-1252). Décodé naïvement en UTF-8, il
 * produit des accents cassés (« Tempête » -> « Tempãte ») ou des octets nuls
 * qui empêchent toute reconnaissance des balises SCÈNE.
 */

export interface ReadTextResult {
  text: string;
  encoding: string;
  /** Vrai si le fichier a été réencodé (l'original n'était pas de l'UTF-8). */
  converted: boolean;
  /** Nombre de caractères de contrôle retirés (dont les octets nuls). */
  cleanedChars: number;
}

/** Supprime les caractères de contrôle nuisibles à la reconnaissance des balises. */
function stripControlChars(text: string): { text: string; removed: number } {
  let removed = 0;
  const cleaned = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFEFF]/g, () => {
    removed += 1;
    return "";
  });
  return { text: cleaned, removed };
}

/** Détecte un éventuel Byte Order Mark et renvoie l'encodage correspondant. */
function detectBom(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8-bom";
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
  return null;
}

/** Heuristique : beaucoup d'octets nuls = texte UTF-16 sans BOM. */
function looksLikeUtf16(bytes: Uint8Array): "utf-16le" | "utf-16be" | null {
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  if (sample.length < 4) return null;
  let evenZeros = 0;
  let oddZeros = 0;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      if (i % 2 === 0) evenZeros++;
      else oddZeros++;
    }
  }
  const total = sample.length / 2;
  if (oddZeros / total > 0.4 && evenZeros / total < 0.1) return "utf-16le";
  if (evenZeros / total > 0.4 && oddZeros / total < 0.1) return "utf-16be";
  return null;
}

/** Vérifie qu'un décodage UTF-8 strict est valide (sinon il y a eu substitution). */
function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lit un fichier et renvoie son texte décodé, avec l'encodage retenu.
 * Lève une erreur explicite si le fichier est binaire ou vide.
 */
export async function readTextFile(file: File): Promise<ReadTextResult> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length === 0) {
    throw new Error(`Le fichier « ${file.name} » est vide.`);
  }

  // Refus des binaires évidents (PDF, images… déposés par erreur)
  if (
    (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) || // %PDF
    (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) || // PNG
    (bytes[0] === 0xff && bytes[1] === 0xd8) // JPEG
  ) {
    throw new Error(
      `« ${file.name} » n'est pas un fichier texte. Enregistrez la réponse ChatGPT en .txt ou .md.`
    );
  }

  const bom = detectBom(bytes);
  const utf16 = bom ?? looksLikeUtf16(bytes);

  let text: string;
  let encoding: string;
  let converted = false;

  if (utf16 === "utf-16le" || utf16 === "utf-16be") {
    text = new TextDecoder(utf16).decode(bytes);
    encoding = utf16;
    converted = true;
  } else if (isValidUtf8(bytes)) {
    text = new TextDecoder("utf-8").decode(bytes);
    encoding = bom === "utf-8-bom" ? "utf-8-bom" : "utf-8";
    converted = encoding === "utf-8-bom";
  } else {
    // Ni UTF-8 valide ni UTF-16 : très probablement Windows-1252 (ANSI).
    text = new TextDecoder("windows-1252").decode(bytes);
    encoding = "windows-1252";
    converted = true;
  }

  const { text: cleaned, removed } = stripControlChars(text);
  const normalized = cleaned.replace(/\r\n?/g, "\n");

  if (!normalized.trim()) {
    throw new Error(`« ${file.name} » ne contient aucun texte exploitable.`);
  }

  return { text: normalized, encoding, converted, cleanedChars: removed };
}

/** Vrai si l'extension du fichier est acceptée. */
export function isSupportedTextFile(name: string): boolean {
  return /\.(txt|md|markdown|text)$/i.test(name);
}
