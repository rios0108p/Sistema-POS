import { Client } from 'ssh2';
import ClientSFTP from 'ssh2-sftp-client';
import fs from 'fs';
import path from 'path';

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#',
};

const REMOTE_WEB_ROOT = '/home/srv1403226.hstgr.cloud/public_html';
const LOCAL_ZIP = 'dist.zip';
const REMOTE_ZIP = '/tmp/dist.zip';

async function deploy() {
    const sftp = new ClientSFTP();
    const ssh = new Client();

    try {
        console.log('--- STARTING DEPLOYMENT ---');
        
        // 1. Upload ZIP via SFTP
        console.log(`Connecting to SFTP on ${config.host}...`);
        try {
            await sftp.connect(config);
        } catch (connErr) {
            console.error('SFTP Connection Failed:', connErr);
            throw connErr;
        }
        console.log(`Uploading ${LOCAL_ZIP} to ${REMOTE_ZIP}...`);
        await sftp.put(LOCAL_ZIP, REMOTE_ZIP);
        await sftp.end();
        console.log('Upload complete.');

        // 2. Extract ZIP via SSH
        console.log('Connecting via SSH to extract...');
        await new Promise((resolve, reject) => {
            ssh.on('ready', () => {
                console.log('SSH Ready. Executing unzip...');
                // Ensure target directory exists and CLEAN assets to prevent chunk mismatch
                const cmd = `mkdir -p ${REMOTE_WEB_ROOT} && rm -rf ${REMOTE_WEB_ROOT}/assets && unzip -o ${REMOTE_ZIP} -d ${REMOTE_WEB_ROOT} && rm ${REMOTE_ZIP} && chown -R srv1403226:srv1403226 ${REMOTE_WEB_ROOT}`;
                ssh.exec(cmd, (err, stream) => {
                    if (err) return reject(err);
                    stream.on('close', () => {
                        console.log('SSH Command Finished.');
                        ssh.end();
                        resolve();
                    }).on('data', data => process.stdout.write(data))
                      .on('stderr', data => process.stderr.write('REMOTE ERROR: ' + data));
                });
            }).on('error', (err) => {
                console.error('SSH Connection Error:', err);
                reject(err);
            }).connect(config);
        });

        console.log('--- DEPLOYMENT SUCCESSFUL ---');
    } catch (err) {
        console.error('Deployment failed:', err);
    }
}

deploy();
