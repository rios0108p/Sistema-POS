const tls = require('tls');

const options = {
    host: 'tendopos.cloud',
    port: 443,
    rejectUnauthorized: false
};

const socket = tls.connect(options, () => {
    const cert = socket.getPeerCertificate(true);
    if (!cert || Object.keys(cert).length === 0) {
        console.log('No certificate provided or could not be parsed.');
    } else {
        console.log('--- SSL Certificate Details ---');
        console.log('Subject:', cert.subject);
        console.log('Issuer:', cert.issuer);
        console.log('Valid From:', cert.valid_from);
        console.log('Valid To:', cert.valid_to);
        
        const now = new Date();
        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));
        console.log('Days Remaining:', daysRemaining);
        console.log('Subject Alternative Names:', cert.subjectaltname);
        
        if (socket.authorized) {
            console.log('\nStatus: ✅ AUTHORIZED (Valid according to node)');
        } else {
            console.log('\nStatus: ❌ UNAUTHORIZED');
            console.log('Reason:', socket.authorizationError);
        }
    }
    socket.destroy();
});

socket.on('error', (err) => {
    console.error('Connection error:', err.message);
});
