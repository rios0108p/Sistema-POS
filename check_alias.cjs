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
    console.log('--- CHECKING ALIASES IN MAIN VHOST ---');
    const checkCmd = `cat /usr/local/lsws/conf/vhosts/srv1403226.hstgr.cloud/vhconf.conf | grep tendopos`;
    const vhostConfig = await executeCommand(checkCmd);
    console.log(vhostConfig);
    
    console.log('\n--- CHECKING LISTENER ALIAS MAPPINGS ---');
    const mapCmd = `cat /usr/local/lsws/conf/httpd_config.conf | grep srv1403226.hstgr.cloud`;
    const mapResult = await executeCommand(mapCmd);
    console.log(mapResult);
}

main();
