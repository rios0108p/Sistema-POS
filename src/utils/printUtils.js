export const printTicket = (data) => {
    const { tienda, venta, productos, cliente, pagos } = data;
    const currency = '$';

    // Build items HTML
    const itemsHtml = productos.map(item => `
        <tr>
            <td style="padding: 2px 0;">
                <div>${item.nombre}</div>
                <div style="font-size: 10px;">${item.cantidad} x ${currency}${parseFloat(item.precio).toFixed(2)}</div>
            </td>
            <td style="text-align: right; vertical-align: bottom;">${currency}${(item.cantidad * item.precio).toFixed(2)}</td>
        </tr>
    `).join('');

    // Generate HTML content
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                @page { margin: 0; }
                body {
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 12px;
                    line-height: 1.2;
                    width: 58mm; /* Standard narrow thermal paper */
                    margin: 0;
                    padding: 10px;
                    color: black;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .bold { font-weight: bold; }
                .dashed-line { border-top: 1px dashed black; margin: 5px 0; }
                .mb-5 { margin-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; }
                .footer { font-size: 10px; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="text-center">
                <div class="bold" style="font-size: 14px;">${tienda?.nombre || 'MI TIENDA'}</div>
                <div>${tienda?.direccion || ''}</div>
                <div>Tel: ${tienda?.telefono || ''}</div>
            </div>

            <div class="dashed-line"></div>

            <div>
                <div>Ticket: #${venta?.ticket_numero || venta?.id || 'N/A'}</div>
                <div>Fecha: ${new Date().toLocaleString()}</div>
                ${cliente ? `<div>Cliente: ${cliente.nombre}</div>` : '<div>Cliente: Venta General</div>'}
            </div>

            <div class="dashed-line"></div>

            <table>
                <thead>
                    <tr class="bold">
                        <th style="text-align: left;">DESCRIPCIÓN</th>
                        <th style="text-align: right;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="dashed-line"></div>

            <div class="text-right">
                <div>SUBTOTAL: ${currency}${parseFloat(venta.subtotal || 0).toFixed(2)}</div>
                ${venta.descuento > 0 ? `<div>DESCUENTO: -${currency}${parseFloat(venta.descuento).toFixed(2)}</div>` : ''}
                <div class="bold" style="font-size: 14px;">TOTAL: ${currency}${parseFloat(venta.total).toFixed(2)}</div>
            </div>

            <div class="dashed-line"></div>
            
            <div class="bold">FORMA DE PAGO:</div>
            ${pagos.map(p => `<div>${p.metodo}: ${currency}${parseFloat(p.monto).toFixed(2)}</div>`).join('')}

            <div class="dashed-line"></div>

            <div class="text-center footer">
                <div>GRACIAS POR SU COMPRA</div>
                <div>Vuelva Pronto</div>
            </div>
        </body>
        </html>
    `;

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Write content to iframe
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Print
    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    // Remove focus from any active element to prevent scanner 'Enter' from re-triggering printing
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }

    // Remove iframe after printing (give it some time)
    setTimeout(() => {
        document.body.removeChild(iframe);
    }, 2000);
};
