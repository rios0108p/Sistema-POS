const { Client } = require('ssh2');

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#'
};

async function run(cmd) {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        conn.on('ready', () => {
            conn.exec(cmd, (err, stream) => {
                if (err) return reject(err);
                let out = '';
                stream.on('close', () => {
                    conn.end();
                    resolve(out);
                }).on('data', data => out += data.toString())
                  .stderr.on('data', data => out += data.toString());
            });
        }).on('error', reject).connect(config);
    });
}

async function main() {
    try {
        console.log('--- RESTARTING BACKEND ---');
        
        // Restart the PM2 process
        const pm2Result = await run('cd /home/srv1403226.hstgr.cloud/backend && pm2 restart all --update-env');
        console.log(pm2Result);
        
        // Check logs if it fails
        console.log('\n--- PM2 LOGS ---');
        const logs = await run('pm2 logs --lines 15 --nostream');
        console.log(logs);
        
        // Wait a sec then test api
        await new Promise(r => setTimeout(r, 2000));
        console.log('\n--- API TEST ---');
        const apiTest = await run('curl -sI http://localhost:5000/api/config');
        console.log(apiTest);
        
        console.log('--- COMPLETE ---');
    } catch (e) {
        console.error('Error during backend restart:', e);
    }
}

main();
