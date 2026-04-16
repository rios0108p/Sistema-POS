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
                stream.on('data', data => { out += data.toString(); process.stdout.write(data.toString()); });
                stream.stderr.on('data', data => { out += data.toString(); process.stderr.write(data.toString()); });
                
                stream.on('close', () => {
                    conn.end();
                    resolve(out);
                });

                setTimeout(() => {
                    out += '\n[TIMEOUT EXCEEDED - CLOSING]';
                    conn.end();
                    resolve(out);
                }, 30000); // 30 sec timeout for SSL issuance
            });
        }).on('error', (err) => resolve(`Connection Error: ${err.message}`)).connect(config);
    });
}

async function main() {
    console.log('--- ISSUING CYBERPANEL SSL ---');
    console.log('\n[1] Deleting old expired/wrong acme certs if they exist...');
    await executeCommand('rm -rf /root/.acme.sh/tendopos.cloud');
    
    console.log('\n[2] Requesting new SSL via CyberPanel CLI...');
    await executeCommand('cyberpanel issueCertForDomain --domainName tendopos.cloud');
    
    console.log('\n[3] Restarting LiteSpeed to apply changes...');
    await executeCommand('systemctl restart lsws');
}

main();
