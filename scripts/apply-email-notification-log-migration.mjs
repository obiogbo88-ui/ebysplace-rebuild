import mysql from 'mysql2/promise';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

const createTableSql = `CREATE TABLE IF NOT EXISTS \`emailNotificationLogs\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`entityType\` enum('booking','order') NOT NULL,
  \`entityId\` int NOT NULL,
  \`audience\` enum('owner','customer') NOT NULL,
  \`recipientEmail\` varchar(320) NOT NULL,
  \`subject\` varchar(255) NOT NULL,
  \`bodyPreview\` text,
  \`status\` enum('pending','sent','failed','retried') NOT NULL DEFAULT 'pending',
  \`provider\` varchar(80) NOT NULL DEFAULT 'zoho_smtp',
  \`smtpHost\` varchar(255),
  \`messageId\` varchar(255),
  \`errorMessage\` text,
  \`attempts\` int NOT NULL DEFAULT 0,
  \`lastAttemptAtMs\` bigint,
  \`sentAtMs\` bigint,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT \`emailNotificationLogs_id\` PRIMARY KEY(\`id\`),
  INDEX \`emailNotificationLogs_entity_idx\` (\`entityType\`, \`entityId\`),
  INDEX \`emailNotificationLogs_status_idx\` (\`status\`)
);`;

const connection = await mysql.createConnection(connectionString);
try {
  await connection.query(createTableSql);
  const [rows] = await connection.query("SHOW TABLES LIKE 'emailNotificationLogs'");
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('emailNotificationLogs table was not created.');
  }
  console.log('emailNotificationLogs migration applied or already present.');
} finally {
  await connection.end();
}
