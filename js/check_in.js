let currentStep = 1;
let selectedServices = [];
let totalAmount = 0;
let petData = {};
let bookingId = null;
let rfidPollingInterval = null;
let rfidAssigned = false;
let lastNotifiedError = null; // Track last error to prevent spam
let servicesData = {};
let currentPetSize = '';
// API base URL - adjust this to your server location
const API_BASE = 'http://localhost/animates/api/';

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


// Add this function near the top of the file with other utility functions
function getPhysicalCardNumber(cardUID) {
    const cardMapping = {
        '73:77:f8:39': 'Card #1',
        'c2:48:94:ab': 'Card #2', 
        '11:7b:b0:01': 'Card #4',
        '4c:3f:b6:01': 'Card #6',
        '53:89:08:02': 'Card #3',
        '69:33:b2:01': 'Card #5'
    };
    
    return cardMapping[cardUID] || `Unknown Card (${cardUID})`;
}


// Load services when page loads
document.addEventListener('DOMContentLoaded', function() {
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
});

async function loadServicesFromDatabase() {
    try {
        const response = await fetch(API_BASE + 'services.php?action=get_services');
        const result = await response.json();

        // Debug file upload
        console.log('File upload debug:', result.debug_file_upload);

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

function renderServices() {
    const container = document.getElementById('servicesContainer');
    
    if (!currentPetSize) {
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
    
    let html = '';
    
    // Basic Services (individual services)
    if (servicesData.basic && servicesData.basic.length > 0) {
        html += renderServiceCategory('basic', '✂️ Basic Services', 'blue', servicesData.basic);
    }

    // Package Templates (starting points)
    if (servicesData.package && Array.isArray(servicesData.package) && servicesData.package.length > 0) {
        html += renderServiceCategory('package', '📦 Grooming Packages', 'purple', servicesData.package);
    }

    // Add-ons (enhance any service)
    if (servicesData.addon && servicesData.addon.length > 0) {
        html += renderServiceCategory('addon', '🎀 Add-Ons & Finishing Touches', 'green', servicesData.addon);
    }
    
    container.innerHTML = html;
    
    // Re-attach event listeners
    const checkboxes = document.querySelectorAll('.service-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateServiceSelection);
    });

    // Package selection listeners (only if packages exist)
    if (servicesData.package && Array.isArray(servicesData.package) && servicesData.package.length > 0) {
        const packageCheckboxes = document.querySelectorAll('.package-checkbox');
        packageCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', handlePackageSelection);
        });

        // Package item customization listeners
        const packageItemCheckboxes = document.querySelectorAll('.package-item-checkbox');
        packageItemCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', handlePackageItemToggle);
        });
    }
}

function handlePackageSelection(event) {
    const checkbox = event.target;
    const packageId = checkbox.dataset.packageId;
    const serviceName = checkbox.dataset.service;
    const basePrice = parseFloat(checkbox.dataset.basePrice);

    // Update package customization state
    packageCustomizations[packageId].selected = checkbox.checked;

    // If unchecking package, reset customizations and remove from selectedServices
    if (!checkbox.checked) {
        packageCustomizations[packageId].excludedServices = [];
        // Remove the package from selectedServices
        selectedServices = selectedServices.filter(s => s.name !== serviceName && s.name !== `${serviceName} (Customized)`);
    } else {
        // Check if this package conflicts with any already selected packages
        const conflictingPackage = selectedServices.find(s =>
            s.name.includes('Package') &&
            s.name !== serviceName &&
            s.name !== `${serviceName} (Customized)` &&
            serviceConflicts[serviceName]?.includes(s.name.replace(' (Customized)', ''))
        );

        // If there's a conflicting package, remove it first
        if (conflictingPackage) {
            selectedServices = selectedServices.filter(s => s !== conflictingPackage);
            // Also update the conflicting package's customization state
            Object.keys(packageCustomizations).forEach(pkgId => {
                const pkgCheckbox = document.querySelector(`[data-package-id="${pkgId}"]`);
                if (pkgCheckbox && pkgCheckbox.dataset.service === conflictingPackage.name.replace(' (Customized)', '')) {
                    packageCustomizations[pkgId].selected = false;
                    packageCustomizations[pkgId].excludedServices = [];
                }
            });
        }

        // Add the package to selectedServices if not already there
        const existingPackage = selectedServices.find(s => s.id === parseInt(checkbox.dataset.serviceId));
        if (!existingPackage) {
            // Calculate customized price
            let customizedPrice = basePrice;
            packageCustomizations[packageId].excludedServices.forEach(() => {
                const exclusionDiscount = basePrice * 0.15;
                customizedPrice -= exclusionDiscount;
            });
            customizedPrice = Math.max(customizedPrice, basePrice * 0.6);

            selectedServices.push({
                id: parseInt(checkbox.dataset.serviceId),
                name: `${serviceName} (Customized)`,
                price: customizedPrice,
                customizations: {
                    selected: true,
                    excludedServices: packageCustomizations[packageId].excludedServices,
                    includedServices: packageContents[serviceName].filter(item => !packageCustomizations[packageId].excludedServices.includes(item.name)).map(item => item.name)
                }
            });
        }
    }

    // Update order summary
    updateOrderSummary();

    // Then re-render services to show updated package
    renderServices();

    // Ensure selectedServices is consistent with the UI and handle conflicts
    updateServiceSelection();
}

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

    // Update service selection to handle conflicts after customization changes
    updateServiceSelection();

    // Then re-render services to update pricing
    renderServices();
}

