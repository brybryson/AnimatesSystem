// API base URL - adjust this to your server location
const API_BASE = 'http://localhost/animates/api/';

// Sample tracking data for demo (will be replaced with real API calls)
let trackingData = {};
let currentUser = null;
let currentBookingData = null;

// Package contents definitions (what services are included in each package)
const packageContents = {
    'Essential Grooming Package': [
        { name: 'Bath & Dry', required: true },
        { name: 'Nail Trimming & Grinding', required: false },
        { name: 'Ear Cleaning & Inspection', required: false }
    ],
    'Full Grooming Package': [
        { name: 'Bath & Dry', required: true },
        { name: 'Haircut & Styling', required: false },
        { name: 'Nail Trimming & Grinding', required: false },
        { name: 'Ear Cleaning & Inspection', required: false },
        { name: 'Teeth Cleaning', required: false },
        { name: 'De-shedding Treatment', required: false }
    ],
    'Bath & Brush Package': [
        { name: 'Bath & Dry', required: true },
        { name: 'De-shedding Treatment', required: false }
    ],
    'Spa Relaxation Package': [
        { name: 'Bath & Dry', required: true },
        { name: 'Paw Balm', required: false },
        { name: 'Scented Cologne', required: false }
    ]
};

let packageCustomizations = {}; // Track package customizations




function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });

    // Show selected section
    document.getElementById(sectionId).classList.remove('hidden');

    // Update desktop nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('text-primary', 'font-semibold');
        link.classList.add('text-gray-700', 'font-medium');
    });

    // Update mobile nav links
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.classList.remove('text-primary', 'font-semibold');
        link.classList.add('text-gray-700', 'font-medium');
    });

    // Highlight active nav (desktop)
    const activeDesktopLink = document.querySelector(`[onclick="showSection('${sectionId}')"].nav-link`);
    if (activeDesktopLink) {
        activeDesktopLink.classList.remove('text-gray-700', 'font-medium');
        activeDesktopLink.classList.add('text-primary', 'font-semibold');
    }

    // Highlight active nav (mobile)
    const activeMobileLink = document.querySelector(`[onclick="showSection('${sectionId}')"].mobile-nav-link`);
    if (activeMobileLink) {
        activeMobileLink.classList.remove('text-gray-700', 'font-medium');
        activeMobileLink.classList.add('text-primary', 'font-semibold');
    }

    // Load data for specific sections
    if (sectionId === 'history') {
        console.log('DEBUG: Loading history section');
        loadHistory();
    } else if (sectionId === 'appointment') {
        console.log('DEBUG: Switching to appointment section, initializing appointments');
        // Initialize appointments when switching to appointment section
        initializeAppointments();
    } else if (sectionId === 'my-appointments') {
        console.log('DEBUG: Switching to my-appointments section, loading appointments');
        // Load user appointments when switching to my-appointments section
        loadUserAppointments();
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('hidden');
}

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

// Updated pet tracking function for RFID search
async function trackPet() {
    const rfidInput = document.getElementById('rfidInput');
    const rfidValue = rfidInput.value.toUpperCase().trim();

    if (!rfidValue) {
        showNotification('Please enter an RFID tag ID.', 'warning');
        return;
    }

    try {
        showNotification('Tracking pet...', 'info');

        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}tracking.php?rfid=${rfidValue}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();

        if (result.success && result.data) {
            const petInfo = result.data;
            // Removed success notification as requested

            // Display detailed tracking info
            displayPetTrackingInfo(petInfo);
        } else {
            showNotification('RFID tag not found or no active booking. Please check the ID and try again.', 'error');
        }
    } catch (error) {
        console.error('Error tracking pet:', error);
        showNotification('Error connecting to tracking system. Please try again.', 'error');
    }

    rfidInput.value = '';
}

