const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3333;

const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/print') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { html } = JSON.parse(body);
                const tempFile = path.join(__dirname, `temp_ticket_${Date.now()}.html`);

                // Add a small script to trigger auto-print in the system print dialog if needed, 
                // but we prefer the direct command line approach.
                fs.writeFileSync(tempFile, html);

                // Command to print HTML via PowerShell (using IE/Edge engine)
                // This is the most standard "silent" way on Windows without extra dependencies
                const command = `powershell -Command "Start-Process -FilePath '${tempFile}' -Verb Print -PassThru | %{ sleep 5; Stop-Process $_ }"`;

                console.log('Printing ticket...');
                exec(command, (error) => {
                    if (error) {
                        console.error('Print error:', error);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: error.message }));
                    } else {
                        console.log('Ticket sent to printer.');
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    }
                    // Cleanup
                    setTimeout(() => { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); }, 10000);
                });
            } catch (e) {
                console.error('Parse error:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`   PUENTE DE IMPRESIÓN POS ACTIVO`);
    console.log(`   Escuchando en: http://localhost:${PORT}`);
    console.log(`   No cierres esta ventana para imprimir`);
    console.log(`   directo sin cuadros de diálogo.`);
    console.log(`=========================================`);
});
