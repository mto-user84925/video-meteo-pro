/**
 * Complète un lot de scènes parsées pour qu'aucun visuel ne soit orphelin.
 *
 * Le parser respecte la structure écrite par l'IA (souvent 5 scènes), mais si
 * l'utilisateur a fourni 10 cartes, 5 n'apparaîtraient pas dans la vidéo.
 * On ajoute alors des scènes « sylvestres » réutilisant les cartes restantes,
 * avec les textes génériques du studio.
 */
import type { Scene } from "./scenePlanTypes";

export interface CompleteScenesOptions {
  parsed: Scene[];
  images: Array<{ url: string; name: string; ref: number }>;
  maxScenes: number;
  emptyScenes: (count: number) => Scene[];
}

/** Renvoie les scènes complétées et le nombre de scènes ajoutées. */
export function completeScenesWithImages({
  parsed,
  images,
  maxScenes,
  emptyScenes,
}: CompleteScenesOptions): { scenes: Scene[]; added: number; ignoredImages: number } {
  if (images.length === 0) return { scenes: parsed, added: 0, ignoredImages: 0 };

  const usedUrls = new Set(parsed.map((s) => s.file_url).filter(Boolean) as string[]);
  const unused = images.filter((img) => !usedUrls.has(img.url));

  // Déjà couvert : autant de scènes que d'images utilisées.
  if (unused.length === 0 || parsed.length >= images.length) {
    return { scenes: parsed, added: 0, ignoredImages: 0 };
  }

  const room = Math.max(0, maxScenes - parsed.length);
  const toAdd = Math.min(unused.length, room);
  const ignoredImages = unused.length - toAdd;

  if (toAdd === 0) return { scenes: parsed, added: 0, ignoredImages };

  // Scènes vierges génériques, puis affectation d'une carte à chacune.
  const templates = emptyScenes(parsed.length + toAdd).slice(parsed.length);
  const added: Scene[] = templates.slice(0, toAdd).map((tpl, i) => ({
    ...tpl,
    scene_number: parsed.length + i + 1,
    badge: "ÉVOLUTION DU PHÉNOMÈNE",
    badge_color: [30, 120, 240],
    title: `SCÈNE ${parsed.length + i + 1}`,
    sub: "Complément d'analyse",
    location_tag: "FRANCE",
    ticker: "Suivi météorologique en continu • Météo-Climat Pro",
    script_text: "",
    file_url: unused[i].url,
    file_name: unused[i].name,
    image_ref: unused[i].ref,
  }));

  return {
    scenes: [...parsed, ...added],
    added: added.length,
    ignoredImages,
  };
}
