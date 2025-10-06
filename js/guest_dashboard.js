// Guest Dashboard JavaScript
let refreshInterval = null;
let currentBookingData = null;
let trackingToken = null;
let lastKnownStatus = null;
let rfidPollingInterval = null;
let lastRFIDTapTime = 0; // Track last RFID tap time to prevent rapid successive calls
let isUpdatingStatus = false; // Prevent concurrent status updates

// API base URL
const API_BASE = 'http://localhost/animates/api/';


const statusConfig = {
    'checked-in': {
        label: 'Check-in Process',
        icon: 'fa-clipboard-check',
        color: 'blue',
        progress: 33,
        description: 'Your pet has been checked in and is waiting for services'
    },
    'bathing': {
        label: 'Services Ongoing',
        icon: 'fa-cogs',
        color: 'gold',
        progress: 66,
        description: 'Professional grooming services are in progress'
    },
    'grooming': {
        label: 'Services Ongoing',
        icon: 'fa-cogs',
        color: 'gold',
        progress: 66,
        description: 'Professional grooming services are in progress'
    },
    'ready': {
        label: 'Services Ongoing',
        icon: 'fa-cogs',
        color: 'gold',
        progress: 66,
        description: 'Professional grooming services are in progress'
    },
    'in-progress': {
        label: 'Services Ongoing',
        icon: 'fa-cogs',
        color: 'gold',
        progress: 66,
        description: 'Professional grooming services are in progress'
    },
    'completed': {
        label: 'Pet Ready for Pickup',
        icon: 'fa-check-circle',
        color: 'emerald',
        progress: 100,
        description: 'Your pet is ready! Please come for pickup'
    }
};


// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Get tracking token from URL
    const urlParams = new URLSearchParams(window.location.search);
    trackingToken = urlParams.get('token');
    
    if (!trackingToken) {
        showError('No tracking token provided. Please check your email link.');
        return;
    }
    
    // Load initial data
    loadBookingData();

    // Start auto-refresh with shorter interval for real-time updates
    startAutoRefresh();

    // Start RFID polling for real-time status updates
    startRFIDPolling();
});

async function loadBookingData() {
    try {
        const response = await fetch(`${API_BASE}bookings.php?action=get_booking_details&rfid=${trackingToken}`);
        const result = await response.json();

        if (result.success) {
            // Check for status changes
            const newStatus = result.appointment.status;
            if (lastKnownStatus && lastKnownStatus !== newStatus) {
                showStatusChangeNotification(lastKnownStatus, newStatus);
                // Add visual feedback for status change
                highlightStatusChange();
            }

            lastKnownStatus = newStatus;
            currentBookingData = result.appointment;
            populateDashboard(result.appointment);
            showDashboard();
        } else {
            showError(result.error || 'Failed to load booking data');
        }
    } catch (error) {
        console.error('Error loading booking data:', error);
        showError('Connection error. Please check your internet connection.');
    }
}

// Updated showStatusChangeNotification function - REPLACE existing function
function showStatusChangeNotification(oldStatus, newStatus) {
    const oldConfig = statusConfig[oldStatus] || {};
    const newConfig = statusConfig[newStatus] || {};
    
    // Special handling for completion
    if (newStatus === 'completed') {
        celebrateCompletion();
        return;
    }
    
    // Create and show notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-sm notification-update';
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-bell mr-3 text-lg"></i>
            <div>
                <div class="font-semibold">Status Updated!</div>
                <div class="text-sm">Your pet is now: ${newConfig.label}</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate notification
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.transition = 'transform 0.3s ease-out';
    }, 100);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 5000);
    
    // Play notification sound (if supported)
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+T16XspBFiTyO/dg');
        audio.play().catch(() => {});
    } catch (e) {
        // Ignore if audio fails
    }
}

function highlightStatusChange() {
    const statusBadge = document.getElementById('statusBadge');
    if (statusBadge) {
        statusBadge.classList.add('status-highlight');
        setTimeout(() => {
            statusBadge.classList.remove('status-highlight');
        }, 2000);
    }
}

