// ==================== FIREBASE IMPORTS ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, getDoc, getDocs, where, updateDoc, deleteDoc, limit, writeBatch, deleteField } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// ==================== NEW FIREBASE CONFIG ====================
const firebaseConfig = {
    apiKey: "AIzaSyD08rOZO-wZaFhRoLFbaAR0uPYUbbTFxBw",
    authDomain: "netchat-2d11a.firebaseapp.com",
    projectId: "netchat-2d11a",
    storageBucket: "netchat-2d11a.firebasestorage.app",
    messagingSenderId: "650606370269",
    appId: "1:650606370269:web:4390147be62e5029a76a34",
    measurementId: "G-GK8LRFQRGD"
};

console.log("[NetChat] Initializing Firebase...");
let app, db;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("[NetChat] Firebase initialized successfully!");
} catch (err) {
    console.error("[NetChat] Firebase init FAILED:", err);
    alert("Firebase failed to initialize. Check console.");
}

// ==================== APP STATE ====================
let currentUser = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let profilePicBase64 = null;
let activeChatId = null;
let activeContact = null;
let messagesUnsubscribe = null;
let chatsUnsubscribe = null;
let statusUnsubscribe = null;
let onlineInterval = null;
let appSettings = {
    enterIsSend: false,
    readReceipts: true,
    wallpaper: 'default'
};

// Status viewer state
let statusViewerTimer = null;
let statusViewerProgress = 0;
let currentViewingStatus = null;

// ==================== DOM REFERENCES ====================
const dom = {};
function cacheDOM() {
    const ids = [
        'auth-screen','app-container','auth-profile-pic','auth-preview-img','auth-placeholder-icon',
        'auth-name','auth-phone','auth-btn','auth-btn-text','auth-btn-spinner',
        'hdr-menu-btn','header-dropdown','hdr-camera','hdr-search','chat-search-input',
        'view-chats','view-updates','view-communities','view-calls',
        'active-chats-list','archive-bar','archive-count','no-chats',
        'my-status-row','my-status-img','my-status-icon','my-status-text','status-list','no-statuses','nav-dot-updates',
        'chat-window-screen','close-chat-window','chat-messages','message-input',
        'voice-record-btn','mic-icon','send-icon','chat-file-input',
        'chat-window-title','chat-window-subtitle','chat-window-avatar-icon','chat-window-avatar-img','chat-window-online-dot',
        'chat-video-btn','chat-phone-btn','chat-menu-btn',
        'archive-drawer','close-archive-drawer','archived-chats-list-container',
        'settings-drawer','close-settings-drawer','menu-opt-settings',
        'settings-avatar','settings-avatar-fallback','settings-display-name','settings-phone','settings-profile-row',
        'chats-settings-panel','close-chats-settings',
        'notifications-settings-panel','close-notifications-settings',
        'privacy-settings-panel','close-privacy-settings',
        'account-settings-panel','close-account-settings',
        'storage-settings-panel','close-storage-settings',
        'floating-action-btn','fab-icon','nav-badge-chats',
        'new-chat-modal','close-new-chat','search-user-input','search-results','search-loading','search-empty',
        'contact-info-modal','contact-info-avatar','contact-info-fallback','contact-info-name','contact-info-phone','contact-info-status',
        'contact-info-message','contact-info-call','contact-info-video',
        'status-upload-modal','close-status-modal','status-preview-img','status-preview-icon','status-file-input','status-camera-btn',
        'wallpaper-modal','close-wallpaper-modal','wallpaper-option',
        'toast','toast-message',
        'toggle-enter-send','toggle-conv-tones','toggle-high-priority','toggle-read-receipts',
        // NEW ELEMENTS
        'logout-btn','delete-account-btn','delete-account-modal','confirm-delete-account','cancel-delete-account',
        'status-viewer-modal','status-viewer-close','status-viewer-image','status-viewer-avatar','status-viewer-avatar-fallback',
        'status-viewer-name','status-viewer-time','status-progress-bar','status-reply-input','status-reply-btn'
    ];
    ids.forEach(id => { 
        dom[id] = document.getElementById(id);
        if (!dom[id]) console.warn("[NetChat] DOM element missing:", id);
    });
    dom.navBtns = document.querySelectorAll('.nav-btn');
    dom.views = {
        chats: dom['view-chats'],
        updates: dom['view-updates'],
        communities: dom['view-communities'],
        calls: dom['view-calls']
    };
}

// ==================== UTILITIES ====================
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, t => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[t]||t));
}

function showToast(msg, dur=3000) {
    console.log("[NetChat Toast]", msg);
    const toast = dom.toast || document.getElementById('toast');
    const toastMsg = dom.toastMessage || document.getElementById('toast-message');
    if (toastMsg) toastMsg.textContent = msg;
    if (toast) {
        toast.classList.remove('hidden');
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, dur);
    }
}

function formatTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}

function formatDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff/60000) + ' min ago';
    if (diff < 86400000) return Math.floor(diff/3600000) + ' hours ago';
    if (diff < 604800000) return Math.floor(diff/86400000) + ' days ago';
    return d.toLocaleDateString();
}

function generateChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}

function setAuthLoading(loading) {
    const btnText = dom['auth-btn-text'];
    const spinner = dom['auth-btn-spinner'];
    const btn = dom['auth-btn'];
    if (btnText) btnText.textContent = loading ? 'Creating...' : 'Create Account';
    if (spinner) spinner.classList.toggle('hidden', !loading);
    if (btn) btn.disabled = loading;
}

// ==================== SESSION / AUTO-LOGIN ====================
function saveUserSession() {
    if (!currentUser) return;
    try {
        const sessionData = {
            uid: currentUser.uid,
            name: currentUser.name,
            phone: currentUser.phone,
            photoURL: currentUser.photoURL || '',
            about: currentUser.about || 'Hey there! I am using NetChat.'
        };
        localStorage.setItem('netchat_user_session', JSON.stringify(sessionData));
        console.log("[NetChat] User session saved");
    } catch (e) {
        console.error("[NetChat] Failed to save session:", e);
    }
}

function clearUserSession() {
    try {
        localStorage.removeItem('netchat_user_session');
        localStorage.removeItem('netchat_settings');
        console.log("[NetChat] User session cleared");
    } catch (e) {
        console.error("[NetChat] Failed to clear session:", e);
    }
}

async function restoreUserSession() {
    try {
        const saved = localStorage.getItem('netchat_user_session');
        if (!saved) return false;

        const sessionData = JSON.parse(saved);
        if (!sessionData.uid || !sessionData.phone) return false;

        console.log("[NetChat] Restoring session for:", sessionData.phone);

        // Verify user still exists in Firestore
        const userRef = doc(db, 'users', sessionData.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.log("[NetChat] Saved user no longer exists in database");
            clearUserSession();
            return false;
        }

        const userData = userSnap.data();
        currentUser = { 
            uid: sessionData.uid, 
            ...userData,
            photoURL: userData.photoURL || sessionData.photoURL || ''
        };

        console.log("[NetChat] Session restored for:", currentUser.name);
        showToast('Welcome back, ' + currentUser.name + '!');

        // Update UI and start app
        updateUserUI();
        dom['auth-screen'].classList.add('hidden');
        dom['app-container'].classList.remove('hidden');

        initChatsListener();
        initStatusListener();
        initCallsListener();
        startOnlineStatus();
        loadSettings();

        return true;
    } catch (err) {
        console.error("[NetChat] Session restore failed:", err);
        clearUserSession();
        return false;
    }
}

