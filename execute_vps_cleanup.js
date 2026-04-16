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
        console.log('--- EXECUTING VPS CLEANUP ---');
        
        // Root Home
        console.log('Cleaning Root Home...');
        await run('rm -rf /home/srv1403226.hstgr.cloud/public_html_GHOST_TEST');
        
        // Public HTML
        console.log('Cleaning Public HTML...');
        await run('rm -f /home/srv1403226.hstgr.cloud/public_html/IDENTITY_CHECK.txt');
        
        // Backend
        console.log('Cleaning Backend...');
        const scripts = [
            'apply_fix_usuarios.js', 'check_col.js', 'check-db.js', 'check_full_db.js', 
            'check-inventory-updates.js', 'check-product-visibility.js', 'cleanup.js', 
            'CREATE_MISSING_TABLES.js', 'db_alter.js', 'db_alter_productos.js', 
            'db_alter_tiendas.js', 'db_alter_tiendas_v2.js', 'db_alter_usuarios.js', 
            'db_check_productos.js', 'db_check_usuarios.js', 'debug_db_state.js', 
            'debug-inventory-mismatch.js', 'fix_admin_pass.js', 'fix_db_aggressive.js', 
            'fix_db_schema.js', 'fix_turnos_schema.js', 'force_migrate_v3.js', 'gen_hash.js', 
            'migrate_gastos_v2.js', 'migrate_tiendas.js', 'run-migrations.js', 
            'setup_local_db.js', 'setup_local_v4.js', 'sync_inventory.js', 
            'test_import_sql.js', 'update_pass.js', 'update_perms_now.js', 'verify_v4.js',
            'backend.zip'
        ];
        
        const backendPath = '/home/srv1403226.hstgr.cloud/backend';
        const deleteScriptsCmd = `cd ${backendPath} && rm -f ${scripts.join(' ')}`;
        await run(deleteScriptsCmd);
        
        console.log('Cleaning Backend Migrations...');
        await run(`rm -rf ${backendPath}/migrations/*`);
        
        console.log('--- CLEANUP COMPLETE ---');
        
        console.log('Final verification - Backend directory:');
        console.log(await run(`ls -F ${backendPath}`));
        
    } catch (e) {
        console.error('Error during cleanup:', e);
    }
}

main();
