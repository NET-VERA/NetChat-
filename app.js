// NetChat Firebase Chat App
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  GithubAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  Timestamp,
  arrayUnion,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPYmnRoJcm1ClmiBn60jzHhBi2XI1Jrso",
  authDomain: "netchat-77c7c.firebaseapp.com",
  projectId: "netchat-77c7c",
  storageBucket: "netchat-77c7c.firebasestorage.app",
  messagingSenderId: "197140347471",
  appId: "1:197140347471:web:516859518c8de54549483a",
  measurementId: "G-0MKEN0QRBE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ===== GLOBAL STATE =====
let currentUser = null;
let currentChatId = null;
let currentChatPartner = null;
let messagesUnsub = null;
let usersUnsub = null;
let statusUnsub = null;
let unreadUnsub = null;
let unreadCounts = {};

// ===== AUTH FUNCTIONS =====

window.showTab = function(tab) {
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');
  tabs.forEach(t => t.classList.remove('active'));
  forms.forEach(f => f.classList.add('hidden'));
  
  if (tab === 'login') {
    if (tabs[0]) tabs[0].classList.add('active');
    const loginForm = document.getElementById('login-tab');
    if (loginForm) loginForm.classList.remove('hidden');
  } else {
    if (tabs[1]) tabs[1].classList.add('active');
    const signupForm = document.getElementById('signup-tab');
    if (signupForm) signupForm.classList.remove('hidden');
  }
  const msg = document.getElementById('auth-message');
  if (msg) { msg.textContent = ''; msg.style.color = '#e74c3c'; }
};

window.togglePassword = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input || !btn) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
};

window.signup = async function() {
  console.log('=== SIGNUP CLICKED ===');
  
  const nameEl = document.getElementById('signup-name');
  const emailEl = document.getElementById('signup-email');
  const passEl = document.getElementById('signup-password');
  const msgEl = document.getElementById('auth-message');
  
  if (!nameEl || !emailEl || !passEl) {
    console.error('Missing form elements');
    return;
  }
  
  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  const password = passEl.value;
  
  if (!name || !email || !password) {
    if (msgEl) { msgEl.textContent = 'Please fill in all fields'; msgEl.style.color = '#e74c3c'; }
    return;
  }
  if (password.length < 6) {
    if (msgEl) { msgEl.textContent = 'Password must be at least 6 characters'; msgEl.style.color = '#e74c3c'; }
    return;
  }
  
  const btn = document.querySelector('#signup-tab .btn-auth');
  if (btn) {
    btn.innerHTML = '<span class="spinner"></span> Creating...';
    btn.disabled = true;
  }
  
  try {
    console.log('Creating user with:', email);
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    console.log('User created! UID:', userCred.user.uid);
    
    await updateProfile(userCred.user, { displayName: name, photoURL: '' });
    console.log('Profile updated');
    
    await setDoc(doc(db, 'users', userCred.user.uid), {
      name: name,
      email: email,
      photoURL: '',
      about: 'Hey there! I am using NetChat.',
      phoneNumber: '',
      isOnline: true,
      lastSeen: serverTimestamp(),
      darkMode: false,
      createdAt: serverTimestamp()
    });
    console.log('User doc created in Firestore');
    
    currentUser = userCred.user;
    
    if (msgEl) { msgEl.style.color = '#25d366'; msgEl.textContent = 'Account created! Redirecting...'; }
    
    setTimeout(() => {
      showChatScreen();
    }, 1000);
  } catch (err) {
    console.error('Signup error:', err.code, err.message);
    if (msgEl) { msgEl.style.color = '#e74c3c'; msgEl.textContent = err.message; }
    if (btn) {
      btn.innerHTML = '<span class="btn-text">Create Account</span>';
      btn.disabled = false;
    }
  }
};

window.login = async function() {
  console.log('=== LOGIN CLICKED ===');
  
  const emailEl = document.getElementById('login-email');
  const passEl = document.getElementById('login-password');
  const msgEl = document.getElementById('auth-message');
  
  if (!emailEl || !passEl) {
    console.error('Missing login form elements');
    return;
  }
  
  const email = emailEl.value.trim();
  const password = passEl.value;
  
  if (!email || !password) {
    if (msgEl) { msgEl.textContent = 'Please enter email and password'; msgEl.style.color = '#e74c3c'; }
    return;
  }
  
  const btn = document.querySelector('#login-tab .btn-auth');
  if (btn) {
    btn.innerHTML = '<span class="spinner"></span> Logging in...';
    btn.disabled = true;
  }
  
  try {
    console.log('Logging in with:', email);
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    console.log('Login success! UID:', userCred.user.uid);
    
    currentUser = userCred.user;
    
    await updateDoc(doc(db, 'users', currentUser.uid), {
      isOnline: true,
      lastSeen: serverTimestamp()
    });
    
    if (msgEl) { msgEl.style.color = '#25d366'; msgEl.textContent = 'Welcome back!'; }
    
    setTimeout(() => {
      showChatScreen();
    }, 500);
  } catch (err) {
    console.error('Login error:', err.code, err.message);
    if (msgEl) { msgEl.textContent = err.message; msgEl.style.color = '#e74c3c'; }
    if (btn) {
      btn.innerHTML = '<span class="btn-text">Log In</span>';
      btn.disabled = false;
    }
  }
};