function displayPetTrackingInfo(petInfo) {
    // Store booking data globally for package customization access
    currentBookingData = petInfo;
    console.log('Displaying pet tracking info with new timeline and services:', petInfo);

    // Clear any existing auto-refresh timer
    if (window.petTrackingRefreshTimer) {
        clearInterval(window.petTrackingRefreshTimer);
    }

    const container = document.getElementById('activeBookingsContainer');

    // Determine pet type icon and color
    const petType = petInfo.pet_type || 'dog'; // Default to dog if not specified
    const petIcon = petType === 'cat' ? '🐱' : '🐶';
    const petColor = petType === 'cat' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600';

    container.innerHTML = `
        <div class="border border-gray-200 rounded-xl p-6">
            <!-- Pet Identification Section - Spread out layout -->
            <div class="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 mb-6">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <div class="w-16 h-16 ${petColor} rounded-full flex items-center justify-center text-3xl shadow-lg">
                            ${petIcon}
                        </div>
                        <div class="space-y-1">
                            <h3 class="text-2xl font-bold text-gray-900">${petInfo.pet_name}</h3>
                            <p class="text-lg text-gray-700 font-medium">${petInfo.breed}</p>
                            <div class="flex items-center space-x-4 text-sm text-gray-600">
                                <span class="flex items-center">
                                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                                    </svg>
                                    RFID: ${petInfo.tag_id}
                                </span>
                                <span class="flex items-center">
                                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                    </svg>
                                    Owner: ${petInfo.owner_name}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="inline-flex items-center px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
                            <span class="text-sm font-medium text-gray-700 capitalize">${petType}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Thin line above service progress -->
            <div class="w-full h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent mb-6"></div>

            <!-- Service Progress Timeline -->
            <div class="mb-8">
                <h4 class="text-lg font-semibold text-gray-900 mb-4">Service Progress</h4>
                <div class="space-y-4">
                    ${generateDetailedTimelineSteps(petInfo.status, petInfo.status_history)}
                </div>
            </div>

            <!-- Redesigned Order Summary -->
            <div class="mt-8 bg-gradient-to-br from-gold-50 to-gold-100/50 rounded-xl p-6 border border-gold-200/50">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="text-xl font-bold text-gray-900 flex items-center">
                        <svg class="w-6 h-6 text-gold-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                        </svg>
                        Order Summary
                    </h4>
                    <div class="text-right">
                        <p class="text-sm text-gray-600">Total Amount</p>
                        <p class="text-3xl font-bold text-gold-600">₱${parseFloat(petInfo.total_amount).toFixed(2)}</p>
                    </div>
                </div>

                <div id="servicesContainer" class="space-y-3 mb-6">
                    <!-- Services will be populated here -->
                </div>

                <!-- Service breakdown in a nice grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/70 rounded-lg">
                    <div class="text-center">
                        <div class="text-2xl mb-1">📅</div>
                        <p class="text-sm font-medium text-gray-700">Check-in Time</p>
                        <p class="text-xs text-gray-600">${petInfo.check_in_time ? formatTime(petInfo.check_in_time) : 'N/A'}</p>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl mb-1">⏰</div>
                        <p class="text-sm font-medium text-gray-700">Estimated Completion</p>
                        <p class="text-xs text-gray-600">${petInfo.estimated_completion ? formatTime(petInfo.estimated_completion) : 'N/A'}</p>
                    </div>
                </div>
            </div>

            <div class="mt-6 text-center">
                <button onclick="loadUserBookings()" class="inline-flex items-center px-4 py-2 text-gold-600 hover:text-gold-700 font-medium transition-colors duration-200">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                    Back to All Bookings
                </button>
            </div>
        </div>
    `;

    // Populate services with package details
    populateCustomerServices(petInfo.services);

    // Set up auto-refresh for service progress (every 30 seconds)
    window.petTrackingRefreshTimer = setInterval(async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token || !currentBookingData) return;

            const response = await fetch(`${API_BASE}tracking.php?rfid=${currentBookingData.tag_id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success && result.data) {
                const updatedPetInfo = result.data;

                // Only update if status has changed
                if (updatedPetInfo.status !== currentBookingData.status ||
                    updatedPetInfo.total_amount !== currentBookingData.total_amount) {

                    console.log('Pet status updated, refreshing display...');
                    currentBookingData = updatedPetInfo;

                    // Update just the timeline and services sections without full re-render
                    updatePetTrackingDisplay(updatedPetInfo);
                }
            }
        } catch (error) {
            console.log('Auto-refresh failed:', error.message);
        }
    }, 30000); // Refresh every 30 seconds
}

// Function to update just the timeline and services sections without full re-render
function updatePetTrackingDisplay(updatedPetInfo) {
    // Update timeline
    const timelineContainer = document.querySelector('.space-y-4');
    if (timelineContainer) {
        timelineContainer.innerHTML = generateDetailedTimelineSteps(updatedPetInfo.status, updatedPetInfo.status_history);
    }

    // Update services if package customizations changed
    if (updatedPetInfo.package_customizations !== currentBookingData.package_customizations) {
        populateCustomerServices(updatedPetInfo.services);
    }

    // Update total amount if it changed
    const totalElement = document.querySelector('.text-3xl.font-bold.text-gold-600');
    if (totalElement && updatedPetInfo.total_amount !== currentBookingData.total_amount) {
        totalElement.textContent = `₱${parseFloat(updatedPetInfo.total_amount).toFixed(2)}`;
    }
}

// Updated function to load user's bookings automatically
async function loadUserBookings() {
    // Clear any existing auto-refresh timer when loading bookings list
    if (window.petTrackingRefreshTimer) {
        clearInterval(window.petTrackingRefreshTimer);
        window.petTrackingRefreshTimer = null;
    }

    // Show no active bookings state immediately
    document.getElementById('activeBookingsCount').textContent = '0';
    document.getElementById('activeBookingsContainer').innerHTML = `
        <div class="text-center py-8">
            <div class="text-4xl mb-4">🐾</div>
            <p class="text-gray-500">No active bookings found</p>
            <p class="text-sm text-gray-400 mt-2">Your pets will appear here when they're being groomed</p>
        </div>
    `;

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
            displayAllActiveBookings(result.data);
        }
        // If no bookings, keep the "no active bookings" message
    } catch (error) {
        console.error('Error loading user bookings:', error);
        if (error.message.includes('403') || error.message.includes('401')) {
            // Authentication issue, redirect to login
            redirectToAuth();
            return;
        }
        // Keep the "no active bookings" message on error
    }
}

function displayAllActiveBookings(bookings) {
    const container = document.getElementById('activeBookingsContainer');
    
    if (bookings.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">🐾</div>
                <p class="text-gray-500">No active bookings</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
    <div class="mb-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Your Active Bookings</h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            ${bookings.map(booking => `
                <div class="border border-gray-200 rounded-xl p-6">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex items-center space-x-3">
                            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl">🐾</div>
                            <div>
                                <h3 class="font-semibold text-gray-900">${booking.pet_name}</h3>
                                <p class="text-sm text-gray-600">${booking.breed} • ${booking.tag_id}</p>
                                <p class="text-xs text-gray-500">${booking.owner_name}</p>
                            </div>
                        </div>
                        <span class="px-3 py-1 ${getStatusColor(booking.status)} rounded-full text-sm font-medium">
                            ${getSimplifiedStatus(booking.status)}
                        </span>
                    </div>
                    <div class="text-center">
                        <button onclick="trackSpecificPet('${booking.tag_id}')" 
                                class="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            View Details
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
`;
}

function getStatusColor(status) {
    const statusColors = {
        'checked-in': 'bg-blue-100 text-blue-800',
        'bathing': 'bg-purple-100 text-purple-800', 
        'grooming': 'bg-orange-100 text-orange-800',
        'ready': 'bg-green-100 text-green-800',
        'completed': 'bg-gray-100 text-gray-800'
    };
    
    return statusColors[status] || 'bg-yellow-100 text-yellow-800';
}

function getStatusColor(status) {
    // Simplified status mapping
    const simplifiedStatus = getSimplifiedStatus(status);
    const statusColors = {
        'Check-in Process': 'bg-blue-100 text-blue-800',
        'Service Ongoing': 'bg-purple-100 text-purple-800',
        'Pet ready for pickup': 'bg-green-100 text-green-800',
        'completed': 'bg-gray-100 text-gray-800'
    };

    return statusColors[simplifiedStatus] || 'bg-yellow-100 text-yellow-800';
}

// Helper function to get simplified status
function getSimplifiedStatus(status) {
    switch(status) {
        case 'checked-in':
            return 'Check-in Process';
        case 'bathing':
        case 'grooming':
        case 'ready':
            return 'Service Ongoing';
        case 'completed':
            return 'Pet ready for pickup';
        default:
            return status;
    }
}

async function trackSpecificPet(rfidTag) {
    if (!rfidTag) {
        showNotification('Invalid RFID tag', 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}tracking.php?rfid=${rfidTag}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();

        if (result.success && result.data) {
            const petInfo = result.data;
            // Display detailed tracking info directly without notifications
            displayPetTrackingInfo(petInfo);
        } else {
            showNotification('RFID tag not found or no active booking. Please check the ID and try again.', 'error');
        }
    } catch (error) {
        console.error('Error tracking pet:', error);
        showNotification('Error connecting to tracking system. Please try again.', 'error');
    }
}

function generateDetailedTimelineSteps(currentStatus, statusHistory) {
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

    // Updated timeline steps to match guest dashboard
    const timelineSteps = ['checked-in', 'in-progress', 'completed'];

    // Map old status values to new ones for timeline logic
    let mappedStatus = currentStatus;
    if (['bathing', 'grooming', 'ready'].includes(currentStatus)) {
        mappedStatus = 'in-progress';
    }

    return timelineSteps.map((step, index) => {
        const config = statusConfig[step];
        const isActive = step === mappedStatus;
        const isCompleted = timelineSteps.indexOf(mappedStatus) > index;
        const isPending = timelineSteps.indexOf(mappedStatus) < index;

        let statusClass, iconClass, textClass, timeClass;

        if (isCompleted) {
            statusClass = 'bg-green-500 border-green-500';
            iconClass = 'text-white';
            textClass = 'text-green-700 font-semibold';
            timeClass = 'text-green-600';
        } else if (isActive) {
            // Use explicit color classes
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
        if (statusHistory) {
            const statusUpdate = statusHistory.find(s => {
                if (step === 'in-progress') {
                    return ['bathing', 'grooming', 'ready'].includes(s.status);
                }
                return s.status === step;
            });
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

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
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

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DEBUG: DOMContentLoaded fired');
    // Check authentication first
    const isAuthenticated = await checkAuth();
    console.log('DEBUG: Authentication check result:', isAuthenticated);
    if (!isAuthenticated) {
        console.log('DEBUG: Not authenticated, stopping execution');
        return; // Stop execution if not authenticated
    }

    // Set default section based on current page
    const currentPage = window.location.pathname.split('/').pop();
    console.log('DEBUG: Current page:', currentPage);

    if (currentPage === 'customer_tracking.html') {
        console.log('DEBUG: Setting default section to tracking');
        showSection('tracking');
    } else if (currentPage === 'customer_appointments.html') {
        console.log('DEBUG: Setting default section to my-appointments');
        showSection('my-appointments');
    } else {
        console.log('DEBUG: Setting default section to my-appointments (fallback)');
        showSection('my-appointments');
    }

    // Load user's bookings automatically
    loadUserBookings();

    // Add event listener to RFID input for Enter key (if it exists)
    const rfidInput = document.getElementById('rfidInput');
    if (rfidInput) {
        rfidInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                trackPet();
            }
        });
    }

    // Auto-reload page every 1 minute 30 seconds (90 seconds) for real-time updates
    setInterval(() => {
        // Only reload if we're on tracking section and showing all bookings
        if (!document.getElementById('tracking').classList.contains('hidden')) {
            const container = document.getElementById('activeBookingsContainer');
            if (container.innerHTML.includes('Your Active Bookings') || container.innerHTML.includes('No active bookings')) {
                // Completely silent auto-reload
                window.location.reload();
            }
        }
    }, 90000);
});

// RFID Scanner Integration (for when you get the device)
function handleRFIDScan(tagId) {
    // This function will be called when RFID device detects a tag
    const rfidInput = document.getElementById('rfidInput');
    if (rfidInput) {
        rfidInput.value = tagId;
        trackPet();
    }
}









// Add these functions to your existing customer_portal.js file

// Initialize appointments section
async function initializeAppointments() {
    console.log('DEBUG: initializeAppointments() called');
    try {
        // Only load staff if we're on the appointment section
        if (document.getElementById('appointment').classList.contains('hidden') === false) {
            console.log('DEBUG: Loading staff members');
            await loadStaffMembers();
        }

        // Load services
        console.log('DEBUG: Loading services');
        await loadServices();

        // Set minimum date to today
        setMinimumDate();

        // Initialize pet type change handler
        initializePetTypeHandler();

        // Initialize service selection handlers
        initializeServiceHandlers();

        // Initialize pet size selection handler for pricing
        initializePetSizeHandler();

        console.log('DEBUG: Appointments initialization completed');

    } catch (error) {
        console.error('DEBUG: Error initializing appointments:', error);
        showNotification('Error loading appointment data', 'error');
    }
}

// Load staff members for preferred staff dropdown
async function loadStaffMembers() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            return;
        }

        const response = await fetch(`${API_BASE}appointments.php?action=get_staff`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            return;
        }

        const result = await response.json();

        if (result.success && result.data) {
            const staffSelect = document.querySelector('select[name="preferredStaff"]');
            if (staffSelect) {
                // Clear existing options except "No Preference"
                staffSelect.innerHTML = '<option value="">No Preference</option>';

                result.data.forEach(staff => {
                    const option = document.createElement('option');
                    option.value = staff.id;
                    option.textContent = `${staff.first_name} ${staff.last_name}`;
                    staffSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        // Completely silent - no logging or notifications
    }
}

// Load services and populate service sections
async function loadServices() {
    console.log('DEBUG: loadServices() called');
    try {
        const token = localStorage.getItem('authToken');
        console.log('DEBUG: Auth token present:', !!token);

        const response = await fetch(`${API_BASE}services.php?action=get_services`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('DEBUG: API response status:', response.status);
        const result = await response.json();
        console.log('DEBUG: API response result:', result);

        if (result.success) {
            // Store services data globally for filtering
            window.servicesData = result.services;
            console.log('DEBUG: Services data stored:', window.servicesData);
            // Render services after loading
            renderServices();
        } else {
            console.error('DEBUG: Failed to load services:', result.error);
            // Show error state
            const container = document.getElementById('servicesContainer');
            container.innerHTML = `
                <div class="text-center py-8">
                    <svg class="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p class="text-red-600 font-medium">Failed to load services</p>
                    <p class="text-sm text-red-500 mt-2">Error: ${result.error || 'Unknown error'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('DEBUG: Error loading services:', error);
        // Show error state
        const container = document.getElementById('servicesContainer');
        container.innerHTML = `
            <div class="text-center py-8">
                <svg class="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-red-600 font-medium">Error loading services</p>
                <p class="text-sm text-red-500 mt-2">Error: ${error.message}</p>
            </div>
        `;
    }
}


// Set minimum date to today
function setMinimumDate() {
    const dateInput = document.querySelector('input[type="date"]');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
    }
}

// Initialize pet type change handler
function initializePetTypeHandler() {
    const petTypeSelect = document.querySelector('select[name="petType"]');
    const petBreedSelect = document.querySelector('select[name="petBreed"]');
    
    if (!petTypeSelect || !petBreedSelect) return;
    
    petTypeSelect.addEventListener('change', async function() {
        const petType = this.value.toLowerCase();
        
        if (petType === 'others') {
            petBreedSelect.innerHTML = '<option value="">Enter breed manually</option>';
            petBreedSelect.disabled = true;
            // You might want to show a text input for custom breed here
        } else if (petType) {
            await loadBreeds(petType, petBreedSelect);
        } else {
            petBreedSelect.innerHTML = '<option value="">First select pet type</option>';
            petBreedSelect.disabled = true;
        }
    });
}

