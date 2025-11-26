// Post-Social Frontend Worker
import { Hono } from 'hono';

type Bindings = {
  ENVIRONMENT: string;
  API_BASE_URL: string;
  POST_SOCIAL_API_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CSS Styles
const styles = `
  :root {
    --bg-primary: #0a0a0f;
    --bg-secondary: #12121a;
    --bg-card: #1a1a24;
    --text-primary: #e8e8ed;
    --text-secondary: #8888a0;
    --accent: #6366f1;
    --accent-hover: #818cf8;
    --success: #22c55e;
    --border: #2a2a3a;
  }
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    line-height: 1.6;
  }
  
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  header {
    text-align: center;
    padding: 4rem 2rem;
    border-bottom: 1px solid var(--border);
  }
  
  h1 {
    font-size: 2.5rem;
    font-weight: 300;
    margin-bottom: 0.5rem;
    letter-spacing: -0.02em;
  }
  
  h1 span {
    font-weight: 600;
    background: linear-gradient(135deg, var(--accent), #a855f7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  .tagline {
    color: var(--text-secondary);
    font-size: 1.1rem;
    margin-bottom: 2rem;
  }
  
  .philosophy {
    font-style: italic;
    color: var(--text-secondary);
    font-size: 0.95rem;
    max-width: 500px;
    margin: 0 auto;
  }
  
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }
  
  .btn-primary {
    background: var(--accent);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }
  
  .btn-github {
    background: #24292e;
    color: white;
  }
  
  .btn-github:hover {
    background: #2f363d;
  }
  
  .btn-logout {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }
  
  .btn-logout:hover {
    border-color: var(--text-secondary);
    color: var(--text-primary);
  }
  
  .divider {
    display: flex;
    align-items: center;
    margin: 1.5rem 0;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
  
  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }
  
  .divider span {
    padding: 0 1rem;
  }
  
  .login-form {
    max-width: 320px;
    margin: 0 auto;
  }
  
  .form-group {
    margin-bottom: 1rem;
    text-align: left;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .form-group input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 1rem;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--accent);
  }
  
  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    display: none;
  }

  .auth-section {
    padding: 3rem 2rem;
    text-align: center;
  }
  
  .features {
    display: grid;
    gap: 1.5rem;
    padding: 2rem;
  }
  
  .feature-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
  }
  
  .feature-card h3 {
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .feature-card p {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    background: var(--accent);
    color: white;
  }
  
  .badge-soon {
    background: var(--border);
    color: var(--text-secondary);
  }
  
  /* Dashboard styles */
  .dashboard {
    padding: 2rem;
  }
  
  .user-info {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .user-details h2 {
    font-size: 1.2rem;
    font-weight: 500;
  }
  
  .user-details p {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .role-badge {
    background: var(--success);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 500;
  }
  
  .post-composer {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .post-composer textarea {
    width: 100%;
    min-height: 120px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    color: var(--text-primary);
    font-size: 1rem;
    resize: vertical;
    margin-bottom: 1rem;
  }
  
  .post-composer textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
  
  .post-composer .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .char-count {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
  
  .posts-list {
    display: grid;
    gap: 1rem;
  }
  
  .post-item {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
  }
  
  .post-item .content {
    margin-bottom: 1rem;
  }
  
  .post-item .meta {
    color: var(--text-secondary);
    font-size: 0.85rem;
    display: flex;
    gap: 1rem;
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }
  
  footer {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
    border-top: 1px solid var(--border);
    margin-top: 2rem;
  }
  
  footer a {
    color: var(--accent);
    text-decoration: none;
  }
  
  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success);
  }
`;

// GitHub SVG icon
const githubIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`;

// Landing page HTML
function landingPage(apiBaseUrl: string, selfUrl: string): string {
  const callbackUrl = `${selfUrl}/callback`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Post-Social — Beyond Performative Identity</title>
  <style>${styles}</style>
</head>
<body>
  <header>
    <h1>post<span>-social</span></h1>
    <p class="tagline">A conferencing system for authentic discourse</p>
    <p class="philosophy">"Synthesis over engagement. Understanding over virality."</p>
  </header>
  
  <section class="auth-section">
    <a href="${apiBaseUrl}/auth/oauth/github/login?redirect=${encodeURIComponent(callbackUrl)}" class="btn btn-github">
      ${githubIcon}
      Continue with GitHub
    </a>
    <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
      More OAuth options coming soon
    </p>
    
    <div class="divider"><span>or sign in with email</span></div>
    
    <form class="login-form" onsubmit="handleLogin(event)">
      <div id="loginError" class="error-message"></div>
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required placeholder="Your password">
      </div>
      <button type="submit" class="btn btn-primary" style="width: 100%;">Sign In</button>
    </form>
  </section>
  
  <script>
    const API_URL = '${apiBaseUrl}';
    
    async function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('loginError');
      
      errorDiv.style.display = 'none';
      
      try {
        const res = await fetch(API_URL + '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          errorDiv.textContent = data.error || 'Login failed';
          errorDiv.style.display = 'block';
          return;
        }
        
        // Store token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Redirect to dashboard
        window.location.href = '/dashboard';
      } catch (err) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
      }
    }
    
    // Check if already logged in
    if (localStorage.getItem('token')) {
      window.location.href = '/dashboard';
    }
  </script>
  
  <section class="features">
    <div class="feature-card">
      <h3>🌊 Conferences <span class="badge">Active</span></h3>
      <p>Topic-focused spaces inspired by VAX Notes and The WELL. Ideas flow, identities blur.</p>
    </div>
    
    <div class="feature-card">
      <h3>🤖 AI Curation <span class="badge-soon badge">Coming</span></h3>
      <p>Llama Guard for safety. Llama-3 for summarization. Your curator never sleeps.</p>
    </div>
    
    <div class="feature-card">
      <h3>🔀 Synthesis Engine <span class="badge-soon badge">Coming</span></h3>
      <p>Posts evolve through comments. Like Git for ideas — track how understanding grows.</p>
    </div>
    
    <div class="feature-card">
      <h3>📓 Personal Notebooks <span class="badge-soon badge">Coming</span></h3>
      <p>Save insights that matter. AI enriches your collection. Chat with your notes.</p>
    </div>
  </section>
  
  <footer>
    <div class="status-indicator">
      <span class="status-dot"></span>
      API Connected
    </div>
    <p style="margin-top: 0.5rem;">
      Part of the <a href="https://humanizer.com">Humanizer</a> ecosystem
    </p>
  </footer>
</body>
</html>`;
}

