import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query } from '../db.js';
import {
    fetchDailySummaryData,
    fetchBreakUsageData,
    fetchScreenshotsData
} from '../controllers/reportController.js';
import { generateReportPDF } from '../utils/pdfGenerator.js';

const router = express.Router();
const VALID_REPORT_TYPES = ['daily-summary', 'break-usage', 'screenshots'];

/**
 * GET /exports/pdf/:reportType
 * Query params: startDate, endDate, userId (optional)
 * Returns PDF file
 */
router.get('/pdf/:reportType', authenticateToken, async (req, res) => {
    const { reportType } = req.params;
    const { startDate, endDate, userId } = req.query;

    if (!VALID_REPORT_TYPES.includes(reportType)) {
        return res.status(400).json({ error: 'Invalid report type' });
    }

    try {
        let rows;
        if (reportType === 'daily-summary') {
            rows = await fetchDailySummaryData(req);
        } else if (reportType === 'break-usage') {
            rows = await fetchBreakUsageData(req);
        } else {
            rows = await fetchScreenshotsData(req);
        }

        let orgName = 'Company';
        try {
            const orgResult = await query('SELECT name FROM organizations WHERE id = $1', [req.user.org_id]);
            if (orgResult.rows.length > 0) {
                orgName = orgResult.rows[0].name || orgName;
            }
        } catch {
            // Use default orgName
        }

        const reportData = {
            rows,
            orgName,
            startDate: startDate || '',
            endDate: endDate || ''
        };

        const pdfBuffer = await generateReportPDF(reportData, reportType);

        const filename = `report-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF export error:', error);
        res.status(500).json({ error: 'Failed to generate PDF report' });
    }
});

export default router;
