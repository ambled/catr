<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
  import { settings } from '$lib/stores/settings.svelte.js';
  import { goto } from '$app/navigation';

  let apiKey = $state(settings.apiKey);
  let error = $state('');

  function saveApiKey() {
    if (!apiKey.trim()) {
      error = 'API Key is required';
      return;
    }
    
    settings.apiKey = apiKey.trim();
    goto('/wallets');
  }
</script>

<div class="container">
  <h1>Settings</h1>
  
  <div class="form-group">
    <label for="apiKey">Alchemy API Key:</label>
    <input
      id="apiKey"
      type="password"
      bind:value={apiKey}
      placeholder="Enter your Alchemy API key"
      class="form-control"
    />
    {#if error}
      <div class="error">{error}</div>
    {/if}
  </div>

  <button onclick={saveApiKey} class="btn btn-primary">
    Save API Key
  </button>
</div>

<style>
  .container {
    max-width: 600px;
    margin: 2rem auto;
    padding: 2rem;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-control {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .error {
    color: red;
    margin-top: 0.5rem;
  }
  
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .btn-primary {
    background-color: #007bff;
    color: white;
  }
</style>