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

# Image URLs from the previous session
img1_url = "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/renders/session_1792338945043/batch_6_1792338945048_MeteoClimatPro_GFS_0_25__Europe_geopotentiel-500-hpa_1792336702587.png"
img2_url = "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/renders/session_1792338945043/batch_5_1792338945048_MeteoClimatPro_GFS_0_25__France_rafales-max-periode_1792338443593.png"
img3_url = "https://ubdevaemtwbzxksjlhjg.supabase.co/storage/v1/object/public/blog-images/renders/session_1792338945043/batch_1_1792338945044_MeteoClimatPro_GFS_0_25__France_pluie-periode_1792338574811.png"

# Theme colors (Présentation 5 — BTP & Prévention)
PRIMARY = "#fbbf24"
PRIMARY_LIGHT = "#92400e"
ACCENT = "#38bdf8"
BOX_BG = "rgba(245, 158, 11, 0.14)"
BOX_BORDER = "#f59e0b"
SUMMARY_BG = "rgba(56, 189, 248, 0.12)"
SUMMARY_BORDER = "#38bdf8"

def surligne(text, border_color=PRIMARY):
    return f'<strong style="background: rgba(56, 189, 248, 0.16); color: #ffffff; font-weight: 700; padding: 1px 6px; border-radius: 4px; border-bottom: 2px solid {border_color}; box-decoration-break: clone; -webkit-box-decoration-break: clone;">{text}</strong>'

