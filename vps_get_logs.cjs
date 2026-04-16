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
        let timeout;

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
                    clearTimeout(timeout);
                    conn.end();
                    resolve(out);
                });

                // Force close after 5 seconds to prevent hangs
                timeout = setTimeout(() => {
                    out += '\n[TIMEOUT EXCEEDED - FORCED CLOSE]';
                    conn.end();
                    resolve(out);
                }, 5000);
            });
        }).on('error', (err) => resolve(`Connection Error: ${err.message}`)).connect(config);
    });
}

async function main() {
    console.log('--- FETCHING PM2 LOGS ---');
    const logs = await executeCommand('cat /root/.pm2/logs/backend-error.log | tail -n 30');
    console.log(logs);
    
    console.log('\n--- FETCHING BACKEND DIR STATUS ---');
    const dir = await executeCommand('ls -la /home/srv1403226.hstgr.cloud/backend/');
    console.log(dir);
}

main();
