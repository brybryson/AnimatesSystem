// API base URL
const API_BASE = '/animates/api/';

// Sample data for RFID tags and pets (will be replaced with API calls)
let petData = {
    'A1B2C3D4': {
        petName: 'Buddy',
        breed: 'Golden Retriever',
        owner: 'John Cruz',
        phone: '+63 912 345 6789',
        checkinTime: '9:00 AM',
        bathTime: '9:30 AM',
        groomingTime: '10:30 AM',
        staff: 'Maria Santos',
        services: [
            { name: 'Basic Bath', basePrice: 300, modifier: 'Large (+50%)', amount: 450 },
            { name: 'Full Grooming', basePrice: 500, modifier: 'Large (+50%)', amount: 750 },
            { name: 'Nail Trimming', basePrice: 100, modifier: 'Standard', amount: 100 }
        ]
    },
    'B2C3D4E5': {
        petName: 'Whiskers',
        breed: 'Persian Cat',
        owner: 'Ana Lopez',
        phone: '+63 917 234 5678',
        checkinTime: '10:00 AM',
        bathTime: '10:15 AM',
        groomingTime: '10:45 AM',
        staff: 'James Rodriguez',
        services: [
            { name: 'Basic Bath', basePrice: 300, modifier: 'Small (-20%)', amount: 240 },
            { name: 'Ear Cleaning', basePrice: 150, modifier: 'Standard', amount: 150 },
            { name: 'Nail Polish', basePrice: 200, modifier: 'Standard', amount: 200 }
        ]
    },
    'D4E5F6G7': {
        petName: 'Luna',
        breed: 'Shih Tzu',
        owner: 'Maria Santos',
        phone: '+63 905 123 4567',
        checkinTime: '11:00 AM',
        bathTime: '11:20 AM',
        groomingTime: '12:00 PM',
        staff: 'Sarah Johnson',
        services: [
            { name: 'Premium Grooming', basePrice: 600, modifier: 'Medium (+20%)', amount: 720 },
            { name: 'De-shedding Treatment', basePrice: 250, modifier: 'Standard', amount: 250 }
        ]
    }
};

// Current user data
let currentUser = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuth();
    await loadStats();
    await loadPendingBills();
    // Only load the payment processing widget if its container exists on this page
    if (document.getElementById('paymentProcessingContainer')) {
        await loadPaymentProcessing();
    }
    
    // Initialize with manual billing section
    showSection('manual-billing');
    
    // Set up payment method change handler
    document.getElementById('paymentMethod').addEventListener('change', handlePaymentMethodChange);
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        try {
            localStorage.clear();
        } catch (_) {}
        window.location.replace('admin_staff_auth.html');
    });

    // Make stat cards clickable
    document.getElementById('pendingBillsCard')?.addEventListener('click', () => {
        showSection('pending-bills');
    });
    document.getElementById('voidsCard')?.addEventListener('click', () => {
        showSection('voided-transactions');
    });
    document.getElementById('todayRevenueCard')?.addEventListener('click', () => {
        showSection('recent-transactions');
        // Optionally set date filter to today
        setTimeout(() => {
            const el = document.getElementById('dateFilter');
            if (el) { el.value = 'today'; el.dispatchEvent(new Event('change')); }
        }, 100);
    });
    document.getElementById('weekRevenueCard')?.addEventListener('click', () => {
        showSection('recent-transactions');
        setTimeout(() => {
            const el = document.getElementById('dateFilter');
            if (el) { el.value = 'week'; el.dispatchEvent(new Event('change')); }
        }, 100);
    });
});

// Authentication check
async function checkAuth() {
    const token = localStorage.getItem('auth_token');
    const role = localStorage.getItem('auth_role');
    const staffRole = localStorage.getItem('auth_staff_role');
    
    if (!token || !role) {
        redirectToAuth();
        return false;
    }
    
    // Check if user has access to billing (admin or cashier). Support both top-level role and legacy staff_role.
    const isAdmin = role === 'admin';
    const isCashier = role === 'cashier' || staffRole === 'cashier';
    if (!isAdmin && !isCashier) {
        alert('Access denied. Only admin and cashier can access billing management.');
        redirectToAuth();
        return false;
    }

    // Set current user from localStorage
    currentUser = {
        id: localStorage.getItem('auth_user_id') || 'unknown',
        email: localStorage.getItem('auth_email') || '',
        username: localStorage.getItem('auth_username') || '',
        full_name: localStorage.getItem('auth_full_name') || '',
        role: role,
        staff_role: staffRole
    };
    
    updateUserInfo();
    return true;
}

// Update user information display
function updateUserInfo() {
    if (currentUser) {
        const preferredName = (currentUser.full_name && currentUser.full_name.trim())
            ? currentUser.full_name.trim()
            : ((currentUser.username && currentUser.username.trim())
                ? currentUser.username.trim()
                : (currentUser.email ? currentUser.email.split('@')[0] : 'User'));
        const userInitial = preferredName.charAt(0).toUpperCase();

        const nameEl = document.getElementById('userName');
        const roleEl = document.getElementById('userRole');
        const initEl = document.getElementById('userInitials');
        if (nameEl) nameEl.textContent = preferredName;
        const roleLabel = currentUser.role === 'admin' ? 'Admin' : (currentUser.role === 'cashier' || currentUser.staff_role === 'cashier' ? 'Cashier' : 'Staff');
        if (roleEl) roleEl.textContent = roleLabel;
        if (initEl) initEl.textContent = userInitial;
    }
}

// Redirect to auth page
function redirectToAuth() {
    localStorage.clear();
    window.location.replace('admin_staff_auth.html');
}

// Load statistics
async function loadStats() {
    try {
        // Fetch pending bills and transactions in parallel
        const [pendingRes, txRes] = await Promise.all([
            fetch(`${API_BASE}billing.php?action=get_pending_bills`),
            fetch(`${API_BASE}billing.php?action=get_transactions`)
        ]);
        const [pendingData, txData] = await Promise.all([
            pendingRes.json(),
            txRes.json()
        ]);

        // Pending/voided counts
        const bills = Array.isArray(pendingData?.pending_bills) ? pendingData.pending_bills : [];
        const pendingCount = bills.filter(b => (b.payment_status || 'pending') !== 'paid').length;
        
        // Revenue: sum completed transactions amounts for today and last 7 days
        const txs = Array.isArray(txData?.transactions) ? txData.transactions : [];
        
        // Count voided transactions
        const voidedCount = txs.filter(t => (t.status || '').toLowerCase() === 'voided').length;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const sum = (arr) => arr.reduce((acc, n) => acc + (parseFloat(n) || 0), 0);

        const completedTxs = txs.filter(t => (t.status || '').toLowerCase() === 'completed');
        const todayAmounts = completedTxs
            .filter(t => {
                const d = new Date(t.created_at);
                return d >= startOfToday;
            })
            .map(t => t.amount);
        const weekAmounts = completedTxs
            .filter(t => {
                const d = new Date(t.created_at);
                return d >= sevenDaysAgo;
            })
            .map(t => t.amount);

        const todayRevenue = sum(todayAmounts);
        const weekRevenue = sum(weekAmounts);

        // Update stats with error handling
        const todayRevenueEl = document.getElementById('todayRevenue');
        const weekRevenueEl = document.getElementById('weekRevenue');
        const pendingBillsEl = document.getElementById('pendingBills');
        const voidCountEl = document.getElementById('voidCount');
        
        if (todayRevenueEl) todayRevenueEl.textContent = '₱' + todayRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 });
        if (weekRevenueEl) weekRevenueEl.textContent = '₱' + weekRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 });
        if (pendingBillsEl) pendingBillsEl.textContent = pendingCount;
        if (voidCountEl) voidCountEl.textContent = voidedCount;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load pending bills