// ==================== AUTHENTICATION ====================
function initAuth() {
    console.log("[NetChat] Initializing auth...");

    // Profile pic preview - convert to base64 (no storage needed)
    const picInput = dom['auth-profile-pic'];
    if (picInput) {
        picInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Check file size (max 500KB for base64 in Firestore)
                if (file.size > 500000) {
                    showToast('Image too large. Max 500KB. Please choose a smaller image.');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (ev) => {
                    profilePicBase64 = ev.target.result;
                    dom['auth-preview-img'].src = profilePicBase64;
                    dom['auth-preview-img'].classList.remove('hidden');
                    dom['auth-placeholder-icon'].classList.add('hidden');
                    console.log("[NetChat] Profile pic loaded as base64");
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Create account
    const authBtn = dom['auth-btn'];
    if (authBtn) {
        authBtn.addEventListener('click', async () => {
            console.log("[NetChat] Create account clicked");

            const nameInput = dom['auth-name'];
            const phoneInput = dom['auth-phone'];

            if (!nameInput || !phoneInput) {
                console.error("[NetChat] Auth inputs not found!");
                showToast("Error: Form not loaded properly");
                return;
            }

            const name = nameInput.value.trim();
            const phone = phoneInput.value.trim();

            console.log("[NetChat] Name:", name, "Phone:", phone);

            if (!name) { showToast('Enter your name'); return; }
            if (!phone) { showToast('Enter your phone number'); return; }
            if (!phone.startsWith('+')) { showToast('Phone must start with + (e.g. +1234567890)'); return; }

            setAuthLoading(true);

            try {
                console.log("[NetChat] Checking if user exists...");

                // Check if phone already exists
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('phone', '==', phone), limit(1));
                console.log("[NetChat] Running query...");
                const snap = await getDocs(q);
                console.log("[NetChat] Query result:", snap.empty ? "No user found" : "User exists");

                if (!snap.empty) {
                    // Existing user - login
                    const userData = snap.docs[0].data();
                    currentUser = { uid: snap.docs[0].id, ...userData };
                    console.log("[NetChat] Logged in as:", currentUser.name);
                    showToast('Welcome back, ' + userData.name + '!');
                } else {
                    // New user - create
                    console.log("[NetChat] Creating new user...");
                    const uid = 'user_' + Date.now();

                    const userData = {
                        name, phone,
                        photoURL: profilePicBase64 || '',
                        createdAt: serverTimestamp(),
                        lastSeen: serverTimestamp(),
                        online: true,
                        about: 'Hey there! I am using NetChat.'
                    };

                    console.log("[NetChat] Writing user doc to Firestore...");
                    await setDoc(doc(db, 'users', uid), userData);
                    console.log("[NetChat] User doc written successfully!");

                    currentUser = { uid, ...userData };
                    showToast('Account created! Welcome, ' + name + '!');
                }

                // SAVE SESSION for auto-login
                saveUserSession();

                // Update UI
                updateUserUI();

                // Transition
                dom['auth-screen'].classList.add('hidden');
                dom['app-container'].classList.remove('hidden');

                // Init everything
                console.log("[NetChat] Starting app modules...");
                initChatsListener();
                initStatusListener();
                initCallsListener();
                startOnlineStatus();
                loadSettings();

            } catch (err) {
                console.error("[NetChat] AUTH ERROR:", err);
                console.error("[NetChat] Error code:", err.code);
                console.error("[NetChat] Error message:", err.message);

                let errorMsg = 'Failed to create account';
                if (err.code === 'permission-denied') {
                    errorMsg = 'Permission denied! Check Firestore rules';
                    console.log("%c[NetChat] FIRESTORE SECURITY RULES NEEDED:", "color: red; font-size: 16px; font-weight: bold;");
                    console.log("%cGo to: https://console.firebase.google.com/project/netchat-2d11a/firestore/rules", "color: cyan;");
                    console.log("%cPaste: rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }", "color: yellow; background: #1a1a1a; padding: 10px;");
                } else if (err.code === 'unauthenticated') {
                    errorMsg = 'Not authenticated with Firebase';
                } else if (err.code === 'not-found') {
                    errorMsg = 'Database not found - enable Firestore in Firebase console';
                } else if (err.message) {
                    errorMsg = err.message;
                }

                showToast('Error: ' + errorMsg, 5000);
            } finally {
                setAuthLoading(false);
            }
        });
    } else {
        console.error("[NetChat] Auth button not found!");
    }
}

function updateUserUI() {
    if (!currentUser) return;

    if (dom['settings-display-name']) dom['settings-display-name'].textContent = currentUser.name;
    if (dom['settings-phone']) dom['settings-phone'].textContent = currentUser.phone;

    if (currentUser.photoURL) {
        if (dom['settings-avatar']) {
            dom['settings-avatar'].src = currentUser.photoURL;
            dom['settings-avatar'].classList.remove('hidden');
        }
        if (dom['settings-avatar-fallback']) dom['settings-avatar-fallback'].classList.add('hidden');

        if (dom['my-status-img']) {
            dom['my-status-img'].src = currentUser.photoURL;
            dom['my-status-img'].classList.remove('hidden');
        }
        if (dom['my-status-icon']) dom['my-status-icon'].classList.add('hidden');
    }
}

// ==================== LOGOUT & DELETE ACCOUNT ====================
function initLogout() {
    // Logout button
    if (dom['logout-btn']) {
        dom['logout-btn'].addEventListener('click', async () => {
            console.log("[NetChat] Logging out...");

            // Set offline status
            if (currentUser) {
                try {
                    await updateDoc(doc(db, 'users', currentUser.uid), {
                        online: false,
                        lastSeen: serverTimestamp()
                    });
                } catch (e) {}
            }

            // Clear all listeners
            if (messagesUnsubscribe) { messagesUnsubscribe(); messagesUnsubscribe = null; }
            if (chatsUnsubscribe) { chatsUnsubscribe(); chatsUnsubscribe = null; }
            if (statusUnsubscribe) { statusUnsubscribe(); statusUnsubscribe = null; }
            if (onlineInterval) { clearInterval(onlineInterval); onlineInterval = null; }

            // Clear session
            clearUserSession();
            currentUser = null;
            activeChatId = null;
            activeContact = null;

            // Reset UI
            if (dom['active-chats-list']) dom['active-chats-list'].innerHTML = '';
            if (dom['status-list']) dom['status-list'].innerHTML = '';
            if (dom['calls-list']) dom['calls-list'].innerHTML = '';

            // Show auth screen
            dom['app-container'].classList.add('hidden');
            dom['auth-screen'].classList.remove('hidden');

            // Reset auth form
            if (dom['auth-name']) dom['auth-name'].value = '';
            if (dom['auth-phone']) dom['auth-phone'].value = '';
            if (dom['auth-preview-img']) {
                dom['auth-preview-img'].src = '';
                dom['auth-preview-img'].classList.add('hidden');
            }
            if (dom['auth-placeholder-icon']) dom['auth-placeholder-icon'].classList.remove('hidden');
            profilePicBase64 = null;

            showToast('Logged out successfully');
            console.log("[NetChat] User logged out");
        });
    }

    // Delete account button
    if (dom['delete-account-btn']) {
        dom['delete-account-btn'].addEventListener('click', () => {
            if (dom['delete-account-modal']) dom['delete-account-modal'].classList.remove('hidden');
        });
    }

    // Cancel delete
    if (dom['cancel-delete-account']) {
        dom['cancel-delete-account'].addEventListener('click', () => {
            if (dom['delete-account-modal']) dom['delete-account-modal'].classList.add('hidden');
        });
    }

    // Confirm delete
    if (dom['confirm-delete-account']) {
        dom['confirm-delete-account'].addEventListener('click', async () => {
            if (!currentUser) return;

            console.log("[NetChat] Deleting account...");
            showToast('Deleting account...', 5000);

            try {
                // Delete user's statuses
                const statusesRef = collection(db, 'statuses');
                const statusQuery = query(statusesRef, where('userId', '==', currentUser.uid));
                const statusSnap = await getDocs(statusQuery);
                const statusBatch = writeBatch(db);
                statusSnap.forEach(s => statusBatch.delete(s.ref));
                await statusBatch.commit();

                // Delete user's messages in all chats (mark as deleted)
                const chatsRef = collection(db, 'chats');
                const chatsQuery = query(chatsRef, where('participants', 'array-contains', currentUser.uid));
                const chatsSnap = await getDocs(chatsQuery);

                for (const chatDoc of chatsSnap.docs) {
                    const msgsRef = collection(db, 'chats', chatDoc.id, 'messages');
                    const msgsSnap = await getDocs(msgsRef);
                    const msgBatch = writeBatch(db);
                    msgsSnap.forEach(m => {
                        if (m.data().senderId === currentUser.uid) {
                            msgBatch.update(m.ref, { text: 'This message was deleted', mediaUrl: deleteField(), deleted: true });
                        }
                    });
                    await msgBatch.commit();
                }

                // Delete user document
                await deleteDoc(doc(db, 'users', currentUser.uid));

                // Clear everything
                clearUserSession();
                currentUser = null;

                // Reset UI
                if (dom['active-chats-list']) dom['active-chats-list'].innerHTML = '';
                if (dom['status-list']) dom['status-list'].innerHTML = '';

                dom['app-container'].classList.add('hidden');
                dom['auth-screen'].classList.remove('hidden');
                dom['delete-account-modal'].classList.add('hidden');

                // Reset form
                if (dom['auth-name']) dom['auth-name'].value = '';
                if (dom['auth-phone']) dom['auth-phone'].value = '';
                if (dom['auth-preview-img']) {
                    dom['auth-preview-img'].src = '';
                    dom['auth-preview-img'].classList.add('hidden');
                }
                if (dom['auth-placeholder-icon']) dom['auth-placeholder-icon'].classList.remove('hidden');
                profilePicBase64 = null;

                showToast('Account deleted. Create a new one to continue.');
                console.log("[NetChat] Account deleted");

            } catch (err) {
                console.error("[NetChat] Delete account error:", err);
                showToast('Failed to delete account: ' + err.message);
            }
        });
    }
}

// ==================== ONLINE STATUS ====================
function startOnlineStatus() {
    if (!currentUser) return;

    const updateOnline = async () => {
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                online: true,
                lastSeen: serverTimestamp()
            });
        } catch (e) {}
    };

    updateOnline();
    onlineInterval = setInterval(updateOnline, 30000);

    window.addEventListener('beforeunload', async () => {
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                online: false,
                lastSeen: serverTimestamp()
            });
        } catch (e) {}
    });
}