// Load breeds based on pet type (from check_in.js logic)
async function loadBreeds(petType, breedSelect) {
    try {
        breedSelect.innerHTML = '<option value="">Loading breeds...</option>';
        breedSelect.disabled = false;
        
        let apiUrl = '';
        if (petType === 'dog') {
            apiUrl = 'https://dog.ceo/api/breeds/list/all';
        } else if (petType === 'cat') {
            apiUrl = 'https://api.thecatapi.com/v1/breeds';
        }
        
        if (!apiUrl) {
            breedSelect.innerHTML = '<option value="">Select breed</option>';
            return;
        }
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        breedSelect.innerHTML = '<option value="">Select breed</option>';
        
        if (petType === 'dog') {
            const breeds = Object.keys(data.message);
            breeds.forEach(breed => {
                const option = document.createElement('option');
                option.value = breed;
                option.textContent = breed.charAt(0).toUpperCase() + breed.slice(1);
                breedSelect.appendChild(option);
            });
        } else if (petType === 'cat') {
            data.forEach(breed => {
                const option = document.createElement('option');
                option.value = breed.name;
                option.textContent = breed.name;
                breedSelect.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error loading breeds:', error);
        breedSelect.innerHTML = '<option value="">Error loading breeds</option>';
    }
}

// Initialize service selection handlers
function initializeServiceHandlers() {
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('service-checkbox')) {
            updateServiceSelection();
        }
    });

    // Add listeners for package checkboxes and customization
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('package-checkbox')) {
            handlePackageSelection(e);
        }
    });

    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('package-item-checkbox')) {
            handlePackageItemToggle(e);
        }
    });
}

// Initialize pet size selection handler for pricing
function initializePetSizeHandler() {
    console.log('DEBUG: initializePetSizeHandler() called');
    const petSizeSelect = document.getElementById('petSizeForPricing');
    console.log('DEBUG: petSizeSelect element:', petSizeSelect);
    if (petSizeSelect) {
        petSizeSelect.addEventListener('change', async function() {
            console.log('DEBUG: Pet size changed to:', this.value);
            // Load services if not already loaded
            if (!window.servicesData) {
                console.log('DEBUG: No services data, loading services');
                await loadServices();
            } else {
                console.log('DEBUG: Services data exists, re-rendering');
                // Re-render services when pet size changes
                renderServices();
            }
        });
    } else {
        console.log('DEBUG: petSizeForPricing element not found');
    }
}

// Render services based on selected pet size
function renderServices() {
    console.log('DEBUG: renderServices() called');
    const container = document.getElementById('servicesContainer');
    console.log('DEBUG: servicesContainer element:', container);

    if (!window.servicesData) {
        console.log('DEBUG: No servicesData available, showing loading');
        container.innerHTML = `
            <div class="text-center py-8">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto mb-4"></div>
                <p class="text-gray-600">Loading services...</p>
            </div>
        `;
        return;
    }

    const petSizeSelect = document.getElementById('petSizeForPricing');
    const currentPetSize = petSizeSelect ? petSizeSelect.value : '';
    console.log('DEBUG: Current pet size selected:', currentPetSize);

    if (!currentPetSize) {
        console.log('DEBUG: No pet size selected, showing prompt');
        container.innerHTML = `
            <div class="text-center py-8">
                <svg class="w-12 h-12 text-amber-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-amber-600 font-medium">Please select your pet's size first</p>
                <p class="text-sm text-amber-500">This will show accurate pricing for all services</p>
            </div>
        `;
        return;
    }

    console.log('DEBUG: Rendering services for pet size:', currentPetSize);
    console.log('DEBUG: Available services data:', window.servicesData);

    let html = '';

    // Basic Services
    if (window.servicesData.basic && window.servicesData.basic.length > 0) {
        console.log('DEBUG: Rendering basic services:', window.servicesData.basic.length, 'services');
        html += renderServiceCategory('basic', '✂️ Basic Services', 'blue', window.servicesData.basic);
    }

    // Package Services
    if (window.servicesData.package && window.servicesData.package.length > 0) {
        console.log('DEBUG: Rendering package services:', window.servicesData.package.length, 'services');
        html += renderServiceCategory('package', '📦 Grooming Packages', 'purple', window.servicesData.package);
    }

    // Add-on Services
    if (window.servicesData.addon && window.servicesData.addon.length > 0) {
        console.log('DEBUG: Rendering addon services:', window.servicesData.addon.length, 'services');
        html += renderServiceCategory('addon', '🎀 Add-Ons & Finishing Touches', 'green', window.servicesData.addon);
    }

    console.log('DEBUG: Generated HTML length:', html.length);
    container.innerHTML = html;

    // Re-attach event listeners
    const checkboxes = document.querySelectorAll('.service-checkbox');
    console.log('DEBUG: Found', checkboxes.length, 'service checkboxes to attach listeners to');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateServiceSelection);
    });
}

// Render service category
function renderServiceCategory(categoryKey, categoryTitle, color, services) {
    const colorClasses = {
        blue: {
            gradient: 'from-blue-50 to-indigo-50',
            border: 'border-blue-200',
            iconBg: 'bg-blue-100',
            iconText: 'text-blue-600',
            titleText: 'text-blue-900',
            itemBorder: 'border-blue-200 hover:border-blue-300'
        },
        purple: {
            gradient: 'from-purple-50 to-pink-50',
            border: 'border-purple-200',
            iconBg: 'bg-purple-100',
            iconText: 'text-purple-600',
            titleText: 'text-purple-900',
            itemBorder: 'border-purple-200 hover:border-purple-300'
        },
        green: {
            gradient: 'from-green-50 to-emerald-50',
            border: 'border-green-200',
            iconBg: 'bg-green-100',
            iconText: 'text-green-600',
            titleText: 'text-green-900',
            itemBorder: 'border-green-200 hover:border-green-300'
        }
    };

    const colors = colorClasses[color];
    const petSizeSelect = document.getElementById('petSizeForPricing');
    const currentPetSize = petSizeSelect ? petSizeSelect.value : '';

    let html = `
        <div class="bg-gradient-to-r ${colors.gradient} border-2 ${colors.border} rounded-xl p-6 shadow-sm">
            <div class="flex items-center mb-4">
                <div class="inline-flex items-center justify-center w-10 h-10 ${colors.iconBg} rounded-full mr-3">
                    <svg class="w-6 h-6 ${colors.iconText}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${getCategoryIcon(categoryKey)}
                    </svg>
                </div>
                <h3 class="text-lg font-semibold ${colors.titleText}">${categoryTitle}</h3>
            </div>
            <div class="space-y-4">
    `;

   services.forEach(service => {
    // Handle package services differently - show with customization options
    if (categoryKey === 'package') {
        html += renderCustomizablePackage(service, colors);
    } else {
        // Regular service rendering
        const price = getServicePrice(service, currentPetSize);
        let priceDisplay = '';
        let isDisabled = false;

        if (service.is_size_based && currentPetSize && price > 0) {
            priceDisplay = `₱${price.toFixed(2)}`;
            isDisabled = false;
        } else if (service.is_size_based && !currentPetSize) {
            if (service.base_price && service.base_price > 0) {
                priceDisplay = `From ₱${service.base_price.toFixed(2)}`;
            } else {
                const prices = Object.values(service.pricing || {});
                if (prices.length > 0) {
                    const minPrice = Math.min(...prices);
                    priceDisplay = `From ₱${minPrice.toFixed(2)}`;
                } else {
                    priceDisplay = 'Select pet size first';
                }
            }
            isDisabled = true;
        } else if (!service.is_size_based) {
            if (price > 0) {
                priceDisplay = `₱${price.toFixed(2)}`;
                isDisabled = false;
            } else if (service.base_price && service.base_price > 0) {
                priceDisplay = `₱${service.base_price.toFixed(2)}`;
                isDisabled = false;
            } else {
                priceDisplay = 'Price not available';
                isDisabled = true;
            }
        } else {
            priceDisplay = 'Select pet size first';
            isDisabled = true;
        }

        html += `
            <label class="flex items-center p-4 bg-white/80 rounded-lg border ${colors.itemBorder} transition-all duration-200 cursor-pointer hover:shadow-md ${isDisabled ? 'opacity-60' : ''}">
                <input type="checkbox" class="service-checkbox w-5 h-5 text-primary rounded"
                        data-service-id="${service.id}"
                        data-service="${service.name}"
                        data-price="${price}"
                        ${isDisabled ? 'disabled data-original-disabled="true"' : ''}>
                <div class="ml-4 flex-1 flex justify-between items-center">
                    <div>
                        <span class="font-medium text-gray-900">${service.name}</span>
                        <p class="text-sm text-gray-600">${service.description}</p>
                        ${service.is_size_based ? `<p class="text-xs text-gray-500 mt-1">Size-based pricing</p>` : ''}
                        ${isDisabled && service.is_size_based ? `<p class="text-xs text-amber-600 mt-1">Please select pet size above</p>` : ''}
                    </div>
                    <span class="text-lg font-bold text-primary">${priceDisplay}</span>
                </div>
            </label>
        `;
    }
});

    html += `
            </div>
        </div>
    `;

    return html;
}

// Get service price based on pet size
function getServicePrice(service, petSize) {
    if (service.is_size_based && petSize && service.pricing && service.pricing[petSize]) {
        return service.pricing[petSize];
    }

    if (!service.is_size_based) {
        if (service.pricing && Object.keys(service.pricing).length > 0) {
            return Object.values(service.pricing)[0];
        }
        if (service.base_price && service.base_price > 0) {
            return service.base_price;
        }
    }

    return 0;
}