function renderCustomizablePackage(service, colors) {
    const packageName = service.name;
    const packageItems = packageContents[packageName] || [];
    const basePrice = getServicePrice(service);
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
    const icons = {
        basic: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>',
        premium: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>',
        addon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12z"></path>'
    };
    
    let html = `
        <div class="bg-gradient-to-r ${colors.gradient} border-2 ${colors.border} rounded-xl p-6 shadow-sm">
            <div class="flex items-center mb-4">
                <div class="inline-flex items-center justify-center w-10 h-10 ${colors.iconBg} rounded-full mr-3">
                    <svg class="w-6 h-6 ${colors.iconText}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${icons[categoryKey]}
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
        const price = getServicePrice(service);
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

        const isChecked = selectedServices.some(s => s.id === service.id);
        html += `
            <label class="flex items-center p-4 bg-white/80 rounded-lg border ${colors.itemBorder} transition-all duration-200 cursor-pointer hover:shadow-md ${isDisabled ? 'opacity-60' : ''}">
                <input type="checkbox" class="service-checkbox w-5 h-5 text-primary rounded"
                        data-service-id="${service.id}"
                        data-service="${service.name}"
                        data-price="${price}"
                        ${isDisabled ? 'disabled data-original-disabled="true"' : ''}
                        ${isChecked ? 'checked' : ''}>
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


function getServicePrice(service) {
    // For size-based services, return specific size price if available
    if (service.is_size_based && currentPetSize && service.pricing && service.pricing[currentPetSize]) {
        return service.pricing[currentPetSize];
    }
    
    // For non-size-based services, return any available price
    if (!service.is_size_based) {
        // Check if there's a fixed price in pricing object
        if (service.pricing && Object.keys(service.pricing).length > 0) {
            return Object.values(service.pricing)[0]; // Return first available price
        }
        // Fallback to base price
        if (service.base_price && service.base_price > 0) {
            return service.base_price;
        }
    }
    
    // Return 0 if no price available (will trigger "Select pet size first" message)
    return 0;
}




// Step navigation
async function nextStep() {
    if (currentStep === 1) {
        if (validatePetInfo()) {
            // Upload vaccination proof immediately if provided
            if (petData.vaccinationProof && petData.vaccinationProof instanceof File) {
                console.log('File detected, starting upload...');
                try {
                    const formData = new FormData();
                    formData.append('vaccinationProof', petData.vaccinationProof);
                    formData.append('action', 'upload_vaccination_proof');

                    console.log('Sending upload request...');
                    const response = await fetch(API_BASE + 'check_in.php', {
                        method: 'POST',
                        body: formData
                    });

                    console.log('Upload response status:', response.status);
                    const result = await response.json();
                    console.log('Upload result:', result);

                    if (result.success && result.file_path) {
                        // Store the file path for later use
                        petData.vaccinationProofPath = result.file_path;
                        console.log('Vaccination proof uploaded successfully:', result.file_path);
                        showNotification('Vaccination proof uploaded successfully', 'success');
                    } else {
                        console.error('Upload failed:', result);
                        showNotification('Failed to upload vaccination proof: ' + (result.error || 'Unknown error'), 'error');
                        return; // Don't proceed if upload fails
                    }
                } catch (error) {
                    console.error('Error uploading vaccination proof:', error);
                    showNotification('Error uploading vaccination proof: ' + error.message, 'error');
                    return; // Don't proceed if upload fails
                }
            } else {
                console.log('No vaccination proof to upload');
            }

            goToStep(2);
        }
    } else if (currentStep === 2) {
        // Validate pet size selection
        if (!currentPetSize) {
            showNotification('Please select your pet size for pricing', 'warning');
            document.getElementById('petSizeForPricing').focus();
            return;
        }

        if (selectedServices.length > 0) {
            goToStep(3);
            startRFIDAssignment();
        } else {
            showNotification('Please select at least one service', 'warning');
        }
    }
}

function previousStep() {
    if (currentStep === 3) {
        stopRFIDPolling();
    }
    goToStep(currentStep - 1);
}

function goToStep(step) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(el => el.classList.add('hidden'));
    
    // Show current step
    if (step === 'success') {
        document.getElementById('success-message').classList.remove('hidden');
        updateProgress('success');
    } else {
        document.getElementById(`form-step-${step}`).classList.remove('hidden');
        updateProgress(step);
        currentStep = step;
    }
}

