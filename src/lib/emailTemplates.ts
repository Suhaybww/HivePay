// Design System Constants
export const theme = {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    primaryColor: "#facc15", 
    textColor: "#000000", // Black for better readability
    subtleBg: "#F9FAFB", // Gray-50
    borderColor: "#E5E7EB", // Gray-200
    headingColor: "#111827", // Gray-900
    footerColor: "#6B7280", // Gray-500
    successColor: "#059669", // Green-600
    warningColor: "#D97706", // Yellow-600
    errorColor: "#DC2626", // Red-600
    borderRadius: "8px",
    shadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
};

const logoUrl = 'https://hivepay.com.au/images/NB.png'; 

export const baseTemplate = (content: string, preheader?: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <style>
        @media (max-width: 600px) {
            .container {
                margin: 10px !important;
                padding: 15px !important;
            }
        }
    </style>
</head>
<body style="margin: 0; padding: 20px; background: #f3f4f6;">
    ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}
    
    <div class="container" style="
        max-width: 600px;
        margin: 0 auto;
        background: white;
        border-radius: ${theme.borderRadius};
        box-shadow: ${theme.shadow};
        overflow: hidden;
    ">
        <div style="
            padding: 24px;
            background: ${theme.primaryColor};
            color: white;
            text-align: center;
        ">
            <img src="${logoUrl}" alt="HivePay Logo" style="
                width: 120px;
                height: auto;
                margin-bottom: 16px;
            ">
            <p style="
                margin: 4px 0 0;
                font-size: 16px; /* Increased font size */
                font-weight: 600; /* Bold font weight */
                opacity: 1; /* Full opacity */
            ">
                Group Savings Simplified
            </p>
        </div>
    
        ${content}
    
        <div style="
            padding: 24px;
            text-align: center;
            border-top: 1px solid ${theme.borderColor};
            color: ${theme.footerColor};
            font-size: 12px;
        ">
            <p style="margin: 0;">
                © ${new Date().getFullYear()} HivePay Pty Ltd<br>
                Melbourne, Australia<br>
                <a href="https://hivepay.com.au" style="
                    color: ${theme.primaryColor};
                    text-decoration: none;
                ">Visit Website</a>
            </p>
        </div>
    </div>
</body>
</html>
`;

/**
 * Content Section Component
 */
export const contentSection = (content: string) => `
<div style="
    padding: 24px;
    font-size: 15px;
    line-height: 1.5;
    color: ${theme.textColor}; /* Black text color */
">
    ${content}
</div>
`;

/**
 * Alert Component
 */
export const alertBox = (content: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const colors = {
        info: { bg: "#E0F2FE", text: "#0369A1" }, // Blue-100 and Blue-700
        success: { bg: "#D1FAE5", text: "#059669" }, // Green-100 and Green-600
        warning: { bg: "#FEF3C7", text: "#D97706" }, // Yellow-100 and Yellow-600
        error: { bg: "#FEE2E2", text: "#DC2626" } // Red-100 and Red-600
    }[type];

    return `
    <div style="
        padding: 16px;
        background: ${colors.bg};
        color: ${colors.text};
        border-radius: 6px;
        margin: 16px 0;
        font-size: 14px;
    ">
        ${content}
    </div>
    `;
};

/**
 * Action Button Component
 */
export const actionButton = (text: string, url: string) => `
<div style="text-align: center; margin: 24px 0;">
    <a href="${url}" style="
        display: inline-block;
        padding: 12px 24px;
        background: ${theme.primaryColor};
        color: white !important;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 500;
    ">${text}</a>
</div>
`;