// API base URL - adjust this to your server location
const API_BASE = 'http://localhost/animates/api/';

// Mobile menu toggle function
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('hidden');
}

let servicesData = {};
let currentPetSize = '';
let currentUser = null;
let selectedServices = [];

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

// Mobile menu toggle function
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('hidden');
}

// Shared function to process appointment services and calculate total
function processAppointmentServices(appointment) {
    const result = {
        servicesText: '',
        servicesHtml: '',
        totalAmount: 0
    };

    if (!appointment.services || appointment.services.length === 0) {
        result.servicesText = 'None';
        result.servicesHtml = '<p class="text-gray-500">No services</p>';
        return result;
    }


    const serviceNames = appointment.services.map(s => s.name);
    let logicalServices = [];
    let html = '';
    let displayTotal = 0;

    if (appointment.package_customizations) {
        try {
            const storedCustomizations = JSON.parse(appointment.package_customizations);

            // Add packages with detailed contents
            Object.entries(storedCustomizations).forEach(([pkgName, customization]) => {
                if (customization.selected && servicesData.package) {
                    const packageService = servicesData.package.find(p => p.name === pkgName);
                    if (packageService) {
                        const packageItems = packageContents[pkgName] || [];
                        const includedServices = packageItems.filter(item =>
                            !(customization.excludedServices || []).includes(item.name)
                        );
                        const excludedServices = packageItems.filter(item =>
                            (customization.excludedServices || []).includes(item.name)
                        );

                        // For text display (appointment list)
                        logicalServices.push(`${pkgName} (Customized)`);

                        // For HTML display (view modal)
                        html += `<div class="font-medium text-gray-900 border-b border-gray-200 pb-1 mb-2">${pkgName} (Customized)</div>`;
                        includedServices.forEach(item => {
                            html += `<div class="flex justify-between items-center text-sm ml-4 text-green-700 mb-1">
                                <span>✓ ${item.name}</span>
                                <span class="text-xs">(included)</span>
                            </div>`;
                        });
                        excludedServices.forEach(item => {
                            html += `<div class="flex justify-between items-center text-sm ml-4 text-gray-400 line-through mb-1">
                                <span>✗ ${item.name}</span>
                                <span class="text-xs">(excluded)</span>
                            </div>`;
                        });
                        html += '<div class="mb-3"></div>';

                        // Use the stored price from appointment services
                        const storedService = appointment.services.find(s => s.name === pkgName || s.name === `${pkgName} (Customized)`);
                        if (storedService && storedService.price) {
                            displayTotal += parseFloat(storedService.price);
                        }
                    }
                }
            });

            // Add individual services not in packages
            serviceNames.forEach(serviceName => {
                let isInPackage = false;
                Object.entries(storedCustomizations).forEach(([pkgName, customization]) => {
                    if (customization.selected && packageContents[pkgName]) {
                        const pkgIncludedServices = packageContents[pkgName].filter(item =>
                            !(customization.excludedServices || []).includes(item.name)
                        ).map(item => item.name);

                        if (pkgIncludedServices.includes(serviceName)) {
                            isInPackage = true;
                        }
                    }
                });

                if (!isInPackage) {
                    logicalServices.push(serviceName);

                    // Find the stored price for this service
                    const storedService = appointment.services.find(s => s.name === serviceName);
                    const servicePrice = storedService ? parseFloat(storedService.price) : 0;

                    // Add service with price to HTML
                    html += `<div class="flex justify-between items-center py-2">
                        <span>${serviceName}</span>
                        <span class="font-semibold">₱${servicePrice.toFixed(2)}</span>
                    </div>`;

                    displayTotal += servicePrice;
                }
            });

            result.servicesText = logicalServices.join(', ');
            result.servicesHtml = html || '<p class="text-gray-500">No services</p>';
            result.totalAmount = displayTotal;
        } catch (e) {
            // Fallback to raw services if JSON parsing fails
            result.servicesText = serviceNames.join(', ');
            result.servicesHtml = serviceNames.map(service => `<div class="flex justify-between items-center py-2"><span>${service}</span></div>`).join('');
            result.totalAmount = parseFloat(appointment.total_amount);
        }
    } else {
        // Fallback: detect packages from services
        const packageDetection = detectPackageFromServices(serviceNames);
        if (packageDetection) {
            logicalServices.push(`${packageDetection.packageName} (Customized)`);
            html += `<div class="font-medium text-gray-900 border-b border-gray-200 pb-1 mb-2">${packageDetection.packageName} (Customized)</div>`;

            // Use stored price for package
            const storedPackageService = appointment.services.find(s => s.name === packageDetection.packageName || s.name.includes(packageDetection.packageName));
            const packagePrice = storedPackageService ? parseFloat(storedPackageService.price) : 0;
            displayTotal += packagePrice;

            // Show package contents
            const packageItems = packageContents[packageDetection.packageName] || [];
            const includedServices = packageItems.filter(item =>
                !packageDetection.excludedServices.includes(item.name)
            );
            const excludedServices = packageItems.filter(item =>
                packageDetection.excludedServices.includes(item.name)
            );

            includedServices.forEach(item => {
                html += `<div class="flex justify-between items-center text-sm ml-4 text-green-700 mb-1">
                    <span>✓ ${item.name}</span>
                    <span class="text-xs">(included)</span>
                </div>`;
            });
            excludedServices.forEach(item => {
                html += `<div class="flex justify-between items-center text-sm ml-4 text-gray-400 line-through mb-1">
                    <span>✗ ${item.name}</span>
                    <span class="text-xs">(excluded)</span>
                </div>`;
            });
            html += '<div class="mb-3"></div>';

            // Add extra services
            packageDetection.extraServices.forEach(extraName => {
                logicalServices.push(extraName);

                // Find the stored price for this extra service
                const storedExtraService = appointment.services.find(s => s.name === extraName);
                const servicePrice = storedExtraService ? parseFloat(storedExtraService.price) : 0;

                // Add service with price to HTML
                html += `<div class="flex justify-between items-center py-2">
                    <span>${extraName}</span>
                    <span class="font-semibold">₱${servicePrice.toFixed(2)}</span>
                </div>`;

                displayTotal += servicePrice;
            });

            result.servicesText = logicalServices.join(', ');
            result.servicesHtml = html;
            result.totalAmount = displayTotal;
        } else {
            // No packages detected, show raw services with prices
            result.servicesText = serviceNames.join(', ');

            // Calculate prices for each service
            let totalCalculated = 0;
            const servicesWithPrices = serviceNames.map(serviceName => {
                let servicePrice = 0;
                Object.keys(servicesData).forEach(category => {
                    const service = servicesData[category].find(s => s.name === serviceName);
                    if (service) {
                        servicePrice = getServicePrice(service, appointment.pet_size || 'medium');
                    }
                });
                totalCalculated += servicePrice;
                return `<div class="flex justify-between items-center py-2">
                    <span>${serviceName}</span>
                    <span class="font-semibold">₱${servicePrice.toFixed(2)}</span>
                </div>`;
            });

            result.servicesHtml = servicesWithPrices.join('');
            result.totalAmount = totalCalculated || parseFloat(appointment.total_amount);
        }
    
        // Always use the stored total amount from the database since it was calculated correctly during booking
    if (appointment.total_amount) {
        result.totalAmount = parseFloat(appointment.total_amount);
    }


    return result;
}

// Function to detect if selected services match a package
function detectPackageFromServices(serviceNames) {
    let bestMatch = null;
    let maxExtra = -1;

    for (const [packageName, contents] of Object.entries(packageContents)) {
        const requiredServices = contents.filter(item => item.required).map(item => item.name);
        const optionalServices = contents.filter(item => !item.required).map(item => item.name);
        const allPackageServices = contents.map(item => item.name);

        // Check if all required services are in the selected services (with fuzzy matching)
        const allRequiredIncluded = requiredServices.every(reqService =>
            serviceNames.some(selected =>
                selected.toLowerCase().includes(reqService.toLowerCase().split(' ')[0]) ||
                reqService.toLowerCase().includes(selected.toLowerCase().split(' ')[0])
            )
        );

        if (allRequiredIncluded) {
            // Count how many package services are covered
            const coveredServices = allPackageServices.filter(pkgService =>
                serviceNames.some(selected =>
                    selected.toLowerCase().includes(pkgService.toLowerCase().split(' ')[0]) ||
                    pkgService.toLowerCase().includes(selected.toLowerCase().split(' ')[0])
                )
            );

            // Calculate extra services (services not in this package)
            const extraCount = serviceNames.length - coveredServices.length;

            // Prefer packages that leave more extra services (less "greedy" matching)
            if (extraCount > maxExtra) {
                // Find which optional services are included and excluded
                const includedOptional = optionalServices.filter(optService =>
                    serviceNames.some(selected =>
                        selected.toLowerCase().includes(optService.toLowerCase().split(' ')[0]) ||
                        optService.toLowerCase().includes(selected.toLowerCase().split(' ')[0])
                    )
                );
                const excludedOptional = optionalServices.filter(optService => !includedOptional.includes(optService));

                // Extra services not in package
                const extraServices = serviceNames.filter(selected =>
                    !allPackageServices.some(pkgService =>
                        selected.toLowerCase().includes(pkgService.toLowerCase().split(' ')[0]) ||
                        pkgService.toLowerCase().includes(selected.toLowerCase().split(' ')[0])
                    )
                );

                bestMatch = { packageName, excludedServices: excludedOptional, extraServices };
                maxExtra = extraCount;
            }
        }
    }
    return bestMatch;
}

// Load services data globally for appointment display
async function loadServicesData() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}services.php?action=get_services`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && (result.services || result.data)) {
            servicesData = result.services || result.data;
        } else {
            console.error('Failed to load services data:', result.error);
        }
    } catch (error) {
        console.error('Error loading services data:', error);
    }
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
    console.log('DEBUG: customer_appointments.js DOMContentLoaded fired');

    // Check authentication first
    const isAuthenticated = await checkAuth();
    console.log('DEBUG: Authentication result:', isAuthenticated);

    if (!isAuthenticated) {
        console.log('DEBUG: User not authenticated, redirecting to auth page');
        // Clear any stored data and redirect to auth page
        localStorage.clear();
        window.location.replace('auth.html');
        return; // Stop execution if not authenticated
    }

    console.log('DEBUG: User authenticated, loading data');

    // Load services data for appointment display
    await loadServicesData();
    console.log('DEBUG: Services data loaded');

    // Load active bookings count
    loadUserBookings();

    // Load user appointments
    loadUserAppointments();
});

// Enhanced authentication and session management
async function checkAuth() {
    console.log('DEBUG: checkAuth() called');
    const token = localStorage.getItem('authToken');
    console.log('DEBUG: Token present:', !!token);

    if (!token) {
        console.log('DEBUG: No token found');
        return false;
    }

    try {
        console.log('DEBUG: Verifying token with API');
        const response = await fetch(`${API_BASE}auth.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'verify_token' })
        });

        console.log('DEBUG: Auth API response status:', response.status);
        const result = await response.json();
        console.log('DEBUG: Auth API response:', result);

        if (result.success) {
            currentUser = {
                id: result.user_id,
                email: result.email
            };

            updateUserWelcome();
            console.log('DEBUG: Authentication successful');
            return true;
        } else {
            console.log('DEBUG: Authentication failed:', result.error);
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
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

// Load user appointments
async function loadUserAppointments() {
    console.log('DEBUG: loadUserAppointments() called');

    // Ensure servicesData is loaded before loading appointments
    if (!servicesData) {
        console.log('DEBUG: servicesData not loaded, loading now');
        try {
            await loadServicesData();
            console.log('DEBUG: servicesData loaded successfully');
        } catch (error) {
            console.error('Failed to load services data:', error);
            const container = document.getElementById('appointmentsContainer');
            container.innerHTML = '<p class="text-red-500">Error loading services data. Please refresh the page.</p>';
            return;
        }
    }

    try {
        const token = localStorage.getItem('authToken');
        console.log('DEBUG: Token present:', !!token);

        if (!token) {
            const container = document.getElementById('appointmentsContainer');
            container.innerHTML = '<p class="text-red-500">You are not logged in. Please <a href="auth.html" class="text-blue-600 underline">log in</a> to view your appointments.</p>';
            return;
        }

        console.log('DEBUG: Making API call to get user appointments');
        const response = await fetch(`${API_BASE}appointments.php?action=get_user_appointments`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('DEBUG: API response status:', response.status);
        const result = await response.json();
        console.log('DEBUG: API response:', result);

        if (result.success) {
            console.log('DEBUG: Appointments loaded successfully:', result.appointments);
            displayUserAppointments(result.appointments || []);
        } else {
            console.error('API returned error:', result.error);
            const container = document.getElementById('appointmentsContainer');
            container.innerHTML = `<p class="text-red-500">Error loading appointments: ${result.error || 'Unknown error'}</p>`;
        }
    } catch (error) {
        console.error('Error loading user appointments:', error);
        const container = document.getElementById('appointmentsContainer');
        container.innerHTML = '<p class="text-red-500">Error loading appointments. Please check your connection and try again.</p>';
    }
}

// Display user appointments
function displayUserAppointments(appointments) {
    const container = document.getElementById('appointmentsContainer');

    // Ensure servicesData is loaded
    if (!servicesData) {
        console.error('servicesData not loaded, cannot display appointments');
        container.innerHTML = '<p class="text-red-500">Error loading appointment data. Please refresh the page.</p>';
        return;
    }

    if (!appointments || appointments.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                </div>
                <p class="text-gray-500 text-lg">No appointments found</p>
                <p class="text-gray-400 text-sm mt-2">Your upcoming appointments will appear here</p>
            </div>
        `;
        return;
    }

    try {
        container.innerHTML = `
            <div class="space-y-4">
                ${appointments.map(appointment => {
                    try {
                        // Get status styling based on appointment status
                        const statusStyle = getStatusStyle(appointment.status);

                        return `
                        <div class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                            <div class="flex items-start justify-between mb-4">
                                <div class="flex items-center space-x-3">
                                    <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">🐾</div>
                                    <div>
                                        <h3 class="font-semibold text-gray-900 text-lg">${appointment.pet_name || 'Unknown Pet'}</h3>
                                        <p class="text-sm text-gray-600">${appointment.pet_type || 'Unknown'} • ${appointment.pet_breed || 'Unknown'}</p>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-sm text-gray-500 mb-1">${formatAppointmentDate(appointment.appointment_date || '')}</div>
                                    <div class="text-sm font-medium text-gray-700">${formatAppointmentTime(appointment.appointment_time || '')}</div>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div class="bg-gray-50 rounded p-3">
                                    <div class="text-xs text-gray-500 uppercase tracking-wide">Status</div>
                                    <div class="text-sm font-medium ${statusStyle.textColor} capitalize flex items-center">
                                        <span class="w-2 h-2 ${statusStyle.dotColor} rounded-full mr-2"></span>
                                        ${appointment.status === 'confirmed' ? 'scheduled' : (appointment.status || 'unknown')}
                                    </div>
                                </div>
                                <div class="bg-primary/10 rounded p-3">
                                    <div class="text-xs text-primary uppercase tracking-wide">Total Amount</div>
                                    <div class="text-lg font-bold text-primary">₱${parseFloat(appointment.total_amount || 0).toFixed(2)}</div>
                                </div>
                            </div>

                            <div class="flex items-center justify-between">
                                <div class="text-sm text-gray-600">
                                    <span class="font-medium">Services:</span>
                                    <span>${processAppointmentServices(appointment).servicesText || 'None'}</span>
                                </div>
                                <div class="flex space-x-2">
                                    ${appointment.status === 'scheduled' ? `
                                        <button onclick="viewAppointmentDetails('${appointment.id}')" class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200">
                                            View Details
                                        </button>
                                        <button onclick="cancelAppointment('${appointment.id}')" class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200">
                                            Cancel
                                        </button>
                                    ` : `
                                        <button onclick="viewAppointmentDetails('${appointment.id}')" class="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
                                            View Details
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                        `;
                    } catch (error) {
                        console.error('Error rendering appointment:', error, appointment);
                        return `
                        <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                            <p class="text-red-700">Error displaying appointment: ${error.message}</p>
                        </div>
                        `;
                    }
                }).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Error displaying appointments:', error);
        container.innerHTML = '<p class="text-red-500">Error displaying appointments. Please check the console for details.</p>';
    }
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

// Get status styling based on appointment status
function getStatusStyle(status) {
    // Map "confirmed" to "scheduled" for customer display
    const displayStatus = status === 'confirmed' ? 'scheduled' : status;

    const statusStyles = {
        'scheduled': {
            textColor: 'text-blue-600',
            dotColor: 'bg-blue-500'
        },
        'completed': {
            textColor: 'text-green-600',
            dotColor: 'bg-green-500'
        },
        'cancelled': {
            textColor: 'text-red-600',
            dotColor: 'bg-red-500'
        }
    };

    return statusStyles[displayStatus] || {
        textColor: 'text-gray-600',
        dotColor: 'bg-gray-400'
    };
}

async function viewAppointmentDetails(appointmentId) {
    // Ensure servicesData is loaded before opening view modal
    if (!servicesData) {
        try {
            await loadServicesData();
        } catch (error) {
            console.error('Error loading services data for view:', error);
            showNotification('Error loading services', 'error');
            return;
        }
    }

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}appointments.php?action=get_appointment_details&appointment_id=${appointmentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.appointment) {
            await showViewAppointmentModal(result.appointment);
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
function filterAppointments(status, event) {
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
async function showViewAppointmentModal(appointment) {
    // Map pet size values
    const sizeMapping = {
        'small': 'small',
        'medium': 'medium',
        'large': 'large',
        'xlarge': 'extra_large'
    };

    const petSizeValue = sizeMapping[appointment.pet_size] || appointment.pet_size || '';

    // Create modal HTML for view-only
    const modalHtml = `
        <div id="viewAppointmentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] overflow-y-auto">
            <div class="bg-white/95 backdrop-blur-sm rounded-2xl card-shadow border border-gold-100/50 w-full max-w-4xl mx-4 my-8 max-h-[90vh] overflow-y-auto">
                <div class="px-6 py-8 sm:px-10">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                            </div>
                            Appointment Details
                        </h2>
                        <button onclick="closeModal('viewAppointmentModal')" class="text-gray-400 hover:text-gray-600 transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>

                    <!-- Status Badge -->
                    <div class="mb-6">
                        <div class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${appointment.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-800' : appointment.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            <span class="w-2 h-2 ${appointment.status === 'confirmed' ? 'bg-blue-500' : appointment.status === 'scheduled' ? 'bg-blue-500' : appointment.status === 'completed' ? 'bg-green-500' : 'bg-red-500'} rounded-full mr-2"></span>
                            ${appointment.status === 'confirmed' ? 'Scheduled' : appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </div>
                    </div>

                    <!-- Owner Information (Read-only) -->
                    <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6">
                        <h3 class="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                            </svg>
                            Owner Information
                        </h3>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Owner Name</label>
                            <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">${currentUser ? currentUser.email : 'Loading...'}</div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                                <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">Loading...</div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">${currentUser ? currentUser.email : 'Loading...'}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Pet Information (Read-only) -->
                    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
                        <h3 class="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                            </svg>
                            Pet Information
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Pet Name</label>
                                <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">${appointment.pet_name}</div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Pet Type</label>
                                <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">${appointment.pet_type.charAt(0).toUpperCase() + appointment.pet_type.slice(1)}</div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Breed</label>
                                <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">${appointment.pet_breed}</div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Pet Size</label>
                                <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">${petSizeValue ? petSizeValue.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' (' + (petSizeValue === 'small' ? '0-15 lbs' : petSizeValue === 'medium' ? '16-40 lbs' : petSizeValue === 'large' ? '41-70 lbs' : '71+ lbs') + ')' : 'Not specified'}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Vaccination Information (Read-only) -->
                    ${(appointment.last_vaccine_date || appointment.vaccine_type) ? `
                    <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6">
                        <h3 class="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            Vaccination Information
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Last Vaccine Update Date</label>
                                <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">${appointment.last_vaccine_date || 'Not provided'}</div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Type of Vaccine</label>
                                <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">${appointment.vaccine_type ? appointment.vaccine_type.charAt(0).toUpperCase() + appointment.vaccine_type.slice(1) : 'Not provided'}</div>
                            </div>
                        </div>
                        ${appointment.custom_vaccine ? `
                        <div class="mt-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Custom Vaccine Details</label>
                            <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">${appointment.custom_vaccine}</div>
                        </div>
                        ` : ''}
                        ${appointment.vaccination_proof ? `
                        <div class="mt-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Vaccination Proof</label>
                            <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50">
                                <div class="flex items-center justify-center space-x-3">
                                    <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    <div class="text-left">
                                        <p class="text-sm font-medium text-gray-900">Vaccination proof uploaded</p>
                                        <button onclick="viewVaccinationProof('${appointment.vaccination_proof}')" class="text-sm text-blue-600 hover:text-blue-800 underline">
                                            View proof document
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}

                    <!-- Appointment Details (Read-only) -->
                    <div class="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6 mb-6">
                        <h3 class="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            Appointment Details
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Preferred Date</label>
                                <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">${appointment.appointment_date}</div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Preferred Time</label>
                                <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">${formatAppointmentTime(appointment.appointment_time)}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Services Summary (Read-only) -->
                    <div class="bg-gradient-to-r from-gold-500/5 to-gold-600/5 border-2 border-gold-500/20 rounded-xl p-6 mb-6 shadow-lg">
                        <div class="flex items-center mb-4">
                            <svg class="w-6 h-6 text-gold-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                            </svg>
                            <h3 class="text-lg font-semibold text-gray-900">Services Summary</h3>
                        </div>
                        <div class="bg-white/80 rounded-lg p-4">
                            ${(() => {
                                // Process services to show detailed package contents + individual services
                                if (!appointment.services || appointment.services.length === 0) return '<p class="text-gray-500">No services</p>';

                                const serviceNames = appointment.services.map(s => s.name);
                                let html = '';

                                if (appointment.package_customizations) {
                                    try {
                                        const storedCustomizations = JSON.parse(appointment.package_customizations);

                                        // Add packages with detailed contents
                                        Object.entries(storedCustomizations).forEach(([pkgName, customization]) => {
                                            if (customization.selected && servicesData.package) {
                                                const packageService = servicesData.package.find(p => p.name === pkgName);
                                                if (packageService) {
                                                    const packageItems = packageContents[pkgName] || [];
                                                    const includedServices = packageItems.filter(item =>
                                                        !(customization.excludedServices || []).includes(item.name)
                                                    );
                                                    const excludedServices = packageItems.filter(item =>
                                                        (customization.excludedServices || []).includes(item.name)
                                                    );

                                                    // Package header
                                                    html += `<div class="font-medium text-gray-900 border-b border-gray-200 pb-1 mb-2">${pkgName} (Customized)</div>`;

                                                    // Included services
                                                    includedServices.forEach(item => {
                                                        html += `<div class="flex justify-between items-center text-sm ml-4 text-green-700 mb-1">
                                                            <span>✓ ${item.name}</span>
                                                            <span class="text-xs">(included)</span>
                                                        </div>`;
                                                    });

                                                    // Excluded services
                                                    excludedServices.forEach(item => {
                                                        html += `<div class="flex justify-between items-center text-sm ml-4 text-gray-400 line-through mb-1">
                                                            <span>✗ ${item.name}</span>
                                                            <span class="text-xs">(excluded)</span>
                                                        </div>`;
                                                    });

                                                    html += '<div class="mb-3"></div>';
                                                }
                                            }
                                        });

                                        // Add individual services not in packages
                                        serviceNames.forEach(serviceName => {
                                            let isInPackage = false;
                                            Object.entries(storedCustomizations).forEach(([pkgName, customization]) => {
                                                if (customization.selected && packageContents[pkgName]) {
                                                    const pkgIncludedServices = packageContents[pkgName].filter(item =>
                                                        !(customization.excludedServices || []).includes(item.name)
                                                    ).map(item => item.name);

                                                    if (pkgIncludedServices.includes(serviceName)) {
                                                        isInPackage = true;
                                                    }
                                                }
                                            });

                                            if (!isInPackage) {
                                                // Find service price
                                                let servicePrice = 0;
                                                Object.keys(servicesData).forEach(category => {
                                                    const service = servicesData[category].find(s => s.name === serviceName);
                                                    if (service) {
                                                        servicePrice = getServicePrice(service, appointment.pet_size || 'medium');
                                                    }
                                                });

                                                html += `<div class="flex justify-between items-center py-2">
                                                    <span>${serviceName}</span>
                                                    <span class="font-semibold">₱${servicePrice.toFixed(2)}</span>
                                                </div>`;
                                            }
                                        });

                                        return html || '<p class="text-gray-500">No services</p>';
                                    } catch (e) {
                                        // Fallback to raw services if JSON parsing fails
                                        return serviceNames.map(service => `<div class="flex justify-between items-center py-2"><span>${service}</span></div>`).join('');
                                    }
                                } else {
                                    // No packages detected, show raw services with prices
                                    return serviceNames.map(serviceName => {
                                        let servicePrice = 0;
                                        Object.keys(servicesData).forEach(category => {
                                            const service = servicesData[category].find(s => s.name === serviceName);
                                            if (service) {
                                                servicePrice = getServicePrice(service, appointment.pet_size || 'medium');
                                            }
                                        });
                                        return `<div class="flex justify-between items-center py-2">
                                            <span>${serviceName}</span>
                                            <span class="font-semibold">₱${servicePrice.toFixed(2)}</span>
                                        </div>`;
                                    }).join('');
                                }
                            })()}
                        </div>
                        <div class="border-t-2 border-gold-500/20 pt-4 mt-4">
                        <div class="flex justify-between items-center bg-white/80 rounded-lg p-4">
                            <span class="text-xl font-bold text-gray-900">Total Amount:</span>
                            <span class="text-2xl font-bold text-gold-600">₱${parseFloat(appointment.total_amount).toFixed(2)}</span>
                        </div>
                    </div>
                    </div>

                    <!-- Special Instructions (Read-only) -->
                    ${appointment.special_instructions ? `
                    <div class="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6 mb-6">
                        <h3 class="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                            </svg>
                            Special Instructions
                        </h3>
                        <div class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">${appointment.special_instructions}</div>
                    </div>
                    ` : ''}

                    <!-- Action Buttons -->
                    <div class="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                        <button onclick="closeModal('viewAppointmentModal')"
                                class="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                            Close
                        </button>
                        ${appointment.status === 'scheduled' ? `
                            <button onclick="cancelAppointment('${appointment.id}'); closeModal('viewAppointmentModal');"
                                    class="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                                Cancel Appointment
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Load user profile information
    await loadUserProfileForView();
}

async function showEditAppointmentModal(appointment) {
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
        <div id="editAppointmentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] overflow-y-auto">
            <div class="bg-white/95 backdrop-blur-sm rounded-2xl card-shadow border border-gold-100/50 w-full max-w-4xl mx-4 my-8 max-h-[90vh] overflow-y-auto">
                <div class="px-6 py-8 sm:px-10">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                </svg>
                            </div>
                            Edit Appointment
                        </h2>
                        <button onclick="closeModal('editAppointmentModal')" class="text-gray-400 hover:text-gray-600 transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>

                    <form id="editAppointmentForm" onsubmit="handleEditAppointmentSubmission(event, '${appointment.id}')">
                        <!-- Owner Information (Read-only) -->
                        <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6">
                            <h3 class="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                </svg>
                                Owner Information
                            </h3>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Owner Name</label>
                                <input type="text" name="ownerName" value="${currentUser ? currentUser.email : 'Loading...'}" readonly
                                       class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 cursor-not-allowed">
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                                    <input type="tel" name="ownerPhone" value="Loading..." readonly
                                           class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 cursor-not-allowed">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                    <input type="email" name="ownerEmail" value="${currentUser ? currentUser.email : 'Loading...'}" readonly
                                           class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 cursor-not-allowed">
                                </div>
                            </div>
                        </div>

                        <!-- Pet Information (Read-only) -->
                        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
                            <h3 class="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                                </svg>
                                Pet Information
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Pet Name</label>
                                    <input type="text" name="petName" value="${appointment.pet_name}" readonly
                                           class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 cursor-not-allowed">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Pet Type</label>
                                    <input type="text" value="${appointment.pet_type.charAt(0).toUpperCase() + appointment.pet_type.slice(1)}" readonly
                                           class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 cursor-not-allowed">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Breed</label>
                                    <input type="text" name="petBreed" value="${appointment.pet_breed}" readonly
                                           class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 cursor-not-allowed">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Pet Size</label>
                                    <input type="text" value="${petSizeValue ? petSizeValue.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' (' + (petSizeValue === 'small' ? '0-15 lbs' : petSizeValue === 'medium' ? '16-40 lbs' : petSizeValue === 'large' ? '41-70 lbs' : '71+ lbs') + ')' : 'Not specified'}" readonly
                                           class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 cursor-not-allowed">
                                </div>
                            </div>
                        </div>

                        <!-- Appointment Details -->
                        <div class="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6 mb-6">
                            <h3 class="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                                <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                Appointment Details
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Preferred Date *</label>
                                    <input type="date" name="preferredDate" value="${appointment.appointment_date}" required
                                           class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-colors" id="editPreferredDate">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Preferred Time *</label>
                                    <select name="preferredTime" required class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-colors">
                                        <option value="">Select time</option>
                                        <option value="09:00:00" ${appointment.appointment_time === '09:00:00' ? 'selected' : ''}>9:00 AM</option>
                                        <option value="10:00:00" ${appointment.appointment_time === '10:00:00' ? 'selected' : ''}>10:00 AM</option>
                                        <option value="11:00:00" ${appointment.appointment_time === '11:00:00' ? 'selected' : ''}>11:00 AM</option>
                                        <option value="13:00:00" ${appointment.appointment_time === '13:00:00' ? 'selected' : ''}>1:00 PM</option>
                                        <option value="14:00:00" ${appointment.appointment_time === '14:00:00' ? 'selected' : ''}>2:00 PM</option>
                                        <option value="15:00:00" ${appointment.appointment_time === '15:00:00' ? 'selected' : ''}>3:00 PM</option>
                                        <option value="16:00:00" ${appointment.appointment_time === '16:00:00' ? 'selected' : ''}>4:00 PM</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Service Selection -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-4">Select Services</label>

                            <!-- Pet Size Selection for Pricing -->
                            <div class="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-6 shadow-sm mb-6">
                                <div class="flex items-center mb-4">
                                    <div class="inline-flex items-center justify-center w-10 h-10 bg-amber-100 rounded-full mr-3">
                                        <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                                        </svg>
                                    </div>
                                    <h3 class="text-lg font-semibold text-amber-900">Pet Size for Pricing</h3>
                                </div>
                                <div class="bg-white/80 rounded-lg p-4">
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Select your pet's size to see accurate pricing *</label>
                                    <select id="editPetSizeForPricing" required
                                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-colors">
                                        <option value="">Select pet size for pricing</option>
                                        <option value="small" ${petSizeValue === 'small' ? 'selected' : ''}>Small (0-15 lbs)</option>
                                        <option value="medium" ${petSizeValue === 'medium' ? 'selected' : ''}>Medium (16-40 lbs)</option>
                                        <option value="large" ${petSizeValue === 'large' ? 'selected' : ''}>Large (41-70 lbs)</option>
                                        <option value="extra_large" ${petSizeValue === 'extra_large' ? 'selected' : ''}>Extra Large (71+ lbs)</option>
                                    </select>
                                    <p class="text-sm text-amber-700 mt-2">
                                        <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                        Prices vary by pet size. Please select to see accurate pricing.
                                    </p>
                                </div>
                            </div>

                            <div id="editServicesContainer" class="space-y-6 mb-8">
                                <div class="text-center py-8">
                                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto mb-4"></div>
                                    <p class="text-gray-600">Loading services...</p>
                                </div>
                            </div>

                            <!-- Book Summary -->
                            <div class="bg-gradient-to-r from-gold-500/5 to-gold-600/5 border-2 border-gold-500/20 rounded-xl p-6 mb-8 shadow-lg">
                                <div class="flex items-center mb-4">
                                    <svg class="w-6 h-6 text-gold-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                    </svg>
                                    <h3 class="text-lg font-semibold text-gray-900">Book Summary</h3>
                                </div>
                                <div id="editSelectedServices" class="space-y-3 mb-6">
                                    <div class="text-center py-8">
                                        <svg class="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                                        </svg>
                                        <p class="text-gray-500 font-medium">No services selected</p>
                                        <p class="text-sm text-gray-400">Choose from the services above</p>
                                    </div>
                                </div>
                                <div class="border-t-2 border-gold-500/20 pt-4">
                                    <div class="flex justify-between items-center bg-white/80 rounded-lg p-4">
                                        <span class="text-xl font-bold text-gray-900">Total Amount:</span>
                                        <span id="editTotalAmount" class="text-2xl font-bold text-gold-600">₱0</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Special Instructions -->
                        <div class="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6 mb-6">
                            <h3 class="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                                <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                                </svg>
                                Special Instructions
                            </h3>
                            <textarea name="specialInstructions" rows="3"
                                      class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-colors"
                                      placeholder="Any special requests or notes for the groomer...">${appointment.special_instructions || ''}</textarea>
                        </div>


                        <!-- Action Buttons -->
                        <div class="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                            <button type="button" onclick="closeModal('editAppointmentModal')"
                                    class="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                                Cancel
                            </button>
                            <button type="submit"
                                    class="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
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

    // Load user profile information
    loadUserProfileForEdit();

    // Apply date validation to edit modal
    setEditDateValidation();

    // Load services for editing
    await loadServicesForEdit(appointment);
}

function showCancelAppointmentModal(appointmentId) {
    const modalHtml = `
        <div id="cancelAppointmentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div class="bg-white/95 backdrop-blur-sm rounded-2xl card-shadow border border-gold-100/50 w-full max-w-md mx-4">
                <div class="px-6 py-8 sm:px-10 text-center">
                    <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                        </svg>
                    </div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Cancel Appointment</h2>
                    <p class="text-gray-600 mb-8">
                        Are you sure you want to cancel this appointment? This action cannot be undone.
                    </p>
                    <div class="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                        <button onclick="closeModal('cancelAppointmentModal')"
                                class="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                            Keep Appointment
                        </button>
                        <button onclick="confirmCancelAppointment('${appointmentId}')"
                                class="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
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

// Load user profile information for edit modal
async function loadUserProfileForEdit() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}auth.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'get_profile' })
        });

        const result = await response.json();

        if (result.success && result.user) {
            // Update the owner information fields in the edit modal
            const ownerNameField = document.querySelector('#editAppointmentModal input[name="ownerName"]');
            const ownerPhoneField = document.querySelector('#editAppointmentModal input[name="ownerPhone"]');
            const ownerEmailField = document.querySelector('#editAppointmentModal input[name="ownerEmail"]');

            if (ownerNameField) ownerNameField.value = result.user.name || result.user.full_name || '';
            if (ownerPhoneField) ownerPhoneField.value = (result.user.phone && result.user.phone.trim()) ? result.user.phone : 'Not provided';
            if (ownerEmailField) ownerEmailField.value = result.user.email || '';
        }
    } catch (error) {
        console.error('Error loading user profile for edit:', error);
        // Set default values if API fails
        const ownerPhoneField = document.querySelector('#editAppointmentModal input[name="ownerPhone"]');
        if (ownerPhoneField) ownerPhoneField.value = 'Not available';
    }
}

// Load user profile information for view modal
async function loadUserProfileForView() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}auth.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'get_profile' })
        });

        const result = await response.json();

        if (result.success && result.user) {
            // Update the owner information fields in the view modal
            const ownerNameField = document.querySelector('#viewAppointmentModal .bg-green-50 input[readonly]');
            const ownerPhoneField = document.querySelector('#viewAppointmentModal .bg-green-50 div:nth-child(4) div');
            const ownerEmailField = document.querySelector('#viewAppointmentModal .bg-green-50 div:nth-child(5) div');

            if (ownerNameField) ownerNameField.value = result.user.name || result.user.full_name || result.user.email || '';
            if (ownerPhoneField) ownerPhoneField.textContent = (result.user.phone && result.user.phone.trim()) ? result.user.phone : 'Not provided';
            if (ownerEmailField) ownerEmailField.textContent = result.user.email || '';
        }
    } catch (error) {
        console.error('Error loading user profile for view:', error);
        // Set default values if API fails
        const ownerPhoneField = document.querySelector('#viewAppointmentModal .bg-green-50 div:nth-child(4) div');
        if (ownerPhoneField) ownerPhoneField.textContent = 'Not available';
    }
}

