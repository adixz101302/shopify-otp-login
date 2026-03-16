import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    GoogleAuthProvider,
    signInWithPopup,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCPhGc_I5oEtKPeJP1ca2uYWjc8PzKmMmM",
    authDomain: "login-module-7b2f3.firebaseapp.com",
    projectId: "login-module-7b2f3",
    storageBucket: "login-module-7b2f3.firebasestorage.app",
    messagingSenderId: "183015095968",
    appId: "1:183015095968:web:886533d32bdc0acfd5d3c5",
    measurementId: "G-FYB3YGFYS7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.useDeviceLanguage();

// ─── Email Link: handle returning from email link on page load ─────────────
if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
        email = window.prompt('Please provide your email for confirmation') || '';
    }
    signInWithEmailLink(auth, email, window.location.href)
        .then((result) => {
            window.localStorage.removeItem('emailForSignIn');
            showSuccess(result.user.email || email);
        }).catch((error) => {
            console.error("Email Link Error:", error);
            showToast('Invalid or expired link. Please try again.', 'error');
        });
}

// ─── State ────────────────────────────────────────────────────────────────
let confirmationResult = null;
let countdownInterval = null;
let currentPhone = '';

// ─── Tab Switching ────────────────────────────────────────────────────────
window.switchTab = function(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('panel-' + tab).classList.add('active');
};