window.loginWithGoogle = async function() {
  console.log('=== GOOGLE LOGIN CLICKED ===');
  const provider = new GoogleAuthProvider();
  const msgEl = document.getElementById('auth-message');
  
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', currentUser.uid), {
        name: currentUser.displayName || 'User',
        email: currentUser.email,
        photoURL: currentUser.photoURL || '',
        about: 'Hey there! I am using NetChat.',
        phoneNumber: currentUser.phoneNumber || '',
        isOnline: true,
        lastSeen: serverTimestamp(),
        darkMode: false,
        createdAt: serverTimestamp()
      });
    } else {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        isOnline: true,
        lastSeen: serverTimestamp()
      });
    }
    
    showChatScreen();
  } catch (err) {
    console.error('Google login error:', err);
    if (msgEl) { msgEl.style.color = '#e74c3c'; msgEl.textContent = err.message; }
  }
};

window.loginWithGithub = async function() {
  console.log('=== GITHUB LOGIN CLICKED ===');
  const provider = new GithubAuthProvider();
  const msgEl = document.getElementById('auth-message');
  
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', currentUser.uid), {
        name: currentUser.displayName || 'User',
        email: currentUser.email,
        photoURL: currentUser.photoURL || '',
        about: 'Hey there! I am using NetChat.',
        phoneNumber: '',
        isOnline: true,
        lastSeen: serverTimestamp(),
        darkMode: false,
        createdAt: serverTimestamp()
      });
    } else {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        isOnline: true,
        lastSeen: serverTimestamp()
      });
    }
    
    showChatScreen();
  } catch (err) {
    console.error('Github login error:', err);
    if (msgEl) { msgEl.style.color = '#e74c3c'; msgEl.textContent = err.message; }
  }
};

window.logout = async function() {
  console.log('=== LOGOUT CLICKED ===');
  
  if (currentUser) {
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        isOnline: false,
        lastSeen: serverTimestamp()
      });
    } catch(e) {}
  }
  
  if (messagesUnsub) messagesUnsub();
  if (usersUnsub) usersUnsub();
  if (statusUnsub) statusUnsub();
  if (unreadUnsub) unreadUnsub();
  
  await signOut(auth);
  currentUser = null;
  currentChatId = null;
  currentChatPartner = null;
  unreadCounts = {};
  
  const ids = ['login-email','login-password','signup-name','signup-email','signup-password'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  const msgEl = document.getElementById('auth-message');
  if (msgEl) { msgEl.textContent = ''; msgEl.style.color = '#e74c3c'; }
  
  const loginBtn = document.querySelector('#login-tab .btn-auth');
  const signupBtn = document.querySelector('#signup-tab .btn-auth');
  if (loginBtn) { loginBtn.innerHTML = '<span class="btn-text">Log In</span>'; loginBtn.disabled = false; }
  if (signupBtn) { signupBtn.innerHTML = '<span class="btn-text">Create Account</span>'; signupBtn.disabled = false; }
  
  showScreen('auth-screen');
};

// ===== SCREEN NAVIGATION =====

window.showScreen = function(screenId) {
  console.log('Showing screen:', screenId);
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.remove('hidden');
};

window.showChatScreen = function() {
  console.log('Showing chat screen');
  showScreen('main-screen');
  showTabScreen('chats-tab');
  loadUserData();
  listenUsers();
  listenStatuses();
  listenUnreadMessages();
};

window.showTabScreen = function(tabId) {
  console.log('Showing tab:', tabId);
  document.querySelectorAll('.tab-screen').forEach(t => t.classList.add('hidden'));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.remove('hidden');
  
  document.querySelectorAll('.bottom-nav-btn').forEach(btn => btn.classList.remove('active'));
  const tabMap = { 'chats-tab': 0, 'status-tab': 1, 'settings-tab': 2 };
  const idx = tabMap[tabId];
  const navBtns = document.querySelectorAll('.bottom-nav-btn');
  if (idx !== undefined && navBtns[idx]) {
    navBtns[idx].classList.add('active');
  }
  
  if (tabId === 'settings-tab') loadSettings();
  if (tabId === 'status-tab') loadStatusTab();
};

