import mysql from 'mysql2/promise';

const dbConfig = {
    host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
    user: '4Cv3KWyaRx7ysPd.root',
    password: 'KMdmd4pngKMnDIxW',
    database: 'sistema_inventario',
    port: 4000,
    ssl: {
        rejectUnauthorized: false
    }
};

async function checkAll() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to TiDB');

        const [tables] = await connection.query('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);
        console.log('Tables found:', tableNames.length, tableNames);

        for (const table of tableNames) {
            const [cols] = await connection.query(`SHOW COLUMNS FROM ${table}`);
            console.log(`Table ${table} columns:`, cols.map(c => c.Field).join(', '));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

checkAll();
