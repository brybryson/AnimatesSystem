// Appointment Tracker JavaScript
let refreshInterval = null;
let currentAppointmentData = null;
let appointmentId = null;
let lastKnownStatus = null;

// API base URL
const API_BASE = 'http://localhost/animates/api/';

const statusConfig = {
    'confirmed': {
        label: 'Checked-in',
        icon: 'fa-clipboard-check',
        color: 'blue',
        progress: 33,
        description: 'Pet has been checked in and is waiting for services'
    },
    'in_progress': {
        label: 'Services Ongoing',
        icon: 'fa-cogs',
        color: 'gold',
        progress: 66,
        description: 'Professional grooming services are in progress'
    },
    'completed': {
        label: 'Pet Ready for Pickup',
        icoson: 'fa-check-circle',
        color: 'emerald',
        progress: 100,
        description: 'Your pet is ready! Please come for pickup'
    }
};

// Initialize tracker
document.addEventListener('DOMContentLoaded', function() {
    // Get appointment ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    appointmentId = urlParams.get('appointment_id');

    if (!appointmentId) {
        showError('No appointment ID provided. Please check your tracking link.');
        return;
    }

    // Load initial data
    loadAppointmentData();

    // Start auto-refresh
    startAutoRefresh();
});

async function loadAppointmentData() {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            showError('Authentication required. Please log in again.');
            return;
        }

        const response = await fetch(`${API_BASE}appointments.php?action=get_appointment_details&appointment_id=${appointmentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();

        if (result.success) {
            // Check for status changes
            const newStatus = result.appointment.status;
            if (lastKnownStatus && lastKnownStatus !== newStatus) {
                showStatusChangeNotification(lastKnownStatus, newStatus);
                highlightStatusChange();
            }

            lastKnownStatus = newStatus;
            currentAppointmentData = result.appointment;
            populateTracker(result.appointment);
            showTracker();
        } else {
            showError(result.error || 'Failed to load appointment data');
        }
    } catch (error) {
        console.error('Error loading appointment data:', error);
        showError('Connection error. Please check your internet connection.');
    }
}

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
                <div class="text-sm">Appointment is now: ${newConfig.label}</div>
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

function populateTracker(data) {
    // Pet Information
    document.getElementById('petName').textContent = data.pet_name;
    document.getElementById('petDetails').textContent = `${data.pet_type} • ${data.pet_breed}${data.pet_age ? ` • ${data.pet_age}` : ''}${data.pet_size ? ` • ${data.pet_size}` : ''}`;
    document.getElementById('appointmentId').textContent = data.id;
    document.getElementById('rfidTag').textContent = data.custom_rfid || 'Not assigned';

    // Owner Information
    document.getElementById('ownerName').textContent = data.owner_name || 'N/A';
    document.getElementById('ownerContact').textContent = `${data.owner_email || ''}${data.owner_email && data.owner_phone ? ' • ' : ''}${data.owner_phone || ''}`.trim() || 'N/A';

    // Appointment Times
    document.getElementById('appointmentDate').textContent = formatDate(data.appointment_date);
    document.getElementById('appointmentTime').textContent = formatTime(data.appointment_time);
    document.getElementById('checkinTime').textContent = data.check_in_time ? formatDateTime(data.check_in_time) : 'Not checked in';

    // Status
    updateStatus(data.status);

    // Services
    populateServices(data.services);

    // Total Amount
    document.getElementById('totalAmount').textContent = `₱${parseFloat(data.total_amount).toFixed(2)}`;

    // RFID Info
    const rfidTag = data.custom_rfid || 'Not assigned';
    document.getElementById('currentRfidTag').textContent = rfidTag;

    // Update RFID status section based on assignment
    updateRFIDStatusSection(data.custom_rfid, data.status);

    // Special Notes
    if (data.special_instructions && data.special_instructions.trim()) {
        document.getElementById('specialNotesCard').classList.remove('hidden');
        document.getElementById('specialNotesText').textContent = data.special_instructions;
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
    const config = statusConfig[status] || statusConfig['confirmed'];

    // Update status badge
    const statusBadge = document.getElementById('statusBadge');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

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
    if (['in_progress'].includes(status)) {
        statusDot.classList.add('status-pulse');
    } else {
        statusDot.classList.remove('status-pulse');
    }

    // Update progress bar
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = config.progress + '%';

    // Update timeline
    updateTimeline(status);

    // Update next action
    updateNextAction(status);
}

function updateTimeline(currentStatus) {
    const timelineSteps = document.getElementById('timelineSteps');
    const steps = ['confirmed', 'in_progress', 'completed'];

    timelineSteps.innerHTML = steps.map((step, index) => {
        const config = statusConfig[step];
        const isActive = step === currentStatus;
        const isCompleted = steps.indexOf(currentStatus) > index;
        const isPending = steps.indexOf(currentStatus) < index;

        let statusClass, iconClass, textClass, timeClass;

        if (isCompleted) {
            statusClass = 'bg-green-500 border-green-500';
            iconClass = 'text-white';
            textClass = 'text-green-700 font-semibold';
            timeClass = 'text-green-600';
        } else if (isActive) {
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
        if (currentAppointmentData && currentAppointmentData.status_history) {
            const statusUpdate = currentAppointmentData.status_history.find(s => s.status === step);
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

function updateNextAction(status) {
    const nextActionElement = document.getElementById('nextAction');
    switch(status) {
        case 'confirmed':
            nextActionElement.textContent = 'Start Services';
            break;
        case 'in_progress':
            nextActionElement.textContent = 'Complete Services';
            break;
        case 'completed':
            nextActionElement.textContent = 'Ready for Pickup';
            break;
        default:
            nextActionElement.textContent = 'Check-in';
    }
}

function updateRFIDStatusSection(rfidAssigned, status) {
    const rfidSection = document.querySelector('.bg-blue-50');
    const titleElement = rfidSection.querySelector('h3');
    const descriptionElement = rfidSection.querySelector('p');
    const statusIndicator = rfidSection.querySelector('.inline-flex');
    const waitingText = rfidSection.querySelector('.text-sm.text-gray-600');

    if (rfidAssigned) {
        // RFID is assigned - show tracking status
        titleElement.textContent = 'RFID Tracking Active';
        descriptionElement.textContent = 'Your pet\'s progress is being tracked in real-time via RFID';

        // Update status indicator
        const statusDiv = statusIndicator.querySelector('span');
        statusDiv.textContent = 'Tracking Active';

        // Update waiting text based on status
        switch(status) {
            case 'confirmed':
                waitingText.textContent = 'Tap RFID to start services...';
                break;
            case 'in_progress':
                waitingText.textContent = 'Tap RFID to complete services...';
                break;
            case 'completed':
                waitingText.textContent = 'Service completed! Ready for pickup.';
                break;
            default:
                waitingText.textContent = 'RFID tracking is active...';
        }
    } else {
        // RFID not assigned - show assignment needed
        titleElement.textContent = 'RFID Assignment Required';
        descriptionElement.textContent = 'Please assign an RFID tag to enable real-time tracking';

        // Update status indicator
        const statusDiv = statusIndicator.querySelector('span');
        statusDiv.textContent = 'Assignment Needed';

        waitingText.textContent = 'Contact staff to assign RFID tag...';
    }
}

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

    servicesList.innerHTML = services.map(service => `
        <div class="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
            <div>
                <span class="font-medium text-gray-900">${service.name}</span>
                <p class="text-sm text-gray-600">${service.category || 'Professional service'}</p>
            </div>
            <span class="text-lg font-bold text-primary">₱${parseFloat(service.price || 0).toFixed(2)}</span>
        </div>
    `).join('');
}

function startAutoRefresh() {
    // Refresh every 15 seconds for more real-time updates
    refreshInterval = setInterval(async () => {
        try {
            await loadAppointmentData();
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

function showTracker() {
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

function goBack() {
    window.location.href = 'appointments_manager.html';
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(timeString) {
    if (!timeString) return 'N/A';

    // Convert 24-hour time to 12-hour format
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

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

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
});

// Handle page visibility change (pause refresh when tab is hidden)
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        startAutoRefresh();
        // Immediate refresh when tab becomes visible
        loadAppointmentData();
    }
});