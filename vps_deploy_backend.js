import { Client } from 'ssh2';
import ClientSFTP from 'ssh2-sftp-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#',
};

const REMOTE_BACKEND = '/home/srv1403226.hstgr.cloud/backend';
const LOCAL_BACKEND = path.join(__dirname, 'backend');

async function runSSHCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let out = '';
            let errOut = '';
            stream.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Command failed with code ${code}. Error: ${errOut}`));
                } else {
                    resolve(out);
                }
            }).on('data', data => out += data.toString())
              .stderr.on('data', data => errOut += data.toString());
        });
    });
}

async function main() {
    const sftp = new ClientSFTP();
    const ssh = new Client();

    try {
        console.log('🚀 --- INICIANDO DESPLIEGUE DEL BACKEND EN PRODUCCIÓN ---');
        
        // 1. Conectarse a SFTP
        console.log('🔌 Conectando al servidor vía SFTP...');
        await sftp.connect(config);
        console.log('✅ Conexión SFTP establecida.');

        // 2. Escanear archivos locales y remotos para detectar diferencias
        console.log('\n🔍 Escaneando archivos locales y remotos para detectar cambios...');
        
        const localFiles = {};
        function scanLocalDir(dir) {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    if (item !== 'node_modules' && item !== 'uploads' && item !== 'downloads' && item !== '.git') {
                        scanLocalDir(fullPath);
                    }
                } else {
                    // Ignorar bases de datos locales sqlite
                    if (item.endsWith('.sqlite') || item.endsWith('.db')) continue;
                    
                    const relativePath = path.relative(LOCAL_BACKEND, fullPath).replace(/\\/g, '/');
                    localFiles[relativePath] = {
                        size: stat.size,
                        absolutePath: fullPath
                    };
                }
            }
        }
        scanLocalDir(LOCAL_BACKEND);

        // Obtener archivos remotos vía SFTP
        const remoteFiles = {};
        async function scanRemoteDir(remotePath) {
            const list = await sftp.list(remotePath);
            for (const item of list) {
                const rPath = `${remotePath}/${item.name}`;
                if (item.type === 'd') {
                    if (item.name === 'node_modules' || item.name === 'uploads' || item.name === 'downloads' || item.name === '.git') {
                        continue;
                    }
                    await scanRemoteDir(rPath);
                } else if (item.type === '-') {
                    if (item.name.endsWith('.sqlite') || item.name.endsWith('.db')) continue;
                    const relativePath = path.relative(REMOTE_BACKEND, rPath).replace(/\\/g, '/');
                    remoteFiles[relativePath] = {
                        size: item.size,
                        absolutePath: rPath
                    };
                }
            }
        }
        await scanRemoteDir(REMOTE_BACKEND);

        // Comparar y encontrar archivos modificados o nuevos
        const toUpload = [];
        for (const [relPath, local] of Object.entries(localFiles)) {
            const remote = remoteFiles[relPath];
            if (!remote) {
                console.log(`🆕 Nuevo archivo detectado: ${relPath}`);
                toUpload.push(relPath);
            } else {
                // Si el tamaño difiere significativamente (por saltos de línea, etc.)
                const sizeDiff = Math.abs(local.size - remote.size) > 5;
                if (sizeDiff) {
                    console.log(`⚡ Modificado: ${relPath} (Local: ${local.size} B, Servidor: ${remote.size} B)`);
                    toUpload.push(relPath);
                }
            }
        }

        if (toUpload.length === 0) {
            console.log('\n✅ Todos los archivos de backend están sincronizados. No hay nada que subir.');
            await sftp.end();
        } else {
            console.log(`\n📤 Subiendo ${toUpload.length} archivos modificados/nuevos al VPS...`);
            for (const relPath of toUpload) {
                const localPath = localFiles[relPath].absolutePath;
                const remotePath = `${REMOTE_BACKEND}/${relPath}`;
                
                // Asegurar que el directorio remoto exista
                const remoteDir = path.dirname(remotePath);
                const dirExists = await sftp.exists(remoteDir);
                if (!dirExists) {
                    console.log(`📁 Creando directorio remoto: ${remoteDir}`);
                    await sftp.mkdir(remoteDir, true);
                }

                console.log(`   ⬆️ Subiendo: ${relPath}...`);
                await sftp.put(localPath, remotePath);
            }
            console.log('✅ Carga de archivos completada.');
            await sftp.end();
        }

        // 3. Conectarse vía SSH para reiniciar PM2
        console.log('\n🔌 Conectando vía SSH para reiniciar el backend...');
        await new Promise((resolve, reject) => {
            ssh.on('ready', async () => {
                try {
                    console.log('✅ SSH Conectado.');
                    
                    // Ajustar permisos de archivos a srvhs4166 (usuario de CyberPanel)
                    console.log('🔧 Ajustando permisos de archivos en el servidor...');
                    await runSSHCommand(ssh, `chown -R srvhs4166:srvhs4166 ${REMOTE_BACKEND}`);

                    console.log('🔄 Reiniciando aplicación en PM2 (backend-api)...');
                    const pm2Result = await runSSHCommand(ssh, 'pm2 restart backend-api --update-env');
                    console.log(pm2Result.trim());
                    
                    console.log('\n📊 Estado actual de PM2:');
                    const pm2Status = await runSSHCommand(ssh, 'pm2 list');
                    console.log(pm2Status.trim());

                    ssh.end();
                    resolve();
                } catch (e) {
                    ssh.end();
                    reject(e);
                }
            }).on('error', reject).connect(config);
        });

        console.log('\n🎉 --- DESPLIEGUE FINALIZADO EXITOSAMENTE ---');
        console.log('🚀 Tus cambios locales de backend ya están en vivo y el servidor ha sido reiniciado.');

    } catch (err) {
        console.error('\n❌ ERROR DURANTE EL DESPLIEGUE:', err.message);
    }
}

main();
