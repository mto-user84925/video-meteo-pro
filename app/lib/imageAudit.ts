/**
 * Contrôle de cohérence entre les scènes et les cartes téléversées.
 *
 * Objectif : garantir que l'ordre de l'actualité correspond à l'ordre des
 * images. Détecte silencieusement les erreurs de recopie de noms par l'IA
 * (deux cartes qui ne diffèrent que par 7 chiffres) et les cartes oubliées
 * ou utilisées deux fois.
 */

export interface SceneImageInfo {
  sceneNumber: number;
  /** Nom cité par l'IA dans « Image à utiliser ». */
  declaredName: string;
  /** Nom réellement attribué après correspondance (vide si introuvable). */
  matchedName?: string;
}

export interface UploadedImageInfo {
  name: string;
  ref: number;
}

export interface ImageAuditIssue {
  level: "error" | "warning" | "info";
  sceneNumber?: number;
  message: string;
}

export interface ImageAuditResult {
  issues: ImageAuditIssue[];
  /** Nombre de scènes dont l'image est résolue. */
  resolved: number;
  /** Cartes téléversées jamais utilisées. */
  unused: string[];
  /** Cartes utilisées par plusieurs scènes. */
  duplicated: string[];
  /** Vrai si l'ordre chronologique des scènes suit celui des cartes. */
  orderOk: boolean;
}

/** Normalise un nom de fichier pour comparaison tolérante. */
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Distance de Levenshtein, pour repérer un nom « presque » identique. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Analyse la cohérence scènes / cartes.
 * Ne corrige rien : produit des messages lisibles pour le journal de la régie.
 */
export function auditSceneImages(
  scenes: SceneImageInfo[],
  uploaded: UploadedImageInfo[]
): ImageAuditResult {
  const issues: ImageAuditIssue[] = [];
  const uploadedNames = uploaded.map((u) => u.name);
  const normUploaded = new Map(uploadedNames.map((n) => [norm(n), n]));

  const usageCount = new Map<string, number>();
  const usedOrder: number[] = []; // indices de référence des cartes, dans l'ordre des scènes
  let resolved = 0;

  for (const sc of scenes) {
    const declared = (sc.declaredName || "").trim();
    const matched = (sc.matchedName || "").trim();

    if (!declared && !matched) {
      issues.push({
        level: "warning",
        sceneNumber: sc.sceneNumber,
        message: `Scène ${sc.sceneNumber} : aucune image indiquée.`,
      });
      continue;
    }

    if (!matched) {
      // Le nom cité n'a pu être rattaché à aucune carte téléversée.
      const target = norm(declared);
      // Cherche le nom téléversé le plus proche (erreur de recopie probable).
      let closest: string | null = null;
      let bestDist = Infinity;
      for (const up of uploadedNames) {
        const d = levenshtein(target, norm(up));
        if (d < bestDist) {
          bestDist = d;
          closest = up;
        }
      }
      const nearMiss =
        closest && bestDist > 0 && bestDist <= Math.max(3, Math.round(target.length * 0.06));
      issues.push({
        level: "error",
        sceneNumber: sc.sceneNumber,
        message: nearMiss
          ? `Scène ${sc.sceneNumber} : l'image citée « ${declared} » est introuvable — probable erreur de recopie, la carte la plus proche est « ${closest} ».`
          : `Scène ${sc.sceneNumber} : l'image citée « ${declared} » ne correspond à aucune carte téléversée.`,
      });
      continue;
    }

    resolved += 1;
    usageCount.set(matched, (usageCount.get(matched) || 0) + 1);

    const idx = uploaded.findIndex((u) => u.name === matched);
    if (idx >= 0) usedOrder.push(idx);

    // Nom cité qui ne correspond PAS au fichier réellement attribué
    if (declared && normUploaded.has(norm(declared)) && normUploaded.get(norm(declared)) !== matched) {
      issues.push({
        level: "warning",
        sceneNumber: sc.sceneNumber,
        message: `Scène ${sc.sceneNumber} : le nom cité (« ${declared} ») diffère de la carte attribuée (« ${matched} »).`,
      });
    }
  }

  const duplicated = [...usageCount.entries()].filter(([, c]) => c > 1).map(([n]) => n);
  for (const dup of duplicated) {
    const count = usageCount.get(dup) || 0;
    const sceneNums = scenes.filter((s) => s.matchedName === dup).map((s) => s.sceneNumber);
    issues.push({
      level: "warning",
      message: `La carte « ${dup} » est utilisée ${count} fois (scènes ${sceneNums.join(", ")}).`,
    });
  }

  const unused = uploadedNames.filter((n) => !usageCount.has(n));
  if (unused.length > 0) {
    issues.push({
      level: unused.length >= uploadedNames.length ? "error" : "warning",
      message: `${unused.length} carte(s) fournie(s) mais non utilisée(s) : ${unused.join(", ")}.`,
    });
  }

  // Ordre : les indices des cartes doivent être croissants avec les scènes.
  let orderOk = true;
  for (let i = 1; i < usedOrder.length; i++) {
    if (usedOrder[i] <= usedOrder[i - 1]) {
      orderOk = false;
      break;
    }
  }
  if (!orderOk) {
    const order = usedOrder.map((idx) => uploadedNames[idx]).filter(Boolean);
    const sceneNums = scenes.map((s) => s.sceneNumber);
    issues.push({
      level: "info",
      message:
        `Ordre des cartes différent de l'ordre de téléversement (scènes ${sceneNums.join(", ")} → ` +
        `${order.map((n) => `« ${n} »`).join(", ")}). Vérifiez que chaque visuel correspond bien au propos de sa scène.`,
    });
  }

  return { issues, resolved, unused, duplicated, orderOk };
}

/** Formate le résultat en une ligne synthétique pour le journal. */
export function summarizeImageAudit(result: ImageAuditResult, sceneCount: number): string {
  if (result.issues.length === 0) {
    return `✅ Images cohérentes : ${result.resolved}/${sceneCount} scènes rattachées, ordre respecté.`;
  }
  const errors = result.issues.filter((i) => i.level === "error").length;
  const warnings = result.issues.filter((i) => i.level === "warning").length;
  return `⚠️ Contrôle images : ${errors} erreur(s), ${warnings} avertissement(s) — voir le détail.`;
}
