const { Client } = require('ssh2');

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#'
};

async function run(cmd) {
    return new Promise((resolve) => {
        const conn = new Client();
        conn.on('ready', () => {
            conn.exec(cmd, (err, stream) => {
                if (err) {
                    conn.end();
                    return resolve(`EXEC ERROR: ${err.message}`);
                }
                let out = '';
                stream.on('close', () => {
                    conn.end();
                    resolve(out);
                }).on('data', data => out += data.toString())
                  .stderr.on('data', data => out += data.toString());
            });
        }).on('error', (err) => resolve(`CONN ERROR: ${err.message}`)).connect(config);
    });
}

async function main() {
    console.log('--- FETCHING VPS SYSTEM STATUS ---');
    try {
        console.log('\n>> PM2 STATUS');
        console.log(await run('pm2 status'));
        
        console.log('\n>> LATEST PM2 ERRORS');
        console.log(await run('pm2 logs --lines 20 --nostream --err'));
        
        console.log('\n>> DIRECTORY CONTENTS (/backend)');
        console.log(await run('ls -la /home/srv1403226.hstgr.cloud/backend/ | head -n 15'));
        
        console.log('--- COMPLETE ---');
    } catch (e) {
        console.error('Unhandled script error:', e);
    }
}

main();