# Build broadcast HTML
html = f'''<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #f1f5f9; line-height: 1.85; font-size: 16px;">
<div style="margin-bottom: 14px;"><span style="display: inline-block; background: {BOX_BG}; color: {PRIMARY}; border: 1px solid {BOX_BORDER}; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;">PRÉVENTION BTP &amp; ROUTES • Météo-Climat Pro</span></div>

<h1 style="color: #ffffff; font-size: 26px; font-weight: 900; line-height: 1.35; text-transform: uppercase; letter-spacing: 0.04em; margin: 14px 0 8px 0;">RISQUE DE TEMPÊTE SUR LA FRANCE</h1>

<h2 style="color: {PRIMARY}; font-size: 18px; font-weight: 800; line-height: 1.4; text-transform: uppercase; letter-spacing: 0.03em; margin: 0 0 24px 0; border-bottom: 2px solid {PRIMARY}; padding-bottom: 8px;">VENTS VIOLENTS ET FORTES PLUIES : UNE FIN DE SEMAINE SOUS SURVEILLANCE</h2>

<div style="font-size: 17px; font-weight: 500; color: #f8fafc; line-height: 1.85; background: rgba(15, 23, 42, 0.45); border-left: 4px solid {PRIMARY}; border-radius: 4px; padding: 16px 20px; margin: 20px 0 26px 0;">
La situation météorologique pourrait nettement se dégrader sur une grande partie de la France à partir du {surligne("mercredi 21 octobre 2026")}. Après les épisodes pluvieux concernant notamment les régions méditerranéennes, c'est désormais l'Atlantique qui pourrait imposer son rythme, avec le retour d'une circulation d'ouest particulièrement dynamique.
</div>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Les analyses de Météo-Climat Pro font apparaître un environnement favorable au passage de plusieurs dépressions actives entre le milieu de semaine et le week-end suivant.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">La Bretagne, la Normandie, les Pays de la Loire et les Hauts-de-France constituent les principales zones sous surveillance pour les rafales les plus fortes.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Les modèles envisagent localement des rafales {surligne("dépassant 100 km/h")}, tandis que l'hypothèse d'une tempête plus sévère reste à confirmer lors des prochains runs.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">L'enjeu des prochains jours sera de préciser la trajectoire des dépressions, leur profondeur exacte et le calendrier précis des épisodes venteux les plus intenses.</p>

<h3 style="color: {ACCENT}; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 34px 0 12px 0; border-bottom: 1px solid rgba(56, 189, 248, 0.25); padding-bottom: 6px;">UNE CONFIGURATION ATMOSPHÉRIQUE FAVORABLE À UNE FORTE AGITATION</h3>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">La carte de pression au sol et de géopotentiel à 500 hPa, valable {surligne("vendredi 23 octobre à 2 h")}, illustre l'établissement d'un vaste complexe dépressionnaire étendu de l'Islande aux îles Britanniques.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Une dépression particulièrement creuse, {surligne("proche de 984 hPa")}, apparaît sur l'Atlantique Nord, au sud-est du Groenland, générant un resserrement très net des isobares.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Sur l'Europe occidentale, les lignes de pression témoignent d'une circulation perturbée, avec un flux orienté principalement à l'ouest ou au sud-ouest.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Cette organisation favorise la circulation de perturbations océaniques vers le continent.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Le contraste entre les pressions élevées au sud et les basses pressions au nord peut contribuer à accélérer les masses d'air.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">La situation pourrait donc devenir préoccupante, sans que l'on puisse encore garantir l'arrivée d'une tempête généralisée à ce stade de l'échéance.</p>

<h3 style="color: {PRIMARY}; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 34px 0 12px 0; border-bottom: 1px solid rgba(56, 189, 248, 0.25); padding-bottom: 6px;">📊 VENTS FORTS ET PLUIES : LES PRINCIPAUX INDICATEURS</h3>

<div style="font-size: 13.5px; color: {PRIMARY}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin: -6px 0 14px 0;">📍 ZONE &amp; PÉRIODE : FRANCE MÉTROPOLITAINE — SIMULATIONS GFS DU 18 AU 22 OCTOBRE 2026, PUIS ANALYSE SYNOPTIQUE DU 23 OCTOBRE</div>

<div style="background: {BOX_BG}; border-left: 5px solid {BOX_BORDER}; border-radius: 8px; padding: 18px 22px; margin: 22px 0;">
  <ul style="margin: 0; padding-left: 20px; color: #f1f5f9; font-size: 15.5px; line-height: 1.85;">
    <li style="margin-bottom: 8px; color: #cbd5e1;">{surligne("Jusqu'à 108 km/h environ :")} sur les secteurs les plus exposés des côtes normandes, d'après les cartes de rafales maximales simulées entre le 18 et le 22 octobre.</li>
    <li style="margin-bottom: 8px; color: #cbd5e1;">{surligne("100 à 106 km/h localement :")} dans le Nord-Ouest et près de certains littoraux atlantiques.</li>
    <li style="margin-bottom: 8px; color: #cbd5e1;">{surligne("70 à 95 km/h :")} sur de nombreuses zones intérieures de la moitié nord, avec des pointes plus élevées sous les grains.</li>
    <li style="margin-bottom: 8px; color: #cbd5e1;">{surligne("100 à plus de 150 mm de pluie :")} localement davantage, dans certains secteurs du sud et du sud-est de la France sur la carte de cumul.</li>
  </ul>
</div>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Ces chiffres constituent des maxima simulés sur une période déterminée. Ils ne signifient pas qu'une tempête continue frappera le pays durant toute la séquence, mais signalent des pointes de vent ponctuelles associées au passage de fronts actifs.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Sur la carte des pluies, le signal le plus marqué concerne notamment des secteurs du sud-est et de l'ouest, suggérant des cumuls significatifs selon l'enchaînement des perturbations.</p>

<div style="margin: 28px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
  <img src="{img1_url}" alt="Géopotentiel à 500 hPa et pression au sol" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
  <p style="font-size: 13.5px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
    <strong style="background: rgba(56, 189, 248, 0.2); color: #ffffff; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11.5px; margin-right: 6px;">FIGURE 1</strong> Géopotentiel à 500 hPa et pression au sol, Europe et Atlantique Nord, modèle GFS 0,25°, run 06 UTC, échéance vendredi 23 octobre 2026 à 02 h. Dépression principale à 984 hPa sur l'Atlantique Nord.
  </p>
</div>

<h3 style="color: #38bdf8; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid rgba(56, 189, 248, 0.35); padding-bottom: 8px;">🔬 COMPRENDRE POURQUOI UNE DÉPRESSION PEUT PROVOQUER DES VENTS VIOLENTS</h3>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">La force du vent dépend notamment des {surligne("différences de pression atmosphérique")} entre deux régions. Plus le gradient de pression est resserré sur une courte distance, plus l'air est accéléré pour combler ce déséquilibre.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Dans la configuration envisagée, une succession de dépressions atlantiques pourrait circuler vers l'Europe de l'Ouest. Lorsqu'une dépression se creuse rapidement, la chute de pression renforce la pente isobarique et accentue la vitesse du vent au sol et en altitude.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Le {surligne("courant jet")} constitue un autre élément important. Situé à haute altitude, il participe au guidage et parfois à l'amplification des systèmes dépressionnaires.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Pour autant, la présence d'un courant jet puissant ne signifie pas automatiquement qu'une tempête destructrice touchera terre : tout dépend de l'interaction entre les anomalies d'altitude et l'air chaud et humide présent dans les basses couches.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Il faut également distinguer les {surligne("vents moyens")} et les {surligne("rafales")}. Une rafale correspond à une accélération brève et violente, souvent provoquée par des turbulences ou par le passage d'une ligne de grains à l'avant ou au passage d'un front froid.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">La topographie, l'exposition aux vents dominants, la proximité de la mer et le passage éventuel de grains orageux créent des différences locales considérables.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Enfin, un simple décalage de quelques dizaines ou centaines de kilomètres dans la trajectoire du centre dépressionnaire peut suffire à déplacer la zone de vent maximal.</p>

<h3 style="color: #fbbf24; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid rgba(251, 191, 36, 0.35); padding-bottom: 8px;">🏗️ LES CONSÉQUENCES CONCRÈTES SUR LA POPULATION, LES ROUTES ET LES CHANTIERS BTP</h3>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Si les rafales actuellement simulées se confirmaient, plusieurs activités pourraient être perturbées, en particulier en fin de semaine.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Sur le réseau routier, le vent latéral pourrait compliquer la circulation des poids lourds, des deux-roues et des véhicules légers attelés d'une remorque, notamment sur les ponts, viaducs et grands axes dégagés de Normandie et de Bretagne.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Dans les zones boisées, les arbres encore feuillus pourraient présenter une prise au vent accrue, augmentant le risque de chutes de branches ou d'arbres isolés sur les chaussées et les voies ferrées.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Pour les entreprises du {surligne("BTP")}, cette situation nécessiterait une surveillance attentive des installations temporaires : échafaudages, bâches, barrières de chantier, panneaux et matériel mobile.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Il ne serait toutefois pas rigoureux de définir une autorisation ou une interdiction de travail sur grue à partir de simples cartes de rafales cumulées : ces décisions s'appuient sur des anémomètres de site et des règles de sécurité propres à chaque équipement.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Les précipitations pourraient également compliquer les terrassements, les accès aux chantiers non stabilisés et le travail en extérieur.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Enfin, sur les littoraux, les conditions de navigation pourraient se dégrader, avec un renforcement de la houle et un risque de surcote lors des pleines mers.</p>

<div style="margin: 28px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
  <img src="{img2_url}" alt="Rafales maximales simulées en km/h" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
  <p style="font-size: 13.5px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
    <strong style="background: rgba(56, 189, 248, 0.2); color: #ffffff; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11.5px; margin-right: 6px;">FIGURE 2</strong> Rafales maximales simulées en km/h sur la France, période du 18 au 22 octobre 2026, modèle GFS 0,25°, run 06 UTC. La carte montre un renforcement du risque venteux sur la moitié nord et les régions occidentales.
  </p>
</div>

<h3 style="color: {PRIMARY}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid {PRIMARY}; padding-bottom: 8px;">⚠️ TROIS SITUATIONS À SURVEILLER</h3>

<div style="background: rgba(34, 197, 94, 0.12); border-left: 5px solid #22c55e; border-radius: 8px; padding: 16px 20px; margin: 18px 0;">
  <div style="font-weight: 900; color: #4ade80; text-transform: uppercase; font-size: 15px; letter-spacing: 0.05em; margin-bottom: 6px;">
    🟢 NIVEAU 1 — VENT FORT ET PERTURBATIONS
  </div>
  <div style="color: #f1f5f9; font-size: 15.5px; line-height: 1.75;">Des rafales soutenues peuvent perturber les activités extérieures et rendre certains déplacements plus délicats sans caractère exceptionnel.</div>
</div>

<div style="background: rgba(245, 158, 11, 0.14); border-left: 5px solid #f59e0b; border-radius: 8px; padding: 16px 20px; margin: 18px 0;">
  <div style="font-weight: 900; color: #fbbf24; text-transform: uppercase; font-size: 15px; letter-spacing: 0.05em; margin-bottom: 6px;">
    🟠 NIVEAU 2 — COUP DE VENT MARQUÉ
  </div>
  <div style="color: #f1f5f9; font-size: 15.5px; line-height: 1.75;">Des rafales de l'ordre de {surligne("80 à 100 km/h")} peuvent provoquer des difficultés de circulation et imposer des mesures de sécurisation sur les chantiers.</div>
</div>

<div style="background: rgba(239, 68, 68, 0.16); border-left: 5px solid #ef4444; border-radius: 8px; padding: 16px 20px; margin: 18px 0;">
  <div style="font-weight: 900; color: #f87171; text-transform: uppercase; font-size: 15px; letter-spacing: 0.05em; margin-bottom: 6px;">
    🔴 NIVEAU 3 — RISQUE TEMPÉTUEUX
  </div>
  <div style="color: #f1f5f9; font-size: 15.5px; line-height: 1.75;">Lorsque les vents dépassent localement {surligne("100 km/h")}, notamment sur les littoraux, des dommages matériels plus importants deviennent possibles.</div>
</div>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Ces trois niveaux sont des catégories pédagogiques de Météo-Climat Pro. Ils ne correspondent pas à une grille officielle de vigilance départementale.</p>

<div style="overflow-x: auto; margin: 26px 0;">
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left; background: rgba(15, 23, 42, 0.6); border-radius: 8px; overflow: hidden; border: 1px solid rgba(56, 189, 248, 0.25);">
    <thead>
      <tr style="background: rgba(245, 158, 11, 0.2); color: {PRIMARY}; border-bottom: 1px solid rgba(56, 189, 248, 0.3);">
        <th style="padding: 12px 14px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em; font-size: 13px;">Régions à surveiller</th>
        <th style="padding: 12px 14px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em; font-size: 13px;">Période</th>
        <th style="padding: 12px 14px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em; font-size: 13px;">Signal météorologique</th>
        <th style="padding: 12px 14px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em; font-size: 13px;">Conséquences possibles</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
        <td style="padding: 12px 14px; color: #ffffff; font-weight: 700;">Bretagne et Pays de la Loire</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">21 au 24 octobre</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Rafales fortes, localement proches ou supérieures à 100 km/h</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Perturbations sur les transports et travaux en extérieur</td>
      </tr>
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
        <td style="padding: 12px 14px; color: #ffffff; font-weight: 700;">Normandie et Hauts-de-France</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">22 au 24 octobre</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Rafales de 70 à 100 km/h et ponctuellement davantage près des côtes</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Conditions de circulation difficiles et mer agitée</td>
      </tr>
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
        <td style="padding: 12px 14px; color: #ffffff; font-weight: 700;">Centre et Île-de-France</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">22 au 24 octobre</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Vent soutenu et passages pluvieux possibles</td>
        <td style="padding: 12px 14px; color: #cbd5e1; font-weight: 400;">Perturbations ponctuelles et sols détrempés</td>
      </tr>
    </tbody>
  </table>
</div>

<div style="margin: 28px 0; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px;">
  <img src="{img3_url}" alt="Cumuls de précipitations prévus en millimètres" onerror="this.style.display='none'" style="width: 100%; max-width: 900px; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
  <p style="font-size: 13.5px; color: #94a3b8; margin-top: 10px; margin-bottom: 0; font-style: italic;">
    <strong style="background: rgba(56, 189, 248, 0.2); color: #ffffff; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11.5px; margin-right: 6px;">FIGURE 3</strong> Cumuls de précipitations prévus en millimètres entre le 18 et le 22 octobre 2026, modèle GFS 0,25°, run 06 UTC. Des cumuls importants sont simulés dans le sud-est et dans plusieurs secteurs occidentaux.
  </p>
</div>

<div style="background: rgba(245, 158, 11, 0.14); border: 1px solid rgba(245, 158, 11, 0.4); border-left: 5px solid #fbbf24; border-radius: 8px; padding: 18px 22px; margin: 28px 0;">
  <div style="font-weight: 900; color: #fbbf24; text-transform: uppercase; font-size: 15px; letter-spacing: 0.05em; margin-bottom: 8px;">
    ⚠️ À NE PAS INTERPRÉTER COMME UNE CERTITUDE ABSOLUE :
  </div>
  <p style="font-size: 15px; color: #fef3c7; margin: 0; line-height: 1.75;">
    Les rafales maximales d'une carte de synthèse correspondent au maximum simulé sur plusieurs jours. Elles n'impliquent pas que ces valeurs seront atteintes partout de manière uniforme ni qu'elles souffleront en continu.<br/><br/>
    Les scénarios supérieurs à {surligne("150 km/h")} évoqués dans le texte initial nécessitent une confirmation par de futures modélisations plus rapprochées et ne figurent pas directement sur les cartes exploitées.
  </p>
</div>

<h3 style="color: {PRIMARY}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid {PRIMARY}; padding-bottom: 8px;">🎯 LES 4 FACTEURS DÉTERMINANTS À SURVEILLER</h3>

<div style="background: {BOX_BG}; border-left: 5px solid {BOX_BORDER}; border-radius: 8px; padding: 18px 22px; margin: 22px 0;">
  <ul style="margin: 0; padding-left: 20px; color: #f1f5f9; font-size: 15.5px; line-height: 1.85;">
    <li style="margin-bottom: 8px; color: #cbd5e1;">{surligne("La trajectoire des dépressions :")} elle déterminera quelles régions se trouveront directement sous les vents les plus forts.</li>
    <li style="margin-bottom: 8px; color: #cbd5e1;">{surligne("La pression minimale :")} un creusement plus important peut favoriser un renforcement du vent, sans constituer à lui seul une garantie de rafales extrêmes.</li>
    <li style="margin-bottom: 8px; color: #cbd5e1;">{surligne("La chronologie des passages :")} il reste essentiel de distinguer les épisodes possibles de jeudi, vendredi et samedi.</li>
    <li style="margin-bottom: 8px; color: #cbd5e1;">{surligne("L'exposition locale :")} côtes, caps, reliefs et zones ouvertes peuvent subir des rafales sensiblement différentes de celles des secteurs abrités.</li>
  </ul>
</div>

<h3 style="color: {PRIMARY}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid {PRIMARY}; padding-bottom: 8px;">📊 FIABILITÉ DES PRÉVISIONS ET ÉCHÉANCES</h3>

<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Les documents fournis soutiennent l'hypothèse d'une circulation atlantique dynamique et d'une période venteuse sur plusieurs régions françaises.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">La cartographie synoptique pour vendredi 23 octobre montre un environnement dépressionnaire actif, tandis que les simulations cumulées pour le 18 au 22 octobre mettent en évidence un signal de fortes rafales sur la moitié nord.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Néanmoins, ces documents ne suffisent pas à confirmer précisément l'intensité d'un épisode tempétueux supplémentaire samedi 24 octobre.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Les prochaines actualisations devront permettre de vérifier l'évolution des trajectoires, les pressions minimales et surtout les rafales attendues à des échéances horaires précises.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Il faudra également confronter plusieurs simulations récentes avant de conclure à un renforcement ou à un affaiblissement du risque.</p>
<p style="margin-bottom: 16px; color: #cbd5e1; font-size: 16px; line-height: 1.85;">Une prévision présentant des rafales importantes à plusieurs jours d'échéance constitue un signal de surveillance, mais pas une confirmation définitive de leur réalisation.</p>

<h3 style="color: {ACCENT}; font-size: 21px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 38px 0 14px 0; border-bottom: 2px solid {ACCENT}; padding-bottom: 8px;">❓ FAQ SUR LE RISQUE DE TEMPÊTE EN FRANCE</h3>

<div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-left: 4px solid {PRIMARY}; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
  <div style="font-weight: 800; color: #38bdf8; font-size: 16px; margin-bottom: 6px;">
    ❓ 1. Une tempête est-elle certaine cette semaine ?
  </div>
  <div style="color: #e2e8f0; font-size: 15px; line-height: 1.75;">Non. Les cartes révèlent un potentiel venteux important, mais l'intensité définitive, la trajectoire et l'étendue des vents les plus forts doivent encore être précisées.</div>
</div>

<div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-left: 4px solid {PRIMARY}; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
  <div style="font-weight: 800; color: #38bdf8; font-size: 16px; margin-bottom: 6px;">
    ❓ 2. Quelles régions risquent d'être les plus touchées ?
  </div>
  <div style="color: #e2e8f0; font-size: 15px; line-height: 1.75;">La Bretagne, la Normandie, les Pays de la Loire et les Hauts-de-France sont particulièrement concernés par le signal venteux. D'autres régions de la moitié nord pourraient également subir de fortes rafales.</div>
</div>

<div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-left: 4px solid {PRIMARY}; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
  <div style="font-weight: 800; color: #38bdf8; font-size: 16px; margin-bottom: 6px;">
    ❓ 3. Des rafales de 150 km/h sont-elles possibles ?
  </div>
  <div style="color: #e2e8f0; font-size: 15px; line-height: 1.75;">Cette intensité est évoquée par certains scénarios dans le texte initial, notamment près des côtes. Toutefois, les cartes de rafales jointes ne permettent pas de confirmer cette valeur.</div>
</div>

<div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-left: 4px solid {PRIMARY}; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
  <div style="font-weight: 800; color: #38bdf8; font-size: 16px; margin-bottom: 6px;">
    ❓ 4. Les fortes pluies vont-elles accompagner le vent ?
  </div>
  <div style="color: #e2e8f0; font-size: 15px; line-height: 1.75;">Plusieurs passages pluvieux sont envisagés. Les cartes de cumul montrent des précipitations importantes sur certaines régions, mais elles ne permettent pas d'affirmer que pluie forte et rafales maximales se produiront simultanément.</div>
</div>

<div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-left: 4px solid {PRIMARY}; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
  <div style="font-weight: 800; color: #38bdf8; font-size: 16px; margin-bottom: 6px;">
    ❓ 5. Les chantiers BTP doivent-ils anticiper des perturbations ?
  </div>
  <div style="color: #e2e8f0; font-size: 15px; line-height: 1.75;">Oui, notamment dans les régions occidentales et septentrionales. Les responsables de chantier devront adapter leurs opérations aux dernières prévisions localisées, aux mesures de vent et aux caractéristiques de leurs installations.</div>
</div>

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

# 3. Patch Dark Theme into meteo_posts (monsieurmeteo.com)
patch_req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/meteo_posts?id=eq.5cb21b4a-8160-435d-9a76-66198f1bcc92",
    data=json.dumps({"content": html}).encode("utf-8"),
    headers=headers,
    method="PATCH"
)
with urllib.request.urlopen(patch_req) as resp:
    print("meteo_posts patch status:", resp.status)

# 4. Generate Light Theme (meteobtp.fr and climat-meteo)
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
]
for pat, rep in replacements:
    light_html = re.sub(pat, rep, light_html, flags=re.IGNORECASE)

patch_posts_req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/posts?id=eq.0bb4d7f4-ee3a-491a-83d0-7f8430ce31ce",
    data=json.dumps({"content": light_html}).encode("utf-8"),
    headers=headers,
    method="PATCH"
)
with urllib.request.urlopen(patch_posts_req) as resp:
    print("posts patch status:", resp.status)

print("SUCCESS: Live article updated on all 3 sites with bold surligné and uppercase broadcast presentation!")
