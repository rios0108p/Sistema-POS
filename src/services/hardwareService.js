import { toast } from "react-hot-toast";

/**
 * Hardware Service: Capa de abstracción para periféricos (Impresoras, Gavetas, Básculas)
 * Detecta automáticamente si está en entorno Web o Electron.
 */

const hardwareService = {
    /**
     * Envía un documento a imprimir de forma silenciosa o vía diálogo
     * @param {Object} data - Datos del ticket o movimiento
     * @param {string} html - Contenido HTML ya generado
     * @param {Uint8Array} raw - Comandos ESC/POS (opcional)
     */
    print: async (data, html, raw = null) => {
        const printerName = localStorage.getItem('pos_printer_name');

        // 1. Prioridad: Electron Native (Silent Print)
        if (window.electronAPI && window.electronAPI.printSilent) {
            try {
                const result = await window.electronAPI.printSilent(html, printerName);
                if (result.success) {
                    toast.success("Impresión enviada correctamente");
                    return true;
                }
                // En Electron, no caer en WebUSB/iframe — mostrar error directo
                toast.error(`Error al imprimir: ${result.error || 'Verifica la impresora en Ajustes'}`);
                return false;
            } catch (err) {
                console.error("Error IPC Electron:", err);
                toast.error("Error de impresión. Verifica la impresora en Ajustes.");
                return false;
            }
        }

        // 2. Prioridad: Bridge Local (localhost:3001)
        try {
            const response = await fetch("http://localhost:3001/print", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                signal: (AbortSignal && AbortSignal.timeout) ? AbortSignal.timeout(2000) : undefined
            });
            if (response.ok) {
                toast.success("Ticket impreso (Bridge Local)");
                return true;
            }
        } catch (e) {
            console.warn("Bridge Local no detectado.");
        }

        // 3. Prioridad: WebUSB Direct (ESC/POS)
        if (raw && navigator.usb) {
            try {
                const success = await hardwareService._sendToUSB(raw);
                if (success) {
                    toast.success("Enviado a impresora USB");
                    return true;
                }
            } catch (err) {
                console.warn("WebUSB falló o no configurado.");
            }
        }

        // 4. Último Recurso: Diálogo de impresión del navegador
        toast.loading("Abriendo diálogo de impresión...", { duration: 2000 });
        return hardwareService._browserPrint(html);
    },

    /**
     * Intenta abrir la gaveta de dinero enviando el pulso ESC/POS
     */
    openCashDrawer: async () => {
        // Comando ESC/POS estándar para apertura de gaveta (Pin 2)
        const pulse = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0x96]);
        
        // Si estamos en Electron, podemos tener un handler específico
        if (window.electronAPI && window.electronAPI.sendRawToPrinter) {
            try {
                await window.electronAPI.sendRawToPrinter(pulse);
                return true;
            } catch (e) { console.error(e); }
        }

        // Intento por USB si está abierta
        return hardwareService._sendToUSB(pulse);
    },

    /**
     * Lee el peso de una báscula conectada (Placeholder para futura expansión)
     */
    readScale: async () => {
        if (window.electronAPI && window.electronAPI.readSerialScale) {
            return await window.electronAPI.readSerialScale();
        }
        console.warn("Lectura de báscula solo disponible en entorno nativo.");
        return 0;
    },

    // --- Helpers Internos ---

    _sendToUSB: async (data) => {
        try {
            const storedVid = localStorage.getItem('pos_printer_vendor_id');
            const pairedDevices = await navigator.usb.getDevices();
            let device = pairedDevices.find(d => d.vendorId === parseInt(storedVid));

            if (!device) return false;

            await device.open();
            if (device.configuration === null) await device.selectConfiguration(1);
            const iface = device.configuration.interfaces.find(i => i.alternates[0].interfaceClass === 7) || device.configuration.interfaces[0];
            await device.claimInterface(iface.interfaceNumber);
            const endpoint = iface.alternates[0].endpoints.find(e => e.direction === 'out');
            
            await device.transferOut(endpoint.endpointNumber, data);
            await device.releaseInterface(iface.interfaceNumber);
            await device.close();
            return true;
        } catch (e) {
            console.error("USB Helper Error:", e);
            return false;
        }
    },

    _browserPrint: (html) => {
        return new Promise((resolve) => {
            // Popup window approach — same method used by Eleventa and professional web POS.
            // Avoids the iframe bug where Chrome prints the parent page with iframe at -9999px,
            // causing content to appear far right and blurry from scaling.
            const win = window.open(
                '', '_blank',
                'width=220,height=750,left=100,top=80,scrollbars=no,menubar=no,toolbar=no,location=no,status=no'
            );

            if (!win) {
                toast.error('Permite ventanas emergentes (popups) en este sitio para imprimir tickets');
                resolve(false);
                return;
            }

            win.document.open();
            win.document.write(html);
            win.document.close();

            const doPrint = () => {
                win.focus();
                win.print();
                setTimeout(() => { win.close(); resolve(true); }, 1500);
            };

            if (win.document.readyState === 'complete') {
                setTimeout(doPrint, 600);
            } else {
                win.onload = () => setTimeout(doPrint, 600);
            }
        });
    }
};

export default hardwareService;