function updateProgress(step) {
    // Reset all steps
    for (let i = 1; i <= 3; i++) {
        const stepEl = document.getElementById(`step${i}`);
        const textEl = document.getElementById(`step${i}-text`);
        const progressEl = document.getElementById(`progress${i}`);
        
        if (i < step || (step === 'success' && i <= 2)) {
            stepEl.className = 'w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium';
            stepEl.innerHTML = '✓';
            textEl.className = 'ml-2 text-sm font-medium text-green-600';
            if (progressEl) progressEl.className = 'w-16 h-0.5 bg-green-500';
        } else if (i === step && step !== 'success') {
            stepEl.className = 'w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium';
            stepEl.innerHTML = i;
            textEl.className = 'ml-2 text-sm font-medium text-gray-900';
        } else if (step === 'success' && i === 3) {
            stepEl.className = 'w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium';
            stepEl.innerHTML = '✓';
            textEl.className = 'ml-2 text-sm font-medium text-green-600';
        } else {
            stepEl.className = 'w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-500 text-sm font-medium';
            stepEl.innerHTML = i;
            textEl.className = 'ml-2 text-sm font-medium text-gray-500';
            if (progressEl) progressEl.className = 'w-16 h-0.5 bg-gray-300';
        }
    }
}

function validatePetInfo() {
    const required = ['petName', 'petType', 'ownerName', 'ownerPhone', 'ownerEmail', 'lastVaccineDate'];
    let isValid = true;

    required.forEach(field => {
        const input = document.getElementById(field);
        if (!input.value.trim()) {
            input.classList.add('border-red-500');
            isValid = false;
        } else {
            input.classList.remove('border-red-500');
            petData[field] = input.value.trim();
        }
    });

    // Special validation for vaccination proof file
    const vaccinationProofInput = document.getElementById('vaccinationProof');
    if (!vaccinationProofInput.files || vaccinationProofInput.files.length === 0) {
        // Vaccination proof is required, so fail validation if not provided
        vaccinationProofInput.classList.add('border-red-500');
        isValid = false;
    } else {
        vaccinationProofInput.classList.remove('border-red-500');
        // File is already stored in petData.vaccinationProof from the upload handler
    }

    // No custom pet type handling needed (removed "others" option)

    // Validate pet breed
    const breedSelect = document.getElementById('petBreed');
    if (!breedSelect.value) {
        breedSelect.classList.add('border-red-500');
        isValid = false;
    } else {
        breedSelect.classList.remove('border-red-500');
        petData.petBreed = breedSelect.value;
    }

    // Validate vaccine type selection
    const vaccineTypeSelect = document.getElementById('vaccineType');
    const selectedVaccine = vaccineTypeSelect.value;
    if (!selectedVaccine) {
        vaccineTypeSelect.classList.add('border-red-500');
        isValid = false;
    } else {
        vaccineTypeSelect.classList.remove('border-red-500');
        petData.vaccineTypes = [selectedVaccine]; // Store as array for consistency

        // Check if "others" is selected and custom vaccine is provided
        if (selectedVaccine === 'others') {
            const customVaccineInput = document.getElementById('customVaccine');
            if (!customVaccineInput.value.trim()) {
                customVaccineInput.classList.add('border-red-500');
                isValid = false;
            } else {
                customVaccineInput.classList.remove('border-red-500');
                petData.customVaccine = customVaccineInput.value.trim();
            }
        }
    }

    // Store optional fields (petAge only, remove petSize)
    petData.petAge = document.getElementById('petAge').value;
    petData.specialNotes = document.getElementById('specialNotes').value;

    return isValid;
}

// Pet type change handler
document.addEventListener('DOMContentLoaded', function() {
    const petTypeSelect = document.getElementById('petType');
    const petBreedSelect = document.getElementById('petBreed');
    const petBreedCustom = document.getElementById('petBreedCustom');
    
    petTypeSelect.addEventListener('change', async function() {
        const petType = this.value;

        if (petType) {
            petBreedSelect.classList.remove('hidden');
            petBreedSelect.disabled = false;
            petBreedSelect.required = true;

            await loadBreeds(petType);
        } else {
            petBreedSelect.disabled = true;
            petBreedSelect.required = false;
            petBreedSelect.innerHTML = '<option value="">First select pet type</option>';
        }
    });

    // Initialize service selection listeners
    const checkboxes = document.querySelectorAll('.service-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateServiceSelection);
    });
});

