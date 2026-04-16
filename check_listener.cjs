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
    console.log('--- CHECKING LISTENER FOR TENDOPOS.CLOUD ---');
    const checkCmd = `cat /usr/local/lsws/conf/httpd_config.conf | grep -A 20 "listener"`;
    const listenerConfig = await executeCommand(checkCmd);
    console.log(listenerConfig);

    console.log('\n--- CHECKING LISTENER MAPPINGS ---');
    const mappingCmd = `cat /usr/local/lsws/conf/httpd_config.conf | grep "map"`;
    const mappings = await executeCommand(mappingCmd);
    console.log(mappings);
}

main();
