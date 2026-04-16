import { Client } from 'ssh2';
import ClientSFTP from 'ssh2-sftp-client';

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#',
};

const LOCAL_EXE = 'dist_electron/TendoPOS-Portable.zip';
const REMOTE_EXE = '/home/srv1403226.hstgr.cloud/public_html/TendoPOS-Portable.zip';

async function deployExe() {
    const sftp = new ClientSFTP();

    try {
        console.log('--- STARTING EXE DEPLOYMENT ---');
        
        console.log(`Connecting to SFTP on ${config.host}...`);
        await sftp.connect(config);
        
        console.log(`Uploading ${LOCAL_EXE} to ${REMOTE_EXE}...`);
        await sftp.put(LOCAL_EXE, REMOTE_EXE);
        await sftp.end();
        console.log('Upload complete.');

        // Verify permissions
        const ssh = new Client();
        await new Promise((resolve, reject) => {
            ssh.on('ready', () => {
                ssh.exec(`chown srv1403226:srv1403226 ${REMOTE_EXE} && chmod 644 ${REMOTE_EXE}`, (err, stream) => {
                    if (err) return reject(err);
                    stream.on('close', () => {
                        ssh.end();
                        resolve();
                    });
                });
            }).on('error', reject).connect(config);
        });

        console.log('--- EXE DEPLOYMENT SUCCESSFUL ---');
    } catch (err) {
        console.error('Deployment failed:', err);
    }
}

deployExe();
