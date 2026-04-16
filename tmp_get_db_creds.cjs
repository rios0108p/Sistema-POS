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
        console.log('--- BUSCANDO CREDENCIALES MYSQL EN EL VPS ---');
        
        const possiblePaths = [
            '/home/srv1403226.hstgr.cloud/public_html/.env',
            '/home/srv1403226.hstgr.cloud/public_html/backend/.env',
            '/home/srv1403226.hstgr.cloud/backend/.env'
        ];

        for (const path of possiblePaths) {
            console.log(`\nRevisando: ${path}`);
            const content = await run(`cat ${path}`);
            if (content && !content.includes('No such file')) {
                console.log('CONTENIDO ENCONTRADO:');
                console.log(content);
            } else {
                console.log('Archivo no encontrado.');
            }
        }

        console.log('\n--- VERIFICANDO PROCESOS MYSQL ---');
        console.log(await run('netstat -tulpn | grep mysql'));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

main();