async function loadPendingBills() {
    try {
        const container = document.getElementById('pendingBillsContainer');
        
        // Show loading state
        container.innerHTML = '<div class="text-center py-8 text-gray-500">Loading pending bills...</div>';
        
        // Fetch real data from API
        const response = await fetch(`${API_BASE}billing.php?action=get_pending_bills`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
                    if (data.pending_bills && Array.isArray(data.pending_bills)) {
            if (data.pending_bills.length === 0) {
                container.innerHTML = '<div class="text-center py-8 text-gray-500">No pending bills found</div>';
                return;
            }
            
            // Calculate summary statistics
            const totalAmount = data.pending_bills.reduce((sum, bill) => sum + parseFloat(bill.total_amount), 0);
            const statusCounts = data.pending_bills.reduce((counts, bill) => {
                counts[bill.status] = (counts[bill.status] || 0) + 1;
                return counts;
            }, {});
            
            // Create summary header with search and filters
            const summaryHTML = `
                <div class="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold text-gray-900">Pending Bills Summary</h3>
                        <span class="text-sm text-gray-500">Total: ${data.pending_bills.length} bills</span>
                        </div>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-blue-600">₱${totalAmount.toFixed(2)}</div>
                            <div class="text-sm text-gray-500">Total Value</div>
                            </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-green-600">${statusCounts.completed || 0}</div>
                            <div class="text-sm text-gray-500">Completed</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-yellow-600">${statusCounts.in_progress || 0}</div>
                            <div class="text-sm text-gray-500">In Progress</div>
                    </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-blue-600">${statusCounts.checked_in || 0}</div>
                            <div class="text-sm text-gray-500">Checked In</div>
                        </div>
                    </div>
                    
                    <!-- Search and Filter Controls -->
                    <div class="border-t border-gray-200 pt-4">
                        <div class="flex flex-col md:flex-row gap-4 items-start md:items-center">
                            <!-- Search Box -->
                            <div class="flex-1 min-w-0">
                                <div class="relative">
                                    <input type="text" 
                                           id="pendingBillsSearch" 
                                           placeholder="Search by pet name, RFID, customer name..." 
                                           class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent text-sm">
                                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                        </svg>
                </div>
            </div>
                            </div>
                            
                            <!-- Status Filter -->
                            <div class="flex-shrink-0">
                                <select id="pendingBillsStatusFilter" class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent text-sm">
                                    <option value="">All Statuses</option>
                                    <option value="completed">Completed</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="checked_in">Checked In</option>
                                    <option value="ready_for_pickup">Ready for Pickup</option>
                                </select>
                            </div>
                            
                            <!-- Pet Type Filter -->
                            <div class="flex-shrink-0">
                                <select id="pendingBillsPetTypeFilter" class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent text-sm">
                                    <option value="">All Pet Types</option>
                                    <option value="dog">Dogs</option>
                                    <option value="cat">Cats</option>
                                </select>
                            </div>
                            
                            <!-- Sort Options -->
                            <div class="flex-shrink-0">
                                <select id="pendingBillsSort" class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent text-sm">
                                    <option value="check_in_time_asc">Check-in Time (Oldest First)</option>
                                    <option value="check_in_time_desc">Check-in Time (Newest First)</option>
                                    <option value="total_amount_desc">Amount (Highest First)</option>
                                    <option value="total_amount_asc">Amount (Lowest First)</option>
                                    <option value="pet_name_asc">Pet Name (A-Z)</option>
                                    <option value="customer_name_asc">Customer Name (A-Z)</option>
                                </select>
                            </div>
                            
                            <!-- Clear Filters Button -->
                            <div class="flex-shrink-0">
                                <button onclick="clearPendingBillsFilters()" 
                                        class="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-colors">
                                    <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                    Clear Filters
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Store the data globally for filtering and sorting
            currentPendingBills = data.pending_bills;
            currentPendingBillsPage = 1;
            
            // Apply filters and display
            applyPendingBillsFilters();
            
            // Combine summary and bills
            container.innerHTML = summaryHTML + displayPendingBills();
            
            // Add event listeners for search and filters
            addPendingBillsEventListeners();
                
            } else {
                throw new Error('Invalid pending bills data received from server');
            }
        } else {
            const errorMessage = data.message || 'Unknown error occurred';
            container.innerHTML = `<div class="text-center py-8 text-red-500">Error loading pending bills: ${errorMessage}</div>`;
            console.error('API Error:', data);
        }
        
    } catch (error) {
        console.error('Error loading pending bills:', error);
        const errorMessage = error.message || 'Network or parsing error';
        const container = document.getElementById('pendingBillsContainer');
        container.innerHTML = `<div class="text-center py-8 text-red-500">Failed to load pending bills: ${errorMessage}</div>`;
    }
}

// Load payment processing data
async function loadPaymentProcessing() {
    try {
        const container = document.getElementById('paymentProcessingContainer');
        const dailySummary = document.getElementById('dailySummary');
        const paymentMethodsChart = document.getElementById('paymentMethodsChart');
        
        // Sample payment processing data
        const payments = [
            {
                status: 'Payment Successful',
                time: '2 minutes ago',
                pet: 'Luna (Persian Cat)',
                owner: 'Maria Santos',
                method: 'GCash',
                receipt: '#GC20250810001',
                amount: 600,
                type: 'success'
            },
            {
                status: 'Processing Payment',
                time: 'Processing...',
                pet: 'Buddy (Golden Retriever)',
                owner: 'John Cruz',
                method: 'Credit Card',
                card: '**** **** **** 1234',
                amount: 1150,
                type: 'processing'
            }
        ];
        
        container.innerHTML = payments.map(payment => `
            <div class="border border-${getPaymentColor(payment.type).border} bg-${getPaymentColor(payment.type).bg} rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="font-semibold text-${getPaymentColor(payment.type).text} text-sm">${payment.status}</h3>
                    <span class="text-xs text-${getPaymentColor(payment.type).timeText}">${payment.time}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <p class="text-xs text-${getPaymentColor(payment.type).content}"><strong>Pet:</strong> ${payment.pet}</p>
                        <p class="text-xs text-${getPaymentColor(payment.type).content}"><strong>Owner:</strong> ${payment.owner}</p>
                    </div>
                    <div>
                        <p class="text-xs text-${getPaymentColor(payment.type).content}"><strong>Method:</strong> ${payment.method}</p>
                        <p class="text-xs text-${getPaymentColor(payment.type).content}">
                            <strong>${payment.receipt ? 'Receipt:' : 'Card:'}</strong> ${payment.receipt || payment.card}
                        </p>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-bold text-${getPaymentColor(payment.type).amount}">₱${payment.amount.toLocaleString()}</p>
                        ${payment.type === 'processing' ? 
                            `<button class="mt-1 text-${getPaymentColor(payment.type).button} hover:text-${getPaymentColor(payment.type).buttonHover} text-xs underline">Cancel</button>` :
                            `<button class="mt-1 text-${getPaymentColor(payment.type).button} hover:text-${getPaymentColor(payment.type).buttonHover} text-xs underline">View Receipt</button>`
                        }
                    </div>
                </div>
            </div>
        `).join('');
        
        // Daily summary
        dailySummary.innerHTML = `
            <div class="flex justify-between text-xs">
                <span class="text-gray-600">Cash Payments:</span>
                <span class="font-medium">₱3,200</span>
            </div>
            <div class="flex justify-between text-xs">
                <span class="text-gray-600">Card Payments:</span>
                <span class="font-medium">₱2,800</span>
            </div>
            <div class="flex justify-between text-xs">
                <span class="text-gray-600">Online Payments:</span>
                <span class="font-medium">₱2,450</span>
            </div>
            <hr class="my-2 border-gray-300">
            <div class="flex justify-between text-sm font-bold">
                <span>Total:</span>
                <span class="text-gold-600">₱8,450</span>
            </div>
        `;
        
        // Payment methods chart
        paymentMethodsChart.innerHTML = `
            <div class="flex items-center justify-between text-xs">
                <div class="flex items-center space-x-2">
                    <div class="w-3 h-3 bg-green-500 rounded"></div>
                    <span class="text-gray-600">Cash</span>
                </div>
                <span class="font-medium">38%</span>
            </div>
            <div class="flex items-center justify-between text-xs">
                <div class="flex items-center space-x-2">
                    <div class="w-3 h-3 bg-blue-500 rounded"></div>
                    <span class="text-gray-600">Cards</span>
                </div>
                <span class="font-medium">33%</span>
            </div>
            <div class="flex items-center justify-between text-xs">
                <div class="flex items-center space-x-2">
                    <div class="w-3 h-3 bg-purple-500 rounded"></div>
                    <span class="text-gray-600">Online</span>
                </div>
                <span class="font-medium">29%</span>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading payment processing:', error);
    }
}

// Get status colors for pending bills
function getStatusColor(status) {
    switch (status) {
        case 'completed':
            return { border: 'green-200', bg: 'green-50', icon: 'green-100', text: 'green-600', badge: 'green-100', badgeText: 'green-800' };
        case 'in_progress':
            return { border: 'yellow-200', bg: 'yellow-50', icon: 'yellow-100', text: 'yellow-600', badge: 'yellow-100', badgeText: 'yellow-800' };
        case 'checked_in':
            return { border: 'blue-200', bg: 'blue-50', icon: 'blue-100', text: 'blue-600', badge: 'blue-100', badgeText: 'blue-800' };
        case 'ready_for_pickup':
            return { border: 'orange-200', bg: 'orange-50', icon: 'orange-100', text: 'orange-600', badge: 'orange-100', badgeText: 'orange-800' };
        default:
            return { border: 'gray-200', bg: 'gray-50', icon: 'gray-100', text: 'gray-600', badge: 'gray-100', badgeText: 'gray-800' };
    }
}

// Format status for display
function formatStatus(status) {
    switch (status) {
        case 'completed':
            return 'Completed';
        case 'in_progress':
            return 'In Progress';
        case 'checked_in':
            return 'Checked In';
        case 'ready_for_pickup':
            return 'Ready for Pickup';
        default:
            return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
}

// Get time information for display
function getTimeInfo(bill) {
    try {
        const checkinTime = new Date(bill.check_in_time);
        const estimatedTime = bill.estimated_completion ? new Date(bill.estimated_completion) : null;
        const actualTime = bill.actual_completion ? new Date(bill.actual_completion) : null;
        
        // Validate dates
        if (isNaN(checkinTime.getTime())) {
            return 'Check-in time unavailable';
        }
        
        const formatTime = (date) => date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const formatDate = (date) => date.toLocaleDateString();
        
        if (bill.status === 'completed' && actualTime && !isNaN(actualTime.getTime())) {
            const duration = Math.round((actualTime - checkinTime) / (1000 * 60));
            const hours = Math.floor(duration / 60);
            const minutes = duration % 60;
            return `Completed: ${formatTime(actualTime)} • Duration: ${hours}h ${minutes}m`;
        } else if (bill.status === 'in_progress' && estimatedTime && !isNaN(estimatedTime.getTime())) {
            return `Started: ${formatTime(checkinTime)} • Est. completion: ${formatTime(estimatedTime)}`;
        } else if (bill.status === 'checked_in') {
            return `Check-in: ${formatTime(checkinTime)} • Est. completion: ${estimatedTime && !isNaN(estimatedTime.getTime()) ? formatTime(estimatedTime) : 'TBD'}`;
        } else {
            return `Check-in: ${formatTime(checkinTime)}`;
        }
    } catch (error) {
        console.error('Error formatting time info:', error);
        return 'Time information unavailable';
    }
}

// Get payment colors
function getPaymentColor(type) {
    switch (type) {
        case 'success':
            return { border: 'green-200', bg: 'green-50', text: 'green-800', timeText: 'green-600', content: 'green-700', amount: 'green-800', button: 'green-600', buttonHover: 'green-700' };
        case 'processing':
            return { border: 'blue-200', bg: 'blue-50', text: 'blue-800', timeText: 'blue-600', content: 'blue-700', amount: 'blue-800', button: 'blue-600', buttonHover: 'blue-700' };
        default:
            return { border: 'gray-200', bg: 'gray-50', text: 'gray-800', timeText: 'gray-600', content: 'gray-700', amount: 'gray-800', button: 'gray-600', buttonHover: 'gray-700' };
    }
}

// Show section
function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        
        // Load specific data for certain sections
        if (sectionName === 'recent-transactions') {
            loadTransactions();
        } else if (sectionName === 'pending-bills') {
            loadPendingBills();
            startPendingBillsAutoRefresh();
        } else if (sectionName === 'voided-transactions') {
            loadVoidedTransactions();
            stopPendingBillsAutoRefresh();
        } else {
            // Stop auto-refresh for other sections
            stopPendingBillsAutoRefresh();
        }
    }
}

// Clear manual form
function clearManualForm() {
    document.getElementById('manualRfidInput').value = '';
    document.getElementById('manualBookingInput').value = '';
    document.getElementById('billGeneration').classList.add('hidden');
}

// Process billing
function processBilling(tagId = null) {
    const rfidTag = tagId || document.getElementById('manualRfidInput').value || document.getElementById('manualBookingInput').value;
    
    if (!rfidTag) {
        alert('Please enter an RFID tag ID or booking ID first.');
        return;
    }
    
    // Show loading state
    const billGeneration = document.getElementById('billGeneration');
    billGeneration.classList.add('hidden');
    
    // Fetch billing info from bookings table using RFID
    fetch(`${API_BASE}billing.php?rfid=${rfidTag}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('API Response:', data); // Debug log
            
            if (data.success && data.pet) {
                displayBillingInfo(data.pet, rfidTag);
            } else {
                // Show error message from API
                const errorMsg = data.error || 'RFID tag not found in system. Please check the tag ID.';
                alert(errorMsg);
            }
        })
        .catch(error => {
            console.error('Error fetching billing info:', error);
            const errorMsg = 'Failed to fetch billing information. Please check your connection and try again.';
            alert(errorMsg);
        });
}
    
// Display billing information
function displayBillingInfo(pet, rfidTag) {
    // Populate pet information
    document.getElementById('billPetName').textContent = pet.petName;
    document.getElementById('billPetBreed').textContent = pet.breed;
    document.getElementById('billOwnerName').textContent = pet.owner;
    document.getElementById('billOwnerPhone').textContent = pet.phone;
    document.getElementById('billRfidTag').textContent = rfidTag;
    document.getElementById('billCheckinTime').textContent = pet.checkinTime;
    document.getElementById('billBathTime').textContent = pet.bathTime;
    document.getElementById('billGroomingTime').textContent = pet.groomingTime;
    document.getElementById('billStaff').textContent = pet.staff;
    
    // Display payment status if available
    if (pet.paymentStatus) {
        const statusElement = document.getElementById('billPaymentStatus');
        const statusClass = getPaymentStatusClass(pet.paymentStatus);
        statusElement.innerHTML = `<span class="${statusClass}">${pet.paymentStatus.toUpperCase()}</span>`;
    } else {
        document.getElementById('billPaymentStatus').textContent = 'PENDING';
    }
    
    // Use duration from API if available, otherwise calculate
    if (pet.duration) {
        document.getElementById('billDuration').textContent = pet.duration;
    } else {
        // Calculate duration from times
        const checkin = new Date(`2024-01-01 ${pet.checkinTime}`);
        const grooming = new Date(`2024-01-01 ${pet.groomingTime}`);
        const duration = Math.round((grooming - checkin) / (1000 * 60));
        document.getElementById('billDuration').textContent = `${Math.floor(duration / 60)}h ${duration % 60}m`;
    }
    
    // Populate services
    const serviceTable = document.getElementById('serviceBreakdown');
    serviceTable.innerHTML = '';
    
    let subtotal = 0;
    pet.services.forEach(service => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-2 text-xs text-gray-900">${service.name}</td>
            <td class="px-4 py-2 text-xs text-gray-600 text-right">₱${service.basePrice}</td>
            <td class="px-4 py-2 text-xs text-gray-600 text-center">${service.modifier}</td>
            <td class="px-4 py-2 text-xs font-medium text-gray-900 text-right">₱${service.amount}</td>
        `;
        serviceTable.appendChild(row);
        subtotal += service.amount;
    });
    
    // Update billing totals
    updateBillTotal(subtotal);
    
    // Set the current booking ID for payment processing
    if (pet.bookingId) {
        document.getElementById('currentBookingId').value = pet.bookingId;
    }
    
    // Show bill generation area
    document.getElementById('billGeneration').classList.remove('hidden');
    
    // Scroll to bill
    document.getElementById('billGeneration').scrollIntoView({ behavior: 'smooth' });
}

// Update bill total
function updateBillTotal(baseSubtotal = null) {
    let subtotal = baseSubtotal;
    if (subtotal === null) {
        subtotal = 0;
        const serviceRows = document.querySelectorAll('#serviceBreakdown tr');
        serviceRows.forEach(row => {
            const amountCell = row.cells[3];
            if (amountCell) {
                const amount = parseInt(amountCell.textContent.replace('₱', '').replace(',', ''));
                subtotal += amount;
            }
        });
    }
    
    // Calculate discount
    let discount = 0;
    const discountSelect = document.getElementById('discountSelect').value;
    const customDiscount = parseInt(document.getElementById('customDiscount').value || '0');
    
    if (discountSelect === 'custom') {
        discount = customDiscount;
    } else {
        const discountPercent = parseInt(discountSelect || '0');
        discount = Math.round(subtotal * discountPercent / 100);
    }
    
    // Calculate tax (12% of subtotal before discount)
    const tax = Math.round(subtotal * 0.12);
    const total = subtotal - discount;
    
    // Update display (tax inclusive - showing 12% tax)
    document.getElementById('billSubtotal').textContent = `₱${subtotal.toLocaleString()}`;
    document.getElementById('billDiscount').textContent = `₱${discount.toLocaleString()}`;
    document.getElementById('billTax').textContent = `₱${tax.toLocaleString()}`; // Show 12% tax
    document.getElementById('billTotal').textContent = `₱${total.toLocaleString()}`;
}

// Handle payment method change
function handlePaymentMethodChange() {
    const paymentMethod = document.getElementById('paymentMethod').value;
    const onlinePaymentRef = document.getElementById('onlinePaymentRef');
    const onlinePaymentReference = document.getElementById('onlinePaymentReference');
    const onlinePaymentFields = document.getElementById('onlinePaymentFields');
    const cashPaymentFields = document.getElementById('cashPaymentFields');
    const changeDisplay = document.getElementById('changeDisplay');
    
    // Hide all payment-specific fields first
    onlinePaymentReference.classList.add('hidden');
    onlinePaymentFields.classList.add('hidden');
    cashPaymentFields.classList.add('hidden');
    changeDisplay.classList.add('hidden');
    
    // Show relevant fields based on payment method
    if (paymentMethod === 'online') {
        onlinePaymentReference.classList.remove('hidden');
        onlinePaymentFields.classList.remove('hidden');
    } else if (paymentMethod === 'cash') {
        cashPaymentFields.classList.remove('hidden');
        calculateChange(); // Calculate change when switching to cash
    }
}

// Calculate change for cash payments
function calculateChange() {
    const paymentMethod = document.getElementById('paymentMethod').value;
    const total = document.getElementById('billTotal').textContent;
    const amountTendered = parseFloat(document.getElementById('amountTendered').value) || 0;
    const changeDisplay = document.getElementById('changeDisplay');
    const changeAmount = document.getElementById('changeAmount');
    
    if (paymentMethod === 'cash' && amountTendered > 0) {
        const totalAmount = parseFloat(total.replace('₱', '').replace(',', ''));
        const change = amountTendered - totalAmount;
        
        if (change >= 0) {
            changeDisplay.classList.remove('hidden');
            changeAmount.textContent = `₱${change.toFixed(2)}`;
            changeAmount.className = 'text-lg font-bold text-green-600';
    } else {
            changeDisplay.classList.remove('hidden');
            changeAmount.textContent = `₱${Math.abs(change).toFixed(2)} (Insufficient)`;
            changeAmount.className = 'text-lg font-bold text-red-600';
        }
    } else {
        changeDisplay.classList.add('hidden');
    }
}

// Get payment status styling class
function getPaymentStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'paid':
            return 'px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium';
        case 'pending':
            return 'px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium';
        case 'cancelled':
            return 'px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium';
        default:
            return 'px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full text-xs font-medium';
    }
}

// Generate bill from pending
function generateBillFromPending(rfidTag) {
    showSection('manual-billing');
    setTimeout(() => {
        processBilling(rfidTag);
    }, 500);
}

