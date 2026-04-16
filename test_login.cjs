async function testLogin() {
    console.log('--- TESTING TENDOPOS LOGIN API ---');
    try {
        const response = await fetch('https://tendopos.cloud/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin@sistema.com',
                password: 'admin123'
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ LOGIN SUCCESSFUL!');
            console.log('Token Received:', data.token ? 'YES' : 'NO');
            console.log('User Role:', data.usuario?.rol || 'Unknown');
        } else {
            console.log('❌ LOGIN FAILED (Status Code ' + response.status + ')!');
            console.log('Response:', data);
        }
    } catch (e) {
        console.log('❌ FETCH ERROR OCCURRED!');
        console.log(e.message);
        if (e.cause) console.log('Cause:', e.cause);
    }
}

testLogin();
