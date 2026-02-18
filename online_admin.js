// Online Database Integration for Admin Panel
// Replace localStorage functions with API calls

// Configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : 'https://cnc-auto-admin.onrender.com/api';
const API_KEY = process.env.CNC_API_KEY || 'cnc_auto_design_2025_online';

// Admin session management
let adminToken = localStorage.getItem('adminToken') || '';

// API helper functions
async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            }
        };
        
        if (adminToken) {
            options.headers['Authorization'] = `Bearer ${adminToken}`;
        }
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'API call failed');
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Admin login
async function adminLogin(email) {
    try {
        const result = await apiCall('/admin/login', 'POST', { email });
        if (result.success) {
            adminToken = result.token;
            localStorage.setItem('adminToken', adminToken);
            localStorage.setItem('adminEmail', email);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Login failed:', error);
        return false;
    }
}

// Load pending requests from server
async function loadPendingRequests() {
    try {
        const result = await apiCall('/admin/pending-requests');
        if (result.success) {
            return result.requests;
        }
        return [];
    } catch (error) {
        console.error('Failed to load pending requests:', error);
        // Fallback to localStorage if server is unavailable
        return getRequests();
    }
}

// Load active users from server
async function loadActiveUsers() {
    try {
        const result = await apiCall('/admin/active-users');
        if (result.success) {
            return result.users;
        }
        return [];
    } catch (error) {
        console.error('Failed to load active users:', error);
        // Fallback to localStorage if server is unavailable
        return getActive();
    }
}

// Approve request
async function approveRequest(requestId, plan, days) {
    try {
        const result = await apiCall('/admin/approve', 'POST', {
            request_id: requestId,
            plan: plan,
            days_valid: days
        });
        return result.success;
    } catch (error) {
        console.error('Failed to approve request:', error);
        return false;
    }
}

// Reject request
async function rejectRequest(requestId, reason) {
    try {
        const result = await apiCall('/admin/reject', 'POST', {
            request_id: requestId,
            reason: reason
        });
        return result.success;
    } catch (error) {
        console.error('Failed to reject request:', error);
        return false;
    }
}

// Extend license
async function extendLicense(email, days, reason) {
    try {
        const result = await apiCall('/admin/extend', 'POST', {
            email: email,
            days: days,
            reason: reason
        });
        return result.success;
    } catch (error) {
        console.error('Failed to extend license:', error);
        return false;
    }
}

// Revoke license
async function revokeLicense(email, reason) {
    try {
        const result = await apiCall('/admin/revoke', 'POST', {
            email: email,
            reason: reason
        });
        return result.success;
    } catch (error) {
        console.error('Failed to revoke license:', error);
        return false;
    }
}

// Get system statistics
async function getSystemStats() {
    try {
        const result = await apiCall('/admin/stats');
        if (result.success) {
            return result.stats;
        }
        return null;
    } catch (error) {
        console.error('Failed to get stats:', error);
        return null;
    }
}

// Update the main admin functions to use online database
const originalRenderRequests = renderRequests;
const originalRenderActiveList = renderActiveList;

// Enhanced renderRequests with online support
async function renderRequests() {
    try {
        // Try to load from server first
        const requests = await loadPendingRequests();
        
        const wrap = document.getElementById('request-list');
        wrap.innerHTML = '';
        
        requests.forEach((req, idx) => {
            const row = document.createElement('div');
            row.className = 'm-item';
            row.setAttribute('data-email', req.email);
            row.setAttribute('data-request-id', req.request_id);
            
            // Format device info
            const deviceInfo = req.device_info ? 
                `${req.device_info.os || 'Unknown'} - ${req.device_info.hostname || 'Unknown'}` : 
                'Unknown device';
            
            row.innerHTML = `
                <div class="ring-wrap">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        <defs>
                            <linearGradient id="ringGrad${idx}" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
                                <stop offset="0%" stop-color="#22c55e" />
                                <stop offset="33%" stop-color="#3b82f6" />
                                <stop offset="66%" stop-color="#ef4444" />
                                <stop offset="100%" stop-color="#22c55e" />
                                <animateTransform attributeName="gradientTransform" attributeType="XML" type="rotate" from="0 0.5 0.5" to="360 0.5 0.5" dur="7s" repeatCount="indefinite" />
                            </linearGradient>
                        </defs>
                        <rect x="2" y="2" width="96" height="96" rx="6" fill="none" stroke="rgba(34,197,94,.28)" stroke-width="1" />
                        <rect x="2" y="2" width="96" height="96" rx="6" fill="none" stroke="url(#ringGrad${idx})" stroke-width="1" stroke-linejoin="round" />
                    </svg>
                </div>
                <div><div class="pill">${req.email}</div></div>
                <div><div class="pill">${deviceInfo}</div></div>
                <div><span class="pill" style="color:#f59e0b">Pending</span></div>
                <div>
                    <div style="display:flex;gap:6px;justify-content:flex-end">
                        <button class="btn btn-outline sm" onclick="event.stopPropagation(); showRequestDetails('${req.request_id}')">Details</button>
                        <button class="btn btn-approve sm" onclick="event.stopPropagation(); approveRequestOnline('${req.request_id}')">Approve</button>
                        <button class="btn btn-deny sm" onclick="event.stopPropagation(); rejectRequestOnline('${req.request_id}')">Reject</button>
                    </div>
                </div>
            `;
            
            wrap.appendChild(row);
        });
        
        // Update request count
        updateRequestCount(requests.length);
        
    } catch (error) {
        console.error('Error rendering requests:', error);
        // Fallback to original function
        if (originalRenderRequests) {
            originalRenderRequests();
        }
    }
}

// Enhanced renderActiveList with online support
async function renderActiveList() {
    try {
        // Try to load from server first
        const users = await loadActiveUsers();
        
        const wrap = document.getElementById('active-list');
        wrap.innerHTML = '';
        
        users.forEach((user, idx) => {
            const row = document.createElement('div');
            row.className = 'm-item';
            row.setAttribute('data-name', user.email);
            row.setAttribute('data-email', user.email);
            row.setAttribute('data-plan', user.plan || 'basic');
            row.setAttribute('data-expiry', user.expiry_timestamp || '');
            row.style.gridTemplateColumns = '1.2fr 1.6fr auto auto';
            row.id = 'active-row-' + idx;
            
            const gid = `ringGradActive${idx}`;
            const daysRemaining = user.days_remaining || 0;
            const statusColor = daysRemaining > 7 ? '#22c55e' : daysRemaining > 0 ? '#f59e0b' : '#ef4444';
            const statusText = daysRemaining > 7 ? 'Active' : daysRemaining > 0 ? `${daysRemaining} days` : 'Expired';
            
            row.innerHTML = `
                <div class="ring-wrap">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        <defs>
                            <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
                                <stop offset="0%" stop-color="#22c55e" />
                                <stop offset="33%" stop-color="#3b82f6" />
                                <stop offset="66%" stop-color="#ef4444" />
                                <stop offset="100%" stop-color="#22c55e" />
                                <animateTransform attributeName="gradientTransform" attributeType="XML" type="rotate" from="0 0.5 0.5" to="360 0.5 0.5" dur="7s" repeatCount="indefinite" />
                            </linearGradient>
                        </defs>
                        <rect x="2" y="2" width="96" height="96" rx="0" fill="none" stroke="rgba(34,197,94,.28)" stroke-width="1" />
                        <rect x="2" y="2" width="96" height="96" rx="0" fill="none" stroke="url(#${gid})" stroke-width="1" stroke-linejoin="miter" />
                    </svg>
                </div>
                <div><div class="pill">${user.email}</div></div>
                <div><div class="pill">${user.plan || 'basic'}</div></div>
                <div><span class="pill" style="color:${statusColor}">${statusText}</span></div>
                <div>
                    <div style="display:flex;gap:6px;justify-content:flex-end">
                        <button class="btn btn-outline sm" onclick="event.stopPropagation(); showUserDetails('${user.email}')">Details</button>
                        <button class="btn btn-outline sm" onclick="event.stopPropagation(); extendUserLicense('${user.email}')">Extend</button>
                        <button class="btn btn-deny sm" onclick="event.stopPropagation(); revokeUserLicense('${user.email}')">Revoke</button>
                    </div>
                </div>
            `;
            
            wrap.appendChild(row);
        });
        
        // Update badges
        updateBadges();
        
    } catch (error) {
        console.error('Error rendering active users:', error);
        // Fallback to original function
        if (originalRenderActiveList) {
            originalRenderActiveList();
        }
    }
}

// Online approval function
async function approveRequestOnline(requestId) {
    const plan = prompt('Enter plan (basic/premium):', 'basic');
    const days = prompt('Enter validity period (days):', '180');
    
    if (!plan || !days) return;
    
    try {
        const success = await approveRequest(requestId, plan, parseInt(days));
        if (success) {
            alert('Request approved successfully!');
            renderRequests(); // Refresh the list
        } else {
            alert('Failed to approve request');
        }
    } catch (error) {
        alert('Error approving request: ' + error.message);
    }
}

// Online rejection function
async function rejectRequestOnline(requestId) {
    const reason = prompt('Enter rejection reason:', 'Rejected by admin');
    
    if (!reason) return;
    
    try {
        const success = await rejectRequest(requestId, reason);
        if (success) {
            alert('Request rejected successfully!');
            renderRequests(); // Refresh the list
        } else {
            alert('Failed to reject request');
        }
    } catch (error) {
        alert('Error rejecting request: ' + error.message);
    }
}

// Extend user license
async function extendUserLicense(email) {
    const days = prompt('Enter extension period (days):', '30');
    const reason = prompt('Enter reason:', 'License extension');
    
    if (!days || !reason) return;
    
    try {
        const success = await extendLicense(email, parseInt(days), reason);
        if (success) {
            alert('License extended successfully!');
            renderActiveList(); // Refresh the list
        } else {
            alert('Failed to extend license');
        }
    } catch (error) {
        alert('Error extending license: ' + error.message);
    }
}

// Revoke user license
async function revokeUserLicense(email) {
    if (!confirm(`Revoke license for ${email}?`)) return;
    
    const reason = prompt('Enter revocation reason:', 'License revoked by admin');
    
    if (!reason) return;
    
    try {
        const success = await revokeLicense(email, reason);
        if (success) {
            alert('License revoked successfully!');
            renderActiveList(); // Refresh the list
        } else {
            alert('Failed to revoke license');
        }
    } catch (error) {
        alert('Error revoking license: ' + error.message);
    }
}

// Update request count
function updateRequestCount(count) {
    const elements = document.querySelectorAll('#active-count, #request-count');
    elements.forEach(el => {
        if (el) el.textContent = count;
    });
}

// Auto-refresh data every 30 seconds
setInterval(() => {
    renderRequests();
    renderActiveList();
}, 30000);

// Initialize online mode
document.addEventListener('DOMContentLoaded', function() {
    // Check if admin is logged in
    const adminEmail = localStorage.getItem('adminEmail');
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail)) {
        // Try to login
        const email = prompt('Enter admin email:');
        if (email && ADMIN_EMAILS.includes(email)) {
            adminLogin(email).then(success => {
                if (!success) {
                    alert('Admin login failed');
                    window.location.href = '../login/index.html';
                }
            });
        } else {
            alert('Unauthorized access');
            window.location.href = '../login/index.html';
        }
    }
    
    // Load initial data
    renderRequests();
    renderActiveList();
});

// Show connection status
function showConnectionStatus(online) {
    const status = document.createElement('div');
    status.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        z-index: 1000;
        transition: all 0.3s ease;
    `;
    
    if (online) {
        status.style.background = '#22c55e';
        status.style.color = 'white';
        status.textContent = '🟢 Online';
    } else {
        status.style.background = '#ef4444';
        status.style.color = 'white';
        status.textContent = '🔴 Offline';
    }
    
    document.body.appendChild(status);
    
    setTimeout(() => {
        status.style.opacity = '0';
        setTimeout(() => status.remove(), 300);
    }, 3000);
}

// Test connection on load
apiCall('/admin/stats').then(() => {
    showConnectionStatus(true);
}).catch(() => {
    showConnectionStatus(false);
});

console.log('🌐 Admin panel initialized with online database support');
