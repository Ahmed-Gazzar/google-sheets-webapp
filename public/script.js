// DOM elements
const loginSection = document.getElementById('loginSection');
const recordsSection = document.getElementById('recordsSection');
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const loadingMessage = document.getElementById('loadingMessage');
const userInfo = document.getElementById('userInfo');
const recordsContainer = document.getElementById('recordsContainer');
const recordsLoading = document.getElementById('recordsLoading');
const recordsTable = document.getElementById('recordsTable');
const noRecords = document.getElementById('noRecords');
const logoutBtn = document.getElementById('logoutBtn');
const submitBtn = document.getElementById('submitBtn');

// Current user data
let currentUser = null;

// API base URL
const API_BASE = '';

// Utility functions
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

function showLoading(show = true) {
    loadingMessage.style.display = show ? 'block' : 'none';
    submitBtn.disabled = show;
    submitBtn.textContent = show ? 'Validating...' : 'Login';
}

function showRecordsLoading(show = true) {
    recordsLoading.style.display = show ? 'block' : 'none';
}

// API functions
async function validateUser(id, phone) {
    try {
        const response = await fetch(`${API_BASE}/api/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, phone })
        });

        const data = await response.json();
        
        // Handle maintenance mode or outside hours
        if (data.maintenanceMode || data.status === 'outside_hours') {
            showError(data.message);
            
            // Show additional info for outside hours
            if (data.status === 'outside_hours') {
                const additionalInfo = data.activeHours ? 
                    ` (Active hours: ${data.activeHours})` : '';
                showError(data.message + additionalInfo);
            }
            
            return null;
        }
        
        if (!response.ok) {
            throw new Error(data.message || 'Validation failed');
        }

        return data;
    } catch (error) {
        throw error;
    }
}

async function fetchUserRecords(id) {
    try {
        const response = await fetch(`${API_BASE}/api/records/${id}`);
        const data = await response.json();
        
        // Handle maintenance mode or outside hours
        if (data.maintenanceMode || data.status === 'outside_hours') {
            throw new Error(data.message);
        }
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch records');
        }

        return data;
    } catch (error) {
        throw error;
    }
}

// UI functions
function displayUserInfo(user) {
    userInfo.innerHTML = `
        <div class="user-info-item">
            <span class="user-info-label">Student ID:</span>
            <span class="user-info-value">${user.id}</span>
        </div>
        <div class="user-info-item">
            <span class="user-info-label">Student Name:</span>
            <span class="user-info-value">${user.name || 'N/A'}</span>
        </div>
        <div class="user-info-item">
            <span class="user-info-label">Phone:</span>
            <span class="user-info-value">${user.phone}</span>
        </div>
    `;
}

function displayRecordsTable(records) {
    if (!records || records.length === 0) {
        recordsTable.style.display = 'none';
        noRecords.style.display = 'block';
        return;
    }

    const tableHTML = `
        <table class="records-table">
            <thead>
                <tr>
                    <th>Exam Number</th>
                    <th>Day</th>
                    <th>Educational Center</th>
                    <th>Exam Grade</th>
                    <th>Homework Status</th>
                </tr>
            </thead>
            <tbody>
                ${records.map(record => `
                    <tr>
                        <td>${record.examNumber}</td>
                        <td>${record.day}</td>
                        <td>${record.educationalCenter}</td>
                        <td>${record.examGrade}</td>
                        <td>${record.homeworkStatus}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    recordsTable.innerHTML = tableHTML;
    recordsTable.style.display = 'block';
    noRecords.style.display = 'none';
}

function showRecordsSection() {
    loginSection.style.display = 'none';
    recordsSection.style.display = 'block';
}

function showLoginSection() {
    loginSection.style.display = 'block';
    recordsSection.style.display = 'none';
    
    // Reset form
    loginForm.reset();
    errorMessage.style.display = 'none';
    loadingMessage.style.display = 'none';
    currentUser = null;
}

// Event handlers
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(loginForm);
    const id = formData.get('studentId').trim();
    let phone = formData.get('phone').trim();

    if (!id || !phone) {
        showError('Please enter both ID and Phone number');
        return;
    }

    // Auto-format phone number: add "2" prefix if phone starts with "0"
    if (phone.startsWith('0')) {
        phone = '2' + phone;
    }

    try {
        showLoading(true);
        errorMessage.style.display = 'none';

        // Validate user
        const validationResult = await validateUser(id, phone);
        
        // If maintenance mode or outside hours, validateUser returns null
        if (!validationResult) {
            return; // Error message already shown by validateUser
        }
        
        if (validationResult.success) {
            currentUser = validationResult.user;
            displayUserInfo(currentUser);
            showRecordsSection();
            
            // Load user records
            showRecordsLoading(true);
            try {
                const recordsResult = await fetchUserRecords(id);
                if (recordsResult.success) {
                    displayRecordsTable(recordsResult.records);
                }
            } catch (recordsError) {
                console.error('Error loading records:', recordsError);
                noRecords.style.display = 'block';
                recordsTable.style.display = 'none';
            } finally {
                showRecordsLoading(false);
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Login failed. Please try again.');
    } finally {
        showLoading(false);
    }
});

logoutBtn.addEventListener('click', () => {
    showLoginSection();
});

// System status check function
async function checkSystemStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);
        const data = await response.json();
        
        if (data.success) {
            if (data.maintenanceMode) {
                showError('System is currently under maintenance. Please try again later.');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Maintenance Mode';
            } else if (!data.withinActiveHours) {
                const activeHoursText = `${data.activeHours.start}:00 - ${data.activeHours.end}:00`;
                showError(`System is only available during active hours: ${activeHoursText}. Current time: ${data.currentHour}:00`);
                submitBtn.disabled = true;
                submitBtn.textContent = 'Outside Active Hours';
            }
        }
    } catch (error) {
        console.log('Status check failed:', error);
        // Don't show error to user, just log it
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Student Records System initialized');
    
    // Check system status on load
    checkSystemStatus();
    
    // Focus on the first input field
    document.getElementById('studentId').focus();
});

// Handle form input validation
document.getElementById('studentId').addEventListener('input', function(e) {
    // Remove any non-alphanumeric characters for ID
    this.value = this.value.replace(/[^a-zA-Z0-9]/g, '');
});

document.getElementById('phone').addEventListener('input', function(e) {
    // Allow only numbers and common phone number characters
    this.value = this.value.replace(/[^0-9+\-() ]/g, '');
});