// Process payment
function processPayment() {
    const paymentMethod = document.getElementById('paymentMethod').value;
    const total = document.getElementById('billTotal').textContent;
    const bookingId = document.getElementById('currentBookingId').value;
    
    // Debug logging
    console.log('Payment Method:', paymentMethod);
    console.log('Total:', total);
    console.log('Booking ID:', bookingId);
    console.log('Current Booking ID Element:', document.getElementById('currentBookingId'));
    
    if (!bookingId) {
        alert('Error: No booking ID found. Please try scanning the RFID tag again.');
        return;
    }
    
    if (!paymentMethod) {
        alert('Please select a payment method.');
        return;
    }
    
    // Check if billing information is loaded
    const billGeneration = document.getElementById('billGeneration');
    if (billGeneration.classList.contains('hidden')) {
        alert('Please load billing information first by scanning an RFID tag.');
        return;
    }
    
    // Check if total amount is valid
    if (!total || total === '₱0') {
        alert('Error: Invalid total amount. Please check the billing information.');
        return;
    }
    
    // Validate payment method specific requirements
    let reference = '';
    let platform = '';
    let amountTendered = 0;
    let change = 0;
    
    if (paymentMethod === 'online') {
        reference = document.getElementById('paymentReference').value.trim();
        platform = document.getElementById('paymentPlatform').value;
        
        if (!reference || !platform) {
            alert('Please enter both reference number and payment platform for online payments.');
            return;
        }
    } else if (paymentMethod === 'cash') {
        amountTendered = parseFloat(document.getElementById('amountTendered').value) || 0;
        const totalAmount = parseFloat(total.replace('₱', '').replace(',', ''));
        
        if (amountTendered <= 0) {
            alert('Please enter the amount tendered for cash payment.');
            return;
        }
        
        if (amountTendered < totalAmount) {
            alert('Amount tendered is insufficient. Please enter a higher amount.');
            return;
        }
        
        change = amountTendered - totalAmount;
    }
    
    // Get the discount amount from the bill display
    const discountElement = document.getElementById('billDiscount');
    const discountText = discountElement ? discountElement.textContent : '₱0';
    const discountAmount = parseInt(discountText.replace('₱', '').replace(',', '')) || 0;
    
    // Debug log
    const paymentData = {
        action: 'process_payment',
        booking_id: bookingId,
        payment_method: paymentMethod,
        payment_reference: reference,
        payment_platform: platform,
        amount_tendered: amountTendered,
        change_amount: change,
        discount_amount: discountAmount,
        send_receipt: true
    };
    console.log('Sending payment data:', paymentData);
    console.log('Discount amount extracted:', discountAmount);
    console.log('Discount element text:', discountText);
    
    // Process payment and send receipt
    fetch(`${API_BASE}billing.php`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData)
    })
    .then(response => {
        console.log('Payment response status:', response.status);
        console.log('Payment response headers:', response.headers);
        return response.json();
    })
    .then(data => {
        console.log('Payment response data:', data);
        if (data.success) {
            // Update receipt status in the modal
            const receiptStatusElement = document.getElementById('receiptStatus');
            if (receiptStatusElement) {
                if (data.receipt_sent) {
                    receiptStatusElement.textContent = 'Receipt has been sent to customer email.';
                    receiptStatusElement.classList.add('text-green-600');
                } else {
                    receiptStatusElement.textContent = 'Could not send receipt to customer email. You can print it instead.';
                    receiptStatusElement.classList.add('text-yellow-600');
                }
            }
            
            // Store payment info for printing
            window.currentPaymentInfo = {
                booking_id: bookingId,
                payment_method: paymentMethod,
                payment_reference: reference,
                payment_platform: platform
            };
            
            // Show success modal
            document.getElementById('successModal').classList.remove('hidden');
            
            // Update receipt status in modal
            if (data.receipt_sent) {
                document.getElementById('receiptStatus').textContent = 'Receipt has been sent to customer email.';
                document.getElementById('receiptStatus').classList.remove('text-yellow-600');
                document.getElementById('receiptStatus').classList.add('text-green-600');
            } else {
                document.getElementById('receiptStatus').textContent = 'Could not send receipt email. Please try manual receipt.';
                document.getElementById('receiptStatus').classList.remove('text-green-600');
                document.getElementById('receiptStatus').classList.add('text-yellow-600');
            }
            
            // Update stats
            loadStats();
            loadPendingBills();
            loadPaymentProcessing();
        } else {
            alert('Payment processing failed: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while processing payment. Please try again.');
    });
    
    // In a real system, this would integrate with payment processors
    console.log(`Processing ${total} payment via ${paymentMethod}`);
}

// Print bill (before payment)
function printBill() {
    // Get current bill data
    const petName = document.getElementById('billPetName').textContent;
    const petBreed = document.getElementById('billPetBreed').textContent;
    const ownerName = document.getElementById('billOwnerName').textContent;
    const ownerPhone = document.getElementById('billOwnerPhone').textContent;
    const rfidTag = document.getElementById('billRfidTag').textContent;
    const checkinTime = document.getElementById('billCheckinTime').textContent;
    const subtotal = document.getElementById('billSubtotal').textContent;
    const discount = document.getElementById('billDiscount').textContent;
    const tax = document.getElementById('billTax').textContent;
    const total = document.getElementById('billTotal').textContent;
    
    // Get services from table
    const serviceRows = document.querySelectorAll('#serviceBreakdown tr');
    let servicesHTML = '';
    serviceRows.forEach(row => {
        const cells = row.cells;
        if (cells.length >= 4) {
            const serviceName = cells[0].textContent;
            const basePrice = cells[1].textContent;
            const modifier = cells[2].textContent;
            const amount = cells[3].textContent;
            servicesHTML += `
                <tr>
                    <td>${serviceName}</td>
                    <td>${basePrice}</td>
                    <td>${modifier}</td>
                    <td>${amount}</td>
                </tr>
            `;
        }
    });
    
    // Generate bill number
    const billNumber = 'BILL-' + new Date().getTime();
    
    // Create bill HTML
    const billHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Animates PH - Bill #${billNumber}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 20px;
                }
                .bill {
                    max-width: 800px;
                    margin: 0 auto;
                    border: 1px solid #ddd;
                    padding: 20px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #D4AF37;
                    padding-bottom: 10px;
                }
                .bill-details table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .bill-details td {
                    padding: 8px;
                    border-bottom: 1px solid #eee;
                }
                .services {
                    margin: 20px 0;
                    border-top: 1px solid #eee;
                    border-bottom: 1px solid #eee;
                    padding: 10px 0;
                }
                .services table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .services th, .services td {
                    padding: 8px;
                    text-align: left;
                    border-bottom: 1px solid #eee;
                }
                .services th {
                    background-color: #f8f9fa;
                    font-weight: bold;
                }
                .total {
                    font-size: 18px;
                    font-weight: bold;
                    text-align: right;
                    margin-top: 20px;
                    border-top: 2px solid #D4AF37;
                    padding-top: 10px;
                }
                .footer {
                    margin-top: 30px;
                    font-size: 12px;
                    text-align: center;
                    color: #777;
                }
                @media print {
                    body {
                        padding: 0;
                        margin: 0;
                    }
                    .bill {
                        border: none;
                        width: 100%;
                        max-width: 100%;
                    }
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="bill">
                <div class="header">
                    <h2>Animates PH - Bill</h2>
                    <p>Camaro Branch</p>
                </div>
                
                <div class="bill-details">
                    <table>
                        <tr>
                            <td><strong>Bill #:</strong></td>
                            <td>${billNumber}</td>
                        </tr>
                        <tr>
                            <td><strong>Date:</strong></td>
                            <td>${new Date().toLocaleDateString()}</td>
                        </tr>
                        <tr>
                            <td><strong>Time:</strong></td>
                            <td>${new Date().toLocaleTimeString()}</td>
                        </tr>
                        <tr>
                            <td><strong>Customer:</strong></td>
                            <td>${ownerName}</td>
                        </tr>
                        <tr>
                            <td><strong>Phone:</strong></td>
                            <td>${ownerPhone}</td>
                        </tr>
                        <tr>
                            <td><strong>Pet:</strong></td>
                            <td>${petName} (${petBreed})</td>
                        </tr>
                        <tr>
                            <td><strong>RFID:</strong></td>
                            <td>${rfidTag}</td>
                        </tr>
                        <tr>
                            <td><strong>Check-in Time:</strong></td>
                            <td>${checkinTime}</td>
                        </tr>
                    </table>
                </div>
                
                <div class="services">
                    <h3>Services</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>Base Price</th>
                                <th>Modifier</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${servicesHTML}
                        </tbody>
                    </table>
                </div>
                
                <div class="total">
                    <div style="margin-bottom: 10px;">
                        <span>Subtotal: ${subtotal}</span>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <span>Discount: ${discount}</span>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <span>Tax (12%): ${tax}</span>
                    </div>
                    <div style="font-size: 20px;">
                        <span>Total: ${total}</span>
                    </div>
                </div>
                
                <div class="footer">
                    <p>This is a bill for services rendered. Payment is due upon completion.</p>
                    <p>© 2025 Animates PH. All rights reserved.</p>
                </div>
                
                <div class="no-print" style="text-align: center; margin-top: 30px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #D4AF37; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Print Bill
                    </button>
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Open bill in new window
    const billWindow = window.open('', '_blank');
    billWindow.document.write(billHTML);
    billWindow.document.close();
    
    // Auto print after content loads
    billWindow.addEventListener('load', function() {
        billWindow.print();
    });
}

// Print receipt (after payment)
function printReceipt() {
    if (!window.currentPaymentInfo) {
        alert('Payment information not available');
        return;
    }
    
    const { booking_id, payment_method, payment_reference, payment_platform } = window.currentPaymentInfo;
    
    // Get current bill data from the page
    const petName = document.getElementById('billPetName').textContent;
    const petBreed = document.getElementById('billPetBreed').textContent;
    const ownerName = document.getElementById('billOwnerName').textContent;
    const ownerPhone = document.getElementById('billOwnerPhone').textContent;
    const rfidTag = document.getElementById('billRfidTag').textContent;
    const checkinTime = document.getElementById('billCheckinTime').textContent;
    const subtotal = document.getElementById('billSubtotal').textContent;
    const discount = document.getElementById('billDiscount').textContent;
    const tax = document.getElementById('billTax').textContent;
    const total = document.getElementById('billTotal').textContent;
    
    // Get services from table
    const serviceRows = document.querySelectorAll('#serviceBreakdown tr');
    let servicesHTML = '';
    serviceRows.forEach(row => {
        const cells = row.cells;
        if (cells.length >= 4) {
            const serviceName = cells[0].textContent;
            const basePrice = cells[1].textContent;
            const modifier = cells[2].textContent;
            const amount = cells[3].textContent;
            servicesHTML += `
                <tr>
                    <td>${serviceName}</td>
                    <td>${basePrice}</td>
                    <td>${modifier}</td>
                    <td>${amount}</td>
                </tr>
            `;
        }
    });
    
    // Get payment details
    const amountTendered = document.getElementById('amountTendered').value || '';
    const changeAmount = document.getElementById('changeDisplay').textContent.replace('Change: ', '') || '';
    
    // Generate receipt number
    const receiptNumber = 'RECEIPT-' + new Date().getTime();
    
    // Create receipt HTML with same format as bill
    const receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Animates PH - Receipt #${receiptNumber}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 20px;
                }
                .receipt {
                    max-width: 800px;
                    margin: 0 auto;
                    border: 1px solid #ddd;
                    padding: 20px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #D4AF37;
                    padding-bottom: 10px;
                }
                .receipt-details table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .receipt-details td {
                    padding: 8px;
                    border-bottom: 1px solid #eee;
                }
                .services {
                    margin: 20px 0;
                    border-top: 1px solid #eee;
                    border-bottom: 1px solid #eee;
                    padding: 10px 0;
                }
                .services table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .services th, .services td {
                    padding: 8px;
                    text-align: left;
                    border-bottom: 1px solid #eee;
                }
                .services th {
                    background-color: #f8f9fa;
                    font-weight: bold;
                }
                .total {
                    font-size: 18px;
                    font-weight: bold;
                    text-align: right;
                    margin-top: 20px;
                    border-top: 2px solid #D4AF37;
                    padding-top: 10px;
                }
                .payment-info {
                    margin: 20px 0;
                    border-top: 1px solid #eee;
                    padding: 10px 0;
                }
                .payment-info table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .payment-info td {
                    padding: 8px;
                    border-bottom: 1px solid #eee;
                }
                .footer {
                    margin-top: 30px;
                    font-size: 12px;
                    text-align: center;
                    color: #777;
                }
                @media print {
                    body {
                        padding: 0;
                        margin: 0;
                    }
                    .receipt {
                        border: none;
                        width: 100%;
                        max-width: 100%;
                    }
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <h2>Animates PH - Receipt</h2>
                    <p>Camaro Branch</p>
                </div>
                
                <div class="receipt-details">
                    <table>
                        <tr>
                            <td><strong>Receipt #:</strong></td>
                            <td>${receiptNumber}</td>
                        </tr>
                        <tr>
                            <td><strong>Date:</strong></td>
                            <td>${new Date().toLocaleDateString()}</td>
                        </tr>
                        <tr>
                            <td><strong>Time:</strong></td>
                            <td>${new Date().toLocaleTimeString()}</td>
                        </tr>
                        <tr>
                            <td><strong>Customer:</strong></td>
                            <td>${ownerName}</td>
                        </tr>
                        <tr>
                            <td><strong>Phone:</strong></td>
                            <td>${ownerPhone}</td>
                        </tr>
                        <tr>
                            <td><strong>Pet:</strong></td>
                            <td>${petName} (${petBreed})</td>
                        </tr>
                        <tr>
                            <td><strong>RFID:</strong></td>
                            <td>${rfidTag}</td>
                        </tr>
                        <tr>
                            <td><strong>Check-in Time:</strong></td>
                            <td>${checkinTime}</td>
                        </tr>
                    </table>
                </div>
                
                <div class="services">
                    <h3>Services</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>Base Price</th>
                                <th>Modifier</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${servicesHTML}
                        </tbody>
                    </table>
                </div>
                
                <div class="total">
                    <div style="margin-bottom: 10px;">
                        <span>Subtotal: ${subtotal}</span>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <span>Discount: ${discount}</span>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <span>Tax (12%): ${tax}</span>
                    </div>
                    <div style="font-size: 20px;">
                        <span>Total: ${total}</span>
                    </div>
                </div>
                
                <div class="payment-info">
                    <h3>Payment Details</h3>
                    <table>
                        <tr>
                            <td><strong>Payment Method:</strong></td>
                            <td>${payment_method}</td>
                        </tr>
                        ${payment_reference ? `<tr><td><strong>Reference:</strong></td><td>${payment_reference}</td></tr>` : ''}
                        ${payment_platform ? `<tr><td><strong>Platform:</strong></td><td>${payment_platform}</td></tr>` : ''}
                        ${amountTendered ? `<tr><td><strong>Amount Tendered:</strong></td><td>₱${amountTendered}</td></tr>` : ''}
                        ${changeAmount ? `<tr><td><strong>Change:</strong></td><td>${changeAmount}</td></tr>` : ''}
                    </table>
                </div>
                
                <div class="footer">
                    <p>Thank you for choosing Animates PH!</p>
                    <p>© 2025 Animates PH. All rights reserved.</p>
                </div>
                
                <div class="no-print" style="text-align: center; margin-top: 30px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #D4AF37; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Print Receipt
                    </button>
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Open receipt in new window
    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write(receiptHTML);
    receiptWindow.document.close();
    
    // Auto print after content loads
    receiptWindow.addEventListener('load', function() {
        receiptWindow.print();
    });
}

// Save draft
function saveDraft() {
    alert('Bill draft saved successfully!');
}

