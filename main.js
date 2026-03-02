// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// State management
let currentPage = 'home';
let authMode = 'login';
let currentUser = null;

// Helper functions
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    showToast(error.message || 'An error occurred');
    throw error;
  }
}

// Track page view
async function trackPageView(page) {
  try {
    const visitorId = localStorage.getItem('visitor_id') || generateVisitorId();
    
    await apiRequest('/stats/pageview', {
      method: 'POST',
      body: JSON.stringify({
        page,
        visitorId,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      })
    });
    
    localStorage.setItem('visitor_id', visitorId);
  } catch (error) {
    // Silent fail for tracking
  }
}

function generateVisitorId() {
  return 'visitor_' + Math.random().toString(36).substr(2, 9);
}

// Authentication handlers
async function handleAuth(e) {
  e.preventDefault();
  
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  
  try {
    let response;
    
    if (authMode === 'signup') {
      const name = document.getElementById('auth-name').value.trim();
      const confirm = document.getElementById('auth-confirm').value;
      
      if (password !== confirm) {
        showToast('Passwords do not match');
        return;
      }
      
      response = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      
      showToast(`✓ Welcome, ${name}! Account created.`);
    } else {
      response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      showToast(`✓ Welcome back, ${response.user.name}!`);
    }
    
    // Store auth data
    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('current_user', JSON.stringify(response.user));
    currentUser = response.user;
    
    // Update UI
    updateAuthUI();
    closeModal();
    
    // Track login
    trackPageView('login');
    
  } catch (error) {
    // Error already handled by apiRequest
  }
}

// Contact form handler
async function handleContact(e) {
  e.preventDefault();
  
  const formData = {
    firstName: e.target.querySelector('[placeholder="Rahul"]').value,
    lastName: e.target.querySelector('[placeholder="Sharma"]').value,
    email: e.target.querySelector('[type="email"]').value,
    subject: e.target.querySelector('[placeholder="Collaboration / Mentorship / General"]').value,
    message: e.target.querySelector('textarea').value
  };
  
  try {
    const response = await apiRequest('/messages', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    
    e.target.reset();
    showToast('✓ Message sent! I\'ll get back to you soon.');
    
    // Track message sent
    trackPageView('message_sent');
    
  } catch (error) {
    // Error handled by apiRequest
  }
}

// Newsletter subscription
async function handleNewsletter(email) {
  try {
    const response = await apiRequest('/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    
    showToast('✓ Successfully subscribed to newsletter!');
    return response;
  } catch (error) {
    showToast('Failed to subscribe. Please try again.');
  }
}

// Update UI based on auth state
function updateAuthUI() {
  const user = JSON.parse(localStorage.getItem('current_user'));
  const navActions = document.querySelector('.nav-actions');
  
  if (user) {
    navActions.innerHTML = `
      <span class="user-name" style="margin-right: 1rem; font-size: 0.9rem;">👤 ${user.name}</span>
      <button class="btn-outline" onclick="logout()">Logout</button>
    `;
  } else {
    navActions.innerHTML = `
      <button class="btn-outline" onclick="openModal('login')">Login</button>
      <button class="btn-solid" onclick="openModal('signup')">Sign Up</button>
    `;
  }
}

function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('current_user');
  currentUser = null;
  updateAuthUI();
  showToast('✓ Logged out successfully');
}

// Load portfolio data
async function loadPortfolioData() {
  try {
    // Load experiences
    const experiences = await apiRequest('/portfolio/experience');
    updateExperienceSection(experiences);
    
    // Load skills
    const skills = await apiRequest('/portfolio/skill');
    updateSkillsSection(skills);
    
    // Load achievements
    const achievements = await apiRequest('/portfolio/achievement');
    updateAchievementsSection(achievements);
    
  } catch (error) {
    console.error('Failed to load portfolio data:', error);
  }
}

// Update sections with loaded data
function updateExperienceSection(experiences) {
  const timeline = document.querySelector('.exp-timeline');
  if (!timeline || !experiences.length) return;
  
  // Keep the exp-line
  const expLine = timeline.querySelector('.exp-line');
  timeline.innerHTML = '';
  if (expLine) timeline.appendChild(expLine);
  
  experiences.forEach(exp => {
    const expItem = document.createElement('div');
    expItem.className = 'exp-item';
    expItem.innerHTML = `
      <div class="exp-dot"></div>
      <div class="exp-card">
        <div class="exp-period">${exp.details?.period || 'Present'}</div>
        <div class="exp-title">${exp.title}</div>
        <div class="exp-desc">${exp.description}</div>
      </div>
    `;
    timeline.appendChild(expItem);
  });
}

function updateSkillsSection(skills) {
  const skillsGrid = document.querySelector('.skills-grid');
  if (!skillsGrid || !skills.length) return;
  
  skillsGrid.innerHTML = skills.map(skill => `
    <div class="skill-card">
      <div class="skill-icon">${skill.details?.icon || '📚'}</div>
      <div class="skill-name">${skill.title}</div>
      <div class="skill-pct">${skill.details?.percentage || '85%'}</div>
      <div class="skill-bar-bg">
        <div class="skill-bar-fill" style="width:${skill.details?.percentage || '85%'}"></div>
      </div>
    </div>
  `).join('');
}

function updateAchievementsSection(achievements) {
  const achGrid = document.querySelector('.ach-grid');
  if (!achGrid || !achievements.length) return;
  
  // Group achievements by category
  const grouped = achievements.reduce((acc, ach) => {
    const category = ach.details?.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(ach);
    return acc;
  }, {});
  
  achGrid.innerHTML = Object.entries(grouped).map(([category, items]) => `
    <div class="ach-card">
      <div class="ach-icon">${getCategoryIcon(category)}</div>
      <h3>${category}</h3>
      <ul>
        ${items.map(item => `<li>${item.title}</li>`).join('')}
      </ul>
    </div>
  `).join('');
}

function getCategoryIcon(category) {
  const icons = {
    awards: '🏆',
    publications: '📄',
    certifications: '🎓',
    impact: '🌐',
    other: '⭐'
  };
  return icons[category.toLowerCase()] || icons.other;
}

// Initialize everything
document.addEventListener('DOMContentLoaded', async () => {
  // Check for saved auth
  currentUser = JSON.parse(localStorage.getItem('current_user'));
  updateAuthUI();
  
  // Load portfolio data
  await loadPortfolioData();
  
  // Track initial page view
  trackPageView('home');
  
  // Set up scroll and reveal
  setupScrollHandler();
  initReveals();
  
  // Set up modal close on outside click
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) closeModal();
  });
});

function setupScrollHandler() {
  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
    initReveals();
  });
}

// Export functions for global use
window.handleAuth = handleAuth;
window.handleContact = handleContact;
window.handleNewsletter = handleNewsletter;
window.logout = logout;
