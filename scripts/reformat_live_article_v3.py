import urllib.request
import json
import re

SUPABASE_URL = "https://ubdevaemtwbzxksjlhjg.supabase.co"
ANON_KEY = "sb_publishable_1qhA0xAnNSd3VxpoLdxYrQ_yUemEhaP"
headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json"
}

# The 6 image URLs from Supabase storage
img1_url = "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/renders/session_1792338945043/batch_6_1792338945048_MeteoClimatPro_GFS_0_25__Europe_geopotentiel-500-hpa_1792336702587.png"
img2_url = "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/renders/session_1792338945043/batch_5_1792338945048_MeteoClimatPro_GFS_0_25__France_rafales-max-periode_1792338443593.png"
img3_url = "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/renders/session_1792338945043/batch_1_1792338945044_MeteoClimatPro_GFS_0_25__France_pluie-periode_1792338574811.png"
img4_url = "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/renders/session_1792338945043/batch_3_1792338945048_MeteoClimatPro_GFS_0_25__France_rafales-max-periode_1792338497854.png"
img5_url = "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/renders/session_1792338945043/batch_4_1792338945048_MeteoClimatPro_GFS_0_25__France_rafales-max-periode_1792338479555.png"
img6_url = "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/renders/session_1792338945043/batch_2_1792338945048_MeteoClimatPro_GFS_0_25__France_rafales-max-periode_1792338520506.png"

# Theme colors (Présentation 5 — BTP & Prévention)
PRIMARY = "#fbbf24"
ACCENT = "#38bdf8"
BOX_BG = "rgba(245, 158, 11, 0.14)"
BOX_BORDER = "#f59e0b"
SUMMARY_BG = "rgba(56, 189, 248, 0.12)"
SUMMARY_BORDER = "#38bdf8"

def surligne(text, border_color=PRIMARY):
    return f'<strong style="background: rgba(56, 189, 248, 0.16); color: #ffffff; font-weight: 700; padding: 1px 6px; border-radius: 4px; border-bottom: 2px solid {border_color}; box-decoration-break: clone; -webkit-box-decoration-break: clone;">{text}</strong>'

def render_figure(img_url, img_num, caption, scene_title=None, badge=None, ticker=None, voice_text=None, scene_num=None):
    voice_html = ""
    if voice_text:
        badge_html = f'<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">{badge}</span>' if badge else ""
        ticker_html = f'''
      <div style="font-size: 12.5px; color: #fbbf24; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>📡</span> <span>Bandeau TV : {ticker}</span>
      </div>''' if ticker else ""
        title_label = f" (Scène {scene_num} — {scene_title})" if (scene_num and scene_title) else (f" (Scène {scene_num})" if scene_num else "")
        voice_html = f'''
    <div style="margin-top: 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.35); border-left: 4px solid #38bdf8; border-radius: 8px; padding: 12px 16px; text-align: left;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 13px;">🎙️</span>
          <span style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.06em;">Séquence Vidéo Broadcast{title_label} :</span>
        </div>
        {badge_html}
      </div>{ticker_html}
      <p style="margin: 0; font-size: 14px; color: #f1f5f9; font-style: italic; line-height: 1.6;">
        « {voice_text} »
      </p>
    </div>'''

    return f'''
  <div style="margin: 28px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
    <img src="{img_url}" alt="{caption.replace('"', '&quot;')}" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
    <p style="font-size: 13.5px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
      <strong style="background: rgba(56, 189, 248, 0.2); color: #ffffff; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11.5px; margin-right: 6px;">FIGURE {img_num}</strong> {caption}
    </p>{voice_html}
  </div>'''