// Generate comprehensive business report - show modal first
function generateReport() {
    // Show the report modal for date selection
    showReportModal();
}

// Show report generation modal
async function showReportModal() {
    // Reset modal state - both form and preview sections are visible
    document.getElementById('reportFormSection').classList.remove('hidden');
    document.getElementById('reportPreviewSection').classList.add('hidden');

    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reportStartDate').value = today;
    document.getElementById('reportEndDate').value = today;

    // Reset form with default values
    document.getElementById('reportForm').reset();
    document.getElementById('customDateRange').classList.add('hidden');

    // Set default selections (comprehensive report and today)
    document.getElementById('reportType').value = 'comprehensive';
    document.getElementById('reportDateRange').value = 'today';

    // Clear any previous preview data
    currentReportData = null;
    currentReportType = null;
    currentStartDate = null;
    currentEndDate = null;

    // Show modal
    document.getElementById('reportModal').classList.remove('hidden');

    // Auto-generate preview for default selections
    setTimeout(() => {
        autoGeneratePreview();
    }, 100);
}

// Close report modal
function closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
}

// Handle date range change
async function handleDateRangeChange() {
    const dateRange = document.getElementById('reportDateRange').value;
    const customRangeDiv = document.getElementById('customDateRange');

    if (dateRange === 'custom') {
        customRangeDiv.classList.remove('hidden');
    } else {
        customRangeDiv.classList.add('hidden');
        // Auto-generate preview when date range is selected (non-custom)
        await autoGeneratePreview();
    }
}

// Auto-generate preview when date range changes
async function autoGeneratePreview() {
    const reportType = document.getElementById('reportType').value;
    const dateRange = document.getElementById('reportDateRange').value;

    if (!dateRange || dateRange === 'custom') return;

    // Get date range
    let startDate, endDate;
    const now = new Date();

    console.log('Date range calculation debug:', {
        dateRange,
        now: now.toISOString(),
        nowMonth: now.getMonth(),
        nowYear: now.getFullYear()
    });

    switch (dateRange) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
            endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
            break;
        case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            break;
        case 'last_week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - now.getDay() - 7); // Start of last week
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6); // End of last week
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            console.log('Last month calculation:', {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                startFormatted: startDate.toLocaleDateString(),
                endFormatted: endDate.toLocaleDateString()
            });
            break;
    }

    // Store current report parameters
    currentReportType = reportType;
    currentStartDate = startDate;
    currentEndDate = endDate;

    // Show loading and generate preview
    showNotification('Generating preview...', 'info');
    await generateReportPreview(reportType, startDate, endDate);
}

// Global variables to store report data
let currentReportData = null;
let currentReportType = null;
let currentStartDate = null;
let currentEndDate = null;

// Handle report form submission - for custom date ranges
async function handleReportSubmission(event) {
    event.preventDefault();

    const reportType = document.getElementById('reportType').value;
    const dateRange = document.getElementById('reportDateRange').value;

    // Only handle custom date ranges here, others are auto-generated
    if (dateRange !== 'custom') {
        return; // Preview already generated by date range change
    }

    // Handle custom date range
    const startDate = new Date(document.getElementById('reportStartDate').value);
    const endDate = new Date(document.getElementById('reportEndDate').value);
    endDate.setHours(23, 59, 59, 999);

    if (!startDate || !endDate || startDate > endDate) {
        showNotification('Please select valid start and end dates', 'error');
        return;
    }

    // Store current report parameters
    currentReportType = reportType;
    currentStartDate = startDate;
    currentEndDate = endDate;

    // Show loading and generate preview
    showNotification('Generating preview...', 'info');
    await generateReportPreview(reportType, startDate, endDate);
}

// Generate report preview
async function generateReportPreview(reportType, startDate, endDate) {
    try {
        // Fetch transactions and pending bills from separate endpoints
        const [transactionsResponse, pendingBillsResponse] = await Promise.all([
            fetch(`${API_BASE}billing.php?action=get_transactions`),
            fetch(`${API_BASE}billing.php?action=get_pending_bills`)
        ]);

        const transactionsData = await transactionsResponse.json();
        const pendingBillsData = await pendingBillsResponse.json();

        if (!transactionsData.success || !pendingBillsData.success) {
            throw new Error('Failed to fetch report data');
        }

        let allTransactions = transactionsData.transactions || [];
        let allPendingBills = pendingBillsData.pending_bills || [];

        // Filter data by date range
        const filteredTransactions = allTransactions.filter(t => {
            const transactionDate = new Date(t.created_at);
            return transactionDate >= startDate && transactionDate <= endDate;
        });

        const filteredPendingBills = allPendingBills.filter(b => {
            const checkinDate = new Date(b.check_in_time);
            return checkinDate >= startDate && checkinDate <= endDate;
        });

        // Debug logging
        console.log('Report filtering debug:', {
            reportType,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            totalTransactions: allTransactions.length,
            filteredTransactions: filteredTransactions.length,
            totalPendingBills: allPendingBills.length,
            filteredPendingBills: filteredPendingBills.length,
            sampleTransaction: filteredTransactions[0] ? {
                id: filteredTransactions[0].id,
                created_at: filteredTransactions[0].created_at,
                status: filteredTransactions[0].status
            } : null
        });

        // Store data for download
        currentReportData = {
            transactions: filteredTransactions,
            pendingBills: filteredPendingBills,
            startDate,
            endDate
        };

        // Display preview
        displayReportPreview(reportType, filteredTransactions, filteredPendingBills, startDate, endDate);

        // Show preview section (form stays visible)
        document.getElementById('reportPreviewSection').classList.remove('hidden');

    } catch (error) {
        console.error('Error generating report preview:', error);
        showNotification('Failed to generate report preview', 'error');
    }
}

// Display report preview in table - matches CSV exactly
function displayReportPreview(reportType, transactions, pendingBills, startDate, endDate) {
    // Update summary info
    document.getElementById('previewReportType').textContent = getReportTypeDisplayName(reportType);

    // Format dates properly for display
    const startFormatted = startDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const endFormatted = endDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    document.getElementById('previewDateRange').textContent = `${startFormatted} to ${endFormatted}`;
    document.getElementById('previewGeneratedTime').textContent = new Date().toLocaleString();

    const totalRecords = reportType === 'summary' ? 'Summary' : `${transactions.length + (reportType === 'comprehensive' ? pendingBills.length : 0)} records`;
    document.getElementById('previewTotalRecords').textContent = totalRecords;

    // Clear previous content
    const headerEl = document.getElementById('previewTableHeader');
    const bodyEl = document.getElementById('previewTableBody');
    headerEl.innerHTML = '';
    bodyEl.innerHTML = '';

    if (reportType === 'summary') {
        // Summary report preview - matches CSV structure
        const completedTransactions = transactions.filter(t => t.status === 'completed');
        const voidedTransactions = transactions.filter(t => t.status === 'voided');
        const totalRevenue = completedTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const pendingRevenue = pendingBills.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);

        headerEl.innerHTML = `
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-600">Metric</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-600">Value</th>
        `;

        bodyEl.innerHTML = `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm text-gray-900">Total Transactions</td>
                <td class="px-4 py-2 text-sm text-gray-900">${transactions.length}</td>
            </tr>
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm text-gray-900">Completed Transactions</td>
                <td class="px-4 py-2 text-sm text-gray-900">${completedTransactions.length}</td>
            </tr>
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm text-gray-900">Voided Transactions</td>
                <td class="px-4 py-2 text-sm text-gray-900">${voidedTransactions.length}</td>
            </tr>
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm text-gray-900">Total Revenue</td>
                <td class="px-4 py-2 text-sm text-gray-900">₱${totalRevenue.toFixed(2)}</td>
            </tr>
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm text-gray-900">Pending Bills</td>
                <td class="px-4 py-2 text-sm text-gray-900">${pendingBills.length}</td>
            </tr>
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm text-gray-900">Pending Revenue</td>
                <td class="px-4 py-2 text-sm text-gray-900">₱${pendingRevenue.toFixed(2)}</td>
            </tr>
        `;

    } else if (reportType === 'transactions') {
        // Transaction details preview - matches CSV headers exactly
        headerEl.innerHTML = `
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-600">Date/Time</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-600">Transaction Reference</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-600">Customer Name</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-600">Pet Name</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-600">Pet Breed</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-600">RFID Tag</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-600">Amount</th>
            <th class="px-4 py-2 text-center text-xs font-medium text-gray-600">Payment Method</th>
            <th class="px-4 py-2 text-center text-xs font-medium text-gray-600">Payment Platform</th>
            <th class="px-4 py-2 text-center text-xs font-medium text-gray-600">Status</th>
        `;

        const previewTransactions = transactions.slice(0, 5); // Show first 5 to match CSV preview
        bodyEl.innerHTML = previewTransactions.map(t => `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm text-gray-900">${new Date(t.created_at).toLocaleString()}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${t.transaction_reference || ''}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${t.customer_name || 'Unknown Customer'}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${t.pet_name || 'Unknown Pet'}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${t.pet_breed || 'Unknown Breed'}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${t.rfid_tag || ''}</td>
                <td class="px-4 py-2 text-sm text-gray-900 text-right">${t.amount || 0}</td>
                <td class="px-4 py-2 text-sm text-center text-gray-900">${t.payment_method || ''}</td>
                <td class="px-4 py-2 text-sm text-center text-gray-900">${t.payment_platform || ''}</td>
                <td class="px-4 py-2 text-sm text-center">
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${t.status === 'completed' ? 'bg-green-100 text-green-800' : t.status === 'voided' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${t.status || 'N/A'}
                    </span>
                </td>
            </tr>
        `).join('');

        if (transactions.length > 5) {
            bodyEl.innerHTML += `
                <tr class="hover:bg-gray-50">
                    <td colspan="10" class="px-4 py-2 text-sm text-gray-500 text-center italic">
                        ... and ${transactions.length - 5} more transactions (will be included in CSV)
                    </td>
                </tr>
            `;
        }

    } else {
        // Comprehensive report preview - matches CSV structure
        headerEl.innerHTML = `
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-600">Section</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-600">Preview</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-600">Records</th>
        `;

        const completedTransactions = transactions.filter(t => t.status === 'completed');
        const totalRevenue = completedTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        bodyEl.innerHTML = `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm font-medium text-gray-900">SUMMARY STATISTICS</td>
                <td class="px-4 py-2 text-sm text-gray-900">Revenue: ₱${totalRevenue.toFixed(2)}, Transactions: ${transactions.length}</td>
                <td class="px-4 py-2 text-sm text-gray-900 text-right">Summary</td>
            </tr>
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm font-medium text-gray-900">PAYMENT METHODS BREAKDOWN</td>
                <td class="px-4 py-2 text-sm text-gray-900">Cash, Online, etc. with percentages</td>
                <td class="px-4 py-2 text-sm text-gray-900 text-right">Analytics</td>
            </tr>
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm font-medium text-gray-900">SERVICE POPULARITY</td>
                <td class="px-4 py-2 text-sm text-gray-900">Top requested services</td>
                <td class="px-4 py-2 text-sm text-gray-900 text-right">${pendingBills.length > 0 ? 'Analysis' : 'N/A'}</td>
            </tr>
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm font-medium text-gray-900">DETAILED TRANSACTIONS</td>
                <td class="px-4 py-2 text-sm text-gray-900">All transaction records with full details</td>
                <td class="px-4 py-2 text-sm text-gray-900 text-right">${transactions.length}</td>
            </tr>
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm font-medium text-gray-900">PENDING BILLS</td>
                <td class="px-4 py-2 text-sm text-gray-900">Outstanding bookings and services</td>
                <td class="px-4 py-2 text-sm text-gray-900 text-right">${pendingBills.length}</td>
            </tr>
        `;
    }
}

// Get display name for report type
function getReportTypeDisplayName(reportType) {
    switch (reportType) {
        case 'comprehensive': return 'Comprehensive Business Report';
        case 'transactions': return 'Transaction Details Only';
        case 'summary': return 'Summary Report Only';
        default: return reportType;
    }
}

// Go back to form
function backToForm() {
    document.getElementById('reportPreviewSection').classList.add('hidden');
    document.getElementById('reportFormSection').classList.remove('hidden');
}

// Download the report
function downloadReport() {
    if (!currentReportData) {
        showNotification('No report data available', 'error');
        return;
    }

    const { transactions, pendingBills, startDate, endDate } = currentReportData;

    // Generate Excel workbook based on report type
    let workbook;
    if (currentReportType === 'summary') {
        workbook = generateSummaryReportExcel(transactions, pendingBills, startDate, endDate);
    } else if (currentReportType === 'transactions') {
        workbook = generateTransactionReportExcel(transactions, startDate, endDate);
    } else {
        workbook = generateComprehensiveReportExcel(transactions, pendingBills, startDate, endDate);
    }

    // Download the Excel file
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const dateRangeStr = startStr === endStr ? startStr : `${startStr}_to_${endStr}`;

    XLSX.writeFile(workbook, `${currentReportType}_report_${dateRangeStr}.xlsx`);

    // Close modal and show success
    closeReportModal();
    showNotification('Report downloaded successfully!', 'success');
}

// Generate report with specific date range
async function generateReportWithDateRange(reportType, startDate, endDate) {
    try {
        showNotification('Generating business report...', 'info');

        // Format dates for filename
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        const dateRangeStr = startStr === endStr ? startStr : `${startStr}_to_${endStr}`;

        // Fetch transactions and pending bills from separate endpoints
        const [transactionsResponse, pendingBillsResponse] = await Promise.all([
            fetch(`${API_BASE}billing.php?action=get_transactions`),
            fetch(`${API_BASE}billing.php?action=get_pending_bills`)
        ]);

        const transactionsData = await transactionsResponse.json();
        const pendingBillsData = await pendingBillsResponse.json();

        if (!transactionsData.success || !pendingBillsData.success) {
            throw new Error('Failed to fetch report data');
        }

        let allTransactions = transactionsData.transactions || [];
        let allPendingBills = pendingBillsData.pending_bills || [];

        // Filter data by date range
        const filteredTransactions = allTransactions.filter(t => {
            const transactionDate = new Date(t.created_at);
            return transactionDate >= startDate && transactionDate <= endDate;
        });

        const filteredPendingBills = allPendingBills.filter(b => {
            const checkinDate = new Date(b.check_in_time);
            return checkinDate >= startDate && checkinDate <= endDate;
        });

        // Generate CSV content based on report type (Excel-compatible format)
        let csvContent;
        if (reportType === 'summary') {
            csvContent = generateSummaryReportCSV(filteredTransactions, filteredPendingBills, startDate, endDate);
        } else if (reportType === 'transactions') {
            csvContent = generateTransactionReportCSV(filteredTransactions, startDate, endDate);
        } else {
            csvContent = generateComprehensiveReportCSV(filteredTransactions, filteredPendingBills, startDate, endDate);
        }

        // Download the CSV file (Excel will open it properly)
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${reportType}_report_${dateRangeStr}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Business report generated successfully!', 'success');

    } catch (error) {
        console.error('Error generating report:', error);
        showNotification('Failed to generate business report', 'error');
    }
}

