import db from './config/db.js';

async function main() {
    try {
        const [rows] = await db.query('SELECT card_bg_image FROM configuracion');
        console.log(rows);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