# Complete HTML for the article
html = f'''<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #f1f5f9; line-height: 1.85; font-size: 16px;">

<div style="margin-bottom: 14px;">
  <span style="display: inline-block; background: {BOX_BG}; color: {PRIMARY}; border: 1px solid {BOX_BORDER}; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;">
    PRÉVENTION BTP &amp; ROUTES • MÉTÉO-CLIMAT PRO
  </span>
</div>

<h1 style="color: #ffffff; font-size: 26px; font-weight: 900; line-height: 1.35; text-transform: uppercase; letter-spacing: 0.04em; margin: 14px 0 8px 0;">RISQUE DE TEMPÊTE SUR LA FRANCE</h1>
<h2 style="color: {PRIMARY}; font-size: 18px; font-weight: 800; line-height: 1.4; text-transform: uppercase; letter-spacing: 0.03em; margin: 0 0 24px 0; border-bottom: 2px solid {PRIMARY}; padding-bottom: 8px;">VENTS VIOLENTS ET FORTES PLUIES : UNE FIN DE SEMAINE SOUS SURVEILLANCE</h2>

<div style="font-size: 17px; font-weight: 500; color: #f8fafc; line-height: 1.85; background: rgba(15, 23, 42, 0.45); border-left: 4px solid {PRIMARY}; border-radius: 4px; padding: 16px 20px; margin: 20px 0 26px 0;">
  La situation météorologique pourrait nettement se dégrader sur une grande partie de la France à partir du {surligne("mercredi 21 octobre 2026")}. Après les épisodes pluvieux concernant notamment les régions méditerranéennes, c'est désormais l'Atlantique qui pourrait imposer son rythme, avec le retour d'une circulation d'ouest particulièrement dynamique.
</div>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Les analyses de Météo-Climat Pro font apparaître un environnement favorable au passage de dépressions actives près des îles Britanniques, capables de générer de fortes rafales sur les régions occidentales et septentrionales.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">La Bretagne, la Normandie, les Pays de la Loire et les Hauts-de-France constituent les principaux secteurs à surveiller. Le Centre et l'Île-de-France pourraient également connaître des vents soutenus.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Les modèles envisagent localement des rafales {surligne("dépassant 100 km/h")}, tandis que l'hypothèse de pointes supérieures à {surligne("150 km/h")} sur certains littoraux apparaît dans le scénario décrit par le texte initial. Cette dernière valeur reste toutefois à confirmer.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">L'enjeu des prochains jours sera de préciser la trajectoire des dépressions, leur profondeur et l'extension réelle des vents les plus violents.</p>

<h3 style="color: {PRIMARY}; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 32px; margin-bottom: 12px; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 6px;">UNE CONFIGURATION ATMOSPHÉRIQUE FAVORABLE À UNE FORTE AGITATION</h3>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">La carte de pression au sol et de géopotentiel à 500 hPa, valable {surligne("vendredi 23 octobre à 2 h")}, illustre cette situation.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Une dépression particulièrement creuse, {surligne("proche de 984 hPa")}, apparaît sur l'Atlantique Nord, au voisinage de l'Islande. D'autres centres dépressionnaires concernent l'Atlantique, tandis que les hautes pressions se maintiennent sur le sud-ouest de l'océan, avec un anticyclone atteignant {surligne("1030 hPa")}.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Sur l'Europe occidentale, les lignes de pression témoignent d'une circulation perturbée, avec un minimum secondaire à proximité du sud de l'Angleterre. Cette organisation favorise la circulation de perturbations océaniques vers le continent.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Le contraste entre les pressions élevées au sud et les basses pressions au nord peut contribuer à renforcer le flux d'ouest à sud-ouest. La violence des rafales dépendra néanmoins de la position exacte des systèmes dépressionnaires et de leur évolution.</p>

<h3 style="color: {PRIMARY}; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 34px 0 12px 0; border-bottom: 1px solid rgba(56, 189, 248, 0.25); padding-bottom: 6px;">💨 VENTS FORTS ET PLUIES : LES PRINCIPAUX INDICATEURS</h3>

<div style="font-size: 13.5px; color: {PRIMARY}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin: -6px 0 14px 0;">📍 ZONE &amp; PÉRIODE : FRANCE MÉTROPOLITAINE — SIMULATIONS GFS DU 18 AU 22 OCTOBRE 2026, PUIS ANALYSE SYNOPTIQUE POUR LE 23 OCTOBRE</div>

<div style="background: {BOX_BG}; border-left: 5px solid {BOX_BORDER}; border-radius: 8px; padding: 18px 22px; margin: 22px 0;">
  <ul style="margin: 0; padding-left: 20px; color: #f1f5f9; font-size: 15.5px; line-height: 1.85;">
    <li style="margin-bottom: 8px; color: #cbd5e1;">{surligne("Jusqu'à 108 km/h environ")} — Sur les secteurs les plus exposés des côtes normandes, d'après les cartes de rafales cumulées.</li>
    <li style="margin-bottom: 8px; color: #cbd5e1;">{surligne("100 à 106 km/h")} — Localement dans le Nord-Ouest et près de certains littoraux atlantiques.</li>
    <li style="margin-bottom: 8px; color: #cbd5e1;">{surligne("70 à 95 km/h")} — Sur de nombreuses zones intérieures de la moitié nord, avec des pointes plus fortes localement.</li>
    <li style="margin-bottom: 8px; color: #cbd5e1;">{surligne("100 à plus de 150 mm de pluie")} — Localement davantage, dans certains secteurs du sud et du sud-est sur la période de cinq jours.</li>
  </ul>
</div>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Ces chiffres constituent des maxima simulés sur une période déterminée. Ils ne signifient pas que les rafales les plus fortes se produiront partout simultanément, ni que les précipitations seront continues.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Sur la carte des pluies, le signal le plus marqué concerne notamment des secteurs du sud-est, tandis que des cumuls significatifs apparaissent également en Bretagne et en Normandie.</p>

{render_figure(
    img1_url,
    1,
    "Géopotentiel à 500 hPa et pression au sol, Europe et Atlantique Nord, modèle GFS 0,25°, run 06 UTC, échéance vendredi 23 octobre 2026 à 02 h. Dépression principale à 984 hPa sur l'Atlantique Nord.",
    "DÉPRESSIONS ATLANTIQUES",
    "ANALYSE MÉTÉO",
    "Dépression à 984 hPa près de l'Islande.",
    "Sur l'Atlantique Nord, une profonde dépression proche de neuf cent quatre-vingt-quatre hectopascals apparaît vendredi. Les contrastes de pression favorisent une circulation océanique dynamique vers les îles Britanniques et l'Europe occidentale. Le positionnement exact des dépressions restera déterminant pour les vents au sol.",
    2
)}

<h3 style="color: #38bdf8; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid rgba(56, 189, 248, 0.35); padding-bottom: 8px;">🔬 COMPRENDRE POURQUOI UNE DÉPRESSION PEUT PROVOQUER DES VENTS VIOLENTS</h3>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">La force du vent dépend notamment des différences de pression atmosphérique entre deux régions. Lorsque les isobares, ces lignes reliant les points de même pression, se resserrent fortement, le gradient de pression augmente et peut favoriser des vents soutenus.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Dans la configuration envisagée, une succession de dépressions atlantiques pourrait circuler rapidement à proximité des îles Britanniques.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Le courant jet constitue un autre élément important. Situé à haute altitude, il participe à l'organisation et au déplacement des systèmes météorologiques. Dans certaines conditions, les interactions entre le courant jet et une perturbation peuvent favoriser le creusement rapide d'un minimum dépressionnaire.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Enfin, l'état de la mer joue un rôle non négligeable. Des vents violents et durables sur l'océan créent une forte houle. Si ces conditions coïncident avec de forts coefficients de marée, le risque de surcote marine et de vagues submersives augmente sur le littoral.</p>

<h3 style="color: #fbbf24; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid rgba(251, 191, 36, 0.35); padding-bottom: 8px;">🏗️ LES CONSÉQUENCES CONCRÈTES SUR LES TRANSPORTS, LES ACTIVITÉS ET LES CHANTIERS</h3>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Si cette dégradation se confirme, ses effets pourraient se faire sentir dans plusieurs domaines d'activité.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Sur les routes, les rafales transversales représentent un danger pour les véhicules légers avec remorque, les caravanes et les poids lourds. Des chutes de branches ou d'arbres peuvent également perturber la circulation sur le réseau secondaire.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Dans le secteur du BTP, le vent constitue un facteur limitant direct pour le travail en hauteur, le montage d'échafaudages, les opérations de toiture et l'utilisation de grues. Des mesures d'amarrage des matériaux légers et de sécurisation des installations extérieures sont généralement nécessaires.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Les précipitations abondantes attendues par endroits peuvent aggraver la situation en saturant les sols, ce qui augmente le risque de glissement de terrain localisé, de ruissellement et de déstabilisation d'arbres aux racines fragilisées.</p>

{render_figure(
    img2_url,
    2,
    "Simulation nationale des rafales maximales de vent en km/h sur la période du 18 au 22 octobre 2026 — Modèle GFS 0,25°. Risque venteux étendu à l'ensemble du quart nord-ouest.",
    "TEMPÊTES EN VUE ?",
    "RISQUE TEMPÉTUEUX",
    "Fortes rafales possibles sur l'Ouest et le Nord.",
    "Une séquence très agitée se dessine sur la France en seconde partie de semaine.",
    1
)}

<h3 style="color: {PRIMARY}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid {PRIMARY}; padding-bottom: 8px;">⚠️ TROIS SITUATIONS PÉDAGOGIQUES SELON L'ÉVOLUTION DES DÉPRESSIONS</h3>

<div style="background: rgba(34, 197, 94, 0.12); border-left: 5px solid #22c55e; border-radius: 8px; padding: 16px 20px; margin: 18px 0;">
  <div style="font-weight: 900; color: #4ade80; text-transform: uppercase; font-size: 15px; letter-spacing: 0.05em; margin-bottom: 6px;">
    🟢 NIVEAU 1 — COUP DE VENT CLASSIQUE D'AUTOMNE
  </div>
  <div style="color: #f1f5f9; font-size: 15.5px; line-height: 1.75;">Les dépressions circulent assez haut sur les îles Britanniques. Des rafales de {surligne("70 à 90 km/h")} concernent les côtes et de {surligne("60 à 75 km/h")} l'intérieur des terres, entraînant des gênes limitées.</div>
</div>

<div style="background: rgba(245, 158, 11, 0.14); border-left: 5px solid #f59e0b; border-radius: 8px; padding: 16px 20px; margin: 18px 0;">
  <div style="font-weight: 900; color: #fbbf24; text-transform: uppercase; font-size: 15px; letter-spacing: 0.05em; margin-bottom: 6px;">
    🟠 NIVEAU 2 — FORT COUP DE VENT À TEMPÊTE MODÉRÉE
  </div>
  <div style="color: #f1f5f9; font-size: 15.5px; line-height: 1.75;">Une anomalie plus creuse s'approche plus près des côtes françaises. Les rafales dépassent {surligne("100 km/h")} sur une large bande littorale et atteignent {surligne("80 à 95 km/h")} dans les terres du nord-ouest, avec des perturbations sensibles des transports et des activités extérieures.</div>
</div>

<div style="background: rgba(239, 68, 68, 0.16); border-left: 5px solid #ef4444; border-radius: 8px; padding: 16px 20px; margin: 18px 0;">
  <div style="font-weight: 900; color: #f87171; text-transform: uppercase; font-size: 15px; letter-spacing: 0.05em; margin-bottom: 6px;">
    🔴 NIVEAU 3 — TEMPÊTE SÉVÈRE
  </div>
  <div style="color: #f1f5f9; font-size: 15.5px; line-height: 1.75;">Un creusement plus dynamique plonge vers la Manche ou le nord du pays. Les rafales pourraient alors approcher ou dépasser {surligne("120 à 130 km/h")} sur les côtes et {surligne("100 km/h")} dans l'intérieur. Ce scénario n'est pas encore garanti par les éléments actuels.</div>
</div>

<div style="overflow-x: auto; margin: 26px 0;">
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left; background: rgba(15, 23, 42, 0.6); border-radius: 8px; overflow: hidden; border: 1px solid rgba(56, 189, 248, 0.25);">
    <thead>
      <tr style="background: rgba(245, 158, 11, 0.2); color: {PRIMARY}; border-bottom: 1px solid rgba(56, 189, 248, 0.3);">
        <th style="padding: 12px 14px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em; font-size: 13px;">ZONE OU SCÉNARIO</th>
        <th style="padding: 12px 14px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em; font-size: 13px;">ÉCHÉANCE / PÉRIODE</th>
        <th style="padding: 12px 14px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em; font-size: 13px;">PHÉNOMÈNES &amp; VALEURS</th>
        <th style="padding: 12px 14px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em; font-size: 13px;">CONSÉQUENCES &amp; VIGILANCE</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
        <td style="padding: 12px 14px; color: #ffffff; font-weight: 700;">Littoral Manche et Atlantique Nord</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">18 au 22 octobre, puis 23-24 octobre</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Rafales 90 à 110 km/h, localement plus</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Surveillance côtière, risques sur activités maritimes et chantiers</td>
      </tr>
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
        <td style="padding: 12px 14px; color: #ffffff; font-weight: 700;">Plaines du Nord-Ouest et Île-de-France</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Jeudi 22 à samedi 24 octobre</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Rafales 70 à 95 km/h possibles</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Chutes de branches, gêne pour les transports terrestres</td>
      </tr>
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
        <td style="padding: 12px 14px; color: #ffffff; font-weight: 700;">Secteurs du Sud-Est</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">18 au 22 octobre</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Cumuls 100 à 150 mm ou plus</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Ruissellements, saturation des sols, vigilance crues locales</td>
      </tr>
    </tbody>
  </table>
</div>

{render_figure(
    img3_url,
    3,
    "Cumuls de précipitations prévus en millimètres entre le 18 et le 22 octobre 2026, modèle GFS 0,25°, run 06 UTC. Des cumuls importants sont simulés dans le sud-est et dans plusieurs secteurs occidentaux.",
    "UNE SITUATION À SURVEILLER",
    "FORTES PLUIES",
    "Des cumuls importants sont simulés sur cinq jours.",
    "Les pluies pourraient aussi être abondantes, surtout sur certains secteurs du Sud-Est. Pour vendredi et samedi, l'intensité réelle reste à préciser. Prudence dans les déplacements et sur les chantiers exposés, et restez connectés avec METEO CLIMAT PRO.",
    5
)}

<div style="background: rgba(245, 158, 11, 0.14); border: 1px solid rgba(245, 158, 11, 0.4); border-left: 5px solid #fbbf24; border-radius: 8px; padding: 18px 22px; margin: 28px 0;">
  <div style="font-weight: 900; color: #fbbf24; text-transform: uppercase; font-size: 15px; letter-spacing: 0.05em; margin-bottom: 8px;">
    ⚠️ À NE PAS INTERPRÉTER COMME UNE CERTITUDE ABSOLUE
  </div>
  <p style="font-size: 15px; color: #fef3c7; margin: 0; line-height: 1.75;">
    Les cartes présentées traduisent des simulations numériques et non des faits déjà observés.<br/><br/>
    Une valeur de rafale maximale calculée sur cinq jours indique le niveau le plus élevé modélisé au cours de la période, et non un vent continu.<br/><br/>
    De même, les chiffres les plus élevés évoqués pour la fin de semaine dépendent étroitement de la trajectoire définitive des dépressions, qui peut encore varier de plusieurs centaines de kilomètres.
  </p>
</div>

<h3 style="color: {PRIMARY}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid {PRIMARY}; padding-bottom: 8px;">🎯 LES 4 FACTEURS DÉTERMINANTS À SURVEILLER</h3>

<div style="background: {BOX_BG}; border-left: 5px solid {BOX_BORDER}; border-radius: 8px; padding: 18px 22px; margin: 22px 0;">
  <ul style="margin: 0; padding-left: 20px; color: #f1f5f9; font-size: 15.5px; line-height: 1.85;">
    <li style="margin-bottom: 8px; color: #cbd5e1;"><strong>La trajectoire des dépressions :</strong> un décalage de 100 km peut modifier complètement la zone touchée par les vents les plus forts.</li>
    <li style="margin-bottom: 8px; color: #cbd5e1;"><strong>Le creusement de l'anomalie :</strong> une baisse plus rapide de la pression centrale accentuerait les gradients et les rafales.</li>
    <li style="margin-bottom: 8px; color: #cbd5e1;"><strong>Le phasage avec le jet-stream :</strong> une interaction plus efficace avec le vent d'altitude favoriserait une dégradation plus marquée.</li>
    <li style="margin-bottom: 8px; color: #cbd5e1;"><strong>Les marées et surcotes :</strong> l'impact littoral dépendra de la concordance entre le pic de vent et les pleines mers.</li>
  </ul>
</div>

<h3 style="color: {PRIMARY}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid {PRIMARY}; padding-bottom: 8px;">📊 FIABILITÉ DES PRÉVISIONS ET ÉCHÉANCES</h3>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Le niveau de confiance est {surligne("bon")} pour le principe général d'un changement de temps et pour l'installation d'un flux d'ouest perturbé à compter de mercredi.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">La fiabilité devient en revanche {surligne("moyenne")} pour la localisation précise des rafales les plus fortes entre jeudi et vendredi, et plus {surligne("limitée")} pour l'échéance de samedi 24 octobre, où l'intensité du creusement dépressionnaire demande confirmation.</p>

<h3 style="color: {ACCENT}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid {ACCENT}; padding-bottom: 8px;">❓ FOIRE AUX QUESTIONS</h3>

<div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-left: 4px solid {PRIMARY}; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
  <div style="font-weight: 800; color: #38bdf8; font-size: 16px; margin-bottom: 6px;">❓ 1. Une tempête est-elle certaine sur la France ?</div>
  <div style="color: #e2e8f0; font-size: 15px; line-height: 1.75;">Non. Une forte dégradation venteuse et pluvieuse est probable, mais l'intensité exacte et le statut de tempête dépendront des prochaines actualisations des modèles.</div>
</div>

<div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-left: 4px solid {PRIMARY}; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
  <div style="font-weight: 800; color: #38bdf8; font-size: 16px; margin-bottom: 6px;">❓ 2. Quelles régions sont les plus exposées au vent ?</div>
  <div style="color: #e2e8f0; font-size: 15px; line-height: 1.75;">La Bretagne, la Normandie, les Pays de la Loire et les Hauts-de-France apparaissent en première ligne dans les simulations disponibles.</div>
</div>

<div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-left: 4px solid {PRIMARY}; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
  <div style="font-weight: 800; color: #38bdf8; font-size: 16px; margin-bottom: 6px;">❓ 3. Quand le vent sera-t-il le plus fort ?</div>
  <div style="color: #e2e8f0; font-size: 15px; line-height: 1.75;">Le renforcement devrait débuter mercredi, avec un risque de rafales plus marqué vendredi 23 et potentiellement samedi 24 octobre.</div>
</div>

<div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-left: 4px solid {PRIMARY}; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
  <div style="font-weight: 800; color: #38bdf8; font-size: 16px; margin-bottom: 6px;">❓ 4. Les pluies sont-elles à craindre ?</div>
  <div style="color: #e2e8f0; font-size: 15px; line-height: 1.75;">Oui, des cumuls significatifs sont attendus dans le nord-ouest, tandis que des cumuls supérieurs à 100 mm restent modélisés sur certaines zones du sud-est.</div>
</div>

<div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-left: 4px solid {PRIMARY}; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
  <div style="font-weight: 800; color: #38bdf8; font-size: 16px; margin-bottom: 6px;">❓ 5. Comment suivre l'évolution de la situation ?</div>
  <div style="color: #e2e8f0; font-size: 15px; line-height: 1.75;">Il convient de consulter régulièrement les actualisations de Météo-Climat Pro à mesure que l'échéance se rapproche.</div>
</div>

<h3 style="color: {PRIMARY}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid {PRIMARY}; padding-bottom: 8px;">
  🗺️ MODÉLISATIONS CARTOGRAPHIQUES &amp; ANALYSES COMPLÉMENTAIRES
</h3>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 15.5px; line-height: 1.8;">
  Retrouvez ci-dessous l'ensemble des modélisations numériques et simulations complémentaires analysées par nos météorologues pour le suivi de cette situation.
</p>

{render_figure(
    img4_url,
    4,
    "Zoom haute résolution sur la Normandie et les côtes de la Manche — Rafales maximales simulées jusqu'à 108 km/h. Modèle GFS 0,25°.",
    "PLUS DE 100 KM/H",
    "RAFALES MAXIMALES",
    "Jusqu'à 108 km/h simulés sur la période du 18 au 22 octobre.",
    "Sur les côtes normandes, certaines valeurs atteignent environ cent huit kilomètres par heure. Ailleurs, de nombreuses zones de la moitié nord dépassent quatre-vingts kilomètres par heure. Ces maxima couvrent cinq jours et ne décrivent pas un instant précis.",
    4
)}

{render_figure(
    img5_url,
    5,
    "Simulation des rafales maximales simulées sur la Bretagne et le quart nord-ouest de la France entre 80 et 100 km/h — Modèle GFS 0,25°.",
    "LE NORD-OUEST SOUS LE VENT",
    "ZONES EXPOSÉES",
    "Nombreuses rafales simulées entre 80 et 100 km/h.",
    "Sur la période du dix-huit au vingt-deux octobre, les simulations montrent de fortes rafales sur la Bretagne, la Normandie et les Pays de la Loire. Les secteurs proches de la Manche et les Hauts-de-France sont également concernés par ce signal.",
    3
)}

{render_figure(
    img6_url,
    6,
    "Simulation nationale des rafales maximales de vent en km/h sur la France entière — Météo-Climat Pro.",
    "SURVEILLANCE GFS",
    "MODÉLISATION NATIONALE",
    "Modélisation des rafales maximales sur le domaine France métropolitaine.",
    "Suivi en continu des modélisations numériques et des actualisations des runs haute résolution par les météorologues de Météo-Climat Pro.",
    None
)}

<h3 style="color: #ffffff; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid #64748b; padding-bottom: 8px;">📌 CONCLUSION</h3>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">La seconde partie de semaine pourrait être marquée par une nette intensification de la circulation océanique, avec un risque de fortes rafales et de passages pluvieux sur une grande partie de la France.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">La Bretagne, la Normandie, les Pays de la Loire et les Hauts-de-France resteront particulièrement sous surveillance.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Les cartes disponibles mettent en évidence des rafales localement {surligne("supérieures à 100 km/h")} sur la période du 18 au 22 octobre, tandis que la configuration synoptique prévue vendredi 23 octobre demeure favorable à une agitation atmosphérique soutenue.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">L'hypothèse d'une tempête plus violente, avec des rafales nettement supérieures, devra être réévaluée au fil des prochaines simulations.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Météo-Climat Pro suivra particulièrement l'évolution des dépressions atlantiques et leurs conséquences potentielles sur les littoraux, les transports et les activités professionnelles.</p>

<div style="background: {SUMMARY_BG}; border: 1px solid {SUMMARY_BORDER}; border-radius: 10px; padding: 20px 24px; margin: 30px 0;">
  <h4 style="color: {PRIMARY}; font-size: 17px; margin-top: 0; margin-bottom: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em;">⏱️ EN RÉSUMÉ EN 30 SECONDES</h4>
  <p style="font-size: 15px; color: #f1f5f9; margin: 0; line-height: 1.75;">
    Un changement de régime météorologique pourrait exposer la France à une séquence fortement perturbée à partir du {surligne("mercredi 21 octobre")}. Les régions de l'Ouest et du Nord apparaissent les plus exposées aux fortes rafales, localement supérieures à 100 km/h dans les simulations disponibles. Les pluies pourraient également devenir importantes sur certains territoires. Vendredi 23 et samedi 24 octobre restent des échéances à surveiller, mais les cartes fournies ne permettent pas encore de confirmer les intensités les plus extrêmes évoquées par certains scénarios. La trajectoire des dépressions constituera le principal élément à suivre au cours des prochaines actualisations.<br/><br/>
    Pour suivre les prochaines évolutions et disposer des dernières modélisations réactualisées, consultez régulièrement nos bulletins et analyses sur Météo-Climat Pro.<br/><br/>
    <em>Sources : Modèle numérique GFS 0,25°, cartes de géopotentiel à 500 hPa, pression au sol, rafales maximales et précipitations cumulées, run 06 UTC ; texte d'analyse météorologique fourni et daté du 18 octobre 2026. Analyse : Météo-Climat Pro.</em>
  </p>
</div>

</div>'''