function buildSummarySheetData(title, transactions, pendingBills, startDate, endDate) {
    const isValidDate = (date) => date instanceof Date && !isNaN(date.getTime());
    const formatDateRange = (start, end) => {
        if (!isValidDate(start) || !isValidDate(end)) {
            return 'N/A';
        }
        const startStr = start.toLocaleDateString();
        const endStr = end.toLocaleDateString();
        return startStr === endStr ? startStr : `${startStr} to ${endStr}`;
    };
    const toAmount = (value) => {
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
    };
    const formatCurrency = (amount) => `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const generatedOn = new Date().toLocaleString();
    const completedTransactions = transactions.filter(t => (t.status || '').toLowerCase() === 'completed');
    const voidedTransactions = transactions.filter(t => (t.status || '').toLowerCase() === 'voided');
    const totalTransactions = transactions.length;
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + toAmount(t.amount), 0);
    const pendingRevenue = pendingBills.reduce((sum, b) => sum + toAmount(b.total_amount), 0);

    // Get current user name for the report
    const getCurrentUserName = () => {
        if (!currentUser) return 'Unknown User';
        const preferredName = (currentUser.full_name && currentUser.full_name.trim())
            ? currentUser.full_name.trim()
            : ((currentUser.username && currentUser.username.trim())
                ? currentUser.username.trim()
                : (currentUser.email ? currentUser.email.split('@')[0] : 'User'));
        return preferredName;
    };

    const summaryData = [
        [title, '', ''],
        ['Report Period', formatDateRange(startDate, endDate), ''],
        ['Generated on', generatedOn, ''],
        ['Generated by', getCurrentUserName(), ''],
        ['', '', ''],
        ['Summary Statistics', '', ''],
        ['Metric', 'Value', ''],
        ['Total Transactions', totalTransactions.toString(), ''],
        ['Completed Transactions', completedTransactions.length.toString(), ''],
        ['Voided Transactions', voidedTransactions.length.toString(), ''],
        ['Total Revenue', formatCurrency(totalRevenue), ''],
        ['Pending Bills', pendingBills.length.toString(), ''],
        ['Pending Revenue', formatCurrency(pendingRevenue), ''],
        ['', '', ''],
        ['Payment Methods Breakdown', '', ''],
        ['Method', 'Amount', 'Percentage']
    ];

    const paymentBreakdown = {};
    completedTransactions.forEach(t => {
        const method = t.payment_method ? t.payment_method.toString() : 'Unknown';
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + toAmount(t.amount);
    });

    if (Object.keys(paymentBreakdown).length === 0) {
        summaryData.push(['No completed transactions recorded', '', '']);
    } else {
        Object.entries(paymentBreakdown).forEach(([method, amount]) => {
            const percentage = totalRevenue > 0 ? `${((amount / totalRevenue) * 100).toFixed(1)}%` : '0.0%';
            summaryData.push([method, formatCurrency(amount), percentage]);
        });
    }

    summaryData.push(['', '', '']);
    summaryData.push(['Service Popularity', '', '']);
    summaryData.push(['Service', 'Bookings', '']);

    const serviceCount = {};
    const recordService = (name) => {
        if (!name) return;
        const cleaned = name.trim();
        if (!cleaned) return;
        serviceCount[cleaned] = (serviceCount[cleaned] || 0) + 1;
    };

    pendingBills.forEach(bill => {
        if (!bill || !bill.services) {
            return;
        }
        if (Array.isArray(bill.services)) {
            bill.services.forEach(service => {
                if (typeof service === 'string') {
                    recordService(service.split(' - ₱')[0]);
                } else if (service && service.name) {
                    recordService(service.name);
                }
            });
        } else if (typeof bill.services === 'string') {
            bill.services.split(';').forEach(serviceEntry => {
                recordService(serviceEntry.split(' - ₱')[0]);
            });
        }
    });

    const popularServices = Object.entries(serviceCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20);

    if (popularServices.length === 0) {
        summaryData.push(['No service data available', '', '']);
    } else {
        popularServices.forEach(([serviceName, count]) => {
            summaryData.push([serviceName, count.toString(), '']);
        });
    }

    return summaryData;
}

function autoFitColumns(worksheet, data) {
    if (!worksheet || !data) {
        return;
    }

    const colWidths = [];
    
    // First pass: calculate based on content
    data.forEach(row => {
        if (!Array.isArray(row)) {
            return;
        }
        row.forEach((value, idx) => {
            const cellValue = value == null ? '' : value.toString();
            const width = cellValue.length + 4; // Add more padding for better readability
            colWidths[idx] = Math.max(colWidths[idx] || 8, width);
        });
    });

    // Second pass: ensure minimum widths for headers and common content
    if (data.length > 0 && Array.isArray(data[0])) {
        data[0].forEach((header, idx) => {
            if (header) {
                const headerWidth = header.toString().length + 4;
                colWidths[idx] = Math.max(colWidths[idx] || 8, headerWidth);
            }
        });
    }

    worksheet['!cols'] = colWidths.map((width, idx) => {
        // Calculate minimum width based on header length or content
        const minWidth = Math.max(width, 15); // Minimum 15 characters for better spacing
        const maxWidth = Math.min(minWidth, 100); // Maximum 100 characters for very long content
        return { wch: maxWidth };
    });
}

// Format summary sheet with borders and styling
function formatSummarySheet(worksheet, data) {
    if (!worksheet || !data) return;
    
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Apply formatting to each cell
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[cellAddress]) {
                // Create empty cell if it doesn't exist
                worksheet[cellAddress] = { t: 's', v: '' };
            }
            
            const cell = worksheet[cellAddress];
            const cellValue = cell.v;
            
            // Initialize cell style
            let cellStyle = {
                border: {
                    top: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                },
                alignment: { vertical: 'center' }
            };
            
            // Title row (row 0)
            if (R === 0) {
                cellStyle = {
                    font: { bold: true, size: 16, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: '1F4E79' } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: {
                        top: { style: 'thick' },
                        bottom: { style: 'thick' },
                        left: { style: 'thick' },
                        right: { style: 'thick' }
                    }
                };
            }
            // Header rows (Report Period, Generated on)
            else if (R === 1 || R === 2) {
                if (C === 0) {
                    cellStyle = {
                        font: { bold: true, size: 12 },
                        fill: { fgColor: { rgb: 'D9E2F3' } },
                        alignment: { vertical: 'center' },
                        border: {
                            top: { style: 'thin' },
                            bottom: { style: 'thin' },
                            left: { style: 'thin' },
                            right: { style: 'thin' }
                        }
                    };
                }
            }
            // Section headers (Summary Statistics, Payment Methods, Service Popularity)
            else if (cellValue && (cellValue.toString().includes('Summary Statistics') || 
                     cellValue.toString().includes('Payment Methods Breakdown') || 
                     cellValue.toString().includes('Service Popularity'))) {
                cellStyle = {
                    font: { bold: true, size: 14, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: '4472C4' } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: {
                        top: { style: 'thick' },
                        bottom: { style: 'thick' },
                        left: { style: 'thick' },
                        right: { style: 'thick' }
                    }
                };
            }
            // Column headers (Metric/Value, Method/Amount/Percentage, Service/Bookings)
            else if (cellValue && (cellValue === 'Metric' || cellValue === 'Value' || 
                     cellValue === 'Method' || cellValue === 'Amount' || cellValue === 'Percentage' ||
                     cellValue === 'Service' || cellValue === 'Bookings')) {
                cellStyle = {
                    font: { bold: true, size: 11 },
                    fill: { fgColor: { rgb: 'B4C6E7' } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    }
                };
            }
            // Data rows with values
            else if (cellValue && cellValue.toString().trim() !== '') {
                cellStyle.alignment = { vertical: 'center' };
                
                // Right-align numbers and currency
                if (cellValue.toString().includes('₱') || (!isNaN(cellValue) && cellValue !== '')) {
                    cellStyle.alignment.horizontal = 'right';
                }
                
                // Alternate row colors for better readability
                if (R % 2 === 0 && R > 3) {
                    cellStyle.fill = { fgColor: { rgb: 'F8F9FA' } };
                }
            }
            
            cell.s = cellStyle;
        }
    }
    
    // Merge title cell across all columns
    if (range.e.c > 0) {
        worksheet['!merges'] = worksheet['!merges'] || [];
        worksheet['!merges'].push({
            s: { r: 0, c: 0 },
            e: { r: 0, c: range.e.c }
        });
    }

    // Freeze header row (the actual data header at row 5)
    worksheet['!freeze'] = { xSplit: 0, ySplit: 6 };

    // Add filters to the actual header row (row 5)
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({c: range.s.c, r: 5}, {c: range.e.c, r: 5}) };
}

// New formatting function with better compatibility
function formatSummarySheetNew(worksheet, data) {
    if (!worksheet || !data) return;
    
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Create styles array for the workbook
    if (!worksheet['!cols']) worksheet['!cols'] = [];
    if (!worksheet['!rows']) worksheet['!rows'] = [];
    
    // Apply formatting to each cell
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            
            if (!worksheet[cellAddress]) {
                worksheet[cellAddress] = { t: 's', v: '' };
            }
            
            const cell = worksheet[cellAddress];
            const cellValue = cell.v;
            
            // Title row (row 0) - Dark blue background, white bold text
            if (R === 0) {
                cell.s = {
                    font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "1F4E79" } },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thick", color: { rgb: "000000" } },
                        bottom: { style: "thick", color: { rgb: "000000" } },
                        left: { style: "thick", color: { rgb: "000000" } },
                        right: { style: "thick", color: { rgb: "000000" } }
                    }
                };
            }
            // Header rows (Report Period, Generated on)
            else if (R === 1 || R === 2) {
                if (C === 0) {
                    cell.s = {
                        font: { bold: true, sz: 12 },
                        fill: { fgColor: { rgb: "D9E2F3" } },
                        alignment: { vertical: "center" },
                        border: {
                            top: { style: "thin", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        }
                    };
                } else {
                    cell.s = {
                        border: {
                            top: { style: "thin", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        }
                    };
                }
            }
            // Section headers (Summary Statistics, Payment Methods, Service Popularity)
            else if (cellValue && (cellValue.toString().includes('Summary Statistics') || 
                     cellValue.toString().includes('Payment Methods Breakdown') || 
                     cellValue.toString().includes('Service Popularity'))) {
                cell.s = {
                    font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "4472C4" } },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thick", color: { rgb: "000000" } },
                        bottom: { style: "thick", color: { rgb: "000000" } },
                        left: { style: "thick", color: { rgb: "000000" } },
                        right: { style: "thick", color: { rgb: "000000" } }
                    }
                };
            }
            // Column headers (Metric/Value, Method/Amount/Percentage, Service/Bookings)
            else if (cellValue && (cellValue === 'Metric' || cellValue === 'Value' || 
                     cellValue === 'Method' || cellValue === 'Amount' || cellValue === 'Percentage' ||
                     cellValue === 'Service' || cellValue === 'Bookings')) {
                cell.s = {
                    font: { bold: true, sz: 11 },
                    fill: { fgColor: { rgb: "B4C6E7" } },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };
            }
            // Data rows with values
            else if (cellValue && cellValue.toString().trim() !== '') {
                let alignment = { vertical: "center" };
                
                // Right-align numbers and currency
                if (cellValue.toString().includes('₱') || (!isNaN(cellValue) && cellValue !== '')) {
                    alignment.horizontal = "right";
                }
                
                cell.s = {
                    alignment: alignment,
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };
                
                // Alternate row colors for better readability
                if (R % 2 === 0 && R > 3) {
                    cell.s.fill = { fgColor: { rgb: "F8F9FA" } };
                }
            }
            // Empty cells still get borders
            else {
                cell.s = {
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };
            }
        }
    }
    
    // Merge title cell across all columns
    if (range.e.c > 0) {
        worksheet['!merges'] = worksheet['!merges'] || [];
        worksheet['!merges'].push({
            s: { r: 0, c: 0 },
            e: { r: 0, c: range.e.c }
        });
    }
}

// New data sheet formatting function
function formatDataSheetNew(worksheet, data, sheetName) {
    if (!worksheet || !data) return;
    
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Apply formatting to each cell
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[cellAddress]) continue;
            
            const cell = worksheet[cellAddress];
            const cellValue = cell.v;
            if (cellValue == null) continue;
            
            // Title row (row 0) - special formatting for report title
            if (R === 0) {
                cell.s = {
                    font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "1F4E79" } },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thick", color: { rgb: "000000" } },
                        bottom: { style: "thick", color: { rgb: "000000" } },
                        left: { style: "thick", color: { rgb: "000000" } },
                        right: { style: "thick", color: { rgb: "000000" } }
                    }
                };
            }
            // Header info rows (rows 1-3: Report Period, Generated on, Generated by)
            else if (R >= 1 && R <= 3) {
                if (C === 0) {
                    cell.s = {
                        font: { bold: true, sz: 12 },
                        fill: { fgColor: { rgb: "D9E2F3" } },
                        alignment: { vertical: "center" },
                        border: {
                            top: { style: "thin", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        }
                    };
                } else {
                    cell.s = {
                        border: {
                            top: { style: "thin", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        }
                    };
                }
            }
            // Empty row (row 4)
            else if (R === 4) {
                cell.s = {
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };
            }
            // Actual header row (row 5)
            else if (R === 5) {
                cell.s = {
                    font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "4472C4" } },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };
            }
            // Data rows (starting from row 6)
            else {
                let alignment = { vertical: "center" };

                // Right-align numbers and currency
                if (cellValue.toString().includes('₱') || (!isNaN(cellValue) && cellValue !== '')) {
                    alignment.horizontal = "right";
                }

                cell.s = {
                    alignment: alignment,
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };

                // Alternate row colors for better readability (starting from data rows)
                if ((R - 5) % 2 === 0) { // Adjust for the 6 header rows
                    cell.s.fill = { fgColor: { rgb: "F8F9FA" } };
                }
            }
        }
    }
}

// Generate comprehensive Excel report
function generateComprehensiveReportExcel(transactions, pendingBills, startDate, endDate) {
    const workbook = XLSX.utils.book_new();
    workbook.Props = {
        Title: 'Animates PH Business Report',
        Author: 'Animates PH System',
        CreatedDate: new Date()
    };
    workbook.Workbook = {
        Views: [{ RTL: false }]
    };

    // Get current user name for the report
    const getCurrentUserName = () => {
        if (!currentUser) return 'Unknown User';
        const preferredName = (currentUser.full_name && currentUser.full_name.trim())
            ? currentUser.full_name.trim()
            : ((currentUser.username && currentUser.username.trim())
                ? currentUser.username.trim()
                : (currentUser.email ? currentUser.email.split('@')[0] : 'User'));
        return preferredName;
    };

    const summaryData = buildSummarySheetData('ANIMATES PH - COMPREHENSIVE BUSINESS REPORT', transactions, pendingBills, startDate, endDate);
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Apply formatting to summary sheet
    formatSummarySheetNew(summarySheet, summaryData);
    autoFitColumns(summarySheet, summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Transactions Sheet with header information
    const transactionHeaders = ['Date/Time', 'Transaction Reference', 'Customer Name', 'Pet Name', 'Pet Breed', 'RFID Tag', 'Amount', 'Payment Method', 'Payment Platform', 'Status'];
    const transactionData = [
        ['ANIMATES PH - TRANSACTION DETAILS', '', '', '', '', '', '', '', '', ''],
        ['Report Period', `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`, '', '', '', '', '', '', '', ''],
        ['Generated on', new Date().toLocaleString(), '', '', '', '', '', '', '', ''],
        ['Generated by', getCurrentUserName(), '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', ''],
        transactionHeaders
    ];

    transactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount || 0);
        const amountStr = isNaN(amount) ? '₱0.00' : `₱${amount.toFixed(2)}`;
        transactionData.push([
            new Date(transaction.created_at).toLocaleString(),
            transaction.transaction_reference || '',
            transaction.customer_name || '',
            transaction.pet_name || '',
            transaction.pet_breed || '',
            transaction.rfid_tag || '',
            amountStr,
            transaction.payment_method || '',
            transaction.payment_platform || '',
            transaction.status || ''
        ]);
    });

    const transactionSheet = XLSX.utils.aoa_to_sheet(transactionData);
    formatDataSheetNew(transactionSheet, transactionData, 'Transactions');
    autoFitColumns(transactionSheet, transactionData);
    XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transactions');

    // Pending Bills Sheet with header information
    const pendingHeaders = ['RFID Tag', 'Customer Name', 'Pet Name', 'Pet Breed', 'Total Amount', 'Check-in Time', 'Status', 'Services'];
    const pendingData = [
        ['ANIMATES PH - PENDING BILLS', '', '', '', '', '', '', ''],
        ['Report Period', `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`, '', '', '', '', '', ''],
        ['Generated on', new Date().toLocaleString(), '', '', '', '', '', ''],
        ['Generated by', getCurrentUserName(), '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        pendingHeaders
    ];

    pendingBills.forEach(bill => {
        let parsedServices = '';
        if (bill.services) {
            if (Array.isArray(bill.services)) {
                const serviceNames = bill.services
                    .map(service => {
                        if (typeof service === 'string') {
                            return service.split(' - ₱')[0].trim();
                        }
                        return service && service.name ? service.name : '';
                    })
                    .filter(name => name);
                parsedServices = serviceNames.join(', ');
            } else {
                const services = bill.services.split('; ');
                const cleanServices = services
                    .map(s => s.trim())
                    .filter(s => s.length > 0)
                    .map(s => s.split(' - ₱')[0].trim())
                    .filter(s => s.length > 0);
                parsedServices = cleanServices.join(', ');
            }
        }

        const amount = parseFloat(bill.total_amount || 0);
        const amountStr = isNaN(amount) ? '₱0.00' : `₱${amount.toFixed(2)}`;

        pendingData.push([
            bill.custom_rfid || '',
            bill.customer_name || '',
            bill.pet_name || '',
            bill.pet_breed || '',
            amountStr,
            new Date(bill.check_in_time).toLocaleString(),
            bill.status || '',
            parsedServices
        ]);
    });

    const pendingSheet = XLSX.utils.aoa_to_sheet(pendingData);
    formatDataSheetNew(pendingSheet, pendingData, 'Pending Bills');
    autoFitColumns(pendingSheet, pendingData);
    XLSX.utils.book_append_sheet(workbook, pendingSheet, 'Pending Bills');
    return workbook;
}

// Generate comprehensive Excel-compatible CSV report (Tab-separated for better Excel formatting)
function generateComprehensiveReportCSV(transactions, pendingBills, startDate, endDate) {
    const lines = [];

    // Excel formatting hint - tells Excel to use tab separation
    lines.push('sep=\t');

    // Get current user name for the report
    const getCurrentUserName = () => {
        if (!currentUser) return 'Unknown User';
        const preferredName = (currentUser.full_name && currentUser.full_name.trim())
            ? currentUser.full_name.trim()
            : ((currentUser.username && currentUser.username.trim())
                ? currentUser.username.trim()
                : (currentUser.email ? currentUser.email.split('@')[0] : 'User'));
        return preferredName;
    };

    // Report Header with proper spacing
    lines.push('ANIMATES PH - COMPREHENSIVE BUSINESS REPORT\t\t\t\t\t\t\t\t\t\t');
    lines.push(`Report Period:\t${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\t\t\t\t\t\t\t\t`);
    lines.push(`Generated on:\t${new Date().toLocaleString()}\t\t\t\t\t\t\t\t`);
    lines.push(`Generated by:\t${getCurrentUserName()}\t\t\t\t\t\t\t\t`);
    lines.push('');

    // Summary Statistics Section
    lines.push('SUMMARY STATISTICS\t\t\t\t\t\t\t\t\t\t');
    lines.push('==================\t\t\t\t\t\t\t\t\t\t');

    const totalTransactions = transactions.length;
    const completedTransactions = transactions.filter(t => t.status === 'completed');
    const voidedTransactions = transactions.filter(t => t.status === 'voided');
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const pendingRevenue = pendingBills.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);

    lines.push(`Total Transactions\t${totalTransactions}\t\t\t\t\t\t\t\t\t`);
    lines.push(`Completed Transactions\t${completedTransactions.length}\t\t\t\t\t\t\t\t\t`);
    lines.push(`Voided Transactions\t${voidedTransactions.length}\t\t\t\t\t\t\t\t\t`);
    lines.push(`Total Revenue\t₱${totalRevenue.toFixed(2)}\t\t\t\t\t\t\t\t\t`);
    lines.push(`Pending Bills\t${pendingBills.length}\t\t\t\t\t\t\t\t\t`);
    lines.push(`Pending Revenue\t₱${pendingRevenue.toFixed(2)}\t\t\t\t\t\t\t\t\t`);
    lines.push('');

    // Payment Methods Breakdown
    lines.push('PAYMENT METHODS BREAKDOWN\t\t\t\t\t\t\t\t\t\t');
    lines.push('========================\t\t\t\t\t\t\t\t\t\t');
    lines.push('Method\tAmount\tPercentage\t\t\t\t\t\t\t\t');

    const paymentMethods = {};
    completedTransactions.forEach(t => {
        const method = t.payment_method || 'unknown';
        paymentMethods[method] = (paymentMethods[method] || 0) + parseFloat(t.amount || 0);
    });

    Object.entries(paymentMethods).forEach(([method, amount]) => {
        const percentage = totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(1) : '0.0';
        lines.push(`${method}\t₱${amount.toFixed(2)}\t${percentage}%\t\t\t\t\t\t\t\t`);
    });
    lines.push('');

    // Service Popularity (if available)
    if (pendingBills.length > 0) {
        lines.push('SERVICE POPULARITY\t\t\t\t\t\t\t\t\t\t');
        lines.push('==================\t\t\t\t\t\t\t\t\t\t');
        lines.push('Service\tBookings\t\t\t\t\t\t\t\t\t');

        const serviceCount = {};
        pendingBills.forEach(bill => {
            if (bill.services) {
                const services = bill.services.split('; ');
                services.forEach(service => {
                    if (service.trim()) {
                        const serviceName = service.split(' - ₱')[0].trim();
                        serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;
                    }
                });
            }
        });

        Object.entries(serviceCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .forEach(([service, count]) => {
                lines.push(`${service}\t${count}\t\t\t\t\t\t\t\t\t`);
            });
        lines.push('');
    }

    // Detailed Transactions Section
    lines.push('DETAILED TRANSACTIONS\t\t\t\t\t\t\t\t\t\t');
    lines.push('====================\t\t\t\t\t\t\t\t\t\t');
    lines.push('Date/Time\tTransaction Reference\tCustomer Name\tPet Name\tPet Breed\tRFID Tag\tAmount\tPayment Method\tPayment Platform\tStatus\t');

    transactions.forEach(transaction => {
        const dateTime = new Date(transaction.created_at).toLocaleString();
        const row = [
            dateTime,
            transaction.transaction_reference || '',
            transaction.customer_name || '',
            transaction.pet_name || '',
            transaction.pet_breed || '',
            transaction.rfid_tag || '',
            `₱${parseFloat(transaction.amount || 0).toFixed(2)}`,
            transaction.payment_method || '',
            transaction.payment_platform || '',
            transaction.status || ''
        ];
        lines.push(row.join('\t') + '\t');
    });

    lines.push('');

    // Pending Bills Section
    lines.push('PENDING BILLS\t\t\t\t\t\t\t\t\t');
    lines.push('=============\t\t\t\t\t\t\t\t\t');
    lines.push('RFID Tag\tCustomer Name\tPet Name\tPet Breed\tTotal Amount\tCheck-in Time\tStatus\tServices\t');

    pendingBills.forEach(bill => {
        const checkinTime = new Date(bill.check_in_time).toLocaleString();

        let parsedServices = '';
        if (bill.services) {
            const services = bill.services.split('; ');
            const cleanServices = services
                .map(s => s.trim())
                .filter(s => s.length > 0)
                .map(s => s.split(' - ₱')[0].trim())
                .filter(s => s.length > 0);
            parsedServices = cleanServices.join(', ');
        }

        const row = [
            bill.custom_rfid || '',
            bill.customer_name || '',
            bill.pet_name || '',
            bill.pet_breed || '',
            `₱${parseFloat(bill.total_amount || 0).toFixed(2)}`,
            checkinTime,
            bill.status || '',
            parsedServices || 'No services'
        ];
        lines.push(row.join('\t') + '\t');
    });

    return lines.join('\n');
}


// Generate transaction-only Excel report
function generateTransactionReportExcel(transactions, startDate, endDate) {
    const workbook = XLSX.utils.book_new();

    // Get current user name for the report
    const getCurrentUserName = () => {
        if (!currentUser) return 'Unknown User';
        const preferredName = (currentUser.full_name && currentUser.full_name.trim())
            ? currentUser.full_name.trim()
            : ((currentUser.username && currentUser.username.trim())
                ? currentUser.username.trim()
                : (currentUser.email ? currentUser.email.split('@')[0] : 'User'));
        return preferredName;
    };

    // Transactions Sheet with header information
    const transactionHeaders = ['Date/Time', 'Transaction Reference', 'Customer Name', 'Pet Name', 'Pet Breed', 'RFID Tag', 'Amount', 'Payment Method', 'Payment Platform', 'Status'];
    const transactionData = [
        ['ANIMATES PH - TRANSACTION DETAILS REPORT', '', '', '', '', '', '', '', '', ''],
        ['Report Period', `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`, '', '', '', '', '', '', '', ''],
        ['Generated on', new Date().toLocaleString(), '', '', '', '', '', '', '', ''],
        ['Generated by', getCurrentUserName(), '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', ''],
        transactionHeaders
    ];

    transactions.forEach(transaction => {
        transactionData.push([
            new Date(transaction.created_at).toLocaleString(),
            transaction.transaction_reference || '',
            transaction.customer_name || '',
            transaction.pet_name || '',
            transaction.pet_breed || '',
            transaction.rfid_tag || '',
            `₱${parseFloat(transaction.amount || 0).toFixed(2)}`,
            transaction.payment_method || '',
            transaction.payment_platform || '',
            transaction.status || ''
        ]);
    });

    const transactionSheet = XLSX.utils.aoa_to_sheet(transactionData);
    formatDataSheetNew(transactionSheet, transactionData, 'Transactions');
    autoFitColumns(transactionSheet, transactionData);
    XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transactions');

    return workbook;
}

// Format data sheets (Transactions, Pending Bills)
function formatDataSheet(worksheet, data, sheetName) {
    if (!worksheet || !data) return;
    
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    const thinBorder = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
    };
    
    // Apply formatting to each cell
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[cellAddress]) continue;
            
            const cellValue = worksheet[cellAddress].v;
            if (cellValue == null) continue;
            
            // Header row (row 0)
            if (R === 0) {
                worksheet[cellAddress].s = {
                    font: { bold: true, size: 11, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: '4472C4' } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: thinBorder
                };
            }
            // Data rows
            else {
                worksheet[cellAddress].s = {
                    border: thinBorder,
                    alignment: { vertical: 'center' }
                };
                
                // Right-align numbers and currency
                if (cellValue.toString().includes('₱') || (!isNaN(cellValue) && cellValue !== '')) {
                    worksheet[cellAddress].s.alignment.horizontal = 'right';
                }
                
                // Alternate row colors for better readability
                if (R % 2 === 0) {
                    worksheet[cellAddress].s.fill = { fgColor: { rgb: 'F8F9FA' } };
                }
            }
        }
    }
}

// Generate summary-only Excel report
function generateSummaryReportExcel(transactions, pendingBills, startDate, endDate) {
    const workbook = XLSX.utils.book_new();
    const summaryData = buildSummarySheetData('ANIMATES PH - SUMMARY REPORT', transactions, pendingBills, startDate, endDate);
    const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
    formatSummarySheetNew(worksheet, summaryData);
    autoFitColumns(worksheet, summaryData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary');

    return workbook;
}

// Close modal
function closeModal() {
    document.getElementById('successModal').classList.add('hidden');
    // Reset form
    document.getElementById('billGeneration').classList.add('hidden');
    clearManualForm();
    document.getElementById('paymentReference').value = '';
    document.getElementById('paymentPlatform').value = '';
    document.getElementById('amountTendered').value = '';
    document.getElementById('onlinePaymentReference').classList.add('hidden');
    document.getElementById('onlinePaymentFields').classList.add('hidden');
    document.getElementById('cashPaymentFields').classList.add('hidden');
    document.getElementById('changeDisplay').classList.add('hidden');
    loadStats();
    loadPendingBills();
    loadPaymentProcessing();
}

// Close success modal
document.getElementById('closeSuccessModal')?.addEventListener('click', function() {
    closeModal();
});

// Refresh pending bills
function refreshPendingBills() {
    loadPendingBills();
    showNotification('Pending bills refreshed', 'success');
}

// Auto-refresh pending bills every 30 seconds when section is visible
let pendingBillsRefreshInterval = null;

function startPendingBillsAutoRefresh() {
    if (pendingBillsRefreshInterval) {
        clearInterval(pendingBillsRefreshInterval);
    }
    pendingBillsRefreshInterval = setInterval(() => {
        const pendingSection = document.getElementById('pending-bills');
        if (pendingSection && !pendingSection.classList.contains('hidden')) {
            loadPendingBills();
        }
    }, 30000); // 30 seconds
}

function stopPendingBillsAutoRefresh() {
    if (pendingBillsRefreshInterval) {
        clearInterval(pendingBillsRefreshInterval);
        pendingBillsRefreshInterval = null;
    }
}

// Export pending bills
function exportPendingBills() {
    try {
        // Show loading notification
        showNotification('Preparing export...', 'info');
        
        // Create download link
        const exportUrl = `${API_BASE}billing.php?action=export_pending_bills`;
        const link = document.createElement('a');
        link.href = exportUrl;
        link.download = `pending_bills_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success notification
        showNotification('Export completed successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting pending bills:', error);
        showNotification('Failed to export pending bills', 'error');
    }
}

