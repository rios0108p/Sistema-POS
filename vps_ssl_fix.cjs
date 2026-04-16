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
        console.log('--- EXECUTING SSL CHECK/FIX ---');
        
        // Let's first check if certbot or acme.sh exists
        console.log('Checking certificates in Let s Encrypt directory...');
        const certList = await run('ls -la /etc/letsencrypt/live/tendopos.cloud/ 2>/dev/null || echo "NOT_FOUND"');
        console.log(certList);
        
        // Run cyberpanel command
        console.log('\nRunning cyberpanel issueCertForDomain...');
        // Run it with a timeout to avoid hanging scripts forever
        const issueCert = await run('timeout 30 cyberpanel issueCertForDomain --domainName tendopos.cloud 2>&1');
        console.log(issueCert);
        
        console.log('--- COMPLETE ---');
    } catch (e) {
        console.error('Error during SSL check:', e);
    }
}

main();