// Dashboard HTML (after login)
function dashboardPage(user: { email: string; role: string }, apiBaseUrl: string, postSocialApiUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Post-Social</title>
  <style>${styles}</style>
</head>
<body>
  <header style="padding: 2rem;">
    <h1>post<span>-social</span></h1>
  </header>
  
  <div class="container dashboard">
    <div class="user-info">
      <div class="user-details">
        <h2>Welcome back</h2>
        <p>${user.email}</p>
      </div>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <span class="role-badge">${user.role}</span>
        <button onclick="logout()" class="btn btn-logout">Logout</button>
      </div>
    </div>
    
    <div class="post-composer">
      <textarea id="postContent" placeholder="Share a thought, start a discussion..."></textarea>
      <div class="actions">
        <span class="char-count"><span id="charCount">0</span> / 5000</span>
        <button onclick="createPost()" class="btn btn-primary">Post</button>
      </div>
    </div>
    
    <h3 style="margin-bottom: 1rem; color: var(--text-secondary);">Your Posts</h3>
    <div id="postsList" class="posts-list">
      <div class="empty-state">
        <p>Loading posts...</p>
      </div>
    </div>
  </div>
  
  <footer>
    <div class="status-indicator">
      <span class="status-dot"></span>
      Connected
    </div>
  </footer>
  
  <script>
    const API_URL = '${apiBaseUrl}';
    const POST_API_URL = '${postSocialApiUrl}';
    const token = localStorage.getItem('token');
    
    // Character count
    document.getElementById('postContent').addEventListener('input', (e) => {
      document.getElementById('charCount').textContent = e.target.value.length;
    });
    
    // Load posts
    async function loadPosts() {
      try {
        const res = await fetch(POST_API_URL + '/api/posts', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        
        if (data.posts && data.posts.length > 0) {
          document.getElementById('postsList').innerHTML = data.posts.map(post => \`
            <div class="post-item">
              <div class="content">\${escapeHtml(post.content)}</div>
              <div class="meta">
                <span>\${new Date(post.created_at).toLocaleDateString()}</span>
                <span>\${post.visibility}</span>
              </div>
            </div>
          \`).join('');
        } else {
          document.getElementById('postsList').innerHTML = \`
            <div class="empty-state">
              <p>No posts yet. Share your first thought above!</p>
            </div>
          \`;
        }
      } catch (err) {
        console.error('Failed to load posts:', err);
        document.getElementById('postsList').innerHTML = \`
          <div class="empty-state">
            <p>Could not load posts. API may be starting up...</p>
          </div>
        \`;
      }
    }
    
    // Create post
    async function createPost() {
      const content = document.getElementById('postContent').value.trim();
      if (!content) return;
      
      const button = event.target;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Posting...';
      button.style.opacity = '0.6';
      
      try {
        const res = await fetch(POST_API_URL + '/api/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ content, visibility: 'public' })
        });
        
        if (res.ok) {
          document.getElementById('postContent').value = '';
          document.getElementById('charCount').textContent = '0';
          loadPosts();
        } else {
          const err = await res.json();
          alert('Failed to create post: ' + (err.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('Failed to create post:', err);
        alert('Failed to create post');
      } finally {
        button.disabled = false;
        button.textContent = originalText;
        button.style.opacity = '1';
      }
    }
    
    // Logout
    function logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    
    // Escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Load posts on page load
    loadPosts();
  </script>
</body>
</html>`;
}

// Callback page (handles OAuth redirect)
function callbackPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Logging in... — Post-Social</title>
  <style>${styles}</style>
</head>
<body>
  <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh;">
    <div style="text-align: center;">
      <h1>post<span>-social</span></h1>
      <p style="color: var(--text-secondary); margin-top: 1rem;">Completing login...</p>
    </div>
  </div>
  
  <script>
    // Extract token from URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const isNewUser = params.get('isNewUser');
    
    if (token) {
      // Store token
      localStorage.setItem('token', token);
      
      // Decode JWT to get user info (simple base64 decode of payload)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        localStorage.setItem('user', JSON.stringify({
          id: payload.userId,
          email: payload.email,
          role: payload.role
        }));
      } catch (e) {
        console.error('Failed to decode token:', e);
      }
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } else {
      // No token, redirect to home
      window.location.href = '/?error=auth_failed';
    }
  </script>
</body>
</html>`;
}

// Search page HTML
function searchPage(postSocialApiUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search — Post-Social</title>
  <style>${styles}</style>
  <style>
    .search-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    .search-header {
      margin-bottom: 2rem;
    }
    
    .search-box {
      position: relative;
      margin-bottom: 2rem;
    }
    
    .search-input {
      width: 100%;
      padding: 1rem 1rem 1rem 3rem;
      background: var(--bg-card);
      border: 2px solid var(--border);
      border-radius: 12px;
      color: var(--text-primary);
      font-size: 1.1rem;
      transition: border-color 0.2s;
    }
    
    .search-input:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    .search-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-secondary);
      pointer-events: none;
    }
    
    .tag-browser {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .tag-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    
    .tag-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 20px;
      color: var(--text-primary);
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .tag-chip:hover {
      background: var(--accent);
      border-color: var(--accent);
      transform: translateY(-1px);
    }
    
    .tag-chip.active {
      background: var(--accent);
      border-color: var(--accent);
    }
    
    .tag-count {
      opacity: 0.7;
      font-size: 0.85rem;
    }
    
    .search-results {
      display: grid;
      gap: 1rem;
    }
    
    .result-item {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .result-item:hover {
      border-color: var(--accent);
      transform: translateX(4px);
    }
    
    .result-summary {
      color: var(--text-secondary);
      font-size: 0.95rem;
      margin: 0.5rem 0;
      font-style: italic;
    }
    
    .result-content {
      margin: 1rem 0;
      line-height: 1.6;
    }
    
    .result-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 1rem;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    
    .result-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    
    .result-tag {
      padding: 0.25rem 0.75rem;
      background: var(--bg-secondary);
      border-radius: 12px;
      font-size: 0.8rem;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .result-tag:hover {
      background: var(--accent);
      color: white;
      transform: translateY(-1px);
    }
    
    .active-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding: 1rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    
    .active-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--accent);
      border-radius: 20px;
      color: white;
      font-size: 0.9rem;
    }
    
    .active-tag .remove {
      cursor: pointer;
      font-weight: bold;
      opacity: 0.8;
    }
    
    .active-tag .remove:hover {
      opacity: 1;
    }
    
    .similarity-score {
      color: var(--accent);
      font-weight: 500;
    }
    
    .loading {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
    }
    
    .empty-results {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
    }
    
    .nav-bar {
      display: flex;
      gap: 1rem;
      align-items: center;
      padding: 1rem 2rem;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
    }
    
    .nav-link {
      color: var(--text-secondary);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      transition: all 0.2s;
    }
    
    .nav-link:hover {
      color: var(--text-primary);
      background: var(--bg-card);
    }
    
    .nav-link.active {
      color: var(--accent);
      background: var(--bg-card);
    }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <h1 style="font-size: 1.2rem; margin: 0;">post<span>-social</span></h1>
    <div style="flex: 1;"></div>
    <a href="/dashboard" class="nav-link">Dashboard</a>
    <a href="/search" class="nav-link active">Search</a>
    <a href="/feed" class="nav-link">Feed</a>
    <button onclick="logout()" class="btn btn-logout">Logout</button>
  </nav>
  
  <div class="search-container">
    <div class="search-header">
      <h2>Semantic Search</h2>
      <p style="color: var(--text-secondary); margin-top: 0.5rem;">
        Find posts by meaning, not just keywords. Powered by embeddings.
      </p>
    </div>
    
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input 
        type="text" 
        class="search-input" 
        id="searchInput"
        placeholder="Search by concepts, themes, or questions..."
        autocomplete="off"
      >
    </div>
    
    <div id="activeTagsContainer" style="display: none;">
      <div class="active-tags">
        <span style="color: var(--text-secondary); font-size: 0.9rem; margin-right: 0.5rem;">Filtering by:</span>
        <div id="activeTags"></div>
        <button onclick="clearAllTags()" style="margin-left: auto; padding: 0.25rem 0.75rem; background: transparent; border: 1px solid var(--border); border-radius: 12px; color: var(--text-secondary); cursor: pointer; font-size: 0.85rem;">Clear all</button>
      </div>
    </div>
    
    <div class="tag-browser">
      <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">Browse by Tag</h3>
      <p style="color: var(--text-secondary); font-size: 0.9rem;">Click to filter</p>
      <div id="tagCloud" class="tag-cloud">
        <div class="loading">Loading tags...</div>
      </div>
    </div>
    
    <div id="searchResults" class="search-results">
      <div class="empty-results">
        <p>Enter a search query or select tags to discover posts</p>
      </div>
    </div>
  </div>
  
  <footer>
    <div class="status-indicator">
      <span class="status-dot"></span>
      Search Ready
    </div>
  </footer>
  
  <script>
    const POST_API_URL = '${postSocialApiUrl}';
    const token = localStorage.getItem('token');
    let selectedTags = new Set();
    
    // Check for tag parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tagParam = urlParams.get('tag');
    if (tagParam) {
      selectedTags.add(tagParam);
      // Perform search after tags load
      setTimeout(() => {
        updateTagChips();
        performSearch('');
      }, 100);
    }
    
    loadTags();
    
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      
      if (query.length > 0) {
        searchTimeout = setTimeout(() => performSearch(query), 500);
      } else if (selectedTags.size === 0) {
        showEmptyState();
      }
    });
    
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query) performSearch(query);
      }
    });
    
    async function loadTags() {
      try {
        const res = await fetch(POST_API_URL + '/api/posts/tags');
        const data = await res.json();
        
        if (data.tags && data.tags.length > 0) {
          document.getElementById('tagCloud').innerHTML = data.tags
            .sort((a, b) => b.post_count - a.post_count)
            .map(tag => \`
              <div class="tag-chip" onclick="toggleTag('\${escapeHtml(tag.name)}')">
                <span>\${escapeHtml(tag.name)}</span>
                <span class="tag-count">(\${tag.post_count})</span>
              </div>
            \`).join('');
        } else {
          document.getElementById('tagCloud').innerHTML = '<p style="color: var(--text-secondary);">No tags yet</p>';
        }
      } catch (err) {
        console.error('Failed to load tags:', err);
        document.getElementById('tagCloud').innerHTML = '<p style="color: var(--text-secondary);">Error loading tags</p>';
      }
    }
    
    function toggleTag(tagName) {
      if (selectedTags.has(tagName)) {
        selectedTags.delete(tagName);
      } else {
        selectedTags.add(tagName);
      }
      
      updateTagChips();
      
      const query = document.getElementById('searchInput').value.trim();
      if (selectedTags.size > 0 || query) {
        performSearch(query);
      } else {
        showEmptyState();
      }
    }
    
    function updateTagChips() {
      document.querySelectorAll('.tag-chip').forEach(chip => {
        const tagName = chip.querySelector('span').textContent;
        if (selectedTags.has(tagName)) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });
      
      // Update active tags display
      const activeTagsContainer = document.getElementById('activeTagsContainer');
      const activeTags = document.getElementById('activeTags');
      
      if (selectedTags.size > 0) {
        activeTagsContainer.style.display = 'block';
        activeTags.innerHTML = Array.from(selectedTags).map(tag => \`
          <div class="active-tag">
            <span>\${escapeHtml(tag)}</span>
            <span class="remove" onclick="toggleTag('\${escapeHtml(tag)}')">×</span>
          </div>
        \`).join('');
      } else {
        activeTagsContainer.style.display = 'none';
      }
    }
    
    async function performSearch(query) {
      document.getElementById('searchResults').innerHTML = '<div class="loading">Searching...</div>';
      
      try {
        const body = { query: query || '', limit: 10 };
        if (selectedTags.size > 0) {
          body.tags = Array.from(selectedTags);
        }
        
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = 'Bearer ' + token;
        }
        
        const res = await fetch(POST_API_URL + '/api/search', {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
          displayResults(data.results);
        } else {
          document.getElementById('searchResults').innerHTML = \`
            <div class="empty-results">
              <p>No results found. Try different keywords or tags.</p>
            </div>
          \`;
        }
      } catch (err) {
        console.error('Search failed:', err);
        document.getElementById('searchResults').innerHTML = \`
          <div class="empty-results">
            <p>Search failed. Please try again.</p>
          </div>
        \`;
      }
    }
    
    function displayResults(results) {
      document.getElementById('searchResults').innerHTML = results.map(post => {
        const similarity = post.relevanceScore ? \`\${(post.relevanceScore * 100).toFixed(1)}% match\` : '';
        
        return \`
          <div class="result-item">
            <div onclick="viewPost('\${post.id}')" style="cursor: pointer;">
              \${post.summary ? \`<div class="result-summary">"\${escapeHtml(post.summary)}"</div>\` : ''}
              <div class="result-content">\${escapeHtml(truncate(post.content, 300))}</div>
              <div class="result-meta">
                <span>\${new Date(post.created_at).toLocaleDateString()}</span>
                <span>\${post.visibility}</span>
                \${similarity ? \`<span class="similarity-score">\${similarity}</span>\` : ''}
              </div>
            </div>
            \${post.tags && post.tags.length > 0 ? \`
              <div class="result-tags">
                \${post.tags.map(tag => \`
                  <span class="result-tag" onclick="addTagFilter('\${escapeHtml(tag)}'); event.stopPropagation();">\${escapeHtml(tag)}</span>
                \`).join('')}
              </div>
            \` : ''}
          </div>
        \`;
      }).join('');
    }
    
    function showEmptyState() {
      document.getElementById('searchResults').innerHTML = \`
        <div class="empty-results">
          <p>Enter a search query or select tags to discover posts</p>
        </div>
      \`;
    }
    
    function viewPost(postId) {
      window.location.href = '/post/' + postId;
    }
    
    function addTagFilter(tagName) {
      if (!selectedTags.has(tagName)) {
        selectedTags.add(tagName);
        updateTagChips();
        const query = document.getElementById('searchInput').value.trim();
        performSearch(query);
      }
    }
    
    function clearAllTags() {
      selectedTags.clear();
      updateTagChips();
      const query = document.getElementById('searchInput').value.trim();
      if (query) {
        performSearch(query);
      } else {
        showEmptyState();
      }
    }
    
    function logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function truncate(text, maxLength) {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    }
    
    if (!token) {
      window.location.href = '/';
    }
  </script>
</body>
</html>`;
}

