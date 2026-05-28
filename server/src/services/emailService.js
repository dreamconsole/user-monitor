import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        console.warn('[Email] SMTP not configured. Emails will be logged to console only.');
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }
    });

    transporter.verify((err) => {
        if (err) console.error('[Email] SMTP connection failed:', err.message);
        else console.log('[Email] SMTP connected successfully');
    });

    return transporter;
}

const FROM = () => process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@usermonitor.com';
const APP_NAME = () => process.env.APP_NAME || 'User Monitor';
const APP_URL = () => process.env.APP_URL || 'http://localhost:5173';

function baseTemplate(title, bodyContent) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">
                    <tr>
                        <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 40px;text-align:center;">
                            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">${APP_NAME()}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:40px;">
                            ${bodyContent}
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                            <p style="color:#94a3b8;font-size:12px;margin:0;">
                                This email was sent by ${APP_NAME()}. If you didn't expect this email, please ignore it.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

function buttonHtml(text, url, color = '#2563eb') {
    return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
            <td style="background-color:${color};border-radius:8px;padding:14px 32px;">
                <a href="${url}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;display:inline-block;">${text}</a>
            </td>
        </tr>
    </table>`;
}

export async function sendMail({ to, subject, html }) {
    const smtp = getTransporter();

    const logMsg = `[Email] To: ${to} | Subject: ${subject}`;

    if (!smtp) {
        console.log(`${logMsg} (SMTP not configured, email not sent)`);
        return { success: false, reason: 'smtp_not_configured' };
    }

    try {
        const result = await smtp.sendMail({
            from: `"${APP_NAME()}" <${FROM()}>`,
            to,
            subject,
            html
        });
        console.log(`${logMsg} | MessageId: ${result.messageId}`);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error(`${logMsg} | Error: ${error.message}`);
        return { success: false, reason: error.message };
    }
}

// ──────────────── Email Templates ────────────────

export async function sendWelcomeEmail({ to, userName, orgName, tempPassword, loginUrl }) {
    const url = loginUrl || `${APP_URL()}/login`;
    const hasPassword = !!tempPassword;

    const html = baseTemplate('Welcome', `
        <h2 style="color:#1e293b;margin:0 0 16px;">Welcome to ${APP_NAME()}!</h2>
        <p style="color:#475569;font-size:15px;line-height:1.6;">
            Hi <strong>${userName}</strong>,
        </p>
        <p style="color:#475569;font-size:15px;line-height:1.6;">
            Your account has been created by <strong>${orgName}</strong>. You can now log in and start tracking your productivity.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f9ff;border-radius:8px;margin:20px 0;border:1px solid #bae6fd;">
            <tr>
                <td style="padding:20px;">
                    <p style="color:#0c4a6e;margin:0 0 8px;font-size:14px;"><strong>Your login details:</strong></p>
                    <p style="color:#0369a1;margin:0;font-size:14px;">Email: <strong>${to}</strong></p>
                    ${hasPassword ? `<p style="color:#0369a1;margin:4px 0 0;font-size:14px;">Temporary Password: <strong>${tempPassword}</strong></p>` : ''}
                </td>
            </tr>
        </table>
        ${hasPassword ? '<p style="color:#dc2626;font-size:13px;">Please change your password after your first login.</p>' : ''}
        ${buttonHtml('Log In Now', url)}
        <p style="color:#94a3b8;font-size:13px;">
            If the button doesn't work, copy this link: <a href="${url}" style="color:#2563eb;">${url}</a>
        </p>
    `);

    return sendMail({ to, subject: `Welcome to ${APP_NAME()} - Your Account is Ready`, html });
}

export async function sendPasswordResetEmail({ to, userName, resetToken, resetUrl }) {
    const url = resetUrl || `${APP_URL()}/reset-password?token=${resetToken}`;

    const html = baseTemplate('Password Reset', `
        <h2 style="color:#1e293b;margin:0 0 16px;">Reset Your Password</h2>
        <p style="color:#475569;font-size:15px;line-height:1.6;">
            Hi <strong>${userName}</strong>,
        </p>
        <p style="color:#475569;font-size:15px;line-height:1.6;">
            We received a request to reset your password. Click the button below to set a new password.
        </p>
        ${buttonHtml('Reset Password', url, '#dc2626')}
        <p style="color:#94a3b8;font-size:13px;">
            If the button doesn't work, copy this link: <a href="${url}" style="color:#2563eb;">${url}</a>
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-radius:8px;margin:20px 0;border:1px solid #fecaca;">
            <tr>
                <td style="padding:16px 20px;">
                    <p style="color:#991b1b;margin:0;font-size:13px;">
                        This link will expire in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.
                    </p>
                </td>
            </tr>
        </table>
    `);

    return sendMail({ to, subject: `${APP_NAME()} - Password Reset Request`, html });
}

export async function sendSecurityAlertEmail({ to, userName, loginTime, ipAddress, userAgent, location }) {
    const time = loginTime || new Date().toLocaleString();

    const html = baseTemplate('Security Alert', `
        <h2 style="color:#1e293b;margin:0 0 16px;">New Login Detected</h2>
        <p style="color:#475569;font-size:15px;line-height:1.6;">
            Hi <strong>${userName}</strong>,
        </p>
        <p style="color:#475569;font-size:15px;line-height:1.6;">
            We detected a new login to your account. If this was you, no action is needed.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border-radius:8px;margin:20px 0;border:1px solid #fde68a;">
            <tr>
                <td style="padding:20px;">
                    <p style="color:#92400e;margin:0 0 8px;font-size:14px;"><strong>Login Details:</strong></p>
                    <p style="color:#78350f;margin:0;font-size:14px;">Time: <strong>${time}</strong></p>
                    ${ipAddress ? `<p style="color:#78350f;margin:4px 0 0;font-size:14px;">IP Address: <strong>${ipAddress}</strong></p>` : ''}
                    ${userAgent ? `<p style="color:#78350f;margin:4px 0 0;font-size:14px;">Device: <strong>${userAgent}</strong></p>` : ''}
                    ${location ? `<p style="color:#78350f;margin:4px 0 0;font-size:14px;">Location: <strong>${location}</strong></p>` : ''}
                </td>
            </tr>
        </table>
        <p style="color:#dc2626;font-size:14px;line-height:1.6;">
            <strong>If this wasn't you</strong>, please change your password immediately and contact your administrator.
        </p>
        ${buttonHtml('Change Password', `${APP_URL()}/login`, '#f59e0b')}
    `);

    return sendMail({ to, subject: `${APP_NAME()} - New Login to Your Account`, html });
}

export async function sendPasswordChangedEmail({ to, userName }) {
    const html = baseTemplate('Password Changed', `
        <h2 style="color:#1e293b;margin:0 0 16px;">Password Changed Successfully</h2>
        <p style="color:#475569;font-size:15px;line-height:1.6;">
            Hi <strong>${userName}</strong>,
        </p>
        <p style="color:#475569;font-size:15px;line-height:1.6;">
            Your password has been changed successfully. If you did this, no further action is needed.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-radius:8px;margin:20px 0;border:1px solid #fecaca;">
            <tr>
                <td style="padding:16px 20px;">
                    <p style="color:#991b1b;margin:0;font-size:13px;">
                        If you did <strong>not</strong> change your password, please contact your administrator immediately.
                    </p>
                </td>
            </tr>
        </table>
    `);

    return sendMail({ to, subject: `${APP_NAME()} - Your Password Was Changed`, html });
}

export async function sendAdminPasswordResetEmail({ to, userName, adminName }) {
    const html = baseTemplate('Password Reset by Admin', `
        <h2 style="color:#1e293b;margin:0 0 16px;">Your Password Was Reset</h2>
        <p style="color:#475569;font-size:15px;line-height:1.6;">
            Hi <strong>${userName}</strong>,
        </p>
        <p style="color:#475569;font-size:15px;line-height:1.6;">
            Your password has been reset by <strong>${adminName}</strong>. Please contact your administrator for your new login credentials.
        </p>
        ${buttonHtml('Log In', `${APP_URL()}/login`)}
    `);

    return sendMail({ to, subject: `${APP_NAME()} - Your Password Has Been Reset`, html });
}
