import mysql from 'mysql2/promise';

const newHash = '$2b$10$QWEPVEtHzGMtlWG0I9eQtOrAKXbsvK4Q/evae9DSB5r4JdtVYMzPS';

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

async function updatePassword() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado a TiDB Cloud.');

        console.log('⏳ Actualizando contraseña del admin...');
        await connection.query(
            'UPDATE usuarios SET password = ? WHERE nombre_usuario = ?',
            [newHash, 'admin@sistema.com']
        );

        console.log('✨ CONTRASEÑA ACTUALIZADA EXITOSAMENTE.');

    } catch (error) {
        console.error('❌ ERROR:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

updatePassword();
