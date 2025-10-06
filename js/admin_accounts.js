(() => {
  const filterRole = document.getElementById('filterRole');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnNew = document.getElementById('btnNew');
  const btnArchives = document.getElementById('btnArchives');
  const dlg = document.getElementById('dlg');
  const frm = document.getElementById('frm');
  const roleSel = document.getElementById('role');
  const staffRoleSel = null; // removed
  const btnCancel = document.getElementById('btnCancel');
  const totalUsersEl = document.getElementById('totalUsers');
  const activeUsersEl = document.getElementById('activeUsers');

  // Archives state
  let showArchives = false;

  // Store all users for static stats
  let allUsers = [];

  // Edit modal elements
  const editUserModal = document.getElementById('editUserModal');
  const editUserForm = document.getElementById('editUserForm');
  const editUserId = document.getElementById('editUserId');
  const editFirstName = document.getElementById('editFirstName');
  const editLastName = document.getElementById('editLastName');
  const editBirthdate = document.getElementById('editBirthdate');
  const editEmail = document.getElementById('editEmail');
  const editPhone = document.getElementById('editPhone');
  const editAddress = document.getElementById('editAddress');
  const editUserCancel = document.getElementById('editUserCancel');

  // View modal elements
  const viewUserModal = document.getElementById('viewUserModal');
  const viewUserId = document.getElementById('viewUserId');
  const viewFirstName = document.getElementById('viewFirstName');
  const viewLastName = document.getElementById('viewLastName');
  const viewBirthdate = document.getElementById('viewBirthdate');
  const viewEmail = document.getElementById('viewEmail');
  const viewPhone = document.getElementById('viewPhone');
  const viewAddress = document.getElementById('viewAddress');
  const viewUserClose = document.getElementById('viewUserClose');

  // Update user confirmation modal
  const updateUserModal = document.getElementById('updateUserModal');

  // Toggle user status modal elements
  const toggleUserModal = document.getElementById('toggleUserModal');
  const toggleUserIcon = document.getElementById('toggleUserIcon');
  const toggleUserTitle = document.getElementById('toggleUserTitle');
  const toggleUserMessage = document.getElementById('toggleUserMessage');

  // Store toggle user data
  let pendingToggleData = null;

  // Notification modal elements
  const notificationModal = document.getElementById('notificationModal');
  const notificationIcon = document.getElementById('notificationIcon');
  const notificationTitle = document.getElementById('notificationTitle');
  const notificationMessage = document.getElementById('notificationMessage');

  const token = localStorage.getItem('auth_token');
  if (!token) { window.location.href = 'admin_staff_auth.html'; return; }

  function authFetch(body) {
    return fetch('http://localhost/animates/api/auth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    }).then(r => r.json().then(j => ({ ok: r.ok, data: j }))).then(({ ok, data }) => {
      if (!ok || !data.success) throw new Error(data.error || 'Request failed');
      return data;
    });
  }

  function updateStats(users) {
    // Calculate new 3-category statistics
    const stats = {
      staffAdmin: users.filter(u => ['admin', 'manager', 'cashier', 'staff', 'stock_controller'].includes(u.role)).length,
      customer: users.filter(u => u.role === 'customer').length,
      archived: users.filter(u => !u.is_active).length
    };

    // Update the display elements
    document.getElementById('staffAdminUsers').textContent = stats.staffAdmin;
    document.getElementById('customerUsers').textContent = stats.customer;
    document.getElementById('archivedUsers').textContent = stats.archived;
  }

  function getRoleBadge(role, staffRole, isActive) {
    const baseClasses = 'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium';

    if (!isActive) {
      // Show actual role for archived users instead of "Inactive"
      let archivedBadgeClasses = '';
      let archivedIcon = '';

      switch (role) {
        case 'admin':
          archivedBadgeClasses = 'bg-purple-100 text-purple-700 border border-purple-200';
          archivedIcon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>';
          break;
        case 'manager':
          archivedBadgeClasses = 'bg-indigo-100 text-indigo-700 border border-indigo-200';
          archivedIcon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>';
          break;
        case 'cashier':
          archivedBadgeClasses = 'bg-orange-100 text-orange-700 border border-orange-200';
          archivedIcon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>';
          break;
        case 'staff':
          archivedBadgeClasses = 'bg-blue-100 text-blue-700 border border-blue-200';
          archivedIcon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>';
          break;
        case 'stock_controller':
          archivedBadgeClasses = 'bg-teal-100 text-teal-700 border border-teal-200';
          archivedIcon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>';
          break;
        case 'customer':
          archivedBadgeClasses = 'bg-green-100 text-green-700 border border-green-200';
          archivedIcon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
          break;
        default:
          archivedBadgeClasses = 'bg-gray-100 text-gray-700 border border-gray-200';
          archivedIcon = '';
      }

      return `<span class="${baseClasses} ${archivedBadgeClasses}">${archivedIcon} ${role} (Archived)</span>`;
    }

    let badgeClasses = '';
    let icon = '';

    switch (role) {
      case 'admin':
        badgeClasses = 'bg-purple-100 text-purple-700 border border-purple-200';
        icon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>';
        break;
      case 'manager':
        badgeClasses = 'bg-indigo-100 text-indigo-700 border border-indigo-200';
        icon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>';
        break;
      case 'cashier':
        badgeClasses = 'bg-orange-100 text-orange-700 border border-orange-200';
        icon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>';
        break;
      case 'staff':
        badgeClasses = 'bg-blue-100 text-blue-700 border border-blue-200';
        icon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>';
        break;
      case 'stock_controller':
        badgeClasses = 'bg-teal-100 text-teal-700 border border-teal-200';
        icon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>';
        break;
      case 'customer':
        badgeClasses = 'bg-green-100 text-green-700 border border-green-200';
        icon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
        break;
    }

    let badge = `<span class="${baseClasses} ${badgeClasses}">${icon} ${role}`;
    if (staffRole) {
      badge += ` · ${staffRole}`;
    }
    badge += '</span>';

    return badge;
  }

  function render(users, staffFilter = undefined) {
    const staffContainer = document.getElementById('staff-users-container');
    const customerContainer = document.getElementById('customer-users-container');
    const archivedStaffContainer = document.getElementById('archived-staff-users-container');
    const archivedCustomerContainer = document.getElementById('archived-customer-users-container');
    const archivesSection = document.getElementById('archivesSection');

    // Clear containers
    staffContainer.innerHTML = '';
    customerContainer.innerHTML = '';
    archivedStaffContainer.innerHTML = '';
    archivedCustomerContainer.innerHTML = '';

    if (users.length === 0) {
      staffContainer.innerHTML = `
        <div class="bg-white/90 backdrop-blur-sm rounded-2xl card-shadow border border-gold-100/50 p-8 text-center">
          <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          <p class="text-lg font-medium text-gray-500">No users found</p>
          <p class="text-sm text-gray-400">Try adjusting your filters or create a new user</p>
        </div>
      `;
      return;
    }

    // Separate users by role and active status
    const activeUsers = users.filter(u => u.is_active);
    const archivedUsers = users.filter(u => !u.is_active);

    // Apply filter to staff/admin users only
    let staffUsers = activeUsers.filter(u => ['admin', 'manager', 'cashier', 'staff', 'stock_controller'].includes(u.role));
    if (staffFilter) {
      staffUsers = staffUsers.filter(u => u.role === staffFilter);
    }
    const customerUsers = activeUsers.filter(u => u.role === 'customer');
    const archivedStaffUsers = archivedUsers.filter(u => ['admin', 'manager', 'cashier', 'staff', 'stock_controller'].includes(u.role));
    const archivedCustomerUsers = archivedUsers.filter(u => u.role === 'customer');

    // Render staff/admin section in left column
    if (staffUsers.length > 0) {
      const staffSection = document.createElement('div');
      staffSection.innerHTML = `
        <div class="bg-white/90 backdrop-blur-sm rounded-2xl card-shadow border border-gold-100/50 p-6">
          <div class="flex items-center mb-6">
            <div class="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full mr-4">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900">Staff & Admin Users</h3>
              <p class="text-sm text-gray-600">${staffUsers.length} user${staffUsers.length !== 1 ? 's' : ''} registered</p>
            </div>
          </div>
          <div class="space-y-4" id="staff-users-list"></div>
        </div>
      `;
      staffContainer.appendChild(staffSection);

      const staffList = staffSection.querySelector('#staff-users-list');
      staffUsers.forEach(u => {
        const card = createUserCard(u);
        staffList.appendChild(card);
      });
    } else {
      staffContainer.innerHTML = `
        <div class="bg-white/90 backdrop-blur-sm rounded-2xl card-shadow border border-gold-100/50 p-8 text-center">
          <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          <p class="text-lg font-medium text-gray-500">No staff users found</p>
          <p class="text-sm text-gray-400">Staff and admin users will appear here</p>
        </div>
      `;
    }

    // Render customer section in right column
    if (customerUsers.length > 0) {
      const customerSection = document.createElement('div');
      customerSection.innerHTML = `
        <div class="bg-white/90 backdrop-blur-sm rounded-2xl card-shadow border border-gold-100/50 p-6">
          <div class="flex items-center mb-6">
            <div class="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-full mr-4">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900">Customer Users</h3>
              <p class="text-sm text-gray-600">${customerUsers.length} user${customerUsers.length !== 1 ? 's' : ''} registered</p>
            </div>
          </div>
          <div class="space-y-4" id="customer-users-list"></div>
        </div>
      `;
      customerContainer.appendChild(customerSection);

      const customerList = customerSection.querySelector('#customer-users-list');
      customerUsers.forEach(u => {
        const card = createUserCard(u, true); // true for customer mode (no role change)
        customerList.appendChild(card);
      });
    } else {
      customerContainer.innerHTML = `
        <div class="bg-white/90 backdrop-blur-sm rounded-2xl card-shadow border border-gold-100/50 p-8 text-center">
          <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
          </svg>
          <p class="text-lg font-medium text-gray-500">No customer users found</p>
          <p class="text-sm text-gray-400">Customer users will appear here</p>
        </div>
      `;
    }

    // Handle archives section visibility and rendering
    if (showArchives) {
      archivesSection.classList.remove('hidden');

      // Always render archived staff section (even with 0 records)
      const archivedStaffSection = document.createElement('div');
      archivedStaffSection.innerHTML = `
        <div class="bg-gray-50/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-6">
          <div class="flex items-center mb-4">
            <div class="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mr-3">
              <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
            </div>
            <div>
              <h4 class="text-lg font-semibold text-gray-900">Archived Staff & Admin</h4>
              <p class="text-xs text-gray-600">${archivedStaffUsers.length} archived account${archivedStaffUsers.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div class="space-y-3" id="archived-staff-users-list">
            ${archivedStaffUsers.length === 0 ? `
              <div class="text-center py-8">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                <p class="text-sm font-medium text-gray-500">No archived staff & admin accounts</p>
              </div>
            ` : ''}
          </div>
        </div>
      `;
      archivedStaffContainer.appendChild(archivedStaffSection);

      // Add archived staff users if any
      if (archivedStaffUsers.length > 0) {
        const archivedStaffList = archivedStaffSection.querySelector('#archived-staff-users-list');
        archivedStaffUsers.forEach(u => {
          const card = createUserCard(u);
          archivedStaffList.appendChild(card);
        });
      }

      // Always render archived customer section (even with 0 records)
      const archivedCustomerSection = document.createElement('div');
      archivedCustomerSection.innerHTML = `
        <div class="bg-gray-50/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center">
              <div class="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mr-3">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              </div>
              <div>
                <h4 class="text-lg font-semibold text-gray-900">Archived Customers</h4>
                <p class="text-xs text-gray-600">${archivedCustomerUsers.length} archived account${archivedCustomerUsers.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
          <div class="space-y-3" id="archived-customer-users-list">
            ${archivedCustomerUsers.length === 0 ? `
              <div class="text-center py-8">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                <p class="text-sm font-medium text-gray-500">No archived customer accounts</p>
              </div>
            ` : ''}
          </div>
        </div>
      `;
      archivedCustomerContainer.appendChild(archivedCustomerSection);

      // Add archived customer users if any
      if (archivedCustomerUsers.length > 0) {
        const archivedCustomerList = archivedCustomerSection.querySelector('#archived-customer-users-list');
        archivedCustomerUsers.forEach(u => {
          const card = createUserCard(u, true);
          archivedCustomerList.appendChild(card);
        });
      }
    } else {
      archivesSection.classList.add('hidden');
    }

  }

  function createUserCard(user, isCustomer = false) {
    const displayName = (typeof user.full_name === 'string' && user.full_name.trim())
      ? user.full_name.trim()
      : ((typeof user.username === 'string' && user.username.trim()) ? user.username.trim() : 'User');
    const initial = displayName.charAt(0).toUpperCase();
    const card = document.createElement('div');
    card.className = 'bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200';
    if (user.id) { card.setAttribute('data-user-id', String(user.id)); }
    card.setAttribute('data-is-customer', isCustomer ? 'true' : 'false');
    card.setAttribute('data-is-active', user.is_active ? 'true' : 'false');

    const dropdownMenu = `
      <div class="relative">
        <button data-act="menu" data-id="${user.id}" class="menu-btn p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
          </svg>
        </button>
      </div>
    `;

    card.innerHTML = `
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 flex-1">
          <div class="w-10 h-10 bg-gradient-to-br from-gold-100 to-gold-200 rounded-full flex items-center justify-center flex-shrink-0">
            <span class="text-gold-700 font-semibold text-sm">${initial}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <div class="font-semibold text-gray-900 truncate">${displayName}</div>
              ${getRoleBadge(user.role, null, user.is_active)}
            </div>
            <div class="text-sm text-gray-600 truncate">${user.email}</div>
            ${user.phone ? `<div class="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
              </svg>
              <span class="truncate">${user.phone}</span>
            </div>` : ''}
          </div>
        </div>
        ${dropdownMenu}
      </div>`;

    // Delete countdown is now handled in the dropdown

    return card;
  }

  function initializeDeleteCountdown(card, userId) {
    const deleteBtn = card.querySelector('.delete-btn');
    const countdownEl = card.querySelector('.delete-countdown');
    let countdown = 5;

    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownEl) {
        countdownEl.textContent = `(${countdown})`;
      }

      if (countdown <= 0) {
        clearInterval(countdownInterval);
        if (deleteBtn) {
          deleteBtn.disabled = false;
          deleteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          deleteBtn.classList.add('cursor-pointer');
        }
        if (countdownEl) {
          countdownEl.style.display = 'none';
        }
      }
    }, 1000);
  }

  function initializeDeleteCountdownForDropdown(dropdown, userId) {
    const deleteBtn = dropdown.querySelector('.delete-btn');
    const countdownEl = dropdown.querySelector('.delete-countdown');
    let countdown = 5;

    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownEl) {
        countdownEl.textContent = `(${countdown})`;
      }

      if (countdown <= 0) {
        clearInterval(countdownInterval);
        if (deleteBtn) {
          deleteBtn.disabled = false;
          deleteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          deleteBtn.classList.add('cursor-pointer');
        }
        if (countdownEl) {
          countdownEl.style.display = 'none';
        }
      }
    }, 1000);
  }
  function load() {
    // Load all users for static stats
    authFetch({ action: 'list_users' })
      .then(d => {
        allUsers = d.users; // Store all users for static stats
        updateStats(allUsers); // Update stats once with all users

        // Now apply filter for display
        const val = filterRole.value;
        const valid = val && ['admin','cashier','manager'].includes(val) ? val : undefined;
        render(allUsers, valid); // Pass filter to render function
      })
      .catch(e => {
        console.error('Error loading users:', e);
        showNotification('Error loading users', 'error', e.message);
      });
  }

  btnRefresh.addEventListener('click', () => {
    // Reload the entire page
    window.location.reload();
  });
  filterRole.addEventListener('change', () => {
    if (allUsers.length > 0) {
      // Just re-render with new filter, don't reload from API
      const val = filterRole.value;
      const valid = val && ['admin','cashier','manager','stock_controller'].includes(val) ? val : undefined;
      render(allUsers, valid);
    }
  });
  btnNew.addEventListener('click', () => {
    frm.reset();
    roleSel.value = 'cashier';
    dlg.showModal();
  });
  btnCancel.addEventListener('click', () => dlg.close());

  // Archives toggle handler
  btnArchives.addEventListener('click', () => {
    showArchives = !showArchives;
    btnArchives.innerHTML = showArchives ?
      `<svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
      Hide Archives` :
      `<svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
      </svg>
      Archives`;
    if (allUsers.length > 0) {
      // Just re-render with current filter, don't reload from API
      const val = filterRole.value;
      const valid = val && ['admin','cashier','manager'].includes(val) ? val : undefined;
      render(allUsers, valid);
    }

    // Smooth scroll to archives section if showing
    if (showArchives) {
      setTimeout(() => {
        const archivesSection = document.getElementById('archivesSection');
        if (archivesSection) {
          archivesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100); // Small delay to allow rendering
    }
  });

  // Close archives button handler (delegated to document for dynamic elements)
  document.addEventListener('click', (e) => {
    if (e.target.closest('#closeArchivesBtn')) {
      showArchives = false;
      btnArchives.innerHTML = `<svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
      </svg>
      Archives`;

      // Hide archives section
      const archivesSection = document.getElementById('archivesSection');
      if (archivesSection) {
        archivesSection.classList.add('hidden');
      }

      // Scroll to User Statistics section
      const userStatsSection = document.querySelector('.bg-white\\/90.backdrop-blur-sm.rounded-2xl.card-shadow.border');
      if (userStatsSection) {
        userStatsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // Password visibility toggle functionality
  const togglePassword = document.getElementById('togglePassword');
  const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm_password');

  function togglePasswordVisibility(input, button) {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';

    // Update icon
    const iconPath = isPassword
      ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>'
      : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>';

    button.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconPath}</svg>`;
  }

  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      togglePasswordVisibility(passwordInput, togglePassword);
    });
  }

  if (toggleConfirmPassword) {
    toggleConfirmPassword.addEventListener('click', () => {
      togglePasswordVisibility(confirmPasswordInput, toggleConfirmPassword);
    });
  }

  // Edit modal event listeners
  editUserCancel.addEventListener('click', () => editUserModal.close());

  // View modal event listeners
  viewUserClose.addEventListener('click', () => viewUserModal.close());

  editUserForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // Show confirmation modal instead of directly updating
    updateUserModal.classList.remove('hidden');
  });

  // No second dropdown anymore

  frm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Validate password confirmation
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;

    if (password !== confirmPassword) {
      showNotification('Password Error', 'error', 'Passwords do not match. Please try again.');
      return;
    }

    const selectedRole = roleSel.value;
    const payload = {
      action: 'create_user',
      first_name: document.getElementById('first_name').value.trim(),
      last_name: document.getElementById('last_name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      address: document.getElementById('address').value.trim(),
      birthdate: document.getElementById('birthdate').value || null,
      role: selectedRole,
      password: password
    };

    authFetch(payload)
      .then(d => {
        dlg.close();
        allUsers = []; // Reset to force reload
        load();
        showNotification('User created successfully!', 'success', 'The user account has been created and is ready to use.');
      })
      .catch(e => {
        console.error('Error creating user:', e);
        showNotification('Error creating user', 'error', e.message);
      });
  });

  // Event delegation for user actions - attach to both containers
  function handleUserAction(e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    // Skip the close archives button
    if (btn.id === 'closeArchivesBtn') return;

    let id = parseInt(btn.getAttribute('data-id'), 10);
    if (Number.isNaN(id)) {
      const holder = btn.closest('[data-user-id]');
      if (holder) {
        // Strip non-digits just in case
        const raw = holder.getAttribute('data-user-id') || '';
        const digits = raw.match(/\d+/);
        if (digits) id = parseInt(digits[0], 10);
      }
    }
    const act = btn.getAttribute('data-act');
    if (Number.isNaN(id)) {
      showNotification('Error', 'error', 'Unable to determine user id for this action. Please refresh the page and try again.');
      return;
    }

    if (act === 'menu') {
      const userId = btn.getAttribute('data-id');
      const card = btn.closest('[data-user-id]');
      const isActive = card.getAttribute('data-is-active') === 'true';
      const isCustomer = card.getAttribute('data-is-customer') === 'true';

      // Remove any existing dropdowns
      document.querySelectorAll('.menu-dropdown').forEach(d => d.remove());

      // Create new dropdown
      const dropdown = document.createElement('div');
      dropdown.className = 'menu-dropdown fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1';
      dropdown.style.zIndex = '99999';
      dropdown.innerHTML = `
        ${!isCustomer && isActive ? `
          <button data-act="edit" data-id="${userId}" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
            Edit User
          </button>
        ` : ''}
        ${isCustomer ? `
          <button data-act="view" data-id="${userId}" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
            View User
          </button>
        ` : ''}
        <button data-act="toggle" data-id="${userId}" data-active="${isActive ? 1 : 0}" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${isActive ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636"></path>' : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>'}
          </svg>
          ${isActive ? 'Deactivate' : 'Activate'}
        </button>
        <div class="border-t border-gray-100 my-1"></div>
        <button data-act="delete" data-id="${userId}" data-name="${card.querySelector('.font-semibold').textContent.trim()}" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          <span>Delete User</span>
        </button>
      `;

      // Position the dropdown smartly based on available space
      const rect = btn.getBoundingClientRect();
      const dropdownHeight = 160; // Approximate height of dropdown
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Check if there's enough space below, otherwise position above
      if (spaceBelow >= dropdownHeight || spaceBelow > spaceAbove) {
        // Position below the button
        dropdown.style.top = `${rect.bottom + 2}px`;
        dropdown.style.left = `${rect.left}px`;
      } else {
        // Position above the button
        dropdown.style.top = `${rect.top - dropdownHeight - 2}px`;
        dropdown.style.left = `${rect.left}px`;
      }

      // Append to body
      document.body.appendChild(dropdown);

      // Add event listeners to dropdown buttons
      dropdown.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const act = btn.getAttribute('data-act');
        const id = parseInt(btn.getAttribute('data-id'), 10);

        if (act === 'edit') {
          // Load user data and open edit modal
          authFetch({ action: 'get_user_details', user_id: id })
            .then(data => {
              // Close dropdown
              dropdown.remove();
              editUserId.value = data.user.id;
              editFirstName.value = data.user.first_name || '';
              editLastName.value = data.user.last_name || '';
              editBirthdate.value = data.user.birthdate || '';
              editAddress.value = data.user.address || '';
              editEmail.value = data.user.email || '';
              editPhone.value = data.user.phone || '';
              editUserModal.showModal();
            })
            .catch(err => {
              console.error('Error loading user details:', err);
              showNotification('Error loading user details', 'error', err.message);
            });
        } else if (act === 'view') {
          // Load user data and open view modal
          authFetch({ action: 'get_user_details', user_id: id })
            .then(data => {
              // Close dropdown
              dropdown.remove();
              viewUserId.value = data.user.id;
              viewFirstName.value = data.user.first_name || '';
              viewLastName.value = data.user.last_name || '';
              viewBirthdate.value = data.user.birthdate || '';
              viewAddress.value = data.user.address || '';
              viewEmail.value = data.user.email || '';
              viewPhone.value = data.user.phone || '';
              viewUserModal.showModal();
            })
            .catch(err => {
              console.error('Error loading user details:', err);
              showNotification('Error loading user details', 'error', err.message);
            });
        } else if (act === 'toggle') {
          const current = parseInt(btn.getAttribute('data-active') || '0', 10);
          const activate = current ? 0 : 1;
          const action = activate ? 'activate' : 'deactivate';

          // Store data for confirmation
          pendingToggleData = { userId: id, activate, action };

          // Set modal content
          if (activate) {
            toggleUserIcon.innerHTML = '<svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            toggleUserIcon.className = 'w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg';
            toggleUserTitle.textContent = 'Activate User';
            toggleUserMessage.textContent = 'Are you sure you want to activate this user? They will regain access to the system.';
          } else {
            toggleUserIcon.innerHTML = '<svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636"></path></svg>';
            toggleUserIcon.className = 'w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg';
            toggleUserTitle.textContent = 'Deactivate User';
            toggleUserMessage.textContent = 'Are you sure you want to deactivate this user? They will lose access to the system until reactivated.';
          }

          // Close dropdown and show modal
          dropdown.remove();
          toggleUserModal.classList.remove('hidden');
        } else if (act === 'delete') {
          const userName = btn.getAttribute('data-name');
          showDeleteConfirmation(id, userName);
          dropdown.remove();
        }
      });

      // Function to update dropdown position on scroll
      const updatePosition = () => {
        if (dropdown.parentNode) {
          const newRect = btn.getBoundingClientRect();
          dropdown.style.top = `${newRect.bottom + 2}px`;
          dropdown.style.left = `${newRect.left}px`;
        }
      };

      // Update position on scroll
      const scrollHandler = () => updatePosition();
      window.addEventListener('scroll', scrollHandler, { passive: true });

      // Remove scroll listener when dropdown is removed
      const originalRemove = dropdown.remove;
      dropdown.remove = function() {
        window.removeEventListener('scroll', scrollHandler);
        originalRemove.call(this);
      };

      e.stopPropagation();
    }
    // Dropdown actions are now handled directly in the dropdown event listener
  }

  // Close dropdown menus when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-btn') && !e.target.closest('.menu-dropdown')) {
      document.querySelectorAll('.menu-dropdown').forEach(dropdown => {
        dropdown.remove();
      });
    }
  });

  // Attach event listeners to all user containers
  const staffContainer = document.getElementById('staff-users-container');
  const customerContainer = document.getElementById('customer-users-container');
  const archivedStaffContainer = document.getElementById('archived-staff-users-container');
  const archivedCustomerContainer = document.getElementById('archived-customer-users-container');

  if (staffContainer) {
    staffContainer.addEventListener('click', handleUserAction);
  }
  if (customerContainer) {
    customerContainer.addEventListener('click', handleUserAction);
  }
  if (archivedStaffContainer) {
    archivedStaffContainer.addEventListener('click', handleUserAction);
  }
  if (archivedCustomerContainer) {
    archivedCustomerContainer.addEventListener('click', handleUserAction);
  }

  // Mobile menu toggle function
  function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('hidden');
  }

  // Logout modal elements
  const logoutModal = document.getElementById('logoutModal');

  // Logout function
  function logout() {
    logoutModal.classList.remove('hidden');
  }

  // Close logout modal
  function closeLogoutModal() {
    logoutModal.classList.add('hidden');
  }

  // Confirm logout
  function confirmLogout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_email');
    localStorage.removeItem('auth_staff_role');
    localStorage.removeItem('auth_user_id');

    // Prevent back navigation by replacing current history entry
    history.replaceState(null, null, 'admin_staff_auth.html');

    // Redirect to login page
    window.location.href = 'admin_staff_auth.html';
  }

  // Make logout function globally accessible
  window.logout = logout;
  window.closeLogoutModal = closeLogoutModal;
  window.confirmLogout = confirmLogout;

  // Update user confirmation functions
  function closeUpdateUserModal() {
    updateUserModal.classList.add('hidden');
  }

  function confirmUpdateUser() {
    const userId = editUserId.value;
    const payload = {
      action: 'update_user',
      user_id: userId,
      first_name: editFirstName.value.trim(),
      last_name: editLastName.value.trim(),
      address: editAddress.value.trim()
    };

    authFetch(payload)
      .then(() => {
        updateUserModal.classList.add('hidden');
        editUserModal.close();
        allUsers = []; // Reset to force reload
        load();
        showNotification('User updated successfully!', 'success');
      })
      .catch(err => {
        console.error('Error updating user:', err);
        updateUserModal.classList.add('hidden');
        showNotification('Error updating user', 'error', err.message);
      });
  }

  // Make functions globally accessible
  window.closeUpdateUserModal = closeUpdateUserModal;
  window.confirmUpdateUser = confirmUpdateUser;

  // Toggle user status functions
  function closeToggleUserModal() {
    toggleUserModal.classList.add('hidden');
    pendingToggleData = null;
  }

  function confirmToggleUser() {
    if (!pendingToggleData) return;

    const { userId, activate, action } = pendingToggleData;

    authFetch({ action: 'deactivate_user', user_id: userId, active: activate })
      .then((res) => {
        toggleUserModal.classList.add('hidden');
        pendingToggleData = null;
        showNotification(`User ${action}d successfully!`, 'success');
        allUsers = []; // Reset to force reload
        load();
      })
      .catch(err => {
        console.error('Error updating user status:', err);
        toggleUserModal.classList.add('hidden');
        pendingToggleData = null;
        showNotification('Error updating user status', 'error', err.message);
      });
  }

  // Make functions globally accessible
  window.closeToggleUserModal = closeToggleUserModal;
  window.confirmToggleUser = confirmToggleUser;

  // Delete confirmation modal functions
  function showDeleteConfirmation(userId, userName) {
    const deleteConfirmModal = document.createElement('div');
    deleteConfirmModal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10002]';
    deleteConfirmModal.innerHTML = `
      <div class="bg-white/95 backdrop-blur-sm rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-red-100">
        <div class="text-center">
          <div class="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-3">Delete User</h3>
          <p class="text-gray-600 mb-6 leading-tight">
            Are you sure you want to <strong>permanently delete</strong> this user?
            <br>
            <span class="text-sm text-red-500">This action cannot be undone. All user data will be lost forever.</span>
          </p>
          <div class="flex gap-3">
            <button onclick="this.closest('.fixed').remove()" class="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200">
              Cancel
            </button>
            <button id="confirmDeleteBtn" disabled class="flex-1 px-6 py-3 bg-red-400 text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg opacity-50 cursor-not-allowed">
              Delete Forever <span id="deleteCountdown" class="ml-2">(5)</span>
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(deleteConfirmModal);

    // Start countdown for delete button
    const deleteBtn = deleteConfirmModal.querySelector('#confirmDeleteBtn');
    const countdownEl = deleteConfirmModal.querySelector('#deleteCountdown');
    let countdown = 5;

    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownEl) {
        countdownEl.textContent = `(${countdown})`;
      }

      if (countdown <= 0) {
        clearInterval(countdownInterval);
        if (deleteBtn) {
          deleteBtn.disabled = false;
          deleteBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-red-400');
          deleteBtn.classList.add('cursor-pointer', 'bg-red-600', 'hover:bg-red-700');
          deleteBtn.onclick = () => confirmDeleteUser(userId, userName);
        }
        if (countdownEl) {
          countdownEl.style.display = 'none';
        }
      }
    }, 1000);
  }

  // Make confirmDeleteUser globally accessible
  window.confirmDeleteUser = function(userId, userName) {
    // Remove all delete confirmation modals immediately
    document.querySelectorAll('.fixed').forEach(modal => modal.remove());

    // Show loading notification
    showNotification('Deleting User', 'warning', `Permanently deleting ${userName}...`);

    // Call delete API
    authFetch({ action: 'delete_user', user_id: userId })
      .then(() => {
        showNotification('User Deleted', 'success', 'User has been permanently deleted.');
        allUsers = []; // Reset to force reload
        load(); // Reload the user list
      })
      .catch(err => {
        console.error('Error deleting user:', err);
        showNotification('Error deleting user', 'error', err.message);
      });
  };

  // Notification modal functions
  function showNotification(title, type = 'info', message = '') {
    const icons = {
      success: '<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
      error: '<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
      warning: '<svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>',
      info: '<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
    };

    notificationIcon.innerHTML = icons[type] || icons.info;
    notificationTitle.textContent = title;
    notificationMessage.textContent = message;
    notificationModal.classList.remove('hidden');
  }

  function closeNotificationModal() {
    notificationModal.classList.add('hidden');
  }

  // Make function globally accessible
  window.closeNotificationModal = closeNotificationModal;

  // Initial load
  load();
})();