// ==================== CHATS LISTENER (SIMPLE & WORKING) ====================
let chatListBuilt = false;
let chatElements = {}; // chatId -> DOM element
let lastChatData = {}; // chatId -> stringified data for comparison

function initChatsListener() {
    if (!currentUser) return;
    console.log("[NetChat] Starting chats listener. UID:", currentUser.uid);

    if (chatsUnsubscribe) { chatsUnsubscribe(); chatsUnsubscribe = null; }

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', currentUser.uid));

    chatsUnsubscribe = onSnapshot(q, async (snapshot) => {
        console.log("[NetChat] onSnapshot:", snapshot.size, "docs");

        const listEl = document.getElementById('active-chats-list');
        if (!listEl) return;

        if (snapshot.empty) {
            listEl.innerHTML = '';
            chatElements = {};
            lastChatData = {};
            chatListBuilt = false;
            const noChats = document.getElementById('no-chats');
            if (noChats) noChats.classList.remove('hidden');
            updateUnreadBadge(0);
            return;
        }

        const noChats = document.getElementById('no-chats');
        if (noChats) noChats.classList.add('hidden');

        // First build: fetch everything
        if (!chatListBuilt) {
            console.log("[NetChat] First build - fetching all chats");
            listEl.innerHTML = '';
            chatElements = {};
            lastChatData = {};

            const chatData = [];
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const otherUid = data.participants?.find(p => p !== currentUser.uid);
                if (!otherUid) continue;

                try {
                    const userSnap = await getDoc(doc(db, 'users', otherUid));
                    const otherUser = userSnap.exists() ? userSnap.data() : { name: 'Unknown', photoURL: '' };

                    let lastMsg = null;
                    try {
                        const msgQ = query(collection(db, 'chats', docSnap.id, 'messages'), orderBy('timestamp', 'desc'), limit(1));
                        const msgSnap = await getDocs(msgQ);
                        if (!msgSnap.empty) lastMsg = msgSnap.docs[0].data();
                    } catch (e) {}

                    let unreadCount = 0;
                    try {
                        const unreadQ = query(collection(db, 'chats', docSnap.id, 'messages'), where('read', '==', false), where('senderId', '!=', currentUser.uid));
                        const unreadSnap = await getDocs(unreadQ);
                        unreadCount = unreadSnap.size;
                    } catch (e) {}

                    let sortTime = 0;
                    if (data.updatedAt?.toMillis) sortTime = data.updatedAt.toMillis();
                    else if (data.updatedAt) sortTime = new Date(data.updatedAt).getTime();
                    else if (data.createdAt?.toMillis) sortTime = data.createdAt.toMillis();
                    else if (data.createdAt) sortTime = new Date(data.createdAt).getTime();
                    else if (lastMsg?.timestamp?.toMillis) sortTime = lastMsg.timestamp.toMillis();
                    else if (lastMsg?.timestamp) sortTime = new Date(lastMsg.timestamp).getTime();
                    else sortTime = 0;

                    chatData.push({ id: docSnap.id, otherUid, otherUser, lastMsg, unreadCount, sortTime });
                } catch (err) {
                    console.error("[NetChat] Error:", err);
                }
            }

            chatData.sort((a, b) => b.sortTime - a.sortTime);

            let totalUnread = 0;
            chatData.forEach(chat => {
                totalUnread += chat.unreadCount;
                const el = buildChatItem(chat);
                listEl.appendChild(el);
                chatElements[chat.id] = el;
                lastChatData[chat.id] = chatToString(chat);
            });

            updateUnreadBadge(totalUnread);
            chatListBuilt = true;
            console.log("[NetChat] First build complete:", chatData.length, "chats");
            return;
        }

        // Subsequent updates: only update changed items, don't rebuild
        console.log("[NetChat] Incremental update");
        let needsReorder = false;
        let totalUnread = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const otherUid = data.participants?.find(p => p !== currentUser.uid);
            if (!otherUid) continue;

            // Check if this chat's data actually changed
            const el = chatElements[docSnap.id];
            if (!el) {
                // New chat appeared
                console.log("[NetChat] New chat:", docSnap.id);
                needsReorder = true;
                try {
                    const userSnap = await getDoc(doc(db, 'users', otherUid));
                    const otherUser = userSnap.exists() ? userSnap.data() : { name: 'Unknown', photoURL: '' };

                    let lastMsg = null;
                    try {
                        const msgQ = query(collection(db, 'chats', docSnap.id, 'messages'), orderBy('timestamp', 'desc'), limit(1));
                        const msgSnap = await getDocs(msgQ);
                        if (!msgSnap.empty) lastMsg = msgSnap.docs[0].data();
                    } catch (e) {}

                    let unreadCount = 0;
                    try {
                        const unreadQ = query(collection(db, 'chats', docSnap.id, 'messages'), where('read', '==', false), where('senderId', '!=', currentUser.uid));
                        const unreadSnap = await getDocs(unreadQ);
                        unreadCount = unreadSnap.size;
                    } catch (e) {}

                    let sortTime = 0;
                    if (data.updatedAt?.toMillis) sortTime = data.updatedAt.toMillis();
                    else if (data.updatedAt) sortTime = new Date(data.updatedAt).getTime();
                    else if (data.createdAt?.toMillis) sortTime = data.createdAt.toMillis();
                    else if (data.createdAt) sortTime = new Date(data.createdAt).getTime();
                    else if (lastMsg?.timestamp?.toMillis) sortTime = lastMsg.timestamp.toMillis();
                    else if (lastMsg?.timestamp) sortTime = new Date(lastMsg.timestamp).getTime();
                    else sortTime = 0;

                    const chat = { id: docSnap.id, otherUid, otherUser, lastMsg, unreadCount, sortTime };
                    const newEl = buildChatItem(chat);
                    listEl.appendChild(newEl);
                    chatElements[chat.id] = newEl;
                    lastChatData[chat.id] = chatToString(chat);
                } catch (err) {
                    console.error("[NetChat] Error adding new chat:", err);
                }
                continue;
            }

            // Existing chat - check if data changed
            try {
                const userSnap = await getDoc(doc(db, 'users', otherUid));
                const otherUser = userSnap.exists() ? userSnap.data() : { name: 'Unknown', photoURL: '' };

                let lastMsg = null;
                try {
                    const msgQ = query(collection(db, 'chats', docSnap.id, 'messages'), orderBy('timestamp', 'desc'), limit(1));
                    const msgSnap = await getDocs(msgQ);
                    if (!msgSnap.empty) lastMsg = msgSnap.docs[0].data();
                } catch (e) {}

                let unreadCount = 0;
                try {
                    const unreadQ = query(collection(db, 'chats', docSnap.id, 'messages'), where('read', '==', false), where('senderId', '!=', currentUser.uid));
                    const unreadSnap = await getDocs(unreadQ);
                    unreadCount = unreadSnap.size;
                } catch (e) {}

                let sortTime = 0;
                if (data.updatedAt?.toMillis) sortTime = data.updatedAt.toMillis();
                else if (data.updatedAt) sortTime = new Date(data.updatedAt).getTime();
                else if (data.createdAt?.toMillis) sortTime = data.createdAt.toMillis();
                else if (data.createdAt) sortTime = new Date(data.createdAt).getTime();
                else if (lastMsg?.timestamp?.toMillis) sortTime = lastMsg.timestamp.toMillis();
                else if (lastMsg?.timestamp) sortTime = new Date(lastMsg.timestamp).getTime();
                else sortTime = 0;

                const chat = { id: docSnap.id, otherUid, otherUser, lastMsg, unreadCount, sortTime };
                totalUnread += unreadCount;

                const newDataStr = chatToString(chat);
                const oldDataStr = lastChatData[docSnap.id];

                if (newDataStr !== oldDataStr) {
                    console.log("[NetChat] Chat changed:", docSnap.id);
                    lastChatData[docSnap.id] = newDataStr;

                    // Check if position changed (sortTime)
                    if (oldDataStr) {
                        const oldSort = parseInt(oldDataStr.split('|')[0]) || 0;
                        if (Math.abs(oldSort - sortTime) > 1000) {
                            needsReorder = true;
                        }
                    }

                    // Update the element in place
                    updateChatItem(el, chat);
                }
            } catch (err) {
                console.error("[NetChat] Error updating chat:", err);
            }
        }

        // Remove deleted chats
        const currentIds = new Set(snapshot.docs.map(d => d.id));
        for (const [chatId, el] of Object.entries(chatElements)) {
            if (!currentIds.has(chatId)) {
                console.log("[NetChat] Removing chat:", chatId);
                el.remove();
                delete chatElements[chatId];
                delete lastChatData[chatId];
            }
        }

        // Reorder if needed
        if (needsReorder) {
            console.log("[NetChat] Reordering chats");
            const items = Object.entries(chatElements).map(([id, el]) => {
                const sortTime = parseInt(el.dataset.sortTime) || 0;
                return { id, el, sortTime };
            });
            items.sort((a, b) => b.sortTime - a.sortTime);
            items.forEach(item => listEl.appendChild(item.el));
        }

        updateUnreadBadge(totalUnread);
        console.log("[NetChat] Incremental update complete");

    }, (err) => {
        console.error("[NetChat] onSnapshot ERROR:", err);
        showToast('Chat sync error: ' + err.message);
    });
}

