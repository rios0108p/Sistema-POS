/**
 * qzUtils.js - Bridge for QZ Tray printing
 * This allows printing directly to thermal printers without browser dialogs.
 * Requires QZ Tray software to be running on the local machine.
 */

const QZ_WS_URL = "ws://localhost:8182";

/**
 * Sends ESC/POS commands directly to a printer via QZ Tray
 * @param {Uint8Array} commands - ESC/POS command array
 * @param {string} printerName - The name of the printer in the OS (optional)
 */
export const printViaQZ = (commands, printerName = null) => {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(QZ_WS_URL);

        socket.onopen = () => {
            // 1. Find Printer
            // If no printer name is provided, QZ Tray uses the default system printer
            const findCmd = {
                call: "findPrinter",
                params: printerName ? [printerName] : [null]
            };

            socket.send(JSON.stringify(findCmd));
        };

        socket.onmessage = (event) => {
            const response = JSON.parse(event.data);

            if (response.call === "findPrinter") {
                if (response.error) {
                    socket.close();
                    reject(new Error("Printer not found via QZ: " + response.error));
                    return;
                }

                // 2. Print Raw
                const printCmd = {
                    call: "print",
                    params: [
                        response.returnValue, // Printer object
                        [{
                            type: 'raw',
                            format: 'base64',
                            data: btoa(String.fromCharCode.apply(null, commands))
                        }]
                    ]
                };
                socket.send(JSON.stringify(printCmd));
            } else if (response.call === "print") {
                socket.close();
                if (response.error) {
                    reject(new Error("Print failed via QZ: " + response.error));
                } else {
                    resolve(true);
                }
            }
        };

        socket.onerror = (err) => {
            reject(new Error("QZ Tray not detected. Ensure it is running on localhost:8182"));
        };

        // Timeout
        setTimeout(() => {
            if (socket.readyState !== WebSocket.CLOSED) {
                socket.close();
                reject(new Error("QZ Tray connection timeout"));
            }
        }, 5000);
    });
};
