import { Client } from 'ssh2';

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#',
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
                }).on('data', data => out += data.toString());
            });
        }).on('error', reject).connect(config);
    });
}

async function main() {
    try {
        console.log('--- SERVER.JS CONTENT ---');
        console.log(await run('cat /home/srv1403226.hstgr.cloud/backend/server.js'));
        console.log('\n--- BACKEND/ROUTES LIST ---');
        console.log(await run('ls -F /home/srv1403226.hstgr.cloud/backend/routes'));
    } catch (e) {
        console.error(e);
    }
}

main();