function chatToString(chat) {
    // Create a simple string representation for comparison
    const text = chat.lastMsg?.text || '';
    const media = chat.lastMsg?.mediaType || '';
    return `${chat.sortTime}|${chat.unreadCount}|${text}|${media}|${chat.otherUser?.online || false}`;
}

function buildChatItem(chat) {
    const other = chat.otherUser;
    const name = other.name || 'Unknown';
    const photo = other.photoURL || '';
    const isOnline = other.online === true;

    let lastText = 'Start chatting';
    if (chat.lastMsg) {
        if (chat.lastMsg.text) lastText = chat.lastMsg.text;
        else if (chat.lastMsg.mediaType?.startsWith('image/')) lastText = '📷 Photo';
        else if (chat.lastMsg.mediaType?.startsWith('audio/')) lastText = '🎤 Voice';
        else if (chat.lastMsg.mediaType?.startsWith('video/')) lastText = '🎥 Video';
    }

    const timeStr = chat.lastMsg ? formatTime(chat.lastMsg.timestamp) : '';
    const hasUnread = chat.unreadCount > 0;
    const isSelf = chat.lastMsg?.senderId === currentUser?.uid;

    const item = document.createElement('div');
    item.className = 'chat-list-item flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-wa-panel/20 transition';
    item.dataset.chatId = chat.id;
    item.dataset.sortTime = chat.sortTime;
    item.style.minHeight = '72px';

    item.innerHTML = `
        <div class="w-12 h-12 rounded-full overflow-hidden bg-wa-panel flex-shrink-0 flex items-center justify-center relative">
            ${photo ? `<img src="${escapeHTML(photo)}" class="w-full h-full object-cover" alt="">` : `<div class="w-full h-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-white font-bold text-lg">${escapeHTML(name[0]?.toUpperCase() || '?')}</div>`}
            ${isOnline ? '<span class="absolute bottom-0 right-0 w-3 h-3 bg-wa-green rounded-full border-2 border-wa-bg"></span>' : ''}
        </div>
        <div class="flex-1 min-w-0 border-b border-wa-panel/30 pb-3 flex justify-between items-center">
            <div class="min-w-0 flex-1">
                <div class="flex justify-between items-baseline mb-0.5 pr-2">
                    <h4 class="chat-name font-medium text-base text-wa-text truncate ${hasUnread ? 'font-bold' : ''}">${escapeHTML(name)}</h4>
                    <span class="chat-time text-xs ${hasUnread ? 'text-wa-green font-bold' : 'text-wa-muted'}">${timeStr}</span>
                </div>
                <div class="flex items-center gap-1 min-w-0">
                    ${isSelf ? '<i class="fa-solid fa-check-double text-blue-400 text-[10px] flex-shrink-0"></i>' : ''}
                    <p class="chat-text text-sm ${hasUnread ? 'text-wa-text font-medium' : 'text-wa-muted'} truncate">${escapeHTML(lastText)}</p>
                </div>
            </div>
            ${hasUnread ? `<span class="new-message-badge ml-2 flex-shrink-0">${chat.unreadCount}</span>` : ''}
        </div>
    `;

    item.addEventListener('click', () => openChat(chat.id, chat.otherUid, other));
    return item;
}

function updateChatItem(el, chat) {
    const other = chat.otherUser;
    const name = other.name || 'Unknown';
    const photo = other.photoURL || '';
    const isOnline = other.online === true;

    let lastText = 'Start chatting';
    if (chat.lastMsg) {
        if (chat.lastMsg.text) lastText = chat.lastMsg.text;
        else if (chat.lastMsg.mediaType?.startsWith('image/')) lastText = '📷 Photo';
        else if (chat.lastMsg.mediaType?.startsWith('audio/')) lastText = '🎤 Voice';
        else if (chat.lastMsg.mediaType?.startsWith('video/')) lastText = '🎥 Video';
    }

    const timeStr = chat.lastMsg ? formatTime(chat.lastMsg.timestamp) : '';
    const hasUnread = chat.unreadCount > 0;
    const isSelf = chat.lastMsg?.senderId === currentUser?.uid;

    // Update sortTime
    el.dataset.sortTime = chat.sortTime;

    // Update name
    const nameEl = el.querySelector('.chat-name');
    if (nameEl) {
        nameEl.textContent = name;
        nameEl.classList.toggle('font-bold', hasUnread);
    }

    // Update time
    const timeEl = el.querySelector('.chat-time');
    if (timeEl) {
        timeEl.textContent = timeStr;
        timeEl.className = `chat-time text-xs ${hasUnread ? 'text-wa-green font-bold' : 'text-wa-muted'}`;
    }

    // Update text
    const textEl = el.querySelector('.chat-text');
    if (textEl) {
        textEl.textContent = lastText;
        textEl.className = `chat-text text-sm ${hasUnread ? 'text-wa-text font-medium' : 'text-wa-muted'} truncate`;
    }

    // Update checkmark
    const container = el.querySelector('.flex.items-center.gap-1.min-w-0');
    let checkEl = container ? container.querySelector('.fa-check-double') : null;
    if (isSelf && container && !checkEl) {
        checkEl = document.createElement('i');
        checkEl.className = 'fa-solid fa-check-double text-blue-400 text-[10px] flex-shrink-0';
        container.insertBefore(checkEl, container.firstChild);
    } else if (!isSelf && checkEl) {
        checkEl.remove();
    }

    // Update badge
    const rightContainer = el.querySelector('.flex-1.min-w-0.border-b');
    let badgeEl = rightContainer ? rightContainer.querySelector('.new-message-badge') : null;
    if (hasUnread) {
        if (badgeEl) {
            badgeEl.textContent = chat.unreadCount;
        } else if (rightContainer) {
            badgeEl = document.createElement('span');
            badgeEl.className = 'new-message-badge ml-2 flex-shrink-0';
            badgeEl.textContent = chat.unreadCount;
            rightContainer.appendChild(badgeEl);
        }
    } else if (badgeEl) {
        badgeEl.remove();
    }

    // Update avatar
    const avatarContainer = el.querySelector('.w-12.h-12.rounded-full');
    if (avatarContainer) {
        const img = avatarContainer.querySelector('img');
        if (photo && !img) {
            const newImg = document.createElement('img');
            newImg.src = escapeHTML(photo);
            newImg.className = 'w-full h-full object-cover';
            const fallback = avatarContainer.querySelector('div:not(.absolute)');
            if (fallback) fallback.remove();
            avatarContainer.insertBefore(newImg, avatarContainer.firstChild);
        } else if (photo && img) {
            img.src = escapeHTML(photo);
        }

        // Online dot
        let onlineEl = avatarContainer.querySelector('.absolute.bottom-0');
        if (isOnline && !onlineEl) {
            onlineEl = document.createElement('span');
            onlineEl.className = 'absolute bottom-0 right-0 w-3 h-3 bg-wa-green rounded-full border-2 border-wa-bg';
            avatarContainer.appendChild(onlineEl);
        } else if (!isOnline && onlineEl) {
            onlineEl.remove();
        }
    }
}

function updateUnreadBadge(count) {
    const badge = document.getElementById('nav-badge-chats');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function initSearch() {
    const searchInput = dom['chat-search-input'];
    const modalSearch = dom['search-user-input'];

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val.startsWith('+') && val.length > 5) searchUsers(val);
        });
    }

    if (modalSearch) {
        modalSearch.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val.startsWith('+') && val.length > 5) searchUsers(val);
        });
    }
}

