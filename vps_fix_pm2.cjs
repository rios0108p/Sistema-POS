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

                setTimeout(() => {
                    out += '\n[TIMEOUT EXCEEDED - CLOSING]';
                    conn.end();
                    resolve(out);
                }, 8000);
            });
        }).on('error', (err) => resolve(`Connection Error: ${err.message}`)).connect(config);
    });
}

async function main() {
    console.log('--- FIXING PM2 CONFLICTS ---');
    console.log('\n[1] Deleting ALL PM2 processes...');
    console.log(await executeCommand('pm2 delete all || true'));
    
    console.log('\n[2] Killing any orphaned Node processes...');
    console.log(await executeCommand('pkill -9 node || true'));
    
    console.log('\n[3] Starting a single PM2 instance...');
    console.log(await executeCommand('cd /home/srv1403226.hstgr.cloud/backend/ && pm2 start server.js --name "backend-api"'));
    
    console.log('\n[4] Saving clean PM2 state...');
    console.log(await executeCommand('pm2 save'));
    
    console.log('\n[5] Testing API health endpoint...');
    console.log(await executeCommand('sleep 2 && curl -sI http://localhost:3001/api/config || echo "Curl Failed"'));
}

main();
