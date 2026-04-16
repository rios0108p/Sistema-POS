const { Client } = require('ssh2');

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#'
};

const conn = new Client();
conn.on('ready', () => {
    conn.exec('ls -la /home/srv1403226.hstgr.cloud/backend/ && cat /root/.pm2/logs/backend-error.log | tail -n 20', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
              .on('data', data => process.stdout.write(data))
              .stderr.on('data', data => process.stdout.write(data));
    });
}).connect(config);
