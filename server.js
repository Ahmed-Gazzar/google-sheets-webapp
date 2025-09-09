const express = require('express');
const cors = require('cors');
const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Maintenance mode and working hours configuration
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';
const MAINTENANCE_MESSAGE = process.env.MAINTENANCE_MESSAGE || 'System is temporarily unavailable for maintenance.';
const ACTIVE_START_HOUR = parseInt(process.env.ACTIVE_START_HOUR) || 11;
const ACTIVE_END_HOUR = parseInt(process.env.ACTIVE_END_HOUR) || 23;
const ACTIVE_MESSAGE = process.env.ACTIVE_MESSAGE || 'System is not available at this time.';

// Function to check if current time is within active hours
function isWithinActiveHours() {
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= ACTIVE_START_HOUR && currentHour <= ACTIVE_END_HOUR;
}

// Middleware to check maintenance mode and working hours
app.use((req, res, next) => {
    // Skip check for admin routes and static files
    if (req.path.includes('/admin') || req.path.includes('.')) {
        return next();
    }

    // Check maintenance mode
    if (MAINTENANCE_MODE) {
        return res.status(503).json({
            success: false,
            message: MAINTENANCE_MESSAGE,
            maintenanceMode: true,
            status: 'maintenance'
        });
    }

    // Check working hours
    if (!isWithinActiveHours()) {
        return res.status(503).json({
            success: false,
            message: ACTIVE_MESSAGE,
            maintenanceMode: false,
            status: 'outside_hours',
            currentHour: new Date().getHours(),
            activeHours: `${ACTIVE_START_HOUR}:00 - ${ACTIVE_END_HOUR}:00`
        });
    }

    next();
});

// Utility function to fetch and parse Excel data from Google Sheets
async function fetchSheetData(url) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'arraybuffer'
        });
        
        const workbook = XLSX.read(response.data, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        return data;
    } catch (error) {
        console.error('Error fetching sheet data:', error.message);
        throw new Error('Failed to fetch sheet data');
    }
}

// API Routes

// Validate user ID and Phone
app.post('/api/validate', async (req, res) => {
    try {
        const { id, phone } = req.body;
        
        if (!id || !phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'ID and Phone are required' 
            });
        }

        // Fetch database sheet
        const databaseData = await fetchSheetData(process.env.DATABASE_SHEET_URL);
        
        // Find user in database
        const user = databaseData.find(row => 
            row.ID && row.Phone && 
            row.ID.toString() === id.toString() && 
            row.Phone.toString() === phone.toString()
        );

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Either the ID or the Phone is Wrong' 
            });
        }

        res.json({
            success: true,
            user: {
                id: user.ID,
                name: user.Name,
                phone: user.Phone
            }
        });

    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during validation' 
        });
    }
});

// Get records for a specific ID
app.get('/api/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ 
                success: false, 
                message: 'ID parameter is required' 
            });
        }

        // Fetch records sheet
        const recordsData = await fetchSheetData(process.env.RECORDS_SHEET_URL);
        
        // Filter records for the specific ID and sort by Exam Number
        const userRecords = recordsData
            .filter(row => row['Student ID'] && row['Student ID'].toString() === id.toString())
            .sort((a, b) => {
                const examNumA = parseInt(a['Exam Number']) || 0;
                const examNumB = parseInt(b['Exam Number']) || 0;
                return examNumA - examNumB;
            })
            .map((record, index) => ({
                number: index + 1,
                examNumber: record['Exam Number'] || '',
                day: record['Day'] || '',
                educationalCenter: record['Educational Center'] || '',
                examGrade: record['Exam Grade'] || '',
                homeworkStatus: record['Homework Status'] || ''
            }));

        res.json({
            success: true,
            records: userRecords
        });

    } catch (error) {
        console.error('Records fetch error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching records' 
        });
    }
});

