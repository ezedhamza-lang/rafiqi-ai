# Fiche projet - contenu pret a recopier
## Textes prets a coller dans `fiche projet-concours-2026.pptx`
Remplacez les [CROCHETS] par vos informations.

### Slide 2 — Donnees enseignant
- Nom et prenom : [VOTRE NOM] — Telephone : [VOTRE TEL] — Email : [VOTRE EMAIL]
- Discipline : [ex. Education / Informatique] — Etablissement : [NOM ECOLE] — CRE : [Gouvernorat]

### Slide 3 — Intitule, domaine, niveau, objectifs
- **Intitule** : « Rafiqi » — plateforme tunisienne de vie scolaire avec jumeau numerique IA pour l'eleve.
- **Domaine** : ☑ Intelligence artificielle ☑ Ressource numerique interactive.
- **Niveau** : primaire (6-10 ans), extensible au college.
- **Objectifs** : (1) differencier les apprentissages par des parcours adaptatifs ;
  (2) motiver par la ludification (XP, badges, defis) ;
  (3) outiller l'evaluation formative et sommative (quizzes auto-corriges, analytics) ;
  (4) impliquer parents et direction.
- **Competences visees** : autonomie, precision (calcul/langue), perseverance (series),
  collaboration (defis, amis), culture numerique responsable.

### Slide 4 — Description + prerequis (+ photos/video)
- 4 espaces : eleve (lecons interactives, 9 jeux, experiences, defis, certificats PDF),
  enseignant (memos Word, sujets d'examens, correction, analyse par classe),
  parent (suivi, conseils), directeur (tableaux de bord). Video demo : `rafiqi-cnte-2026.mp4`.
- **Prerequis** : navigateur recent (PC/tablette/mobile) + connexion internet ;
  comptes crees par l'ecole. Accessibilite : taille du texte, contraste renforce,
  reduction des animations, navigation clavier.

### Slide 5 — Strategies pedagogiques
- Apprentissage actif : l'eleve agit (jeux, defi quotidien), pas seulement lit.
- Differenciation : parcours adaptatif selon le niveau mesure ; options d'accessibilite.
- Motivation : feedback immediat, series (streaks), classement de classe, certificats.
- Classe inversee possible : lecons a la maison, remediation en classe via analytics.

### Slide 6 — Evaluation (+ indicateurs — A COMPLETER apres experimentation)
- Methodes : quizzes auto-corriges (formatif), examens officiels (sommatif),
  tableaux d'analyse par eleve/classe, carnet de notes exportable.
- **Indicateurs a joindre** : [taux d'achevement avant/apres], [moyennes pre/post-test],
  [assiduite], [captures des tableaux de bord]. Sans ces chiffres : 0/15 au critere 6.

### Slide 7 — Reflexion sur la pratique
[Racontez en 5-8 lignes : ce que la plateforme a change dans votre classe —
ex. temps de correction, differenciation, 1-2 modifications faites suite aux
remarques d'eleves. TEXTE PERSONNEL OBLIGATOIRE.]

### Slide 8 — Scenario (resume — detail complet dans 02-scenarios/)
- Introduction : rituel « defi du jour » projete (3 min).
- Interaction : binomes sur tablette, entraide, avis des eleves en fin de seance.
- Evaluation : quiz formatif en seance + examen sommatif ; remediation seance suivante.
- Besoins particuliers : texte agrandi, temps majore, parcours simplifies.
- Conclusion : recap oral + certificat du jour + devoir-jeu a la maison.

### Slide 9 — Details techniques
- **Stack** : React/Vite + Node/Express + PostgreSQL, Docker sur Render.
- **Pourquoi** : JS unique (maintenable par un enseignant), SPA rapide sur faible debit,
  base relationnelle adaptee aux notes/roles, deploiement reproductible.
- **Ergonomie/stabilite** : audits UI avec captures, responsive 390 px, mode sombre, RTL/AR-FR-EN.
- **Multi-supports** : PC, tablette, mobile (captures jointes).
- **Complexite** : ~60 API, temps reel (WebSocket/LiveKit), PDF/DOCX, JWT rotatifs, RBAC 6 roles.
- **Donnees/droits** : bcrypt, JWT 15 min, HTTPS, page `/privacy`, comptes enfants
  crees par parents/ecole, sans publicite ni geolocalisation. Contenus : production
  originale. Dossier technique : `docs/DOSSIER_TECHNIQUE_CNTE2026.md`.