async function searchUsers(phoneQuery) {
    if (!currentUser) return;
    console.log("[NetChat] Searching for:", phoneQuery);

    if (dom['search-loading']) dom['search-loading'].classList.remove('hidden');
    if (dom['search-empty']) dom['search-empty'].classList.add('hidden');
    if (dom['search-results']) dom['search-results'].innerHTML = '';

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('phone', '>=', phoneQuery), where('phone', '<=', phoneQuery + '\\uf8ff'), limit(10));
        const snap = await getDocs(q);

        if (dom['search-loading']) dom['search-loading'].classList.add('hidden');

        if (snap.empty) {
            if (dom['search-empty']) dom['search-empty'].classList.remove('hidden');
            return;
        }

        snap.forEach(docSnap => {
            const user = docSnap.data();
            if (docSnap.id === currentUser.uid) return;

            const el = document.createElement('div');
            el.className = 'flex items-center gap-3 cursor-pointer hover:bg-wa-panel/30 p-3 rounded-lg transition';
            el.innerHTML = `
                <div class="w-12 h-12 rounded-full overflow-hidden bg-wa-panel flex items-center justify-center">
                    ${user.photoURL ? `<img src="${escapeHTML(user.photoURL)}" class="w-full h-full object-cover" alt="">` : `<i class="fa-solid fa-user text-wa-muted text-xl"></i>`}
                </div>
                <div class="flex-1">
                    <h5 class="font-medium text-sm text-wa-text">${escapeHTML(user.name)}</h5>
                    <p class="text-xs text-wa-muted">${escapeHTML(user.phone)}</p>
                </div>
                <button class="bg-wa-green text-wa-bg px-3 py-1.5 rounded-full text-xs font-medium">Chat</button>
            `;

            el.addEventListener('click', () => startChatWithUser(docSnap.id, user));
            if (dom['search-results']) dom['search-results'].appendChild(el);
        });

        if (dom['search-results'] && dom['search-results'].children.length === 0) {
            if (dom['search-empty']) dom['search-empty'].classList.remove('hidden');
        }

    } catch (err) {
        console.error("[NetChat] Search error:", err);
        if (dom['search-loading']) dom['search-loading'].classList.add('hidden');
        showToast('Search failed: ' + err.message);
    }
}

async function startChatWithUser(otherUid, otherUser) {
    if (!currentUser) return;
    console.log("[NetChat] Starting chat with:", otherUser.name);

    const chatId = generateChatId(currentUser.uid, otherUid);

    try {
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) {
            await setDoc(chatRef, {
                participants: [currentUser.uid, otherUid],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log("[NetChat] New chat created:", chatId);
        } else {
            // Update timestamp so chat appears at top of list
            await updateDoc(chatRef, {
                updatedAt: serverTimestamp()
            });
        }

        if (dom['new-chat-modal']) dom['new-chat-modal'].classList.add('translate-x-full');
        if (dom['search-user-input']) dom['search-user-input'].value = '';
        if (dom['search-results']) dom['search-results'].innerHTML = '';

        openChat(chatId, otherUid, otherUser);

    } catch (err) {
        console.error("[NetChat] Start chat error:", err);
        showToast('Failed to start chat: ' + err.message);
    }
}

// ==================== CHAT WINDOW ====================
function openChat(chatId, otherUid, otherUser) {
    activeChatId = chatId;
    activeContact = { uid: otherUid, ...otherUser };

    if (dom['chat-window-title']) dom['chat-window-title'].textContent = otherUser.name;
    if (dom['chat-window-subtitle']) dom['chat-window-subtitle'].textContent = otherUser.online ? 'Online' : 'Last seen ' + formatDate(otherUser.lastSeen);

    if (otherUser.photoURL) {
        if (dom['chat-window-avatar-img']) {
            dom['chat-window-avatar-img'].src = otherUser.photoURL;
            dom['chat-window-avatar-img'].classList.remove('hidden');
        }
        if (dom['chat-window-avatar-icon']) dom['chat-window-avatar-icon'].classList.add('hidden');
    } else {
        if (dom['chat-window-avatar-img']) dom['chat-window-avatar-img'].classList.add('hidden');
        if (dom['chat-window-avatar-icon']) dom['chat-window-avatar-icon'].classList.remove('hidden');
    }

    if (dom['chat-window-online-dot']) dom['chat-window-online-dot'].classList.toggle('hidden', !otherUser.online);

    if (dom['chat-window-screen']) dom['chat-window-screen'].classList.remove('translate-x-full');

    loadMessages(chatId);
    markMessagesAsRead(chatId);
}

function closeChat() {
    if (dom['chat-window-screen']) dom['chat-window-screen'].classList.add('translate-x-full');
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
    activeChatId = null;
    activeContact = null;
}

// ==================== MESSAGES ====================
function loadMessages(chatId) {
    if (messagesUnsubscribe) messagesUnsubscribe();

    if (dom['chat-messages']) dom['chat-messages'].innerHTML = '';

    const msgsRef = collection(db, 'chats', chatId, 'messages');
    const q = query(msgsRef, orderBy('timestamp', 'asc'));

    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        if (dom['chat-messages']) dom['chat-messages'].innerHTML = '';

        const dateHeader = document.createElement('div');
        dateHeader.className = 'flex justify-center mb-2';
        dateHeader.innerHTML = '<span class="date-header">Today</span>';
        if (dom['chat-messages']) dom['chat-messages'].appendChild(dateHeader);

        snapshot.forEach(docSnap => {
            renderMessage(docSnap.data(), docSnap.id);
        });

        if (dom['chat-messages']) dom['chat-messages'].scrollTop = dom['chat-messages'].scrollHeight;
        markMessagesAsRead(chatId);
    }, (err) => {
        console.error("[NetChat] Messages listener error:", err);
    });
}

function renderMessage(msg, msgId) {
    const isSelf = msg.senderId === currentUser?.uid;
    const timeStr = formatTime(msg.timestamp);

    let mediaHTML = '';
    if (msg.mediaUrl && !msg.deleted) {
        if (msg.mediaType?.startsWith('image/')) {
            mediaHTML = `<img src="${escapeHTML(msg.mediaUrl)}" class="rounded-lg mb-1 w-full max-w-sm cursor-pointer" onclick="window.open('${escapeHTML(msg.mediaUrl)}')">`;
        } else if (msg.mediaType?.startsWith('video/')) {
            mediaHTML = `<video src="${escapeHTML(msg.mediaUrl)}" controls class="rounded-lg mb-1 w-full max-w-sm"></video>`;
        } else if (msg.mediaType?.startsWith('audio/')) {
            mediaHTML = `<audio src="${escapeHTML(msg.mediaUrl)}" controls class="h-10 mb-1"></audio>`;
        }
    }

    const textHTML = msg.text ? `<p class="text-[15px] leading-snug">${escapeHTML(msg.text)}</p>` : '';
    const checksHTML = isSelf ? `<i class="fa-solid fa-check-double ${msg.read ? 'text-blue-400' : 'text-wa-muted'} ml-1 text-[10px]"></i>` : '';

    const el = document.createElement('div');
    el.className = `flex ${isSelf ? 'justify-end' : 'justify-start'} mb-1`;
    el.innerHTML = `
        <div class="chat-bubble ${isSelf ? 'sent' : 'received'}">
            ${mediaHTML}
            <div class="flex items-end flex-wrap gap-2">
                ${textHTML}
                <div class="flex items-center justify-end flex-1 mt-1 text-[11px] text-wa-text/70">
                    <span class="mt-1">${timeStr}</span>
                    ${checksHTML}
                </div>
            </div>
        </div>
    `;
    if (dom['chat-messages']) dom['chat-messages'].appendChild(el);
}

async function sendMessage() {
    const text = dom['message-input']?.value.trim();
    if (!text || !currentUser || !activeChatId) return;

    try {
        await addDoc(collection(db, 'chats', activeChatId, 'messages'), {
            senderId: currentUser.uid,
            senderName: currentUser.name,
            text: text,
            timestamp: serverTimestamp(),
            read: false
        });

        // FIXED: Update chat document so it appears in ordered query
        await updateDoc(doc(db, 'chats', activeChatId), {
            updatedAt: serverTimestamp()
        });

        if (dom['message-input']) dom['message-input'].value = '';
        if (dom['message-input']) dom['message-input'].style.height = 'auto';
        if (dom['mic-icon']) dom['mic-icon'].classList.remove('hidden');
        if (dom['send-icon']) dom['send-icon'].classList.add('hidden');
    } catch (err) {
        console.error("[NetChat] Send error:", err);
        showToast('Failed to send: ' + err.message);
    }
}

async function markMessagesAsRead(chatId) {
    if (!currentUser || !chatId) return;

    try {
        const msgsRef = collection(db, 'chats', chatId, 'messages');
        const q = query(msgsRef, where('read', '==', false), where('senderId', '!=', currentUser.uid));
        const snap = await getDocs(q);

        const batch = writeBatch(db);
        snap.forEach(docSnap => {
            batch.update(docSnap.ref, { read: true });
        });
        await batch.commit();
    } catch (err) {}
}

// ==================== VOICE RECORDING (NO STORAGE - Base64) ====================
async function toggleRecording() {
    if (!currentUser || !activeChatId) return;

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                try {
                    const blob = new Blob(audioChunks, { type: 'audio/webm' });
                    // Convert to base64 (small voice messages only)
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                        const base64 = reader.result;
                        if (base64.length > 1000000) {
                            showToast('Voice message too long');
                            return;
                        }

                        await addDoc(collection(db, 'chats', activeChatId, 'messages'), {
                            senderId: currentUser.uid,
                            senderName: currentUser.name,
                            mediaUrl: base64,
                            mediaType: 'audio/webm',
                            timestamp: serverTimestamp(),
                            read: false
                        });

                        // Update chat updatedAt
                        await updateDoc(doc(db, 'chats', activeChatId), {
                            updatedAt: serverTimestamp()
                        });
                    };
                    reader.readAsDataURL(blob);
                } catch (err) {
                    showToast('Failed to send voice');
                }
                stream.getTracks().forEach(t => t.stop());
            };

            mediaRecorder.start();
            isRecording = true;
            if (dom['voice-record-btn']) dom['voice-record-btn'].classList.add('recording-pulse');
            showToast('Recording...');
        } catch (err) {
            showToast('Microphone access denied');
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        if (dom['voice-record-btn']) dom['voice-record-btn'].classList.remove('recording-pulse');
        showToast('Voice message sent');
    }
}

