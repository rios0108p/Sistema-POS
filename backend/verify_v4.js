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

async function verify() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to TiDB');

        const [columns] = await connection.query('SHOW COLUMNS FROM promociones');
        console.log('Promociones columns:', columns.map(c => c.Field));

        const [configCols] = await connection.query('SHOW COLUMNS FROM configuracion');
        console.log('Configuracion columns:', configCols.map(c => c.Field));

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

verify();
