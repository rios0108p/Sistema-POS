import ClientSFTP from 'ssh2-sftp-client';
import fs from 'fs';
import path from 'path';

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#',
};

const REMOTE_BASE = '/home/srv1403226.hstgr.cloud/public_html';

const filesToUpload = [
    { local: 'backend/routes/ventas.js', remote: `${REMOTE_BASE}/backend/routes/ventas.js` },
    { local: 'backend/routes/dashboard.js', remote: `${REMOTE_BASE}/backend/routes/dashboard.js` },
    { local: 'backend/middleware/auth.js', remote: `${REMOTE_BASE}/backend/middleware/auth.js` }
];

async function patch() {
    const sftp = new ClientSFTP();

    try {
        console.log('--- INICIANDO PARCHE DE AUDITORÍA (BATCH 1) ---');
        await sftp.connect(config);
        console.log('Conectado al servidor.');

        for (const file of filesToUpload) {
            console.log(`Subiendo: ${file.local} -> ${file.remote}`);
            const exists = await sftp.exists(path.dirname(file.remote));
            if (!exists) {
                console.log(`Creando directorio: ${path.dirname(file.remote)}`);
                await sftp.mkdir(path.dirname(file.remote), true);
            }
            await sftp.put(file.local, file.remote);
        }

        await sftp.end();
        console.log('--- PARCHE APLICADO EXITOSAMENTE ---');
        console.log('Recuerda reiniciar el servicio (pm2 restart) si es necesario.');
    } catch (err) {
        console.error('Error durante el parcheo:', err.message);
    }
}

patch();
