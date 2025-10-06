// Global variables
let vendors = [];
let vendorToDelete = null;
let currentTab = 'active';
let pendingAction = null;

// Mobile menu toggle function
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('hidden');
}

// Logout functions
function logout() {
    document.getElementById('logoutModal').classList.remove('hidden');
}

function closeLogoutModal() {
    document.getElementById('logoutModal').classList.add('hidden');
}

function confirmLogout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_email');
    localStorage.removeItem('auth_staff_role');
    localStorage.removeItem('auth_user_id');

    history.replaceState(null, null, 'admin_staff_auth.html');
    window.location.href = 'admin_staff_auth.html';
}

// Modal functions
function showAddModal() {
    document.getElementById('modalTitle').textContent = 'Add Vendor';
    document.getElementById('vendorForm').reset();
    document.getElementById('vendorId').value = '';
    document.getElementById('vendorModal').classList.remove('hidden');
}

function showEditModal(vendorId) {
    const vendor = vendors.find(v => v.id == vendorId);
    if (!vendor) return;

    document.getElementById('modalTitle').textContent = 'Edit Vendor';
    document.getElementById('vendorId').value = vendor.id;
    document.getElementById('vendorName').value = vendor.name;
    document.getElementById('contactPerson').value = vendor.contact_person || '';
    document.getElementById('email').value = vendor.email || '';
    document.getElementById('phone').value = vendor.phone || '';
    document.getElementById('address').value = vendor.address || '';
    document.getElementById('city').value = vendor.city || '';
    document.getElementById('province').value = vendor.province || '';
    document.getElementById('postalCode').value = vendor.postal_code || '';
    document.getElementById('country').value = vendor.country || 'Philippines';
    document.getElementById('taxId').value = vendor.tax_id || '';
    document.getElementById('notes').value = vendor.notes || '';

    document.getElementById('vendorModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('vendorModal').classList.add('hidden');
}

function showDeleteModal(vendorId) {
    vendorToDelete = vendorId;
    document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    vendorToDelete = null;
}

function confirmDelete() {
    if (vendorToDelete) {
        deleteVendor(vendorToDelete);
    }
    closeDeleteModal();
}

// Confirmation modal functions
function showConfirmation(title, message, action, iconType = 'warning') {
    document.getElementById('confirmationTitle').textContent = title;
    document.getElementById('confirmationMessage').textContent = message;
    document.getElementById('confirmationButton').textContent = title.split(' ')[0]; // Use first word as button text

    const iconContainer = document.getElementById('confirmationIcon');
    let iconHTML = '';

    switch(iconType) {
        case 'warning':
            iconHTML = `<svg class="w-8 h-8 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>`;
            break;
        case 'delete':
            iconHTML = `<svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>`;
            break;
        case 'archive':
            iconHTML = `<svg class="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
            </svg>`;
            break;
        case 'restore':
            iconHTML = `<svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>`;
            break;
    }

    iconContainer.innerHTML = iconHTML;
    pendingAction = action;
    document.getElementById('confirmationModal').classList.remove('hidden');
}

function closeConfirmationModal() {
    document.getElementById('confirmationModal').classList.add('hidden');
    pendingAction = null;
}

function executeConfirmedAction() {
    if (pendingAction) {
        pendingAction();
    }
    closeConfirmationModal();
}

// Tab switching function
function switchTab(tab) {
    currentTab = tab;

    // Update tab buttons
    document.getElementById('activeTab').classList.toggle('active', tab === 'active');
    document.getElementById('archivedTab').classList.toggle('active', tab === 'archived');

    // Reload vendors
    loadVendors();
}

// API functions
async function makeAPIRequest(url, method = 'GET', data = null) {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'admin_staff_auth.html';
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const config = {
        method: method,
        headers: headers
    };

    if (data) {
        config.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, config);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API request failed:', error);
        showNotification('An error occurred. Please try again.', 'error');
        return null;
    }
}

