// ========== FIREBASE IMPORTS ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc,
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// ========== YOUR FIREBASE CONFIG ==========
const firebaseConfig = {
  apiKey: "AIzaSyAvP5HI_ttNe2WyUq4ijhkllstugh0d330",
  authDomain: "netchat-a94f0.firebaseapp.com",
  projectId: "netchat-a94f0",
  storageBucket: "netchat-a94f0.firebasestorage.app",
  messagingSenderId: "531502148563",
  appId: "1:531502148563:web:20a4459c40ec4ec6779d26",
  measurementId: "G-240PWD3ZN7"
};

// ========== INITIALIZE ==========
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ========== BASE PATH DETECTOR ==========
function getBasePath() {
  const path = window.location.pathname;
  
  // GitHub Pages: /repo-name/ or /repo-name/page.html
  if (path.includes('/netchat/')) {
    const index = path.indexOf('/netchat/');
    return path.substring(0, index + '/netchat/'.length);
  }
  
  // Also check if the hostname is github.io and we're in a subfolder
  if (window.location.hostname.includes('github.io')) {
    const parts = path.split('/').filter(p => p);
    if (parts.length > 0) {
      return '/' + parts[0] + '/';
    }
  }
  
  return '/';
}

const BASE_PATH = getBasePath();

function pageUrl(filename) {
  return BASE_PATH + filename;
}

// ========== GLOBALS ==========
let currentUser = null;
let currentChatId = null;
let messagesUnsubscribe = null;
let usersUnsubscribe = null;

function showMessage(text, isError = true) {
  const msg = document.getElementById('auth-message');
  if (msg) {
    msg.textContent = text;
    msg.style.color = isError ? '#e74c3c' : '#25d366';
  }
}

// ========== AUTH FUNCTIONS ==========
window.showTab = function(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  
  if (tab === 'login') {
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.getElementById('login-tab').classList.remove('hidden');
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('signup-tab').classList.remove('hidden');
  }
  showMessage('');
};

window.signup = async function() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  
  if (!name || !email || !password) {
    showMessage("Please fill all fields");
    return;
  }
  if (password.length < 6) {
    showMessage("Password must be 6+ characters");
    return;
  }
  
  showMessage("Creating account...", false);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await setDoc(doc(db, "users", user.uid), {
      name: name,
      email: email,
      uid: user.uid,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      online: true
    });
    
    showMessage("Success! Redirecting...", false);
    setTimeout(() => {
      window.location.href = pageUrl('chat.html');
    }, 1000);
    
  } catch (error) {
    console.error("Signup error:", error);
    if (error.code === 'auth/email-already-in-use') {
      showMessage("Email already exists. Please log in.");
    } else {
      showMessage(error.message);
    }
  }
};

window.login = async function() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    showMessage("Please fill all fields");
    return;
  }
  
  showMessage("Logging in...", false);
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage("Success! Redirecting...", false);
    setTimeout(() => {
      window.location.href = pageUrl('chat.html');
    }, 500);
    
  } catch (error) {
    console.error("Login error:", error);
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      showMessage("Wrong email or password");
    } else if (error.code === 'auth/user-not-found') {
      showMessage("Account not found. Please sign up.");
    } else {
      showMessage(error.message);
    }
  }
};

window.logout = async function() {
  try {
    if (currentUser) {
      await updateDoc(doc(db, "users", currentUser.uid), {
        online: false,
        lastSeen: serverTimestamp()
      });
    }
    await signOut(auth);
  } catch (e) {
    console.error(e);
  }
  window.location.href = pageUrl('index.html');
};

// ========== AUTH STATE LISTENER ==========
onAuthStateChanged(auth, async (user) => {
  console.log("Auth state:", user ? user.email : "null");
  
  if (user) {
    currentUser = user;
    
    try {
      await updateDoc(doc(db, "users", user.uid), {
        online: true,
        lastSeen: serverTimestamp()
      });
    } catch (e) {
      console.log("Status update error:", e);
    }
    
    const path = window.location.pathname;
    const onIndexPage = path.endsWith('index.html') || 
                        path.endsWith('/') || 
                        (!path.includes('chat.html'));
    
    if (onIndexPage) {
      console.log("Redirecting to chat at:", pageUrl('chat.html'));
      window.location.href = pageUrl('chat.html');
      return;
    }
    
    if (document.getElementById('my-name')) {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();
        document.getElementById('my-name').textContent = "👤 " + (userData?.name || user.email);
        loadUsers();
      } catch (e) {
        console.error("Load user error:", e);
      }
    }
    
  } else {
    currentUser = null;
    if (window.location.pathname.includes('chat.html')) {
      window.location.href = pageUrl('index.html');
    }
  }
});

