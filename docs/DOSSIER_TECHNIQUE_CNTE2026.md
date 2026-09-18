# Dossier technique — « Rafiqi » (بوابة رفيقي للحياة المدرسية)
### Candidature — Concours des Enseignants créatifs, production numérique éducative — CNTE 2026
### Domaines : IA + Ressource numérique interactive

## 1. Présentation
Plateforme web tunisienne complète de vie scolaire : 4 espaces (élève 6–10 ans, enseignant,
parent, directeur) + super-admin. Contenu aligné sur le programme officiel tunisien
(français/arabe), évaluations formatives et sommatives, ludification (XP, badges,
certificats PDF), classes en direct, et outils enseignants (mémos Word, sujets d'examens).

## 2. Architecture
```
frontend/ (React 18 + Vite 5, SPA, i18n ar/fr/en, RTL/LTR, light/dark)
   │ REST/JSON (JWT)
backend/  (Node 22 + Express 4 + Prisma 5 + PostgreSQL 18)
Dockerfile (build frontend + backend, image unique) → Render
```
- **Pourquoi ce choix (pertinence)** : une seule base de code JS des deux côtés
  (maintenance par un enseignant-développeur), SPA rapide sur connexions modestes,
  PostgreSQL relationnel adapté aux données scolaires (notes, progressions, rôles),
  Docker/Render pour une démo publique stable et reproductible.

## 3. Complexité technique maîtrisée
- Auth JWT (access 15 min + refresh rotatifs en base), RBAC 6 rôles, bcrypt (10 rounds).
- Sécurité : helmet, rate-limit, validation zod, CORS restreint, uploads filtrés.
- Temps réel : WebSocket (chat, classes live via LiveKit), notifications.
- Génération PDF (pdf-lib) : certificats, mémos Word (.docx), exports CSV/PDF.
- ~60 routes API, ~30 écrans, Prisma ~40 modèles.
- Multi-supports vérifié : responsive 390 px, drawer mobile, tableaux tactiles/PC.
- Accessibilité : taille du texte (3 niveaux), contraste renforcé, `prefers-reduced-motion`
  global, navigation clavier (`:focus-visible`, skip-link, Escape), ARIA.
- Confidentialité : page `/privacy`, mots de passe hashés, accès par rôle,
  comptes élèves créés par parents/école, aucune publicité ni géolocalisation.

## 4. Correspondance avec la grille officielle (100 pts)
| Critère | Preuve dans le projet |
|---|---|
| 1. Exploitation pédagogique (20) | objectifs par leçon, scénarisation (quizzes adaptatifs, plans), stratégies (ludification, différenciation), évaluation formative+sommative + analytics |
| 2. Conformité académique (5) | contenu aligné programme officiel tunisien, arabe/français |
| 3. Performance techno (25) | stabilité (déploiement Docker), multi-supports vérifié, ergonomie (6 phases d'audit UI), accessibilité (menu dédié) |
| 4. Intégration techno (15) | IA (ami virtuel, jumeau numérique, adaptatif), intégration réelle au scénario, complexité ci-dessus |
| 5. Innovation (10) | jumeau numérique, défis hebdo, certificats auto-générés, accessibilité persistée |
| 6. Impact (15) | **à compléter par l'enseignant** : expérimentation en classe + mesures avant/après (voir §6) |
| 7. Sécurité/éthique (5) | §3 + page `/privacy` + comptes enfants encadrés |
| 8. Dossier technique (5) | le présent document + code source du dépôt |

## 5. Lancer le projet (reproductibilité)
Prérequis : Node 22+, PostgreSQL 18.
```bash
cd backend && npm install && npx prisma db push && npm run seed && node src/index.js  # :3001
cd frontend && npm install && npx vite --port 5173                                    # :5173
```
Comptes démo (dev) : `student@test.tn`, `teacher@test.tn`, `parent@test.tn`,
`director@test.tn` — mot de passe : `qarn-zeft-7alib-2026!`

## 6. Reste à fournir par l'enseignant (classe)
- Fiche d'expérimentation : classe, période, protocole (pré/post-test), indicateurs
  (taux d'achèvement, moyennes, assiduité), photos/vidéos d'usage en classe.
- Captures jointes : voir `rafiqi-cnte-2026.mp4` (vidéo de démonstration, 60 s, 1080p).
