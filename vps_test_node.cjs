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

                // Force close after 6 seconds to capture the immediate output and exit
                setTimeout(() => {
                    out += '\n[TIMEOUT - FORCE KILLED NODE PROCESS]';
                    conn.end();
                    resolve(out);
                }, 6000);
            });
        }).on('error', (err) => resolve(`Connection Error: ${err.message}`)).connect(config);
    });
}

async function main() {
    console.log('--- STARTING BACKEND MANUALLY TO CATCH ERRORS ---');
    const logs = await executeCommand('cd /home/srv1403226.hstgr.cloud/backend/ && node server.js');
    console.log(logs);
}

main();
