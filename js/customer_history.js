// API base URL - adjust this to your server location
const API_BASE = 'http://localhost/animates/api/';

// Mobile menu toggle function
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('hidden');
}

// Load user's active bookings count
async function loadUserBookings() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}tracking.php`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            document.getElementById('activeBookingsCount').textContent = result.data.length;
        } else {
            document.getElementById('activeBookingsCount').textContent = '0';
        }
    } catch (error) {
        console.error('Error loading user bookings:', error);
        document.getElementById('activeBookingsCount').textContent = '0';
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DEBUG: customer_history.js loaded');

    // Check authentication first
    const isAuthenticated = await checkAuth();
    console.log('DEBUG: Authentication check result:', isAuthenticated);
    if (!isAuthenticated) {
        console.log('DEBUG: Not authenticated, stopping execution');
        return; // Stop execution if not authenticated
    }

    // Load active bookings count
    loadUserBookings();

    // Load service history
    loadHistory();
});

// Enhanced authentication and session management
async function checkAuth() {
    console.log('DEBUG: checkAuth() called');
    const token = localStorage.getItem('authToken');
    console.log('DEBUG: Token present:', !!token);

    if (!token) {
        console.log('DEBUG: No token found, redirecting to auth');
        redirectToAuth();
        return false;
    }

    try {
        console.log('DEBUG: Verifying token');
        const response = await fetch(`${API_BASE}auth.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'verify_token' })
        });

        console.log('DEBUG: Token verification response status:', response.status);
        const result = await response.json();
        console.log('DEBUG: Token verification result:', result);

        if (result.success) {
            currentUser = {
                id: result.user_id,
                email: result.email
            };

            console.log('DEBUG: Checking user role');
            // Verify user has customer role
            const roleResponse = await fetch(`${API_BASE}auth.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'check_role' })
            });

            console.log('DEBUG: Role check response status:', roleResponse.status);
            if (!roleResponse.ok) {
                throw new Error('Role verification failed');
            }

            updateUserWelcome();
            console.log('DEBUG: Authentication successful');
            return true;
        } else {
            throw new Error('Token verification failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('DEBUG: Auth check failed:', error);
        localStorage.removeItem('authToken');
        redirectToAuth();
        return false;
    }
}

function updateUserWelcome() {
    const welcomeElement = document.getElementById('userWelcome');
    const welcomeMobileElement = document.getElementById('userWelcomeMobile');
    if (currentUser) {
        const welcomeText = `Welcome, ${currentUser.email}`;
        if (welcomeElement) welcomeElement.textContent = welcomeText;
        if (welcomeMobileElement) welcomeMobileElement.textContent = welcomeText;
    }
}

function redirectToAuth() {
    // Clear any stored data
    localStorage.clear();
    // Force redirect to auth page
    window.location.replace('auth.html');
}

async function logout() {
    try {
        const token = localStorage.getItem('authToken');

        if (token) {
            await fetch(`${API_BASE}logout.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
        }

        localStorage.clear();
        showNotification('Logged out successfully', 'success');

        setTimeout(() => {
            redirectToAuth();
        }, 1000);

    } catch (error) {
        console.error('Logout error:', error);
        localStorage.clear();
        redirectToAuth();
    }
}

// Load service history
async function loadHistory() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}tracking.php?action=history`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            displayHistory(result.data);
        } else {
            showNotification('Error loading history', 'error');
        }
    } catch (error) {
        console.error('Error loading history:', error);
        showNotification('Error loading service history', 'error');
    }
}

// History filter function
function filterHistory(period) {
    // Update button styles
    event.target.parentElement.querySelectorAll('button').forEach(btn => {
        btn.classList.remove('bg-primary', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });

    event.target.classList.remove('bg-gray-200', 'text-gray-700');
    event.target.classList.add('bg-primary', 'text-white');

    // Load history with the selected period
    loadHistoryWithFilter(period);
}

// Load history with specific filter
async function loadHistoryWithFilter(period) {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}tracking.php?action=history&period=${period}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            displayHistory(result.data);
        } else {
            showNotification('Error loading history', 'error');
        }
    } catch (error) {
        console.error('Error loading filtered history:', error);
        showNotification('Error loading service history', 'error');
    }
}

// Display history data
function displayHistory(historyData) {
    const container = document.getElementById('historyContainer');

    if (!historyData || historyData.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                </div>
                <p class="text-gray-500 text-lg">No service history found</p>
                <p class="text-gray-400 text-sm mt-2">Your completed services will appear here</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="space-y-4">
            ${historyData.map(booking => `
                <div class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">✓</div>
                            <div>
                                <h3 class="font-semibold text-gray-900 text-lg">${booking.pet_name}</h3>
                                <p class="text-sm text-gray-600">${booking.breed} • ${booking.owner_name}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-sm text-gray-500 mb-1">Completed</div>
                            <div class="text-sm font-medium text-gray-700">${formatTime(booking.actual_completion)}</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div class="bg-gray-50 rounded p-3">
                            <div class="text-xs text-gray-500 uppercase tracking-wide">Check-in</div>
                            <div class="text-sm font-medium text-gray-900">${booking.check_in_time ? formatTime(booking.check_in_time) : 'N/A'}</div>
                        </div>
                        <div class="bg-gray-50 rounded p-3">
                            <div class="text-xs text-gray-500 uppercase tracking-wide">RFID Tag</div>
                            <div class="text-sm font-medium text-gray-900">${booking.tag_id}</div>
                        </div>
                        <div class="bg-primary/10 rounded p-3">
                            <div class="text-xs text-primary uppercase tracking-wide">Total Paid</div>
                            <div class="text-lg font-bold text-primary">₱${parseFloat(booking.total_amount).toFixed(2)}</div>
                        </div>
                    </div>

                    <div>
                        <div class="text-sm font-medium text-gray-700 mb-2">Services:</div>
                        <div class="flex flex-wrap gap-2">
                            ${booking.services.map(service => `
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    ${service.name}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };

    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);

    // Remove after 4 seconds
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 4000);
}