// ===== USER DATA =====

async function loadUserData() {
  if (!currentUser) return;
  try {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      if (data.darkMode) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    }
  } catch(e) { console.error('loadUserData error:', e); }
}

// ===== UNREAD MESSAGES =====

function listenUnreadMessages() {
  if (unreadUnsub) unreadUnsub();
  if (!currentUser) return;
  
  const chatsRef = collection(db, 'chats');
  
  unreadUnsub = onSnapshot(chatsRef, async (snapshot) => {
    unreadCounts = {};
    
    for (const chatDoc of snapshot.docs) {
      const chatId = chatDoc.id;
      if (!chatId.includes(currentUser.uid)) continue;
      
      const ids = chatId.split('_');
      const otherId = ids[0] === currentUser.uid ? ids[1] : ids[0];
      
      if (!otherId) continue;
      
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const q = query(
        messagesRef,
        where('senderId', '==', otherId),
        where('status', 'in', ['sent', 'delivered'])
      );
      
      try {
        const msgSnapshot = await getDocs(q);
        const count = msgSnapshot.size;
        if (count > 0) {
          unreadCounts[otherId] = count;
        }
      } catch(e) {}
    }
    
    listenUsers();
  }, (err) => {
    console.error('listenUnreadMessages error:', err);
  });
}

// ===== USERS LIST =====