// Render customizable package
function renderCustomizablePackage(service, colors) {
    const packageName = service.name;
    const packageItems = packageContents[packageName] || [];
    const basePrice = getServicePrice(service, document.getElementById('petSizeForPricing')?.value || '');
    const packageId = `package-${service.id}`;

    // Initialize package customization if not exists
    if (!packageCustomizations[packageId]) {
        packageCustomizations[packageId] = {
            selected: false,
            excludedServices: []
        };
    }

    const customization = packageCustomizations[packageId];
    const includedServices = packageItems.filter(item => !customization.excludedServices.includes(item.name));
    const excludedServices = packageItems.filter(item => customization.excludedServices.includes(item.name));

    // Safety check - if no package items defined, return empty
    if (packageItems.length === 0) {
        return '';
    }

    // Calculate customized price
    let customizedPrice = basePrice;
    if (customization.selected) {
        // Subtract price of excluded services (simplified calculation)
        excludedServices.forEach(excluded => {
            // Estimate exclusion discount (this is simplified)
            const exclusionDiscount = basePrice * 0.15; // 15% per excluded service
            customizedPrice -= exclusionDiscount;
        });
        customizedPrice = Math.max(customizedPrice, basePrice * 0.6); // Minimum 60% of base price
    }

    const petSizeSelect = document.getElementById('petSizeForPricing');
    const currentPetSize = petSizeSelect ? petSizeSelect.value : '';

    let priceDisplay = '';
    if (service.is_size_based && currentPetSize && basePrice > 0) {
        priceDisplay = customization.selected && excludedServices.length > 0
            ? `₱${basePrice.toFixed(2)} → ₱${customizedPrice.toFixed(2)}`
            : `₱${basePrice.toFixed(2)}`;
    } else {
        priceDisplay = 'Select pet size first';
    }

    let html = `
        <div class="bg-white/80 rounded-lg border ${colors.itemBorder} transition-all duration-200 hover:shadow-md">
            <label class="flex items-center p-4 cursor-pointer">
                <input type="checkbox" class="package-checkbox w-5 h-5 text-primary rounded"
                        data-package-id="${packageId}"
                        data-service-id="${service.id}"
                        data-service="${service.name}"
                        data-base-price="${basePrice}"
                        ${customization.selected ? 'checked' : ''}>
                <div class="ml-4 flex-1 flex justify-between items-center">
                    <div>
                        <span class="font-medium text-gray-900">${service.name}</span>
                        <p class="text-sm text-gray-600">${service.description}</p>
                        <p class="text-xs text-gray-500 mt-1">Click to customize package contents</p>
                    </div>
                    <span class="text-lg font-bold text-primary">${priceDisplay}</span>
                </div>
            </label>`;

    // Show package contents when selected
    if (customization.selected) {
        html += `
            <div class="px-4 pb-4 border-t border-gray-200 mt-2 pt-3">
                <p class="text-sm font-medium text-gray-700 mb-3">Customize your package:</p>
                <div class="space-y-2">`;

        packageItems.forEach(item => {
            const isExcluded = customization.excludedServices.includes(item.name);
            const isRequired = item.required;

            html += `
                <label class="flex items-center text-sm">
                    <input type="checkbox"
                            class="package-item-checkbox w-4 h-4 text-primary rounded"
                            data-package-id="${packageId}"
                            data-service-name="${item.name}"
                            ${!isExcluded ? 'checked' : ''}
                            ${isRequired ? 'disabled' : ''}>
                    <span class="ml-2 ${isRequired ? 'text-gray-600' : isExcluded ? 'line-through text-gray-400' : 'text-gray-700'}">
                        ${item.name} ${isRequired ? '(required)' : ''}
                    </span>
                </label>`;
        });

        html += `
                </div>
                ${excludedServices.length > 0 ? `<p class="text-xs text-amber-600 mt-2">Price adjusted for excluded services</p>` : ''}
            </div>`;
    }

    html += `
        </div>`;

    return html;
}

// Handle package selection
function handlePackageSelection(event) {
    const checkbox = event.target;
    const packageId = checkbox.dataset.packageId;
    const serviceName = checkbox.dataset.service;
    const basePrice = parseFloat(checkbox.dataset.basePrice);

    // Update package customization state
    packageCustomizations[packageId].selected = checkbox.checked;

    // If unchecking package, reset customizations
    if (!checkbox.checked) {
        packageCustomizations[packageId].excludedServices = [];
    }

    // Re-render services to show/hide package customization options
    renderServices();

    // Update service selection after re-rendering
    updateServiceSelection();
}

// Handle package item toggle
function handlePackageItemToggle(event) {
    const checkbox = event.target;
    const packageId = checkbox.dataset.packageId;
    const serviceName = checkbox.dataset.serviceName;

    if (!checkbox.checked) {
        // Add to excluded services
        if (!packageCustomizations[packageId].excludedServices.includes(serviceName)) {
            packageCustomizations[packageId].excludedServices.push(serviceName);
        }
    } else {
        // Remove from excluded services
        packageCustomizations[packageId].excludedServices =
            packageCustomizations[packageId].excludedServices.filter(name => name !== serviceName);
    }

    // Re-render services to update pricing
    renderServices();

    // Update service selection and order summary
    updateServiceSelection();
}

// Get category icon
function getCategoryIcon(category) {
    const icons = {
        basic: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>',
        package: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>',
        addon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12z"></path>'
    };

    return icons[category] || icons.basic;
}

// Handle service selection with conflict resolution and package customizations
function updateServiceSelection() {
    const selectedServices = [];
    let totalAmount = 0;

    // Get all checked regular service checkboxes
    const checkedBoxes = document.querySelectorAll('.service-checkbox:checked');

    // Get selected packages with customizations
    const selectedPackages = Object.entries(packageCustomizations)
        .filter(([packageId, customization]) => customization.selected)
        .map(([packageId, customization]) => {
            const checkbox = document.querySelector(`[data-package-id="${packageId}"]`);
            if (checkbox) {
                const basePrice = parseFloat(checkbox.dataset.basePrice);
                const packageItems = packageContents[checkbox.dataset.service] || [];
                const includedServices = packageItems.filter(item =>
                    !customization.excludedServices.includes(item.name)
                );

                // Calculate customized price
                let customizedPrice = basePrice;
                customization.excludedServices.forEach(() => {
                    const exclusionDiscount = basePrice * 0.15; // 15% per excluded service
                    customizedPrice -= exclusionDiscount;
                });
                customizedPrice = Math.max(customizedPrice, basePrice * 0.6); // Minimum 60% of base price

                return {
                    id: parseInt(checkbox.dataset.serviceId),
                    name: `${checkbox.dataset.service} (Customized)`,
                    price: customizedPrice,
                    customizations: {
                        ...customization,
                        includedServices: packageItems.filter(item =>
                            !customization.excludedServices.includes(item.name)
                        ).map(item => item.name)
                    }
                };
            }
            return null;
        }).filter(pkg => pkg !== null);

    // Track selected services by name for conflict checking
    const selectedServiceNames = new Set();

    // Add regular services
    checkedBoxes.forEach(checkbox => {
        const service = {
            id: parseInt(checkbox.dataset.serviceId),
            name: checkbox.dataset.service,
            price: parseFloat(checkbox.dataset.price)
        };
        selectedServices.push(service);
        selectedServiceNames.add(service.name);
        totalAmount += service.price;
    });

    // Add customized packages
    selectedPackages.forEach(pkg => {
        selectedServices.push(pkg);
        selectedServiceNames.add(pkg.name.split(' (Customized)')[0]); // Add base package name for conflicts
        totalAmount += pkg.price;
    });

    // Define service conflicts for customizable package system
    // NOTE: Conflicts are unidirectional - packages disable individual services they contain,
    // but individual services don't disable packages
    const serviceConflicts = {
        // Package conflicts (only one package allowed at a time - all packages include Bath & Dry)
        'Essential Grooming Package': ['Full Grooming Package', 'Bath & Brush Package', 'Spa Relaxation Package'],
        'Full Grooming Package': ['Essential Grooming Package', 'Bath & Brush Package', 'Spa Relaxation Package'],
        'Bath & Brush Package': ['Essential Grooming Package', 'Full Grooming Package', 'Spa Relaxation Package'],
        'Spa Relaxation Package': ['Essential Grooming Package', 'Full Grooming Package', 'Bath & Brush Package'],

        // Individual services don't conflict with packages - packages disable individual services they contain
        // Add-ons can be combined with anything (no conflicts)
        'Extra Nail Polish': [],
        'Scented Cologne': [],
        'Bow or Bandana': [],
        'Paw Balm': [],
        'Whitening Shampoo': [],
        'Flea & Tick Treatment': []
    };

    // Apply granular mutual exclusion logic for regular services
    document.querySelectorAll('.service-checkbox').forEach(checkbox => {
        const serviceContainer = checkbox.closest('.bg-gradient-to-r');
        if (serviceContainer) {
            const categoryTitle = serviceContainer.querySelector('h3').textContent;
            const serviceName = checkbox.dataset.service;

            // Skip add-ons - they can always be selected
            if (categoryTitle === '🎀 Add-Ons & Finishing Touches') {
                if (!checkbox.hasAttribute('data-original-disabled')) {
                    checkbox.disabled = false;
                    checkbox.closest('label').classList.remove('opacity-50', 'cursor-not-allowed');
                    checkbox.closest('label').classList.add('cursor-pointer');
                }
                return;
            }

            // Check if this service conflicts with any currently selected services
            let isConflicted = false;
            for (const selectedName of selectedServiceNames) {
                // For packages: bidirectional conflicts (only one package at a time)
                if (categoryTitle === '📦 Grooming Packages' && serviceConflicts[serviceName]?.includes(selectedName)) {
                    isConflicted = true;
                    break;
                }
                if (categoryTitle === '📦 Grooming Packages' && serviceConflicts[selectedName]?.includes(serviceName)) {
                    isConflicted = true;
                    break;
                }

                // For basic services: only conflict if a selected package includes this service
                // (unidirectional - packages disable individual services they contain)
                if (categoryTitle === '✂️ Basic Services') {
                    // Check if any selected package includes this service
                    for (const pkg of selectedPackages) {
                        const packageName = pkg.name.replace(' (Customized)', '');
                        const pkgContents = packageContents[packageName] || [];
                        const includedServices = pkgContents.filter(item =>
                            !pkg.customizations.excludedServices.includes(item.name)
                        );

                        if (includedServices.some(s => s.name === serviceName)) {
                            isConflicted = true;
                            break;
                        }
                    }
                    if (isConflicted) break;
                }
            }

            if (isConflicted && !checkbox.checked) {
                // Disable conflicting service
                checkbox.disabled = true;
                checkbox.closest('label').classList.add('opacity-50', 'cursor-not-allowed');
                checkbox.closest('label').classList.remove('cursor-pointer');
            } else if (!checkbox.hasAttribute('data-original-disabled')) {
                // Re-enable service if no conflicts and not originally disabled
                checkbox.disabled = false;
                checkbox.closest('label').classList.remove('opacity-50', 'cursor-not-allowed');
                checkbox.closest('label').classList.add('cursor-pointer');
            }
        }
    });

    // Handle package conflicts - disable services included in selected packages
    // But DON'T uncheck them - just disable them visually
    selectedPackages.forEach(pkg => {
        const packageName = pkg.name.replace(' (Customized)', '');
        const pkgContents = packageContents[packageName] || [];

        // Get the included services for this package
        const includedServices = pkgContents.filter(item =>
            !pkg.customizations.excludedServices.includes(item.name)
        );

        // Disable basic services that are included in this package (but don't uncheck them)
        includedServices.forEach(includedService => {
            const serviceCheckbox = document.querySelector(`.service-checkbox[data-service="${includedService.name}"]`);
            if (serviceCheckbox && !serviceCheckbox.hasAttribute('data-original-disabled')) {
                serviceCheckbox.disabled = true;
                serviceCheckbox.closest('label').classList.add('opacity-50', 'cursor-not-allowed');
                serviceCheckbox.closest('label').classList.remove('cursor-pointer');
            }
        });
    });

    // Re-enable services that are no longer in conflict
    // Find services that should be enabled but are currently disabled
    document.querySelectorAll('.service-checkbox:disabled').forEach(checkbox => {
        if (checkbox.hasAttribute('data-original-disabled')) return; // Skip originally disabled services

        const serviceName = checkbox.dataset.service;
        let shouldBeDisabled = false;

        // Check if this service is included in any selected package
        for (const pkg of selectedPackages) {
            const packageName = pkg.name.replace(' (Customized)', '');
            const pkgContents = packageContents[packageName] || [];
            const includedServices = pkgContents.filter(item =>
                !pkg.customizations.excludedServices.includes(item.name)
            );

            if (includedServices.some(s => s.name === serviceName)) {
                shouldBeDisabled = true;
                break;
            }
        }

        // If service should not be disabled, re-enable it
        if (!shouldBeDisabled) {
            checkbox.disabled = false;
            checkbox.closest('label').classList.remove('opacity-50', 'cursor-not-allowed');
            checkbox.closest('label').classList.add('cursor-pointer');
        }
    });

    // Disable other packages when one package is selected (since all packages include Bath & Dry)
    if (selectedPackages.length > 0) {
        document.querySelectorAll('.package-checkbox').forEach(checkbox => {
            const packageName = checkbox.dataset.service;
            const isSelected = selectedPackages.some(pkg => pkg.name.includes(packageName));

            if (!isSelected) {
                // Disable other packages
                checkbox.disabled = true;
                const packageContainer = checkbox.closest('.bg-white\\/80');
                if (packageContainer) {
                    packageContainer.classList.add('opacity-50', 'cursor-not-allowed');
                    packageContainer.classList.remove('cursor-pointer');
                }
            }
        });
    } else {
        // Re-enable all packages if no package is selected
        document.querySelectorAll('.package-checkbox').forEach(checkbox => {
            checkbox.disabled = false;
            const packageContainer = checkbox.closest('.bg-white\\/80');
            if (packageContainer) {
                packageContainer.classList.remove('opacity-50', 'cursor-not-allowed');
                packageContainer.classList.add('cursor-pointer');
            }
        });
    }

    // Apply package conflicts - disable conflicting packages (only if packages exist)
    if (window.servicesData?.package && Array.isArray(window.servicesData.package) && window.servicesData.package.length > 0) {
        document.querySelectorAll('.package-checkbox').forEach(checkbox => {
            const packageName = checkbox.dataset.service;
            const packageContainer = checkbox.closest('.bg-white\\/80');

            // Check if this package conflicts with any currently selected services/packages
            let isConflicted = false;
            for (const selectedName of selectedServiceNames) {
                // Check if current package conflicts with selected service/package
                if (serviceConflicts[packageName]?.includes(selectedName)) {
                    isConflicted = true;
                    break;
                }
                // Check if selected service/package conflicts with current package
                if (serviceConflicts[selectedName]?.includes(packageName)) {
                    isConflicted = true;
                    break;
                }
            }

            if (isConflicted && !checkbox.checked) {
                // Disable conflicting package
                checkbox.disabled = true;
                packageContainer.classList.add('opacity-50', 'cursor-not-allowed');
                packageContainer.classList.remove('cursor-pointer');
            } else {
                // Re-enable package if no conflicts
                checkbox.disabled = false;
                packageContainer.classList.remove('opacity-50', 'cursor-not-allowed');
                packageContainer.classList.add('cursor-pointer');
            }
        });
    }

    updateOrderSummary();

    // Update total in the UI
    // More specific selector for the appointment form's total
    const totalElement = document.querySelector('#totalAmount') ||
                        document.querySelector('#appointment .text-2xl.font-bold.text-gold-600') ||
                        document.querySelector('#appointmentTotal');

    if (totalElement) {
        totalElement.textContent = `₱${totalAmount.toFixed(2)}`;
    }
}

