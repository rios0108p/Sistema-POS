import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
    host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
    user: '4Cv3KWyaRx7ysPd.root',
    password: 'KMdmd4pngKMnDIxW',
    database: 'sistema_inventario',
    port: 4000,
    ssl: {
        rejectUnauthorized: false
    },
    multipleStatements: true
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to TiDB Cloud for V3 Migration.');

        const schemaPath = path.join(__dirname, 'tidb_schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');

        console.log('⏳ Running V3 migration (Adding missing columns from routes)...');
        await connection.query(sql);

        console.log('✨ V3 MIGRATION SUCCESSFUL.');
    } catch (error) {
        console.error('❌ MIGRATION FAILED:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