// ==================== FILE UPLOAD (NO STORAGE - Base64 only) ====================
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !currentUser || !activeChatId) return;

    // Only allow small images (max 500KB for base64 in Firestore)
    if (file.size > 500000) {
        showToast('File too large. Max 500KB for free storage.');
        e.target.value = '';
        return;
    }

    showToast('Uploading...');

    const reader = new FileReader();
    reader.onloadend = async () => {
        try {
            const base64 = reader.result;
            await addDoc(collection(db, 'chats', activeChatId, 'messages'), {
                senderId: currentUser.uid,
                senderName: currentUser.name,
                mediaUrl: base64,
                mediaType: file.type,
                timestamp: serverTimestamp(),
                read: false
            });

            // Update chat updatedAt
            await updateDoc(doc(db, 'chats', activeChatId), {
                updatedAt: serverTimestamp()
            });

            showToast('File sent!');
        } catch (err) {
            console.error("[NetChat] File send error:", err);
            showToast('Failed to send file: ' + err.message);
        }
    };
    reader.readAsDataURL(file);

    e.target.value = '';
}

// ==================== STATUS (FIXED WITH VIEWER) ====================
function initStatusListener() {
    if (!currentUser) return;
    console.log("[NetChat] Starting status listener...");

    const statusRef = collection(db, 'statuses');
    const q = query(statusRef, orderBy('timestamp', 'desc'), limit(50));

    if (statusUnsubscribe) statusUnsubscribe();

    statusUnsubscribe = onSnapshot(q, (snapshot) => {
        if (dom['status-list']) dom['status-list'].innerHTML = '';

        if (snapshot.empty) {
            if (dom['no-statuses']) dom['no-statuses'].classList.remove('hidden');
            return;
        }

        if (dom['no-statuses']) dom['no-statuses'].classList.add('hidden');

        snapshot.forEach(docSnap => {
            const status = docSnap.data();
            if (status.userId === currentUser.uid) return;

            const isViewed = status.viewedBy?.includes(currentUser.uid);

            const el = document.createElement('div');
            el.className = 'status-item flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-wa-panel/30 transition';
            el.innerHTML = `
                <div class="story-ring ${isViewed ? 'viewed' : ''} p-[2px] rounded-full">
                    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                        ${status.userPhoto ? `<img src="${escapeHTML(status.userPhoto)}" class="w-full h-full object-cover">` : escapeHTML(status.userName?.[0] || '?')}
                    </div>
                </div>
                <div class="flex-1">
                    <h5 class="font-medium text-sm text-wa-text">${escapeHTML(status.userName)}</h5>
                    <p class="text-xs ${isViewed ? 'text-wa-muted' : 'text-wa-green'}">${formatDate(status.timestamp)}</p>
                </div>
            `;

            // FIXED: Open status viewer instead of just toast
            el.addEventListener('click', () => openStatusViewer(docSnap.id, status));
            if (dom['status-list']) dom['status-list'].appendChild(el);
        });
    }, (err) => {
        console.error("[NetChat] Status listener error:", err);
    });
}

// ==================== STATUS VIEWER (NEW) ====================
function openStatusViewer(statusId, status) {
    if (!currentUser) return;

    currentViewingStatus = { id: statusId, ...status };

    // Mark as viewed in Firestore
    try {
        const statusRef = doc(db, 'statuses', statusId);
        const viewedBy = status.viewedBy || [];
        if (!viewedBy.includes(currentUser.uid)) {
            viewedBy.push(currentUser.uid);
            updateDoc(statusRef, { viewedBy });
        }
    } catch (err) {}

    // Set viewer content
    if (dom['status-viewer-image']) dom['status-viewer-image'].src = status.mediaUrl || '';
    if (dom['status-viewer-name']) dom['status-viewer-name'].textContent = status.userName || 'Unknown';
    if (dom['status-viewer-time']) dom['status-viewer-time'].textContent = formatDate(status.timestamp);

    // Avatar
    if (status.userPhoto) {
        if (dom['status-viewer-avatar']) {
            dom['status-viewer-avatar'].src = status.userPhoto;
            dom['status-viewer-avatar'].classList.remove('hidden');
        }
        if (dom['status-viewer-avatar-fallback']) dom['status-viewer-avatar-fallback'].classList.add('hidden');
    } else {
        if (dom['status-viewer-avatar']) dom['status-viewer-avatar'].classList.add('hidden');
        if (dom['status-viewer-avatar-fallback']) dom['status-viewer-avatar-fallback'].classList.remove('hidden');
    }

    // Show modal
    if (dom['status-viewer-modal']) dom['status-viewer-modal'].classList.remove('hidden');

    // Start progress bar animation (5 seconds)
    statusViewerProgress = 0;
    if (dom['status-progress-bar']) dom['status-progress-bar'].style.width = '0%';

    if (statusViewerTimer) clearInterval(statusViewerTimer);
    statusViewerTimer = setInterval(() => {
        statusViewerProgress += 2; // 2% every 100ms = 5 seconds total
        if (dom['status-progress-bar']) dom['status-progress-bar'].style.width = statusViewerProgress + '%';

        if (statusViewerProgress >= 100) {
            closeStatusViewer();
        }
    }, 100);
}

function closeStatusViewer() {
    if (statusViewerTimer) {
        clearInterval(statusViewerTimer);
        statusViewerTimer = null;
    }
    if (dom['status-viewer-modal']) dom['status-viewer-modal'].classList.add('hidden');
    if (dom['status-viewer-image']) dom['status-viewer-image'].src = '';
    currentViewingStatus = null;
}

function initStatusViewer() {
    // Close on X button
    if (dom['status-viewer-close']) {
        dom['status-viewer-close'].addEventListener('click', closeStatusViewer);
    }

    // Close on tap
    if (dom['status-viewer-modal']) {
        dom['status-viewer-modal'].addEventListener('click', (e) => {
            if (e.target === dom['status-viewer-modal']) closeStatusViewer();
        });
    }

    // Reply to status
    if (dom['status-reply-btn']) {
        dom['status-reply-btn'].addEventListener('click', async () => {
            const replyText = dom['status-reply-input']?.value.trim();
            if (!replyText || !currentViewingStatus || !currentUser) return;

            // Start a chat with the status owner and send the reply
            const otherUid = currentViewingStatus.userId;
            const chatId = generateChatId(currentUser.uid, otherUid);

            try {
                // Ensure chat exists
                const chatRef = doc(db, 'chats', chatId);
                const chatSnap = await getDoc(chatRef);
                if (!chatSnap.exists()) {
                    await setDoc(chatRef, {
                        participants: [currentUser.uid, otherUid],
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                }

                // Send reply message
                await addDoc(collection(db, 'chats', chatId, 'messages'), {
                    senderId: currentUser.uid,
                    senderName: currentUser.name,
                    text: 'Reply to status: ' + replyText,
                    timestamp: serverTimestamp(),
                    read: false
                });

                await updateDoc(chatRef, { updatedAt: serverTimestamp() });

                if (dom['status-reply-input']) dom['status-reply-input'].value = '';
                showToast('Reply sent!');
                closeStatusViewer();

            } catch (err) {
                console.error("[NetChat] Status reply error:", err);
                showToast('Failed to send reply');
            }
        });
    }
}

function initMyStatus() {
    if (dom['my-status-row']) {
        dom['my-status-row'].addEventListener('click', () => {
            if (dom['status-upload-modal']) dom['status-upload-modal'].classList.remove('hidden');
        });
    }

    if (dom['close-status-modal']) {
        dom['close-status-modal'].addEventListener('click', () => {
            if (dom['status-upload-modal']) dom['status-upload-modal'].classList.add('hidden');
            if (dom['status-preview-img']) dom['status-preview-img'].classList.add('hidden');
            if (dom['status-preview-icon']) dom['status-preview-icon'].classList.remove('hidden');
        });
    }

    if (dom['status-file-input']) {
        dom['status-file-input'].addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !currentUser) return;

            // Max 500KB for base64
            if (file.size > 500000) {
                showToast('Image too large. Max 500KB.');
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                if (dom['status-preview-img']) dom['status-preview-img'].src = ev.target.result;
                if (dom['status-preview-img']) dom['status-preview-img'].classList.remove('hidden');
                if (dom['status-preview-icon']) dom['status-preview-icon'].classList.add('hidden');
            };
            reader.readAsDataURL(file);

            showToast('Uploading status...');

            // Read as base64 and store in Firestore
            const base64Reader = new FileReader();
            base64Reader.onloadend = async () => {
                try {
                    const base64 = base64Reader.result;
                    await addDoc(collection(db, 'statuses'), {
                        userId: currentUser.uid,
                        userName: currentUser.name,
                        userPhoto: currentUser.photoURL || '',
                        mediaUrl: base64,
                        mediaType: file.type,
                        timestamp: serverTimestamp(),
                        viewedBy: []
                    });

                    if (dom['my-status-text']) dom['my-status-text'].textContent = 'Just now';
                    if (dom['status-upload-modal']) dom['status-upload-modal'].classList.add('hidden');
                    showToast('Status updated!');
                } catch (err) {
                    console.error("[NetChat] Status upload error:", err);
                    showToast('Failed to update status: ' + err.message);
                }
            };
            base64Reader.readAsDataURL(file);
        });
    }

    if (dom['status-camera-btn']) {
        dom['status-camera-btn'].addEventListener('click', () => {
            showToast('Camera not available in browser');
        });
    }
}

