import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputFile = path.join(__dirname, '../../PROJECT-INFO.md');
const outputFile = path.join(__dirname, '../../PROJECT-DOCS.pdf');

async function createPDF() {
    console.log('Generating professional PDF from PROJECT-INFO.md...');

    const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        bufferPages: true
    });

    const stream = fs.createWriteStream(outputFile);
    doc.pipe(stream);

    // Read the markdown file
    const content = fs.readFileSync(inputFile, 'utf-8');
    const lines = content.split('\n');

    // PDF Styling constants
    const colors = {
        primary: '#1e40af',    // Blue
        secondary: '#3b82f6',  // Lighter Blue
        text: '#333333',
        muted: '#666666',
        highlight: '#111111',
        border: '#e2e8f0'
    };

    // Helper: Add Footer to all pages
    const addFooters = () => {
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);

            // Footer separator
            doc.moveTo(50, doc.page.height - 50)
                .lineTo(doc.page.width - 50, doc.page.height - 50)
                .strokeColor(colors.border)
                .stroke();

            doc.fontSize(8)
                .fillColor(colors.muted)
                .text(
                    `© 2026 User Monitor System | Professional Internal Documentation | Page ${i + 1} of ${pages.count}`,
                    50,
                    doc.page.height - 40,
                    { align: 'center', width: doc.page.width - 100 }
                );
        }
    };

    // Header Title
    doc.fillColor(colors.highlight)
        .font('Helvetica-Bold')
        .fontSize(26)
        .text('User Monitor System', { align: 'center' });

    doc.moveDown(0.2);
    doc.fontSize(12)
        .font('Helvetica-Oblique')
        .fillColor(colors.muted)
        .text('Official Project Overview & Feature Documentation', { align: 'center' });

    doc.moveDown(1.5);

    // Process lines
    lines.forEach(line => {
        const trimmed = line.trim();

        // Horizontal Rules
        if (trimmed === '---') {
            doc.moveDown(0.5);
            doc.moveTo(50, doc.y)
                .lineTo(doc.page.width - 50, doc.y)
                .strokeColor(colors.border)
                .stroke();
            doc.moveDown(0.8);
            return;
        }

        // Headers
        if (trimmed.startsWith('# ')) {
            // Already handled the main title, but for any other #
            if (doc.y > doc.page.height - 100) doc.addPage();
            doc.moveDown(1)
                .fillColor(colors.highlight)
                .font('Helvetica-Bold')
                .fontSize(20)
                .text(trimmed.replace('# ', '').replace(/^[^\w\s]*\s*/, '')); // Strip emojis
            doc.moveDown(0.5);
        } else if (trimmed.startsWith('## ')) {
            if (doc.y > doc.page.height - 100) doc.addPage();
            doc.moveDown(1)
                .fillColor(colors.primary)
                .font('Helvetica-Bold')
                .fontSize(16)
                .text(trimmed.replace('## ', '').replace(/^[^\w\s]*\s*/, ''));
            doc.moveDown(0.4);
        } else if (trimmed.startsWith('### ')) {
            if (doc.y > doc.page.height - 80) doc.addPage();
            doc.moveDown(0.8)
                .fillColor(colors.highlight)
                .font('Helvetica-Bold')
                .fontSize(13)
                .text(trimmed.replace('### ', '').replace(/^[^\w\s]*\s*/, ''));
            doc.moveDown(0.3);
        }
        // Bullet Points
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const text = trimmed.substring(2);
            doc.fillColor(colors.text)
                .font('Helvetica')
                .fontSize(10.5);

            // Check if it has bold parts like **text**:
            if (text.includes('**')) {
                const parts = text.split('**');
                let currentX = 70;
                doc.text('•', 55, doc.y, { continued: false });

                parts.forEach((part, index) => {
                    const isBold = index % 2 !== 0;
                    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
                        .text(part, 70, doc.y, { continued: index < parts.length - 1 });
                });
                doc.text(''); // New line after the whole bullet
            } else {
                doc.text(`• ${text}`, 55, doc.y, { width: doc.page.width - 105 });
            }
            doc.moveDown(0.2);
        }
        // Numbered List
        else if (/^\d+\.\s/.test(trimmed)) {
            const text = trimmed.replace(/^\d+\.\s+/, '');
            doc.fillColor(colors.text)
                .font('Helvetica')
                .fontSize(10.5);

            if (text.includes('**')) {
                const parts = text.split('**');
                const num = trimmed.match(/^\d+/)[0];
                doc.font('Helvetica-Bold').text(`${num}. `, 55, doc.y, { continued: true });
                parts.forEach((part, index) => {
                    const isBold = index % 2 !== 0;
                    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
                        .text(part, { continued: index < parts.length - 1 });
                });
                doc.text('');
            } else {
                doc.text(trimmed, 55, doc.y, { width: doc.page.width - 105 });
            }
            doc.moveDown(0.2);
        }
        // Paragraphs
        else if (trimmed.length > 0) {
            doc.fillColor(colors.text)
                .font('Helvetica')
                .fontSize(10.5);

            let text = trimmed;
            // Handle simple bold in paragraph
            if (text.includes('**')) {
                const parts = text.split('**');
                parts.forEach((part, index) => {
                    const isBold = index % 2 !== 0;
                    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
                        .text(part, { continued: index < parts.length - 1 });
                });
                doc.text('');
            } else {
                doc.text(text, { width: doc.page.width - 100, align: 'justify' });
            }
            doc.moveDown(0.5);
        }
    });

    // Add footers before ending
    addFooters();
    doc.end();

    stream.on('finish', () => {
        console.log(`Success! PDF documentation generated at: ${outputFile}`);
    });
}

createPDF().catch(err => {
    console.error('Error generating PDF:', err);
    process.exit(1);
});