// Set date validation for edit modal
function setEditDateValidation() {
    const dateInput = document.getElementById('editPreferredDate');
    if (!dateInput) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Set minimum date to today to disable all past dates
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Check if current time is before 4:01 PM to allow today
    const allowToday = currentHour < 16 || (currentHour === 16 && currentMinute <= 1);

    dateInput.min = todayStr; // Always disable dates before today

    // Add validation to enforce the rules
    const validateDate = function() {
        const selectedDate = new Date(this.value);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);

        if (selectedDate < todayStart) {
            console.log('DEBUG: Selected date is in the past, resetting to today');
            this.value = todayStr;
            showNotification('Past dates are not allowed. Please select today or later.', 'warning');
        } else if (!allowToday && selectedDate.getTime() === todayStart.getTime()) {
            console.log('DEBUG: Same-day bookings not allowed after 4:01 PM, resetting to tomorrow');
            this.value = tomorrowStr;
            showNotification('Same-day bookings are only available before 4:01 PM. Please select tomorrow or later.', 'warning');
        }
    };

    dateInput.addEventListener('change', validateDate);
    dateInput.addEventListener('input', validateDate);

}

async function loadServicesForEdit(appointment) {
    // Get current pet size from the selector (which is pre-selected in HTML)
    const petSizeSelect = document.getElementById('editPetSizeForPricing');
    currentPetSize = petSizeSelect ? petSizeSelect.value : 'small';

    // Load all services
    async function loadServices() {
        try {
            // Use globally loaded servicesData if available, otherwise fetch
            if (!servicesData) {
                const token = localStorage.getItem('authToken');
                const response = await fetch(`${API_BASE}services.php?action=get_services`);

                const result = await response.json();

                if (result.success && (result.services || result.data)) {
                    servicesData = result.services || result.data; // Store globally for rendering
                } else {
                    throw new Error('Failed to load services');
                }
            }

            // Get currently selected services from appointment
            const currentServiceNames = appointment.services ? appointment.services.map(s => s.name) : [];

            // Pre-check the services that were originally selected
            selectedServices = [];

            // Simple fallback: Load all services from appointment.services as individual items
            // This ensures services are always pre-selected even if package processing fails
            currentServiceNames.forEach(serviceName => {
                // Find the service in servicesData with flexible matching
                let found = false;
                Object.keys(servicesData).forEach(category => {
                    if (!found && servicesData[category]) {
                        // Try exact match first
                        let service = servicesData[category].find(s => s.name === serviceName);

                        // If not found, try flexible matching (case-insensitive partial match)
                        if (!service) {
                            service = servicesData[category].find(s =>
                                s.name.toLowerCase().includes(serviceName.toLowerCase()) ||
                                serviceName.toLowerCase().includes(s.name.toLowerCase().split(' ')[0])
                            );
                        }

                        // Handle customized packages
                        if (!service && serviceName.includes('(Customized)')) {
                            const baseName = serviceName.replace(' (Customized)', '');
                            service = servicesData[category].find(s => s.name === baseName);
                            if (!service) {
                                service = servicesData[category].find(s =>
                                    s.name.toLowerCase().includes(baseName.toLowerCase()) ||
                                    baseName.toLowerCase().includes(s.name.toLowerCase().split(' ')[0])
                                );
                            }
                        }

                        if (service) {
                            const price = getServicePrice(service, currentPetSize);
                            selectedServices.push({
                                id: service.id,
                                name: service.name,
                                price: price
                            });
                            found = true;
                        }
                    }
                });

                // If still not found, log it for debugging
                if (!found) {
                    console.warn('Service not found in servicesData:', serviceName);
                }
            });

            // Try to process package customizations if available (don't fail if it doesn't work)
            try {
                if (appointment.package_customizations) {
                    const storedCustomizations = JSON.parse(appointment.package_customizations);

                    // Load packages from stored customizations
                    Object.entries(storedCustomizations).forEach(([packageName, customization]) => {
                        if (customization.selected) {
                            const packageService = servicesData.package && servicesData.package.find(p => p.name === packageName);
                            if (packageService) {
                                packageCustomizations[packageName] = customization;

                                // Calculate customized price
                                const basePrice = getServicePrice(packageService, currentPetSize);
                                let customizedPrice = basePrice;
                                (customization.excludedServices || []).forEach(() => {
                                    const exclusionDiscount = basePrice * 0.15;
                                    customizedPrice -= exclusionDiscount;
                                });
                                customizedPrice = Math.max(customizedPrice, basePrice * 0.6);

                                // Replace the simple package entry with the customized one
                                const existingIndex = selectedServices.findIndex(s => s.name === packageName || s.name === `${packageName} (Customized)`);
                                if (existingIndex >= 0) {
                                    selectedServices[existingIndex] = {
                                        id: packageService.id,
                                        name: `${packageService.name} (Customized)`,
                                        price: customizedPrice,
                                        customizations: {
                                            selected: true,
                                            excludedServices: customization.excludedServices || [],
                                            includedServices: packageContents[packageService.name] ? packageContents[packageService.name].filter(item =>
                                                !(customization.excludedServices || []).includes(item.name)
                                            ).map(item => item.name) : []
                                        }
                                    };
                                }
                            }
                        }
                    });
                }
            } catch (error) {
                console.error('Error processing package customizations:', error);
                // Continue with basic service selection
            }

            // Render services
            renderEditServices();

            // Update order summary initially with original appointment services
            updateEditOrderSummary();

            // Update total amount display
            const totalElement = document.getElementById('editTotalAmount');
            if (totalElement) {
                const totalAmount = selectedServices.reduce((total, service) => total + service.price, 0);
                totalElement.textContent = `₱${totalAmount.toFixed(2)}`;
            }
        } catch (error) {
            console.error('Error loading services:', error);
            const container = document.getElementById('editServicesContainer');
            container.innerHTML = '<p class="text-red-500">Error loading services</p>';
        }
    }

    // Add event listener for pet size changes in edit modal
    const editPetSizeSelect = document.getElementById('editPetSizeForPricing');
    if (editPetSizeSelect) {
        editPetSizeSelect.addEventListener('change', function() {
            currentPetSize = this.value;
            renderEditServices();
            // Recalculate prices for selected services
            selectedServices.forEach(service => {
                Object.keys(servicesData).forEach(category => {
                    const serviceData = servicesData[category].find(s => s.id === service.id);
                    if (serviceData) {
                        service.price = getServicePrice(serviceData, currentPetSize);
                    }
                });
            });
            updateEditOrderSummary();
        });
    }

    // Load services
    await loadServices();
}

