import fs from 'fs';
import path from 'path';

// يقسّم نص SQL إلى جملات مستقلة، مع احترام:
//  - اقتباس الدولار $$ ... $$ (كتل DO/الدوال)
//  - النصوص المقتبسة '...' و "..."
//  - التعليقات السطرية -- ...
// يرجّع مصفوفة جمل بدون الفاصلة المنقوطة النهائية.
export function splitSqlStatements(sql) {
  const statements = [];
  let buf = '';
  let inDollar = false;
  let inSQuote = false;
  let inDQuote = false;
  let inLineComment = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (inLineComment) {
      buf += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (!inDollar && !inSQuote && !inDQuote && ch === '-' && next === '-') {
      inLineComment = true;
      buf += ch;
      continue;
    }
    if (!inSQuote && !inDQuote && ch === '$' && next === '$') {
      inDollar = !inDollar;
      buf += '$$';
      i++;
      continue;
    }
    if (!inDollar && !inDQuote && ch === "'") inSQuote = !inSQuote;
    else if (!inDollar && !inSQuote && ch === '"') inDQuote = !inDQuote;

    if (!inDollar && !inSQuote && !inDQuote && ch === ';') {
      const trimmed = buf.trim();
      if (trimmed) statements.push(trimmed);
      buf = '';
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail) statements.push(tail);
  return statements;
}

// ينفّذ ملف هجرة SQL جملة-جملة. كل جملة idempotent؛ الفشل في واحدة لا يوقف الباقي
// ولا يُعطّل الإقلاع (المُشغّل يلتقط الخطأ ويسجّله).
export async function runSqlFile(prisma, file) {
  if (!fs.existsSync(file)) {
    console.warn(`migration file not found, skipping: ${file}`);
    return;
  }
  const sql = fs.readFileSync(file, 'utf8');
  const statements = splitSqlStatements(sql);
  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err) {
      console.error(`migration statement skipped (${file}):`, err.message);
    }
  }
}

// ===== تشغيل لمرة واحدة (ledger) =====
// بعض الملفات تحوي backfill بيانات (مثل ربط مستخدمين بلا مدرسة بمدرسة DEFAULT)
// يجب ألا يُعاد كل إقلاع وإلا أعاد تصنيف من تُرِكوا بلا مدرسة عمداً.
// جدول سجل صغير يضمن تنفيذ كل ملف مرة واحدة فقط على هذه القاعدة.
async function ensureLedger(prisma) {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "_RafiqiMigrationLedger" ("key" TEXT PRIMARY KEY, "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  );
}

async function isApplied(prisma, key) {
  const rows = await prisma.$queryRawUnsafe(`SELECT 1 FROM "_RafiqiMigrationLedger" WHERE "key" = $1 LIMIT 1`, key);
  return Array.isArray(rows) ? rows.length > 0 : Boolean(rows);
}

export async function runSqlFileOnce(prisma, file) {
  await ensureLedger(prisma);
  const key = file.split(path.sep).slice(-2).join('/');
  if (await isApplied(prisma, key)) return;
  await runSqlFile(prisma, file);
  await prisma.$executeRawUnsafe(`INSERT INTO "_RafiqiMigrationLedger" ("key") VALUES ($1) ON CONFLICT ("key") DO NOTHING`, key);
  console.log(`startup migration applied and recorded: ${key}`);
}
