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

async function check() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to TiDB Cloud');

        const [tables] = await connection.query('SHOW TABLES');
        console.log('Tables found:', tables.map(t => Object.values(t)[0]));

        for (const table of tables) {
            const tableName = Object.values(table)[0];
            const [columns] = await connection.query(`SHOW COLUMNS FROM ${tableName}`);
            console.log(`\nTable: ${tableName}`);
            console.log(columns.map(c => c.Field).join(', '));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

check();
