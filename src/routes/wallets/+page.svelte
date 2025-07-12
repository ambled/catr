<!-- src/routes/wallets/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { storage } from '$lib/stores/storage.js';
  import type { Wallet } from '$lib/types/index.js';

  let wallets = $state<Wallet[]>([]);
  let newAddress = $state('');
  let newName = $state('');
  let error = $state('');

  onMount(() => {
    loadWallets();
  });

  function loadWallets() {
    wallets = storage.getWallets();
  }

  function addWallet() {
    if (!newAddress.trim()) {
      error = 'Wallet address is required';
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(newAddress.trim())) {
      error = 'Invalid Ethereum address format';
      return;
    }

    const existingWallet = wallets.find(w => w.address.toLowerCase() === newAddress.trim().toLowerCase());
    if (existingWallet) {
      error = 'Wallet address already exists';
      return;
    }

    try {
      storage.addWallet({
        address: newAddress.trim(),
        name: newName.trim() || undefined
      });
      
      newAddress = '';
      newName = '';
      error = '';
      loadWallets();
    } catch (err) {
      error = 'Failed to add wallet';
    }
  }

  function removeWallet(id: number) {
    storage.removeWallet(id);
    loadWallets();
  }
</script>

<div class="container">
  <h1>Wallet Management</h1>
  
  <div class="add-wallet-form">
    <div class="form-group">
      <input
        type="text"
        bind:value={newAddress}
        placeholder="Wallet Address (0x...)"
        class="form-control"
      />
    </div>
    
    <div class="form-group">
      <input
        type="text"
        bind:value={newName}
        placeholder="Wallet Name (optional)"
        class="form-control"
      />
    </div>
    
    <button onclick={addWallet} class="btn btn-primary">Add Wallet</button>
    
    {#if error}
      <div class="error">{error}</div>
    {/if}
  </div>

  <div class="wallets-list">
    {#each wallets as wallet}
      <div class="wallet-item">
        <div class="wallet-info">
          <div class="wallet-address">{wallet.address}</div>
          {#if wallet.name}
            <div class="wallet-name">{wallet.name}</div>
          {/if}
        </div>
        <button onclick={() => removeWallet(wallet.id!)} class="btn btn-danger">
          Remove
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  /* Same styles as before */
  .container {
    max-width: 800px;
    margin: 2rem auto;
    padding: 2rem;
  }
  
  .add-wallet-form {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
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
  
  .wallet-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border: 1px solid #eee;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }
  
  .wallet-address {
    font-family: monospace;
    font-weight: bold;
  }
  
  .wallet-name {
    font-size: 0.9em;
    color: #666;
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
  
  .btn-danger {
    background-color: #dc3545;
    color: white;
  }
  
  .error {
    color: red;
    margin-top: 0.5rem;
  }
</style>