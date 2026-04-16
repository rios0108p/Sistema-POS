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
    console.log('--- FORCING BACKEND RESET ---');
    console.log('\n[1] Killing Node processes...');
    console.log(await executeCommand('pkill -9 node || true'));
    
    console.log('\n[2] Starting PM2 in Backend Directory...');
    console.log(await executeCommand('cd /home/srv1403226.hstgr.cloud/backend/ && pm2 start server.js --name "sistema-v4" || pm2 restart "sistema-v4" || true'));
    
    console.log('\n[3] Saving PM2 state...');
    console.log(await executeCommand('pm2 save || true'));
    
    console.log('\n[4] Testing API response directly...');
    console.log(await executeCommand('curl -sI http://localhost:3001/api/config || echo "Curl Failed"'));
}

main();