// Load breeds from API
async function loadBreeds(petType) {
    const petBreedSelect = document.getElementById('petBreed');
    
    try {
        petBreedSelect.innerHTML = '<option value="">Loading breeds...</option>';
        
        let apiUrl = '';
        if (petType === 'dog') {
            apiUrl = 'https://dog.ceo/api/breeds/list/all';
        } else if (petType === 'cat') {
            apiUrl = 'https://api.thecatapi.com/v1/breeds';
        }
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        petBreedSelect.innerHTML = '<option value="">Select breed</option>';
        
        if (petType === 'dog') {
            const breeds = Object.keys(data.message);
            breeds.forEach(breed => {
                const option = document.createElement('option');
                option.value = breed;
                option.textContent = breed.charAt(0).toUpperCase() + breed.slice(1);
                petBreedSelect.appendChild(option);
            });
        } else if (petType === 'cat') {
            data.forEach(breed => {
                const option = document.createElement('option');
                option.value = breed.name;
                option.textContent = breed.name;
                petBreedSelect.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error loading breeds:', error);
        petBreedSelect.innerHTML = '<option value="">Error loading breeds - please select "Others" and enter manually</option>';
        showNotification('Could not load breed list. Please select "Others" and enter breed manually.', 'warning');
    }
}

// Handle service selection with decimal support and granular mutual exclusion logic
function updateServiceSelection() {
    // Preserve previously selected services that are still valid
    const previousSelectedServices = [...selectedServices];
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

    // Add regular services - preserve previously selected ones that are still checked
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
    const serviceConflicts = {
        // Package conflicts (only one package allowed at a time - all packages include Bath & Dry)
        'Essential Grooming Package': ['Full Grooming Package', 'Bath & Brush Package', 'Spa Relaxation Package'],
        'Full Grooming Package': ['Essential Grooming Package', 'Bath & Brush Package', 'Spa Relaxation Package'],
        'Bath & Brush Package': ['Essential Grooming Package', 'Full Grooming Package', 'Spa Relaxation Package'],
        'Spa Relaxation Package': ['Essential Grooming Package', 'Full Grooming Package', 'Bath & Brush Package'],

        // Individual service conflicts (prevent duplicate/conflicting individual services)
        'Bath & Dry': ['Bath & Dry'], // Prevent duplicate selection
        'Nail Trimming & Grinding': ['Nail Trimming & Grinding'],
        'Ear Cleaning & Inspection': ['Ear Cleaning & Inspection'],
        'Haircut & Styling': ['Haircut & Styling'],
        'Teeth Cleaning': ['Teeth Cleaning'],
        'De-shedding Treatment': ['De-shedding Treatment'],

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

            let isConflicted = false;

            // Check conflicts with other individual services first
            for (const selectedName of selectedServiceNames) {
                if (!selectedName.includes('Package') && !selectedName.includes(' (Customized)')) {
                    if (serviceConflicts[serviceName]?.includes(selectedName)) {
                        isConflicted = true;
                        break;
                    }
                    if (serviceConflicts[selectedName]?.includes(serviceName)) {
                        isConflicted = true;
                        break;
                    }
                }
            }

            // Check if this basic service is included in any selected package
            if (!isConflicted && categoryTitle === '✂️ Basic Services') {
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
            }

            // Never disable a service that is already checked
            if (checkbox.checked) {
                isConflicted = false;
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

    // Apply package conflicts - disable packages that contain already selected basic services
    if (servicesData.package && Array.isArray(servicesData.package) && servicesData.package.length > 0) {
        document.querySelectorAll('.package-checkbox').forEach(checkbox => {
            const packageName = checkbox.dataset.service;
            const packageContainer = checkbox.closest('.bg-white\\/80');

            let isConflicted = false;

            // Check conflicts with other packages first
            for (const selectedName of selectedServiceNames) {
                if (selectedName.includes('Package') && selectedName !== packageName && !selectedName.includes(' (Customized)')) {
                    if (serviceConflicts[packageName]?.includes(selectedName)) {
                        isConflicted = true;
                        break;
                    }
                    if (serviceConflicts[selectedName]?.includes(packageName)) {
                        isConflicted = true;
                        break;
                    }
                }
            }

            // Check if this package contains any already selected basic services
            if (!isConflicted) {
                const pkgContents = packageContents[packageName] || [];

                for (const service of pkgContents) {
                    // Check if this service is already selected as a basic service
                    const basicServiceCheckbox = document.querySelector(`.service-checkbox[data-service="${service.name}"]`);
                    if (basicServiceCheckbox && basicServiceCheckbox.checked) {
                        isConflicted = true;
                        break;
                    }
                }
            }

            // Never disable a package that is already checked
            if (checkbox.checked) {
                isConflicted = false;
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

    // Enable/disable next button
    const nextBtn = document.getElementById('servicesNextBtn');
    if (selectedServices.length > 0) {
        nextBtn.disabled = false;
        nextBtn.className = 'bg-primary hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors';
        nextBtn.textContent = 'Next: RFID Assignment';
    } else {
        nextBtn.disabled = true;
        nextBtn.className = 'bg-gray-300 text-gray-500 px-8 py-3 rounded-lg font-medium cursor-not-allowed';
    }
}






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

    totalElement.textContent = `₱${totalAmount.toFixed(2)}`;
}

// RFID Assignment and MySQL Integration
function startRFIDAssignment() {
    const rfidStatus = document.getElementById('rfidStatus');
    const rfidMessage = document.getElementById('rfidMessage');
    const assignedTag = document.getElementById('assignedTag');
    
    // Reset RFID state
    rfidAssigned = false;
    
    // Update booking summary
    updateBookingSummary();
    
    // Show initial message
    rfidStatus.textContent = 'Waiting for RFID tap...';
    rfidMessage.textContent = 'Please tap your RFID card on the scanner';
    assignedTag.textContent = '';
    
    // Disable complete button
    const completeBtn = document.getElementById('completeBtn');
    completeBtn.disabled = true;
    completeBtn.className = 'bg-gray-300 text-gray-500 px-8 py-3 rounded-lg font-medium cursor-not-allowed';
    
    // Start polling for RFID data from MySQL
    startRFIDPolling();
}

function startRFIDPolling() {
    // Stop any existing polling
    stopRFIDPolling();
    
    // Reset error tracking
    lastNotifiedError = null;
    
    // Poll every 2 seconds for new RFID data from MySQL
    rfidPollingInterval = setInterval(async () => {
        try {
            const response = await fetch(API_BASE + 'check_in.php?action=get_latest_rfid');
            const result = await response.json();
            
            if (result.success && !rfidAssigned) {
                // Clear any previous error
                lastNotifiedError = null;
                handleRFIDDetection(result);
            } else if (!result.success && result.message) {
                // Only show error notification if it's different from the last one
                if (lastNotifiedError !== result.message) {
                    lastNotifiedError = result.message;
                    // Only show notification for important errors, not repetitive ones
                    if (!result.message.includes('currently in use') && !result.message.includes('No RFID data found')) {
                        showNotification(result.message, 'warning');
                    }
                }
            }
        } catch (error) {
            console.error('RFID polling error:', error);
            // Only show network errors once
            if (lastNotifiedError !== 'network_error') {
                lastNotifiedError = 'network_error';
                showNotification('Connection error. Please check your network.', 'error');
            }
        }
    }, 2000);
}

function stopRFIDPolling() {
    if (rfidPollingInterval) {
        clearInterval(rfidPollingInterval);
        rfidPollingInterval = null;
    }
    // Reset error tracking when stopping
    lastNotifiedError = null;
}

function handleRFIDDetection(rfidData) {
    const rfidStatus = document.getElementById('rfidStatus');
    const rfidMessage = document.getElementById('rfidMessage');
    const assignedTag = document.getElementById('assignedTag');
    const pulseIndicator = document.querySelector('.flex.space-x-1'); // Select the pulse container
    
    if (rfidData.isFirstTap) {
        // Get physical card number
        const physicalCardNumber = getPhysicalCardNumber(rfidData.cardUID);
        
        // First tap - assign RFID for check-in
        rfidStatus.textContent = 'RFID Card Detected!';
        rfidMessage.textContent = `${physicalCardNumber} assigned successfully`;
        assignedTag.innerHTML = `
            <div class="text-center">
                <div class="text-3xl font-mono font-bold text-primary mb-1">${rfidData.customUID}</div>
                <div class="text-sm text-gray-600">${physicalCardNumber}</div>
              
            </div>
        `;
        
        // Hide the pulse animation
        if (pulseIndicator) {
            pulseIndicator.style.display = 'none';
        }
        
        // Store RFID data
        petData.rfidTag = rfidData.customUID;
        rfidAssigned = true;
        
        // Enable complete button
        const completeBtn = document.getElementById('completeBtn');
        completeBtn.disabled = false;
        completeBtn.className = 'bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium transition-colors';
        
        // Stop polling
        stopRFIDPolling();
        
        showNotification(`${physicalCardNumber} detected and assigned!`, 'success');
        
    } else {
        // Get physical card number for subsequent taps too
        const physicalCardNumber = getPhysicalCardNumber(rfidData.cardUID);
        
        // Subsequent tap - show status update message
        rfidStatus.textContent = `RFID Tap #${rfidData.tapCount} Detected`;
        rfidMessage.textContent = `${physicalCardNumber} - Pet status updated`;
        showNotification(`${physicalCardNumber} tap #${rfidData.tapCount} logged - Status updated`, 'info');
    }
}

// Add this variable at the top with other global variables
// Add this variable at the top with other global variables
let isProcessingBooking = false;

async function completeBooking() {
    if (!rfidAssigned || !petData.rfidTag) {
        showNotification('Please wait for RFID assignment before completing check-in', 'warning');
        return;
    }
    
    // Prevent multiple clicks
    if (isProcessingBooking) {
        showNotification('Booking is already being processed, please wait...', 'info');
        return;
    }
    
    try {
        // Set processing state
        isProcessingBooking = true;
        
        // Disable the button and show loading state
        const completeBtn = document.getElementById('completeBtn');
        const originalText = completeBtn.innerHTML;
        completeBtn.disabled = true;
        completeBtn.className = 'bg-gray-400 text-gray-600 px-8 py-3 rounded-lg font-medium cursor-not-allowed flex items-center';
        completeBtn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing Booking...
        `;
        
        // Also disable back button to prevent navigation during processing
        const backBtn = document.querySelector('button[onclick="previousStep()"]');
        if (backBtn) {
            backBtn.disabled = true;
            backBtn.className = 'bg-gray-200 text-gray-400 px-8 py-3 rounded-lg font-medium cursor-not-allowed border border-gray-300';
        }
        
        showNotification('Creating booking and sending confirmation email...', 'info');
        
        // Prepare package customizations data
        const packageCustomizationsData = {};
        Object.entries(packageCustomizations).forEach(([packageId, customization]) => {
            if (customization.selected) {
                // Find the package name by matching the packageId
                let packageName = null;
                for (const [name, contents] of Object.entries(packageContents)) {
                    // Check if this package exists in servicesData
                    const serviceData = servicesData.package?.find(p => p.name === name);
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

        // Create FormData for file upload support
        const formData = new FormData();

        // Map pet size values to match database expectations
        let mappedPetSize = currentPetSize || petData.petSize;
        if (mappedPetSize === 'extra_large') {
            mappedPetSize = 'xlarge';
        }

        // Add all booking data
        formData.append('petName', petData.petName);
        formData.append('petType', petData.petType);
        formData.append('petBreed', petData.petBreed);
        formData.append('petAge', petData.petAge);
        formData.append('petSize', mappedPetSize); // Use mapped size value
        formData.append('selectedPetSize', currentPetSize || petData.selectedPetSize);
        formData.append('ownerName', petData.ownerName);
        formData.append('ownerPhone', petData.ownerPhone);
        formData.append('ownerEmail', petData.ownerEmail);
        formData.append('specialNotes', petData.specialNotes || '');
        formData.append('lastVaccineDate', petData.lastVaccineDate);
        formData.append('vaccineTypes', JSON.stringify(petData.vaccineTypes));
        formData.append('customVaccine', petData.customVaccine || '');
        formData.append('services', JSON.stringify(selectedServices));
        formData.append('packageCustomizations', JSON.stringify(packageCustomizationsData));
        formData.append('totalAmount', parseFloat(totalAmount.toFixed(2)));
        formData.append('customRFID', petData.rfidTag);

        // Add vaccination proof path if it was uploaded earlier
        if (petData.vaccinationProofPath) {
            formData.append('vaccinationProofPath', petData.vaccinationProofPath);
        }

        console.log('Sending booking data with FormData');
        console.log('API URL:', API_BASE + 'check_in.php');

        // Debug: Log FormData contents
        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                console.log(key + ': File(' + value.name + ', ' + value.size + ' bytes)');
            } else {
                console.log(key + ': ' + value);
            }
        }

        // Log vaccination proof status
        if (petData.vaccinationProofPath) {
            console.log('Using pre-uploaded vaccination proof:', petData.vaccinationProofPath);
        } else {
            console.log('No vaccination proof uploaded');
        }

       const response = await fetch(API_BASE + 'check_in.php', {
            method: 'POST',
            body: formData
        });

        // Check if response is actually JSON before parsing
        const responseText = await response.text();
        console.log('Raw response:', responseText); // Debug log

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Response text:', responseText);
            throw new Error('Server returned invalid response. Check console for details.');
        }

        if (result.success) {
            bookingId = result.booking_id;
            
            // Show success message
            document.getElementById('finalTagId').textContent = petData.rfidTag;
            document.getElementById('finalBookingId').textContent = bookingId;
            goToStep('success');
            
            // Show different notification based on email status
            if (result.email_sent && result.tracking_email_sent) {
                showNotification('Check-in completed! Confirmation and tracking emails sent.', 'success');
            } else if (result.email_sent || result.tracking_email_sent) {
                showNotification('Check-in completed! Some email notifications sent.', 'warning');
            } else {
                showNotification('Check-in completed! (Email notifications failed)', 'warning');
            }
            
        } else {
            throw new Error(result.error || 'Failed to create booking');
        }
        
    } catch (error) {
        console.error('Error creating booking:', error);
        showNotification('Error creating booking: ' + error.message, 'error');
        
        // Reset button state on error
        const completeBtn = document.getElementById('completeBtn');
        completeBtn.disabled = false;
        completeBtn.className = 'bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium transition-colors';
        completeBtn.innerHTML = 'Complete Check-in';
        
        // Re-enable back button
        const backBtn = document.querySelector('button[onclick="previousStep()"]');
        if (backBtn) {
            backBtn.disabled = false;
            backBtn.className = 'inline-flex items-center px-8 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all duration-200 border border-gray-300';
        }
        
    } finally {
        // Always reset processing state
        isProcessingBooking = false;
    }
}

function updateBookingSummary() {
    document.getElementById('summaryPetName').textContent = petData.petName;
    document.getElementById('summaryPetDetails').textContent = `${petData.petType} - ${petData.petBreed}${petData.petAge ? ` • ${petData.petAge}` : ''}${currentPetSize ? ` • ${currentPetSize}` : ''}`;
    document.getElementById('summaryOwnerName').textContent = petData.ownerName;
    document.getElementById('summaryOwnerContact').textContent = `${petData.ownerPhone}${petData.ownerEmail ? ` • ${petData.ownerEmail}` : ''}`;

    const servicesContainer = document.getElementById('summaryServices');
    let servicesHtml = '';

    selectedServices.forEach(service => {
        // Check if this is a customized package
        if (service.customizations && service.customizations.selected) {
            const packageName = service.name.replace(' (Customized)', '');
            const includedServices = service.customizations.includedServices || [];

            // Show package header
            servicesHtml += `<div class="font-medium text-gray-900 border-b border-gray-200 pb-1 mb-2">
                ${packageName} (Customized)
            </div>`;

            // Show included services
            includedServices.forEach(serviceName => {
                servicesHtml += `<div class="flex justify-between items-center text-sm ml-4 text-green-700 mb-1">
                    <span>✓ ${serviceName}</span>
                    <span class="text-xs">(included)</span>
                </div>`;
            });

            // Show package price
            servicesHtml += `<div class="flex justify-between items-center text-sm font-medium mt-2 pt-2 border-t border-gray-100">
                <span>${packageName} Total</span>
                <span>₱${service.price.toFixed(2)}</span>
            </div>`;

            servicesHtml += '<div class="mb-3"></div>';
        } else {
            // Regular service
            servicesHtml += `<div class="flex justify-between items-center text-sm">
                <span>${service.name}</span>
                <span>₱${service.price.toFixed(2)}</span>
            </div>`;
        }
    });

    servicesContainer.innerHTML = servicesHtml;
    document.getElementById('summaryTotal').textContent = `₱${totalAmount.toFixed(2)}`;
}

function redirectToPortal() {
    // Store RFID tag for portal tracking
    localStorage.setItem('currentRFID', petData.rfidTag);
    window.location.href = 'customer_portal.html';
}

function startNewBooking() {
    // Force a complete page reload to ensure clean state
    window.location.reload();
}

// Update the existing showNotification function
function showNotification(message, type = 'info') {
    // Remove any existing processing notifications to avoid spam
    if (type === 'info' && message.includes('Processing') || message.includes('Creating booking')) {
        const existingNotifications = document.querySelectorAll('.notification-processing');
        existingNotifications.forEach(notif => notif.remove());
    }
    
    const notification = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300 flex items-center notification-${type}`;
    
    // Add processing class for processing notifications
    if (message.includes('Processing') || message.includes('Creating booking')) {
        notification.classList.add('notification-processing');
    }
    
    notification.innerHTML = `
        <span class="mr-2 text-lg">${icons[type]}</span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Remove after appropriate time (longer for processing messages)
    const duration = message.includes('Processing') || message.includes('Creating booking') ? 8000 : 4000;
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

function openGuestTracker() {
    // Always redirect to the tracking input page
    window.open('guest_pet_tracker.html', '_blank');
}

function generatePDFReceipt() {
    const { jsPDF } = window.jspdf;
    
    // More accurate height calculation
    let estimatedHeight = 35; // Header
    estimatedHeight += 25; // Receipt title, date, separator
    estimatedHeight += 15; // Booking details
    estimatedHeight += 15; // Pet info (base)
    estimatedHeight += (petData.petAge || petData.petSize ? 3 : 0); // Extra pet details
    estimatedHeight += 12; // Owner info
    estimatedHeight += 10; // Services header and separators
    estimatedHeight += selectedServices.length * 3; // Each service
    estimatedHeight += 15; // Subtotal and total sections
    estimatedHeight += (petData.specialNotes && petData.specialNotes.trim() ? 12 : 0); // Special notes
    estimatedHeight += 8; // Footer with minimal spacing
    
    // Minimal padding to reduce excess space
    const finalHeight = Math.max(estimatedHeight - 25);
    
    // ADAPTIVE RECEIPT SIZE - 80mm width, calculated height
    const doc = new jsPDF({
        unit: 'mm',
        format: [80, finalHeight]
    });
    
    let yPos = 5;
    
    // Header - Full width with proper centering
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, 80, 22, 'F'); // Slightly taller header
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('8PAWS PET', 40, 6, { align: 'center' });
    doc.text('BOUTIQUE & GROOMING SALON', 40, 10, { align: 'center' });
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('123 Pet Street, Quezon City', 40, 15, { align: 'center' });
    doc.text('(02) 8123-4567', 40, 19, { align: 'center' });
    
    yPos = 27;
    
    // Receipt title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('BOOKING RECEIPT', 40, yPos, { align: 'center' });
    yPos += 5;
    
    // Date
    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-PH', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    const timeStr = currentDate.toLocaleTimeString('en-PH', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
    });
    
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(`${dateStr} ${timeStr}`, 40, yPos, { align: 'center' });
    yPos += 5;
    
    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.line(5, yPos, 75, yPos);
    yPos += 3;
    
    // Booking Details - Single line
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('BOOKING DETAILS', 5, yPos);
    yPos += 3;
    doc.setFont('helvetica', 'normal');
    doc.text(`ID: #${bookingId || 'N/A'} | RFID: ${petData.rfidTag || 'N/A'}`, 5, yPos);
    yPos += 5;
    
    // Pet Info - Compact
    doc.setFont('helvetica', 'bold');
    doc.text('PET INFO', 5, yPos);
    yPos += 3;
    doc.setFont('helvetica', 'normal');
    doc.text(`${petData.petName || 'N/A'} (${petData.petType || 'N/A'})`, 5, yPos);
    yPos += 3;
    doc.text(`${petData.petBreed || 'N/A'}`, 5, yPos);
    if (petData.petAge || petData.petSize) {
        yPos += 3;
        let details = '';
        if (petData.petAge) details += petData.petAge;
        if (petData.petSize) details += (details ? ', ' : '') + petData.petSize;
        doc.text(details, 5, yPos);
    }
    yPos += 5;
    
    // Owner Info - Compact
    doc.setFont('helvetica', 'bold');
    doc.text('OWNER', 5, yPos);
    yPos += 3;
    doc.setFont('helvetica', 'normal');
    doc.text(petData.ownerName || 'N/A', 5, yPos);
    yPos += 3;
    doc.text(petData.ownerPhone || 'N/A', 5, yPos);
    yPos += 5;
    
    // Separator line
    doc.line(5, yPos, 75, yPos);
    yPos += 3;
    
    // Services Header
    doc.setFont('helvetica', 'bold');
    doc.text('SERVICES', 5, yPos);
    yPos += 4;
    
    // Services List - Very compact
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    if (selectedServices.length > 0) {
        selectedServices.forEach((service, index) => {
            // Service name (truncate if too long)
            let serviceName = service.name;
            if (serviceName.length > 20) {
                serviceName = serviceName.substring(0, 20) + '...';
            }
            doc.text(serviceName, 5, yPos);
            doc.text(`PHP ${service.price.toFixed(2)}`, 75, yPos, { align: 'right' });
            yPos += 3;
        });
    } else {
        doc.text('No services selected', 5, yPos);
        yPos += 3;
    }
    
    yPos += 2;
    
    // Separator line
    doc.line(5, yPos, 75, yPos);
    yPos += 3;
    
    // Subtotal
    doc.setFont('helvetica', 'bold');
    doc.text('SUBTOTAL', 5, yPos);
    doc.text(`PHP ${totalAmount.toFixed(2)}`, 75, yPos, { align: 'right' });
    yPos += 4;
    
    // Total - Highlighted
    doc.setFillColor(102, 126, 234);
    doc.rect(5, yPos - 2, 70, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', 7, yPos + 1);
    doc.text(`PHP ${totalAmount.toFixed(2)}`, 73, yPos + 1, { align: 'right' });
    yPos += 8;
    
    // Special Notes (if any)
    if (petData.specialNotes && petData.specialNotes.trim()) {
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text('NOTES:', 5, yPos);
        yPos += 3;
        doc.setFont('helvetica', 'normal');
        const notes = doc.splitTextToSize(petData.specialNotes, 70);
        doc.text(notes, 5, yPos);
        yPos += notes.length * 3 + 3;
    }
    
    // Minimal space before footer
    yPos += 3;
    
    // Footer - Compact spacing
    doc.setDrawColor(200, 200, 200);
    doc.line(5, yPos, 75, yPos);
    yPos += 5;
    
    // Ensure footer text is black and visible
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Thank you for choosing 8Paws!', 40, yPos, { align: 'center' });
    yPos += 3;
    doc.setFont('helvetica', 'normal');
    doc.text('Your pet is in good hands', 40, yPos, { align: 'center' });
    
    // Save PDF
    const cleanPetName = (petData.petName || 'Pet').replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `8Paws_CompactReceipt_${cleanPetName}_${currentDate.toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
}


// Initialize progress
updateProgress(1);

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

    // Show file information
    const fileNameElement = document.getElementById('fileName');
    const fileSizeElement = document.getElementById('fileSize');

    fileNameElement.textContent = file.name;
    fileSizeElement.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;

    // Show preview for images
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            vaccinationPreview.src = e.target.result;
            vaccinationPreview.classList.remove('hidden');
            uploadArea.classList.add('hidden');
            previewArea.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        // For PDFs and other files, just show file info
        vaccinationPreview.classList.add('hidden');
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
    const vaccinationPreview = document.getElementById('vaccinationPreview');

    vaccinationProofInput.value = '';
    uploadArea.classList.remove('hidden');
    previewArea.classList.add('hidden');

    // Clear stored file data
    petData.vaccinationProof = null;

    // Clear preview
    vaccinationPreview.src = '';
    vaccinationPreview.classList.add('hidden');

    showNotification('Vaccination proof removed.', 'info');
}

// Phone number formatting
document.getElementById('ownerPhone').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 0) {
        if (value.length <= 4) {
            value = value;
        } else if (value.length <= 7) {
            value = value.slice(0, 4) + '-' + value.slice(4);
        } else {
            value = value.slice(0, 4) + '-' + value.slice(4, 7) + '-' + value.slice(7, 11);
        }
    }
    e.target.value = value;
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    stopRFIDPolling();
});