function renderEditServices() {
    const container = document.getElementById('editServicesContainer');

    // If servicesData is not loaded yet, show loading (shouldn't happen with our new flow)
    if (!servicesData) {
        container.innerHTML = `
            <div class="text-center py-8">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto mb-4"></div>
                <p class="text-gray-600">Loading services...</p>
            </div>
        `;
        return;
    }

    // Clear any loading message
    container.innerHTML = '';

    if (!currentPetSize) {
        container.innerHTML = `
            <div class="text-center py-8">
                <svg class="w-12 h-12 text-amber-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-amber-600 font-medium">Please select your pet's size first</p>
                <p class="text-sm text-amber-500">This will show accurate pricing for all services</p>
            </div>
        `;
        return;
    }

    let html = '';

    // Basic Services
    if (servicesData.basic && servicesData.basic.length > 0) {
        html += renderEditServiceCategory('basic', '✂️ Basic Services', 'blue', servicesData.basic);
    }

    // Package Services
    if (servicesData.package && servicesData.package.length > 0) {
        html += renderEditServiceCategory('package', '📦 Grooming Packages', 'purple', servicesData.package);
    }

    // Add-on Services
    if (servicesData.addon && servicesData.addon.length > 0) {
        html += renderEditServiceCategory('addon', '🎀 Add-Ons & Finishing Touches', 'green', servicesData.addon);
    }

    container.innerHTML = html;

    // Re-attach event listeners
    const checkboxes = document.querySelectorAll('.edit-service-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateEditServiceSelection);
    });

    // Package selection listeners
    const packageCheckboxes = document.querySelectorAll('.edit-package-checkbox');
    packageCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleEditPackageSelection);
    });

    // Package item customization listeners
    const packageItemCheckboxes = document.querySelectorAll('.edit-package-item-checkbox');
    packageItemCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleEditPackageItemToggle);
    });

    // Sync selectedServices with the rendered checkboxes
    updateEditServiceSelection();
}