// Post detail page with similar posts
function postDetailPage(postSocialApiUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Post — Post-Social</title>
  <style>${styles}</style>
  <style>
    .post-detail-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    .post-detail {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
    }
    
    .post-summary {
      font-style: italic;
      color: var(--text-secondary);
      margin-bottom: 1rem;
      padding: 1rem;
      background: var(--bg-secondary);
      border-left: 3px solid var(--accent);
      border-radius: 4px;
    }
    
    .post-content {
      font-size: 1.05rem;
      line-height: 1.8;
      margin: 1.5rem 0;
    }
    
    .post-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 1.5rem 0;
    }
    
    .post-tag {
      padding: 0.5rem 1rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 0.9rem;
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-block;
    }
    
    .post-tag:hover {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
      transform: translateY(-1px);
    }
    
    .similar-section {
      margin-top: 3rem;
    }
    
    .similar-posts {
      display: grid;
      gap: 1rem;
      margin-top: 1rem;
    }
    
    .similar-item {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .similar-item:hover {
      border-color: var(--accent);
      transform: translateX(4px);
    }
    
    .comments-section {
      margin-top: 3rem;
    }
    
    .comment-composer {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    
    .comment-composer textarea {
      width: 100%;
      min-height: 80px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      color: var(--text-primary);
      font-size: 0.95rem;
      resize: vertical;
      margin-bottom: 1rem;
    }
    
    .comment-composer textarea:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    .comment-list {
      display: grid;
      gap: 1rem;
    }
    
    .comment-item {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
    }
    
    .comment-meta {
      color: var(--text-secondary);
      font-size: 0.85rem;
      margin-bottom: 0.5rem;
    }
    
    .comment-content {
      line-height: 1.6;
      margin-bottom: 0.5rem;
    }
    
    .synthesis-status {
      background: var(--bg-card);
      border: 2px solid var(--accent);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .synthesis-progress {
      height: 8px;
      background: var(--bg-secondary);
      border-radius: 4px;
      overflow: hidden;
      margin: 1rem 0;
    }
    
    .synthesis-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), #a855f7);
      transition: width 0.3s ease;
    }
    
    .synthesis-ready {
      border-color: var(--success);
    }
    
    .versions-section {
      margin-top: 3rem;
    }
    
    .version-item {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }
    
    .version-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    
    .version-badge {
      padding: 0.25rem 0.75rem;
      background: var(--accent);
      color: white;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    
    .version-badge.approved {
      background: var(--success);
    }
    
    .version-badge.pending {
      background: #f59e0b;
    }
    
    .btn-approve {
      padding: 0.5rem 1rem;
      background: var(--success);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }
    
    .btn-approve:hover {
      background: #16a34a;
      transform: translateY(-1px);
    }
    
    .diff-view {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 1rem;
      margin-top: 1rem;
      font-family: monospace;
      font-size: 0.85rem;
    }
    
    .diff-added {
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
    }
    
    .diff-removed {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
      text-decoration: line-through;
    }
    
    .nav-bar {
      display: flex;
      gap: 1rem;
      align-items: center;
      padding: 1rem 2rem;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
    }
    
    .nav-link {
      color: var(--text-secondary);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      transition: all 0.2s;
    }
    
    .nav-link:hover {
      color: var(--text-primary);
      background: var(--bg-card);
    }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <h1 style="font-size: 1.2rem; margin: 0;">post<span>-social</span></h1>
    <div style="flex: 1;"></div>
    <a href="/dashboard" class="nav-link">Dashboard</a>
    <a href="/search" class="nav-link">Search</a>
    <a href="/feed" class="nav-link">Feed</a>
  </nav>
  
  <div class="post-detail-container">
    <div id="postDetail">
      <div class="loading">Loading post...</div>
    </div>
    
    <div id="synthesisStatus"></div>
    
    <div id="commentsSection" class="comments-section">
      <h3>Discussion</h3>
      
      <div class="comment-composer">
        <textarea id="commentInput" placeholder="Share your thoughts..."></textarea>
        <button onclick="addComment()" class="btn btn-primary">Add Comment</button>
      </div>
      
      <div id="commentsList" class="comment-list">
        <div class="loading">Loading comments...</div>
      </div>
    </div>
    
    <div id="versionsSection" class="versions-section" style="display: none;">
      <h3>Version History</h3>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">
        See how this post has evolved through discussion synthesis
      </p>
      <div id="versionsList"></div>
    </div>
    
    <div id="similarSection" class="similar-section" style="display: none;">
      <h3>Similar Posts</h3>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">
        Discover related content based on semantic similarity
      </p>
      <div id="similarPosts" class="similar-posts"></div>
    </div>
  </div>
  
  <footer>
    <div class="status-indicator">
      <span class="status-dot"></span>
      Connected
    </div>
  </footer>
  
  <script>
    const POST_API_URL = '${postSocialApiUrl}';
    const token = localStorage.getItem('token');
    const postId = window.location.pathname.split('/').pop();
    
    loadPost();
    loadSimilarPosts();
    loadComments();
    loadVersions();
    checkSynthesisStatus();
    
    async function loadPost() {
      try {
        const headers = {};
        if (token) {
          headers['Authorization'] = 'Bearer ' + token;
        }
        
        const res = await fetch(POST_API_URL + '/api/posts/' + postId, { headers });
        const data = await res.json();
        
        if (data.post) {
          displayPost(data.post);
        } else {
          document.getElementById('postDetail').innerHTML = \`
            <div class="empty-state">
              <p>Post not found or you don't have permission to view it.</p>
            </div>
          \`;
        }
      } catch (err) {
        console.error('Failed to load post:', err);
        document.getElementById('postDetail').innerHTML = \`
          <div class="empty-state">
            <p>Error loading post.</p>
          </div>
        \`;
      }
    }
    
    function displayPost(post) {
      const tags = Array.isArray(post.tags) ? post.tags : (post.tags ? JSON.parse(post.tags) : []);
      
      document.getElementById('postDetail').innerHTML = \`
        <div class="post-detail">
          \${post.summary ? \`<div class="post-summary">"\${escapeHtml(post.summary)}"</div>\` : ''}
          
          <div class="post-content">\${escapeHtml(post.content)}</div>
          
          \${tags.length > 0 ? \`
            <div class="post-tags">
              \${tags.map(tag => \`<a href="/search?tag=\${encodeURIComponent(tag)}" class="post-tag">\${escapeHtml(tag)}</a>\`).join('')}
            </div>
          \` : ''}
          
          <div class="meta" style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 1.5rem;">
            <div>Posted: \${new Date(post.created_at).toLocaleDateString()}</div>
            <div>Visibility: \${post.visibility}</div>
            <div>Status: \${post.status}</div>
          </div>
        </div>
      \`;
    }
    
    async function loadSimilarPosts() {
      try {
        const headers = {};
        if (token) {
          headers['Authorization'] = 'Bearer ' + token;
        }
        
        const res = await fetch(POST_API_URL + '/api/search/similar/' + postId, { headers });
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
          document.getElementById('similarSection').style.display = 'block';
          displaySimilarPosts(data.results);
        }
      } catch (err) {
        console.error('Failed to load similar posts:', err);
      }
    }
    
    function displaySimilarPosts(results) {
      document.getElementById('similarPosts').innerHTML = results.map(post => {
        const similarity = \`\${(post.similarityScore * 100).toFixed(1)}% similar\`;
        
        return \`
          <div class="similar-item" onclick="viewPost('\${post.id}')">
            \${post.summary ? \`<div style="font-style: italic; color: var(--text-secondary); margin-bottom: 0.5rem;">"\${escapeHtml(post.summary)}"</div>\` : ''}
            <div style="margin: 0.5rem 0;">\${escapeHtml(truncate(post.content, 150))}</div>
            <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem;">
              <span style="color: var(--accent); font-weight: 500;">\${similarity}</span>
              · \${new Date(post.created_at).toLocaleDateString()}
            </div>
          </div>
        \`;
      }).join('');
    }
    
    function viewPost(id) {
      window.location.href = '/post/' + id;
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function truncate(text, maxLength) {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    }
    
    // ===== COMMENTS =====
    
    async function loadComments() {
      try {
        const headers = {};
        if (token) {
          headers['Authorization'] = 'Bearer ' + token;
        }
        
        const res = await fetch(POST_API_URL + '/api/posts/' + postId + '/comments', { headers });
        const data = await res.json();
        
        if (data.comments) {
          displayComments(data.comments);
        }
      } catch (err) {
        console.error('Failed to load comments:', err);
      }
    }
    
    function displayComments(comments) {
      const commentsSection = document.getElementById('commentsSection');
      if (!commentsSection) return;
      
      if (comments.length === 0) {
        document.getElementById('commentsList').innerHTML = \`
          <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <p>No comments yet. Be the first to share your thoughts!</p>
          </div>
        \`;
        return;
      }
      
      document.getElementById('commentsList').innerHTML = comments.map(comment => \`
        <div class="comment-item">
          <div class="comment-meta">
            <span>\${comment.user_email || 'Anonymous'}</span>
            <span> · </span>
            <span>\${new Date(comment.created_at).toLocaleDateString()}</span>
          </div>
          <div class="comment-content">\${escapeHtml(comment.content)}</div>
        </div>
      \`).join('');
    }
    
    async function addComment() {
      if (!token) {
        alert('Please log in to comment');
        return;
      }
      
      const textarea = document.getElementById('commentInput');
      const content = textarea.value.trim();
      
      if (!content) return;
      
      const button = event.target;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Adding...';
      button.style.opacity = '0.6';
      
      try {
        const res = await fetch(POST_API_URL + '/api/posts/' + postId + '/comments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ content })
        });
        
        if (res.ok) {
          textarea.value = '';
          loadComments();
          checkSynthesisStatus();
          
          const data = await res.json();
          if (data.meta?.synthesisTriggered) {
            showSynthesisNotification();
          }
        } else {
          const err = await res.json();
          alert('Failed to add comment: ' + (err.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('Failed to add comment:', err);
        alert('Failed to add comment');
      } finally {
        button.disabled = false;
        button.textContent = originalText;
        button.style.opacity = '1';
      }
    }
    
    // ===== SYNTHESIS STATUS =====
    
    async function checkSynthesisStatus() {
      try {
        const res = await fetch(POST_API_URL + '/api/posts/' + postId + '/synthesis-status');
        const data = await res.json();
        
        if (data) {
          displaySynthesisStatus(data);
        }
      } catch (err) {
        console.error('Failed to check synthesis status:', err);
      }
    }
    
    function displaySynthesisStatus(status) {
      const statusDiv = document.getElementById('synthesisStatus');
      if (!statusDiv) return;
      
      const progress = (status.commentCount / status.threshold) * 100;
      const isReady = status.ready;
      
      statusDiv.innerHTML = \`
        <div class="synthesis-status \${isReady ? 'synthesis-ready' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <h4 style="margin: 0;">\${isReady ? '✨ Ready for Synthesis' : '🔄 Synthesis Progress'}</h4>
            <span style="font-size: 0.9rem; color: var(--text-secondary);">v\${status.currentVersion}</span>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0.5rem 0;">
            \${status.commentCount} / \${status.threshold} comments
            \${isReady ? ' - Discussion can now be synthesized!' : ''}
          </p>
          <div class="synthesis-progress">
            <div class="synthesis-progress-bar" style="width: \${Math.min(progress, 100)}%"></div>
          </div>
          \${isReady ? \`
            <button onclick="triggerSynthesis()" class="btn btn-primary" style="margin-top: 1rem;">
              Synthesize Discussion
            </button>
          \` : ''}
        </div>
      \`;
    }
    
    async function triggerSynthesis() {
      if (!token) {
        alert('Please log in to synthesize');
        return;
      }
      
      if (!confirm('This will create a new version synthesizing all comments. Continue?')) {
        return;
      }
      
      const button = event.target;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Synthesizing...';
      button.style.opacity = '0.6';
      
      try {
        const res = await fetch(POST_API_URL + '/api/posts/' + postId + '/synthesize', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (res.ok) {
          alert('Synthesis complete! Check version history below.');
          loadVersions();
          checkSynthesisStatus();
        } else {
          const err = await res.json();
          alert('Failed to synthesize: ' + (err.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('Failed to synthesize:', err);
        alert('Failed to synthesize');
      } finally {
        button.disabled = false;
        button.textContent = originalText;
        button.style.opacity = '1';
      }
    }
    
    function showSynthesisNotification() {
      // Simple notification
      const notification = document.createElement('div');
      notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: var(--success); color: white; padding: 1rem 1.5rem; border-radius: 8px; z-index: 1000;';
      notification.textContent = '✨ Auto-synthesis triggered! Check version history.';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
    
    // ===== VERSION HISTORY =====
    
    async function loadVersions() {
      try {
        const res = await fetch(POST_API_URL + '/api/posts/' + postId + '/versions');
        const data = await res.json();
        
        if (data.versions && data.versions.length > 0) {
          document.getElementById('versionsSection').style.display = 'block';
          displayVersions(data.versions);
        }
      } catch (err) {
        console.error('Failed to load versions:', err);
      }
    }
    
    function displayVersions(versions) {
      document.getElementById('versionsList').innerHTML = versions.map(version => {
        const isApproved = version.author_approved === 1;
        const tags = version.tags ? JSON.parse(version.tags) : [];
        
        return \`
          <div class="version-item">
            <div class="version-header">
              <div>
                <span class="version-badge \${isApproved ? 'approved' : 'pending'}">Version \${version.version}</span>
                <span style="color: var(--text-secondary); font-size: 0.85rem; margin-left: 1rem;">
                  \${new Date(version.created_at).toLocaleDateString()}
                </span>
              </div>
              \${!isApproved && token ? \`
                <button onclick="approveVersion('\${version.id}')" class="btn-approve">
                  ✓ Approve & Apply
                </button>
              \` : ''}
              \${isApproved ? \`
                <span style="color: var(--success); font-size: 0.9rem;">✓ Active</span>
              \` : ''}
            </div>
            
            \${version.summary ? \`
              <div style="font-style: italic; color: var(--text-secondary); margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                "\${escapeHtml(version.summary)}"
              </div>
            \` : ''}
            
            <div style="margin: 1rem 0; line-height: 1.6;">
              \${escapeHtml(truncate(version.content, 500))}
            </div>
            
            \${tags.length > 0 ? \`
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem;">
                \${tags.map(tag => \`
                  <span style="padding: 0.25rem 0.75rem; background: var(--bg-secondary); border-radius: 12px; font-size: 0.8rem; color: var(--text-secondary);">
                    \${escapeHtml(tag)}
                  </span>
                \`).join('')}
              </div>
            \` : ''}
            
            <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 1rem;">
              <span>\${version.comment_count_at_synthesis} comments synthesized</span>
              <span> · </span>
              <span>Model: \${version.synthesis_model || 'N/A'}</span>
            </div>
          </div>
        \`;
      }).join('');
    }
    
    async function approveVersion(versionId) {
      if (!token) {
        alert('Please log in to approve');
        return;
      }
      
      if (!confirm('This will replace the current post content with this version. Continue?')) {
        return;
      }
      
      const button = event.target;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Approving...';
      button.style.opacity = '0.6';
      
      try {
        const res = await fetch(POST_API_URL + '/api/posts/' + postId + '/versions/' + versionId + '/approve', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (res.ok) {
          alert('Version approved! Post updated.');
          loadPost();
          loadVersions();
          checkSynthesisStatus();
        } else {
          const err = await res.json();
          alert('Failed to approve: ' + (err.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('Failed to approve version:', err);
        alert('Failed to approve version');
      } finally {
        button.disabled = false;
        button.textContent = originalText;
        button.style.opacity = '1';
      }
    }
  </script>
</body>
</html>`;
}

// Public feed page
function feedPage(postSocialApiUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Public Feed — Post-Social</title>
  <style>${styles}</style>
  <style>
    .feed-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    .feed-header {
      margin-bottom: 2rem;
    }
    
    .feed-list {
      display: grid;
      gap: 1rem;
    }
    
    .feed-item {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .feed-item:hover {
      border-color: var(--accent);
      transform: translateX(4px);
    }
    
    .nav-bar {
      display: flex;
      gap: 1rem;
      align-items: center;
      padding: 1rem 2rem;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
    }
    
    .nav-link {
      color: var(--text-secondary);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      transition: all 0.2s;
    }
    
    .nav-link:hover {
      color: var(--text-primary);
      background: var(--bg-card);
    }
    
    .nav-link.active {
      color: var(--accent);
      background: var(--bg-card);
    }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <h1 style="font-size: 1.2rem; margin: 0;">post<span>-social</span></h1>
    <div style="flex: 1;"></div>
    <a href="/dashboard" class="nav-link">Dashboard</a>
    <a href="/search" class="nav-link">Search</a>
    <a href="/feed" class="nav-link active">Feed</a>
  </nav>
  
  <div class="feed-container">
    <div class="feed-header">
      <h2>Public Feed</h2>
      <p style="color: var(--text-secondary); margin-top: 0.5rem;">
        Recent curated posts from the community
      </p>
    </div>
    
    <div id="feedList" class="feed-list">
      <div class="loading">Loading feed...</div>
    </div>
  </div>
  
  <footer>
    <div class="status-indicator">
      <span class="status-dot"></span>
      Connected
    </div>
  </footer>
  
  <script>
    const POST_API_URL = '${postSocialApiUrl}';
    
    loadFeed();
    
    async function loadFeed() {
      try {
        const res = await fetch(POST_API_URL + '/api/posts/feed');
        const data = await res.json();
        
        if (data.posts && data.posts.length > 0) {
          displayFeed(data.posts);
        } else {
          document.getElementById('feedList').innerHTML = \`
            <div class="empty-state">
              <p>No posts yet. Be the first to share!</p>
            </div>
          \`;
        }
      } catch (err) {
        console.error('Failed to load feed:', err);
        document.getElementById('feedList').innerHTML = \`
          <div class="empty-state">
            <p>Error loading feed.</p>
          </div>
        \`;
      }
    }
    
    function displayFeed(posts) {
      document.getElementById('feedList').innerHTML = posts.map(post => {
        const tags = Array.isArray(post.tags) ? post.tags : (post.tags ? JSON.parse(post.tags) : []);
        
        return \`
          <div class="feed-item" onclick="viewPost('\${post.id}')">
            \${post.summary ? \`<div style="font-style: italic; color: var(--text-secondary); margin-bottom: 0.75rem;">"\${escapeHtml(post.summary)}"</div>\` : ''}
            <div style="margin: 0.75rem 0;">\${escapeHtml(truncate(post.content, 250))}</div>
            \${tags.length > 0 ? \`
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem;">
                \${tags.map(tag => \`
                  <a href="/search?tag=\${encodeURIComponent(tag)}" style="padding: 0.25rem 0.75rem; background: var(--bg-secondary); border-radius: 12px; font-size: 0.8rem; color: var(--text-secondary); text-decoration: none; display: inline-block; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--accent)'; this.style.color='white';" onmouseout="this.style.background='var(--bg-secondary)'; this.style.color='var(--text-secondary)';">
                    \${escapeHtml(tag)}
                  </a>
                \`).join('')}
              </div>
            \` : ''}
            <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 1rem;">
              \${new Date(post.created_at).toLocaleDateString()}
            </div>
          </div>
        \`;
      }).join('');
    }
    
    function viewPost(postId) {
      window.location.href = '/post/' + postId;
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function truncate(text, maxLength) {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    }
  </script>
</body>
</html>`;
}

// Routes
app.get('/', (c) => {
  const url = new URL(c.req.url);
  const selfUrl = `${url.protocol}//${url.host}`;
  return c.html(landingPage(c.env.API_BASE_URL, selfUrl));
});

app.get('/callback', (c) => {
  return c.html(callbackPage());
});

app.get('/dashboard', (c) => {
  // In a real app, we'd verify the token server-side
  // For now, the client-side JS handles auth state
  return c.html(dashboardPage({ email: '', role: '' }, c.env.API_BASE_URL, c.env.POST_SOCIAL_API_URL));
});

app.get('/search', (c) => {
  return c.html(searchPage(c.env.POST_SOCIAL_API_URL));
});

app.get('/feed', (c) => {
  return c.html(feedPage(c.env.POST_SOCIAL_API_URL));
});

app.get('/post/:id', (c) => {
  return c.html(postDetailPage(c.env.POST_SOCIAL_API_URL));
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'post-social-frontend' });
});

export default app;
