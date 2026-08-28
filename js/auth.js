/* auth.js - نظام المصادقة الكامل */
const Auth = {
    currentUser: null,
    authListener: null,
    
    init() {
        // التحقق من وجود Firebase
        if (typeof firebase === 'undefined') {
            console.warn('⚠️ Firebase غير محمّل، العمل بدون مصادقة');
            this.showOfflineMode();
            return;
        }
        
        // الاستماع لتغيرات حالة المصادقة
        this.authListener = firebase.auth().onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                this.onLogin(user);
            } else {
                this.onLogout();
            }
        });
    },

    showOfflineMode() {
        // إخفاء شاشة تسجيل الدخول والعمل محلياً
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) loginScreen.style.display = 'none';
        document.body.classList.add('offline-mode');
    },

    // ============ Google Sign-In ============
    async signInWithGoogle() {
        if (typeof firebase === 'undefined') {
            Toast.error('خطأ', 'Firebase غير متاح');
            return null;
        }
        
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            // للوصول لـ Google Drive (لاحقاً)
            provider.addScope('https://www.googleapis.com/auth/drive.appdata');
            
            const result = await firebase.auth().signInWithPopup(provider);
            Toast.success('مرحباً! 👋', `أهلاً ${result.user.displayName}`);
            
            // حفظ التفضيل
            localStorage.setItem('preferred_signin', 'google');
            
            return result.user;
        } catch (error) {
            this.handleError(error);
            return null;
        }
    },

    // ============ Email/Password Sign Up ============
    async signUpWithEmail(email, password, displayName) {
        if (typeof firebase === 'undefined') {
            Toast.error('خطأ', 'Firebase غير متاح');
            return null;
        }
        
        try {
            // التحقق من صحة الإيميل
            if (!this.validateEmail(email)) {
                Toast.error('خطأ', 'الإيميل غير صحيح');
                return null;
            }
            
            // التحقق من قوة كلمة السر
            if (password.length < 6) {
                Toast.error('خطأ', 'كلمة السر لازم تكون 6 أحرف على الأقل');
                return null;
            }
            
            // إنشاء الحساب
            const result = await firebase.auth()
                .createUserWithEmailAndPassword(email, password);
            
            // تحديث الاسم
            await result.user.updateProfile({ displayName });
            
            // إرسال إيميل التحقق
            await this.sendVerificationEmail(result.user);
            
            Toast.success('تم التسجيل! 🎉', 
                'تم إرسال رابط التحقق للإيميل (صالح لمدة ساعة)');
            
            // حفظ وقت الإرسال للتحقق من الصلاحية
            localStorage.setItem('verification_sent_at', Date.now().toString());
            
            return result.user;
        } catch (error) {
            this.handleError(error);
            return null;
        }
    },

    // ============ Email Verification ============
    async sendVerificationEmail(user) {
        const actionCodeSettings = {
            url: window.location.origin + '/index.html?verify=true',
            handleCodeInApp: false
        };
        
        try {
            await user.sendEmailVerification(actionCodeSettings);
            return true;
        } catch (error) {
            console.error('Verification email error:', error);
            return false;
        }
    },

    async verifyEmailCode(oobCode) {
        if (typeof firebase === 'undefined') return false;
        
        try {
            // التحقق من صلاحية الكود (ساعة واحدة)
            const sentAt = parseInt(localStorage.getItem('verification_sent_at') || '0');
            const oneHour = 60 * 60 * 1000;
            
            if (Date.now() - sentAt > oneHour) {
                Toast.error('انتهت الصلاحية ⏰', 
                    'رمز التحقق انتهى. اطلب رمز جديد');
                return false;
            }
            
            // تطبيق كود التحقق
            await firebase.auth().applyActionCode(oobCode);
            
            // إعادة تحميل المستخدم
            await firebase.auth().currentUser.reload();
            
            Toast.success('تم التحقق! ✅', 'إيميلك اتأكد بنجاح');
            localStorage.removeItem('verification_sent_at');
            
            return true;
        } catch (error) {
            console.error('Verify error:', error);
            
            if (error.code === 'auth/invalid-action-code') {
                Toast.error('خطأ', 'رمز التحقق غير صحيح أو مستخدم قبل كده');
            } else if (error.code === 'auth/expired-action-code') {
                Toast.error('انتهت الصلاحية', 'رمز التحقق انتهى');
            } else {
                Toast.error('خطأ', 'فشل التحقق من الإيميل');
            }
            
            return false;
        }
    },

    async resendVerification() {
        const user = firebase.auth().currentUser;
        if (!user) {
            Toast.error('خطأ', 'لازم تسجل دخول الأول');
            return;
        }
        
        if (user.emailVerified) {
            Toast.info('تم التحقق بالفعل', 'إيميلك متحقق منه');
            return;
        }
        
        const success = await this.sendVerificationEmail(user);
        if (success) {
            localStorage.setItem('verification_sent_at', Date.now().toString());
            Toast.success('تم الإرسال 📧', 'تحقق من إيميلك');
        } else {
            Toast.error('خطأ', 'فشل إرسال إيميل التحقق');
        }
    },

    // ============ Email Sign In ============
    async signInWithEmail(email, password) {
        if (typeof firebase === 'undefined') {
            Toast.error('خطأ', 'Firebase غير متاح');
            return null;
        }
        
        try {
            const result = await firebase.auth()
                .signInWithEmailAndPassword(email, password);
            
            // التحقق من حالة الإيميل
            if (!result.user.emailVerified) {
                const resend = confirm(
                    '⚠️ الإيميل مش متحقق منه!\n\n' +
                    'ممكن تستخدم التطبيق، لكن ننصحك تتحقق.\n\n' +
                    'تحب نبعترلك رابط تحقق جديد؟'
                );
                if (resend) {
                    await this.resendVerification();
                }
            }
            
            localStorage.setItem('preferred_signin', 'email');
            return result.user;
        } catch (error) {
            this.handleError(error);
            return null;
        }
    },

    // ============ Password Reset ============
    async resetPassword(email) {
        if (typeof firebase === 'undefined') {
            Toast.error('خطأ', 'Firebase غير متاح');
            return false;
        }
        
        if (!this.validateEmail(email)) {
            Toast.error('خطأ', 'الإيميل غير صحيح');
            return false;
        }
        
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            Toast.success('تم الإرسال 📧', 
                'رابط استعادة كلمة السر وصل للإيميل');
            return true;
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                Toast.error('خطأ', 'مفيش حساب بالإيميل ده');
            } else {
                this.handleError(error);
            }
            return false;
        }
    },

    // ============ Sign Out ============
    async signOut() {
        if (typeof firebase === 'undefined') return;
        
        try {
            await firebase.auth().signOut();
            Toast.info('تم تسجيل الخروج 👋', 'باي!');
            localStorage.removeItem('preferred_signin');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    },

    // ============ Event Handlers ============
    onLogin(user) {
        console.log('✅ Logged in:', user.email);
        document.body.classList.add('logged-in');
        document.body.classList.remove('offline-mode');
        
        // إخفاء شاشة تسجيل الدخول
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) loginScreen.style.display = 'none';
        
        // تحديث UI
        this.updateUserUI(user);
        
        // تحميل البيانات من السحابة
        if (typeof CloudStorage !== 'undefined') {
            CloudStorage.init();
            CloudStorage.loadUserData(user.uid);
        }
        
        // حفظ آخر دخول
        localStorage.setItem('last_login', Date.now().toString());
    },

    onLogout() {
        console.log('👋 Logged out');
        document.body.classList.remove('logged-in');
        
        // إظهار شاشة تسجيل الدخول
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) loginScreen.style.display = 'flex';
        
        this.clearUserUI();
    },

    updateUserUI(user) {
        // البحث عن عناصر المستخدم في الواجهة
        const userElements = {
            name: document.querySelector('[data-user-name]'),
            email: document.querySelector('[data-user-email]'),
            avatar: document.querySelector('[data-user-avatar]'),
            verified: document.querySelector('[data-user-verified]')
        };
        
        if (userElements.name) {
            userElements.name.textContent = user.displayName || 'مستخدم';
        }
        
        if (userElements.email) {
            userElements.email.textContent = user.email;
        }
        
        if (userElements.avatar) {
            userElements.avatar.src = user.photoURL || 
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%236C63FF" width="100" height="100"/><text x="50" y="60" font-size="50" text-anchor="middle" fill="white">👤</text></svg>';
        }
        
        if (userElements.verified) {
            userElements.verified.textContent = user.emailVerified ? 
                '✅ موثق' : '⚠️ غير موثق';
        }
    },

    clearUserUI() {
        const userElements = document.querySelectorAll('[data-user-name], [data-user-email], [data-user-avatar]');
        userElements.forEach(el => {
            if (el.tagName === 'IMG') {
                el.src = '';
            } else {
                el.textContent = '';
            }
        });
    },

    handleError(error) {
        console.error('Auth error:', error);
        
        const messages = {
            'auth/user-not-found': 'مفيش حساب بالإيميل ده',
            'auth/wrong-password': 'كلمة السر غلط',
            'auth/invalid-email': 'الإيميل غير صحيح',
            'auth/email-already-in-use': 'الإيميل ده مستخدم قبل كده',
            'auth/weak-password': 'كلمة السر ضعيفة (6 أحرف على الأقل)',
            'auth/too-many-requests': 'محاولات كتير، استنى شوية',
            'auth/popup-closed-by-user': 'تم إلغاء العملية',
            'auth/popup-blocked': 'المتصفح منع النافذة المنبثقة، اسمح بيها',
            'auth/network-request-failed': 'مشكلة في الاتصال بالإنترنت',
            'auth/invalid-credential': 'بيانات الدخول غير صحيحة'
        };
        
        const message = messages[error.code] || error.message || 'حصل خطأ، حاول تاني';
        Toast.error('خطأ ❌', message);
    },

    // ============ Helpers ============
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    isLoggedIn() {
        return this.currentUser !== null;
    },

    isEmailVerified() {
        return this.currentUser?.emailVerified || false;
    },

    getUserData() {
        if (!this.currentUser) return null;
        
        return {
            uid: this.currentUser.uid,
            email: this.currentUser.email,
            displayName: this.currentUser.displayName,
            photoURL: this.currentUser.photoURL,
            emailVerified: this.currentUser.emailVerified,
            provider: this.currentUser.providerData[0]?.providerId
        };
    },

    // ============ Check URL for verification ============
    checkUrlForVerification() {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        const oobCode = urlParams.get('oobCode');
        
        if (mode === 'verifyEmail' && oobCode) {
            this.verifyEmailCode(oobCode);
            // تنظيف الـ URL
            window.history.replaceState({}, '', window.location.pathname);
        }
    },

    cleanup() {
        if (this.authListener) {
            this.authListener();
        }
    }
};

// تهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
    Auth.checkUrlForVerification();
});

// تنظيف عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
    Auth.cleanup();
});

window.Auth = Auth;
