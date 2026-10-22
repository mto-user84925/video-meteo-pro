# Sécurité Supabase — action requise

## Problème découvert le 22/10/2026 (audit)

La clé `sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP` est utilisée **côté navigateur**
(téléversement des cartes depuis le studio) et **côté serveur** (Vercel). Les tests suivants
ont été exécutés **sans authentification** et ont tous réussi :

| Test | Résultat | Conséquence |
|---|---|---|
| `POST /rest/v1/meteo_posts` (insertion d'un article) | **HTTP 201** | N'importe qui peut publier ou modifier un article |
| `GET /rest/v1/meteo_posts?select=*` (lecture complète) | **HTTP 200** | Tout le contenu des articles est lisible avec la clé publique |
| `POST /storage/v1/object/blog-images/...` (écriture Storage) | **HTTP 200** | N'importe qui peut téléverser/saturer le bucket |

Un article de test (`__probe__`) et un fichier témoin ont été créés puis **supprimés
immédiatement** après vérification. Aucun contenu légitime n'a été altéré.

## Risques concrets

1. **Saturation de quota** : le bucket Storage peut être rempli par n'importe qui
   (publicités, fichiers pirates) → dépassement du plan Supabase.
2. **Injection de contenu** : un tiers peut insérer des articles sur `meteo_posts`
   et `posts`, donc publier sur meteobtp.fr, monsieurmeteo.com et climat-meteo.vercel.app.
3. **Écriture des statuts de rendu** : un tiers peut écrire `status.json` pour
   une session → afficher de fausses vidéos dans la régie.

## Correctifs recommandés (dans l'ordre)

### 1. Clé `service_role` côté serveur uniquement

Ne jamais exposer la clé `service_role` au navigateur. Sur Vercel :

```env
# Utilisée uniquement par les routes API (server-side)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."   # Settings > API > service_role

# Utilisée par le navigateur, avec des policies restrictives
SUPABASE_KEY="sb_publishable_..."           # reste publique
```

Le code est déjà prêt : `app/api/publish-article/route.ts` lit
`SUPABASE_SERVICE_ROLE_KEY` en priorité, et `app/api/dispatch/route.ts` /
`scripts/render_engine.py` utilisent `SUPABASE_KEY` (à remplacer par la clé
service_role dans les secrets GitHub Actions).

### 2. Policies RLS à appliquer

```sql
-- 1) Lecture publique des articles publiés uniquement
alter table public.meteo_posts enable row level security;
alter table public.posts enable row level security;

create policy "lecture_publique_articles_publies"
  on public.meteo_posts for select
  using (published = true);

create policy "lecture_publique_posts_publies"
  on public.posts for select
  using (published = true);

-- 2) Aucune policy INSERT/UPDATE/EU pour anon :
--    la service_role (qui contourne RLS) est seule à pouvoir écrire.

-- 3) Storage : lecture publique, écriture réservée au service_role
--    (Storage > Policies > blog-images)
```

### 3. Bucket `blog-images`

Le téléversement des cartes depuis le navigateur (`handleFileUpload`,
`handleBatchFilesUpload`) utilise actuellement la clé publique. Pour conserver
cette fonctionnalité sans ouvrir l'écriture anonyme, créer une route API
`/api/upload-scene` protégée (session + taille/fichiers contrôlés) qui
téléverse avec la `service_role`. Le studio envoie alors les fichiers à
`/api/upload-scene` au lieu de Supabase directement.

> **État actuel** : l'écriture anonyme reste nécessaire au fonctionnement du
> studio. Tant que la route `/api/upload-scene` n'est pas en place, ne pas
> fermer les policies Storage, sinon les téléversements de cartes échoueront.
