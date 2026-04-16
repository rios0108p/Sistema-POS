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
    console.log('--- FIXING DOCROOT IN VHOST ---');
    const fixCmd = `sed -i 's|docRoot.*/home/TEST_BREAK_PATH|docRoot                   /home/srv1403226.hstgr.cloud/public_html|g' /usr/local/lsws/conf/vhosts/tendopos.cloud/vhost.conf`;
    await executeCommand(fixCmd);
    
    // As a fallback, in case the above sed doesn't match exactly because of spaces
    const fixCmd2 = `sed -i 's|docRoot.*|docRoot                   /home/srv1403226.hstgr.cloud/public_html|g' /usr/local/lsws/conf/vhosts/tendopos.cloud/vhost.conf`;
    await executeCommand(fixCmd2);
    
    console.log(await executeCommand('head -n 5 /usr/local/lsws/conf/vhosts/tendopos.cloud/vhost.conf'));

    console.log('--- RESTARTING LITESPEED ---');
    console.log(await executeCommand('systemctl restart lsws'));
    
    console.log('--- TESTING API INTERNALLY ON VPS ---');
    const testResult = await executeCommand('curl -v https://tendopos.cloud/api/health');
    console.log(testResult);
}

main();
