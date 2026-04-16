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
    console.log('--- RE-ISSUING SSL VIA CYBERPANEL ---');
    const sslCmd = `cyberpanel issueSSL --domain tendopos.cloud`;
    const sslResult = await executeCommand(sslCmd);
    console.log(sslResult);
    
    console.log('--- RESTARTING LITESPEED ---');
    console.log(await executeCommand('systemctl restart lsws'));
    
    console.log('--- TESTING API INTERNALLY ON VPS ---');
    const testResult = await executeCommand('curl -v https://tendopos.cloud/api/health');
    console.log(testResult);
}

main();
