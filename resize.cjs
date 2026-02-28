const { execSync } = require('child_process');
const cmds = [
    'npx --yes sharp-cli@2.1.0 -i ./src/assets/ICONO.png -o ./public/pwa-512x512.png resize 512 512 --fit contain --background "#ffffff"',
    'npx --yes sharp-cli@2.1.0 -i ./src/assets/ICONO.png -o ./public/pwa-192x192.png resize 192 192 --fit contain --background "#ffffff"',
    'npx --yes sharp-cli@2.1.0 -i ./src/assets/ICONO.png -o ./public/apple-touch-icon.png resize 180 180 --fit contain --background "#ffffff"',
    'npx --yes sharp-cli@2.1.0 -i ./src/assets/ICONO.png -o ./public/favicon.png resize 64 64 --fit contain --background "#ffffff"',
    'npx --yes sharp-cli@2.1.0 -i ./src/assets/ICONO.png -o ./public/masked-icon.png resize 512 512 --fit contain --background "#ffffff"'
];

for (const cmd of cmds) {
    try { console.log('Running:', cmd); execSync(cmd, { stdio: 'inherit' }); }
    catch (e) { console.error('Failed:', cmd); }
}
