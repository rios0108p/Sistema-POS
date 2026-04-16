import { Client } from 'ssh2';

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#',
};

const ssh = new Client();

async function restart() {
    console.log('--- REINICIANDO BACKEND EN PRODUCCIÓN ---');
    ssh.on('ready', () => {
        console.log('SSH Conectado. Ejecutando: pm2 restart all');
        ssh.exec('pm2 restart all', (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
                console.log('Servicio reiniciado con éxito. Code: ' + code);
                ssh.end();
                process.exit(0);
            }).on('data', (data) => {
                process.stdout.write(data);
            }).stderr.on('data', (data) => {
                process.stderr.write(data);
            });
        });
    }).on('error', (err) => {
        console.error('Error SSH:', err.message);
        process.exit(1);
    }).connect(config);
}

restart();
