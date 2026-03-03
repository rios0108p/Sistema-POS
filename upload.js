import fs from 'fs';
import Client from 'ssh2-sftp-client';

const sftp = new Client();

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'DennisRios010803',
    password: 'dtrp010803'
};

async function main() {
    try {
        console.log('Connecting to server via SFTP...');
        await sftp.connect(config);

        console.log('Uploading dist.zip...');
        const remoteFile = '/home/srv1403226.hstgr.cloud/public_html/dist.zip';
        await sftp.put('dist.zip', remoteFile);

        console.log('Uploading backend routes...');
        await sftp.put('backend/routes/productos.js', '/root/tendopos-backend/routes/productos.js');
        await sftp.put('backend/routes/tiendas.js', '/root/tendopos-backend/routes/tiendas.js');

        console.log('Upload complete. Extracting via SSH command...');
        // We can use the underlying ssh2 connection to execute a command
        const ssh = sftp.client;

        ssh.exec('cd /home/srv1403226.hstgr.cloud/public_html && unzip -o dist.zip && rm dist.zip && pm2 restart all', (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
                console.log('Extraction complete with code ' + code);
                sftp.end();
            }).on('data', (data) => {
                console.log('STDOUT: ' + data);
            }).stderr.on('data', (data) => {
                console.error('STDERR: ' + data);
            });
        });

    } catch (err) {
        console.error('Error:', err.message);
        sftp.end();
    }
}

main();
