import puppeteer from 'puppeteer';

(async () => {
    console.log('Starting browser...');
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--ignore-certificate-errors'] });
    const page = await browser.newPage();

    try {
        console.log('Navigating to CyberPanel login...');
        await page.goto('https://187.77.218.205:8090/base/', { waitUntil: 'networkidle2' });

        console.log('Logging in...');
        await page.type('input[name="username"]', 'admin');
        await page.type('input[name="password"]', '1mUoCnZExAn:uZRSNMD:');
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        console.log('Going to File Manager...');
        await page.goto('https://187.77.218.205:8090/filemanager/srv1403226.hstgr.cloud', { waitUntil: 'networkidle2' });

        console.log('Entering public_html...');
        await new Promise(r => setTimeout(r, 5000)); // 5 seconds to load
        await page.screenshot({ path: 'debug.png' });
        // Wait for public_html to appear in the file list and double click it
        // await page.waitForSelector('.folder-name', { timeout: 10000 });

        // Find public_html element and double click
        const folders = await page.$$('.folder-name');
        for (let el of folders) {
            const text = await page.evaluate(e => e.textContent, el);
            if (text.includes('public_html')) {
                await el.click({ clickCount: 2 });
                break;
            }
        }

        await new Promise(r => setTimeout(r, 2000)); // wait for directory to load

        console.log('Uploading dist.zip...');
        // CyberPanel filemanager uses fine-uploader or a custom upload button.
        // We look for input type=file
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            await fileInput.uploadFile('C:\\Users\\usuario2\\Desktop\\ssadas\\dist.zip');
        } else {
            // If not found, click the upload button to trigger the modal, then inject file
            await page.evaluate(() => {
                document.querySelector('button.upload-btn, a[title="Upload"]').click();
            });
            await new Promise(r => setTimeout(r, 1000));
            const modalFileInput = await page.$('input[type="file"]');
            if (modalFileInput) await modalFileInput.uploadFile('C:\\Users\\usuario2\\Desktop\\ssadas\\dist.zip');
        }

        console.log('Waiting for upload to complete...');
        await new Promise(r => setTimeout(r, 10000)); // adjust time based on network

        console.log('Extracting zip...');
        // This part requires interaction with the UI which is highly variable. 
        // We can do this reliably using cyberpanel API or the browser subagent if this fails.
        // Let's try right clicking on the uploaded zip
        const files = await page.$$('.file-name, .item-name');
        for (let el of files) {
            const text = await page.evaluate(e => e.textContent, el);
            if (text.includes('dist.zip')) {
                await el.click({ button: 'right' });
                await new Promise(r => setTimeout(r, 500));
                // click extract
                await page.evaluate(() => {
                    const extractBtn = Array.from(document.querySelectorAll('.context-menu-item')).find(el => el.textContent.includes('Extract'));
                    if (extractBtn) extractBtn.click();
                });
                break;
            }
        }

        await new Promise(r => setTimeout(r, 2000));
        console.log('Deploy via Puppeteer completed.');
    } catch (e) {
        console.error('Puppeteer Script Error:', e);
    } finally {
        await browser.close();
    }
})();
