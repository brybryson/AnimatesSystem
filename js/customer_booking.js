// API base URL - adjust this to your server location
const API_BASE = 'http://localhost/animates/api/';

// Mobile menu toggle function
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('hidden');
}

let selectedServices = [];
let totalAmount = 0;
let servicesData = {};
let currentPetSize = '';
let petData = {};

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

// Service conflict definitions for preventing redundant selections
const serviceConflicts = {
    // Package conflicts (only one package allowed at a time - all packages include Bath & Dry)
    'Essential Grooming Package': ['Full Grooming Package', 'Bath & Brush Package', 'Spa Relaxation Package', 'Bath & Dry', 'Nail Trimming & Grinding', 'Ear Cleaning & Inspection'],
    'Full Grooming Package': ['Essential Grooming Package', 'Bath & Brush Package', 'Spa Relaxation Package', 'Bath & Dry', 'Haircut & Styling', 'Nail Trimming & Grinding', 'Ear Cleaning & Inspection', 'Teeth Cleaning', 'De-shedding Treatment'],
    'Bath & Brush Package': ['Essential Grooming Package', 'Full Grooming Package', 'Spa Relaxation Package', 'Bath & Dry', 'De-shedding Treatment'],
    'Spa Relaxation Package': ['Essential Grooming Package', 'Full Grooming Package', 'Bath & Brush Package', 'Bath & Dry', 'Paw Balm', 'Scented Cologne'],

    // Basic services conflicts with packages that include them
    'Bath & Dry': ['Essential Grooming Package', 'Full Grooming Package', 'Bath & Brush Package', 'Spa Relaxation Package'], // All packages include bathing
    'Nail Trimming & Grinding': ['Essential Grooming Package', 'Full Grooming Package'], // Essential and Full include nails
    'Ear Cleaning & Inspection': ['Essential Grooming Package', 'Full Grooming Package'], // Essential and Full include ears
    'Haircut & Styling': ['Full Grooming Package'], // Full package includes haircut
    'Teeth Cleaning': ['Full Grooming Package'], // Full package includes teeth
    'De-shedding Treatment': ['Bath & Brush Package', 'Full Grooming Package'], // Both packages include de-shedding

    // Add-ons can be combined with anything (no conflicts)
    'Extra Nail Polish': [],
    'Scented Cologne': [],
    'Bow or Bandana': [],
    'Paw Balm': [],
    'Whitening Shampoo': [],
    'Flea & Tick Treatment': []
};

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
    let petSize = formData.get('petSizeForPricing');
    // Map pet size values to match database expectations
    if (petSize === 'extra_large') {
        petSize = 'xlarge';
    }
    const ownerName = formData.get('ownerName');
    const ownerPhone = formData.get('ownerPhone');
    const ownerEmail = formData.get('ownerEmail');

    // Vaccination information
    const lastVaccineDate = formData.get('lastVaccineDate');
    const vaccineType = formData.get('vaccineType');
    const customVaccine = formData.get('customVaccine');
    const vaccinationProof = formData.get('vaccinationProof');

    // Debug: Log all form data
    console.log('DEBUG: Form data validation:', {
        petName, petType, petBreed, preferredDate, preferredTime, petSize,
        ownerName, ownerPhone, ownerEmail
    });

    const missingFields = [];
    if (!petName) missingFields.push('Pet Name');
    if (!petType) missingFields.push('Pet Type');
    if (!petBreed) missingFields.push('Pet Breed');
    if (!preferredDate) missingFields.push('Preferred Date');
    if (!preferredTime) missingFields.push('Preferred Time');
    if (!petSize) missingFields.push('Pet Size');
    if (!ownerName) missingFields.push('Owner Name');
    if (!ownerPhone) missingFields.push('Owner Phone');
    if (!ownerEmail) missingFields.push('Owner Email');
    if (!lastVaccineDate) missingFields.push('Last Vaccine Update Date');
    if (!vaccineType) missingFields.push('Type of Vaccine');
    if (vaccineType === 'others' && !customVaccine) missingFields.push('Custom Vaccine Name');

    if (missingFields.length > 0) {
        console.log('DEBUG: Missing fields:', missingFields);
        showNotification(`Please fill in all required fields. Missing: ${missingFields.join(', ')}`, 'warning');
        return;
    }

    // Get selected services - expand customized packages to individual service names
    const servicesToSubmit = [];
    const serviceNameSet = new Set();
    selectedServices.forEach(service => {
        if (service.customizations && service.customizations.selected) {
            // For customized packages, add the included service names
            const packageName = service.name.replace(' (Customized)', '');
            const packageItems = packageContents[packageName] || [];
            const includedServices = packageItems.filter(item =>
                !service.customizations.excludedServices.includes(item.name)
            );
            // Add the service names for included services
            includedServices.forEach(item => {
                if (!serviceNameSet.has(item.name)) {
                    serviceNameSet.add(item.name);
                    servicesToSubmit.push(item.name);
                }
            });
        } else {
            // Regular service
            if (!serviceNameSet.has(service.name)) {
                serviceNameSet.add(service.name);
                servicesToSubmit.push(service.name);
            }
        }
    });

    if (selectedServices.length === 0) {
        showNotification('Please select at least one service', 'warning');
        return;
    }

    // Date validation is now handled by input event listeners

    try {
        const token = localStorage.getItem('authToken');

        let vaccinationProofPath = null;

        // Upload vaccination proof first if provided
        if (vaccinationProof && vaccinationProof instanceof File) {
            console.log('Vaccination proof file detected, uploading first...');
            try {
                const uploadFormData = new FormData();
                uploadFormData.append('vaccinationProof', vaccinationProof);
                uploadFormData.append('action', 'upload_vaccination_proof');

                const uploadResponse = await fetch(API_BASE + 'check_in.php', {
                    method: 'POST',
                    body: uploadFormData
                });

                const uploadResult = await uploadResponse.json();
                console.log('Vaccination proof upload result:', uploadResult);

                if (uploadResult.success && uploadResult.file_path) {
                    vaccinationProofPath = uploadResult.file_path;
                    console.log('Vaccination proof uploaded successfully:', vaccinationProofPath);
                } else {
                    console.error('Vaccination proof upload failed:', uploadResult);
                    showNotification('Failed to upload vaccination proof: ' + (uploadResult.error || 'Unknown error'), 'error');
                    return;
                }
            } catch (uploadError) {
                console.error('Error uploading vaccination proof:', uploadError);
                showNotification('Error uploading vaccination proof: ' + uploadError.message, 'error');
                return;
            }
        }

        // Prepare booking data as JSON
        const appointmentData = {
            action: 'book_appointment',
            petName: petName,
            petType: petType,
            petBreed: petBreed,
            petSize: petSize,
            preferredDate: preferredDate,
            preferredTime: preferredTime,
            services: servicesToSubmit,
            packageCustomizations: packageCustomizations,
            specialInstructions: formData.get('specialInstructions') || '',
            totalAmount: selectedServices.reduce((total, service) => total + service.price, 0),
            lastVaccineDate: lastVaccineDate,
            vaccineType: vaccineType,
            customVaccine: customVaccine || '',
            vaccinationProofPath: vaccinationProofPath
        };

        console.log('DEBUG: Submitting appointment data as JSON:', appointmentData);

        const response = await fetch(`${API_BASE}appointments.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(appointmentData)
        });

        const result = await response.json();
        console.log('DEBUG: Appointment booking result:', result);

        if (result.success) {
            // Show success modal instead of notification
            showBookingSuccessModal();

            // Reset form
            form.reset();

            // Clear service selections
            document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = false;
            });

            // Reset package customizations
            packageCustomizations = {};

            // Re-render services
            renderServices();

            // Update order summary
            updateOrderSummary();

        } else {
            showNotification(result.error || 'Error booking appointment', 'error');
        }
    } catch (error) {
        console.error('Error booking appointment:', error);
        showNotification('Error booking appointment', 'error');
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

// Load current user profile and auto-fill owner information
async function loadUserProfile() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.log('No auth token found');
            return;
        }

        const response = await fetch(`${API_BASE}auth.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'get_profile'
            })
        });
        const result = await response.json();

        if (result.success && result.user) {
            console.log('DEBUG: Loaded user profile:', result.user);
            // Auto-fill owner information
            const ownerNameField = document.getElementById('ownerName');
            const ownerPhoneField = document.getElementById('ownerPhone');
            const ownerEmailField = document.getElementById('ownerEmail');

            console.log('DEBUG: Field elements found:', {
                ownerNameField: !!ownerNameField,
                ownerPhoneField: !!ownerPhoneField,
                ownerEmailField: !!ownerEmailField
            });

            if (ownerNameField && result.user.name) {
                ownerNameField.value = result.user.name;
                console.log('DEBUG: Set owner name to:', result.user.name);
            }
            if (ownerPhoneField && result.user.phone) {
                ownerPhoneField.value = result.user.phone;
                console.log('DEBUG: Set owner phone to:', result.user.phone);
            }
            if (ownerEmailField && result.user.email) {
                ownerEmailField.value = result.user.email;
                console.log('DEBUG: Set owner email to:', result.user.email);
            }
        } else {
            console.log('Failed to load user profile:', result);
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
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

// Set maximum date for vaccination date to disable future dates
function setVaccinationDateRestrictions() {
    const vaccinationDateInput = document.getElementById('lastVaccineDate');
    if (!vaccinationDateInput) return;

    // Set maximum date to today to disable all future dates
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    const todayStr = today.toISOString().split('T')[0];

    vaccinationDateInput.max = todayStr; // Disable dates after today

    // Clear any existing value - don't set a default so it shows empty
    vaccinationDateInput.value = '';
    vaccinationDateInput.defaultValue = '';

    // Force clear any cached or browser-set values
    setTimeout(() => {
        vaccinationDateInput.value = '';
    }, 1);

    // Add validation to enforce the rules
    const validateVaccinationDate = function() {
        const selectedDate = new Date(this.value);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        if (selectedDate > todayStart) {
            console.log('DEBUG: Selected vaccination date is in the future, resetting');
            this.value = '';
            showNotification('Vaccination date cannot be in the future. Please select today or earlier.', 'warning');
        }
    };

    vaccinationDateInput.addEventListener('change', validateVaccinationDate);
    vaccinationDateInput.addEventListener('input', validateVaccinationDate);
    vaccinationDateInput.addEventListener('blur', validateVaccinationDate);
    vaccinationDateInput.addEventListener('focus', function() {
        // Validate on focus in case of cached values
        setTimeout(validateVaccinationDate.bind(this), 100);
    });

    console.log('DEBUG: Disabled future dates for vaccination, max set to today:', todayStr);
}

// Set minimum date to disable past dates for appointment date
function setAppointmentDateRestrictions() {
    const appointmentDateInput = document.getElementById('preferredDate');
    if (!appointmentDateInput) return;

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

    appointmentDateInput.min = todayStr; // Always disable dates before today

    // Clear any existing value - don't set a default so it shows empty
    appointmentDateInput.value = '';
    appointmentDateInput.defaultValue = '';

    // Force clear any cached or browser-set values
    setTimeout(() => {
        appointmentDateInput.value = '';
    }, 1);

    // Add validation to enforce the rules
    const validateAppointmentDate = function() {
        const selectedDate = new Date(this.value);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);

        const currentHour = new Date().getHours();
        const currentMinute = new Date().getMinutes();
        const allowToday = currentHour < 16 || (currentHour === 16 && currentMinute <= 1);

        if (selectedDate < todayStart) {
            console.log('DEBUG: Selected appointment date is in the past, resetting');
            this.value = '';
            showNotification('Appointment date cannot be in the past. Please select today or later.', 'warning');
        } else if (!allowToday && selectedDate.getTime() === todayStart.getTime()) {
            console.log('DEBUG: Same-day bookings not allowed after 4:01 PM, resetting');
            this.value = '';
            showNotification('Same-day bookings are only available before 4:01 PM. Please select tomorrow or later.', 'warning');
        }
    };

    appointmentDateInput.addEventListener('change', validateAppointmentDate);
    appointmentDateInput.addEventListener('input', validateAppointmentDate);
    appointmentDateInput.addEventListener('blur', validateAppointmentDate);
    appointmentDateInput.addEventListener('focus', function() {
        // Validate on focus in case of cached values
        setTimeout(validateAppointmentDate.bind(this), 100);
    });

    console.log('DEBUG: Disabled past dates for appointment, min set to today:', todayStr);
}

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    // Load active bookings count
    loadUserBookings();

    // Load user profile and auto-fill owner information
    loadUserProfile();

    // Initialize pet type change handler
    initializePetTypeHandler();

    // Set date restrictions for appointment and vaccination dates
    setAppointmentDateRestrictions();
    setVaccinationDateRestrictions();

    // Load services when page loads
    loadServicesFromDatabase();

    // Initialize vaccination form handlers
    initializeVaccinationHandlers();

    // Add event listener for pet size selection
    const petSizeSelect = document.getElementById('petSizeForPricing');
    petSizeSelect.addEventListener('change', function() {
        currentPetSize = this.value;
        renderServices();
        // Clear selected services when size changes
        selectedServices = [];
        updateOrderSummary();
    });

    // Add event listeners for service selection
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
});


