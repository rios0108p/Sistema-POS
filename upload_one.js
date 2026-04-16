import ClientSFTP from 'ssh2-sftp-client';
import fs from 'fs';

const config = {
    host: '187.77.218.205',
    port: 22,
    username: 'root',
    password: 'RIOS1palacios#',
};

const REMOTE_PATH = '/home/srv1403226.hstgr.cloud/public_html/test.php';
const LOCAL_PATH = 'C:/Users/DENNIS RIOS/Downloads/expediente/Sistema_de_registro_de_ entrenadores_municipal/index.php';

async function upload() {
    const sftp = new ClientSFTP();
    try {
        let content = fs.readFileSync(LOCAL_PATH, 'utf8');
        
        // --- DATA MOCKING FOR QUICK VIEW ---
        // 1. Define BASE_URL
        if (!content.includes('define(\'BASE_URL\'')) {
            content = content.replace('<?php', '<?php\ndefine(\'BASE_URL\', \'#\');');
        }
        
        // 2. Mock DB stats
        const mockStats = `
$countTrainers = 15;
$countAthletes = 342;
$countDisciplines = 12;
$countSpaces = 6;
        `;
        content = content.replace(/\/\/ Fetch Stats for Landing Page[\s\S]*?\?>/, '/* Mocked Stats */' + mockStats + '\n?>');
        
        // 3. Comment out session redirect
        content = content.replace(/if \(isset\(\$_SESSION\['user_id'\]\)\) \{[\s\S]*?exit;[\s\S]*?\}/, '/* Session check disabled for preview */');

        // 4. Final safety: Comment out ALL requires
        content = content.replace(/^require_once/gm, '// require_once');
        
        fs.writeFileSync('temp_index.php', content);

        console.log('Connecting to SFTP...');
        await sftp.connect(config);
        console.log('Uploading as test.php (MOCKED VERSION)...');
        await sftp.put('temp_index.php', REMOTE_PATH);
        await sftp.end();
        console.log('Done! View at: https://tendopos.cloud/test.php');
    } catch (err) {
        console.error('Error:', err);
    }
}

upload();