// Update order summary display
function updateOrderSummary() {
    const servicesContainer = document.getElementById('selectedServices');
    const totalElement = document.querySelector('.text-lg.font-bold.text-primary:last-child') ||
                        document.querySelector('#appointmentTotal') ||
                        document.querySelector('[class*="text-lg"][class*="font-bold"][class*="text-primary"]');

    // Get selected services
    const selectedServices = [];
    let totalAmount = 0;

    // Get all checked service checkboxes (including add-ons and packages)
    const checkedBoxes = document.querySelectorAll('input[type="checkbox"]:checked');
    checkedBoxes.forEach(checkbox => {
        // Skip package item checkboxes (those are for customization)
        if (checkbox.classList.contains('package-item-checkbox')) {
            return;
        }

        // Skip package checkboxes (they're handled separately)
        if (checkbox.classList.contains('package-checkbox')) {
            return;
        }

        const service = {
            id: parseInt(checkbox.dataset.serviceId) || 0,
            name: checkbox.dataset.service || 'Unknown Service',
            price: parseFloat(checkbox.dataset.price) || 0
        };
        selectedServices.push(service);
        totalAmount += service.price;
    });

    // Get selected packages with customizations
    const selectedPackages = Object.entries(packageCustomizations)
        .filter(([packageId, customization]) => customization.selected)
        .map(([packageId, customization]) => {
            const checkbox = document.querySelector(`[data-package-id="${packageId}"]`);
            if (checkbox) {
                const basePrice = parseFloat(checkbox.dataset.basePrice) || 0;
                console.log('DEBUG: Package base price for', checkbox.dataset.service, ':', basePrice);
                const packageItems = packageContents[checkbox.dataset.service] || [];
                const includedServices = packageItems.filter(item =>
                    !customization.excludedServices.includes(item.name)
                );

                // Calculate customized price
                let customizedPrice = basePrice;
                customization.excludedServices.forEach(() => {
                    const exclusionDiscount = basePrice * 0.15; // 15% per excluded service
                    customizedPrice -= exclusionDiscount;
                });
                customizedPrice = Math.max(customizedPrice, basePrice * 0.6); // Minimum 60% of base price

                console.log('DEBUG: Customized price for', checkbox.dataset.service, ':', customizedPrice);

                return {
                    id: parseInt(checkbox.dataset.serviceId),
                    name: `${checkbox.dataset.service} (Customized)`,
                    price: customizedPrice,
                    customizations: {
                        ...customization,
                        includedServices: includedServices.map(item => item.name)
                    }
                };
            }
            return null;
        }).filter(pkg => pkg !== null);

    // Add customized packages to selected services
    selectedPackages.forEach(pkg => {
        selectedServices.push(pkg);
        totalAmount += pkg.price;
    });

    console.log('DEBUG: Selected services for summary:', selectedServices);
    console.log('DEBUG: Selected packages for summary:', selectedPackages);
    console.log('DEBUG: Total amount calculated:', totalAmount);

    if (selectedServices.length === 0) {
        servicesContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No services selected</p>';
    } else {
        let html = '';

        selectedServices.forEach(service => {
            // Check if this is a customized package
            if (service.customizations && service.customizations.selected) {
                const packageName = service.name.replace(' (Customized)', '');
                const packageItems = packageContents[packageName] || [];
                const includedServices = packageItems.filter(item =>
                    !service.customizations.excludedServices.includes(item.name)
                );
                const excludedServices = packageItems.filter(item =>
                    service.customizations.excludedServices.includes(item.name)
                );

                // Show package header
                html += `<div class="flex justify-between items-center font-medium text-gray-900 border-b border-gray-200 pb-1 mb-2">
                    <span>${packageName} (Customized)</span>
                    <span>₱${service.price.toFixed(2)}</span>
                </div>`;

                // Show included services
                includedServices.forEach(item => {
                    html += `<div class="flex justify-between items-center text-sm ml-4 text-green-700">
                        <span>✓ ${item.name}</span>
                        <span class="text-xs">(included)</span>
                    </div>`;
                });

                // Show excluded services
                excludedServices.forEach(item => {
                    html += `<div class="flex justify-between items-center text-sm ml-4 text-gray-400 line-through">
                        <span>✗ ${item.name}</span>
                        <span class="text-xs">(excluded)</span>
                    </div>`;
                });

                html += '<div class="mb-3"></div>'; // Spacing between packages
            } else {
                // Regular service
                html += `<div class="flex justify-between items-center">
                    <span>${service.name}</span>
                    <span class="font-semibold">₱${service.price.toFixed(2)}</span>
                </div>`;
            }
        });

        servicesContainer.innerHTML = html;
    }

    if (totalElement) {
        totalElement.textContent = `₱${totalAmount.toFixed(2)}`;
        console.log('DEBUG: Updated total element to:', totalElement.textContent);
    } else {
        console.log('DEBUG: Total element not found, trying alternative selectors');
        // Try more specific selectors for the appointment form
        const appointmentTotal = document.querySelector('#appointment .text-lg.font-bold.text-primary');
        if (appointmentTotal) {
            appointmentTotal.textContent = `₱${totalAmount.toFixed(2)}`;
            console.log('DEBUG: Updated appointment total element to:', appointmentTotal.textContent);
        } else {
            console.log('DEBUG: Appointment total element also not found');
        }
    }
}



