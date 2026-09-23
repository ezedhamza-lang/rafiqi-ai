# Code sources - acces et execution
## Depot et version gelee
- Depot : https://github.com/ezedhamza-lang/rafiqi-ai
- Branche : `main`. Regenerer l'export au dernier commit avant l'envoi :
  `git archive --format=zip HEAD backend/src backend/prisma backend/package.json frontend/src frontend/index.html frontend/package.json frontend/vite.config.js Dockerfile docker-compose.yml .dockerignore README.md docs -o code-sources.zip`
- Contenu de `03-code-sources/export/` : le resultat de cette commande (sans node_modules, dist, uploads, .git).

## Execution locale (reproductibilite)
Prerequis : Node 22+, PostgreSQL 18.
```bash
cd backend && npm install && npx prisma db push && npm run seed && node src/index.js  # :3001
cd frontend && npm install && npx vite --port 5173                                    # :5173
```
Deploiement : `Dockerfile` + `docker-compose.yml` (image unique, demo publique sur Render).

## Comptes de demonstration (base de dev)
`student@test.tn`, `teacher@test.tn`, `parent@test.tn`, `director@test.tn`
Mot de passe (dev uniquement) : `qarn-zeft-7alib-2026!`

## IMPORTANT — acces du jury au code
Le depot est PRIVE. Avant l'envoi : le rendre PUBLIC ou inviter les membres du jury
en collaborateurs (Settings > Collaborators). Sans cela, le critere 8a (3 pts) est perdu.
