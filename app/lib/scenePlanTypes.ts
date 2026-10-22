/** Type d'une scène du bulletin, partagé entre page.tsx et les utilitaires. */
export interface Scene {
  scene_number: number;
  badge: string;
  badge_color: number[];
  title: string;
  sub: string;
  location_tag: string;
  ticker: string;
  script_text: string;
  file_url?: string;
  file_name?: string;
  image_ref?: number;
  image_hint?: string;
}