// Render services based on selected pet size
function renderServices() {
    const container = document.getElementById('servicesContainer');

    if (!servicesData) {
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
        html += renderServiceCategory('basic', '✂️ Basic Services', 'blue', servicesData.basic);
    }

    // Package Services
    if (servicesData.package && servicesData.package.length > 0) {
        html += renderServiceCategory('package', '📦 Grooming Packages', 'purple', servicesData.package);
    }

    // Add-on Services
    if (servicesData.addon && servicesData.addon.length > 0) {
        html += renderServiceCategory('addon', '🎀 Add-Ons & Finishing Touches', 'green', servicesData.addon);
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
    const packageId = service.name;

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

    // Store currently checked services before re-rendering
    const checkedServiceIds = Array.from(document.querySelectorAll('.service-checkbox:checked')).map(cb => cb.dataset.serviceId);
    const checkedPackageIds = Array.from(document.querySelectorAll('.package-checkbox:checked')).map(cb => cb.dataset.packageId);

    // Update package customization state
    packageCustomizations[packageId].selected = checkbox.checked;

    // If unchecking package, reset customizations
    if (!checkbox.checked) {
        packageCustomizations[packageId].excludedServices = [];
    }

    // Re-render services to show/hide package customization options
    renderServices();

    // Restore checked state after re-rendering
    checkedServiceIds.forEach(serviceId => {
        const serviceCheckbox = document.querySelector(`.service-checkbox[data-service-id="${serviceId}"]`);
        if (serviceCheckbox) {
            serviceCheckbox.checked = true;
        }
    });

    checkedPackageIds.forEach(pkgId => {
        const packageCheckbox = document.querySelector(`.package-checkbox[data-package-id="${pkgId}"]`);
        if (packageCheckbox) {
            packageCheckbox.checked = true;
        }
    });

    // Uncheck conflicting individual services when package is selected
    if (checkbox.checked) {
        document.querySelectorAll('.service-checkbox').forEach(serviceCheckbox => {
            const serviceNameCheck = serviceCheckbox.dataset.service;
            if (serviceConflicts[serviceNameCheck]?.includes(serviceName)) {
                serviceCheckbox.checked = false;
            }
        });
    }

    // Update service selection after re-rendering
    updateServiceSelection();
}

// Handle package item toggle
function handlePackageItemToggle(event) {
    const checkbox = event.target;
    const packageId = checkbox.dataset.packageId;
    const serviceName = checkbox.dataset.serviceName;

    // Store currently checked services before re-rendering
    const checkedServiceIds = Array.from(document.querySelectorAll('.service-checkbox:checked')).map(cb => cb.dataset.serviceId);
    const checkedPackageIds = Array.from(document.querySelectorAll('.package-checkbox:checked')).map(cb => cb.dataset.packageId);

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

    // Restore checked state after re-rendering
    checkedServiceIds.forEach(serviceId => {
        const serviceCheckbox = document.querySelector(`.service-checkbox[data-service-id="${serviceId}"]`);
        if (serviceCheckbox) {
            serviceCheckbox.checked = true;
        }
    });

    checkedPackageIds.forEach(pkgId => {
        const packageCheckbox = document.querySelector(`.package-checkbox[data-package-id="${pkgId}"]`);
        if (packageCheckbox) {
            packageCheckbox.checked = true;
        }
    });

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

// Handle service selection with decimal support and granular mutual exclusion logic
function updateServiceSelection() {
    selectedServices = [];
    totalAmount = 0;

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
        selectedServiceNames.add(pkg.name.replace(' (Customized)', '')); // Add base package name for conflicts
        totalAmount += pkg.price;
    });


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
                // Check if current service conflicts with selected service
                if (serviceConflicts[serviceName]?.includes(selectedName)) {
                    isConflicted = true;
                    break;
                }
                // Check if selected service conflicts with current service
                if (serviceConflicts[selectedName]?.includes(serviceName)) {
                    isConflicted = true;
                    break;
                }
            }

            if (isConflicted) {
                // Disable and uncheck conflicting service
                checkbox.disabled = true;
                checkbox.checked = false;
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

    // Apply package conflicts - disable conflicting packages (only if packages exist)
    if (servicesData.package && Array.isArray(servicesData.package) && servicesData.package.length > 0) {
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

            if (isConflicted) {
                // Disable and uncheck conflicting package
                checkbox.disabled = true;
                checkbox.checked = false;
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
}

// Load services when page loads
async function loadServicesFromDatabase() {
    try {
        const response = await fetch(API_BASE + 'services.php?action=get_services');
        const result = await response.json();

        if (result.success) {
            servicesData = result.services;
            renderServices();
        } else {
            throw new Error(result.error || 'Failed to load services');
        }
    } catch (error) {
        console.error('Error loading services:', error);
        showNotification('Failed to load services. Please refresh the page.', 'error');

        // Show error state in services container
        document.getElementById('servicesContainer').innerHTML = `
            <div class="text-center py-8">
                <svg class="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-red-600 font-medium">Failed to load services</p>
                <button onclick="loadServicesFromDatabase()" class="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Update order summary display
function updateOrderSummary() {
    const servicesContainer = document.getElementById('selectedServices');
    const totalElement = document.getElementById('totalAmount');

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

                // Show package price
                html += `<div class="flex justify-between items-center text-sm font-medium mt-2 pt-2 border-t border-gray-100">
                    <span>${packageName} Total</span>
                    <span>₱${service.price.toFixed(2)}</span>
                </div>`;

                html += '<div class="mb-3"></div>';
            } else {
                // Regular service
                html += `<div class="flex justify-between items-center text-sm">
                    <span>${service.name}</span>
                    <span>₱${service.price.toFixed(2)}</span>
                </div>`;
            }
        });

        servicesContainer.innerHTML = html;
    }

    totalElement.textContent = `₱${totalAmount.toFixed(2)}`;
}



// Handle form submission for appointment booking
document.getElementById('appointmentForm').addEventListener('submit', handleAppointmentSubmission);

// Show booking success modal
function showBookingSuccessModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-2">Booking Completed!</h3>
            <p class="text-gray-600 mb-6">Your appointment has been successfully booked.</p>
            <button onclick="redirectToAppointments()" class="w-full bg-gold-500 hover:bg-gold-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                View My Appointments
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

// Redirect to appointments page
function redirectToAppointments() {
    window.location.href = 'customer_appointments.html';
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

// Initialize vaccination form handlers
function initializeVaccinationHandlers() {
    // Vaccine type multi-select change handler
    const vaccineTypeSelect = document.getElementById('vaccineType');
    if (vaccineTypeSelect) {
        vaccineTypeSelect.addEventListener('change', handleVaccineTypeChange);
    }

    // Vaccination proof file upload handler
    const vaccinationProofInput = document.getElementById('vaccinationProof');
    if (vaccinationProofInput) {
        vaccinationProofInput.addEventListener('change', handleVaccinationProofUpload);
    }

    // Vaccination proof upload button handler
    const uploadButton = document.getElementById('vaccinationUploadBtn');
    if (uploadButton) {
        uploadButton.addEventListener('click', function() {
            vaccinationProofInput.click();
        });
    }

    // Vaccination proof remove button handler
    const removeButton = document.getElementById('vaccinationRemoveBtn');
    if (removeButton) {
        removeButton.addEventListener('click', removeVaccinationProof);
    }
}

// Handle vaccine type selection changes
function handleVaccineTypeChange() {
    const vaccineTypeSelect = document.getElementById('vaccineType');
    const customVaccineContainer = document.getElementById('customVaccineContainer');
    const customVaccineInput = document.getElementById('customVaccine');

    if (!vaccineTypeSelect || !customVaccineContainer || !customVaccineInput) return;

    const selectedValue = vaccineTypeSelect.value;
    const hasOthers = selectedValue === 'others';

    if (hasOthers) {
        customVaccineContainer.classList.remove('hidden');
        customVaccineInput.required = true;
    } else {
        customVaccineContainer.classList.add('hidden');
        customVaccineInput.required = false;
        customVaccineInput.value = '';
    }
}

// Handle vaccination proof file upload
function handleVaccinationProofUpload(event) {
    const input = event.target;
    const file = input.files[0];
    const uploadArea = document.getElementById('uploadArea');
    const previewArea = document.getElementById('previewArea');
    const vaccinationPreview = document.getElementById('vaccinationPreview');

    console.log('File upload triggered, file:', file);
    console.log('Input element:', input);
    console.log('Files array:', input.files);

    if (!file) {
        console.log('No file selected');
        // Reset to upload area
        uploadArea.classList.remove('hidden');
        previewArea.classList.add('hidden');
        return;
    }

    console.log('File selected:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
        console.log('Invalid file type:', file.type);
        showNotification('Please select a valid image file (JPG, PNG, GIF) or PDF.', 'error');
        input.value = '';
        return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
        console.log('File too large:', file.size);
        showNotification('File size must be less than 10MB.', 'error');
        input.value = '';
        return;
    }

    // Store file data for form submission
    petData.vaccinationProof = file;

    // Show preview for images
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            vaccinationPreview.src = e.target.result;
            uploadArea.classList.add('hidden');
            previewArea.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        // For PDFs, just show file info
        vaccinationPreview.src = ''; // Clear any previous image
        vaccinationPreview.alt = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        uploadArea.classList.add('hidden');
        previewArea.classList.remove('hidden');
    }

    console.log('File upload successful');
    showNotification('Vaccination proof uploaded successfully.', 'success');
}

// Remove vaccination proof
function removeVaccinationProof() {
    const vaccinationProofInput = document.getElementById('vaccinationProof');
    const uploadArea = document.getElementById('uploadArea');
    const previewArea = document.getElementById('previewArea');

    vaccinationProofInput.value = '';
    uploadArea.classList.remove('hidden');
    previewArea.classList.add('hidden');

    showNotification('Vaccination proof removed.', 'info');
}
