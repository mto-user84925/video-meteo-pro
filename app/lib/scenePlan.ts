/**
 * Règle métier « 1 visuel = 1 scène ».
 *
 * Le studio partait d'un nombre fixe de 5 scènes. Avec 10 cartes fournies,
 * 5 n'étaient jamais montrées ; avec 3 cartes, 2 scènes restaient vides.
 * Ce module centralise le calcul pour que le nombre de scènes suive
 * automatiquement les visuels, côté navigateur comme côté serveur.
 */

/** Plafond supporté par le moteur de rendu et l'API /api/dispatch. */
export const MAX_SCENES = 12;

/** Nombre minimal de scènes (en dessous, un bulletin n'a pas de sens). */
export const MIN_SCENES = 2;

/**
 * Calcule le nombre de scènes à afficher.
 *
 * @param imageCount    Nombre de visuels fournis (cartes, GIF).
 * @param currentCount  Nombre de scènes actuellement affichées.
 * @param scriptCount   Nombre de scènes détectées dans un script collé (prioritaire).
 *
 * Priorité : un script explicite fait foi (l'IA a déjà décidé de la structure),
 * sinon on aligne sur le nombre de visuels, sinon on garde l'existant.
 */
export function resolveSceneCount({
  imageCount,
  currentCount,
  scriptCount,
}: {
  imageCount?: number;
  currentCount?: number;
  scriptCount?: number;
}): number {
  const clamp = (n: number) => Math.min(MAX_SCENES, Math.max(MIN_SCENES, n));

  if (typeof scriptCount === "number" && scriptCount >= MIN_SCENES) {
    return clamp(scriptCount);
  }
  if (typeof imageCount === "number" && imageCount > 0) {
    // Une image de plus que de scènes n'a de sens que si elle est affichée :
    // on aligne exactement, dans la limite du plafond.
    return clamp(imageCount);
  }
  if (typeof currentCount === "number" && currentCount >= MIN_SCENES) {
    return clamp(currentCount);
  }
  return 5;
}

/** Décrit en une phrase la règle appliquée, pour le journal de la régie. */
export function describeSceneCount(imageCount: number, sceneCount: number): string {
  if (imageCount > MAX_SCENES) {
    return `${imageCount} visuels fournis : ${MAX_SCENES} scènes créées (plafond du moteur), ${imageCount - MAX_SCENES} visuel(s) non utilisé(s).`;
  }
  return `${imageCount} visuel(s) → ${sceneCount} scène(s) (1 image = 1 scène).`;
}
