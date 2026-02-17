import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Exporta datos a un archivo Excel (.xlsx)
 */
export const exportToExcel = (data, fileName = 'reporte', sheetName = 'Datos') => {
    try {
        if (!data || data.length === 0) {
            alert('No hay datos para exportar');
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, `${fileName}_${formatDate()}.xlsx`);
    } catch (error) {
        console.error("Error al exportar Excel:", error);
        alert("No se pudo generar el archivo Excel");
    }
};

/**
 * Exporta datos a un archivo PDF (.pdf)
 */
export const exportToPDF = ({ title, headers, data, fileName = 'reporte', orientation = 'portrait' }) => {
    try {
        if (!data || data.length === 0) {
            alert('No hay datos para exportar');
            return;
        }
        const doc = new jsPDF(orientation);
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header con gradiente simulado
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, pageWidth, 25, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, 16);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generado: ${new Date().toLocaleString('es-GT')}`, pageWidth - 14, 16, { align: 'right' });

        // Tabla
        autoTable(doc, {
            startY: 35,
            head: [headers],
            body: data,
            theme: 'striped',
            headStyles: {
                fillColor: [79, 70, 229],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            styles: { fontSize: 9, cellPadding: 3 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { top: 35, left: 14, right: 14 },
        });

        // Footer con páginas
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
        }

        doc.save(`${fileName}_${formatDate()}.pdf`);
    } catch (error) {
        console.error("Error al exportar PDF:", error);
        alert("No se pudo generar el archivo PDF");
    }
};

/**
 * Exportar datos del Dashboard
 */
export const exportDashboardData = (dashboardData, format = 'excel', tiendaName = 'Almacén Central', timeRange = 'month') => {
    const {
        totalProducts = 0,
        totalRevenue = 0,
        totalProfit = 0,
        totalCost = 0,
        totalOrders = 0,
        lowStockProducts = [],
        topProductos = [],
        ventasPorCategoria = []
    } = dashboardData;

    const periodos = { day: 'Hoy', week: 'Semana', month: 'Mes', year: 'Año' };
    const periodoStr = periodos[timeRange] || timeRange;
    const reportTitle = `Reporte Dashboard - ${tiendaName} (${periodoStr})`;

    if (format === 'excel') {
        const workbook = XLSX.utils.book_new();

        // Hoja de Resumen
        const summaryData = [
            { 'Tienda': tiendaName, 'Periodo': periodoStr, 'Generado': new Date().toLocaleString() },
            {},
            { 'Métrica': 'Total Productos', 'Valor': totalProducts },
            { 'Métrica': 'Ingresos Totales', 'Valor': `$${totalRevenue?.toFixed(2)}` },
            { 'Métrica': 'Ganancia', 'Valor': `$${totalProfit?.toFixed(2)}` },
            { 'Métrica': 'Costo Total', 'Valor': `$${totalCost?.toFixed(2)}` },
            { 'Métrica': 'Total Ventas', 'Valor': totalOrders },
        ];
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryData), 'Resumen');

        // Hoja de Stock Bajo
        if (lowStockProducts.length > 0) {
            const stockData = lowStockProducts.map(p => ({
                'Producto': p.nombre,
                'Categoría': p.categoria || 'N/A',
                'Stock Actual': p.cantidad,
                'Stock Mínimo': p.stock_minimo || 5,
                'Estado': p.cantidad === 0 ? 'AGOTADO' : 'BAJO'
            }));
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(stockData), 'Stock Bajo');
        }

        // Hoja de Top Productos
        if (topProductos.length > 0) {
            const topData = topProductos.map(p => ({
                'Producto': p.nombre,
                'Unidades': p.unidades_vendidas,
                'Total': `$${parseFloat(p.total || 0).toFixed(2)}`
            }));
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(topData), 'Top Productos');
        }

        // Hoja de Ventas por Categoría
        if (ventasPorCategoria.length > 0) {
            const catData = ventasPorCategoria.map(c => ({
                'Categoría': c.categoria,
                'Total': `$${parseFloat(c.total || 0).toFixed(2)}`
            }));
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(catData), 'Por Categoría');
        }

        XLSX.writeFile(workbook, `dashboard_${tiendaName.replace(/\s+/g, '_')}_${timeRange}_${formatDate()}.xlsx`);
    } else {
        // PDF
        const doc = new jsPDF('landscape');
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, pageWidth, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(reportTitle, 14, 16);
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleString()}`, pageWidth - 14, 16, { align: 'right' });

        // Resumen
        doc.setTextColor(0, 0, 0);
        autoTable(doc, {
            body: [
                ['Total Productos', totalProducts],
                ['Ingresos Totales', `$${totalRevenue?.toFixed(2)}`],
                ['Ganancia', `$${totalProfit?.toFixed(2)}`],
                ['Costo Total', `$${totalCost?.toFixed(2)}`],
                ['Total Ventas', totalOrders],
            ],
            startY: 35,
            theme: 'grid',
            styles: { fontSize: 10 },
            columnStyles: { 0: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            margin: { left: 14 },
            tableWidth: 80,
        });

        // Stock bajo
        if (lowStockProducts.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Productos con Stock Bajo', 110, 40);

            autoTable(doc, {
                head: [['Producto', 'Stock', 'Mínimo']],
                body: lowStockProducts.slice(0, 8).map(p => [p.nombre, p.cantidad, p.stock_minimo || 5]),
                startY: 45,
                headStyles: { fillColor: [239, 68, 68] },
                margin: { left: 110 },
                tableWidth: 90,
            });
        }

        doc.save(`dashboard_${tiendaName.replace(/\s+/g, '_')}_${timeRange}_${formatDate()}.pdf`);
    }
};

const formatDate = () => new Date().toISOString().split('T')[0];
