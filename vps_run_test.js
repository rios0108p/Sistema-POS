import { Client } from 'ssh2';
import ClientSFTP from 'ssh2-sftp-client';
import fs from 'fs';

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#',
};

const LOCAL_SCRIPT = 'backend/create_test_antigravity.js';
const BACKEND_DIR = '/home/srv1403226.hstgr.cloud/backend';
const REMOTE_PATH = `${BACKEND_DIR}/create_test_antigravity.js`;

async function runRemoteScript() {
    const sftp = new ClientSFTP();
    const ssh = new Client();

    try {
        console.log('--- UPLOADING TEST SCRIPT ---');
        await sftp.connect(config);
        await sftp.put(LOCAL_SCRIPT, REMOTE_PATH);
        await sftp.end();
        console.log('Upload complete.');

        console.log('--- EXECUTING REMOTE SCRIPT ---');
        await new Promise((resolve, reject) => {
            ssh.on('ready', () => {
                // Primero intentamos adivinar dónde está el backend para usar su config/db.js
                // O mejor, corremos el script desde el tmp pero asumiendo que el backend está en un sitio conocido
                const cmd = `cd ${BACKEND_DIR} && node ${REMOTE_PATH}`;
                ssh.exec(cmd, (err, stream) => {
                    if (err) return reject(err);
                    stream.on('close', (code) => {
                        console.log(`Exit code: ${code}`);
                        ssh.end();
                        resolve();
                    }).on('data', data => process.stdout.write(data))
                      .on('stderr', data => process.stderr.write('REMOTE ERROR: ' + data));
                });
            }).on('error', reject).connect(config);
        });

    } catch (err) {
        console.error('Failed:', err);
    }
}

runRemoteScript();
