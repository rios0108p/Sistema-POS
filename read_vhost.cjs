const { Client } = require('ssh2');

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#'
};

const conn = new Client();
conn.on('ready', () => {
    conn.exec('cat /usr/local/lsws/conf/vhosts/tendopos.cloud/vhost.conf', (err, stream) => {
        let out = '';
        stream.on('data', d => out += d.toString()).on('close', () => { console.log(out); conn.end(); });
    });
}).connect(config);
