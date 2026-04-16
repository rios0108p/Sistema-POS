const { Client } = require('ssh2');
const ClientSFTP = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#'
};

const LOCAL_DB_FILE = path.join(__dirname, 'backend', 'config', 'db.js');
const REMOTE_DB_FILE = '/home/srv1403226.hstgr.cloud/backend/config/db.js';

async function deploy() {
    const sftp = new ClientSFTP();
    const ssh = new Client();

    try {
        console.log('--- DEPLOYING DB.JS FIX ---');
        console.log('Connecting to SFTP...');
        await sftp.connect(config);
        
        console.log(`Uploading ${LOCAL_DB_FILE} to ${REMOTE_DB_FILE}...`);
        await sftp.put(LOCAL_DB_FILE, REMOTE_DB_FILE);
        await sftp.end();
        console.log('Upload complete.');

        console.log('Connecting via SSH to restart backend...');
        await new Promise((resolve, reject) => {
            ssh.on('ready', () => {
                const cmd = 'cd /home/srv1403226.hstgr.cloud/backend && pm2 restart all --update-env';
                ssh.exec(cmd, (err, stream) => {
                    if (err) return reject(err);
                    stream.on('close', () => {
                        console.log('SSH Command Finished.');
                        ssh.end();
                        resolve();
                    }).on('data', data => process.stdout.write(data))
                      .on('stderr', data => process.stderr.write('REMOTE ERROR: ' + data));
                });
            }).on('error', reject).connect(config);
        });

        console.log('--- FIX DEPLOYMENT SUCCESSFUL ---');
    } catch (err) {
        console.error('Deployment failed:', err);
    }
}

deploy();
