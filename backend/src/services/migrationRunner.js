import fs from 'fs';

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
