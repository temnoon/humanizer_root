/**
 * OAuth Callback Page - Handle GitHub OAuth redirects
 */

import { Component, onMount } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { authStore } from '@/stores/auth';

export const CallbackPage: Component = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  onMount(() => {
    // Get token and isNewUser from URL params
    const token = searchParams.token;
    const isNewUser = searchParams.isNewUser === 'true';

    if (!token) {
      console.error('No token in callback URL');
      navigate('/login?error=no_token');
      return;
    }

    try {
      // Handle the callback using auth store
      authStore.handleCallback(token, isNewUser);
      
      // Redirect to Studio
      navigate('/app');
    } catch (err) {
      console.error('Callback handling failed:', err);
      navigate('/login?error=callback_failed');
    }
  });

  return (
    <div class="container" style={{ 'max-width': '600px', padding: 'var(--space-xl)' }}>
      <div 
        style={{
          'text-align': 'center',
          padding: 'var(--space-3xl)',
        }}
      >
        <h1 style={{ 
          'font-size': 'var(--text-2xl)', 
          'margin-bottom': 'var(--space-lg)' 
        }}>
          post<span style={{ color: 'var(--color-primary)' }}>-social</span>
        </h1>
        
        <div 
          style={{
            padding: 'var(--space-2xl)',
            'border-radius': 'var(--radius-lg)',
            background: 'var(--color-bg-card)',
          }}
        >
          <div 
            class="spinner"
            style={{
              width: '40px',
              height: '40px',
              margin: '0 auto var(--space-lg)',
              border: '4px solid var(--color-border)',
              'border-top-color': 'var(--color-primary)',
              'border-radius': '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          
          <p class="text-secondary">
            Completing sign in...
          </p>
          
          <p class="text-secondary text-sm" style={{ 'margin-top': 'var(--space-md)' }}>
            You'll be redirected momentarily.
          </p>
        </div>
      </div>
      
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};