function populateDashboard(data) {
    // Pet Information
    document.getElementById('petName').textContent = data.pet_name;
    document.getElementById('petDetails').textContent = `${data.pet_type} • ${data.pet_breed}${data.age_range ? ` • ${data.age_range}` : ''}${data.size ? ` • ${data.size}` : ''}`;
    document.getElementById('bookingId').textContent = data.booking_id; // Use booking_id from API response

    // Owner Information
    document.getElementById('ownerName').textContent = data.owner_name;
    document.getElementById('ownerContact').textContent = `${data.owner_phone}${data.owner_email ? ` • ${data.owner_email}` : ''}`;

    // Booking Times
    document.getElementById('checkinTime').textContent = formatDateTime(data.check_in_time);
    document.getElementById('estimatedTime').textContent = data.actual_completion ? formatDateTime(data.actual_completion) : 'To be determined';

    // Status
    updateStatus(data.status);

    // Services
    populateServices(data.services);

    // Total Amount
    document.getElementById('totalAmount').textContent = `₱${parseFloat(data.total_amount).toFixed(2)}`;

    // Special Notes
    if (data.staff_notes && data.staff_notes.trim()) {
        document.getElementById('specialNotesCard').classList.remove('hidden');
        document.getElementById('specialNotesText').textContent = data.staff_notes;
    } else {
        document.getElementById('specialNotesCard').classList.add('hidden');
    }

    // Update last refreshed time
    document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function updateStatus(status) {
    const config = statusConfig[status] || statusConfig['checked-in'];

    // Update status badge with explicit color classes
    const statusBadge = document.getElementById('statusBadge');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    // Use explicit color classes instead of dynamic ones
    let badgeBgColor, badgeTextColor, badgeBorderColor, dotBgColor;
    switch(config.color) {
        case 'blue':
            badgeBgColor = 'bg-blue-100';
            badgeTextColor = 'text-blue-800';
            badgeBorderColor = 'border-blue-200';
            dotBgColor = 'bg-blue-500';
            break;
        case 'gold':
            badgeBgColor = 'bg-yellow-100';
            badgeTextColor = 'text-yellow-800';
            badgeBorderColor = 'border-yellow-200';
            dotBgColor = 'bg-yellow-500';
            break;
        case 'emerald':
            badgeBgColor = 'bg-emerald-100';
            badgeTextColor = 'text-emerald-800';
            badgeBorderColor = 'border-emerald-200';
            dotBgColor = 'bg-emerald-500';
            break;
        default:
            badgeBgColor = 'bg-blue-100';
            badgeTextColor = 'text-blue-800';
            badgeBorderColor = 'border-blue-200';
            dotBgColor = 'bg-blue-500';
    }

    statusBadge.className = `inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badgeBgColor} ${badgeTextColor} border ${badgeBorderColor}`;
    statusDot.className = `w-2 h-2 rounded-full mr-2 ${dotBgColor}`;
    statusText.textContent = config.label;

    // Add pulse animation for active statuses
    if (['in-progress'].includes(status)) {
        statusDot.classList.add('status-pulse');
    } else {
        statusDot.classList.remove('status-pulse');
    }

    // Update progress bar
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = config.progress + '%';

    // Update timeline
    updateTimeline(status);
}


// Updated updateTimeline function - replace existing function
function updateTimeline(currentStatus) {
    const timelineSteps = document.getElementById('timelineSteps');
    const steps = ['checked-in', 'in-progress', 'completed'];

    // Map old status values to new ones for timeline logic
    let mappedStatus = currentStatus;
    if (['bathing', 'grooming', 'ready'].includes(currentStatus)) {
        mappedStatus = 'in-progress';
    }

    timelineSteps.innerHTML = steps.map((step, index) => {
        const config = statusConfig[step];
        const isActive = step === mappedStatus;
        const isCompleted = steps.indexOf(mappedStatus) > index;
        const isPending = steps.indexOf(mappedStatus) < index;

        let statusClass, iconClass, textClass, timeClass;

        if (isCompleted) {
            statusClass = 'bg-green-500 border-green-500';
            iconClass = 'text-white';
            textClass = 'text-green-700 font-semibold';
            timeClass = 'text-green-600';
        } else if (isActive) {
            // Use explicit color classes instead of dynamic ones
            let bgColor, borderColor, textColor, timeTextColor;
            switch(config.color) {
                case 'blue':
                    bgColor = 'bg-blue-500';
                    borderColor = 'border-blue-500';
                    textColor = 'text-blue-700';
                    timeTextColor = 'text-blue-600';
                    break;
                case 'gold':
                    bgColor = 'bg-yellow-500';
                    borderColor = 'border-yellow-500';
                    textColor = 'text-yellow-700';
                    timeTextColor = 'text-yellow-600';
                    break;
                case 'emerald':
                    bgColor = 'bg-emerald-500';
                    borderColor = 'border-emerald-500';
                    textColor = 'text-emerald-700';
                    timeTextColor = 'text-emerald-600';
                    break;
                default:
                    bgColor = 'bg-blue-500';
                    borderColor = 'border-blue-500';
                    textColor = 'text-blue-700';
                    timeTextColor = 'text-blue-600';
            }
            statusClass = `${bgColor} ${borderColor} status-pulse`;
            iconClass = 'text-white';
            textClass = `${textColor} font-semibold`;
            timeClass = timeTextColor;
        } else {
            statusClass = 'bg-gray-100 border-gray-300';
            iconClass = 'text-gray-400';
            textClass = 'text-gray-500';
            timeClass = 'text-gray-400';
        }

        // Get timestamp for this step if available
        let stepTime = '';
        if (currentBookingData && currentBookingData.status_updates) {
            const statusUpdate = currentBookingData.status_updates.find(s => s.status === step);
            if (statusUpdate) {
                stepTime = formatTime(statusUpdate.created_at);
            }
        }

        // Special styling for completed status
        if (step === 'completed' && isActive) {
            statusClass = 'bg-gradient-to-r from-emerald-500 to-green-600 border-emerald-500 completion-glow';
        }

        return `
            <div class="relative flex items-start">
                <div class="relative z-10 w-16 h-16 ${statusClass} border-4 rounded-full flex items-center justify-center shadow-lg">
                    <i class="fas ${config.icon} text-xl ${iconClass}"></i>
                    ${step === 'completed' && isActive ? '<div class="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full blur opacity-75 animate-pulse"></div>' : ''}
                </div>
                <div class="ml-6 min-w-0 flex-1">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg ${textClass}">${config.label}</h3>
                        ${stepTime ? `<span class="text-sm ${timeClass} font-medium">${stepTime}</span>` : ''}
                    </div>
                    <p class="text-sm text-gray-600 mt-1">${config.description}</p>
                    ${isActive && step === 'completed' ? '<div class="mt-2 text-sm font-bold text-emerald-600">🎉 Thank you for choosing Animates PH!</div>' : ''}
                    ${isActive && step !== 'completed' ? '<div class="mt-2 text-sm font-medium text-blue-600">🔄 Currently in progress...</div>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Add completion celebration function - ADD THIS NEW FUNCTION
function celebrateCompletion() {
    // Create celebration overlay
    const celebration = document.createElement('div');
    celebration.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 celebration-overlay';
    celebration.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-md mx-4 text-center transform scale-95 celebration-popup">
            <div class="text-6xl mb-4 animate-bounce">🎉</div>
            <h2 class="text-2xl font-bold text-emerald-600 mb-2">Service Completed!</h2>
            <p class="text-gray-600 mb-4">Thank you for choosing Animates Pet Boutique!</p>
            <div class="text-4xl mb-4">✨🐾✨</div>
            <button onclick="closeCelebration()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                Wonderful! 🎊
            </button>
        </div>
    `;
    
    document.body.appendChild(celebration);
    
    // Animate in
    setTimeout(() => {
        celebration.querySelector('.celebration-popup').style.transform = 'scale(1)';
        celebration.querySelector('.celebration-popup').style.transition = 'transform 0.3s ease-out';
    }, 100);
    
    // Auto-remove after 5 seconds if user doesn't close it
    setTimeout(() => {
        if (document.body.contains(celebration)) {
            closeCelebration();
        }
    }, 5000);
}

// Add close celebration function - ADD THIS NEW FUNCTION
window.closeCelebration = function() {
    const celebration = document.querySelector('.celebration-overlay');
    if (celebration) {
        celebration.style.opacity = '0';
        celebration.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => {
            if (celebration.parentNode) {
                celebration.remove();
            }
        }, 300);
    }
}


function populateServices(services) {
    const servicesList = document.getElementById('servicesList');

    if (!services || services.length === 0) {
        servicesList.innerHTML = '<p class="text-gray-500 text-center py-4">No services selected</p>';
        return;
    }

    // Get package customizations from current booking data
    const packageCustomizations = currentBookingData?.package_customizations || [];

    // Get all service names that are part of packages
    const packageServiceNames = new Set();
    // Also get package names themselves
    const packageNames = new Set();

    packageCustomizations.forEach(packageData => {
        packageNames.add(packageData.name);
        packageData.services.forEach(service => {
            packageServiceNames.add(service.name);
        });
    });

    let html = '';

    // Display regular services first (non-package services and not part of any package)
    const regularServices = services.filter(service => {
        // Exclude if category is 'package'
        if (service.category === 'package') return false;

        // Exclude if service name matches any package service
        if (packageServiceNames.has(service.name)) return false;

        // Exclude if service name is contained in any package name (handles "Package" vs "Package (Customized)")
        for (let packageName of packageNames) {
            if (packageName.includes(service.name) || service.name.includes(packageName.replace(' (Customized)', ''))) {
                return false;
            }
        }

        return true;
    });
    if (regularServices.length > 0) {
        html += regularServices.map(service => `
            <div class="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                    <span class="font-medium text-gray-900">${service.name}</span>
                    <p class="text-sm text-gray-600">${service.category || 'Professional service'}</p>
                </div>
                <span class="text-lg font-bold text-primary">₱${parseFloat(service.price || 0).toFixed(2)}</span>
            </div>
        `).join('');
    }

    // Display package services with expandable details
    packageCustomizations.forEach(packageData => {
        const packageName = packageData.name;
        const packageServices = packageData.services || [];
        const isCustomized = packageServices.some(s => !s.included);

        // Calculate total price for this package from the services data
        const packageService = services.find(s => s.name.includes(packageName) || s.name === packageName);
        const packagePrice = packageService ? parseFloat(packageService.price || 0) : 0;

        html += `
            <div class="bg-gray-50 rounded-lg overflow-hidden">
                <div class="p-4 cursor-pointer package-header" data-package="${packageName.replace(/\s+/g, '-').toLowerCase()}">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center">
                            <span class="font-bold text-gray-900 text-lg">${packageName}${isCustomized ? ' (Customized)' : ''}</span>
                            <span class="text-sm text-gray-700 bg-gray-200 px-2 py-1 rounded-full ml-2">Package</span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-lg font-bold text-primary mr-3">₱${packagePrice.toFixed(2)}</span>
                            <svg class="w-5 h-5 text-primary transform transition-transform duration-200 package-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </div>
                    </div>
                </div>
                <div class="package-details hidden px-4 pb-4">
                    <div class="border-t border-gray-200 pt-3">
                        <p class="text-sm font-medium text-gray-800 mb-3">Package Contents:</p>
                        <div class="space-y-2">
                            ${packageServices.map(service => {
                                if (service.included) {
                                    return `
                                        <div class="flex justify-between items-center pl-4 border-l-2 border-green-300 bg-green-50/50 rounded">
                                            <div class="flex items-center">
                                                <span class="text-green-600 mr-2">✓</span>
                                                <span class="font-medium text-gray-900">${service.name}</span>
                                            </div>
                                            <span class="text-sm text-green-600 font-medium">Included</span>
                                        </div>
                                    `;
                                } else {
                                    return `
                                        <div class="flex justify-between items-center pl-4 border-l-2 border-red-300 bg-red-50/50 rounded opacity-60">
                                            <div class="flex items-center">
                                                <span class="text-red-500 mr-2 line-through">✗</span>
                                                <span class="font-medium text-gray-500 line-through">${service.name}</span>
                                            </div>
                                            <span class="text-sm text-red-500 font-medium">Excluded</span>
                                        </div>
                                    `;
                                }
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    servicesList.innerHTML = html;

    // Add click handlers for package expansion
    document.querySelectorAll('.package-header').forEach(header => {
        header.addEventListener('click', function() {
            const packageId = this.dataset.package;
            const details = this.parentElement.querySelector('.package-details');
            const arrow = this.querySelector('.package-arrow');

            if (details.classList.contains('hidden')) {
                details.classList.remove('hidden');
                arrow.style.transform = 'rotate(180deg)';
            } else {
                details.classList.add('hidden');
                arrow.style.transform = 'rotate(0deg)';
            }
        });
    });
}

function startAutoRefresh() {
    // Refresh every 15 seconds for more real-time updates
    refreshInterval = setInterval(async () => {
        try {
            await loadBookingData();
        } catch (error) {
            console.error('Auto-refresh error:', error);
        }
    }, 15000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

function startRFIDPolling() {
    // Stop any existing polling
    stopRFIDPolling();

    // Poll every 5 seconds for RFID updates
    rfidPollingInterval = setInterval(async () => {
        try {
            // Only poll if we have a tracking token (RFID)
            if (!trackingToken) return;

            const response = await fetch(`${API_BASE}rfid_endpoint.php?action=get_latest_rfid`, {
                headers: {
                    'Authorization': `Bearer dummy-token` // Guest dashboard doesn't need auth
                }
            });
            const result = await response.json();

            if (result.success && result.rfid) {
                // Check if this RFID matches our tracking token (which is the RFID tag)
                if (result.rfid === trackingToken) {
                    // RFID tap detected for our booking - update status with debounce
                    const now = Date.now();
                    const timeSinceLastTap = now - lastRFIDTapTime;

                    // Only process if it's been at least 8 seconds since last tap and not currently updating
                    if (timeSinceLastTap > 8000 && !isUpdatingStatus) {
                        console.log('RFID tap detected for our booking, updating status...');
                        lastRFIDTapTime = now;
                        await handleRFIDTapForStatusUpdate();
                    } else {
                        console.log('RFID tap ignored - too soon after previous tap or already updating');
                    }
                }
            }
        } catch (error) {
            console.error('RFID polling error:', error);
        }
    }, 3000);
}

// Handle RFID tap for status update
async function handleRFIDTapForStatusUpdate() {
    if (isUpdatingStatus) {
        console.log('Status update already in progress, skipping...');
        return;
    }

    try {
        isUpdatingStatus = true; // Set flag to prevent concurrent updates

        // Don't increment tap count here - let the API determine the next status based on current status
        console.log(`Processing RFID tap for booking status update (current status: ${lastKnownStatus})`);

        // Call the booking status update API with current status to determine next status
        const response = await fetch(`${API_BASE}bookings.php?action=update_booking_status&rfid=${trackingToken}&current_status=${lastKnownStatus}`);
        const result = await response.json();

        if (result && typeof result === 'object' && result.updated !== undefined) {
            console.log('Booking status updated:', result);

            // Show notification based on update result
            if (result.updated) {
                if (result.is_completion) {
                    // Completion celebration
                    celebrateCompletion();
                    showNotification('🎉 Service completed! Thank you for choosing Animates PH!', 'success');
                } else {
                    // Status update notification
                    showStatusChangeNotification(lastKnownStatus, result.new_status);
                    showNotification(`Status updated: ${result.new_status}`, 'info');
                }

                // Email notification status
                if (result.email_sent) {
                    console.log('Email notification sent successfully');
                } else {
                    console.log('Email notification failed or not sent');
                }
            } else {
                // Status didn't change (already at this status)
                console.log('Status already at target level, no update needed');
            }

            // Refresh data to show updated status
            await loadBookingData();

        } else {
            console.error('Failed to update booking status - invalid response:', result);
            const errorMsg = (result && result.error) ? result.error : 'Invalid API response';
            showNotification('Failed to update booking status: ' + errorMsg, 'error');
        }

    } catch (error) {
        console.error('Error updating booking status:', error);
        showNotification('Error updating booking status', 'error');
    } finally {
        // Always reset the updating flag
        isUpdatingStatus = false;
    }
}

function stopRFIDPolling() {
    if (rfidPollingInterval) {
        clearInterval(rfidPollingInterval);
        rfidPollingInterval = null;
    }
}

function showDashboard() {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('error-screen').classList.add('hidden');
    document.getElementById('dashboard-content').classList.remove('hidden');
}

function showError(message) {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('dashboard-content').classList.add('hidden');
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-screen').classList.remove('hidden');
    
    // Stop auto-refresh if there's an error
    stopAutoRefresh();
}

function redirectToCheckin() {
    window.location.href = 'check_in.html';
}

// Utility functions
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatTime(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
    stopRFIDPolling();
});

// Handle page visibility change (pause refresh when tab is hidden)
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopAutoRefresh();
        stopRFIDPolling();
    } else {
        startAutoRefresh();
        startRFIDPolling();
        // Immediate refresh when tab becomes visible
        loadBookingData();
    }
});

// Notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };

    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-sm`;
    notification.innerHTML = `
        <div class="flex items-center">
            <span class="mr-2">${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'}</span>
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(notification);

    // Animate in
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.transition = 'transform 0.3s ease-out';
    }, 100);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 4000);
}