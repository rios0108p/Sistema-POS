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
                    console.error("SSH Exec Error:", err);
                    conn.end();
                    return resolve(false);
                }
                
                let output = '';
                stream.on('data', (data) => {
                    output += data.toString();
                }).stderr.on('data', (data) => {
                    output += data.toString();
                }).on('close', () => {
                    console.log(output);
                    conn.end();
                    resolve(true);
                });
            });
        }).on('error', (err) => {
            console.error("SSH Connect Error:", err);
            resolve(false);
        }).connect(config);
    });
}

(async () => {
    console.log("Checking Document Root...");
    await executeCommand('ls -la /home/tendopos.cloud/public_html');
    console.log("Checking Vhost Context...");
    await executeCommand('cat /usr/local/lsws/conf/vhosts/tendopos.cloud/vhost.conf | grep docRoot');
})();
