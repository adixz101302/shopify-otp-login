import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
    getAuth, 
    RecaptchaVerifier, 
    signInWithPhoneNumber,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCPhGc_I5oEtKPeJP1ca2uYWjc8PzKmMmM",
  authDomain: "login-module-7b2f3.firebaseapp.com",
  projectId: "login-module-7b2f3",
  storageBucket: "login-module-7b2f3.firebasestorage.app",
  messagingSenderId: "183015095968",
  appId: "1:183015095968:web:886533d32bdc0acfd5d3c5",
  measurementId: "G-FYB3YGFYS7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.useDeviceLanguage();

// Global variable to store the confirmation result for OTP
let confirmationResult = null;

// Initialize reCAPTCHA
function initRecaptcha() {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                // reCAPTCHA solved, allow signInWithPhoneNumber.
                console.log("Recaptcha solved");
            },
            'expired-callback': () => {
                // Response expired. Ask user to solve reCAPTCHA again.
                showToast("reCAPTCHA expired. Please try again.", "error");
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    // UI Elements
    const stepInput = document.getElementById('step-input');
    const stepOTP = document.getElementById('step-otp');
    const stepSuccess = document.getElementById('step-success');
    
    const contactForm = document.getElementById('contact-form');
    const contactInput = document.getElementById('contact-input');
    const btnSendOTP = document.getElementById('btn-send-otp');
    
    const otpForm = document.getElementById('otp-form');
    const otpContainer = document.querySelector('.otp-container');
    
    // We need 6 inputs for Firebase OTP (usually 6 digits)
    otpContainer.innerHTML = '';
    for(let i=0; i<6; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'otp-input';
        input.maxLength = 1;
        input.pattern = '\\d';
        input.required = true;
        otpContainer.appendChild(input);
    }
    const otpInputs = document.querySelectorAll('.otp-input');
    
    const btnVerifyOTP = document.getElementById('btn-verify-otp');
    const btnBack = document.getElementById('btn-back');
    const btnResend = document.getElementById('btn-resend');
    const stepDescription = document.getElementById('step-description');
    
    // State
    let currentUserPhone = '';
    let countdownInterval;
    
    // Initialise Recaptcha
    initRecaptcha();
    
    // Flow: Enter Phone -> Send OTP
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        currentUserPhone = contactInput.value.trim();
        
        // Basic E.164 format validation for Firebase (+[country code][number])
        if (!currentUserPhone.startsWith('+')) {
            showToast('Please include your country code (e.g., +1 for US)', 'error');
            return;
        }
        
        if (!currentUserPhone) return;
        
        // Show Loading State
        toggleLoading(btnSendOTP, true);
        
        const appVerifier = window.recaptchaVerifier;
        
        // Real Firebase SMS API Call
        signInWithPhoneNumber(auth, currentUserPhone, appVerifier)
            .then((confResult) => {
                // SMS sent. Prompt user to type the code from the message, then sign in.
                confirmationResult = confResult;
                
                toggleLoading(btnSendOTP, false);
                showToast(`OTP sent to ${currentUserPhone}`, 'success');
                
                // Switch UI to OTP step
                switchStep(stepInput, stepOTP);
                stepDescription.textContent = `Enter the 6-digit code sent to ${currentUserPhone}`;
                
                // Focus first OTP input
                setTimeout(() => otpInputs[0].focus(), 500);
                
                // Start Resend Timer
                startResendTimer(60); // 60s for real SMS constraints
            }).catch((error) => {
                toggleLoading(btnSendOTP, false);
                console.error("SMS Sending Error:", error);
                
                let errorMsg = "Failed to send SMS.";
                if (error.code === 'auth/invalid-phone-number') {
                    errorMsg = "Invalid phone number format.";
                } else if (error.code === 'auth/too-many-requests') {
                    errorMsg = "Too many requests. Try again later.";
                }
                
                showToast(errorMsg, "error");
                
                // Reset recaptcha if it fails
                if (window.recaptchaVerifier) {
                    window.recaptchaVerifier.render().then(function(widgetId) {
                      grecaptcha.reset(widgetId);
                    });
                }
            });
    });
    
    // OTP Inputs Logic: Auto-advance and Backspace
    otpInputs.forEach((input, index) => {
        // Prevent non-numeric
        input.addEventListener('input', (e) => {
            input.value = input.value.replace(/\D/g, '');
            if (input.value && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });
        
        // Handle Backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });
    
    // Flow: Enter OTP -> Verify
    otpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Gather OTP (6 digits for Firebase)
        const otpCode = Array.from(otpInputs).map(i => i.value).join('');
        if (otpCode.length < 6) {
            showToast('Please enter all 6 digits', 'error');
            return;
        }
        
        if (!confirmationResult) {
            showToast('Session expired. Please request a new code.', 'error');
            return;
        }
        
        // Show Loading State
        toggleLoading(btnVerifyOTP, true);
        
        // Real Firebase OTP Verification
        confirmationResult.confirm(otpCode).then((result) => {
            // User signed in successfully.
            const user = result.user;
            toggleLoading(btnVerifyOTP, false);
            
            showToast('Login successful!', 'success');
            
            // Switch to success UI
            switchStep(stepOTP, stepSuccess);
            stepDescription.style.display = 'none';
            clearInterval(countdownInterval);
            
            // Update success text
            stepSuccess.querySelector('p').textContent = `Logged in as ${user.phoneNumber}. Redirecting...`;
            
        }).catch((error) => {
            // User couldn't sign in (bad verification code?)
            toggleLoading(btnVerifyOTP, false);
            console.error("OTP Verification Error:", error);
            showToast('Invalid verification code.', 'error');
            
            // Clear inputs for retry
            otpInputs.forEach(i => i.value = '');
            otpInputs[0].focus();
        });
    });
    
    // Flow: Back from OTP step -> Phone Input
    btnBack.addEventListener('click', () => {
        switchStep(stepOTP, stepInput);
        stepDescription.textContent = 'Sign in using your mobile number or email';
        stepDescription.style.display = 'block';
        clearInterval(countdownInterval);
        
        // Clear OTP inputs
        otpInputs.forEach(i => i.value = '');
    });
    
    // Flow: Resend OTP
    btnResend.addEventListener('click', () => {
        if (btnResend.disabled || !currentUserPhone) return;
        
        btnResend.disabled = true;
        btnResend.textContent = 'Sending...';
        
        const appVerifier = window.recaptchaVerifier;
        
        signInWithPhoneNumber(auth, currentUserPhone, appVerifier)
            .then((confResult) => {
                confirmationResult = confResult;
                showToast(`New OTP sent to ${currentUserPhone}`, 'success');
                startResendTimer(60);
                otpInputs[0].focus();
            }).catch((error) => {
                console.error("Resend Error:", error);
                showToast("Failed to resend SMS.", "error");
                btnResend.disabled = false;
                btnResend.textContent = 'Resend Code';
            });
    });
    
    // Handle Social Login (Google)
    window.simulateLogin = function(providerId) {
        if (providerId === 'Google') {
            const provider = new GoogleAuthProvider();
            showToast('Connecting to Google...');
            
            signInWithPopup(auth, provider)
              .then((result) => {
                const user = result.user;
                showToast('Google login successful!', 'success');
                
                document.querySelector('.active').classList.remove('active');
                stepSuccess.classList.add('active');
                stepDescription.style.display = 'none';
                
                stepSuccess.querySelector('p').textContent = `Welcome, ${user.displayName}! Redirecting...`;
              }).catch((error) => {
                console.error("Google Login Error:", error);
                showToast(`Login failed: ${error.message}`, 'error');
              });
        } else {
            showToast(`${providerId} login is not fully configured yet.`, 'error');
        }
    };
    
    // Utility functions
    function switchStep(fromStep, toStep) {
        fromStep.classList.add('exit');
        
        setTimeout(() => {
            fromStep.classList.remove('active', 'exit');
            toStep.classList.add('active');
            
            // Trigger reflow for animation
            void toStep.offsetWidth;
            toStep.style.opacity = '1';
            toStep.style.transform = 'translateX(0)';
            
        }, 400); // Wait for exit animation
    }
    
    function toggleLoading(button, isLoading) {
        const textSpan = button.querySelector('.btn-text');
        const loader = button.querySelector('.loader');
        
        if (isLoading) {
            textSpan.style.opacity = '0.5';
            loader.classList.remove('hidden');
            button.disabled = true;
        } else {
            textSpan.style.opacity = '1';
            loader.classList.add('hidden');
            button.disabled = false;
        }
    }
    
    function startResendTimer(seconds) {
        btnResend.disabled = true;
        btnResend.style.color = 'var(--text-muted)';
        
        clearInterval(countdownInterval);
        
        let timeLeft = seconds;
        updateResendText(timeLeft);
        
        countdownInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                btnResend.disabled = false;
                btnResend.textContent = 'Resend Code';
                btnResend.style.color = 'var(--primary-color)';
            } else {
                updateResendText(timeLeft);
            }
        }, 1000);
    }
    
    function updateResendText(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        btnResend.textContent = `Resend (${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')})`;
    }
    
});

// Toast notification system
function showToast(message, type = 'default') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let icon = '<i class="ri-information-line"></i>';
    if (type === 'error') {
        icon = '<i class="ri-error-warning-line" style="color: var(--danger-color)"></i>';
    } else if (type === 'success') {
        icon = '<i class="ri-checkbox-circle-line" style="color: var(--success-color)"></i>';
    }
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after 5 seconds to give time to read errors
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            toast.remove();
        }, 300); // Matches CSS animation duration
    }, 5000);
}
