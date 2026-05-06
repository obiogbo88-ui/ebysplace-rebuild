import fs from 'node:fs';

const schemaPath = '/home/ubuntu/ebysplace-rebuild/drizzle/schema.ts';
const dbPath = '/home/ubuntu/ebysplace-rebuild/server/db.ts';
const configPath = '/home/ubuntu/ebysplace-rebuild/drizzle.config.ts';

const schema = fs.readFileSync(schemaPath, 'utf8');
const schemaBody = schema
  .replace(/import \{[\s\S]*?\} from "drizzle-orm\/pg-core";/, `import {
  bigint,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";`)
  .replace(/export const userRoleEnum = pgEnum\("user_role_enum", \["user", "admin"\]\);/g, 'export const userRoleEnum = mysqlEnum("role", ["user", "admin"]);')
  .replace(/export const trueFalseEnum = pgEnum\("true_false_enum", \["true", "false"\]\);/g, 'export const trueFalseEnum = mysqlEnum("is_flag", ["true", "false"]);')
  .replace(/export const serviceCategoryEnum = pgEnum\("service_category_enum", \["Braids", "Twists", "Locs", "Kids Styles", "Men Styles", "Add-ons"\]\);/g, 'export const serviceCategoryEnum = mysqlEnum("service_category", ["Braids", "Twists", "Locs", "Kids Styles", "Men Styles", "Add-ons"]);')
  .replace(/export const bookingStatusEnum = pgEnum\("booking_status_enum", \["pending", "confirmed", "completed", "cancelled"\]\);/g, 'export const bookingStatusEnum = mysqlEnum("booking_status", ["pending", "confirmed", "completed", "cancelled"]);')
  .replace(/export const bookingLocationTypeEnum = pgEnum\("booking_location_type_enum", \["studio", "home_service"\]\);/g, 'export const bookingLocationTypeEnum = mysqlEnum("booking_location_type", ["studio", "home_service"]);')
  .replace(/export const depositStatusEnum = pgEnum\("deposit_status_enum", \["unpaid", "checkout_started", "paid", "failed", "refunded"\]\);/g, 'export const depositStatusEnum = mysqlEnum("deposit_status", ["unpaid", "checkout_started", "paid", "failed", "refunded"]);')
  .replace(/export const productCategoryEnum = pgEnum\("product_category_enum", \["Accessories", "Aftercare", "Hair Attachments"\]\);/g, 'export const productCategoryEnum = mysqlEnum("product_category", ["Accessories", "Aftercare", "Hair Attachments"]);')
  .replace(/export const stockStatusEnum = pgEnum\("stock_status_enum", \["in_stock", "low_stock", "out_of_stock"\]\);/g, 'export const stockStatusEnum = mysqlEnum("stock_status", ["in_stock", "low_stock", "out_of_stock"]);')
  .replace(/export const orderStatusEnum = pgEnum\("order_status_enum", \["draft", "pending_payment", "paid", "fulfilling", "shipped", "completed", "cancelled"\]\);/g, 'export const orderStatusEnum = mysqlEnum("order_status", ["draft", "pending_payment", "paid", "fulfilling", "shipped", "completed", "cancelled"]);')
  .replace(/export const galleryCategoryEnum = pgEnum\("gallery_category_enum", \["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"\]\);/g, 'export const galleryCategoryEnum = mysqlEnum("gallery_category", ["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"]);')
  .replace(/export const reviewStatusEnum = pgEnum\("review_status_enum", \["pending", "approved", "rejected"\]\);/g, 'export const reviewStatusEnum = mysqlEnum("review_status", ["pending", "approved", "rejected"]);')
  .replace(/export const tryOnStatusEnum = pgEnum\("try_on_status_enum", \["pending", "completed", "failed"\]\);/g, 'export const tryOnStatusEnum = mysqlEnum("try_on_status", ["pending", "completed", "failed"]);')
  .replace(/pgTable/g, 'mysqlTable')
  .replace(/serial\("id"\)\.primaryKey\(\)/g, 'int("id").autoincrement().primaryKey()')
  .replace(/numeric\(/g, 'decimal(')
  .replace(/jsonb\(/g, 'json(');
fs.writeFileSync(schemaPath, schemaBody);

let db = fs.readFileSync(dbPath, 'utf8');
db = db
  .replace('import { drizzle } from "drizzle-orm/node-postgres";\nimport { Pool } from "pg";', 'import { drizzle } from "drizzle-orm/mysql2";\nimport mysql, { type Pool } from "mysql2/promise";')
  .replace(/let _db: ReturnType<typeof drizzle> \| null = null;/, 'let _db: ReturnType<typeof drizzle> | null = null;')
  .replace(/function isPostgresConnectionString\(connectionString: string\) \{[\s\S]*?\n\}/, `function isMysqlConnectionString(connectionString: string) {
  try {
    const parsed = new URL(connectionString);
    return ["mysql:", "mysql2:", "mariadb:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}`)
  .replace(/function requiresSsl\(connectionString: string\) \{[\s\S]*?\n\}/, `function requiresSsl(connectionString: string) {
  return /ssl-mode=require|sslmode=require|tidbcloud|planetscale|mysql\.database\.azure\.com/i.test(connectionString);
}`)
  .replace('console.error("[Database] DATABASE_URL detected for PostgreSQL initialisation", {\n      fingerprint,\n      isPostgres: isPostgresConnectionString(connectionString),\n      requiresSsl: requiresSsl(connectionString),', 'console.error("[Database] DATABASE_URL detected for MySQL initialisation", {\n      fingerprint,\n      isMysql: isMysqlConnectionString(connectionString),\n      requiresSsl: requiresSsl(connectionString),')
  .replace(/if \(!isPostgresConnectionString\(connectionString\)\) \{[\s\S]*?return null;\n  \}/, `if (!isMysqlConnectionString(connectionString)) {
    if (!_unsupportedDatabaseUrlWarned) {
      console.error("[Database] Ignoring non-MySQL DATABASE_URL. The app expects a MySQL/TiDB connection string and will use safe seed-data fallbacks until one is configured.", { fingerprint });
      _unsupportedDatabaseUrlWarned = true;
    }
    return null;
  }`)
  .replace(/_pool = new Pool\(\{[\s\S]*?ssl: requiresSsl\(connectionString\) \? \{ rejectUnauthorized: false \} : undefined,\n\s*\}\);\n\s*await _pool.query\("select 1"\);\n\s*_db = drizzle\(_pool\);\n\s*console.error\("\[Database\] PostgreSQL connection initialised", \{ fingerprint \}\);/, `_pool = mysql.createPool({
        uri: connectionString,
        connectionLimit: 3,
        maxIdle: 3,
        idleTimeout: 10_000,
        connectTimeout: 10_000,
        ssl: requiresSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
      });
      await _pool.query("select 1");
      _db = drizzle(_pool);
      console.error("[Database] MySQL connection initialised", { fingerprint });`)
  .replace(/console.error\("\[Database\] Failed to initialise PostgreSQL connection; falling back to seed data for public reads\."/g, 'console.error("[Database] Failed to initialise MySQL connection; falling back to seed data for public reads."')
  .replace(/await _pool\?\.end\(\)\.catch/g, 'await _pool?.end().catch')
  .replace(/\.onConflictDoUpdate\(\{ target: users\.openId, set: \{ \.\.\.updateSet, updatedAt: new Date\(\) \} \}\)/g, '.onDuplicateKeyUpdate({ set: { ...updateSet, updatedAt: new Date() } })')
  .replace(/\.onConflictDoUpdate\(\{\n\s*target: products\.slug,\n\s*set:/g, '.onDuplicateKeyUpdate({\n      set:')
  .replace(/\.onConflictDoUpdate\(\{\n\s*target: services\.slug,\n\s*set:/g, '.onDuplicateKeyUpdate({\n      set:')
  .replace(/\.onConflictDoUpdate\(\{ target: websiteSections\.sectionKey, set: \{ body, updatedAt: sql`CURRENT_TIMESTAMP` \} \}\)/g, '.onDuplicateKeyUpdate({ set: { body, updatedAt: sql`CURRENT_TIMESTAMP` } })')
  .replace(/\.onConflictDoUpdate\(\{ target: newsletterSubscribers\.email, set: \{ productAlerts: productAlerts \? "true" : "false", createdAt: sql`CURRENT_TIMESTAMP` \} \}\)/g, '.onDuplicateKeyUpdate({ set: { productAlerts: productAlerts ? "true" : "false", createdAt: sql`CURRENT_TIMESTAMP` } })')
  .replace(/\.onConflictDoUpdate\(\{ target: websiteSections\.sectionKey, set: \{ \.\.\.input, updatedAt: new Date\(\) \} \}\)/g, '.onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } })')
  .replace(/\.returning\(\{ id: reviews\.id \}\)/g, '.$returningId()')
  .replace(/\.returning\(\{ id: bookings\.id \}\)/g, '.$returningId()')
  .replace(/\.returning\(\{ id: orders\.id \}\)/g, '.$returningId()')
  .replace(/\.returning\(\{ id: tryOnGenerations\.id \}\)/g, '.$returningId()')
  .replace(/\.returning\(\{ id: products\.id \}\)/g, '.$returningId()')
  .replace(/\.returning\(\{ id: galleryImages\.id \}\)/g, '.$returningId()')
  .replace(/'out_of_stock'::stock_status_enum/g, "'out_of_stock'");

db = db.replace(/async function ensureBookingLocationColumns\(\) \{[\s\S]*?\n\}/, `async function tableColumnExists(tableName: string, columnName: string) {
  if (!_pool) return false;
  const [rows] = await _pool.query(
    "SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [tableName, columnName],
  );
  return Number((rows as Array<{ count: number }>)[0]?.count ?? 0) > 0;
}

async function addColumnIfMissing(tableName: string, columnName: string, definition: string) {
  if (!_pool) return;
  if (!(await tableColumnExists(tableName, columnName))) {
    await _pool.query(\`ALTER TABLE \\\`\${tableName}\\\` ADD COLUMN \\\`\${columnName}\\\` \${definition}\`);
  }
}

async function makeColumnNullableIfPresent(tableName: string, columnName: string, definition: string) {
  if (!_pool) return;
  if (await tableColumnExists(tableName, columnName)) {
    await _pool.query(\`ALTER TABLE \\\`\${tableName}\\\` MODIFY COLUMN \\\`\${columnName}\\\` \${definition}\`);
  }
}

async function ensureBookingLocationColumns() {
  const db = await getDb();
  if (!db || !_pool) return;
  await addColumnIfMissing("bookings", "serviceLocation", "enum('studio','home_service') NOT NULL DEFAULT 'studio'");
  await addColumnIfMissing("bookings", "addressLine2", "varchar(255) NULL");
  await addColumnIfMissing("bookings", "county", "varchar(120) NULL");
  await addColumnIfMissing("bookings", "deliveryNote", "text NULL");
  await addColumnIfMissing("bookings", "homeServiceSurcharge", "decimal(10,2) NOT NULL DEFAULT '0.00'");
  await makeColumnNullableIfPresent("bookings", "addressLine1", "varchar(255) NULL");
  await makeColumnNullableIfPresent("bookings", "city", "varchar(120) NULL");
  await makeColumnNullableIfPresent("bookings", "postcode", "varchar(40) NULL");
}`);

db = db.replace(/async function ensureOrderLocationColumns\(\) \{[\s\S]*?\n\}/, `async function ensureOrderLocationColumns() {
  const db = await getDb();
  if (!db || !_pool) return;
  await addColumnIfMissing("orders", "serviceLocation", "enum('studio','home_service') NOT NULL DEFAULT 'studio'");
  await addColumnIfMissing("orders", "addressLine2", "varchar(255) NULL");
  await addColumnIfMissing("orders", "county", "varchar(120) NULL");
  await addColumnIfMissing("orders", "deliveryNote", "text NULL");
  await makeColumnNullableIfPresent("orders", "addressLine1", "varchar(255) NULL");
  await makeColumnNullableIfPresent("orders", "city", "varchar(120) NULL");
  await makeColumnNullableIfPresent("orders", "postcode", "varchar(40) NULL");
}`);
fs.writeFileSync(dbPath, db);

let config = fs.readFileSync(configPath, 'utf8');
config = config.replace('dialect: "postgresql"', 'dialect: "mysql"');
fs.writeFileSync(configPath, config);
