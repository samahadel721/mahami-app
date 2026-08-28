const CACHE = 'mahami-v3';
const FILES = [
    'index.html', 'manifest.json',
    'css/style.css', 'css/animations.css', 'css/responsive.css',
    'js/utils.js', 'js/storage.js', 'js/toast.js', 'js/modal.js', 'js/tasks.js',
    'js/reminders.js', 'js/search.js', 'js/ui.js', 'js/app.js',
    'js/features/confetti.js', 'js/features/undo.js', 'js/features/themes.js',
    'js/features/i18n.js', 'js/features/pin.js', 'js/features/subtasks.js',
    'js/features/attachments.js', 'js/features/pomodoro.js', 'js/features/badges.js',
    'js/features/subjects.js', 'js/features/gpa.js', 'js/features/notes.js',
    'js/features/goals.js', 'js/features/calendar.js', 'js/features/reports.js',
    'js/features/templates.js', 'js/features/suggestions.js'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        caches.match(e.request).then(r => {
            if (r) {
                fetch(e.request).then(nr => {
                    if (nr && nr.status === 200) caches.open(CACHE).then(c => c.put(e.request, nr));
                }).catch(() => {});
                return r;
            }
            return fetch(e.request).then(nr => {
                if (nr && nr.status === 200) {
                    const clone = nr.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return nr;
            }).catch(() => e.request.mode === 'navigate' ? caches.match('index.html') : new Response('Offline', {status:503}));
        })
    );
});
