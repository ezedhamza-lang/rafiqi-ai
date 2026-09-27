// Definir / changer le mot de passe des comptes privilegies (SUPER_ADMIN + ADMIN).
// Usage (Render Shell) :
//   node backend/scripts/set-super-password.mjs "MonMotDePasseFort!2026"
// ou : SUPER_ADMIN_PASSWORD="..." node backend/scripts/set-super-password.mjs
// Seuls les utilisateurs existants sont mis a jour (aucune donnee autre n'est touchee).
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TARGETS = ['super@education.tn', 'admin@education.tn'];
const pw = process.argv[2] || process.env.SUPER_ADMIN_PASSWORD || '';

if (!pw || pw.length < 12) {
  console.error('ERREUR: mot de passe trop court ou absent (minimum 12 caracteres).');
  console.error('Usage: node backend/scripts/set-super-password.mjs "MonMotDePasseFort!2026"');
  process.exit(1);
}

let changed = 0;
for (const email of TARGETS) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.log(`SKIP  ${email} (introuvable)`); continue; }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(pw, 10) }
  });
  console.log(`OK    ${email}  mot de passe actualise`);
  changed++;
}
console.log(`\n${changed} compte(s) privilegie(s) protege(s). Conservez ce mot de passe en lieu sur.`);
await prisma.$disconnect();