import hardwareService from "../services/hardwareService";

/**
 * Función principal para imprimir tickets de venta.
 */
export const printTicket = async (data) => {
    const html = generateTicketHtml(data);
    const raw = generateEscPosTicket(data);
    return await hardwareService.print(data, html, raw);
};

/**
 * Reimpresión de Corte de Caja
 */
export const printCorteTicket = async (data) => {
    const html = generateCorteHtml(data);
    const raw = generateEscPosCorte(data);
    return await hardwareService.print(data, html, raw);
};

/**
 * Imprimir Ticket de Entrada/Salida de Efectivo
 */
export const printMovementTicket = async (data) => {
    const html = generateMovimientoHtml(data);
    const raw = generateEscPosMovimiento(data);
    return await hardwareService.print(data, html, raw);
};

export const tryDirectUSBPrint = async (data) => {
    const raw = generateEscPosTicket(data);
    const html = generateTicketHtml(data);
    return await hardwareService.print(data, html, raw);
};

export const resetPrinter = () => {
    localStorage.removeItem('pos_printer_vendor_id');
    localStorage.removeItem('pos_printer_product_id');
    localStorage.removeItem('pos_printer_name');
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => {
    const dt = d ? new Date(d) : new Date();
    return dt.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtTime = (d) => {
    const dt = d ? new Date(d) : new Date();
    return dt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};
const fmtDateTime = (d) => `${fmtDate(d)}  ${fmtTime(d)}`;
const bizInfo = (data) => ({
    name: data.sucursal?.nombre || data.tienda?.nombre_tienda || data.tienda?.nombre || 'TENDO-POS',
    dir: data.sucursal?.direccion || data.tienda?.direccion || '',
    tel: data.sucursal?.telefono || data.tienda?.telefono || '',
    rfc: data.sucursal?.rfc || data.tienda?.rfc || data.tienda?.nit || '',
    header: data.sucursal?.ticket_header || '',
    footer: data.sucursal?.ticket_footer || '¡GRACIAS POR SU COMPRA!\nVUELVA PRONTO',
});

// ─────────────────────────────────────────────
//  TICKET DE VENTA — HTML
// ─────────────────────────────────────────────
function generateTicketHtml(data) {
    const b = bizInfo(data);
    const now = new Date();
    const subtotal = Number(data.venta?.subtotal || 0);
    const descuento = Number(data.venta?.descuento || 0);
    const impuestos = Number(data.venta?.total_impuestos || 0);
    const total = Number(data.venta?.total || 0);
    const ticketNum = data.venta?.ticket_numero || data.venta?.id || '---';
    const cajero = data.venta?.cajero || 'Administrador';
    const cliente = data.cliente?.nombre || '';

    // Detectar cambio (si pago en efectivo)
    const totalPagado = (data.pagos || []).reduce((s, p) => s + Number(p.monto || 0), 0);
    const cambio = totalPagado > total ? (totalPagado - total) : 0;

    const itemsHtml = (data.productos || []).map(p => {
        const qty = Number(p.cantidad || 1);
        const price = Number(p.precio || 0);
        const lineTotal = p.subtotal != null ? Number(p.subtotal) : qty * price;
        const name = (p.nombre || 'Producto').substring(0, 28);
        return `
        <tr>
          <td class="pname">${name}</td>
          <td class="pcent">${qty}</td>
          <td class="pcent">${fmt(price)}</td>
          <td class="pright">${fmt(lineTotal)}</td>
        </tr>`;
    }).join('');

    const pagosHtml = (data.pagos || []).map(p => `
        <div class="row">
          <span class="pmeth">${(p.metodo || 'Pago').toUpperCase()}${p.referencia ? ` (${p.referencia})` : ''}</span>
          <span>${fmt(p.monto)}</span>
        </div>`).join('');

    const headerExtra = b.header
        ? b.header.split('\n').map(l => `<div class="extra">${l.trim()}</div>`).join('')
        : '';
    const footerHtml = b.footer
        .split('\n').map(l => `<div>${l.trim()}</div>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 8pt;
    width: 48mm;
    margin: 0;
    padding: 2mm 0 0 0;
    color: #000;
  }
  .logo { text-align:center; font-size:11pt; font-weight:900; margin-bottom:1mm; }
  .biz-sub { text-align:center; font-size:7pt; line-height:1.5; }
  .extra { text-align:center; font-size:7pt; }
  .hr { border:none; border-top:1px dashed #000; margin:1mm 0; }
  .title { text-align:center; font-weight:900; font-size:9pt; }
  .meta { font-size:7.5pt; }
  .row { display:table; width:100%; font-size:7.5pt; margin:0.4mm 0; }
  .row > span:first-child { display:table-cell; width:100%; }
  .row > span:last-child { display:table-cell; white-space:nowrap; text-align:right; }
  .row-bold { display:table; width:100%; font-size:7.5pt; font-weight:700; margin:0.4mm 0; }
  .row-bold > span:first-child { display:table-cell; width:100%; }
  .row-bold > span:last-child { display:table-cell; white-space:nowrap; text-align:right; }
  table { width:100%; border-collapse:collapse; margin:1mm 0; }
  thead th { font-size:6.5pt; font-weight:900; border-bottom:1px solid #000; padding:0.5mm 0; text-transform:uppercase; }
  .th-l { text-align:left; }
  .th-c { text-align:center; }
  .th-r { text-align:right; }
  td { padding:0.5mm 0; font-size:7pt; vertical-align:top; }
  .pname { text-align:left; width:52%; line-height:1.3; }
  .pcent { text-align:center; width:14%; }
  .pright { text-align:right; width:20%; }
  .total-line { display:table; width:100%; font-size:11pt; font-weight:900; margin:1mm 0 0.5mm; }
  .total-line > span:first-child { display:table-cell; width:100%; }
  .total-line > span:last-child { display:table-cell; white-space:nowrap; text-align:right; }
  .cambio { display:table; width:100%; font-size:7.5pt; margin:0.4mm 0; }
  .cambio > span:first-child { display:table-cell; width:100%; }
  .cambio > span:last-child { display:table-cell; white-space:nowrap; text-align:right; }
  .pmeth { max-width:60%; }
  .footer-block { text-align:center; font-size:7.5pt; line-height:1.6; margin-top:2mm; font-weight:700; }
  .ticket-no { text-align:center; font-size:6.5pt; margin-top:1mm; opacity:.7; }
  .spacer { height:8mm; }
  .cliente-row { font-size:7.5pt; font-weight:700; margin: 0.4mm 0; }
</style>
</head>
<body>
  <div class="logo">${b.name.toUpperCase()}</div>
  <div class="biz-sub">
    ${b.dir ? `<div>${b.dir}</div>` : ''}
    ${b.tel ? `<div>Tel: ${b.tel}</div>` : ''}
    ${b.rfc ? `<div>RFC: ${b.rfc}</div>` : ''}
  </div>
  ${headerExtra}
  <hr class="hr">
  <div class="title">TICKET DE VENTA</div>
  <hr class="hr">
  <div class="meta">
    <div class="row"><span>Fecha:</span><span>${fmtDate(now)}</span></div>
    <div class="row"><span>Hora:</span><span>${fmtTime(now)}</span></div>
    <div class="row"><span>Folio:</span><span><b>#${ticketNum}</b></span></div>
    <div class="row"><span>Atendió:</span><span>${cajero}</span></div>
    ${cliente ? `<div class="row cliente-row"><span>Cliente:</span><span>${cliente}</span></div>` : ''}
  </div>
  <hr class="hr">

  <table>
    <thead>
      <tr>
        <th class="th-l">Producto</th>
        <th class="th-c">Cant</th>
        <th class="th-c">P.Unit</th>
        <th class="th-r">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>
  <hr class="hr">

  <div class="row"><span>Subtotal:</span><span>${fmt(subtotal)}</span></div>
  ${descuento > 0 ? `<div class="row"><span>Descuento:</span><span>-${fmt(descuento)}</span></div>` : ''}
  ${impuestos > 0 ? `<div class="row"><span>Impuestos:</span><span>${fmt(impuestos)}</span></div>` : ''}
  <div class="total-line"><span>TOTAL:</span><span>${fmt(total)}</span></div>

  <hr class="hr">
  <div style="font-size:10px; font-weight:900; margin-bottom:2px;">FORMA DE PAGO</div>
  ${pagosHtml}
  ${cambio > 0 ? `<div class="cambio" style="margin-top:4px;"><span><b>CAMBIO:</b></span><span><b>${fmt(cambio)}</b></span></div>` : ''}

  <hr class="hr">
  <div class="footer-block">${footerHtml}</div>
  <div class="ticket-no">TICKET #${ticketNum} — TENDO-POS v1.1.15</div>
  <div class="spacer"></div>
</body>
</html>`;
}

// ─────────────────────────────────────────────
//  CORTE DE CAJA — HTML
// ─────────────────────────────────────────────
function generateCorteHtml(data) {
    const b = bizInfo(data);
    const now = new Date();
    const turno = data.turno || {};
    const totalVentas = Number(turno.total_ventas || 0);
    const totalMonto = Number(turno.total_monto || 0);
    const montoInicial = Number(turno.monto_inicial || 0);
    const ventasEfectivo = Number(turno.ventas_efectivo || 0);
    const montoFinal = Number(turno.monto_final || 0);
    const diferencia = Number(turno.diferencia || 0);
    const shiftName = turno.shift_name || (turno.id ? `Turno #${turno.id}` : 'Turno');

    const catRows = (data.ventasPorCategoria || []).map(c => `
        <div class="row"><span>${(c.categoria || 'GENERAL').substring(0, 22)}</span><span>${fmt(c.total)}</span></div>`).join('');

    const metodosRows = (data.totalesPorMetodo || []).map(m => `
        <div class="row-bold"><span>${(m.metodo || '').toUpperCase()}</span><span>${fmt(m.total)}</span></div>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 8pt;
    width: 48mm;
    margin: 0;
    padding: 2mm 0 0 0;
    color: #000;
  }
  .logo { text-align:center; font-size:11pt; font-weight:900; margin-bottom:1mm; }
  .biz-sub { text-align:center; font-size:7pt; line-height:1.5; }
  .hr { border:none; border-top:1px dashed #000; margin:1mm 0; }
  .hr-solid { border:none; border-top:2px solid #000; margin:1mm 0; }
  .title { text-align:center; font-weight:900; font-size:9pt; }
  .section-title { font-size:6.5pt; font-weight:900; text-transform:uppercase; margin: 1mm 0 0.4mm; opacity:.6; }
  .row { display:table; width:100%; font-size:7.5pt; margin:0.4mm 0; }
  .row > span:first-child { display:table-cell; width:100%; }
  .row > span:last-child { display:table-cell; white-space:nowrap; text-align:right; }
  .row-bold { display:table; width:100%; font-size:7.5pt; font-weight:900; margin:0.4mm 0; }
  .row-bold > span:first-child { display:table-cell; width:100%; }
  .row-bold > span:last-child { display:table-cell; white-space:nowrap; text-align:right; }
  .grand-total { display:table; width:100%; font-size:11pt; font-weight:900; margin:1mm 0; border-top:2px solid #000; border-bottom:1px dashed #000; padding:1mm 0; }
  .grand-total > span:first-child { display:table-cell; width:100%; }
  .grand-total > span:last-child { display:table-cell; white-space:nowrap; text-align:right; }
  .box { border:1px solid #000; padding:1mm 1.5mm; margin:1mm 0; }
  .audit-row { display:table; width:100%; font-size:7.5pt; margin:0.4mm 0; }
  .audit-row > span:first-child { display:table-cell; width:100%; }
  .audit-row > span:last-child { display:table-cell; white-space:nowrap; text-align:right; }
  .audit-diff { display:table; width:100%; font-size:8.5pt; font-weight:900; margin:1mm 0; }
  .audit-diff > span:first-child { display:table-cell; width:100%; }
  .audit-diff > span:last-child { display:table-cell; white-space:nowrap; text-align:right; }
  .cancel-box { border:1px dashed #000; padding:1mm 1.5mm; margin:1mm 0; }
  .sig-line { border-top:1px solid #000; margin-top:8mm; font-size:6.5pt; text-align:center; padding-top:1mm; }
  .footer-block { text-align:center; font-size:7pt; margin-top:2mm; }
  .spacer { height:10mm; }
</style>
</head>
<body>
  <div class="logo">${b.name.toUpperCase()}</div>
  <div class="biz-sub">
    ${b.dir ? `<div>${b.dir}</div>` : ''}
    ${b.tel ? `<div>Tel: ${b.tel}</div>` : ''}
    ${b.rfc ? `<div>RFC: ${b.rfc}</div>` : ''}
  </div>
  <hr class="hr">
  <div class="title">CORTE DE CAJA</div>
  <hr class="hr">

  <div class="row"><span>Turno:</span><span><b>${shiftName.toUpperCase()}</b></span></div>
  <div class="row"><span>Operador:</span><span><b>${(turno.usuario_nombre || '').toUpperCase()}</b></span></div>
  <div class="row"><span>Fecha:</span><span>${fmtDate(now)}</span></div>
  <div class="row"><span>Hora cierre:</span><span>${fmtTime(now)}</span></div>

  <hr class="hr">
  <div class="section-title">▸ Resumen de ventas</div>
  <div class="grand-total">
    <span>TOTAL (${totalVentas} vtas):</span>
    <span>${fmt(totalMonto)}</span>
  </div>

  ${metodosRows ? `
  <div class="section-title">▸ Por método de pago</div>
  <div class="box">
    ${metodosRows}
  </div>` : ''}

  ${catRows ? `
  <div class="section-title">▸ Por departamento / categoría</div>
  <div>
    ${catRows}
  </div>
  <hr class="hr">` : '<hr class="hr">'}

  ${(data.numCancelados > 0) ? `
  <div class="cancel-box">
    <div class="section-title">⚠ DEVOLUCIONES / CANCELACIONES</div>
    <div class="row-bold">
      <span>Total (${data.numCancelados} cancel.):</span>
      <span>-${fmt(data.totalCancelado)}</span>
    </div>
  </div>
  <hr class="hr">` : ''}

  <div class="section-title">▸ Auditoría de caja (efectivo)</div>
  <div class="box">
    <div class="audit-row"><span>Fondo inicial:</span><span>${fmt(montoInicial)}</span></div>
    <div class="audit-row"><span>Ventas efectivo:</span><span>${fmt(ventasEfectivo)}</span></div>
    <div class="audit-row"><span>Esperado en caja:</span><span><b>${fmt(montoInicial + ventasEfectivo)}</b></span></div>
    <hr class="hr">
    <div class="audit-row"><span>Arqueo físico:</span><span>${fmt(montoFinal)}</span></div>
    <div class="audit-diff" style="${diferencia < 0 ? 'color:#000' : ''}">
      <span>DIFERENCIA:</span>
      <span>${diferencia >= 0 ? '+' : ''}${fmt(diferencia)}</span>
    </div>
  </div>

  <div style="margin-top:20px;">
    <div class="sig-line">FIRMA DEL OPERADOR</div>
    <div class="sig-line" style="margin-top:24px;">V°B° ADMINISTRADOR</div>
  </div>

  <div class="footer-block">TENDO-POS v1.1.15 — ${fmtDateTime(now)}</div>
  <div class="spacer"></div>
</body>
</html>`;
}

// ─────────────────────────────────────────────
//  MOVIMIENTO (ENTRADA/SALIDA) — HTML
// ─────────────────────────────────────────────
function generateMovimientoHtml(data) {
    const b = bizInfo(data);
    const tipo = data.tipo === 'SALIDA' ? 'SALIDA DE EFECTIVO' : 'ENTRADA DE EFECTIVO';
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { font-family:'Courier New',Courier,monospace; font-size:8pt; width:48mm; margin:0; padding:2mm 0 0 0; color:#000; }
  .center { text-align:center; }
  .logo { text-align:center; font-size:11pt; font-weight:900; margin-bottom:1mm; }
  .biz-sub { text-align:center; font-size:7pt; line-height:1.5; }
  .hr { border:none; border-top:1px dashed #000; margin:1mm 0; }
  .title { text-align:center; font-weight:900; font-size:9pt; }
  .big-amount { text-align:center; font-size:16pt; font-weight:900; margin:3mm 0; }
  .row { display:table; width:100%; font-size:8pt; margin:0.5mm 0; }
  .row > span:first-child { display:table-cell; width:100%; }
  .row > span:last-child { display:table-cell; white-space:nowrap; text-align:right; }
  .sig-line { border-top:1px solid #000; margin-top:10mm; font-size:7pt; text-align:center; padding-top:1mm; }
  .spacer { height:10mm; }
</style>
</head>
<body>
  <div class="logo">${b.name.toUpperCase()}</div>
  <div class="biz-sub">
    ${b.dir ? `<div>${b.dir}</div>` : ''}
    ${b.tel ? `<div>Tel: ${b.tel}</div>` : ''}
  </div>
  <hr class="hr">
  <div class="title">${tipo}</div>
  <hr class="hr">
  <div class="row"><span>Fecha:</span><span>${fmtDate()}</span></div>
  <div class="row"><span>Hora:</span><span>${fmtTime()}</span></div>
  <div class="row"><span>Atendió:</span><span>${data.usuario_nombre || 'S/N'}</span></div>
  <hr class="hr">
  <div class="big-amount">${fmt(data.monto)}</div>
  <hr class="hr">
  <div style="font-size:11px; margin:4px 0;"><b>Concepto:</b> ${data.descripcion || 'Sin descripción'}</div>
  <div class="sig-line">FIRMA DE RECIBIDO</div>
  <div class="spacer"></div>
</body>
</html>`;
}

// ─────────────────────────────────────────────
//  ESC/POS — TICKET DE VENTA
// ─────────────────────────────────────────────
function generateEscPosTicket(data) {
    const enc = new TextEncoder();
    const ESC = 0x1B, GS = 0x1D;
    let c = [];
    const push = (...bytes) => c.push(...bytes);
    const text = (s) => c.push(...enc.encode(s));
    const LF = '\n';
    const SEP = '--------------------------------\n';
    const W = 32; // columnas ancho 80mm

    const rjust = (left, right, width = W) => {
        const sp = width - left.length - right.length;
        return left + ' '.repeat(Math.max(1, sp)) + right + LF;
    };
    const center = (s, width = W) => {
        const pad = Math.max(0, Math.floor((width - s.length) / 2));
        return ' '.repeat(pad) + s + LF;
    };

    const b = bizInfo(data);
    const subtotal = Number(data.venta?.subtotal || 0);
    const descuento = Number(data.venta?.descuento || 0);
    const impuestos = Number(data.venta?.total_impuestos || 0);
    const total = Number(data.venta?.total || 0);
    const ticketNum = data.venta?.ticket_numero || data.venta?.id || '---';
    const cajero = (data.venta?.cajero || 'Admin').substring(0, 20);
    const cliente = data.cliente?.nombre || '';
    const totalPagado = (data.pagos || []).reduce((s, p) => s + Number(p.monto || 0), 0);
    const cambio = totalPagado > total ? (totalPagado - total) : 0;

    // Init + cash drawer pulse
    push(ESC, 0x40);
    push(ESC, 0x70, 0x00, 0x19, 0x96);

    // Header — centered, double-height biz name
    push(ESC, 0x61, 0x01); // center
    push(ESC, 0x21, 0x10); // double height
    text(b.name.toUpperCase() + LF);
    push(ESC, 0x21, 0x00); // normal
    if (b.dir) text(b.dir + LF);
    if (b.tel) text(`Tel: ${b.tel}` + LF);
    if (b.rfc) text(`RFC: ${b.rfc}` + LF);
    if (b.header) {
        b.header.split('\n').forEach(l => text(l.trim() + LF));
    }
    text(SEP);

    // Title
    push(ESC, 0x21, 0x08); // bold
    text(center('TICKET DE VENTA'));
    push(ESC, 0x21, 0x00);
    text(SEP);

    // Meta
    push(ESC, 0x61, 0x00); // left
    text(rjust('Fecha:', fmtDate()));
    text(rjust('Hora:', fmtTime()));
    text(rjust('Folio:', `#${ticketNum}`));
    text(rjust('Atendio:', cajero));
    if (cliente) text(rjust('Cliente:', cliente.substring(0, 16)));
    text(SEP);

    // Products
    const colW = W - 9; // name col width
    (data.productos || []).forEach(p => {
        const qty = Number(p.cantidad || 1);
        const price = Number(p.precio || 0);
        const lineTotal = p.subtotal != null ? Number(p.subtotal) : qty * price;
        const name = (p.nombre || 'Producto').substring(0, colW);
        const totalStr = fmt(lineTotal);
        const sp = W - name.length - totalStr.length;
        text(name + ' '.repeat(Math.max(1, sp)) + totalStr + LF);
        // unit line if qty > 1
        if (qty > 1) {
            const unitLine = `  ${qty} x ${fmt(price)}`;
            text(unitLine + LF);
        }
    });
    text(SEP);

    // Totals
    push(ESC, 0x61, 0x02); // right
    if (subtotal !== total) text(`Subtotal:  ${fmt(subtotal)}\n`);
    if (descuento > 0) text(`Descuento: -${fmt(descuento)}\n`);
    if (impuestos > 0) text(`Impuestos:  ${fmt(impuestos)}\n`);
    push(ESC, 0x21, 0x30); // double width+height
    text(`TOTAL: ${fmt(total)}\n`);
    push(ESC, 0x21, 0x00);

    // Payments
    push(ESC, 0x61, 0x00); // left
    text(SEP);
    (data.pagos || []).forEach(p => {
        const met = (p.metodo || 'Pago').toUpperCase().substring(0, 14);
        text(rjust(met + ':', fmt(p.monto)));
    });
    if (cambio > 0) {
        push(ESC, 0x21, 0x08); // bold
        text(rjust('CAMBIO:', fmt(cambio)));
        push(ESC, 0x21, 0x00);
    }

    // Footer
    push(ESC, 0x61, 0x01); // center
    text(SEP.slice(0, -1) + LF);
    b.footer.split('\n').forEach(l => text(l.trim() + LF));
    text(`Folio #${ticketNum}\n`);

    // Feed + cut
    text('\n\n\n\n');
    push(GS, 0x56, 0x01);

    return new Uint8Array(c);
}

// ─────────────────────────────────────────────
//  ESC/POS — CORTE DE CAJA
// ─────────────────────────────────────────────
function generateEscPosCorte(data) {
    const enc = new TextEncoder();
    const ESC = 0x1B, GS = 0x1D;
    let c = [];
    const push = (...bytes) => c.push(...bytes);
    const text = (s) => c.push(...enc.encode(s));
    const LF = '\n';
    const SEP = '--------------------------------\n';
    const W = 32;
    const rjust = (left, right, width = W) => {
        const sp = width - left.length - right.length;
        return left + ' '.repeat(Math.max(1, sp)) + right + LF;
    };
    const center = (s, width = W) => {
        const pad = Math.max(0, Math.floor((width - s.length) / 2));
        return ' '.repeat(pad) + s + LF;
    };

    const b = bizInfo(data);
    const turno = data.turno || {};
    const totalVentas = Number(turno.total_ventas || 0);
    const totalMonto = Number(turno.total_monto || 0);
    const montoInicial = Number(turno.monto_inicial || 0);
    const ventasEfectivo = Number(turno.ventas_efectivo || 0);
    const montoFinal = Number(turno.monto_final || 0);
    const diferencia = Number(turno.diferencia || 0);
    const shiftName = turno.shift_name || (turno.id ? `Turno #${turno.id}` : 'Turno');

    push(ESC, 0x40); // init

    // Header
    push(ESC, 0x61, 0x01);
    push(ESC, 0x21, 0x10);
    text(b.name.toUpperCase() + LF);
    push(ESC, 0x21, 0x00);
    if (b.dir) text(b.dir + LF);
    if (b.tel) text(`Tel: ${b.tel}` + LF);
    if (b.rfc) text(`RFC: ${b.rfc}` + LF);
    text(SEP);

    push(ESC, 0x21, 0x10);
    text(center('CORTE DE CAJA'));
    push(ESC, 0x21, 0x00);
    text(SEP);

    push(ESC, 0x61, 0x00);
    text(rjust('Turno:', shiftName.substring(0, 16)));
    text(rjust('Operador:', (turno.usuario_nombre || '').substring(0, 14)));
    text(rjust('Fecha:', fmtDate()));
    text(rjust('Hora cierre:', fmtTime()));
    text(SEP);

    // Grand total
    text('VENTAS DEL TURNO\n');
    push(ESC, 0x21, 0x30);
    text(rjust(`(${totalVentas} vtas)`, fmt(totalMonto)));
    push(ESC, 0x21, 0x00);
    text(SEP);

    // By payment method
    if (data.totalesPorMetodo && data.totalesPorMetodo.length > 0) {
        text('COBROS POR METODO:\n');
        data.totalesPorMetodo.forEach(m => {
            push(ESC, 0x21, 0x08);
            text(rjust(m.metodo.toUpperCase().substring(0, 18) + ':', fmt(m.total)));
            push(ESC, 0x21, 0x00);
        });
        text(SEP);
    }

    // By category
    if (data.ventasPorCategoria && data.ventasPorCategoria.length > 0) {
        text('VENTAS POR DEPARTAMENTO:\n');
        data.ventasPorCategoria.forEach(cat => {
            const name = (cat.categoria || 'GENERAL').substring(0, 20);
            text(rjust(name + ':', fmt(cat.total)));
        });
        text(SEP);
    }

    // Cancellations
    if (data.numCancelados > 0) {
        push(ESC, 0x61, 0x01);
        push(ESC, 0x21, 0x08);
        text(`** DEVOLUCIONES/CANCELACIONES **\n`);
        push(ESC, 0x21, 0x00);
        push(ESC, 0x61, 0x00);
        text(rjust(`Total (${data.numCancelados} cancel.):`, `-${fmt(data.totalCancelado)}`));
        text(SEP);
    }

    // Cash audit
    push(ESC, 0x61, 0x01);
    text('AUDITORIA DE CAJA\n');
    push(ESC, 0x61, 0x00);
    text(SEP);
    text(rjust('Fondo inicial:', fmt(montoInicial)));
    text(rjust('Ventas efectivo:', fmt(ventasEfectivo)));
    text(rjust('Esperado:', fmt(montoInicial + ventasEfectivo)));
    text(SEP.slice(0, -1) + LF);
    text(rjust('Arqueo fisico:', fmt(montoFinal)));
    push(ESC, 0x21, 0x10);
    text(rjust('DIFERENCIA:', `${diferencia >= 0 ? '+' : ''}${fmt(diferencia)}`));
    push(ESC, 0x21, 0x00);

    // Signatures
    text('\n\n');
    text(SEP);
    text('FIRMA DEL OPERADOR\n');
    text('\n\n\n');
    text(SEP);
    text('V/B ADMINISTRADOR\n');

    text('\n\n\n\n');
    push(GS, 0x56, 0x01);
    return new Uint8Array(c);
}

// ─────────────────────────────────────────────
//  ESC/POS — MOVIMIENTO
// ─────────────────────────────────────────────
function generateEscPosMovimiento(data) {
    const enc = new TextEncoder();
    const ESC = 0x1B, GS = 0x1D;
    let c = [];
    const push = (...bytes) => c.push(...bytes);
    const text = (s) => c.push(...enc.encode(s));
    const LF = '\n';
    const SEP = '--------------------------------\n';
    const b = bizInfo(data);
    const tipo = data.tipo === 'SALIDA' ? 'SALIDA DE EFECTIVO' : 'ENTRADA DE EFECTIVO';

    push(ESC, 0x40);
    push(ESC, 0x61, 0x01);
    push(ESC, 0x21, 0x10);
    text(b.name.toUpperCase() + LF);
    push(ESC, 0x21, 0x00);
    if (b.dir) text(b.dir + LF);
    if (b.tel) text(`Tel: ${b.tel}` + LF);
    text(SEP);
    push(ESC, 0x21, 0x08);
    text(tipo + LF);
    push(ESC, 0x21, 0x00);
    text(`${fmtDate()}  ${fmtTime()}` + LF);
    text(SEP);
    push(ESC, 0x21, 0x30);
    text(`${fmt(data.monto)}` + LF);
    push(ESC, 0x21, 0x00);
    push(ESC, 0x61, 0x00);
    text(SEP);
    text(`Concepto: ${data.descripcion || 'Sin descripcion'}` + LF);
    text(`Atendio: ${data.usuario_nombre || 'S/N'}` + LF);
    text('\n\n');
    text(SEP);
    push(ESC, 0x61, 0x01);
    text('FIRMA DE RECIBIDO\n');
    text('\n\n\n\n');
    push(GS, 0x56, 0x01);
    return new Uint8Array(c);
}