// ─── DOM Ready ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    const stepInput = document.getElementById('step-input');
    const stepOTP = document.getElementById('step-otp');
    const stepEmailSent = document.getElementById('step-email-sent');
    const stepSuccess = document.getElementById('step-success');
    const stepDesc = document.getElementById('step-description');

    // Build 6-digit OTP input boxes dynamically
    const otpContainer = document.getElementById('otp-container');
    for (let i = 0; i < 6; i++) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'otp-input';
        inp.maxLength = 1;
        inp.inputMode = 'numeric';
        inp.required = true;
        otpContainer.appendChild(inp);
    }
    const otpInputs = () => document.querySelectorAll('.otp-input');

    // OTP input: auto-advance & backspace
    otpContainer.addEventListener('input', (e) => {
        const inp = e.target;
        inp.value = inp.value.replace(/\D/g, '');
        const inputs = [...otpInputs()];
        const idx = inputs.indexOf(inp);
        if (inp.value && idx < inputs.length - 1) inputs[idx + 1].focus();
    });
    otpContainer.addEventListener('keydown', (e) => {
        const inputs = [...otpInputs()];
        const idx = inputs.indexOf(e.target);
        if (e.key === 'Backspace' && !e.target.value && idx > 0) inputs[idx - 1].focus();
    });

    // ── Init invisible reCAPTCHA ──────────────────────────────────────────
    function initRecaptcha() {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible',
                callback: () => console.log('reCAPTCHA solved'),
                'expired-callback': () => showToast('reCAPTCHA expired. Please try again.', 'error')
            });
        }
    }
    initRecaptcha();

    // ── Phone Form ────────────────────────────────────────────────────────
    document.getElementById('phone-form').addEventListener('submit', (e) => {
        e.preventDefault();

        currentPhone = document.getElementById('phone-input').value.trim();
        if (!currentPhone.startsWith('+')) {
            showToast('Include country code, e.g. +1 6505553434', 'error');
            return;
        }

        const btn = document.getElementById('btn-send-otp');
        toggleLoading(btn, true);

        signInWithPhoneNumber(auth, currentPhone, window.recaptchaVerifier)
            .then((result) => {
                confirmationResult = result;
                toggleLoading(btn, false);
                showToast('OTP sent!', 'success');
                switchStep(stepInput, stepOTP);
                stepDesc.textContent = `Enter the 6-digit code sent to ${currentPhone}`;
                setTimeout(() => otpInputs()[0].focus(), 400);
                startResendTimer(60);
            }).catch((err) => {
                toggleLoading(btn, false);
                console.error('SMS Error:', err);
                let msg = 'Failed to send OTP.';
                if (err.code === 'auth/invalid-phone-number') msg = 'Invalid phone number.';
                else if (err.code === 'auth/too-many-requests') msg = 'Too many requests. Wait a moment.';
                else if (err.code === 'auth/billing-not-enabled') msg = 'Billing not enabled. Please use a test number from Firebase Console.';
                showToast(msg, 'error');
                // Reset recaptcha on failure
                window.recaptchaVerifier.clear();
                window.recaptchaVerifier = null;
                initRecaptcha();
            });
    });

    // ── OTP Verify ────────────────────────────────────────────────────────
    document.getElementById('otp-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const code = [...otpInputs()].map(i => i.value).join('');
        if (code.length < 6) { showToast('Enter all 6 digits', 'error'); return; }
        if (!confirmationResult) { showToast('Session expired. Request a new code.', 'error'); return; }

        const btn = document.getElementById('btn-verify-otp');
        toggleLoading(btn, true);

        confirmationResult.confirm(code)
            .then((result) => {
                toggleLoading(btn, false);
                clearInterval(countdownInterval);
                showSuccess(result.user.phoneNumber || currentPhone);
                switchStep(stepOTP, stepSuccess);
                stepDesc.style.display = 'none';
            }).catch((err) => {
                toggleLoading(btn, false);
                console.error('Verify Error:', err);
                showToast('Incorrect code. Try again.', 'error');
                [...otpInputs()].forEach(i => i.value = '');
                otpInputs()[0].focus();
            });
    });

    // ── Back Button ──────────────────────────────────────────────────────
    document.getElementById('btn-back').addEventListener('click', () => {
        switchStep(stepOTP, stepInput);
        stepDesc.textContent = 'Choose a sign-in method below';
        clearInterval(countdownInterval);
        [...otpInputs()].forEach(i => i.value = '');
    });

    // ── Resend ────────────────────────────────────────────────────────────
    document.getElementById('btn-resend').addEventListener('click', () => {
        const btn = document.getElementById('btn-resend');
        if (btn.disabled) return;
        btn.disabled = true;
        btn.textContent = 'Sending...';
        signInWithPhoneNumber(auth, currentPhone, window.recaptchaVerifier)
            .then((result) => {
                confirmationResult = result;
                showToast('New OTP sent!', 'success');
                startResendTimer(60);
                otpInputs()[0].focus();
            }).catch((err) => {
                console.error('Resend Error:', err);
                showToast('Failed to resend OTP.', 'error');
                btn.disabled = false;
                btn.textContent = 'Resend Code';
            });
    });

    // ── Email Magic Link ──────────────────────────────────────────────────
    document.getElementById('email-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const email = document.getElementById('email-input').value.trim();
        if (!email) return;

        const btn = document.getElementById('btn-send-link');
        toggleLoading(btn, true);

        // The URL to redirect back to (your live Cloudflare URL or localhost)
        const actionCodeSettings = {
            url: window.location.href,  // current URL, works both locally and on Cloudflare
            handleCodeInApp: true
        };

        sendSignInLinkToEmail(auth, email, actionCodeSettings)
            .then(() => {
                // Save email locally to complete sign-in after return
                window.localStorage.setItem('emailForSignIn', email);
                toggleLoading(btn, false);
                document.getElementById('email-sent-desc').textContent =
                    `A magic sign-in link has been sent to ${email}. Click it to log in — no password needed!`;
                switchStep(stepInput, stepEmailSent);
                stepDesc.textContent = 'Check your email inbox';
            }).catch((err) => {
                toggleLoading(btn, false);
                console.error('Email Link Error:', err);
                let msg = 'Failed to send email link.';
                if (err.code === 'auth/unauthorized-continue-uri') {
                    msg = 'This domain is not authorized in Firebase. Add it to Authentication → Settings → Authorized Domains.';
                }
                showToast(msg, 'error');
            });
    });

    // ── Go back to input from email sent screen ───────────────────────────
    window.goBackToInput = function() {
        switchStep(stepEmailSent, stepInput);
        stepDesc.textContent = 'Choose a sign-in method below';
    };

    // ─── Helpers ──────────────────────────────────────────────────────────
    function switchStep(from, to) {
        from.classList.add('exit');
        setTimeout(() => {
            from.classList.remove('active', 'exit');
            to.classList.add('active');
        }, 350);
    }

    function toggleLoading(btn, loading) {
        const t = btn.querySelector('.btn-text');
        const l = btn.querySelector('.loader');
        if (loading) {
            t.style.opacity = '0.5';
            l.classList.remove('hidden');
            btn.disabled = true;
        } else {
            t.style.opacity = '1';
            l.classList.add('hidden');
            btn.disabled = false;
        }
    }

    function startResendTimer(secs) {
        const btn = document.getElementById('btn-resend');
        btn.disabled = true;
        btn.style.color = 'var(--text-muted)';
        clearInterval(countdownInterval);
        let left = secs;
        update(left);
        countdownInterval = setInterval(() => {
            left--;
            if (left <= 0) {
                clearInterval(countdownInterval);
                btn.disabled = false;
                btn.textContent = 'Resend Code';
                btn.style.color = 'var(--primary-color)';
            } else update(left);
        }, 1000);
        function update(t) {
            const m = Math.floor(t / 60), s = t % 60;
            btn.textContent = `Resend (${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')})`;
        }
    }

    function showSuccess(identifier) {
        const desc = document.getElementById('success-desc');
        desc.textContent = `Welcome! Logged in as ${identifier}. Redirecting...`;
        // Switch all steps off and show success
        document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
        stepSuccess.classList.add('active');
        document.getElementById('step-description').style.display = 'none';
        // Redirect to dashboard after a short delay
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    }

});

// ── Google Login (callable from HTML onclick) ─────────────────────────────
window.loginWithGoogle = function() {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    showToast('Connecting to Google...', 'info');

    signInWithPopup(auth, provider)
        .then((result) => {
            showToast('Google login successful!', 'success');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
        }).catch((err) => {
            console.error('Google Login Error:', err);
            if (err.code !== 'auth/popup-closed-by-user') {
                showToast('Google login failed: ' + err.message, 'error');
            }
        });
};

// ── Toast notification system ─────────────────────────────────────────────
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';

    const icons = {
        success: '<i class="ri-checkbox-circle-line" style="color:var(--success-color)"></i>',
        error:   '<i class="ri-error-warning-line" style="color:var(--danger-color)"></i>',
        info:    '<i class="ri-information-line" style="color:var(--primary-color)"></i>'
    };
    toast.innerHTML = `${icons[type] || icons.info} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
};
