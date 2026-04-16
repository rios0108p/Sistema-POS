const { Client } = require('ssh2');

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#'
};

async function executeCommand(cmd) {
    return new Promise((resolve) => {
        const conn = new Client();
        conn.on('ready', () => {
            conn.exec(cmd, (err, stream) => {
                if (err) {
                    conn.end();
                    return resolve(`Error: ${err.message}`);
                }
                
                let out = '';
                stream.on('data', data => { out += data.toString(); });
                stream.stderr.on('data', data => { out += data.toString(); });
                
                stream.on('close', () => {
                    conn.end();
                    resolve(out);
                });
            });
        }).on('error', (err) => resolve(`Connection Error: ${err.message}`)).connect(config);
    });
}

async function main() {
    console.log('--- CHECKING SSL PERMISSIONS ---');
    const lsCmd = `ls -la /etc/letsencrypt/live/tendopos.cloud/ && ls -la /etc/letsencrypt/archive/tendopos.cloud/`;
    console.log(await executeCommand(lsCmd));
    
    // Check if the vhost.conf file explicitly sets the domain
    console.log('--- CHECKING VHDOMAIN ---');
    const headCmd = `head -n 20 /usr/local/lsws/conf/vhosts/tendopos.cloud/vhost.conf`;
    console.log(await executeCommand(headCmd));
}

main();
