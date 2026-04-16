const { Client } = require('ssh2');

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Ready. Restarting backend-api (ID 0)...');
    conn.exec('pm2 restart 0', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Backend restarted successfully.');
            conn.end();
        }).on('data', data => process.stdout.write(data))
          .on('stderr', data => process.stderr.write(data));
    });
}).on('error', err => console.error(err)).connect(config);
