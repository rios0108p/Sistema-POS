import hardwareService from "../services/hardwareService";
import { printViaQZ } from "./qzUtils";

/**
 * Función principal para imprimir tickets.
 * Coordina la generación de formatos y el envío al hardwareService.
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
    const html = generateTicketHtml({ ...data, isCorte: true });
    const raw = generateEscPosTicket({ ...data, isCorte: true });
    
    return await hardwareService.print(data, html, raw);
};

/**
 * Imprimir Ticket de Entrada/Salida de Efectivo
 */
export const printMovementTicket = async (data) => {
    const html = generateTicketHtml({ ...data, isMovimiento: true });
    const raw = generateEscPosTicket({ ...data, isMovimiento: true });
    
    return await hardwareService.print(data, html, raw);
};

/**
 * Legacy Support / Specific Helpers (Si se requieren llamar por separado)
 */
export const tryDirectUSBPrint = async (data) => {
    const raw = generateEscPosTicket(data);
    const html = generateTicketHtml(data);
    return await hardwareService.print(data, html, raw);
};

export const resetPrinter = () => {
    localStorage.removeItem('pos_printer_vendor_id');
    localStorage.removeItem('pos_printer_product_id');
    localStorage.removeItem('pos_printer_name');
    toast.success("Impresora olvidada.");
};

