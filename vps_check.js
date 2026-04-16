import { Client } from 'ssh2';

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#',
};

const ssh = new Client();

ssh.on('ready', () => {
    console.log('SSH Ready.');
    const cmd = 'ls -la /home/srv1403226.hstgr.cloud/public_html/test.php && cat /home/srv1403226.hstgr.cloud/public_html/.htaccess';
    ssh.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            ssh.end();
        }).on('data', data => {
            process.stdout.write(data);
        }).stderr.on('data', data => {
            process.stderr.write('ERROR: ' + data);
        });
    });
}).connect(config);
