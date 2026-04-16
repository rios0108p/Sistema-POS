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
    console.log('--- CHECKING VHOST FOR TENDOPOS.CLOUD ---');
    const checkCmd = `cat /usr/local/lsws/conf/vhosts/tendopos.cloud/vhost.conf`;
    const vhostConfig = await executeCommand(checkCmd);
    console.log(vhostConfig);
    
    // Add context for proxy if missing
    if (!vhostConfig.includes('extprocessor backend_api')) {
        console.log('\n--- ADDING PROXY CONTEXT TO VHOST ---');
        const appendCmd = `
cat << 'EOF' >> /usr/local/lsws/conf/vhosts/tendopos.cloud/vhost.conf

extprocessor backend_api {
  type                    proxy
  address                 http://127.0.0.1:3001
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

context /api/ {
  type                    proxy
  handler                 backend_api
  addDefaultCharset       off
}
EOF
`;
        await executeCommand(appendCmd);
        console.log('--- RESTARTING LITESPEED ---');
        console.log(await executeCommand('systemctl restart lsws'));
        console.log('Done installing proxy for /api/ -> 3001');
    } else {
        console.log('\nProxy already seems configured. Restarting lsws anyway...');
        await executeCommand('systemctl restart lsws');
    }
}

main();
