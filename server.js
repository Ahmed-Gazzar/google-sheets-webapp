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

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
