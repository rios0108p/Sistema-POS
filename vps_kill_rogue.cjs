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
    console.log('--- KILLING ROGUE GREP (PID 714744) ---');
    console.log(await executeCommand('kill -9 714744 || echo "Process already dead"'));

    console.log('\n--- CHECKING ALL NODE PROCESSES ---');
    console.log(await executeCommand('ps auxf | grep node | grep -v grep'));
    
    console.log('\n--- CHECKING ALL PM2 PROCESSES (RAW) ---');
    console.log(await executeCommand('ps auxf | grep PM2 | grep -v grep'));
    
    console.log('\n--- CURRENT TOP CPU HOGS ---');
    console.log(await executeCommand('ps -eo pid,user,pcpu,pmem,stat,time,command --sort=-pcpu | head -n 10'));
}

main();
