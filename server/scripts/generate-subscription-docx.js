/**
 * Generates docs/SUBSCRIPTION-DESIGN.docx from docs/SUBSCRIPTION-DESIGN.md
 * Run: node server/scripts/generate-subscription-docx.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');
const inputFile = path.join(rootDir, 'docs/SUBSCRIPTION-DESIGN.md');
const outputFile = path.join(rootDir, 'docs/SUBSCRIPTION-DESIGN.docx');

function parseMarkdownTable(lines) {
    const rows = [];
    for (const line of lines) {
        if (!line.trim().startsWith('|')) continue;
        if (/^\|[\s\-:|]+\|$/.test(line.trim())) continue;
        const cells = line
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());
        if (cells.length) rows.push(cells);
    }
    return rows;
}

function makeTable(rows) {
    if (!rows.length) return null;
    const colCount = Math.max(...rows.map((r) => r.length));
    const tableRows = rows.map((cells, rowIdx) => {
        const padded = [...cells];
        while (padded.length < colCount) padded.push('');
        return new TableRow({
            children: padded.map(
                (text) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text,
                                        bold: rowIdx === 0,
                                        size: 20,
                                    }),
                                ],
                            }),
                        ],
                        width: { size: Math.floor(100 / colCount), type: WidthType.PERCENTAGE },
                    })
            ),
        });
    });
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
        },
        rows: tableRows,
    });
}

function mdToDocxChildren(lines) {
    const children = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            i++;
            continue;
        }

        if (trimmed.startsWith('|')) {
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i]);
                i++;
            }
            const table = makeTable(parseMarkdownTable(tableLines));
            if (table) children.push(table);
            children.push(new Paragraph({ text: '' }));
            continue;
        }

        if (trimmed.startsWith('```')) {
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++;
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: codeLines.join('\n'),
                            font: 'Consolas',
                            size: 18,
                        }),
                    ],
                    spacing: { before: 120, after: 120 },
                })
            );
            continue;
        }

        if (trimmed.startsWith('### ')) {
            children.push(
                new Paragraph({
                    text: trimmed.slice(4),
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 200, after: 100 },
                })
            );
            i++;
            continue;
        }

        if (trimmed.startsWith('## ')) {
            children.push(
                new Paragraph({
                    text: trimmed.slice(3),
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 280, after: 140 },
                })
            );
            i++;
            continue;
        }

        if (trimmed.startsWith('# ')) {
            children.push(
                new Paragraph({
                    text: trimmed.slice(2),
                    heading: HeadingLevel.HEADING_1,
                    spacing: { after: 200 },
                })
            );
            i++;
            continue;
        }

        if (trimmed === '---') {
            i++;
            continue;
        }

        if (trimmed.startsWith('- [ ]')) {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: `☐ ${trimmed.slice(6)}`, size: 22 })],
                    spacing: { after: 60 },
                })
            );
            i++;
            continue;
        }

        if (trimmed.startsWith('- ')) {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: `• ${trimmed.slice(2)}`, size: 22 })],
                    spacing: { after: 80 },
                    indent: { left: 360 },
                })
            );
            i++;
            continue;
        }

        const runs = [];
        const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
        for (const part of parts) {
            if (part.startsWith('**') && part.endsWith('**')) {
                runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: 22 }));
            } else if (part) {
                runs.push(new TextRun({ text: part, size: 22 }));
            }
        }
        children.push(
            new Paragraph({
                children: runs.length ? runs : [new TextRun({ text: trimmed, size: 22 })],
                spacing: { after: 100 },
            })
        );
        i++;
    }

    return children;
}

async function main() {
    console.log('Reading', inputFile);
    const md = fs.readFileSync(inputFile, 'utf-8');
    const lines = md.split(/\r?\n/);
    const bodyChildren = mdToDocxChildren(lines);

    const doc = new Document({
        creator: 'User Monitor',
        title: 'Subscription & Billing Design',
        description: 'Developer design document for organization subscriptions',
        styles: {
            default: {
                document: {
                    run: { font: 'Calibri', size: 22 },
                },
            },
        },
        sections: [
            {
                properties: {},
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: 'User Monitor',
                                bold: true,
                                size: 28,
                                color: '1e40af',
                            }),
                        ],
                        spacing: { after: 80 },
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: 'Subscription & Billing — Technical Design',
                                bold: true,
                                size: 36,
                            }),
                        ],
                        spacing: { after: 120 },
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: 'For developer & product review  •  Version 1.0  •  May 2026',
                                size: 20,
                                color: '666666',
                            }),
                        ],
                        spacing: { after: 400 },
                    }),
                    ...bodyChildren,
                ],
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputFile, buffer);
    console.log('Written:', outputFile);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
