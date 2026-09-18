# Contenu prêt à coller — fiche projet pptx (9 slides)
### Concours CNTE 2026 — Projet « Rafiqi » — Domaine coché : ☑ IA ☑ Ressource numérique interactive
> Remplacez [CROCHETS] par vos infos. Collez chaque bloc dans la slide correspondante.

## Slide 2 — Données enseignant
- Nom et prénom : [VOTRE NOM] — Tél : [VOTRE TÉL] — Email : [VOTRE EMAIL]
- Discipline : [ex. Éducation / Informatique] — Établissement : [NOM ÉCOLE] — CRE : [Gouvernorat]

## Slide 3 — Intitulé, domaine, niveau, objectifs
- **Intitulé** : « Rafiqi » — plateforme de vie scolaire avec jumeau numérique IA pour l'élève.
- **Niveau** : primaire (6–10 ans), extensible au collège.
- **Objectifs** : (1) différencier les apprentissages via des parcours adaptatifs ;
  (2) motiver par la ludification (XP, badges, défis) ; (3) outiller l'évaluation
  formative/sommative (quizzes auto-corrigés, analytics) ; (4) impliquer parents et direction.
- **Compétences visées** : autonomie, précision (calcul/langue), persévérance (séries),
  collaboration (défis, amis), culture numérique responsable.

## Slide 4 — Description du contenu + prérequis (+ photos/vidéo)
- 4 espaces : élève (leçons interactives, 9 jeux, expériences, défis, certificats PDF),
  enseignant (mémos Word, sujets, correction, analyse par classe), parent (suivi, conseils),
  directeur (tableaux de bord). Vidéo démo : `rafiqi-cnte-2026.mp4`.
- **Prérequis** : navigateur récent sur PC/tablette/mobile, connexion internet ;
  comptes créés par l'école. Options handicaps : taille du texte ×1,25, contraste
  renforcé, réduction des animations, navigation clavier.

## Slide 5 — Stratégies pédagogiques
- Apprentissage actif : l'élève agit (jeux, défis quotidiens) pas seulement lit.
- Différenciation : parcours adaptatif selon le niveau mesuré ; options d'accessibilité.
- Motivation : feedback immédiat, séries (streaks), classement de classe, certificats.
- Classe inversée possible : leçons à la maison, remédiation en classe via analytics.

## Slide 6 — Évaluation (+ indicateurs — À COMPLÉTER après votre expérimentation)
- **Méthodes** : quizzes auto-corrigés (formatif), examens officiels (sommatif),
  tableaux d'analyse par élève/classe, carnet de notes exportable.
- **Indicateurs à joindre** : [taux d'achèvement avant/après], [moyennes pré/post-test],
  [assiduité], [captures des tableaux de bord]. Sans ces chiffres : 0/15 au critère 6.

## Slide 7 — Réflexion sur la pratique
- [Racontez en 5–8 lignes : ce que la plateforme a changé dans votre classe —
  ex. temps de correction, différenciation, retours d'élèves intégrés (précisez 1–2
  modifications faites suite aux remarques d'élèves)].

## Slide 8 — Scénario d'apprentissage
- **Introduction** : rituel « défi du jour » projeté (3 min) pour capter l'attention.
- **Interaction** : binômes sur tablette, questions orales, entraide, avis des élèves
  en fin de séance (bouton retour).
- **Évaluation** : quiz formatif en séance + examen sommatif ; résultats → groupes
  de remédiation la séance suivante.
- **Besoins particuliers** : postes avec texte agrandi, temps majoré, parcours simplifiés.
- **Conclusion** : récap oral + certificat du jour + devoir-jeu à la maison.

## Slide 9 — Détails techniques
- **Stack** : React/Vite + Node/Express + PostgreSQL, Docker sur Render.
  **Pourquoi** : JS unique (maintenable par un enseignant), SPA rapide sur faible
  débit, base relationnelle adaptée aux notes/rôles, déploiement reproductible.
- **Ergonomie/stabilité** : 6 phases d'audit UI avec captures, responsive 390 px,
  mode sombre, RTL/AR-FR-EN.
- **Multi-supports** : oui — PC, tablette, mobile (captures jointes).
- **Complexité** : ~60 API, temps réel (WebSocket/LiveKit), génération PDF/DOCX,
  JWT rotatifs, RBAC 6 rôles.
- **Données/droits** : bcrypt, JWT 15 min, HTTPS, page `/privacy`, comptes enfants
  créés par parents/école, sans publicité ni géolocalisation. Contenus : production
  originale (mascotte, livres) — voir dossier technique `docs/DOSSIER_TECHNIQUE_CNTE2026.md`.
