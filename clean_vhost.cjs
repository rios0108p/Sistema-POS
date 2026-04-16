const { Client } = require('ssh2');
const fs = require('fs');

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
    console.log('--- DOWNLOADING VHOST ---');
    const vhostConfig = await executeCommand(`cat /usr/local/lsws/conf/vhosts/tendopos.cloud/vhost.conf`);
    
    // Clean duplicate proxy chunks
    let newConfig = vhostConfig.replace(/extprocessor backend_api \{[\s\S]*?context \/api\/ \{[\s\S]*?addDefaultCharset       off\n\}/g, '');
    
    // Also let's make sure the original proxy context handles /api correctly
    // It should be 'context /api' or 'context /api/'
    // Right now it is 'context /api'
    
    // Save backup just in case
    fs.writeFileSync('vhost_backup.conf', vhostConfig);
    
    // Write new config
    const uploadCmd = `cat << 'EOF' > /usr/local/lsws/conf/vhosts/tendopos.cloud/vhost.conf
${newConfig}
EOF`;
    
    console.log('--- UPLOADING FIXED VHOST ---');
    await executeCommand(uploadCmd);
    
    console.log('--- RESTARTING LSW ---');
    console.log(await executeCommand('systemctl restart lsws'));
    
    console.log('--- TESTING API INTERNALLY ON VPS ---');
    const testResult = await executeCommand('curl -s -I https://tendopos.cloud/api/health');
    console.log(testResult);
}

main();
