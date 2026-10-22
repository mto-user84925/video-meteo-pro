-- ============================================================================
-- Sécurisation Supabase — Video Météo Pro / Météo-Climat Pro
-- Projet : ubdevaemtwbzxksjlhjg
--
-- OBJECTIF
--   La publication reste possible en 1 clic depuis le studio, mais l'écriture
--   est réservée à l'application (clé service_role, côté serveur). La LECTURE
--   publique reste ouverte : vos 3 sites continuent de servir les articles.
--
-- À EXÉCUTER DANS : Supabase > SQL Editor (une seule fois)
-- Idempotent : peut être relancé sans erreur.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. ARTICLES : meteo_posts
--    Fautive actuelle : "Anon full access" (ALL, roles=public, with_check=true)
--    qui autorise n'importe qui à insérer/modifier/supprimer.
-- ----------------------------------------------------------------------------
drop policy if exists "Anon full access" on public.meteo_posts;
drop policy if exists "Allow admin full access on meteo_posts" on public.meteo_posts;

-- Lecture : on conserve le service public des articles publiés.
drop policy if exists "lecture_publique_articles_publies" on public.meteo_posts;
create policy "lecture_publique_articles_publies"
  on public.meteo_posts
  for select
  to anon, authenticated
  using (published = true);

-- Les brouillons (published = false) restent lisibles côté service_role
-- qui contourne RLS par construction.

-- ----------------------------------------------------------------------------
-- 2. ARTICLES : posts (version thème clair pour MétéoBTP / Climat-Météo)
--    Aucune policy d'écriture n'existe : service_role suffit. On sécurise
--    uniquement la lecture par cohérence.
-- ----------------------------------------------------------------------------
drop policy if exists "lecture_publique_posts_publies" on public.posts;
create policy "lecture_publique_posts_publies"
  on public.posts
  for select
  to anon, authenticated
  using (published = true);

-- ----------------------------------------------------------------------------
-- 3. STORAGE : bucket blog-images
--    Fautives actuelles : "Allow public upload" (INSERT anon),
--    "Allow public update" (UPDATE anon).
--    Le studio passe désormais par /api/upload-scene (service_role).
-- ----------------------------------------------------------------------------
drop policy if exists "Allow public upload" on storage.objects;
drop policy if exists "Allow public update" on storage.objects;
drop policy if exists "Allow public insert to blog-images" on storage.objects;
drop policy if exists "Allow public delete from blog-images" on storage.objects;

-- Lecture publique conservée (vidéos et cartes affichées par les sites).
drop policy if exists "Allow public select" on storage.objects;
create policy "lecture_publique_blog_images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'blog-images');

-- ----------------------------------------------------------------------------
-- 4. STORAGE : bucket vigilance-captures
--    "Full Public Access" (ALL, public) est trop permissif, mais ce bucket ne
--    concerne pas Video Météo Pro. Décommentez si vous voulez l'assainir aussi :
-- ----------------------------------------------------------------------------
-- drop policy if exists "Full Public Access" on storage.objects;
-- drop policy if exists "Allow public update to vigilance-captures" on storage.objects;
-- create policy "ecriture_service_vigilance"
--   on storage.objects for insert to authenticated
--   with check (bucket_id = 'vigilance-captures');

commit;

-- ============================================================================
-- VÉRIFICATION APRÈS EXÉCUTION
-- ============================================================================
-- Doit renvoyer 0 ligne d'écriture ouverte à anon / public :
--
--   select tablename, policyname, cmd, roles::text
--   from pg_policies
--   where schemaname in ('public','storage')
--     and tablename in ('meteo_posts','posts','objects')
--     and cmd <> 'SELECT'
--     and ('anon' = any(roles) or 'public' = any(roles));
--
-- ATTENDU : aucune ligne pour meteo_posts / posts,
--           et aucune ligne pour storage.objects sur blog-images.
-- ============================================================================
