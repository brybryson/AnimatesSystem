// Global variables
let inventoryData = [];
let categories = [];
let itemToDelete = null;

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
    document.getElementById('modalTitle').textContent = 'Add Inventory Item';
    document.getElementById('inventoryForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('inventoryModal').classList.remove('hidden');
}

function showEditModal(itemId) {
    const item = inventoryData.find(i => i.id == itemId);
    if (!item) return;

    document.getElementById('modalTitle').textContent = 'Edit Inventory Item';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemCategory').value = item.category || '';
    document.getElementById('itemQuantity').value = item.quantity;
    document.getElementById('itemUnitPrice').value = item.unit_price;
    document.getElementById('itemVendor').value = item.vendor || '';
    document.getElementById('itemMinStock').value = item.min_stock_level || '';
    document.getElementById('itemCriticalStock').value = item.critical_stock_level || '';
    document.getElementById('itemDescription').value = item.description || '';

    document.getElementById('inventoryModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('inventoryModal').classList.add('hidden');
}

function showDeleteModal(itemId) {
    itemToDelete = itemId;
    document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    itemToDelete = null;
}

function confirmDelete() {
    if (itemToDelete) {
        deleteInventoryItem(itemToDelete);
    }
    closeDeleteModal();
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

        if (!response.ok) {
            if (response.status === 401) {
                // Token is invalid, clear storage and redirect to login
                localStorage.clear();
                window.location.href = 'admin_staff_auth.html';
                return null;
            }
            // For other errors, show notification
            showNotification(result?.error || 'An error occurred', 'error');
            return null;
        }

        return result;
    } catch (error) {
        console.error('API request failed:', error);
        showNotification('An error occurred. Please try again.', 'error');
        return null;
    }
}

async function loadInventory() {
    const search = document.getElementById('searchInput').value;
    const category = document.getElementById('categoryFilter').value;

    let url = '../api/inventory.php?action=get_inventory';
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;

    const result = await makeAPIRequest(url);
    if (result && result.success) {
        inventoryData = result.data;
        renderInventoryTable();
        updateStats();
    } else {
        showNotification('Failed to load inventory', 'error');
    }
}

async function loadCategories() {
    const result = await makeAPIRequest('../api/inventory.php?action=get_categories');
    if (result && result.success) {
        categories = result.data;
        renderCategoryFilter();
    }
}

async function loadVendors() {
    const result = await makeAPIRequest('../api/inventory.php?action=get_vendors');
    if (result && result.success) {
        vendors = result.data;
        renderVendorFilter();
    }
}

let vendors = []; // Add this global variable

async function loadLowStock() {
    const result = await makeAPIRequest('../api/inventory.php?action=get_low_stock');
    if (result && result.success) {
        return result.data.length;
    }
    return 0;
}

function renderCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    select.innerHTML = '<option value="">All Categories</option>';

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
}

function renderVendorFilter() {
    const select = document.getElementById('vendorFilter');
    if (select) {
        select.innerHTML = '<option value="">All Vendors</option>';

        vendors.forEach(vendor => {
            const option = document.createElement('option');
            option.value = vendor;
            option.textContent = vendor;
            select.appendChild(option);
        });
    }
}

