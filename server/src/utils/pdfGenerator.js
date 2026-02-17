import PDFDocument from 'pdfkit';

/**
 * Formats a date for display in the PDF
 */
function formatDate(d) {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formats a date (date only, no time)
 */
function formatDateOnly(d) {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Formats hours (decimal to HH:MM)
 */
function formatHours(h) {
    if (h == null || h === undefined) return '-';
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${hours}h ${mins}m`;
}

/**
 * Formats duration in minutes
 */
function formatDuration(mins) {
    if (mins == null || mins === undefined) return '-';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Generates a PDF report and returns it as a Buffer.
 * @param {Object} reportData - { rows: Array, orgName?: string, startDate?: string, endDate?: string }
 * @param {string} reportType - 'daily-summary' | 'break-usage' | 'screenshots'
 * @returns {Promise<Buffer>}
 */
export async function generateReportPDF(reportData, reportType) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];
        doc.on('data', chunks.push.bind(chunks));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const { rows = [], orgName = 'Company', startDate = '', endDate = '' } = reportData;
        const dateRange = startDate && endDate ? `${formatDateOnly(startDate)} - ${formatDateOnly(endDate)}` : 'All time';

        // Company header
        doc.fontSize(18).font('Helvetica-Bold').text(orgName, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Date Range: ${dateRange}`, { align: 'center' });
        doc.moveDown(1);

        // Report title
        const titles = {
            'daily-summary': 'Daily Summary Report',
            'break-usage': 'Break Usage Report',
            'screenshots': 'Screenshots Report'
        };
        doc.fontSize(14).font('Helvetica-Bold').text(titles[reportType] || 'Report');
        doc.moveDown(1);

        const tableTop = doc.y;
        const colWidths = {};
        const fontSize = 8;
        doc.fontSize(fontSize).font('Helvetica');

        if (reportType === 'daily-summary') {
            const cols = ['Date', 'User', 'Work Hours', 'Idle Hours', 'Break Time', 'Shift Start', 'Shift End'];
            colWidths[0] = 55;
            colWidths[1] = 80;
            colWidths[2] = 45;
            colWidths[3] = 45;
            colWidths[4] = 45;
            colWidths[5] = 55;
            colWidths[6] = 55;

            // Header row
            doc.font('Helvetica-Bold');
            let x = 50;
            cols.forEach((col, i) => {
                doc.text(col, x, tableTop, { width: colWidths[i] });
                x += colWidths[i];
            });
            doc.font('Helvetica');
            let y = tableTop + 18;

            rows.forEach((row) => {
                const date = formatDateOnly(row.work_date);
                const user = (row.user_name || '-').toString().slice(0, 20);
                const workHours = formatHours(row.work_hours);
                const idleHours = formatHours(row.idle_hours);
                const breakTime = formatHours((row.break_seconds || 0) / 3600);
                const shiftStart = formatDate(row.shift_start);
                const shiftEnd = formatDate(row.shift_end);

                x = 50;
                [date, user, workHours, idleHours, breakTime, shiftStart, shiftEnd].forEach((val, i) => {
                    doc.text(String(val), x, y, { width: colWidths[i], ellipsis: true });
                    x += colWidths[i];
                });
                y += 16;
            });
        } else if (reportType === 'break-usage') {
            const cols = ['User', 'Break Type', 'Start Time', 'End Time', 'Duration'];
            colWidths[0] = 90;
            colWidths[1] = 80;
            colWidths[2] = 90;
            colWidths[3] = 90;
            colWidths[4] = 55;

            doc.font('Helvetica-Bold');
            let x = 50;
            cols.forEach((col, i) => {
                doc.text(col, x, tableTop, { width: colWidths[i] });
                x += colWidths[i];
            });
            doc.font('Helvetica');
            let y = tableTop + 18;

            rows.forEach((row) => {
                const user = (row.user_name || '-').toString().slice(0, 25);
                const breakType = (row.break_type || '-').toString().slice(0, 20);
                const startTime = formatDate(row.start_time);
                const endTime = formatDate(row.end_time);
                const duration = formatDuration(row.duration_minutes);

                x = 50;
                [user, breakType, startTime, endTime, duration].forEach((val, i) => {
                    doc.text(String(val), x, y, { width: colWidths[i], ellipsis: true });
                    x += colWidths[i];
                });
                y += 16;
            });
        } else if (reportType === 'screenshots') {
            const cols = ['User', 'Captured At', 'File Path'];
            colWidths[0] = 100;
            colWidths[1] = 120;
            colWidths[2] = 255;

            doc.font('Helvetica-Bold');
            let x = 50;
            cols.forEach((col, i) => {
                doc.text(col, x, tableTop, { width: colWidths[i] });
                x += colWidths[i];
            });
            doc.font('Helvetica');
            let y = tableTop + 18;

            rows.forEach((row) => {
                const user = (row.user_name || '-').toString().slice(0, 25);
                const capturedAt = formatDate(row.captured_at);
                const filePath = (row.file_path || '-').toString().slice(0, 50);

                x = 50;
                [user, capturedAt, filePath].forEach((val, i) => {
                    doc.text(String(val), x, y, { width: colWidths[i], ellipsis: true });
                    x += colWidths[i];
                });
                y += 16;
            });
        } else {
            doc.text('Unknown report type.', 50, tableTop);
        }

        // Footer - generated timestamp
        doc.fontSize(8).font('Helvetica');
        doc.text(
            `Generated: ${new Date().toLocaleString('en-US')}`,
            50,
            doc.page.height - 40,
            { align: 'center', width: doc.page.width - 100 }
        );

        doc.end();
    });
}
