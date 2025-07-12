<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { settings } from '$lib/stores/settings.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    // Redirect to settings if no API key
    if (!settings.hasApiKey && $page.url.pathname !== '/settings') {
      goto('/settings');
    }
  });
</script>

<nav class="navbar">
  <div class="nav-container">
    <a href="/" class="nav-brand">Autonomi Transaction Reporter</a>
    
    {#if settings.hasApiKey}
      <div class="nav-links">
        <a href="/wallets" class:active={$page.url.pathname === '/wallets'}>Wallets</a>
        <a href="/balances" class:active={$page.url.pathname === '/balances'}>Balances</a>
        <a href="/process" class:active={$page.url.pathname === '/process'}>Process</a>
        <a href="/transactions" class:active={$page.url.pathname === '/transactions'}>Transactions</a>
        <a href="/settings" class:active={$page.url.pathname === '/settings'}>Settings</a>
      </div>
    {/if}
  </div>
</nav>

<main>
  <slot />
</main>

<style>
  .navbar {
    background-color: #343a40;
    padding: 1rem 0;
    margin-bottom: 2rem;
  }
  
  .nav-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2rem;
  }
  
  .nav-brand {
    color: white;
    font-size: 1.5rem;
    font-weight: bold;
    text-decoration: none;
  }
  
  .nav-links {
    display: flex;
    gap: 2rem;
  }
  
  .nav-links a {
    color: #adb5bd;
    text-decoration: none;
    transition: color 0.3s;
  }
  
  .nav-links a:hover,
  .nav-links a.active {
    color: white;
  }
  
  main {
    min-height: calc(100vh - 100px);
  }
</style>