// ========== USERS LIST ==========
window.loadUsers = function() {
  const usersList = document.getElementById('users-list');
  if (!usersList) return;
  
  const q = query(collection(db, "users"));
  
  usersUnsubscribe = onSnapshot(q, (snapshot) => {
    usersList.innerHTML = "";
    
    snapshot.forEach((docSnap) => {
      const userData = docSnap.data();
      if (userData.uid === currentUser?.uid) return;
      
      const div = document.createElement('div');
      div.className = 'user-item';
      div.onclick = () => openChat(userData);
      
      const initial = userData.name ? userData.name[0].toUpperCase() : '?';
      const isOnline = userData.online ? 'online' : '';
      
      div.innerHTML = `
        <div class="user-avatar">${initial}</div>
        <div class="user-info">
          <div class="user-name">${userData.name || 'User'}</div>
          <div class="user-email">${userData.email}</div>
        </div>
        <div class="user-status ${isOnline}"></div>
      `;
      
      usersList.appendChild(div);
    });
    
    if (usersList.children.length === 0) {
      usersList.innerHTML = '<div class="no-users">No other users yet.<br>Tell friends to sign up!</div>';
    }
  }, (error) => {
    console.error("Users error:", error);
    usersList.innerHTML = '<div class="no-users">Error loading users.</div>';
  });
};

window.searchUser = function() {
  const search = document.getElementById('search-user').value.toLowerCase();
  document.querySelectorAll('.user-item').forEach(item => {
    const email = item.querySelector('.user-email').textContent.toLowerCase();
    const name = item.querySelector('.user-name').textContent.toLowerCase();
    item.style.display = (email.includes(search) || name.includes(search)) ? 'flex' : 'none';
  });
};

// ========== CHAT FUNCTIONS ==========
function getChatId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

window.openChat = async function(otherUser) {
  if (!currentUser) return;
  currentChatId = getChatId(currentUser.uid, otherUser.uid);
  
  document.getElementById('users-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');
  document.getElementById('chat-with-name').textContent = otherUser.name || 'User';
  
  const statusEl = document.getElementById('chat-status');
  if (otherUser.online) {
    statusEl.textContent = "Online";
    statusEl.style.color = "#25d366";
  } else {
    statusEl.textContent = "Offline";
    statusEl.style.color = "#aaa";
  }
  
  const messagesArea = document.getElementById('messages-area');
  messagesArea.innerHTML = "";
  
  if (messagesUnsubscribe) messagesUnsubscribe();
  
  const messagesRef = collection(db, "chats", currentChatId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));
  
  messagesUnsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        displayMessage(change.doc.data());
      }
    });
    messagesArea.scrollTop = messagesArea.scrollHeight;
  });
};

function displayMessage(msg) {
  const messagesArea = document.getElementById('messages-area');
  if (!messagesArea) return;
  
  const isMe = msg.senderId === currentUser?.uid;
  const div = document.createElement('div');
  div.className = `message ${isMe ? 'me' : 'them'}`;
  
  const time = msg.timestamp 
    ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) 
    : '';
  
  div.innerHTML = `${msg.text}<div class="message-time">${time}</div>`;
  messagesArea.appendChild(div);
}

window.sendMessage = async function() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  
  if (!text || !currentChatId || !currentUser) return;
  
  input.value = "";
  
  try {
    await addDoc(collection(db, "chats", currentChatId, "messages"), {
      text: text,
      senderId: currentUser.uid,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.error("Send error:", e);
  }
};

window.backToUsers = function() {
  document.getElementById('chat-screen').classList.add('hidden');
  document.getElementById('users-screen').classList.remove('hidden');
  if (messagesUnsubscribe) {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }
  currentChatId = null;
};

window.toggleEmoji = function() {
  document.getElementById('emoji-picker').classList.toggle('hidden');
};

window.addEmoji = function(emoji) {
  const input = document.getElementById('message-input');
  input.value += emoji;
  input.focus();
};

window.addEventListener('beforeunload', async () => {
  if (currentUser) {
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        online: false,
        lastSeen: serverTimestamp()
      });
    } catch (e) {}
  }
});
