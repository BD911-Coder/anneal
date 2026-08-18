// dev-seed korumasinin 3. KATMANI: dagitim oncesi kontrol.
//
// Calistirma: npm run dagitim:kontrol
//
// Hedef veritabaninda TEK BIR dev-seed satiri varsa cikis kodu 1 verir ve
// dagitim durur.
//
// .env.local OKUNMAZ. Bu bilincli: .env.local gelistirme veritabanini
// gosterir ve orada dev-seed satirlari olmasi normaldir. Bu kontrol dagitim
// hattinda calisir ve DATABASE_URL'i platformun ortam degiskenlerinden alir —
// yani her zaman dagitimin gercek hedefine bakar (K29).
//
// Bagimliligi yok, sadece pg.

import pg from "pg";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL tanimli degil.");
  console.error("Bu kontrol dagitim hedefine bakar; adres ortam degiskeninden gelir.");
  console.error("Yerelde denemek icin: DATABASE_URL='...' npm run dagitim:kontrol");
  process.exit(1);
}

function safeSummary(value) {
  try {
    const u = new URL(value);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(adres cozumlenemedi)";
  }
}

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
} catch (err) {
  console.error(`Baglanti kurulamadi: ${safeSummary(url)}`);
  console.error(err.message);
  process.exit(1);
}

console.log(`Hedef: ${safeSummary(url)}`);

// source sutunu olan her tabloya bakilir. Tablo listesi elle yazilmaz ki
// semaya yeni tablo eklendiginde bu kontrol otomatik kapsasin.
const { rows: tables } = await client.query(
  `select table_name from information_schema.columns
   where table_schema = 'public' and column_name = 'source'
   order by table_name`,
);

if (tables.length === 0) {
  console.error("HATA: source sutunu olan hic tablo bulunamadi.");
  console.error("Sema uygulanmamis olabilir; kontrol anlamsiz olurdu.");
  await client.end();
  process.exit(1);
}

let total = 0;
const bulunan = [];

for (const { table_name } of tables) {
  const { rows } = await client.query(
    `select count(*)::int as n from "${table_name}" where source::text = 'dev-seed'`,
  );
  const n = rows[0].n;
  total += n;
  if (n > 0) bulunan.push(`${table_name}: ${n}`);
}

await client.end();

console.log(`${tables.length} tablo tarandi.`);

if (total > 0) {
  console.error("\nDAGITIM DURDU.");
  console.error(`Canli veritabaninda ${total} adet dev-seed satiri var:`);
  for (const satir of bulunan) console.error(`  - ${satir}`);
  console.error("\nSahte veri canli ortamda bulunamaz. Once bu satirlari temizleyin.");
  process.exit(1);
}

console.log("dev-seed satiri yok. Dagitim serbest.");