// ==================== CALLS ====================
function initCallsListener() {
    if (!currentUser) return;
    console.log("[NetChat] Starting calls listener...");

    const callsRef = collection(db, 'calls');
    const q = query(callsRef, where('participants', 'array-contains', currentUser.uid), orderBy('timestamp', 'desc'), limit(20));

    onSnapshot(q, (snapshot) => {
        if (dom['calls-list']) dom['calls-list'].innerHTML = '';

        if (snapshot.empty) {
            if (dom['no-calls']) dom['no-calls'].classList.remove('hidden');
            return;
        }

        if (dom['no-calls']) dom['no-calls'].classList.add('hidden');

        snapshot.forEach(docSnap => {
            const call = docSnap.data();
            const isOutgoing = call.callerId === currentUser.uid;
            const otherName = isOutgoing ? call.calleeName : call.callerName;
            const type = call.missed ? 'missed' : isOutgoing ? 'outgoing' : 'incoming';
            const color = type === 'missed' ? 'text-red-400' : 'text-wa-green';
            const icon = call.video ? 'fa-video' : 'fa-phone';

            const el = document.createElement('div');
            el.className = 'flex items-center gap-4 py-3 px-2 cursor-pointer hover:bg-wa-panel/20 rounded-lg transition';
            el.innerHTML = `
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-white font-bold">
                    ${otherName?.[0] || '?'}
                </div>
                <div class="flex-1">
                    <h5 class="font-medium text-sm ${type === 'missed' ? 'text-red-400' : 'text-wa-text'}">${escapeHTML(otherName || 'Unknown')}</h5>
                    <div class="flex items-center gap-1">
                        <i class="fa-solid ${icon} ${color} text-xs"></i>
                        <span class="text-xs text-wa-muted">${formatDate(call.timestamp)}</span>
                    </div>
                </div>
                <i class="fa-solid fa-phone text-wa-green text-lg cursor-pointer active:opacity-50"></i>
            `;
            if (dom['calls-list']) dom['calls-list'].appendChild(el);
        });
    }, (err) => {
        console.error("[NetChat] Calls listener error:", err);
    });
}

// ==================== NAVIGATION ====================
function initNavigation() {
    if (!dom.navBtns) return;

    dom.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');

            dom.navBtns.forEach(b => {
                b.classList.replace('text-wa-text', 'text-wa-muted');
                const wrapper = b.querySelector('.nav-wrapper');
                if (wrapper) wrapper.classList.remove('bg-wa-panel/50');
                const text = b.querySelector('.nav-text');
                if (text) text.classList.replace('font-bold', 'font-medium');
            });

            Object.values(dom.views).forEach(v => {
                if (v) v.classList.add('hidden');
            });

            btn.classList.replace('text-wa-muted', 'text-wa-text');
            const wrapper = btn.querySelector('.nav-wrapper');
            if (wrapper) wrapper.classList.add('bg-wa-panel/50');
            const text = btn.querySelector('.nav-text');
            if (text) text.classList.replace('font-medium', 'font-bold');
            if (dom.views[target]) dom.views[target].classList.remove('hidden');

            const icons = { chats: 'fa-square-plus', updates: 'fa-camera', communities: 'fa-bullhorn', calls: 'fa-phone-plus' };
            if (dom['fab-icon']) dom['fab-icon'].className = `fa-solid ${icons[target] || 'fa-square-plus'} text-2xl`;

            if (target === 'updates' && dom['nav-dot-updates']) dom['nav-dot-updates'].classList.add('hidden');
        });
    });
}

// ==================== HEADER DROPDOWN ====================
function initHeaderDropdown() {
    if (dom['hdr-menu-btn']) {
        dom['hdr-menu-btn'].addEventListener('click', (e) => {
            e.stopPropagation();
            if (dom['header-dropdown']) dom['header-dropdown'].classList.toggle('hidden');
        });
    }

    document.addEventListener('click', () => {
        if (dom['header-dropdown']) dom['header-dropdown'].classList.add('hidden');
    });

    const newGroup = document.getElementById('menu-opt-new-group');
    const starred = document.getElementById('menu-opt-starred');
    if (newGroup) newGroup.addEventListener('click', () => showToast('Coming soon'));
    if (starred) starred.addEventListener('click', () => showToast('No starred messages'));
}

// ==================== SETTINGS ====================
function initSettings() {
    if (dom['menu-opt-settings']) {
        dom['menu-opt-settings'].addEventListener('click', () => {
            if (dom['settings-drawer']) dom['settings-drawer'].classList.remove('translate-x-full');
            if (dom['header-dropdown']) dom['header-dropdown'].classList.add('hidden');
        });
    }

    if (dom['close-settings-drawer']) {
        dom['close-settings-drawer'].addEventListener('click', () => {
            if (dom['settings-drawer']) dom['settings-drawer'].classList.add('translate-x-full');
        });
    }

    document.querySelectorAll('.settings-item').forEach(item => {
        item.addEventListener('click', () => {
            const setting = item.getAttribute('data-setting');
            const panels = {
                chats: dom['chats-settings-panel'],
                notifications: dom['notifications-settings-panel'],
                privacy: dom['privacy-settings-panel'],
                account: dom['account-settings-panel'],
                storage: dom['storage-settings-panel']
            };

            if (panels[setting]) {
                panels[setting].classList.remove('translate-x-full');
            } else {
                const msgs = { help: 'Help center: support@net.chat', invite: 'Invite link copied!' };
                showToast(msgs[setting] || 'Coming soon');
                if (setting === 'invite') navigator.clipboard?.writeText('Join me on NetChat!');
            }
        });
    });

    ['chats','notifications','privacy','account','storage'].forEach(s => {
        const closeBtn = dom[`close-${s}-settings`];
        const panel = dom[`${s}-settings-panel`];
        if (closeBtn && panel) {
            closeBtn.addEventListener('click', () => panel.classList.add('translate-x-full'));
        }
    });

    if (dom['toggle-enter-send']) dom['toggle-enter-send'].addEventListener('change', (e) => { appSettings.enterIsSend = e.target.checked; saveSettings(); });
    if (dom['toggle-conv-tones']) dom['toggle-conv-tones'].addEventListener('change', (e) => { appSettings.conversationTones = e.target.checked; saveSettings(); });
    if (dom['toggle-high-priority']) dom['toggle-high-priority'].addEventListener('change', (e) => { appSettings.highPriority = e.target.checked; saveSettings(); });
    if (dom['toggle-read-receipts']) dom['toggle-read-receipts'].addEventListener('change', (e) => { appSettings.readReceipts = e.target.checked; saveSettings(); });

    if (dom['wallpaper-option']) dom['wallpaper-option'].addEventListener('click', () => {
        if (dom['wallpaper-modal']) dom['wallpaper-modal'].classList.remove('hidden');
    });

    if (dom['close-wallpaper-modal']) dom['close-wallpaper-modal'].addEventListener('click', () => {
        if (dom['wallpaper-modal']) dom['wallpaper-modal'].classList.add('hidden');
    });

    document.querySelectorAll('.wallpaper-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.wallpaper-option').forEach(o => { o.classList.remove('selected'); o.style.borderColor = 'transparent'; });
            opt.classList.add('selected');
            opt.style.borderColor = 'var(--wa-green)';
            applyWallpaper(opt.getAttribute('data-wallpaper'));
            appSettings.wallpaper = opt.getAttribute('data-wallpaper');
            saveSettings();
        });
    });
}

function applyWallpaper(wp) {
    const chatBg = document.querySelector('.chat-bg');
    if (!chatBg) return;
    const wallpapers = {
        default: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
        dark: 'none', solid: 'none',
        blue: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        nature: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
        purple: 'linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)'
    };
    if (wp === 'default') { chatBg.style.backgroundImage = wallpapers.default; chatBg.style.backgroundBlendMode = 'overlay'; }
    else if (wp === 'dark') { chatBg.style.backgroundImage = 'none'; chatBg.style.backgroundColor = '#0b141a'; }
    else if (wp === 'solid') { chatBg.style.backgroundImage = 'none'; chatBg.style.backgroundColor = '#111b21'; }
    else { chatBg.style.backgroundImage = wallpapers[wp]; chatBg.style.backgroundBlendMode = 'normal'; }
}