function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    const loading = document.getElementById('loadingIndicator');
    const noData = document.getElementById('noDataMessage');

    loading.classList.add('hidden');

    if (inventoryData.length === 0) {
        tbody.innerHTML = '';
        noData.classList.remove('hidden');
        return;
    }

    noData.classList.add('hidden');

    tbody.innerHTML = inventoryData.map(item => {
        const isLowStock = item.quantity <= item.min_stock_level;
        const isCriticalStock = item.quantity <= item.critical_stock_level;
        const statusClass = isCriticalStock ? 'bg-red-100 text-red-700 border-red-200' : (isLowStock ? 'status-low' : 'status-normal');
        const statusText = isCriticalStock ? 'Critical' : (isLowStock ? 'Low Stock' : 'In Stock');

        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-2 px-3">
                    <div>
                        <div class="font-medium text-gray-900 text-sm">${item.name}</div>
                        ${item.description ? `<div class="text-xs text-gray-500 max-w-48 overflow-hidden" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.2; max-height: 2.4em;">${item.description}</div>` : ''}
                    </div>
                </td>
                <td class="py-1 px-3 text-gray-700 text-sm leading-tight">${item.category || '-'}</td>
                <td class="py-1 px-3 text-center leading-tight">
                    <span class="font-semibold ${isCriticalStock ? 'text-red-600' : (isLowStock ? 'text-orange-600' : 'text-gray-900')} text-sm">${item.quantity}</span>
                </td>
                <td class="py-1 px-3 text-center text-xs text-gray-600 leading-tight">
                    ${item.min_stock_level}/${item.critical_stock_level}
                </td>
                <td class="py-1 px-3 text-right text-gray-900 text-sm leading-tight">₱${parseFloat(item.unit_price).toFixed(2)}</td>
                <td class="py-1 px-3 text-gray-700 text-sm leading-tight">${item.vendor || '-'}</td>
                <td class="py-2 px-3 text-center">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusClass} border">
                        ${statusText}
                    </span>
                </td>
                <td class="py-1 px-3 text-center leading-tight">
                    <div class="flex items-center justify-center space-x-1">
                        <button onclick="showEditModal(${item.id})" class="text-gold-600 hover:text-gold-700 p-1" title="Edit">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button onclick="showDeleteModal(${item.id})" class="text-red-600 hover:text-red-700 p-1" title="Delete">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function updateStats() {
    document.getElementById('totalItems').textContent = inventoryData.length;

    const lowStockCount = await loadLowStock();
    document.getElementById('lowStock').textContent = lowStockCount;

    const totalValue = inventoryData.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    document.getElementById('totalValue').textContent = '₱' + totalValue.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    document.getElementById('categories').textContent = categories.length;
}

// Form submission
document.getElementById('inventoryForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // Convert numeric fields
    data.quantity = parseInt(data.quantity) || 0;
    data.unit_price = parseFloat(data.unit_price) || 0;
    data.min_stock_level = parseInt(data.min_stock_level) || 0;

    const isEdit = data.id ? true : false;
    const action = isEdit ? 'update_inventory' : 'add_inventory';

    const result = await makeAPIRequest('../api/inventory.php', 'POST', { action, ...data });

    if (result && result.success) {
        showNotification(`Inventory item ${isEdit ? 'updated' : 'added'} successfully`, 'success');
        closeModal();
        loadInventory();
    } else {
        showNotification(result?.error || 'Failed to save item', 'error');
    }
});

// Delete item
async function deleteInventoryItem(itemId) {
    const result = await makeAPIRequest('../api/inventory.php', 'POST', {
        action: 'delete_inventory',
        id: itemId
    });

    if (result && result.success) {
        showNotification('Inventory item deleted successfully', 'success');
        loadInventory();
    } else {
        showNotification(result?.error || 'Failed to delete item', 'error');
    }
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuthentication()) {
        return;
    }

    // Load initial data
    loadCategories();
    loadVendors();
    loadInventory();

    // Set up search on enter
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadInventory();
        }
    });

    // Set up category filter change
    document.getElementById('categoryFilter').addEventListener('change', loadInventory);
});

// Export inventory to XLSX
async function exportInventory() {
    try {
        const response = await fetch('../api/inventory.php?action=export_inventory', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Export failed');
        }

        // Get the blob
        const blob = await response.blob();

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `inventory_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        window.URL.revokeObjectURL(url);

        showNotification('Inventory export completed successfully.', 'success');
    } catch (error) {
        console.error('Export failed:', error);
        showNotification('Failed to export inventory: ' + error.message, 'error');
    }
}

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
window.exportInventory = exportInventory;