function renderEditServiceCategory(categoryKey, categoryTitle, color, services) {
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
        html += renderEditCustomizablePackage(service, colors);
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

        // Check if this service is currently selected
        const isSelected = selectedServices.some(s => s.id === service.id);

        html += `
            <label class="flex items-center p-4 bg-white/80 rounded-lg border ${colors.itemBorder} transition-all duration-200 cursor-pointer hover:shadow-md ${isDisabled ? 'opacity-60' : ''}">
                <input type="checkbox" class="edit-service-checkbox w-5 h-5 text-primary rounded"
                        data-service-id="${service.id}"
                        data-service="${service.name}"
                        data-price="${price}"
                        ${isSelected ? 'checked' : ''}
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

function renderEditCustomizablePackage(service, colors) {
    const packageName = service.name;
    const packageItems = packageContents[packageName] || [];
    const basePrice = getServicePrice(service, currentPetSize);
    const packageId = `edit-package-${service.id}`;

    // Check if this package is currently selected
    const isSelected = selectedServices.some(s => s.id === service.id);

    // Initialize package customization if not exists
    if (!packageCustomizations[packageId]) {
        packageCustomizations[packageId] = {
            selected: isSelected,
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
                <input type="checkbox" class="edit-package-checkbox w-5 h-5 text-primary rounded"
                        data-package-id="${packageId}"
                        data-service-id="${service.id}"
                        data-service="${service.name}"
                        data-base-price="${basePrice}"
                        ${isSelected ? 'checked' : ''}
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
    if (isSelected) {
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
                            class="edit-package-item-checkbox w-4 h-4 text-primary rounded"
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

function updateEditServiceSelection() {
    selectedServices = [];
    let totalAmount = 0;

    // Get all checked regular service checkboxes
    const checkedBoxes = document.querySelectorAll('.edit-service-checkbox:checked');

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

    // Update the total amount display
    const totalElement = document.getElementById('editTotalAmount');
    if (totalElement) {
        totalElement.textContent = `₱${totalAmount.toFixed(2)}`;
    }

    // Update order summary
    updateEditOrderSummary();
}

function handleEditPackageSelection(event) {
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

    // Re-render services to show updated package
    renderEditServices();

    // Update service selection
    updateEditServiceSelection();
}

function handleEditPackageItemToggle(event) {
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
    renderEditServices();

    // Update service selection
    updateEditServiceSelection();
}

function updateEditOrderSummary() {
    const summaryContainer = document.getElementById('editSelectedServices');

    if (selectedServices.length === 0) {
        summaryContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No services selected</p>';
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
                    html += `<div class="flex justify-between items-center text-sm ml-4 text-green-700 mb-1">
                        <span>✓ ${item.name}</span>
                        <span class="text-xs">(included)</span>
                    </div>`;
                });

                // Show excluded services
                excludedServices.forEach(item => {
                    html += `<div class="flex justify-between items-center text-sm ml-4 text-gray-400 line-through mb-1">
                        <span>✗ ${item.name}</span>
                        <span class="text-xs">(excluded)</span>
                    </div>`;
                });

                html += '<div class="mb-3"></div>';
            } else {
                // Regular service
                html += `<div class="flex justify-between items-center">
                    <span>${service.name}</span>
                    <span class="font-semibold">₱${service.price.toFixed(2)}</span>
                </div>`;
            }
        });

        summaryContainer.innerHTML = html;
    }
}

async function handleEditAppointmentSubmission(event, appointmentId) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    // Get selected services from the global selectedServices array
    const selectedServiceNames = selectedServices.map(service => service.name);

    if (selectedServiceNames.length === 0) {
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
            services: selectedServiceNames,
            packageCustomizations: packageCustomizations,
            totalAmount: selectedServices.reduce((total, service) => total + service.price, 0)
        };

        console.log('DEBUG: Update data:', updateData);

        const response = await fetch(`${API_BASE}appointments.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });

        console.log('DEBUG: Update response status:', response.status);
        const updateResult = await response.json();
        console.log('DEBUG: Update result:', updateResult);

        if (updateResult.success) {
            showNotification('Appointment updated successfully', 'success');
            loadUserAppointments(); // Reload appointments
            closeModal('editAppointmentModal');
        } else {
            showNotification(updateResult.error || 'Error updating appointment', 'error');
        }
    } catch (error) {
        console.error('Error updating appointment:', error);
        showNotification('Error updating appointment', 'error');
    }
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

// Get category icon
function getCategoryIcon(category) {
    const icons = {
        basic: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>',
        package: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>',
        addon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12z"></path>'
    };

    return icons[category] || icons.basic;
}

// View vaccination proof function
function viewVaccinationProof(filePath) {
    // Open the vaccination proof in a new tab
    const fullUrl = `../${filePath}`;
    window.open(fullUrl, '_blank');
}

// Logout function
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

// Notification system
function showNotification(message, type) {
    if (typeof type === 'undefined') {
        type = 'info';
    }

    const notification = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };

    notification.className = 'fixed top-4 right-4 ' + colors[type] + ' text-white px-6 py-4 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300';
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(function() {
        notification.classList.remove('translate-x-full');
    }, 100);

    // Remove after 4 seconds
    setTimeout(function() {
        notification.classList.add('translate-x-full');
        setTimeout(function() {
            notification.remove();
        }, 300);
    }, 4000);
}
}