// ===== PENDING BILLS SEARCH, FILTER, AND SORT FUNCTIONS =====

// Apply filters and sorting to pending bills
function applyPendingBillsFilters() {
    const searchTerm = document.getElementById('pendingBillsSearch')?.value?.toLowerCase() || '';
    const statusFilter = document.getElementById('pendingBillsStatusFilter')?.value || '';
    const petTypeFilter = document.getElementById('pendingBillsPetTypeFilter')?.value || '';
    const sortOption = document.getElementById('pendingBillsSort')?.value || 'check_in_time_asc';
    
    // Filter bills
    filteredPendingBills = currentPendingBills.filter(bill => {
        const matchesSearch = !searchTerm || 
            bill.pet_name.toLowerCase().includes(searchTerm) ||
            bill.custom_rfid.toLowerCase().includes(searchTerm) ||
            bill.customer_name.toLowerCase().includes(searchTerm) ||
            bill.pet_breed.toLowerCase().includes(searchTerm);
        
        const matchesStatus = !statusFilter || bill.status === statusFilter;
        const matchesPetType = !petTypeFilter || bill.pet_type === petTypeFilter;
        
        return matchesSearch && matchesStatus && matchesPetType;
    });
    
    // Sort bills
    sortPendingBills(sortOption);
    
    // Reset to first page
    currentPendingBillsPage = 1;
}