async function loadVendors() {
    const search = document.getElementById('searchInput').value;

    let url = '../api/vendors.php?action=get_vendors';
    if (currentTab === 'archived') {
        url += '&include_archived=true&archived_only=true';
    }

    const result = await makeAPIRequest(url);
    if (result && result.success) {
        vendors = result.data;
        renderVendorsTable();
        updateStats();
    } else {
        showNotification('Failed to load vendors', 'error');
    }
}

function renderVendorsTable() {
    const tbody = document.getElementById('vendorsTableBody');
    const noData = document.getElementById('noDataMessage');

    if (vendors.length === 0) {
        tbody.innerHTML = '';
        noData.classList.remove('hidden');
        return;
    }

    noData.classList.add('hidden');

    // Filter by search
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filteredVendors = vendors.filter(vendor =>
        vendor.name.toLowerCase().includes(searchTerm) ||
        (vendor.contact_person && vendor.contact_person.toLowerCase().includes(searchTerm)) ||
        (vendor.email && vendor.email.toLowerCase().includes(searchTerm)) ||
        (vendor.city && vendor.city.toLowerCase().includes(searchTerm))
    );

    tbody.innerHTML = filteredVendors.map(vendor => {
        const statusClass = vendor.is_active ? 'status-active' : 'status-inactive';
        const statusText = vendor.is_active ? 'Active' : 'Archived';

        // For stock_controller, hide all action buttons
        const actionsHtml = '';

        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-4 px-6">
                    <div>
                        <div class="font-medium text-gray-900 text-sm">${vendor.name}</div>
                        ${vendor.contact_person ? `<div class="text-xs text-gray-500">${vendor.contact_person}</div>` : ''}
                    </div>
                </td>
                <td class="py-4 px-6">
                    <div>
                        ${vendor.email ? `<div class="text-sm text-gray-900">${vendor.email}</div>` : ''}
                        ${vendor.phone ? `<div class="text-xs text-gray-500">${vendor.phone}</div>` : ''}
                    </div>
                </td>
                <td class="py-4 px-6">
                    <div>
                        ${vendor.city && vendor.province ? `<div class="text-sm text-gray-900">${vendor.city}, ${vendor.province}</div>` : ''}
                        ${vendor.country ? `<div class="text-xs text-gray-500">${vendor.country}</div>` : ''}
                    </div>
                </td>
                <td class="py-4 px-6">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="py-4 px-6 text-center">
                    ${actionsHtml}
                </td>
            </tr>
        `;
    }).join('');
}

async function updateStats() {
    const total = vendors.length;
    const active = vendors.filter(v => v.is_active).length;
    const archived = total - active;

    document.getElementById('totalVendors').textContent = total;
    document.getElementById('activeVendors').textContent = active;
    document.getElementById('archivedVendors').textContent = archived;
}

// Form submission
document.getElementById('vendorForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    const isEdit = data.id ? true : false;
    const action = isEdit ? 'update_vendor' : 'add_vendor';
    const actionName = isEdit ? 'Update' : 'Create';

    // Show confirmation
    showConfirmation(
        `${actionName} Vendor`,
        `Are you sure you want to ${actionName.toLowerCase()} this vendor?`,
        async () => {
            const result = await makeAPIRequest('../api/vendors.php', 'POST', { action, ...data });

            if (result && result.success) {
                showNotification(`Vendor ${isEdit ? 'updated' : 'added'} successfully`, 'success');
                closeModal();
                loadVendors();
            } else {
                showNotification(result?.error || 'Failed to save vendor', 'error');
            }
        }
    );
});

// Archive/Restore/Delete functions
async function archiveVendor(vendorId) {
    showConfirmation(
        'Archive Vendor',
        'Are you sure you want to archive this vendor? They will be moved to the archived tab.',
        async () => {
            const result = await makeAPIRequest('../api/vendors.php', 'POST', {
                action: 'archive_vendor',
                id: vendorId
            });

            if (result && result.success) {
                showNotification('Vendor archived successfully', 'success');
                loadVendors();
            } else {
                showNotification(result?.error || 'Failed to archive vendor', 'error');
            }
        },
        'archive'
    );
}

async function restoreVendor(vendorId) {
    showConfirmation(
        'Restore Vendor',
        'Are you sure you want to restore this vendor? They will be moved back to active status.',
        async () => {
            const result = await makeAPIRequest('../api/vendors.php', 'POST', {
                action: 'restore_vendor',
                id: vendorId
            });

            if (result && result.success) {
                showNotification('Vendor restored successfully', 'success');
                loadVendors();
            } else {
                showNotification(result?.error || 'Failed to restore vendor', 'error');
            }
        },
        'restore'
    );
}

async function deleteVendor(vendorId) {
    showConfirmation(
        'Delete Vendor',
        'Are you sure you want to permanently delete this vendor? This action cannot be undone.',
        async () => {
            const result = await makeAPIRequest('../api/vendors.php', 'POST', {
                action: 'delete_vendor',
                id: vendorId
            });

            if (result && result.success) {
                showNotification('Vendor deleted successfully', 'success');
                loadVendors();
            } else {
                showNotification(result?.error || 'Failed to delete vendor', 'error');
            }
        },
        'delete'
    );
}

// Notification system
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-[10002] p-4 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;

    if (type === 'success') {
        notification.classList.add('bg-green-500', 'text-white');
    } else if (type === 'error') {
        notification.classList.add('bg-red-500', 'text-white');
    } else {
        notification.classList.add('bg-blue-500', 'text-white');
    }

    notification.innerHTML = `
        <div class="flex items-center">
            <div class="flex-1">${message}</div>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);

    // Auto remove
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Authentication check
function checkAuthentication() {
    const token = localStorage.getItem('auth_token');
    const role = localStorage.getItem('auth_role');

    if (!token || !role) {
        window.location.href = 'admin_staff_auth.html';
        return false;
    }

    if (!['admin', 'staff', 'manager', 'cashier', 'stock_controller'].includes(role)) {
        localStorage.clear();
        window.location.href = 'admin_staff_auth.html';
        return false;
    }

    return true;
}

// Validation functions
function validateVendorName() {
    const input = document.getElementById('vendorName');
    const value = input.value;
    const regex = /^[A-Za-z\s]+$/;

    if (!regex.test(value) && value !== '') {
        input.setCustomValidity('Vendor name can only contain alphabets and spaces');
        input.classList.add('border-red-500');
        input.classList.remove('border-gray-300');
    } else {
        input.setCustomValidity('');
        input.classList.remove('border-red-500');
        input.classList.add('border-gray-300');
    }
}

function validateContactPerson() {
    const input = document.getElementById('contactPerson');
    const value = input.value;
    const regex = /^[A-Za-z\s]+$/;

    if (!regex.test(value) && value !== '') {
        input.setCustomValidity('Contact person can only contain alphabets and spaces');
        input.classList.add('border-red-500');
        input.classList.remove('border-gray-300');
    } else {
        input.setCustomValidity('');
        input.classList.remove('border-red-500');
        input.classList.add('border-gray-300');
    }
}

function validateEmail() {
    const input = document.getElementById('email');
    const value = input.value;
    const regex = /^[^\s@]+@[^\s@]+\.com$/;

    if (!regex.test(value) && value !== '') {
        input.setCustomValidity('Email must contain @ and end with .com');
        input.classList.add('border-red-500');
        input.classList.remove('border-gray-300');
    } else {
        input.setCustomValidity('');
        input.classList.remove('border-red-500');
        input.classList.add('border-gray-300');
    }
}

function validatePhone() {
    const input = document.getElementById('phone');
    const value = input.value;

    if (value.length > 0 && (value.length !== 11 || !value.startsWith('09') || !/^\d+$/.test(value))) {
        input.setCustomValidity('Phone must be 11 digits and start with 09');
        input.classList.add('border-red-500');
        input.classList.remove('border-gray-300');
    } else {
        input.setCustomValidity('');
        input.classList.remove('border-red-500');
        input.classList.add('border-gray-300');
    }
}

function validateAddress() {
    const input = document.getElementById('address');
    const value = input.value;
    // Address can contain letters, numbers, spaces, and common punctuation
    const regex = /^[A-Za-z0-9\s,.\-#]+$/;

    if (!regex.test(value) && value !== '') {
        input.setCustomValidity('Address contains invalid characters');
        input.classList.add('border-red-500');
        input.classList.remove('border-gray-300');
    } else {
        input.setCustomValidity('');
        input.classList.remove('border-red-500');
        input.classList.add('border-gray-300');
    }
}

function validatePostalCode() {
    const input = document.getElementById('postalCode');
    const value = input.value;

    if (value.length > 0 && (!/^\d+$/.test(value) || value.length !== 4)) {
        input.setCustomValidity('Postal code must be 4 digits only');
        input.classList.add('border-red-500');
        input.classList.remove('border-gray-300');
    } else {
        input.setCustomValidity('');
        input.classList.remove('border-red-500');
        input.classList.add('border-gray-300');
    }
}

function validateTaxId() {
    const input = document.getElementById('taxId');
    const value = input.value.trim();

    if (value === '') {
        input.setCustomValidity('Tax ID is required');
        input.classList.add('border-red-500');
        input.classList.remove('border-gray-300');
    } else {
        input.setCustomValidity('');
        input.classList.remove('border-red-500');
        input.classList.add('border-gray-300');
    }
}

// Load location data
async function loadCities() {
    try {
        const response = await fetch('../api/locations.php?action=get_cities');
        const result = await response.json();

        if (result.success) {
            const citySelect = document.getElementById('city');
            citySelect.innerHTML = '<option value="">Select City</option>';

            result.data.forEach(city => {
                const option = document.createElement('option');
                option.value = city;
                option.textContent = city;
                citySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load cities:', error);
    }
}

async function loadProvinces() {
    try {
        const response = await fetch('../api/locations.php?action=get_provinces');
        const result = await response.json();

        if (result.success) {
            const provinceSelect = document.getElementById('province');
            provinceSelect.innerHTML = '<option value="">Select Province</option>';

            result.data.forEach(province => {
                const option = document.createElement('option');
                option.value = province;
                option.textContent = province;
                provinceSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load provinces:', error);
    }
}

async function loadCountries() {
    try {
        const response = await fetch('../api/locations.php?action=get_countries');
        const result = await response.json();

        if (result.success) {
            const countrySelect = document.getElementById('country');
            countrySelect.innerHTML = '<option value="">Select Country</option>';

            result.data.forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                if (country === 'Philippines') {
                    option.selected = true;
                }
                countrySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load countries:', error);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuthentication()) {
        return;
    }

    // Load location data
    loadCities();
    loadProvinces();
    loadCountries();

    // Load initial data
    loadVendors();

    // Set up search on enter
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            renderVendorsTable();
        }
    });
});

// Make functions globally accessible
window.toggleMobileMenu = toggleMobileMenu;
window.logout = logout;
window.closeLogoutModal = closeLogoutModal;
window.confirmLogout = confirmLogout;
window.showAddModal = showAddModal;
window.showEditModal = showEditModal;
window.closeModal = closeModal;
window.showDeleteModal = showDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.archiveVendor = archiveVendor;
window.restoreVendor = restoreVendor;
window.switchTab = switchTab;
window.showConfirmation = showConfirmation;
window.closeConfirmationModal = closeConfirmationModal;
window.executeConfirmedAction = executeConfirmedAction;