function saveSettings() {
    try { localStorage.setItem('netchat_settings', JSON.stringify(appSettings)); } catch (e) {}
}

function loadSettings() {
    try {
        const saved = localStorage.getItem('netchat_settings');
        if (saved) {
            appSettings = { ...appSettings, ...JSON.parse(saved) };
            if (dom['toggle-enter-send']) dom['toggle-enter-send'].checked = appSettings.enterIsSend;
            if (dom['toggle-read-receipts']) dom['toggle-read-receipts'].checked = appSettings.readReceipts;
            applyWallpaper(appSettings.wallpaper);
        }
    } catch (e) {}
}

// ==================== MESSAGE INPUT ====================
function initMessageInput() {
    if (dom['message-input']) {
        dom['message-input'].addEventListener('input', () => {
            dom['message-input'].style.height = 'auto';
            dom['message-input'].style.height = Math.min(dom['message-input'].scrollHeight, 128) + 'px';

            if (dom['message-input'].value.trim().length > 0) {
                if (dom['mic-icon']) dom['mic-icon'].classList.add('hidden');
                if (dom['send-icon']) dom['send-icon'].classList.remove('hidden');
            } else {
                if (dom['mic-icon']) dom['mic-icon'].classList.remove('hidden');
                if (dom['send-icon']) dom['send-icon'].classList.add('hidden');
                dom['message-input'].style.height = 'auto';
            }
        });

        dom['message-input'].addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && appSettings.enterIsSend) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (dom['voice-record-btn']) {
        dom['voice-record-btn'].addEventListener('click', () => {
            if (dom['message-input'] && dom['message-input'].value.trim().length > 0) sendMessage();
            else toggleRecording();
        });
    }

    if (dom['chat-file-input']) dom['chat-file-input'].addEventListener('change', handleFileUpload);
}

// ==================== DRAWERS & MODALS ====================
function initDrawers() {
    if (dom['archive-bar']) dom['archive-bar'].addEventListener('click', () => {
        if (dom['archive-drawer']) dom['archive-drawer'].classList.remove('translate-x-full');
    });

    if (dom['close-archive-drawer']) dom['close-archive-drawer'].addEventListener('click', () => {
        if (dom['archive-drawer']) dom['archive-drawer'].classList.add('translate-x-full');
    });

    if (dom['close-chat-window']) dom['close-chat-window'].addEventListener('click', closeChat);

    if (dom['floating-action-btn']) {
        dom['floating-action-btn'].addEventListener('click', () => {
            if (dom['new-chat-modal']) dom['new-chat-modal'].classList.remove('translate-x-full');
            setTimeout(() => { if (dom['search-user-input']) dom['search-user-input'].focus(); }, 200);
        });
    }

    if (dom['close-new-chat']) {
        dom['close-new-chat'].addEventListener('click', () => {
            if (dom['new-chat-modal']) dom['new-chat-modal'].classList.add('translate-x-full');
            if (dom['search-user-input']) dom['search-user-input'].value = '';
            if (dom['search-results']) dom['search-results'].innerHTML = '';
        });
    }

    // Contact info
    const chatHeader = dom['chat-window-title']?.parentElement;
    if (chatHeader) {
        chatHeader.addEventListener('click', async () => {
            if (!activeContact) return;
            if (dom['contact-info-name']) dom['contact-info-name'].textContent = activeContact.name;
            if (dom['contact-info-phone']) dom['contact-info-phone'].textContent = activeContact.phone || '';
            if (dom['contact-info-status']) {
                dom['contact-info-status'].textContent = activeContact.online ? 'Online' : 'Offline';
                dom['contact-info-status'].className = 'text-xs mt-1 ' + (activeContact.online ? 'text-wa-green' : 'text-wa-muted');
            }

            if (activeContact.photoURL) {
                if (dom['contact-info-avatar']) {
                    dom['contact-info-avatar'].src = activeContact.photoURL;
                    dom['contact-info-avatar'].classList.remove('hidden');
                }
                if (dom['contact-info-fallback']) dom['contact-info-fallback'].classList.add('hidden');
            } else {
                if (dom['contact-info-avatar']) dom['contact-info-avatar'].classList.add('hidden');
                if (dom['contact-info-fallback']) dom['contact-info-fallback'].classList.remove('hidden');
            }

            if (dom['contact-info-modal']) dom['contact-info-modal'].classList.remove('hidden');
        });
    }

    if (dom['contact-info-message']) dom['contact-info-message'].addEventListener('click', () => {
        if (dom['contact-info-modal']) dom['contact-info-modal'].classList.add('hidden');
    });

    if (dom['contact-info-call']) dom['contact-info-call'].addEventListener('click', () => showToast('Voice call coming soon'));
    if (dom['contact-info-video']) dom['contact-info-video'].addEventListener('click', () => showToast('Video call coming soon'));

    if (dom['contact-info-modal']) {
        dom['contact-info-modal'].addEventListener('click', (e) => {
            if (e.target === dom['contact-info-modal']) dom['contact-info-modal'].classList.add('hidden');
        });
    }

    if (dom['chat-video-btn']) dom['chat-video-btn'].addEventListener('click', () => showToast('Video call coming soon'));
    if (dom['chat-phone-btn']) dom['chat-phone-btn'].addEventListener('click', () => showToast('Voice call coming soon'));
    if (dom['chat-menu-btn']) dom['chat-menu-btn'].addEventListener('click', () => showToast('Chat options: Clear / Block'));
}

// ==================== EXTRAS ====================
function initExtras() {
    if (dom['hdr-camera']) dom['hdr-camera'].addEventListener('click', () => showToast('Camera coming soon'));
    if (dom['hdr-search']) dom['hdr-search'].addEventListener('click', () => { if (dom['chat-search-input']) dom['chat-search-input'].focus(); });

    const emojiBtn = document.getElementById('emoji-btn');
    if (emojiBtn) emojiBtn.addEventListener('click', () => showToast('Emoji picker coming soon'));
}

// ==================== INITIALIZATION ====================
async function init() {
    console.log("[NetChat] Starting app initialization...");
    cacheDOM();

    // ALWAYS show app container first (no form flash)
    // Only show auth if no session exists
    const savedSession = localStorage.getItem('netchat_user_session');

    if (savedSession) {
        // User has session - show app immediately, restore in background
        console.log("[NetChat] Session found, showing app immediately");
        dom['auth-screen'].classList.add('hidden');
        dom['app-container'].classList.remove('hidden');

        // Restore session in background
        const restored = await restoreUserSession();
        if (!restored) {
            // Restore failed - show auth
            dom['auth-screen'].classList.remove('hidden');
            dom['app-container'].classList.add('hidden');
            initAuth();
        }
    } else {
        // No session - show auth
        console.log("[NetChat] No session, showing auth");
        initAuth();
    }

    initNavigation();
    initHeaderDropdown();
    initSettings();
    initMessageInput();
    initDrawers();
    initSearch();
    initMyStatus();
    initStatusViewer();
    initLogout();
    initExtras();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (dom['header-dropdown']) dom['header-dropdown'].classList.add('hidden');
            if (dom['status-upload-modal']) dom['status-upload-modal'].classList.add('hidden');
            if (dom['wallpaper-modal']) dom['wallpaper-modal'].classList.add('hidden');
            if (dom['contact-info-modal']) dom['contact-info-modal'].classList.add('hidden');
            if (dom['delete-account-modal']) dom['delete-account-modal'].classList.add('hidden');
            closeStatusViewer();
        }
    });

    console.log("[NetChat] App initialized successfully!");
}

init();

// ==================== DEBUG / TEST ====================
window.testChatList = async function() {
    if (!currentUser) {
        console.log("[NetChat TEST] No currentUser!");
        return;
    }
    console.log("[NetChat TEST] Current user:", currentUser.uid);
    console.log("[NetChat TEST] Checking chats collection...");

    try {
        const chatsRef = collection(db, 'chats');
        const q = query(chatsRef, where('participants', 'array-contains', currentUser.uid));
        const snap = await getDocs(q);

        console.log("[NetChat TEST] Found", snap.size, "chats");

        snap.forEach(doc => {
            const data = doc.data();
            console.log("[NetChat TEST] Chat:", doc.id, "participants:", data.participants);
        });

        // Check DOM
        console.log("[NetChat TEST] active-chats-list element:", dom['active-chats-list']);
        console.log("[NetChat TEST] no-chats element:", dom['no-chats']);

    } catch (err) {
        console.error("[NetChat TEST] Error:", err);
    }
};

// Auto-run test after 3 seconds
setTimeout(() => {
    if (currentUser) {
        console.log("[NetChat] Auto-running chat test...");
        window.testChatList();
    }
}, 3000);