async function listenUsers() {
  if (usersUnsub) usersUnsub();
  
  usersUnsub = onSnapshot(collection(db, 'users'), async (snapshot) => {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    const searchInput = document.getElementById('search-user');
    const currentSearch = searchInput ? searchInput.value.toLowerCase() : '';
    
    let html = '';
    const users = [];
    
    snapshot.forEach(docSnap => {
      if (docSnap.id !== currentUser?.uid) {
        users.push({ id: docSnap.id, ...docSnap.data() });
      }
    });
    
    // Get last messages for each user
    const lastMessages = {};
    for (const user of users) {
      const chatId = [currentUser.uid, user.id].sort().join('_');
      try {
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'));
        const msgSnap = await getDocs(q);
        if (!msgSnap.empty) {
          const msg = msgSnap.docs[0].data();
          lastMessages[user.id] = msg;
        }
      } catch(e) {}
    }
    
    users.forEach(user => {
      if (currentSearch && !user.name?.toLowerCase().includes(currentSearch) && 
          !user.email?.toLowerCase().includes(currentSearch)) return;
      
      const initial = user.name ? user.name[0].toUpperCase() : '?';
      const onlineClass = user.isOnline ? 'online' : '';
      const unreadCount = unreadCounts[user.id] || 0;
      const lastMsg = lastMessages[user.id];
      
      let lastMsgHtml = '';
      if (lastMsg) {
        const isUnread = lastMsg.senderId !== currentUser.uid && lastMsg.status !== 'read';
        const msgText = lastMsg.type === 'image' ? '📷 Photo' : 
                       lastMsg.type === 'video' ? '🎥 Video' : 
                       escapeHtml(lastMsg.text) || '';
        lastMsgHtml = `<div class="user-last-msg ${isUnread ? 'unread' : ''}">${msgText}</div>`;
      }
      
      html += `
        <div class="user-item" onclick="window.openChat('${user.id}', '${(user.name || 'User').replace(/'/g, "\\\\'")}', '${(user.email || '').replace(/'/g, "\\\\'")}')">
          <div class="user-avatar-wrap">
            <div class="user-avatar">
              ${user.photoURL ? `<img src="${user.photoURL}" alt="">` : initial}
            </div>
            ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</div>` : ''}
          </div>
          <div class="user-info">
            <div class="user-name">${escapeHtml(user.name) || 'User'}</div>
            ${lastMsgHtml}
            ${!lastMsg ? `<div class="user-email">${escapeHtml(user.email) || ''}</div>` : ''}
          </div>
          <div class="user-status ${onlineClass}"></div>
        </div>
      `;
    });
    
    usersList.innerHTML = html || '<div class="no-users">No users found</div>';
  }, (err) => {
    console.error('listenUsers error:', err);
  });
}

window.searchUser = function() {
  listenUsers();
};

// ===== CHAT =====

window.openChat = async function(userId, name, email) {
  console.log('Opening chat with:', name);
  currentChatPartner = { id: userId, name, email };
  
  const ids = [currentUser.uid, userId].sort();
  currentChatId = ids.join('_');
  
  const chatWithName = document.getElementById('chat-with-name');
  const chatScreen = document.getElementById('chat-screen');
  
  if (chatWithName) chatWithName.textContent = name;
  if (chatScreen) chatScreen.classList.remove('hidden');
  
  // Mark all messages from this user as read immediately
  try {
    const messagesRef = collection(db, 'chats', currentChatId, 'messages');
    const q = query(
      messagesRef,
      where('senderId', '==', userId),
      where('status', 'in', ['sent', 'delivered'])
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach(docSnap => {
      batch.update(doc(db, 'chats', currentChatId, 'messages', docSnap.id), { status: 'read' });
    });
    await batch.commit();
    
    delete unreadCounts[userId];
    listenUsers();
  } catch(e) { console.error('Error marking read:', e); }
  
  onSnapshot(doc(db, 'users', userId), (docSnap) => {
    const statusEl = document.getElementById('chat-status');
    if (!statusEl) return;
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.isOnline) {
        statusEl.textContent = 'online';
        statusEl.className = 'status online';
      } else {
        const lastSeen = data.lastSeen?.toDate();
        if (lastSeen) {
          statusEl.textContent = 'last seen ' + formatTime(lastSeen);
        } else {
          statusEl.textContent = 'offline';
        }
        statusEl.className = 'status';
      }
    }
  });
  
  loadMessages();
};

window.backToUsers = function() {
  const chatScreen = document.getElementById('chat-screen');
  if (chatScreen) chatScreen.classList.add('hidden');
  if (messagesUnsub) messagesUnsub();
  currentChatId = null;
  currentChatPartner = null;
};

function loadMessages() {
  if (!currentChatId) return;
  if (messagesUnsub) messagesUnsub();
  
  const messagesRef = collection(db, 'chats', currentChatId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));
  
  messagesUnsub = onSnapshot(q, (snapshot) => {
    const messagesArea = document.getElementById('messages-area');
    if (!messagesArea) return;
    
    let html = '';
    
    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      const isMe = msg.senderId === currentUser.uid;
      const time = msg.timestamp?.toDate ? formatTime(msg.timestamp.toDate()) : '';
      
      let statusIcon = '';
      if (isMe) {
        if (msg.status === 'read') {
          statusIcon = '<span class="msg-status read">✓✓</span>';
        } else if (msg.status === 'delivered') {
          statusIcon = '<span class="msg-status">✓✓</span>';
        } else {
          statusIcon = '<span class="msg-status">✓</span>';
        }
      }
      
      // Render based on message type
      let contentHtml = '';
      if (msg.type === 'image') {
        contentHtml = `<div class="msg-media-wrapper"><img src="${msg.content}" class="msg-image" alt="Image" onclick="window.openImageViewer('${msg.content}')"></div>`;
        if (msg.text) contentHtml += `<div class="message-text">${escapeHtml(msg.text)}</div>`;
      } else if (msg.type === 'video') {
        contentHtml = `<div class="msg-media-wrapper"><video src="${msg.content}" class="msg-video" controls playsinline preload="metadata"></video></div>`;
        if (msg.text) contentHtml += `<div class="message-text">${escapeHtml(msg.text)}</div>`;
      } else {
        contentHtml = `<div class="message-text">${escapeHtml(msg.text)}</div>`;
      }
      
      html += `
        <div class="message ${isMe ? 'me' : 'them'}">
          ${contentHtml}
          <div class="message-meta">
            <span class="message-time">${time}</span>
            ${statusIcon}
          </div>
        </div>
      `;
    });
    
    messagesArea.innerHTML = html;
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }, (err) => {
    console.error('loadMessages error:', err);
  });
}

window.sendMessage = async function() {
  const input = document.getElementById('message-input');
  if (!input) return;
  const text = input.value.trim();
  
  if (!text || !currentChatId || !currentUser) return;
  
  input.value = '';
  
  try {
    await addDoc(collection(db, 'chats', currentChatId, 'messages'), {
      senderId: currentUser.uid,
      receiverId: currentChatPartner.id,
      text: text,
      type: 'text',
      timestamp: serverTimestamp(),
      status: 'sent'
    });
    
    setTimeout(async () => {
      try {
        const messagesRef = collection(db, 'chats', currentChatId, 'messages');
        const q = query(messagesRef, where('senderId', '==', currentUser.uid), where('status', '==', 'sent'));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach(docSnap => {
          batch.update(doc(db, 'chats', currentChatId, 'messages', docSnap.id), { status: 'delivered' });
        });
        await batch.commit();
      } catch(e) {}
    }, 1500);
  } catch (err) {
    console.error('sendMessage error:', err);
  }
};

// ===== SEND IMAGE/VIDEO IN CHAT =====

window.sendImage = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser || !currentChatId) return;
    
    try {
      const messagesArea = document.getElementById('messages-area');
      const uploadingDiv = document.createElement('div');
      uploadingDiv.className = 'message me uploading-msg';
      uploadingDiv.innerHTML = '<div class="message-text">📤 Sending image...</div>';
      messagesArea.appendChild(uploadingDiv);
      messagesArea.scrollTop = messagesArea.scrollHeight;
      
      // Upload with metadata for proper download URL
      const storageRef = ref(storage, `chat_images/${currentChatId}/${Date.now()}_${file.name}`);
      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: currentUser.uid,
          chatId: currentChatId
        }
      };
      
      await uploadBytes(storageRef, file, metadata);
      const url = await getDownloadURL(storageRef);
      
      uploadingDiv.remove();
      
      await addDoc(collection(db, 'chats', currentChatId, 'messages'), {
        senderId: currentUser.uid,
        receiverId: currentChatPartner.id,
        text: '',
        type: 'image',
        content: url,
        timestamp: serverTimestamp(),
        status: 'sent'
      });
    } catch (err) {
      console.error('sendImage error:', err);
      alert('Failed to send image: ' + err.message);
    }
  };
  input.click();
};

window.sendVideo = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser || !currentChatId) return;
    
    if (file.size > 50 * 1024 * 1024) {
      alert('Video too large. Max 50MB.');
      return;
    }
    
    try {
      const messagesArea = document.getElementById('messages-area');
      const uploadingDiv = document.createElement('div');
      uploadingDiv.className = 'message me uploading-msg';
      uploadingDiv.innerHTML = '<div class="message-text">📤 Sending video...</div>';
      messagesArea.appendChild(uploadingDiv);
      messagesArea.scrollTop = messagesArea.scrollHeight;
      
      const storageRef = ref(storage, `chat_videos/${currentChatId}/${Date.now()}_${file.name}`);
      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: currentUser.uid,
          chatId: currentChatId
        }
      };
      
      await uploadBytes(storageRef, file, metadata);
      const url = await getDownloadURL(storageRef);
      
      uploadingDiv.remove();
      
      await addDoc(collection(db, 'chats', currentChatId, 'messages'), {
        senderId: currentUser.uid,
        receiverId: currentChatPartner.id,
        text: '',
        type: 'video',
        content: url,
        timestamp: serverTimestamp(),
        status: 'sent'
      });
    } catch (err) {
      console.error('sendVideo error:', err);
      alert('Failed to send video: ' + err.message);
    }
  };
  input.click();
};

window.openImageViewer = function(url) {
  const viewer = document.getElementById('image-viewer');
  const img = document.getElementById('viewer-image');
  if (viewer && img) {
    img.src = url;
    viewer.classList.remove('hidden');
  }
};

window.closeImageViewer = function() {
  const viewer = document.getElementById('image-viewer');
  if (viewer) viewer.classList.add('hidden');
};






// ===== INPUT TOGGLE (Send vs Mic) =====

window.toggleSendMic = function(input) {
  const btn = document.getElementById('btn-mic');
  if (!btn) return;
  
  if (input.value.trim().length > 0) {
    btn.innerHTML = '➤';
    btn.style.background = 'var(--primary)';
  } else {
    btn.innerHTML = '🎙️';
    btn.style.background = 'var(--primary)';
  }
};

// ===== ATTACHMENT MENU =====

window.toggleAttachMenu = function() {
  const menu = document.getElementById('attach-menu');
  if (menu) menu.classList.toggle('hidden');
};

window.hideAttachMenu = function() {
  const menu = document.getElementById('attach-menu');
  if (menu) menu.classList.add('hidden');
};













// ===== EMOJI PICKER =====

window.toggleEmoji = function() {
  const picker = document.getElementById('emoji-picker');
  if (picker) picker.classList.toggle('hidden');
};

window.addEmoji = function(emoji) {
  const input = document.getElementById('message-input');
  if (input) {
    input.value += emoji;
    input.focus();
  }
};

// ===== STATUS / STORIES =====

window.showStatusModal = function() {
  const modal = document.getElementById('status-modal');
  if (modal) modal.classList.remove('hidden');
};

window.hideStatusModal = function() {
  const modal = document.getElementById('status-modal');
  const input = document.getElementById('status-text-input');
  const preview = document.getElementById('status-image-preview');
  if (modal) modal.classList.add('hidden');
  if (input) input.value = '';
  if (preview) preview.innerHTML = '';
};

window.postTextStatus = async function() {
  const input = document.getElementById('status-text-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text || !currentUser) return;
  
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
  const bgColor = colors[Math.floor(Math.random() * colors.length)];
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  try {
    await addDoc(collection(db, 'statuses'), {
      userId: currentUser.uid,
      type: 'text',
      content: text,
      caption: '',
      backgroundColor: bgColor,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      viewers: []
    });
    
    hideStatusModal();
    showTabScreen('status-tab');
  } catch (err) {
    console.error('postTextStatus error:', err);
  }
};

window.postImageStatus = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;
    
    const preview = document.getElementById('status-image-preview');
    if (preview) preview.innerHTML = '<div class="uploading">Uploading...</div>';
    
    try {
      const storageRef = ref(storage, `statuses/${currentUser.uid}/${Date.now()}_${file.name}`);
      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: currentUser.uid
        }
      };
      
      await uploadBytes(storageRef, file, metadata);
      const url = await getDownloadURL(storageRef);
      
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      await addDoc(collection(db, 'statuses'), {
        userId: currentUser.uid,
        type: 'image',
        content: url,
        caption: '',
        backgroundColor: '',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        viewers: []
      });
      
      hideStatusModal();
      showTabScreen('status-tab');
    } catch (err) {
      console.error('postImageStatus error:', err);
      alert('Failed to post status: ' + err.message);
    }
  };
  
  input.click();
};

function listenStatuses() {
  if (statusUnsub) statusUnsub();
  
  // FIX: Don't use where query on expiresAt - just get all and filter client-side
  // This avoids the issue with serverTimestamp() being null initially
  statusUnsub = onSnapshot(collection(db, 'statuses'), (snapshot) => {
    loadStatusTab();
  }, (err) => {
    console.error('listenStatuses error:', err);
  });
}

async function loadStatusTab() {
  const container = document.getElementById('status-list');
  if (!container) return;
  
  try {
    const now = Timestamp.now();
    const snapshot = await getDocs(collection(db, 'statuses'));
    
    let myStatusHtml = '';
    let othersStatusHtml = '';
    
    const myStatuses = [];
    const othersStatuses = [];
    
    snapshot.forEach(docSnap => {
      const status = docSnap.data();
      // FIX: Check if expiresAt exists and is a valid timestamp
      if (!status.expiresAt) return;
      
      // Handle both Timestamp and Date objects
      let expiresTime;
      if (status.expiresAt.toMillis) {
        expiresTime = status.expiresAt.toMillis();
      } else if (status.expiresAt.seconds) {
        expiresTime = status.expiresAt.seconds * 1000;
      } else {
        expiresTime = new Date(status.expiresAt).getTime();
      }
      
      if (expiresTime < Date.now()) return;
      
      if (status.userId === currentUser?.uid) {
        myStatuses.push({ id: docSnap.id, ...status });
      } else {
        othersStatuses.push({ id: docSnap.id, ...status });
      }
    });
    
    if (myStatuses.length > 0) {
      const latest = myStatuses[myStatuses.length - 1];
      const viewerCount = latest.viewers?.length || 0;
      const myName = currentUser?.displayName || 'Me';
      const myInitial = myName[0]?.toUpperCase() || 'M';
      
      myStatusHtml = `
        <div class="status-section">
          <h3>My Status</h3>
          <div class="status-item" onclick="window.viewMyStatuses()">
            <div class="status-avatar has-status">
              ${currentUser?.photoURL ? `<img src="${currentUser.photoURL}" alt="">` : myInitial}
            </div>
            <div class="status-info">
              <div class="status-name">My Status</div>
              <div class="status-time">${formatTime(latest.createdAt?.toDate())} · ${viewerCount} views</div>
            </div>
          </div>
        </div>
      `;
    } else {
      myStatusHtml = `
        <div class="status-section">
          <h3>My Status</h3>
          <div class="status-item" onclick="window.showStatusModal()">
            <div class="status-avatar add-status">
              <span>+</span>
            </div>
            <div class="status-info">
              <div class="status-name">Add Status</div>
              <div class="status-time">Tap to add status update</div>
            </div>
          </div>
        </div>
      `;
    }
    
    const userStatuses = {};
    othersStatuses.forEach(status => {
      if (!userStatuses[status.userId]) userStatuses[status.userId] = [];
      userStatuses[status.userId].push(status);
    });
    
    for (const [userId, statuses] of Object.entries(userStatuses)) {
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.exists() ? userDoc.data() : { name: 'User' };
      const latest = statuses[statuses.length - 1];
      const hasViewed = latest.viewers?.some(v => v.userId === currentUser?.uid);
      const initial = userData.name ? userData.name[0].toUpperCase() : '?';
      
      othersStatusHtml += `
        <div class="status-item" onclick="window.viewStatus('${userId}')">
          <div class="status-avatar ${hasViewed ? '' : 'has-status'}">
            ${userData.photoURL ? `<img src="${userData.photoURL}" alt="">` : initial}
          </div>
          <div class="status-info">
            <div class="status-name">${escapeHtml(userData.name) || 'User'}</div>
            <div class="status-time">${formatTime(latest.createdAt?.toDate())}</div>
          </div>
        </div>
      `;
    }
    
    container.innerHTML = myStatusHtml + 
      (othersStatusHtml ? `<div class="status-section"><h3>Recent Updates</h3>${othersStatusHtml}</div>` : 
      '<div class="no-status">No recent updates</div>');
  } catch (err) {
    console.error('loadStatusTab error:', err);
  }
}

window.viewStatus = async function(userId) {
  try {
    const snapshot = await getDocs(collection(db, 'statuses'));
    const statuses = [];
    
    snapshot.forEach(docSnap => {
      const status = docSnap.data();
      if (status.userId !== userId) return;
      
      // Check expiration
      if (!status.expiresAt) return;
      let expiresTime;
      if (status.expiresAt.toMillis) {
        expiresTime = status.expiresAt.toMillis();
      } else if (status.expiresAt.seconds) {
        expiresTime = status.expiresAt.seconds * 1000;
      } else {
        expiresTime = new Date(status.expiresAt).getTime();
      }
      
      if (expiresTime > Date.now()) {
        statuses.push({ id: docSnap.id, ...status });
      }
    });
    
    if (statuses.length === 0) return;
    statuses.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds || 0) * 1000;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds || 0) * 1000;
      return aTime - bTime;
    });
    
    let currentIndex = 0;
    const viewer = document.getElementById('status-viewer');
    const content = document.getElementById('status-viewer-content');
    const progress = document.getElementById('status-progress');
    
    if (!viewer || !content || !progress) return;
    
    function showStatus(index) {
      if (index >= statuses.length) {
        hideStatusViewer();
        return;
      }
      
      const status = statuses[index];
      currentIndex = index;
      
      if (!status.viewers?.some(v => v.userId === currentUser?.uid)) {
        updateDoc(doc(db, 'statuses', status.id), {
          viewers: arrayUnion({ userId: currentUser.uid, viewedAt: serverTimestamp() })
        }).catch(() => {});
      }
      
      if (status.type === 'text') {
        content.innerHTML = `<div class="status-text-content" style="background: ${status.backgroundColor}">${escapeHtml(status.content)}</div>`;
      } else if (status.type === 'image') {
        content.innerHTML = `<img src="${status.content}" class="status-image-content" alt="Status">`;
      }
      
      progress.style.width = '0%';
      progress.style.transition = 'none';
      setTimeout(() => {
        progress.style.transition = 'width 5s linear';
        progress.style.width = '100%';
      }, 50);
      
      setTimeout(() => showStatus(index + 1), 5000);
    }
    
    viewer.classList.remove('hidden');
    showStatus(0);
  } catch (err) {
    console.error('viewStatus error:', err);
  }
};

window.hideStatusViewer = function() {
  const viewer = document.getElementById('status-viewer');
  if (viewer) viewer.classList.add('hidden');
};

window.viewMyStatuses = async function() {
  try {
    const snapshot = await getDocs(collection(db, 'statuses'));
    const statuses = [];
    
    snapshot.forEach(docSnap => {
      const status = docSnap.data();
      if (status.userId !== currentUser?.uid) return;
      
      if (!status.expiresAt) return;
      let expiresTime;
      if (status.expiresAt.toMillis) {
        expiresTime = status.expiresAt.toMillis();
      } else if (status.expiresAt.seconds) {
        expiresTime = status.expiresAt.seconds * 1000;
      } else {
        expiresTime = new Date(status.expiresAt).getTime();
      }
      
      if (expiresTime > Date.now()) {
        statuses.push({ id: docSnap.id, ...status });
      }
    });
    
    if (statuses.length === 0) {
      showStatusModal();
      return;
    }
    
    statuses.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds || 0) * 1000;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds || 0) * 1000;
      return aTime - bTime;
    });
    
    const viewer = document.getElementById('status-viewer');
    const content = document.getElementById('status-viewer-content');
    const progress = document.getElementById('status-progress');
    
    if (!viewer || !content || !progress) return;
    
    function showStatus(index) {
      if (index >= statuses.length) {
        hideStatusViewer();
        return;
      }
      
      const status = statuses[index];
      
      let viewersHtml = '';
      if (status.viewers?.length > 0) {
        viewersHtml = `<div class="status-viewers">Seen by ${status.viewers.length}</div>`;
      }
      
      if (status.type === 'text') {
        content.innerHTML = `<div class="status-text-content" style="background: ${status.backgroundColor}">${escapeHtml(status.content)}</div>${viewersHtml}`;
      } else if (status.type === 'image') {
        content.innerHTML = `<img src="${status.content}" class="status-image-content" alt="Status">${viewersHtml}`;
      }
      
      progress.style.width = '0%';
      progress.style.transition = 'none';
      setTimeout(() => {
        progress.style.transition = 'width 5s linear';
        progress.style.width = '100%';
      }, 50);
      
      setTimeout(() => showStatus(index + 1), 5000);
    }
    
    viewer.classList.remove('hidden');
    showStatus(0);
  } catch (err) {
    console.error('viewMyStatuses error:', err);
  }
};

// ===== SETTINGS (WhatsApp Style) =====

async function loadSettings() {
  if (!currentUser) return;
  
  try {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (!userDoc.exists()) return;
    
    const data = userDoc.data();
    
    const profileSection = document.getElementById('settings-profile');
    const initial = data.name ? data.name[0].toUpperCase() : '?';
    
    if (profileSection) {
      profileSection.innerHTML = `
        <div class="settings-avatar" onclick="document.getElementById('profile-photo-input').click()">
          ${data.photoURL ? `<img src="${data.photoURL}" alt="">` : initial}
          <div class="camera-overlay">📷</div>
        </div>
        <div class="settings-profile-info">
          <div class="settings-name">${escapeHtml(data.name) || 'User'}</div>
          <div class="settings-about">${escapeHtml(data.about) || 'Hey there! I am using NetChat.'}</div>
        </div>
      `;
    }
    
    const nameInput = document.getElementById('setting-name');
    const aboutInput = document.getElementById('setting-about');
    const phoneInput = document.getElementById('setting-phone');
    const darkToggle = document.getElementById('dark-mode-toggle');
    
    if (nameInput) nameInput.value = data.name || '';
    if (aboutInput) aboutInput.value = data.about || '';
    if (phoneInput) phoneInput.value = data.phoneNumber || '';
    if (darkToggle) darkToggle.checked = data.darkMode || false;
  } catch (err) {
    console.error('loadSettings error:', err);
  }
}

window.updateProfileName = async function() {
  const nameInput = document.getElementById('setting-name');
  if (!nameInput || !currentUser) return;
  const name = nameInput.value.trim();
  if (!name) return;
  
  try {
    await updateProfile(currentUser, { displayName: name });
    await updateDoc(doc(db, 'users', currentUser.uid), { name });
    loadSettings();
  } catch (err) {
    console.error('updateProfileName error:', err);
  }
};

window.updateProfileAbout = async function() {
  const aboutInput = document.getElementById('setting-about');
  if (!aboutInput || !currentUser) return;
  const about = aboutInput.value.trim();
  
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { about });
    loadSettings();
  } catch (err) {
    console.error('updateProfileAbout error:', err);
  }
};

window.updateProfilePhone = async function() {
  const phoneInput = document.getElementById('setting-phone');
  if (!phoneInput || !currentUser) return;
  const phone = phoneInput.value.trim();
  
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { phoneNumber: phone });
    loadSettings();
  } catch (err) {
    console.error('updateProfilePhone error:', err);
  }
};

window.uploadProfilePhoto = async function(input) {
  const file = input.files[0];
  if (!file || !currentUser) return;
  
  try {
    const storageRef = ref(storage, `profiles/${currentUser.uid}/${Date.now()}_${file.name}`);
    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: currentUser.uid
      }
    };
    
    await uploadBytes(storageRef, file, metadata);
    const url = await getDownloadURL(storageRef);
    
    await updateProfile(currentUser, { photoURL: url });
    await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: url });
    loadSettings();
  } catch (err) {
    console.error('uploadProfilePhoto error:', err);
    alert('Failed to upload photo: ' + err.message);
  }
};

window.toggleDarkMode = async function() {
  const darkToggle = document.getElementById('dark-mode-toggle');
  if (!darkToggle) return;
  const isDark = darkToggle.checked;
  document.body.classList.toggle('dark-mode', isDark);
  
  if (currentUser) {
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { darkMode: isDark });
    } catch (err) {
      console.error('toggleDarkMode error:', err);
    }
  }
};

// ===== UTILITIES =====

function formatTime(date) {
  if (!date) return '';
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
  if (diff < 86400000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== INIT =====
console.log('✅ NetChat app.js loaded! All functions exposed to window.');
