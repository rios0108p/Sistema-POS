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
    console.log('--- CHECKING PM2 PROCESSES ---');
    console.log(await executeCommand('pm2 list'));
    
    console.log('\n--- SYSTEM RESOURCES ---');
    console.log(await executeCommand('free -m'));
    console.log(await executeCommand('top -b -n 1 | head -n 15'));
}

main();
