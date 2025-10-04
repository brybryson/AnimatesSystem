  // API base URL - adjust this to your server location
        const API_BASE = 'http://localhost/animates/api/';
        
        let verificationToken = null;
        let resendTimer = null;
        let resetToken = null;
        let resendResetTimer = null;

        // Form switching functions
        function showLoginForm() {
            hideAllForms();
            document.getElementById('login-form').classList.remove('hidden');
        }

        function showSignupForm() {
            hideAllForms();
            document.getElementById('signup-form').classList.remove('hidden');
        }

        function showVerificationForm() {
            hideAllForms();
            document.getElementById('verification-form').classList.remove('hidden');
        }

        function showForgotPassword() {
            hideAllForms();
            document.getElementById('forgot-password-form').classList.remove('hidden');
        }

        function showResetCodeForm() {
            hideAllForms();
            document.getElementById('reset-code-form').classList.remove('hidden');
        }

        function showNewPasswordForm() {
            hideAllForms();
            document.getElementById('new-password-form').classList.remove('hidden');
        }

        function showSuccessModal() {
            document.getElementById('success-modal').classList.remove('hidden');
        }

        function closeSuccessModal() {
            document.getElementById('success-modal').classList.add('hidden');
            // Small delay to ensure modal is hidden before redirect
            setTimeout(() => {
                window.location.href = 'auth.html?verified=true';
            }, 300);
        }

        function hideAllForms() {
            document.querySelectorAll('#login-form, #signup-form, #verification-form, #forgot-password-form, #reset-code-form, #new-password-form').forEach(form => {
                form.classList.add('hidden');
            });
            // Also hide success modal
            document.getElementById('success-modal').classList.add('hidden');
        }
        // Password visibility toggle
        function togglePassword(inputId) {
            const input = document.getElementById(inputId);
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
        }

        // Password strength checker
        function checkPasswordStrength(password) {
            let strength = 0;
            let feedback = [];

            if (password.length >= 8) strength++;
            else feedback.push("At least 8 characters");

            if (/[a-z]/.test(password)) strength++;
            else feedback.push("Include lowercase letters");

            if (/[A-Z]/.test(password)) strength++;
            else feedback.push("Include uppercase letters");

            if (/\d/.test(password)) strength++;
            else feedback.push("Include numbers");

            if (/[^A-Za-z0-9]/.test(password)) strength++;
            else feedback.push("Include special characters (!@#$%^&*)");

            return { strength, feedback };
        }

        function updatePasswordStrength() {
            const password = document.getElementById('signupPassword').value;
            const bars = document.querySelectorAll('.password-bar');
            const text = document.querySelector('.password-text');
            
            if (!password) {
                bars.forEach(bar => bar.className = 'password-bar bg-gray-200 rounded-full h-1 flex-1');
                text.textContent = 'Enter a password';
                text.className = 'password-text text-gray-500 mt-1';
                return;
            }

            const { strength, feedback } = checkPasswordStrength(password);
            const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];
            const texts = ['Very Weak', 'Weak', 'Good', 'Strong'];
            const textColors = ['text-red-600', 'text-orange-600', 'text-yellow-600', 'text-green-600'];

            bars.forEach((bar, index) => {
                bar.className = `password-bar rounded-full h-1 flex-1 ${index < strength ? colors[Math.min(strength - 1, colors.length - 1)] : 'bg-gray-200'}`;
            });

            text.textContent = feedback.length ? feedback.join(', ') : texts[strength - 1];
            text.className = `password-text mt-1 ${feedback.length ? 'text-gray-600' : textColors[strength - 1]}`;
        }

        function checkPasswordMatch() {
            const password = document.getElementById('signupPassword').value;
            const confirm = document.getElementById('confirmPassword').value;
            const matchDiv = document.getElementById('password-match');
            
            if (!confirm) {
                matchDiv.textContent = '';
                return false;
            }
            
            if (password === confirm) {
                matchDiv.textContent = '✓ Passwords match';
                matchDiv.className = 'mt-1 text-xs text-green-600';
                return true;
            } else {
                matchDiv.textContent = '✗ Passwords do not match';
                matchDiv.className = 'mt-1 text-xs text-red-600';
                return false;
            }
        }

        // Validation functions
        function validatePhoneNumber(phone) {
            // Must start with "09", exactly 11 digits, no letters
            const phoneRegex = /^09\d{9}$/;
            return phoneRegex.test(phone);
        }

        function validateName(name) {
            // No numbers, no special characters (only letters and spaces)
            const nameRegex = /^[a-zA-Z\s]+$/;
            return nameRegex.test(name) && name.trim().length > 0;
        }

        function validateEmail(email) {
            // Must contain "@" and end with ".com"
            const emailRegex = /^[^\s@]+@[^\s@]+\.com$/;
            return emailRegex.test(email);
        }

        function validateSignupForm() {
            const requiredFields = ['firstName', 'lastName', 'signupEmail', 'signupPhone', 'signupAddress', 'signupPassword', 'confirmPassword'];
            const allFilled = requiredFields.every(field => document.getElementById(field).value.trim());
            const termsChecked = document.getElementById('agreeTerms').checked;
            const passwordsMatch = checkPasswordMatch();
            const { strength } = checkPasswordStrength(document.getElementById('signupPassword').value);

            // Additional validations
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const phone = document.getElementById('signupPhone').value.trim();

            const nameValid = validateName(firstName) && validateName(lastName);
            const emailValid = validateEmail(email);
            const phoneValid = validatePhoneNumber(phone);

            const signupBtn = document.getElementById('signupBtn');
            const isValid = allFilled && termsChecked && passwordsMatch && strength >= 3 && nameValid && emailValid && phoneValid;

            if (isValid) {
                signupBtn.disabled = false;
                signupBtn.className = 'w-full bg-primary hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors';
            } else {
                signupBtn.disabled = true;
                signupBtn.className = 'w-full bg-gray-300 text-gray-500 py-3 rounded-lg font-medium cursor-not-allowed transition-colors';
            }
        }

        function setupResetCodeInputs() {
            const inputs = document.querySelectorAll('.reset-code-input');
            inputs.forEach((input, index) => {
                input.addEventListener('input', (e) => {
                    if (e.target.value && index < inputs.length - 1) {
                        inputs[index + 1].focus();
                    }
                    checkResetCode();
                });
                
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value && index > 0) {
                        inputs[index - 1].focus();
                    }
                });
            });
        }

        function checkResetCode() {
            const inputs = document.querySelectorAll('.reset-code-input');
            const code = Array.from(inputs).map(input => input.value).join('');
            const verifyBtn = document.getElementById('verifyResetCodeBtn');
            
            if (code.length === 6) {
                verifyBtn.disabled = false;
                verifyBtn.className = 'w-full bg-primary hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors';
            } else {
                verifyBtn.disabled = true;
                verifyBtn.className = 'w-full bg-gray-300 text-gray-500 py-3 rounded-lg font-medium cursor-not-allowed transition-colors';
            }
        }

        function startResendResetTimer() {
            let seconds = 60;
            const timerDiv = document.getElementById('resendResetTimer');
            const countdownSpan = document.getElementById('resetCountdown');
            const resendBtn = document.getElementById('resendResetBtn');
            
            timerDiv.classList.remove('hidden');
            resendBtn.disabled = true;
            resendBtn.className = 'text-gray-400 font-medium cursor-not-allowed';
            
            resendResetTimer = setInterval(() => {
                seconds--;
                countdownSpan.textContent = seconds;
                
                if (seconds <= 0) {
                    clearInterval(resendResetTimer);
                    timerDiv.classList.add('hidden');
                    resendBtn.disabled = false;
                    resendBtn.className = 'text-primary hover:text-blue-700 font-medium';
                }
            }, 1000);
        }

        // Verification code handling
        function setupVerificationInputs() {
            const inputs = document.querySelectorAll('.verification-input');
            inputs.forEach((input, index) => {
                input.addEventListener('input', (e) => {
                    if (e.target.value && index < inputs.length - 1) {
                        inputs[index + 1].focus();
                    }
                    checkVerificationCode();
                });
                
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value && index > 0) {
                        inputs[index - 1].focus();
                    }
                });
            });
        }

        function checkVerificationCode() {
            const inputs = document.querySelectorAll('.verification-input');
            const code = Array.from(inputs).map(input => input.value).join('');
            const verifyBtn = document.getElementById('verifyBtn');
            
            if (code.length === 6) {
                verifyBtn.disabled = false;
                verifyBtn.className = 'w-full bg-primary hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors';
            } else {
                verifyBtn.disabled = true;
                verifyBtn.className = 'w-full bg-gray-300 text-gray-500 py-3 rounded-lg font-medium cursor-not-allowed transition-colors';
            }
        }

        function startResendTimer() {
            let seconds = 60;
            const timerDiv = document.getElementById('resendTimer');
            const countdownSpan = document.getElementById('countdown');
            const resendBtn = document.getElementById('resendBtn');
            
            timerDiv.classList.remove('hidden');
            resendBtn.disabled = true;
            resendBtn.className = 'text-gray-400 font-medium cursor-not-allowed';
            
            resendTimer = setInterval(() => {
                seconds--;
                countdownSpan.textContent = seconds;
                
                if (seconds <= 0) {
                    clearInterval(resendTimer);
                    timerDiv.classList.add('hidden');
                    resendBtn.disabled = false;
                    resendBtn.className = 'text-primary hover:text-blue-700 font-medium';
                }
            }, 1000);
        }

        // Form submission handlers
        async function handleLogin(e) {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            try {
                showNotification('Signing in...', 'info');
                
                const response = await fetch(`${API_BASE}auth.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'login',
                        email: email,
                        password: password
                    })
                });
                
                const result = await response.json();
                
                // Replace the existing handleLogin success block with this:
                if (result.success) {
                    // Store auth token
                    localStorage.setItem('authToken', result.token);
                    localStorage.setItem('userId', result.user_id);
                    localStorage.setItem('userRole', result.user.role); // Store user role
                    
                    showNotification('Welcome back! Redirecting...', 'success');
                    
                    // Redirect based on user role
                    setTimeout(() => {
                        if (result.user.role === 'customer') {
                            window.location.href = 'customer_tracking.html';
                        } else if (result.user.role === 'admin' || result.user.role === 'staff' || result.user.role === 'cashier') {
                            window.location.href = 'dashboard.html';
                        } else {
                            // Fallback to customer tracking for unknown roles
                            window.location.href = 'customer_tracking.html';
                        }
                    }, 2000);
                } else {
                    showNotification(result.error || 'Login failed', 'error');
                }
            } catch (error) {
                console.error('Login error:', error);
                showNotification('Connection error. Please try again.', 'error');
            }
        }

        async function handleSignup(e) {
    e.preventDefault();

    // Validate all fields before submission
    const firstNameValid = validateFirstName();
    const lastNameValid = validateLastName();
    const emailValid = validateSignupEmail();
    const phoneValid = validateSignupPhone();

    if (!firstNameValid || !lastNameValid || !emailValid || !phoneValid) {
        showNotification('Please correct the validation errors before submitting.', 'error');
        return;
    }

    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('signupEmail').value,
        phone: document.getElementById('signupPhone').value,
        address: document.getElementById('signupAddress').value,
        password: document.getElementById('signupPassword').value,
        // marketingEmails: document.getElementById('marketingEmails').checked
    };

    try {
        showNotification('Creating your account...', 'info');

        const response = await fetch(`${API_BASE}auth.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'signup',
                ...formData
            })
        });

        // Check if the response is successful first
        if (!response.ok) {
            const errorText = await response.text();
            showNotification(`Server error: ${errorText}`, 'error');
            console.error('Server responded with an error:', errorText);
            return; // Stop execution
        }

        const result = await response.json();

        if (result.success) {
            verificationToken = result.verification_token;
            document.getElementById('verificationEmail').textContent = formData.email;

            showNotification('Verification email sent! Please check your inbox.', 'success');
            console.log('Showing verification form...');
            showVerificationForm();
            startResendTimer();
        } else {
            showNotification(result.error || 'Signup failed', 'error');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showNotification('Connection error or invalid response. Please try again.', 'error');
    }
}

        async function handleVerification(e) {
    e.preventDefault();

    const inputs = document.querySelectorAll('.verification-input');
    const code = Array.from(inputs).map(input => input.value).join('');

    try {
        showNotification('Verifying your email...', 'info');
                
                const response = await fetch(`${API_BASE}auth.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'verify_email',
                        verification_token: verificationToken,
                        verification_code: code
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Store auth token
                    localStorage.setItem('authToken', result.token);
                    localStorage.setItem('userId', result.user_id);

                    showNotification('Email verified successfully! Welcome to Animates!', 'success');
                    showSuccessModal();
                } else {
                    showNotification(result.error || 'Verification failed', 'error');
                    // Clear the inputs on error
                    inputs.forEach(input => input.value = '');
                    inputs[0].focus();
                }
            } catch (error) {
                console.error('Verification error:', error);
                showNotification('Connection error. Please try again.', 'error');
            }
        }

        async function handleForgotPassword(e) {
            e.preventDefault();
            
            const email = document.getElementById('resetEmail').value;
            
            try {
                showNotification('Sending reset code...', 'info');
                
                const response = await fetch(`${API_BASE}auth.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'forgot_password',
                        email: email
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    resetToken = result.reset_token;
                    document.getElementById('resetCodeEmail').textContent = email;
                    
                    showNotification('Reset code sent to your email!', 'success');
                    showResetCodeForm();
                    startResendResetTimer();
                } else {
                    showNotification(result.error || 'Failed to send reset code', 'error');
                }
            } catch (error) {
                console.error('Forgot password error:', error);
                showNotification('Connection error. Please try again.', 'error');
            }
        }

        async function handleResetCodeVerification(e) {
    e.preventDefault();
    
    const inputs = document.querySelectorAll('.reset-code-input');
    const code = Array.from(inputs).map(input => input.value).join('');
    
    try {
        showNotification('Verifying reset code...', 'info');
        
        const response = await fetch(`${API_BASE}auth.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'verify_reset_code',
                reset_token: resetToken,
                reset_code: code
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Code verified! Set your new password.', 'success');
            showNewPasswordForm();
        } else {
            showNotification(result.error || 'Verification failed', 'error');
            inputs.forEach(input => input.value = '');
            inputs[0].focus();
        }
    } catch (error) {
        console.error('Reset code verification error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

async function handleNewPassword(e) {
    e.preventDefault();
    
    const inputs = document.querySelectorAll('.reset-code-input');
    const code = Array.from(inputs).map(input => input.value).join('');
    const password = document.getElementById('newPassword').value;
    
    try {
        showNotification('Resetting password...', 'info');
        
        const response = await fetch(`${API_BASE}auth.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'reset_password',
                reset_token: resetToken,
                reset_code: code,
                password: password
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Password reset successfully! Please sign in.', 'success');
            setTimeout(() => {
                showLoginForm();
            }, 2000);
        } else {
            showNotification(result.error || 'Password reset failed', 'error');
        }
    } catch (error) {
        console.error('Password reset error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

async function resendResetCode() {
    if (resendResetTimer) return;
    
    try {
        showNotification('Resending reset code...', 'info');
        
        const response = await fetch(`${API_BASE}auth.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'resend_reset_code',
                reset_token: resetToken
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('New reset code sent!', 'success');
            startResendResetTimer();
            
            document.querySelectorAll('.reset-code-input').forEach(input => {
                input.value = '';
            });
            document.querySelector('.reset-code-input').focus();
        } else {
            showNotification(result.error || 'Failed to resend code', 'error');
        }
    } catch (error) {
        console.error('Resend reset code error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

        async function resendVerification() {
            if (resendTimer) return; // Timer is still running
            
            try {
                showNotification('Resending verification code...', 'info');
                
                const response = await fetch(`${API_BASE}auth.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'resend_verification',
                        verification_token: verificationToken
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('New verification code sent!', 'success');
                    startResendTimer();
                    
                    // Clear current inputs
                    document.querySelectorAll('.verification-input').forEach(input => {
                        input.value = '';
                    });
                    document.querySelector('.verification-input').focus();
                } else {
                    showNotification(result.error || 'Failed to resend code', 'error');
                }
            } catch (error) {
                console.error('Resend verification error:', error);
                showNotification('Connection error. Please try again.', 'error');
            }
        }

        // Phone number formatting and validation
        function formatPhoneNumber(input) {
            // Remove all non-numeric characters
            let value = input.value.replace(/\D/g, '');

            // Ensure it starts with 09 and limit to 11 digits
            if (value.length > 0) {
                if (!value.startsWith('09')) {
                    value = '09' + value.replace(/^09/, '');
                }
                value = value.substring(0, 11); // Limit to 11 digits

                // Format as 09XX-XXX-XXXX
                if (value.length <= 4) {
                    // Just show the beginning
                } else if (value.length <= 7) {
                    value = value.slice(0, 4) + '-' + value.slice(4);
                } else {
                    value = value.slice(0, 4) + '-' + value.slice(4, 7) + '-' + value.slice(7, 11);
                }
            }

            input.value = value;
        }


        function updateNewPasswordStrength() {
            const password = document.getElementById('newPassword').value;
            const bars = document.querySelectorAll('.new-password-bar');
            const text = document.querySelector('.new-password-text');
            
            if (!password) {
                bars.forEach(bar => bar.className = 'new-password-bar bg-gray-200 rounded-full h-1 flex-1');
                text.textContent = 'Enter a password';
                text.className = 'new-password-text text-gray-500 mt-1';
                return;
            }

            const { strength, feedback } = checkPasswordStrength(password);
            const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
            const texts = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
            const textColors = ['text-red-600', 'text-orange-600', 'text-yellow-600', 'text-blue-600', 'text-green-600'];

            bars.forEach((bar, index) => {
                bar.className = `new-password-bar rounded-full h-1 flex-1 ${index < strength ? colors[strength - 1] : 'bg-gray-200'}`;
            });

            text.textContent = feedback.length ? feedback.join(', ') : texts[strength - 1];
            text.className = `new-password-text mt-1 ${feedback.length ? 'text-gray-600' : textColors[strength - 1]}`;
            }

            function checkNewPasswordMatch() {
            const password = document.getElementById('newPassword').value;
            const confirm = document.getElementById('confirmNewPassword').value;
            const matchDiv = document.getElementById('new-password-match');
            
            if (!confirm) {
                matchDiv.textContent = '';
                return false;
            }
            
            if (password === confirm) {
                matchDiv.textContent = '✓ Passwords match';
                matchDiv.className = 'mt-1 text-xs text-green-600';
                return true;
            } else {
                matchDiv.textContent = '✗ Passwords do not match';
                matchDiv.className = 'mt-1 text-xs text-red-600';
                return false;
            }
            }

            function validateNewPasswordForm() {
            const password = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmNewPassword').value;
            const passwordsMatch = checkNewPasswordMatch();
            const { strength } = checkPasswordStrength(password);
            
            const resetBtn = document.getElementById('resetPasswordBtn');
            const isValid = password.trim() && confirmPassword.trim() && passwordsMatch && strength >= 2;
            
            if (isValid) {
                resetBtn.disabled = false;
                resetBtn.className = 'w-full bg-primary hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors';
            } else {
                resetBtn.disabled = true;
                resetBtn.className = 'w-full bg-gray-300 text-gray-500 py-3 rounded-lg font-medium cursor-not-allowed transition-colors';
            }
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

        // Real-time field validation functions
        function validateField(fieldId, validator, errorMessage) {
            const field = document.getElementById(fieldId);
            const value = field.value.trim();
            let errorElement = document.getElementById(fieldId + 'Error');

            // Create error element if it doesn't exist
            if (!errorElement) {
                errorElement = document.createElement('p');
                errorElement.id = fieldId + 'Error';
                errorElement.className = 'text-xs text-red-600 mt-1';
                field.parentNode.appendChild(errorElement);
            }

            if (value === '') {
                errorElement.textContent = '';
                field.classList.remove('border-red-500', 'border-green-500');
                return false;
            }

            if (validator(value)) {
                errorElement.textContent = '';
                field.classList.remove('border-red-500');
                field.classList.add('border-green-500');
                return true;
            } else {
                errorElement.textContent = errorMessage;
                field.classList.remove('border-green-500');
                field.classList.add('border-red-500');
                return false;
            }
        }

        function validateFirstName() {
            return validateField('firstName', validateName, 'First name can only contain letters and spaces');
        }

        function validateLastName() {
            return validateField('lastName', validateName, 'Last name can only contain letters and spaces');
        }

        function validateSignupEmail() {
            return validateField('signupEmail', validateEmail, 'Email must contain "@" and end with ".com"');
        }

        function validateSignupPhone() {
            return validateField('signupPhone', validatePhoneNumber, 'Phone number must start with "09" and be exactly 11 digits');
        }

        // Initialize page
        document.addEventListener('DOMContentLoaded', function() {
            // Check URL parameters
            const currentUrlParams = new URLSearchParams(window.location.search);
            const isVerified = currentUrlParams.get('verified') === 'true';

            // Skip auto-login check if user just verified their email
            if (!isVerified) {
                // Check if user is already logged in
                const token = localStorage.getItem('authToken');
                if (token) {
                    // Verify token validity
                    fetch(`${API_BASE}auth.php`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ action: 'verify_token' })
                    })
                    .then(response => response.json())
                    .then(result => {
                        if (result.success) {
                            // Redirect to customer tracking if token is valid
                            window.location.href = 'customer_tracking.html';
                        } else {
                            // Remove invalid token
                            localStorage.removeItem('authToken');
                            localStorage.removeItem('userId');
                        }
                    })
                    .catch(() => {
                        // Remove token on error
                        localStorage.removeItem('authToken');
                        localStorage.removeItem('userId');
                    });
                }
            } else {
                // Clear the verified parameter from URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);

                // Show success message for newly verified users
                showNotification('Account verified successfully! Please sign in with your credentials.', 'success');
            }

            // Set up form event listeners
            document.getElementById('loginForm').addEventListener('submit', handleLogin);
            document.getElementById('signupForm').addEventListener('submit', handleSignup);
            document.getElementById('verificationForm').addEventListener('submit', handleVerification);
            document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
            document.getElementById('resetCodeForm').addEventListener('submit', handleResetCodeVerification);
            document.getElementById('newPasswordForm').addEventListener('submit', handleNewPassword);

            // Set up reset code inputs
            setupResetCodeInputs();

            // Set up verification code inputs
            setupVerificationInputs();


            // Set up password validation
            document.getElementById('signupPassword').addEventListener('input', function() {
                updatePasswordStrength();
                validateSignupForm();
            });


            document.getElementById('confirmPassword').addEventListener('input', function() {
                checkPasswordMatch();
                validateSignupForm();
            });

            // Set up new password validation
            document.getElementById('newPassword').addEventListener('input', function() {
                updateNewPasswordStrength();
                validateNewPasswordForm();
            });

            document.getElementById('confirmNewPassword').addEventListener('input', function() {
                checkNewPasswordMatch();
                validateNewPasswordForm();
            });

            // Set up field validation with real-time feedback
            document.getElementById('firstName').addEventListener('input', function() {
                // Remove any numbers or special characters
                this.value = this.value.replace(/[^a-zA-Z\s]/g, '');
                validateFirstName();
                validateSignupForm();
            });

            document.getElementById('firstName').addEventListener('keydown', function(e) {
                // Allow backspace, delete, tab, escape, enter, space, and arrow keys
                if ([8, 9, 27, 13, 32, 37, 38, 39, 40].includes(e.keyCode) ||
                    // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
                    (e.ctrlKey && [65, 67, 86, 88, 90].includes(e.keyCode))) {
                    return;
                }

                // Only allow letters
                if (!/[a-zA-Z]/.test(e.key)) {
                    e.preventDefault();
                }
            });

            document.getElementById('lastName').addEventListener('input', function() {
                // Remove any numbers or special characters
                this.value = this.value.replace(/[^a-zA-Z\s]/g, '');
                validateLastName();
                validateSignupForm();
            });

            document.getElementById('lastName').addEventListener('keydown', function(e) {
                // Allow backspace, delete, tab, escape, enter, space, and arrow keys
                if ([8, 9, 27, 13, 32, 37, 38, 39, 40].includes(e.keyCode) ||
                    // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
                    (e.ctrlKey && [65, 67, 86, 88, 90].includes(e.keyCode))) {
                    return;
                }

                // Only allow letters
                if (!/[a-zA-Z]/.test(e.key)) {
                    e.preventDefault();
                }
            });

            document.getElementById('signupEmail').addEventListener('input', function() {
                // Remove spaces
                this.value = this.value.replace(/\s/g, '');
                validateSignupEmail();
                validateSignupForm();
            });

            document.getElementById('signupEmail').addEventListener('keydown', function(e) {
                // Allow backspace, delete, tab, escape, enter, and arrow keys
                if ([8, 9, 27, 13, 37, 38, 39, 40].includes(e.keyCode) ||
                    // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
                    (e.ctrlKey && [65, 67, 86, 88, 90].includes(e.keyCode))) {
                    return;
                }

                // Prevent spaces
                if (e.key === ' ') {
                    e.preventDefault();
                }
            });

            document.getElementById('signupPhone').addEventListener('input', function() {
                // Auto-format phone number
                formatPhoneNumber(this);
                validateSignupPhone();
                validateSignupForm();
            });

            document.getElementById('signupPhone').addEventListener('keydown', function(e) {
                // Allow backspace, delete, tab, escape, enter, and arrow keys
                if ([8, 9, 27, 13, 37, 38, 39, 40].includes(e.keyCode) ||
                    // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
                    (e.ctrlKey && [65, 67, 86, 88, 90].includes(e.keyCode))) {
                    return;
                }

                // Prevent input if it would make the phone number invalid
                const currentValue = this.value;
                const selectionStart = this.selectionStart;
                const selectionEnd = this.selectionEnd;

                // If trying to delete the "09" prefix, prevent it
                if ((selectionStart <= 2 || selectionEnd <= 2) && (e.keyCode === 8 || e.keyCode === 46)) {
                    e.preventDefault();
                    return;
                }

                // Only allow numeric input
                if (!/[0-9]/.test(e.key)) {
                    e.preventDefault();
                }
            });

            document.getElementById('signupAddress').addEventListener('input', validateSignupForm);

            document.getElementById('agreeTerms').addEventListener('change', validateSignupForm);

            // Show login form by default
            showLoginForm();

            // Check URL parameters for special actions
            const urlParams = new URLSearchParams(window.location.search);
            const action = urlParams.get('action');

            if (action === 'signup') {
                showSignupForm();
            } else if (action === 'forgot') {
                showForgotPassword();
            }
        });