// --- Generador de Comandos ESC/POS ---
function generateEscPosTicket(data) {
    const encoder = new TextEncoder();
    const esc = [0x1B]; // ESC
    const gs = [0x1D];  // GS

    let cmds = [];

    // Inicializar impresora
    cmds.push(...esc, 0x40);

    // Kick Cash Drawer (Pulse pin 2)
    // Command: ESC p m t1 t2
    cmds.push(...esc, 0x70, 0x00, 0x19, 0x96);

    // Centrar texto
    cmds.push(...esc, 0x61, 0x01);

    // Título / Tienda / Identidad de Sucursal
    const bizName = data.sucursal?.nombre || data.tienda?.nombre_tienda || 'TIENDA';
    const bizDir = data.sucursal?.direccion || data.tienda?.direccion || '';
    const bizTel = data.sucursal?.telefono || data.tienda?.telefono || '';
    const bizRFC = data.sucursal?.rfc || data.tienda?.rfc || data.tienda?.nit || '';

    cmds.push(...esc, 0x21, 0x10);
    cmds.push(...encoder.encode(`${bizName.toUpperCase()}\n`));
    cmds.push(...esc, 0x21, 0x00); // Texto normal
    if (bizDir) cmds.push(...encoder.encode(`${bizDir}\n`));
    if (bizTel) cmds.push(...encoder.encode(`TEL: ${bizTel}\n`));
    if (bizRFC) cmds.push(...encoder.encode(`RFC: ${bizRFC}\n`));

    // Líneas extra de encabezado personalizadas si existen
    if (data.sucursal && data.sucursal.ticket_header) {
        const headerLines = data.sucursal.ticket_header.split('\n');
        headerLines.forEach(l => {
            cmds.push(...encoder.encode(`${l.trim()}\n`));
        });
    }
    cmds.push(...encoder.encode("--------------------------------\n"));

    if (data.isCorte) {
        // Formato para CORTE DE CAJA mejorado
        const shiftName = data.turno?.shift_name || (data.turno?.id ? `Turno #${data.turno.id}` : 'Turno');

        cmds.push(...esc, 0x61, 0x01); // Centrar
        cmds.push(...esc, 0x21, 0x10); // Negrita
        cmds.push(...encoder.encode("CORTE DE CAJA\n"));
        cmds.push(...esc, 0x21, 0x00); // Normal
        cmds.push(...encoder.encode(`${shiftName.toUpperCase()}\n`));
        cmds.push(...encoder.encode(`OPERADOR: ${(data.turno?.usuario_nombre || '').toUpperCase()}\n`));
        cmds.push(...encoder.encode(`${new Date().toLocaleString()}\n`));
        cmds.push(...esc, 0x61, 0x00); // Izquierda
        cmds.push(...encoder.encode("--------------------------------\n"));

        // Resumen General
        const lineVentas = `VENTAS (${data.turno?.total_ventas || 0}):`;
        const totalVentas = `$${Number(data.turno?.total_monto || 0).toFixed(2)}`;
        const spacesVentas = 32 - lineVentas.length - totalVentas.length;
        cmds.push(...esc, 0x21, 0x01); // Negrita pequeña
        cmds.push(...encoder.encode(lineVentas + " ".repeat(Math.max(1, spacesVentas)) + totalVentas + "\n"));
        cmds.push(...esc, 0x21, 0x00);

        // Ventas por Categoría (Departamentos)
        if (data.ventasPorCategoria && data.ventasPorCategoria.length > 0) {
            cmds.push(...encoder.encode("\nVENTAS POR DEPARTAMENTO:\n"));
            data.ventasPorCategoria.forEach(c => {
                const cat = (c.categoria || 'GENERAL').substring(0, 20);
                const val = `$${Number(c.total).toFixed(2)}`;
                const spaces = 32 - cat.length - val.length;
                cmds.push(...encoder.encode(cat + " ".repeat(Math.max(1, spaces)) + val + "\n"));
            });
        }

        // Totales por Método
        if (data.totalesPorMetodo && data.totalesPorMetodo.length > 0) {
            cmds.push(...encoder.encode("\nCOBROS POR METODO:\n"));
            data.totalesPorMetodo.forEach(m => {
                const met = m.metodo.toUpperCase().substring(0, 20);
                const val = `$${Number(m.total).toFixed(2)}`;
                const spaces = 32 - met.length - val.length;
                cmds.push(...encoder.encode(met + " ".repeat(Math.max(1, spaces)) + val + "\n"));
            });
        }

        // Cancelaciones
        if (data.numCancelados > 0) {
            cmds.push(...esc, 0x61, 0x01); // Centro
            cmds.push(...esc, 0x21, 0x10); // Negrita Double Height
            cmds.push(...encoder.encode("\n*** DEVOLUCIONES ***\n"));
            cmds.push(...esc, 0x21, 0x01); // Negrita pequeña
            const lineCan = `TOTAL (${data.numCancelados}):`;
            const totalCan = `-$${Number(data.totalCancelado).toFixed(2)}`;
            const spacesCan = 32 - lineCan.length - totalCan.length;
            cmds.push(...encoder.encode(lineCan + " ".repeat(Math.max(1, spacesCan)) + totalCan + "\n"));
            cmds.push(...esc, 0x21, 0x00);
            cmds.push(...encoder.encode("--------------------------------\n"));
        }

        cmds.push(...encoder.encode("--------------------------------\n"));
        cmds.push(...esc, 0x61, 0x01); // Centrar
        cmds.push(...encoder.encode("AUDITORIA DE CAJA (EFECTIVO)\n"));
        cmds.push(...esc, 0x61, 0x00); // Izquierda

        const esperado = Number(data.turno?.monto_inicial || 0) + Number(data.turno?.ventas_efectivo || 0);

        const rows = [
            ["Fondo Inicial:", `$${Number(data.turno?.monto_inicial || 0).toFixed(2)}`],
            ["Ventas Efectivo:", `$${Number(data.turno?.ventas_efectivo || 0).toFixed(2)}`],
            ["Arqueo (Fisico):", `$${Number(data.turno?.monto_final || 0).toFixed(2)}`],
            ["DIFERENCIA:", `$${Number(data.turno?.diferencia || 0).toFixed(2)}`]
        ];

        rows.forEach((r, idx) => {
            if (idx === 1 || idx === 3) cmds.push(...esc, 0x21, 0x01); // Negrita
            const spaces = 32 - r[0].length - r[1].length;
            cmds.push(...encoder.encode(r[0] + " ".repeat(Math.max(1, spaces)) + r[1] + "\n"));
            if (idx === 1 || idx === 3) cmds.push(...esc, 0x21, 0x00);
        });

        cmds.push(...encoder.encode("\n\n--------------------------------\n"));
        cmds.push(...esc, 0x21, 0x00); // Normal
        cmds.push(...encoder.encode("FIRMA DEL OPERADOR\n"));
    } else if (data.isMovimiento) {
        // Formato para ENTRADA/SALIDA DE EFECTIVO
        cmds.push(...esc, 0x61, 0x01); // Centrar
        cmds.push(...esc, 0x21, 0x10); // Negrita
        cmds.push(...encoder.encode(`${data.tipo === 'SALIDA' ? 'SALIDA' : 'ENTRADA'} DE DINERO\n`));
        cmds.push(...esc, 0x21, 0x00); // Normal
        cmds.push(...encoder.encode(`${new Date().toLocaleString()}\n`));
        cmds.push(...encoder.encode("--------------------------------\n"));
        cmds.push(...esc, 0x21, 0x30); // Grande
        cmds.push(...encoder.encode(`$${Number(data.monto).toFixed(2)}\n`));
        cmds.push(...esc, 0x21, 0x00);
        cmds.push(...esc, 0x61, 0x00); // Izquierda
        cmds.push(...encoder.encode(`\nCONCEPTO: ${data.descripcion || 'Sin descripción'}\n`));
        cmds.push(...encoder.encode(`ATENDIO: ${data.usuario_nombre || 'S/N'}\n`));
        cmds.push(...encoder.encode("\n\n--------------------------------\n"));
        cmds.push(...esc, 0x61, 0x01); // Centrar
        cmds.push(...encoder.encode("FIRMA DE RECIBIDO\n"));
    } else {
        // Formato para TICKET DE VENTA
        cmds.push(...encoder.encode(`TICKET #${data.venta?.ticket_numero || data.venta?.id}\n`));
        cmds.push(...encoder.encode(`ATENDIÓ: ${data.venta?.cajero}\n`));
        cmds.push(...encoder.encode(`${new Date().toLocaleString()}\n`));
        cmds.push(...encoder.encode("--------------------------------\n"));

        // Productos
        cmds.push(...esc, 0x61, 0x00); // Alinear izquierda
        (data.productos || []).forEach(p => {
            const line = `${p.cantidad} x ${(p.nombre || '').substring(0, 15)}`;
            const price = `$${(p.cantidad * p.precio).toFixed(2)}`;
            const spaceCount = 32 - line.length - price.length;
            cmds.push(...encoder.encode(line + " ".repeat(Math.max(1, spaceCount)) + price + "\n"));
        });

        if (data.pagos && data.pagos.length > 0) {
            cmds.push(...encoder.encode("--------------------------------\n"));
            data.pagos.forEach(p => {
                const line = `${(p.metodo || 'Pago').substring(0, 15)}`;
                const val = `$${Number(p.monto).toFixed(2)}`;
                const spaceCount = 32 - line.length - val.length;
                cmds.push(...encoder.encode(line + " ".repeat(Math.max(1, spaceCount)) + val + "\n"));
            });
        }

        cmds.push(...encoder.encode("--------------------------------\n"));

        // Totales
        cmds.push(...esc, 0x61, 0x02); // Derecha
        cmds.push(...encoder.encode(`SUBTOTAL: $${Number(data.venta?.subtotal || 0).toFixed(2)}\n`));
        if (data.venta?.total_impuestos > 0) cmds.push(...encoder.encode(`IMPUESTOS: $${Number(data.venta?.total_impuestos || 0).toFixed(2)}\n`));
        cmds.push(...esc, 0x21, 0x30); // Grande
        cmds.push(...encoder.encode(`TOTAL: $${Number(data.venta?.total || 0).toFixed(2)}\n`));
        cmds.push(...esc, 0x21, 0x00);
    }

    // Pie de página Personalizado o Global
    if (!data.isCorte) {
        cmds.push(...esc, 0x61, 0x01); // Centrar
        cmds.push(...encoder.encode("\n"));
        if (data.sucursal && data.sucursal.ticket_footer) {
            const footerLines = data.sucursal.ticket_footer.split('\n');
            footerLines.forEach(l => {
                cmds.push(...encoder.encode(`${l.trim()}\n`));
            });
        } else {
            cmds.push(...encoder.encode("!GRACIAS POR SU COMPRA!\n"));
            cmds.push(...encoder.encode("VUELVA PRONTO\n"));
        }
    }

    // Pequeño feed para que el papel salga del cabezal térmico hacia la cuchilla (suelen ser 3-4 líneas)
    cmds.push(...encoder.encode("\n\n\n\n"));

    // Corte de papel parcial estandar (GS V 1) que no fuerza avance extra en impresoras chinas/genéricas
    cmds.push(...gs, 0x56, 0x01);

    return new Uint8Array(cmds);
}