// Sort pending bills based on selected option
function sortPendingBills(sortOption) {
    switch (sortOption) {
        case 'check_in_time_asc':
            filteredPendingBills.sort((a, b) => new Date(a.check_in_time) - new Date(b.check_in_time));
            break;
        case 'check_in_time_desc':
            filteredPendingBills.sort((a, b) => new Date(b.check_in_time) - new Date(a.check_in_time));
            break;
        case 'total_amount_desc':
            filteredPendingBills.sort((a, b) => parseFloat(b.total_amount) - parseFloat(a.total_amount));
            break;
        case 'total_amount_asc':
            filteredPendingBills.sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount));
            break;
        case 'pet_name_asc':
            filteredPendingBills.sort((a, b) => a.pet_name.localeCompare(b.pet_name));
            break;
        case 'customer_name_asc':
            filteredPendingBills.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
            break;
        default:
            filteredPendingBills.sort((a, b) => new Date(a.check_in_time) - new Date(b.check_in_time));
    }
}

// Display pending bills with pagination
function displayPendingBills() {
    if (!filteredPendingBills || filteredPendingBills.length === 0) {
        return '<div class="text-center py-8 text-gray-500">No pending bills match your search criteria</div>';
    }
    
    // Pagination
    const totalPages = Math.ceil(filteredPendingBills.length / pendingBillsPerPage);
    const startIndex = (currentPendingBillsPage - 1) * pendingBillsPerPage;
    const endIndex = startIndex + pendingBillsPerPage;
    const pageBills = filteredPendingBills.slice(startIndex, endIndex);
    
    // Create bills HTML
    const billsHTML = pageBills.map(bill => {
        const statusColor = getStatusColor(bill.status);
        const timeInfo = getTimeInfo(bill);
        const petIcon = bill.pet_type === 'cat' ? '🐱' : '🐕';
        const petSize = bill.pet_size ? ` (${bill.pet_size})` : '';
        const phoneDisplay = bill.customer_phone ? bill.customer_phone : 'No phone';
        const emailDisplay = bill.customer_email ? bill.customer_email : 'No email';
        
        // Get search term for highlighting
        const searchTerm = document.getElementById('pendingBillsSearch')?.value || '';
        
        return `
            <div class="border border-${statusColor.border} bg-${statusColor.bg} rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                    <div class="flex items-start space-x-3 flex-1">
                        <div class="w-12 h-12 bg-${statusColor.icon} rounded-full flex items-center justify-center text-${statusColor.text} text-xl">
                            ${petIcon}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center space-x-2 mb-2">
                                <h3 class="font-semibold text-gray-900 text-base">${highlightSearchTerm(bill.pet_name, searchTerm)} (${highlightSearchTerm(bill.pet_breed, searchTerm)})${petSize}</h3>
                                <span class="px-3 py-1 bg-${statusColor.badge} text-${statusColor.badgeText} rounded-full text-xs font-medium">${formatStatus(bill.status)}</span>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div>
                                    <p class="text-gray-600"><span class="font-medium">Owner:</span> ${highlightSearchTerm(bill.customer_name, searchTerm)}</p>
                                    <p class="text-gray-600"><span class="font-medium">Phone:</span> ${phoneDisplay}</p>
                                    <p class="text-gray-600"><span class="font-medium">Email:</span> ${emailDisplay}</p>
                                </div>
                                <div>
                                    <p class="text-gray-600"><span class="font-medium">RFID:</span> <span class="font-mono bg-gray-100 px-2 py-1 rounded">${highlightSearchTerm(bill.custom_rfid, searchTerm)}</span></p>
                                    <p class="text-gray-600"><span class="font-medium">Booking ID:</span> #${bill.booking_id}</p>
                                    <p class="text-gray-600"><span class="font-medium">Services:</span></p>
                                </div>
                            </div>
                            <div class="mt-2">
                                <p class="text-xs text-gray-700 bg-gray-50 px-3 py-2 rounded border-l-4 border-${statusColor.border}">${bill.services || 'Standard Package'}</p>
                            </div>
                            <div class="mt-2">
                                <p class="text-xs text-gray-500">${timeInfo}</p>
                            </div>
                        </div>
                    </div>
                    <div class="text-right ml-4">
                        <div class="bg-white rounded-lg p-3 border border-gray-200">
                            <p class="text-2xl font-bold text-gray-900">₱${parseFloat(bill.total_amount).toFixed(2)}</p>
                            <p class="text-xs text-gray-500 mb-2">Total Amount</p>
                            <div class="flex flex-col space-y-2">
                                ${bill.status === 'completed' ? 
                                    `<button onclick="generateBillFromPending('${bill.custom_rfid}')" class="bg-gold-500 hover:bg-gold-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors shadow-sm">
                                        <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                        </svg>
                                        Generate Bill
                                    </button>` :
                                    `<div class="px-3 py-2 bg-gray-100 text-gray-500 rounded text-sm font-medium">
                                        ${formatStatus(bill.status)}
                                    </div>`
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add pagination controls if needed
    let paginationHTML = '';
    if (totalPages > 1) {
        paginationHTML = `
            <div class="bg-white rounded-lg border border-gray-200 p-4 mt-4">
                <div class="flex items-center justify-between">
                    <div class="text-sm text-gray-700">
                        Showing ${startIndex + 1} to ${Math.min(endIndex, filteredPendingBills.length)} of ${filteredPendingBills.length} results
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="previousPendingBillsPage()" 
                                class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                ${currentPendingBillsPage === 1 ? 'disabled' : ''}>
                            Previous
                        </button>
                        <span class="px-3 py-2 text-sm text-gray-700">
                            Page ${currentPendingBillsPage} of ${totalPages}
                        </span>
                        <button onclick="nextPendingBillsPage()" 
                                class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                ${currentPendingBillsPage === totalPages ? 'disabled' : ''}>
                            Next
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    return billsHTML + paginationHTML;
}

// Pagination functions for pending bills
function previousPendingBillsPage() {
    if (currentPendingBillsPage > 1) {
        currentPendingBillsPage--;
        updatePendingBillsDisplay();
    }
}

function nextPendingBillsPage() {
    const totalPages = Math.ceil(filteredPendingBills.length / pendingBillsPerPage);
    if (currentPendingBillsPage < totalPages) {
        currentPendingBillsPage++;
        updatePendingBillsDisplay();
    }
}

// Update pending bills display without reloading the entire section
function updatePendingBillsDisplay() {
    const container = document.getElementById('pendingBillsContainer');
    if (container) {
        // Keep the summary header, only update the bills section
        const summarySection = container.querySelector('.bg-white.rounded-lg.border.border-gray-200.p-4.mb-6');
        if (summarySection) {
            container.innerHTML = summarySection.outerHTML + displayPendingBills();
        }
    }
}

// Add event listeners for pending bills search and filters
function addPendingBillsEventListeners() {
    // Search input
    const searchInput = document.getElementById('pendingBillsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            applyPendingBillsFilters();
            updatePendingBillsDisplay();
        }, 300));
    }
    
    // Status filter
    const statusFilter = document.getElementById('pendingBillsStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            applyPendingBillsFilters();
            updatePendingBillsDisplay();
        });
    }
    
    // Pet type filter
    const petTypeFilter = document.getElementById('pendingBillsPetTypeFilter');
    if (petTypeFilter) {
        petTypeFilter.addEventListener('change', () => {
            applyPendingBillsFilters();
            updatePendingBillsDisplay();
        });
    }
    
    // Sort options
    const sortSelect = document.getElementById('pendingBillsSort');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            applyPendingBillsFilters();
            updatePendingBillsDisplay();
        });
    }
}

// Clear all pending bills filters and reset search
function clearPendingBillsFilters() {
    // Reset form elements
    const searchInput = document.getElementById('pendingBillsSearch');
    const statusFilter = document.getElementById('pendingBillsStatusFilter');
    const petTypeFilter = document.getElementById('pendingBillsPetTypeFilter');
    const sortSelect = document.getElementById('pendingBillsSort');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = '';
    if (petTypeFilter) petTypeFilter.value = '';
    if (sortSelect) sortSelect.value = 'check_in_time_asc';
    
    // Reset filters and display
    applyPendingBillsFilters();
    updatePendingBillsDisplay();
    
    // Show notification
    showNotification('All filters cleared', 'success');
}

// Debounce function to limit API calls during search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Highlight search terms in text
function highlightSearchTerm(text, searchTerm) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    
    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-4 py-2 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300 text-sm`;
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

// ===== TRANSACTION MANAGEMENT FUNCTIONS =====

// Global variables for transactions
let currentTransactions = [];
let currentPage = 1;
const transactionsPerPage = 10;

// Global variables for pending bills
let currentPendingBills = [];
let filteredPendingBills = [];
let currentPendingBillsPage = 1;
const pendingBillsPerPage = 20;

// Load transactions from database
async function loadTransactions() {
    try {
        // Show loading state
        const tableBody = document.getElementById('transactionsTable');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">Loading transactions...</td></tr>';
        }
        
        const response = await fetch(`${API_BASE}billing.php?action=get_transactions`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        if (data.success) {
            if (data.transactions && Array.isArray(data.transactions)) {
                // Show all transactions (no deduplication needed)
                currentTransactions = data.transactions;
                displayTransactions();
                
                if (currentTransactions.length === 0) {
                    showNotification('No transactions found', 'info');
                }
            } else {
                throw new Error('Invalid transactions data received from server');
            }
        } else {
            const errorMessage = data.message || 'Unknown error occurred';
            showNotification('Failed to load transactions: ' + errorMessage, 'error');
            console.error('API Error:', data);
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
        const errorMessage = error.message || 'Network or parsing error';
        showNotification('Failed to load transactions: ' + errorMessage, 'error');
    }
}

// Display transactions in table
function displayTransactions() {
    const tableBody = document.getElementById('transactionsTable');
    const searchTerm = document.getElementById('transactionSearch').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    // Filter transactions
    let filteredTransactions = currentTransactions.filter(transaction => {
        const matchesSearch = !searchTerm ||
            transaction.customer_name.toLowerCase().includes(searchTerm) ||
            transaction.pet_name.toLowerCase().includes(searchTerm) ||
            transaction.rfid_tag.toLowerCase().includes(searchTerm);

        const matchesStatus = !statusFilter || statusFilter === 'all' || transaction.status === statusFilter;
        const matchesDate = filterByDate(transaction.created_at, dateFilter);

        return matchesSearch && matchesStatus && matchesDate;
    });
    
    // Pagination
    const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);
    const startIndex = (currentPage - 1) * transactionsPerPage;
    const endIndex = startIndex + transactionsPerPage;
    const pageTransactions = filteredTransactions.slice(startIndex, endIndex);
    
    // Update pagination info
    document.getElementById('showingFrom').textContent = startIndex + 1;
    document.getElementById('showingTo').textContent = Math.min(endIndex, filteredTransactions.length);
    document.getElementById('totalTransactions').textContent = filteredTransactions.length;
    
    // Update pagination buttons
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
    
    // Clear table
    tableBody.innerHTML = '';
    
    // Check if there are transactions to display
    if (pageTransactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">No transactions found</td></tr>';
        return;
    }
    
    // Populate table
    pageTransactions.forEach(transaction => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 cursor-pointer';
        row.onclick = () => openReceiptModal(transaction.booking_id);
        
        const statusClass = getStatusClass(transaction.status);
        const statusText = getStatusText(transaction.status);
        
        row.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-900">
                ${formatDateTime(transaction.created_at)}
            </td>
            <td class="px-4 py-3 text-sm text-gray-900">
                ${transaction.customer_name}
            </td>
            <td class="px-4 py-3 text-sm text-gray-900">
                ${transaction.pet_name} (${transaction.pet_breed})
            </td>
            <td class="px-4 py-3 text-sm text-gray-900 font-mono">
                ${transaction.rfid_tag}
            </td>
            <td class="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                ₱${parseFloat(transaction.amount).toFixed(2)}
            </td>
            <td class="px-4 py-3 text-sm text-center text-gray-900">
                ${transaction.payment_method}
            </td>
            <td class="px-4 py-3 text-center">
                <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">
                    ${statusText}
                </span>
            </td>
            <td class="px-4 py-3 text-center">
                ${transaction.status === 'completed' ? 
                    `<button onclick="event.stopPropagation(); voidTransaction(${transaction.id})" 
                             class="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">Void</button>` : 
                    '<span class="text-gray-400 text-xs">-</span>'
                }
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Filter transactions by date
function filterByDate(transactionDate, filterType) {
    const date = new Date(transactionDate);
    const now = new Date();
    
    switch (filterType) {
        case 'today':
            return date.toDateString() === now.toDateString();
        case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return date >= weekAgo;
        case 'month':
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        case 'all':
        default:
            return true;
    }
}

// Get status styling class
function getStatusClass(status) {
    switch (status) {
        case 'completed':
            return 'bg-green-100 text-green-800';
        case 'voided':
            return 'bg-red-100 text-red-800';
        case 'refunded':
            return 'bg-yellow-100 text-yellow-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

// Get status display text
function getStatusText(status) {
    switch (status) {
        case 'completed':
            return 'Completed';
        case 'voided':
            return 'Voided';
        case 'refunded':
            return 'Refunded';
        default:
            return 'Unknown';
    }
}

// Format date and time
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Void transaction
function voidTransaction(transactionId) {
    const transaction = currentTransactions.find(t => t.id === transactionId);
    if (!transaction) {
        showNotification('Transaction not found', 'error');
        return;
    }
    
    // Populate void modal
    document.getElementById('voidCustomerName').textContent = transaction.customer_name;
    document.getElementById('voidAmount').textContent = '₱' + parseFloat(transaction.amount).toFixed(2);
    document.getElementById('voidDate').textContent = formatDateTime(transaction.created_at);
    document.getElementById('voidTransactionId').textContent = transaction.transaction_reference;
    
    // Store transaction ID for void operation
    window.currentVoidTransactionId = transactionId;
    
    // Show modal
    document.getElementById('voidModal').classList.remove('hidden');
}

// Close void modal
function closeVoidModal() {
    document.getElementById('voidModal').classList.add('hidden');
    document.getElementById('voidForm').reset();
    window.currentVoidTransactionId = null;
}

// Handle void form submission
async function handleVoidSubmission(event) {
    event.preventDefault();
    
    const reason = document.getElementById('voidReason').value;
    const notes = document.getElementById('voidNotes').value;
    
    if (!reason) {
        showNotification('Please select a reason for voiding', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}billing.php?action=void_transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transaction_id: window.currentVoidTransactionId,
                reason: reason,
                notes: notes
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Transaction voided successfully', 'success');
            closeVoidModal();
            
            // Refresh the transactions list and stats
            await loadTransactions();
            await loadStats();
            
            // Switch to voided transactions section to show the newly voided transaction
            showSection('voided-transactions');
            await loadVoidedTransactions();
        } else {
            const errorMessage = data.message || 'Unknown error occurred';
            showNotification('Failed to void transaction: ' + errorMessage, 'error');
            console.error('API Error:', data);
        }
    } catch (error) {
        console.error('Error voiding transaction:', error);
        const errorMessage = error.message || 'Network or parsing error';
        showNotification('Failed to void transaction: ' + errorMessage, 'error');
    }
}

// Pagination functions
function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        displayTransactions();
    }
}

function nextPage() {
    const totalPages = Math.ceil(currentTransactions.length / transactionsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayTransactions();
    }
}

// Refresh transactions
function refreshTransactions() {
    loadTransactions();
    showNotification('Transactions refreshed', 'success');
}

// Export transactions
function exportTransactions() {
    try {
        // Show loading notification
        showNotification('Preparing export...', 'info');
        
        // Create download link
        const exportUrl = `${API_BASE}billing.php?action=export_transactions`;
        const link = document.createElement('a');
        link.href = exportUrl;
        link.download = `transactions_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success notification
        showNotification('Export completed successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting transactions:', error);
        showNotification('Failed to export transactions', 'error');
    }
}

