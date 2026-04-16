const { Client } = require('ssh2');

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#'
};

const conn = new Client();
conn.on('ready', () => {
    conn.exec('ls -la /home/srv1403226.hstgr.cloud/public_html/index.html', (err, stream) => {
        let out = '';
        stream.on('data', d => out += d.toString()).on('close', () => { console.log("index.html stat:", out); conn.end(); });
    });
}).connect(config);
