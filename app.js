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
  getDocs, 
  addDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  updateDoc,
  Timestamp
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

// ========== GLOBAL VARIABLES ==========
let currentUser = null;
let currentChatId = null;
let messagesUnsubscribe = null;
let usersUnsubscribe = null;

// ========== AUTH FUNCTIONS ==========

// Show Login or Signup tab
window.showTab = function(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  
  if(tab === 'login') {
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.getElementById('login-tab').classList.remove('hidden');
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('signup-tab').classList.remove('hidden');
  }
};

// Sign Up
window.signup = async function() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const msg = document.getElementById('auth-message');
  
  if(!name || !email || !password) {
    msg.textContent = "Please fill all fields";
    return;
  }
  if(password.length < 6) {
    msg.textContent = "Password must be 6+ characters";
    return;
  }
  
  try {
    msg.textContent = "Creating account...";
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Save user profile to Firestore
    await setDoc(doc(db, "users", user.uid), {
      name: name,
      email: email,
      uid: user.uid,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      online: true
    });
    
    msg.style.color = "#25d366";
    msg.textContent = "Account created! Logging in...";
    
  } catch(error) {
    msg.style.color = "#e74c3c";
    msg.textContent = error.message;
  }
};

// Log In
window.login = async function() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('auth-message');
  
  if(!email || !password) {
    msg.textContent = "Please fill all fields";
    return;
  }
  
  try {
    msg.textContent = "Logging in...";
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will handle redirect
  } catch(error) {
    msg.style.color = "#e74c3c";
    msg.textContent = "Wrong email or password";
  }
};

// Log Out
window.logout = async function() {
  if(currentUser) {
    // Set offline before logout
    await updateDoc(doc(db, "users", currentUser.uid), {
      online: false,
      lastSeen: serverTimestamp()
    });
  }
  await signOut(auth);
  window.location.href = "index.html";
};

// ========== AUTH STATE LISTENER ==========
onAuthStateChanged(auth, async (user) => {
  if(user) {
    currentUser = user;
    
    // Update online status
    await updateDoc(doc(db, "users", user.uid), {
      online: true,
      lastSeen: serverTimestamp()
    });
    
    // Redirect to chat if on login page
    if(window.location.pathname.includes('index')) {
      window.location.href = "chat.html";
    }
    
    // Load chat page stuff
    if(document.getElementById('my-name')) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      document.getElementById('my-name').textContent = "👤 " + (userData?.name || user.email);
      loadUsers();
    }
    
  } else {
    currentUser = null;
    // Redirect to login if on chat page
    if(window.location.pathname.includes('chat')) {
      window.location.href = "index.html";
    }
  }
});

// ========== USERS LIST ==========
window.loadUsers = function() {
  const usersList = document.getElementById('users-list');
  
  // Listen for all users in real-time
  const q = query(collection(db, "users"));
  
  usersUnsubscribe = onSnapshot(q, (snapshot) => {
    usersList.innerHTML = "";
    
    snapshot.forEach((docSnap) => {
      const userData = docSnap.data();
      
      // Don't show yourself
      if(userData.uid === currentUser.uid) return;
      
      const div = document.createElement('div');
      div.className = 'user-item';
      div.onclick = () => openChat(userData);
      
      const initial = userData.name ? userData.name[0].toUpperCase() : '?';
      const isOnline = userData.online ? 'online' : '';
      const statusText = userData.online ? 'Online' : 'Offline';
      
      div.innerHTML = `
        <div class="user-avatar">${initial}</div>
        <div class="user-info">
          <div class="user-name">${userData.name || 'User'}</div>
          <div class="user-email">${userData.email}</div>
        </div>
        <div class="user-status ${isOnline}" title="${statusText}"></div>
      `;
      
      usersList.appendChild(div);
    });
    
    if(usersList.innerHTML === "") {
      usersList.innerHTML = '<div class="no-users">No other users yet.<br>Tell your friends to sign up!</div>';
    }
  });
};

// Search users
window.searchUser = function() {
  const search = document.getElementById('search-user').value.toLowerCase();
  const items = document.querySelectorAll('.user-item');
  
  items.forEach(item => {
    const email = item.querySelector('.user-email').textContent.toLowerCase();
    const name = item.querySelector('.user-name').textContent.toLowerCase();
    
    if(email.includes(search) || name.includes(search)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
};

// ========== CHAT FUNCTIONS ==========

// Generate unique chat ID from two user IDs
function getChatId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// Open chat with a user
window.openChat = async function(otherUser) {
  currentChatId = getChatId(currentUser.uid, otherUser.uid);
  
  // Show chat screen
  document.getElementById('users-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');
  document.getElementById('chat-with-name').textContent = otherUser.name || 'User';
  
  // Update status
  const statusEl = document.getElementById('chat-status');
  if(otherUser.online) {
    statusEl.textContent = "Online";
    statusEl.style.color = "#25d366";
  } else {
    statusEl.textContent = "Offline";
    statusEl.style.color = "#aaa";
  }
  
  // Load messages in real-time
  const messagesArea = document.getElementById('messages-area');
  messagesArea.innerHTML = "";
  
  // Stop previous listener
  if(messagesUnsubscribe) messagesUnsubscribe();
  
  const messagesRef = collection(db, "chats", currentChatId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));
  
  messagesUnsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if(change.type === "added") {
        const msg = change.doc.data();
        displayMessage(msg);
      }
    });
    
    // Scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;
  });
};

// Display a message bubble
function displayMessage(msg) {
  const messagesArea = document.getElementById('messages-area');
  const isMe = msg.senderId === currentUser.uid;
  
  const div = document.createElement('div');
  div.className = `message ${isMe ? 'me' : 'them'}`;
  
  const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
  
  div.innerHTML = `
    ${msg.text}
    <div class="message-time">${time}</div>
  `;
  
  messagesArea.appendChild(div);
}

// Send message
window.sendMessage = async function() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  
  if(!text || !currentChatId) return;
  
  input.value = "";
  
  const messagesRef = collection(db, "chats", currentChatId, "messages");
  
  await addDoc(messagesRef, {
    text: text,
    senderId: currentUser.uid,
    timestamp: serverTimestamp()
  });
  
  // Also update last message in chat document
  await setDoc(doc(db, "chats", currentChatId), {
    users: [currentUser.uid, currentChatId.replace(currentUser.uid, '').replace('_', '')],
    lastMessage: text,
    lastMessageTime: serverTimestamp()
  }, { merge: true });
};

// Back to users list
window.backToUsers = function() {
  document.getElementById('chat-screen').classList.add('hidden');
  document.getElementById('users-screen').classList.remove('hidden');
  
  if(messagesUnsubscribe) {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }
  currentChatId = null;
};

// ========== EMOJI ==========
window.toggleEmoji = function() {
  document.getElementById('emoji-picker').classList.toggle('hidden');
};

window.addEmoji = function(emoji) {
  const input = document.getElementById('message-input');
  input.value += emoji;
  input.focus();
};

// ========== CLEANUP ==========
window.addEventListener('beforeunload', async () => {
  if(currentUser) {
    await updateDoc(doc(db, "users", currentUser.uid), {
      online: false,
      lastSeen: serverTimestamp()
    });
  }
});