// Export transactions to Excel (auto-fit columns)
function exportTransactionsExcel() {
    try {
        showNotification('Preparing Excel export...', 'info');
        const exportUrl = `${API_BASE}billing.php?action=export_transactions_excel`;
        const link = document.createElement('a');
        link.href = exportUrl;
        link.download = `transactions_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('Excel export started', 'success');
    } catch (error) {
        console.error('Error exporting transactions (Excel):', error);
        showNotification('Failed to export transactions (Excel)', 'error');
    }
}

// Event listeners for transaction management
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners for search and filters
    document.getElementById('transactionSearch')?.addEventListener('input', function() {
        currentPage = 1; // Reset to first page
        displayTransactions();
    });
    
    document.getElementById('statusFilter')?.addEventListener('change', function() {
        currentPage = 1; // Reset to first page
        displayTransactions();
    });
    
    document.getElementById('dateFilter')?.addEventListener('change', function() {
        currentPage = 1; // Reset to first page
        displayTransactions();
    });
    
    // Add void form submission handler
    document.getElementById('voidForm')?.addEventListener('submit', handleVoidSubmission);

    // Add report form submission handler
    document.getElementById('reportForm')?.addEventListener('submit', handleReportSubmission);

    // Add report type change handler for auto-preview
    document.getElementById('reportType')?.addEventListener('change', () => {
        const dateRange = document.getElementById('reportDateRange').value;
        if (dateRange && dateRange !== 'custom') {
            autoGeneratePreview();
        }
    });
});

function openReceiptModal(bookingId) {
    if (!bookingId) return;
    const modal = document.getElementById('receiptModal');
    const frame = document.getElementById('receiptFrame');
    frame.dataset.bookingId = bookingId;
    // Show receipt exactly as standalone page would render (no scaling)
    frame.dataset.scale = '1';
    frame.style.transform = 'none';
    frame.style.width = '100%';
    frame.style.height = '100%';
    frame.onload = () => {
        try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            // Allow the iframe to scroll exactly like a standalone page
            doc.body.style.overflow = 'auto';
            doc.documentElement.style.overflow = 'auto';
            // Hide thank-you section and print button when embedded in modal
            try {
                const thankYou = doc.querySelector('.thank-you');
                if (thankYou) thankYou.style.display = 'none';
                const printBtnSection = doc.querySelector('.no-print');
                if (printBtnSection) printBtnSection.style.display = 'none';
            } catch (_) {}
        } catch (e) {
            // Cross-origin safety: ignore
        }
    };
    // Load printable page in embed mode to hide modal-only footer/print
    frame.src = `${API_BASE}billing.php?action=print_receipt&booking_id=${encodeURIComponent(bookingId)}&embed=1`;
    modal.classList.remove('hidden');
}

function closeReceiptModal() {
    const modal = document.getElementById('receiptModal');
    const frame = document.getElementById('receiptFrame');
    frame.src = 'about:blank';
    modal.classList.add('hidden');
}

// zoomReceipt removed per request (fixed real-size view)

function openReceiptNewTab() {
    // Deprecated: opening in new tab removed; modal shows same printable layout embedded
}

function printReceiptFromModal() {
    const frame = document.getElementById('receiptFrame');
    try {
        if (frame && frame.contentWindow) {
            frame.contentWindow.focus();
            frame.contentWindow.print();
        } else {
            throw new Error('No frame contentWindow');
        }
    } catch (e) {
        console.warn('Unable to print from iframe:', e);
        // Fallback: open standalone receipt without embed flag
        try {
            const src = frame ? frame.getAttribute('src') : '';
            if (src && src !== 'about:blank') {
                const standalone = src.replace(/([&?])embed=1(&|$)/, '$1').replace(/[&?]$/, '');
                window.open(standalone, '_blank');
            }
        } catch (_) {}
    }
}

// Fit-to-container logic removed to mirror standalone receipt exactly

// Load voided transactions
async function loadVoidedTransactions() {
    try {
        const container = document.getElementById('voidedTransactionsTable');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">Loading voided transactions...</td></tr>';
        
        const response = await fetch(`${API_BASE}billing.php?action=get_voided_transactions`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.transactions) {
            if (data.transactions.length === 0) {
                container.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">No voided transactions found</td></tr>';
                return;
            }
            
            const tbody = container;
            tbody.innerHTML = '';
            
            data.transactions.forEach(transaction => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50';
                
                const voidedAt = new Date(transaction.voided_at);
                const createdAt = new Date(transaction.created_at);
                
                row.innerHTML = `
                    <td class="px-4 py-3 text-sm text-gray-900">
                        <div>${createdAt.toLocaleDateString()}</div>
                        <div class="text-xs text-gray-500">${createdAt.toLocaleTimeString()}</div>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-900">${transaction.customer_name || 'N/A'}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">
                        <div>${transaction.pet_name || 'N/A'}</div>
                        <div class="text-xs text-gray-500">${transaction.pet_breed || ''}</div>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-900 font-mono">${transaction.rfid_tag || 'N/A'}</td>
                    <td class="px-4 py-3 text-sm text-gray-900 text-right">₱${parseFloat(transaction.amount).toFixed(2)}</td>
                    <td class="px-4 py-3 text-sm text-gray-900 text-center">
                        <span class="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                            ${transaction.payment_method || 'N/A'}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title="${transaction.void_reason || 'No reason provided'}">
                        ${transaction.void_reason || 'No reason provided'}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-900 text-center">
                        <div class="flex flex-col items-center gap-2">
                            <div>
                                <div>${voidedAt.toLocaleDateString()}</div>
                                <div class="text-xs text-gray-500">${voidedAt.toLocaleTimeString()}</div>
                            </div>
                            <button onclick="restoreTransaction(${transaction.id})" 
                                    class="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors">
                                Restore
                            </button>
                        </div>
                    </td>
                `;
                
                tbody.appendChild(row);
            });
        } else {
            container.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-red-500">Failed to load voided transactions</td></tr>';
        }
    } catch (error) {
        console.error('Error loading voided transactions:', error);
        const container = document.getElementById('voidedTransactionsTable');
        if (container) {
            container.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-red-500">Error loading voided transactions</td></tr>';
        }
    }
}

// Export voided transactions
async function exportVoidedTransactions() {
    try {
        const response = await fetch(`${API_BASE}billing.php?action=get_voided_transactions`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success || !data.transactions) {
            throw new Error('No voided transactions data available');
        }
        
        // Create CSV content
        const headers = ['Date/Time', 'Customer', 'Pet', 'RFID', 'Amount', 'Payment Method', 'Reason', 'Voided At'];
        // Escape all data to prevent Excel formula errors
        const escapeCSV = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;

        const csvContent = [
            headers.join(','),
            ...data.transactions.map(t => [
                escapeCSV(new Date(t.created_at).toLocaleString()),
                escapeCSV(t.customer_name || 'N/A'),
                escapeCSV(t.pet_name || 'N/A'),
                escapeCSV(t.rfid_tag || 'N/A'),
                t.amount,
                escapeCSV(t.payment_method || 'N/A'),
                escapeCSV(t.void_reason || 'No reason provided'),
                escapeCSV(new Date(t.voided_at).toLocaleString())
            ].join(','))
        ].join('\n');
        
        // Download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `voided_transactions_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Voided transactions exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting voided transactions:', error);
        showNotification('Failed to export voided transactions', 'error');
    }
}

// Restore a voided transaction
async function restoreTransaction(transactionId) {
    if (!confirm('Are you sure you want to restore this transaction? This will change its status back to completed.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}billing.php?action=restore_transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transaction_id: transactionId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
            showNotification('Transaction restored successfully', 'success');

            // Refresh the voided transactions list and stats
            await loadVoidedTransactions();
            await loadStats();

            // Switch back to recent transactions to show the restored transaction
            showSection('recent-transactions');
            await loadTransactions();
        } else {
            showNotification(data.message || 'Failed to restore transaction', 'error');
        }
    } catch (error) {
        console.error('Error restoring transaction:', error);
        showNotification('Failed to restore transaction', 'error');
    }
}

// Apply Excel formatting to workbook
function applyExcelFormatting(workbook) {
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const range = XLSX.utils.decode_range(worksheet['!ref']);

        // Set column widths (auto-fit)
        const colWidths = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
            let maxWidth = 12; // minimum width
            for (let R = range.s.r; R <= range.e.r; ++R) {
                const cell_address = XLSX.utils.encode_cell({c: C, r: R});
                const cell = worksheet[cell_address];
                if (cell && cell.v) {
                    const cellValue = cell.v.toString();
                    maxWidth = Math.max(maxWidth, cellValue.length);
                }
            }
            colWidths.push({wch: Math.min(maxWidth + 3, 60)}); // max 60 chars, more padding
        }
        worksheet['!cols'] = colWidths;

        // Define border style
        const borderStyle = {
            top: {style: "medium", color: {rgb: "000000"}},
            bottom: {style: "thin", color: {rgb: "000000"}},
            left: {style: "thin", color: {rgb: "000000"}},
            right: {style: "thin", color: {rgb: "000000"}}
        };

        const headerBorderStyle = {
            top: {style: "medium", color: {rgb: "000000"}},
            bottom: {style: "medium", color: {rgb: "000000"}},
            left: {style: "medium", color: {rgb: "000000"}},
            right: {style: "medium", color: {rgb: "000000"}}
        };

        // Apply header formatting (first row of each sheet)
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const headerCell = XLSX.utils.encode_cell({c: C, r: range.s.r});
            if (worksheet[headerCell]) {
                worksheet[headerCell].s = {
                    font: {bold: true, sz: 12, color: {rgb: "000000"}}, // Black text for better contrast
                    fill: {fgColor: {rgb: "D4AF37"}}, // Gold background to match theme
                    alignment: {horizontal: "center", vertical: "center", wrapText: true},
                    border: headerBorderStyle
                };
            }
        }

        // Apply formatting to data rows
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({c: C, r: R});
                const cell = worksheet[cell_address];
                if (cell) {
                    let cellStyle = {border: borderStyle, alignment: {wrapText: true}};

                    // Right-align amount columns (containing ₱ or numbers)
                    if (cell.v && (typeof cell.v === 'string' && cell.v.startsWith('₱') || typeof cell.v === 'number')) {
                        cellStyle.alignment = {horizontal: "right", wrapText: true};
                    }
                    // Center-align status columns
                    else if (C === range.e.c && cell.v && ['completed', 'voided', 'pending', 'cancelled'].includes(cell.v.toLowerCase())) {
                        cellStyle.alignment = {horizontal: "center", wrapText: true};
                    }

                    // Alternate row colors for better readability (subtle gray)
                    if (R % 2 === 1) { // Odd rows (data rows start from index 1)
                        cellStyle.fill = {fgColor: {rgb: "F8FAFC"}}; // Very light gray
                    }

                    cell.s = cellStyle;
                }
            }
        }

        // Freeze header row
        worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

        // Add filters to header row
        worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(range.s, {c: range.e.c, r: range.s.r}) };
    });
}