/* app.js - الملف الرئيسي الشامل */
const App = {
    currentScreen: 'Home',
    screenTitles: { Home: 'مهامي', Focus: 'وقت التركيز', Learn: 'تعلم', Stats: 'الإحصائيات', Settings: 'الإعدادات' },

    init() {
        Storage.init();
        Toast.init();
        Themes.init();
        I18n.init();
        PIN.init();
        UI.updateDateDisplay();
        this.navigate('Home');
        Reminders.init();
        Suggestions.init();
        this.registerEvents();
        this.registerSW();
        // Update streak daily check
        this.checkStreak();
    },

    registerEvents() {
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') { Modal.close(); Modal.closeDetail(); Modal.closeConfirm(); }
            if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); Modal.open(); }
            if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); document.getElementById('searchInput')?.focus(); }
            if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); Undo.undo(); }
        });
        setInterval(() => UI.updateDateDisplay(), 60000);
    },

    navigate(screen) {
        this.currentScreen = screen;
        UI.currentScreen = screen;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('screen' + screen)?.classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.screen === screen));
        UI.updateScreenTitle(this.screenTitles[screen] || 'مهامي');
        UI.updateSearchVisibility();
        UI.render();
        const main = document.getElementById('mainContent');
        if (main) main.scrollTop = 0;
    },

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark');
        Storage.setTheme(isDark ? 'dark' : 'light');
        document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = isDark ? '#1E1E1E' : Storage.getColor();
        Toast.info(isDark ? '🌙 ليلي' : '☀️ نهاري', 'تم تغيير المظهر');
        if (this.currentScreen === 'Settings') UI.renderSettings();
    },

    cycleColor() { Themes.cycle(); },

    async requestNotifications() {
        await Reminders.requestPermission();
        if (this.currentScreen === 'Settings') UI.renderSettings();
    },

    exportData() {
        const data = Storage.exportAll();
        Utils.downloadJSON(data, `mahami-backup-${Utils.getTodayISO()}.json`);
        Toast.success('تم التصدير 📤', 'نسخة احتياطية');
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                Storage.importAll(data);
                Toast.success('تم الاستيراد 📥', `${data.tasks?.length || 0} مهمة`);
                UI.render();
            } catch { Toast.error('خطأ', 'ملف غير صالح'); }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    clearAllData() {
        Modal.openConfirm('⚠️ حذف الكل', 'سيتم حذف كل شيء نهائياً!', () => {
            Storage.clearAll();
            Toast.success('تم الحذف', 'كل البيانات حُذفت');
            setTimeout(() => location.reload(), 800);
        });
    },

    checkStreak() {
        const streak = Storage.getStreak();
        const today = Utils.getTodayISO();
        if (streak.lastDate && streak.lastDate !== today) {
            const lastDate = new Date(streak.lastDate);
            const diff = Utils.daysBetween(lastDate, new Date());
            if (diff > 1) {
                streak.current = 0;
                Storage.saveStreak(streak);
            }
        }
    },

    registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Apply saved theme
    if (Storage.getTheme() === 'dark') {
        document.body.classList.add('dark');
        const btn = document.getElementById('themeBtn');
        if (btn) btn.textContent = '☀️';
    }
    
    // إنشاء الـ Footer ديناميكياً من AppConfig
    if (typeof AppConfig !== 'undefined') {
        const footerContainer = document.getElementById('appFooterContainer');
        if (footerContainer) {
            footerContainer.innerHTML = AppConfig.getFooterHTML();
        }
    }
    
    App.init();
});