# Generate Light theme
light_html = html
replacements = [
    (r"color:\s*#f1f5f9", "color: #1e293b"),
    (r"color:\s*#f8fafc", "color: #0f172a"),
    (r"color:\s*#ffffff", "color: #0f172a"),
    (r"color:\s*#e2e8f0", "color: #1e293b"),
    (r"color:\s*#cbd5e1", "color: #334155"),
    (r"color:\s*#94a3b8", "color: #64748b"),
    (r"color:\s*#38bdf8", "color: #0284c7"),
    (r"color:\s*#fbbf24", "color: #92400e"),
    (r"color:\s*#fef3c7", "color: #78350f"),
    (r"background:\s*rgba\(15,\s*23,\s*42,\s*0\.[0-9]+\)", "background: #f8fafc; border: 1px solid #e2e8f0"),
    (r"background:\s*rgba\(245,\s*158,\s*11,\s*0\.[0-9]+\)", "background: #fffbeb; border: 1px solid #fde68a"),
    (r"background:\s*rgba\(56,\s*189,\s*248,\s*0\.[0-9]+\)", "background: #f0f9ff; border: 1px solid #bae6fd"),
    (r"background:\s*rgba\(34,\s*197,\s*94,\s*0\.[0-9]+\)", "background: #f0fdf4; border: 1px solid #bbf7d0"),
    (r"background:\s*rgba\(239,\s*68,\s*68,\s*0\.[0-9]+\)", "background: #fef2f2; border: 1px solid #fecaca"),
    (r"border-bottom:\s*2px solid #fbbf24", "border-bottom: 2px solid #d97706"),
    (r"border-bottom:\s*2px solid #38bdf8", "border-bottom: 2px solid #0284c7"),
    (r"border-left:\s*5px solid #22c55e", "border-left: 5px solid #16a34a"),
    (r"border-left:\s*5px solid #f59e0b", "border-left: 5px solid #d97706"),
    (r"border-left:\s*5px solid #ef4444", "border-left: 5px solid #dc2626"),
    (r"border-left:\s*5px solid #fbbf24", "border-left: 5px solid #d97706"),
    (r"border-left:\s*4px solid #fbbf24", "border-left: 4px solid #d97706"),
    (r"border-left:\s*4px solid #38bdf8", "border-left: 4px solid #0284c7"),
]
for pat, rep in replacements:
    light_html = re.sub(pat, rep, light_html, flags=re.IGNORECASE)

# Update the 2 most recent posts in meteo_posts and posts
meteo_posts_ids = [
    "e2df1b92-855c-4185-870f-d6fcac2b90f4",
    "5cb21b4a-8160-435d-9a76-66198f1bcc92"
]
posts_ids = [
    "fbfa11ec-0dde-41ff-82f2-74b9ce331cd4",
    "0bb4d7f4-ee3a-491a-83d0-7f8430ce31ce"
]

for mp_id in meteo_posts_ids:
    patch_req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/meteo_posts?id=eq.{mp_id}",
        data=json.dumps({"content": html}).encode("utf-8"),
        headers=headers,
        method="PATCH"
    )
    with urllib.request.urlopen(patch_req) as resp:
        print(f"meteo_posts ({mp_id}) status:", resp.status)

for p_id in posts_ids:
    patch_req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/posts?id=eq.{p_id}",
        data=json.dumps({"content": light_html}).encode("utf-8"),
        headers=headers,
        method="PATCH"
    )
    with urllib.request.urlopen(patch_req) as resp:
        print(f"posts ({p_id}) status:", resp.status)

print("SUCCESS: All live articles in both tables updated with full broadcast cards!")