// Admin Panel Routes
app.get('/admin', (req, res) => {
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const isActive = isWithinActiveHours();
    const isMaintenance = MAINTENANCE_MODE;
    
    let statusClass, statusText;
    if (isMaintenance) {
        statusClass = 'maintenance';
        statusText = 'MAINTENANCE MODE';
    } else if (!isActive) {
        statusClass = 'outside-hours';
        statusText = `OUTSIDE ACTIVE HOURS (Current: ${currentHour}:00)`;
    } else {
        statusClass = 'active';
        statusText = 'SYSTEM ACTIVE';
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>System Control Panel</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    padding: 20px; 
                    max-width: 800px; 
                    margin: 0 auto; 
                    background: #f5f5f5;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h1 { color: #333; text-align: center; margin-bottom: 30px; }
                .status { 
                    padding: 15px; 
                    margin: 20px 0; 
                    border-radius: 8px; 
                    text-align: center;
                    font-weight: bold;
                    font-size: 18px;
                }
                .active { background: #d4edda; color: #155724; border: 2px solid #c3e6cb; }
                .maintenance { background: #f8d7da; color: #721c24; border: 2px solid #f5c6cb; }
                .outside-hours { background: #fff3cd; color: #856404; border: 2px solid #ffeaa7; }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin: 20px 0;
                }
                .info-card {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 6px;
                    border-left: 4px solid #007cba;
                }
                .info-card h3 { margin: 0 0 10px 0; color: #333; }
                .info-card p { margin: 5px 0; color: #666; }
                input, textarea, select, button { 
                    padding: 12px; 
                    margin: 8px 0; 
                    width: 100%; 
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                }
                button { 
                    background: #007cba; 
                    color: white; 
                    border: none; 
                    cursor: pointer; 
                    font-weight: bold;
                    transition: background 0.3s;
                }
                button:hover { background: #005a8a; }
                .form-group { margin: 15px 0; }
                label { font-weight: 600; color: #333; display: block; margin-bottom: 5px; }
                @media (max-width: 600px) {
                    .info-grid { grid-template-columns: 1fr; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔧 System Control Panel</h1>
                
                <div class="status ${statusClass}">
                    ${statusText}
                </div>
                
                <div class="info-grid">
                    <div class="info-card">
                        <h3>⚙️ Current Settings</h3>
                        <p><strong>Maintenance Mode:</strong> ${MAINTENANCE_MODE ? 'ON' : 'OFF'}</p>
                        <p><strong>Active Hours:</strong> ${ACTIVE_START_HOUR}:00 - ${ACTIVE_END_HOUR}:00</p>
                        <p><strong>Current Time:</strong> ${currentTime.toLocaleString()}</p>
                    </div>
                    <div class="info-card">
                        <h3>📊 System Status</h3>
                        <p><strong>Current Hour:</strong> ${currentHour}:00</p>
                        <p><strong>Within Hours:</strong> ${isActive ? 'Yes' : 'No'}</p>
                        <p><strong>Server:</strong> Running</p>
                    </div>
                </div>

                <div style="background: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3>📝 Instructions</h3>
                    <p>To control the system, update these environment variables in Railway:</p>
                    <ul>
                        <li><code>MAINTENANCE_MODE</code> = "true" or "false"</li>
                        <li><code>ACTIVE_START_HOUR</code> = Start hour (0-23)</li>
                        <li><code>ACTIVE_END_HOUR</code> = End hour (0-23)</li>
                        <li><code>MAINTENANCE_MESSAGE</code> = Custom maintenance message</li>
                        <li><code>ACTIVE_MESSAGE</code> = Custom outside hours message</li>
                    </ul>
                    <p><em>Changes take effect immediately after updating variables in Railway.</em></p>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                    <a href="/" style="
                        display: inline-block;
                        padding: 12px 30px;
                        background: #28a745;
                        color: white;
                        text-decoration: none;
                        border-radius: 6px;
                        font-weight: bold;
                    ">🏠 Back to Main App</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// System status API endpoint
app.get('/api/status', (req, res) => {
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const isActive = isWithinActiveHours();
    
    res.json({
        success: true,
        maintenanceMode: MAINTENANCE_MODE,
        withinActiveHours: isActive,
        currentHour: currentHour,
        activeHours: {
            start: ACTIVE_START_HOUR,
            end: ACTIVE_END_HOUR
        },
        status: MAINTENANCE_MODE ? 'maintenance' : (isActive ? 'active' : 'outside_hours'),
        timestamp: currentTime.toISOString()
    });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