async function loadBreeds(petType, breedSelect) {
    try {
        breedSelect.innerHTML = '<option value="">Loading breeds...</option>';
        breedSelect.disabled = false;
        
        let apiUrl = '';
        if (petType === 'dog') {
            apiUrl = 'https://dog.ceo/api/breeds/list/all';
        } else if (petType === 'cat') {
            apiUrl = 'https://api.thecatapi.com/v1/breeds';
        }
        
        if (!apiUrl) {
            breedSelect.innerHTML = '<option value="">Select breed</option>';
            return;
        }
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        breedSelect.innerHTML = '<option value="">Select breed</option>';
        
        if (petType === 'dog') {
            const breeds = Object.keys(data.message);
            breeds.sort().forEach(breed => {
                const option = document.createElement('option');
                option.value = breed;
                option.textContent = breed.charAt(0).toUpperCase() + breed.slice(1).replace(/[-_]/g, ' ');
                breedSelect.appendChild(option);
            });
        } else if (petType === 'cat') {
            data.sort((a, b) => a.name.localeCompare(b.name)).forEach(breed => {
                const option = document.createElement('option');
                option.value = breed.name;
                option.textContent = breed.name;
                breedSelect.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error loading breeds:', error);
        breedSelect.innerHTML = '<option value="">Error loading breeds</option>';
    }
}

// Handle appointment form submission
async function handleAppointmentSubmission(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    // Validate required fields
    const petName = formData.get('petName');
    const petType = formData.get('petType');
    const petBreed = formData.get('petBreed');
    const preferredDate = formData.get('preferredDate');
    const preferredTime = formData.get('preferredTime');
    
    if (!petName || !petType || !petBreed || !preferredDate || !preferredTime) {
        showNotification('Please fill in all required fields', 'warning');
        return;
    }
    
    // Get selected services using the same logic as updateServiceSelection
    const selectedServices = [];
    let totalAmount = 0;

    // Get all checked regular service checkboxes
    const checkedBoxes = document.querySelectorAll('.service-checkbox:checked');

    // Get selected packages with customizations
    const selectedPackages = Object.entries(packageCustomizations)
        .filter(([packageId, customization]) => customization.selected)
        .map(([packageId, customization]) => {
            const checkbox = document.querySelector(`[data-package-id="${packageId}"]`);
            if (checkbox) {
                const basePrice = parseFloat(checkbox.dataset.basePrice);
                const packageItems = packageContents[checkbox.dataset.service] || [];
                const includedServices = packageItems.filter(item =>
                    !customization.excludedServices.includes(item.name)
                );

                // Calculate customized price
                let customizedPrice = basePrice;
                customization.excludedServices.forEach(() => {
                    const exclusionDiscount = basePrice * 0.15; // 15% per excluded service
                    customizedPrice -= exclusionDiscount;
                });
                customizedPrice = Math.max(customizedPrice, basePrice * 0.6); // Minimum 60% of base price

                return {
                    id: parseInt(checkbox.dataset.serviceId),
                    name: `${checkbox.dataset.service} (Customized)`,
                    price: customizedPrice,
                    customizations: {
                        ...customization,
                        includedServices: packageItems.filter(item =>
                            !customization.excludedServices.includes(item.name)
                        ).map(item => item.name)
                    }
                };
            }
            return null;
        }).filter(pkg => pkg !== null);

    // Add regular services
    checkedBoxes.forEach(checkbox => {
        const service = {
            id: parseInt(checkbox.dataset.serviceId),
            name: checkbox.dataset.service,
            price: parseFloat(checkbox.dataset.price)
        };
        selectedServices.push(service);
        totalAmount += service.price;
    });

    // Add customized packages
    selectedPackages.forEach(pkg => {
        selectedServices.push(pkg);
        totalAmount += pkg.price;
    });

    if (selectedServices.length === 0) {
        showNotification('Please select at least one service', 'warning');
        return;
    }
    
    try {
        const token = localStorage.getItem('authToken');
        
        showNotification('Booking appointment...', 'info');
        
        // Prepare package customizations data
        const packageCustomizationsData = {};
        Object.entries(packageCustomizations).forEach(([packageId, customization]) => {
            if (customization.selected) {
                // Find the package name by matching the packageId
                let packageName = null;
                for (const [name, contents] of Object.entries(packageContents)) {
                    // Check if this package exists in servicesData
                    const serviceData = window.servicesData?.package?.find(p => p.name === name);
                    if (serviceData && `package-${serviceData.id}` === packageId) {
                        packageName = name;
                        break;
                    }
                }

                if (packageName) {
                    packageCustomizationsData[packageName] = {
                        selected: true,
                        excludedServices: customization.excludedServices,
                        includedServices: packageContents[packageName]
                            .filter(item => !customization.excludedServices.includes(item.name))
                            .map(item => item.name)
                    };
                }
            }
        });

        // Extract service IDs for API submission
        const serviceIds = selectedServices.map(service => service.id);

        const appointmentData = {
            action: 'book_appointment',
            petName: petName,
            petType: petType,
            petBreed: petBreed,
            petAge: formData.get('petAge'),
            petSize: formData.get('petSize'),
            petSizeForPricing: formData.get('petSizeForPricing'),
            preferredDate: preferredDate,
            preferredTime: preferredTime,
            preferredStaff: formData.get('preferredStaff'),
            services: serviceIds,
            packageCustomizations: packageCustomizationsData,
            specialInstructions: formData.get('specialInstructions')
        };
        
        const response = await fetch(`${API_BASE}appointments.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(appointmentData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Appointment booked successfully!', 'success');
            
            // Reset form
            form.reset();
            document.querySelectorAll('.service-checkbox').forEach(cb => cb.checked = false);
            updateOrderSummary();
            
            // Optionally switch to tracking section
            setTimeout(() => {
                showSection('tracking');
            }, 2000);
            
        } else {
            throw new Error(result.error || 'Failed to book appointment');
        }
        
    } catch (error) {
        console.error('Error booking appointment:', error);
        showNotification('Error booking appointment: ' + error.message, 'error');
    }
}

// Function to populate services in customer portal with improved UI and expandable packages
function populateCustomerServices(services) {
    const servicesContainer = document.getElementById('servicesContainer');

    if (!services || services.length === 0) {
        servicesContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No services selected</p>';
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
        regularServices.forEach(service => {
            html += `
                <div class="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
                    <span class="font-medium text-gray-900">${service.name}</span>
                    <span class="text-lg font-bold text-primary">₱${parseFloat(service.price || 0).toFixed(2)}</span>
                </div>
            `;
        });
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
            <div class="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
                <div class="flex items-center cursor-pointer package-header" data-package="${packageName.replace(/\s+/g, '-').toLowerCase()}">
                    <span class="font-medium text-gray-900">${packageName}${isCustomized ? ' (Customized)' : ''}</span>
                    <span class="text-sm text-gray-700 bg-gray-200 px-2 py-1 rounded-full ml-2">Package</span>
                    <svg class="w-4 h-4 text-primary ml-2 transform transition-transform duration-200 package-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
                <span class="text-lg font-bold text-primary">₱${packagePrice.toFixed(2)}</span>
            </div>
            <div class="package-details hidden px-4 pb-3">
                <div class="border-t border-gray-200 pt-3 mt-2">
                    <p class="text-sm font-medium text-gray-800 mb-3">Package Contents:</p>
                    <div class="space-y-2">
                        ${packageServices.map(service => {
                            if (service.included) {
                                return `
                                    <div class="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
                                        <span class="font-medium text-gray-900">${service.name}</span>
                                        <span class="text-sm text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">Included</span>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div class="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200 opacity-60">
                                        <span class="font-medium text-gray-500 line-through">${service.name}</span>
                                        <span class="text-sm text-red-500 font-medium bg-red-50 px-2 py-1 rounded-full">Excluded</span>
                                    </div>
                                `;
                            }
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    });

    servicesContainer.innerHTML = html;

    // Add click handlers for package expansion
    document.querySelectorAll('.package-header').forEach(header => {
        header.addEventListener('click', function() {
            const packageId = this.dataset.package;
            // Find the package-details that comes after this header's parent div
            const parentDiv = this.closest('.flex.justify-between.items-center');
            const details = parentDiv.nextElementSibling;
            const arrow = this.querySelector('.package-arrow');

            if (details && details.classList.contains('package-details') && arrow) {
                if (details.classList.contains('hidden')) {
                    details.classList.remove('hidden');
                    arrow.style.transform = 'rotate(180deg)';
                } else {
                    details.classList.add('hidden');
                    arrow.style.transform = 'rotate(0deg)';
                }
            }
        });
    });
}

// Load user appointments
async function loadUserAppointments() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}appointments.php?action=get_user_appointments`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            displayUserAppointments(result.appointments);
        } else {
            showNotification('Error loading appointments', 'error');
        }
    } catch (error) {
        console.error('Error loading user appointments:', error);
        showNotification('Error loading appointments', 'error');
    }
}

// Display user appointments
function displayUserAppointments(appointments) {
    const container = document.getElementById('appointmentsContainer');

    if (!appointments || appointments.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-4xl mb-4">🐾</div>
                <p class="text-gray-500 text-lg">No appointments found</p>
                <p class="text-gray-400 text-sm mt-2">Your upcoming appointments will appear here</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="space-y-4">
            ${appointments.map(appointment => `
                <div class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">🐾</div>
                            <div>
                                <h3 class="font-semibold text-gray-900 text-lg">${appointment.pet_name}</h3>
                                <p class="text-sm text-gray-600">${appointment.pet_type} • ${appointment.pet_breed}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-sm text-gray-500 mb-1">${formatAppointmentDate(appointment.appointment_date)}</div>
                            <div class="text-sm font-medium text-gray-700">${formatAppointmentTime(appointment.appointment_time)}</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div class="bg-gray-50 rounded p-3">
                            <div class="text-xs text-gray-500 uppercase tracking-wide">Status</div>
                            <div class="flex items-center space-x-2">
                                <div class="w-3 h-3 rounded-full ${getStatusColorCircle(appointment.status)}"></div>
                                <div class="text-sm font-medium text-gray-900 capitalize">${appointment.status}</div>
                            </div>
                        </div>
                        <div class="bg-primary/10 rounded p-3">
                            <div class="text-xs text-primary uppercase tracking-wide">Total Amount</div>
                            <div class="text-lg font-bold text-primary">₱${parseFloat(appointment.total_amount).toFixed(2)}</div>
                        </div>
                    </div>

                    <div class="flex items-center justify-between">
                        <div class="text-sm text-gray-600">
                            <span class="font-medium">Services:</span>
                            <span>${appointment.services ? appointment.services.map(s => s.name).join(', ') : 'None'}</span>
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="viewAppointmentDetails('${appointment.id}')" class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200">
                                View Details
                            </button>
                            ${appointment.status === 'scheduled' ? `
                                <button onclick="cancelAppointment('${appointment.id}')" class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200">
                                    Cancel
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function formatAppointmentDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatAppointmentTime(timeString) {
    // Convert 24-hour time to 12-hour format
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

function getStatusColorCircle(status) {
    const statusColors = {
        'scheduled': 'bg-blue-500',
        'confirmed': 'bg-green-500',
        'cancelled': 'bg-red-500',
        'completed': 'bg-gray-500'
    };

    return statusColors[status] || 'bg-gray-400';
}

function getStatusBadgeClass(status) {
    const badgeClasses = {
        'scheduled': 'bg-blue-100 text-blue-800 border border-blue-200',
        'confirmed': 'bg-green-100 text-green-800 border border-green-200',
        'cancelled': 'bg-red-100 text-red-800 border border-red-200',
        'completed': 'bg-gray-100 text-gray-800 border border-gray-200'
    };

    return badgeClasses[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
}

function showVaccinationProofModal(imageSrc) {
    const modalHtml = `
        <div id="vaccinationProofModal" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onclick="closeVaccinationProofModal()">
            <div class="relative max-w-4xl max-h-screen p-4">
                <!-- Close button -->
                <button onclick="closeVaccinationProofModal()" class="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>

                <!-- Image container -->
                <div class="relative" onclick="event.stopPropagation()">
                    <img src="${imageSrc}" alt="Vaccination Proof" class="max-w-full max-h-screen object-contain rounded-lg shadow-2xl">
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
}

function closeVaccinationProofModal() {
    const modal = document.getElementById('vaccinationProofModal');
    if (modal) {
        modal.remove();
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

async function viewAppointmentDetails(appointmentId) {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}appointments.php?action=get_appointment_details&appointment_id=${appointmentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.appointment) {
            showAppointmentDetailsModal(result.appointment);
        } else {
            showNotification('Error loading appointment details', 'error');
        }
    } catch (error) {
        console.error('Error loading appointment details:', error);
        showNotification('Error loading appointment details', 'error');
    }
}

async function editAppointment(appointmentId) {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}appointments.php?action=get_appointment_details&appointment_id=${appointmentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.appointment) {
            showEditAppointmentModal(result.appointment);
        } else {
            showNotification('Error loading appointment details', 'error');
        }
    } catch (error) {
        console.error('Error loading appointment details:', error);
        showNotification('Error loading appointment details', 'error');
    }
}

async function cancelAppointment(appointmentId) {
    showCancelAppointmentModal(appointmentId);
}

// Filter appointments by status
function filterAppointments(status) {
    // Update button styles
    const buttons = document.querySelectorAll('#my-appointments .flex.space-x-2 button');
    buttons.forEach(btn => {
        btn.classList.remove('bg-gold-500', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });

    // Highlight active button
    event.target.classList.remove('bg-gray-200', 'text-gray-700');
    event.target.classList.add('bg-gold-500', 'text-white');

    // Load appointments with filter
    loadUserAppointmentsWithFilter(status);
}

// Load appointments with status filter
async function loadUserAppointmentsWithFilter(status = 'all') {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}appointments.php?action=get_user_appointments&status=${status}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            displayUserAppointments(result.appointments);
        } else {
            showNotification('Error loading appointments', 'error');
        }
    } catch (error) {
        console.error('Error loading filtered appointments:', error);
        showNotification('Error loading appointments', 'error');
    }
}

// Modal functions for appointments
function showAppointmentDetailsModal(appointment) {
    // Create modal HTML for viewing appointment details
    const modalHtml = `
        <div id="appointmentDetailsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div class="bg-white rounded-2xl p-8 max-w-5xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                <!-- Header -->
                <div class="flex items-center justify-between mb-8">
                    <div class="flex items-center space-x-4">
                        <div class="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                            </svg>
                        </div>
                        <div class="flex items-center space-x-4">
                            <h2 class="text-2xl font-bold text-gray-900">Appointment Details</h2>
                            <div class="inline-flex items-center px-3 py-2 rounded-full ${getStatusBadgeClass(appointment.status)}">
                                <div class="w-2 h-2 rounded-full mr-2 ${getStatusColorCircle(appointment.status)}"></div>
                                <span class="text-sm font-medium capitalize">${appointment.status}</span>
                            </div>
                        </div>
                    </div>
                    <button onclick="closeModal('appointmentDetailsModal')" class="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                <!-- Booking ID at Top -->
                <div class="mb-6">
                    <p class="text-sm text-gray-600">Booking ID: ${appointment.id}</p>
                </div>

                <!-- Main Content - Single Column Layout -->
                <div class="space-y-8 mb-8">
                    <!-- Pet Information -->
                    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                        <h3 class="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                            </svg>
                            Pet Information
                        </h3>
                        <div class="space-y-4">
                            <!-- Row 1: Pet Name and Pet Type -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="bg-white p-4 rounded-lg border border-gray-200">
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Pet Name</label>
                                    <p class="text-gray-900 font-medium">${appointment.pet_name}</p>
                                </div>
                                <div class="bg-white p-4 rounded-lg border border-gray-200">
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Pet Type</label>
                                    <p class="text-gray-900 font-medium capitalize">${appointment.pet_type}</p>
                                </div>
                            </div>
                            <!-- Row 2: Breed and Pet Size -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="bg-white p-4 rounded-lg border border-gray-200">
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Breed</label>
                                    <p class="text-gray-900 font-medium">${appointment.pet_breed}</p>
                                </div>
                                <div class="bg-white p-4 rounded-lg border border-gray-200">
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Pet Size</label>
                                    <p class="text-gray-900 font-medium">${appointment.pet_size || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Vaccination Information -->
                    <div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
                        <h3 class="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            Vaccination Information
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <!-- Vaccine Date -->
                            <div class="bg-white p-4 rounded-lg border border-gray-200">
                                ${appointment.last_vaccine_date ? `
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Last Vaccine Update Date</label>
                                    <p class="text-gray-900 font-medium">${new Date(appointment.last_vaccine_date).toLocaleDateString()}</p>
                                ` : `
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Last Vaccine Update Date</label>
                                    <p class="text-gray-500 text-sm">Not provided</p>
                                `}
                            </div>

                            <!-- Vaccine Type -->
                            <div class="bg-white p-4 rounded-lg border border-gray-200">
                                ${appointment.vaccine_types ? `
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Type of Vaccine</label>
                                    <p class="text-gray-900 font-medium capitalize">${(() => {
                                        try {
                                            // Handle JSON array format like ["parvo"] or string format
                                            const vaccineData = typeof appointment.vaccine_types === 'string' ?
                                                JSON.parse(appointment.vaccine_types) : appointment.vaccine_types;
                                            return Array.isArray(vaccineData) ? vaccineData.join(', ') : vaccineData;
                                        } catch (e) {
                                            return appointment.vaccine_types;
                                        }
                                    })()}</p>
                                ` : `
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Type of Vaccine</label>
                                    <p class="text-gray-500 text-sm">Not provided</p>
                                `}
                            </div>

                            <!-- Vaccination Proof Link -->
                            <div class="bg-white p-4 rounded-lg border border-gray-200">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Vaccination Proof</label>
                                ${appointment.vaccination_proof ? `
                                    <button onclick="showVaccinationProofModal('../${appointment.vaccination_proof}')"
                                            class="text-blue-600 hover:text-blue-800 underline font-medium transition-colors">
                                        View Proof
                                    </button>
                                ` : `
                                    <p class="text-gray-500 text-sm">Not uploaded</p>
                                `}
                            </div>
                        </div>
                    </div>

                    <!-- Appointment Details -->
                    <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                        <h3 class="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            Appointment Details
                        </h3>
                        <div class="space-y-4">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="bg-white p-4 rounded-lg border border-gray-200">
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                    <p class="text-gray-900 font-medium">${formatAppointmentDate(appointment.appointment_date)}</p>
                                </div>
                                <div class="bg-white p-4 rounded-lg border border-gray-200">
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Time</label>
                                    <p class="text-gray-900 font-medium">${formatAppointmentTime(appointment.appointment_time)}</p>
                                </div>
                            </div>
                            ${appointment.special_instructions ? `
                                <div class="bg-white p-4 rounded-lg border border-gray-200">
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                                    <p class="text-gray-900">${appointment.special_instructions}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Services -->
                    <div class="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-6">
                        <h3 class="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                            </svg>
                            Services (${appointment.services ? appointment.services.length : 0})
                        </h3>
                        <div class="space-y-3 max-h-80 overflow-y-auto">
                            ${appointment.services ? appointment.services.map(service => `
                                <div class="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                                    <div class="flex justify-between items-start">
                                        <div class="flex-1">
                                            <span class="font-medium text-gray-900">${service.name}</span>
                                            ${service.description ? `<p class="text-sm text-gray-600 mt-1">${service.description}</p>` : ''}
                                        </div>
                                        <span class="text-lg font-bold text-primary ml-4">₱${parseFloat(service.price || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-gray-500 text-center py-4">No services selected</p>'}
                        </div>
                    </div>
                </div>

                <!-- Order Summary -->
                <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6 mb-8">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-semibold text-orange-900 flex items-center gap-2">
                            <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                            </svg>
                            Order Summary
                        </h3>
                        <div class="text-right">
                            <p class="text-sm text-gray-600">Total Amount</p>
                            <p class="text-3xl font-bold text-primary">₱${parseFloat(appointment.total_amount).toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                    <button onclick="closeModal('appointmentDetailsModal')"
                            class="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200">
                        Close
                    </button>
                    ${appointment.status === 'scheduled' ? `
                        <button onclick="closeModal('appointmentDetailsModal'); cancelAppointment('${appointment.id}')"
                                class="px-6 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors duration-200">
                            Cancel Appointment
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function showEditAppointmentModal(appointment) {
    // Map pet size values
    const sizeMapping = {
        'small': 'small',
        'medium': 'medium',
        'large': 'large',
        'xlarge': 'extra_large'
    };

    const petSizeValue = sizeMapping[appointment.pet_size] || appointment.pet_size || '';

    // Create modal HTML
    const modalHtml = `
        <div id="editAppointmentModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold text-gray-900">Edit Appointment</h3>
                        <button onclick="closeModal('editAppointmentModal')" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>

                    <form id="editAppointmentForm" onsubmit="handleEditAppointmentSubmission(event, '${appointment.id}')">
                        <!-- Pet Information -->
                        <div class="mb-6">
                            <h4 class="text-md font-semibold text-gray-800 mb-3">Pet Information</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Pet Name</label>
                                    <input type="text" name="petName" value="${appointment.pet_name}" required
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Pet Type</label>
                                    <select name="petType" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500">
                                        <option value="dog" ${appointment.pet_type === 'dog' ? 'selected' : ''}>Dog</option>
                                        <option value="cat" ${appointment.pet_type === 'cat' ? 'selected' : ''}>Cat</option>
                                        <option value="others" ${appointment.pet_type !== 'dog' && appointment.pet_type !== 'cat' ? 'selected' : ''}>Others</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Breed</label>
                                    <input type="text" name="petBreed" value="${appointment.pet_breed}" required
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Pet Size for Pricing</label>
                                    <select name="petSizeForPricing" id="editPetSizeForPricing" required
                                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500">
                                        <option value="">Select pet size</option>
                                        <option value="small" ${petSizeValue === 'small' ? 'selected' : ''}>Small (0-15 lbs)</option>
                                        <option value="medium" ${petSizeValue === 'medium' ? 'selected' : ''}>Medium (16-40 lbs)</option>
                                        <option value="large" ${petSizeValue === 'large' ? 'selected' : ''}>Large (41-70 lbs)</option>
                                        <option value="extra_large" ${petSizeValue === 'extra_large' ? 'selected' : ''}>Extra Large (71+ lbs)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Appointment Details -->
                        <div class="mb-6">
                            <h4 class="text-md font-semibold text-gray-800 mb-3">Appointment Details</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Preferred Date</label>
                                    <input type="date" name="preferredDate" value="${appointment.appointment_date}" required
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Preferred Time</label>
                                    <input type="time" name="preferredTime" value="${appointment.appointment_time}" required
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500">
                                </div>
                            </div>
                        </div>

                        <!-- Services Section -->
                        <div class="mb-6">
                            <h4 class="text-md font-semibold text-gray-800 mb-3">Services</h4>
                            <div id="editServicesContainer" class="space-y-4">
                                <!-- Services will be loaded here -->
                            </div>
                        </div>

                        <!-- Special Instructions -->
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Special Instructions or Medical Conditions</label>
                            <textarea name="specialInstructions" rows="3"
                                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
                                      placeholder="Any special instructions or medical conditions...">${appointment.special_instructions || ''}</textarea>
                        </div>

                        <!-- Order Summary -->
                        <div class="mb-6">
                            <h4 class="text-md font-semibold text-gray-800 mb-3">Order Summary</h4>
                            <div id="editSelectedServices" class="bg-gray-50 p-4 rounded-md">
                                <p class="text-gray-500 text-center py-4">No services selected</p>
                            </div>
                            <div class="mt-4 text-right">
                                <p class="text-lg font-bold text-primary">Total: ₱<span id="editTotalAmount">${parseFloat(appointment.total_amount).toFixed(2)}</span></p>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex justify-end space-x-3">
                            <button type="button" onclick="closeModal('editAppointmentModal')"
                                    class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                                Cancel
                            </button>
                            <button type="submit"
                                    class="px-4 py-2 bg-gold-500 text-white rounded-md hover:bg-gold-600">
                                Update Appointment
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Load services for editing
    loadServicesForEdit(appointment);
}

function showCancelAppointmentModal(appointmentId) {
    const modalHtml = `
        <div id="cancelAppointmentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div class="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                <div class="text-center">
                    <!-- Warning Icon -->
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                        <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                        </svg>
                    </div>

                    <!-- Title -->
                    <h2 class="text-xl font-bold text-gray-900 mb-3">Cancel Appointment</h2>

                    <!-- Warning Message -->
                    <p class="text-gray-600 mb-8">
                        Are you sure you want to cancel this appointment? This action cannot be undone.
                    </p>

                    <p class="text-sm text-gray-500 mb-8">
                        If you need to reschedule, please book a new appointment after cancelling this one.
                    </p>

                    <!-- Action Buttons -->
                    <div class="flex flex-col sm:flex-row gap-3 justify-center">
                        <button onclick="closeModal('cancelAppointmentModal')"
                                class="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors duration-200">
                            Keep Appointment
                        </button>
                        <button onclick="confirmCancelAppointment('${appointmentId}')"
                                class="px-6 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors duration-200">
                            Cancel Appointment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

async function confirmCancelAppointment(appointmentId) {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}appointments.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'cancel_appointment',
                appointment_id: appointmentId
            })
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Appointment cancelled successfully', 'success');
            loadUserAppointments(); // Reload appointments
            closeModal('cancelAppointmentModal');
        } else {
            showNotification('Error cancelling appointment', 'error');
        }
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        showNotification('Error cancelling appointment', 'error');
    }
}

async function loadServicesForEdit(appointment) {
    const container = document.getElementById('editServicesContainer');
    const petSizeSelect = document.getElementById('editPetSizeForPricing');

    // Load all services
    async function loadServices(petSize) {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE}services.php?action=get_services`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success && result.services) {
                // Get currently selected services
                const currentServiceIds = appointment.services ? appointment.services.map(s => s.id) : [];

                let html = '';

                // Display services by category
                Object.keys(result.services).forEach(category => {
                    const categoryServices = result.services[category];
                    if (categoryServices.length === 0) return;

                    const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);

                    html += `
                        <div class="mb-4">
                            <h5 class="font-medium text-gray-900 mb-2">${categoryTitle} Services</h5>
                            <div class="space-y-2">
                    `;

                    categoryServices.forEach(service => {
                        const isSelected = currentServiceIds.includes(service.id);

                        // Get price based on pet size
                        let price = service.base_price;
                        if (petSize && service.pricing && service.pricing[petSize]) {
                            price = service.pricing[petSize];
                        }

                        html += `
                            <div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md">
                                <div class="flex items-center">
                                    <input type="checkbox"
                                           id="edit-service-${service.id}"
                                           name="services[]"
                                           value="${service.id}"
                                           data-service-id="${service.id}"
                                           data-price="${price}"
                                           data-service="${service.name}"
                                           ${isSelected ? 'checked' : ''}
                                           class="edit-service-checkbox mr-3">
                                    <div>
                                        <label for="edit-service-${service.id}" class="font-medium text-gray-900 cursor-pointer">
                                            ${service.name}
                                        </label>
                                        ${service.description ? `<p class="text-sm text-gray-600">${service.description}</p>` : ''}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <span class="font-bold text-primary">₱${parseFloat(price).toFixed(2)}</span>
                                </div>
                            </div>
                        `;
                    });

                    html += `
                            </div>
                        </div>
                    `;
                });

                container.innerHTML = html;

                // Add event listeners for checkboxes
                document.querySelectorAll('.edit-service-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', updateEditOrderSummary);
                });

                // Update order summary initially
                updateEditOrderSummary();
            }
        } catch (error) {
            console.error('Error loading services:', error);
            container.innerHTML = '<p class="text-red-500">Error loading services</p>';
        }
    }

    // Initial load
    const initialPetSize = petSizeSelect.value;
    if (initialPetSize) {
        await loadServices(initialPetSize);
    }

    // Add event listener for pet size changes
    petSizeSelect.addEventListener('change', async function() {
        const newPetSize = this.value;
        if (newPetSize) {
            await loadServices(newPetSize);
        } else {
            container.innerHTML = '<p class="text-gray-500">Please select a pet size to view services</p>';
        }
    });
}

function updateEditOrderSummary() {
    const selectedServices = [];
    let totalAmount = 0;

    document.querySelectorAll('.edit-service-checkbox:checked').forEach(checkbox => {
        const service = {
            id: parseInt(checkbox.dataset.serviceId),
            name: checkbox.dataset.service,
            price: parseFloat(checkbox.dataset.price)
        };
        selectedServices.push(service);
        totalAmount += service.price;
    });

    const summaryContainer = document.getElementById('editSelectedServices');
    const totalElement = document.getElementById('editTotalAmount');

    if (selectedServices.length === 0) {
        summaryContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No services selected</p>';
    } else {
        let html = '';

        selectedServices.forEach(service => {
            html += `
                <div class="flex justify-between items-center py-2">
                    <span class="text-sm text-gray-900">${service.name}</span>
                    <span class="text-sm font-medium text-primary">₱${service.price.toFixed(2)}</span>
                </div>
            `;
        });

        summaryContainer.innerHTML = html;
    }

    if (totalElement) {
        totalElement.textContent = totalAmount.toFixed(2);
    }
}

async function handleEditAppointmentSubmission(event, appointmentId) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    // Get selected services
    const selectedServices = [];
    document.querySelectorAll('.edit-service-checkbox:checked').forEach(checkbox => {
        selectedServices.push(parseInt(checkbox.value));
    });

    if (selectedServices.length === 0) {
        showNotification('Please select at least one service', 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('authToken');

        const updateData = {
            action: 'update_appointment',
            appointment_id: appointmentId,
            appointment_date: formData.get('preferredDate'),
            appointment_time: formData.get('preferredTime'),
            special_instructions: formData.get('specialInstructions'),
            services: selectedServices
        };

        const response = await fetch(`${API_BASE}appointments.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Appointment updated successfully', 'success');
            loadUserAppointments(); // Reload appointments
            closeModal('editAppointmentModal');
        } else {
            showNotification(result.error || 'Error updating appointment', 'error');
        }
    } catch (error) {
        console.error('Error updating appointment:', error);
        showNotification('Error updating appointment', 'error');
    }
}

// Add this to your DOMContentLoaded event listener in customer_portal.js
document.addEventListener('DOMContentLoaded', async function() {
    // ... existing code ...

    // Initialize appointments when page loads
    await initializeAppointments();

    // Add form submission handler
    const appointmentForm = document.querySelector('#appointment form');
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', handleAppointmentSubmission);
    }

    // ... rest of existing code ...
});