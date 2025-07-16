<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
  import { settings } from '$lib/stores/settings.svelte.js';
  import { storage } from '$lib/stores/storage.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import type { AddressClassification } from '$lib/types/index.js';

  let apiKey = $state('');
  let error = $state('');
  let success = $state('');
  let activeTab = $state<'api' | 'addresses'>('api');
  
  // Address classification form
  let newName = $state('');
  let newWalletAddress = $state('');
  let newContractAddress = $state('');
  let newTransactionClass = $state<'Emission' | 'Uploads' | 'Purchase' | 'Burn' | 'AirDrop' | 'Swap' | 'OtherIncome' | 'Withdraw'>('Uploads');
  
  let addressClassifications = $state<AddressClassification[]>([]);

  const transactionClasses = ['Emission', 'Uploads', 'Purchase', 'Burn', 'AirDrop', 'Swap', 'OtherIncome', 'Withdraw'] as const;

  onMount(() => {
    // Initialize with current settings
    apiKey = settings.apiKey;
    loadAddressClassifications();
    
    console.log('Settings page mounted:', {
      hasApiKey: settings.hasApiKey,
      apiKeyLength: apiKey.length
    });
  });

  function loadAddressClassifications() {
    addressClassifications = storage.getAddressClassifications();
  }

  function saveApiKey() {
    error = '';
    success = '';
    
    if (!apiKey.trim()) {
      error = 'API Key is required';
      return;
    }
    
    try {
      settings.apiKey = apiKey.trim();
      success = 'API Key saved successfully! You can now navigate to other pages.';
      
      console.log('API Key saved:', {
        hasApiKey: settings.hasApiKey,
        canNavigate: true
      });
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        success = '';
      }, 5000);
      
    } catch (err) {
      error = 'Failed to save API Key';
      console.error('Error saving API key:', err);
    }
  }

  function testNavigation() {
    if (settings.hasApiKey) {
      goto('/wallets');
    } else {
      error = 'Please save your API key first';
    }
  }

  function addAddressClassification() {
    error = '';
    success = '';
    
    if (!newName.trim()) {
      error = 'Name is required';
      return;
    }

    if (!newWalletAddress.trim() && !newContractAddress.trim()) {
      error = 'Either wallet address or contract address is required';
      return;
    }

    if (newWalletAddress.trim() && !/^0x[a-fA-F0-9]{40}$/.test(newWalletAddress.trim())) {
      error = 'Invalid wallet address format';
      return;
    }

    if (newContractAddress.trim() && !/^0x[a-fA-F0-9]{40}$/.test(newContractAddress.trim())) {
      error = 'Invalid contract address format';
      return;
    }

    try {
      storage.addAddressClassification({
        name: newName.trim(),
        wallet_address: newWalletAddress.trim() || undefined,
        contract_address: newContractAddress.trim() || undefined,
        transaction_class: newTransactionClass
      });
      
      newName = '';
      newWalletAddress = '';
      newContractAddress = '';
      newTransactionClass = 'Uploads';
      error = '';
      success = 'Address classification added successfully';
      loadAddressClassifications();
      
      setTimeout(() => {
        success = '';
      }, 3000);
      
    } catch (err) {
      error = 'Failed to add address classification';
      console.error('Error adding classification:', err);
    }
  }

  function removeAddressClassification(id: number) {
    try {
      storage.removeAddressClassification(id);
      loadAddressClassifications();
      success = 'Address classification removed';
      
      setTimeout(() => {
        success = '';
      }, 3000);
      
    } catch (err) {
      error = 'Failed to remove address classification';
      console.error('Error removing classification:', err);
    }
  }
</script>

<div class="container">
  <h1>Settings</h1>
  
  <div class="tabs">
    <button 
      class="tab" 
      class:active={activeTab === 'api'}
      onclick={() => {
        activeTab = 'api';
        error = '';
        success = '';
      }}
    >
      API Configuration
    </button>
    <button 
      class="tab" 
      class:active={activeTab === 'addresses'}
      onclick={() => {
        activeTab = 'addresses';
        error = '';
        success = '';
      }}
    >
      Address Classifications
    </button>
  </div>

  {#if activeTab === 'api'}
    <div class="tab-content">
      <h2>Alchemy API Configuration</h2>
      
      <div class="api-status">
        <div class="status-item">
          <strong>Status:</strong> 
          <span class="status-badge" class:success={settings.hasApiKey} class:error={!settings.hasApiKey}>
            {settings.hasApiKey ? 'Configured' : 'Not Configured'}
          </span>
        </div>
        
        {#if settings.hasApiKey}
          <div class="status-item">
            <strong>Key Preview:</strong> 
            <code>{settings.apiKey.slice(0, 8)}...{settings.apiKey.slice(-4)}</code>
          </div>
        {/if}
      </div>
      
      <div class="form-group">
        <label for="apiKey">Alchemy API Key:</label>
        <input
          id="apiKey"
          type="password"
          bind:value={apiKey}
          placeholder="Enter your Alchemy API key"
          class="form-control"
        />
        <small class="form-text">
          You can find your API key in the Alchemy dashboard at 
          <a href="https://dashboard.alchemy.com/apps" target="_blank">dashboard.alchemy.com/apps</a>
        </small>
      </div>

      <div class="button-group">
        <button onclick={saveApiKey} class="btn btn-primary">
          Save API Key
        </button>
        
        {#if settings.hasApiKey}
          <button onclick={testNavigation} class="btn btn-secondary">
            Test Navigation
          </button>
        {/if}
      </div>
      
      {#if error}
        <div class="message error">
          {error}
        </div>
      {/if}
      
      {#if success}
        <div class="message success">
          {success}
        </div>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'addresses'}
    <div class="tab-content">
      <h2>Address Classifications</h2>
      <p>Configure wallet and contract addresses to automatically classify transactions.</p>
      
      <div class="add-classification-form">
        <h3>Add New Classification</h3>
        
        <div class="form-row">
          <div class="form-group">
            <label for="newName">Name:</label>
            <input
              id="newName"
              type="text"
              bind:value={newName}
              placeholder="e.g., Autonomi Upload Contract"
              class="form-control"
            />
          </div>
          
          <div class="form-group">
            <label for="newTransactionClass">Transaction Class:</label>
            <select id="newTransactionClass" bind:value={newTransactionClass} class="form-control">
              {#each transactionClasses as txClass}
                <option value={txClass}>{txClass}</option>
              {/each}
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="newWalletAddress">Wallet Address (optional):</label>
            <input
              id="newWalletAddress"
              type="text"
              bind:value={newWalletAddress}
              placeholder="0x..."
              class="form-control"
            />
          </div>
          
          <div class="form-group">
            <label for="newContractAddress">Contract Address (optional):</label>
            <input
              id="newContractAddress"
              type="text"
              bind:value={newContractAddress}
              placeholder="0x..."
              class="form-control"
            />
          </div>
        </div>
        
        <button onclick={addAddressClassification} class="btn btn-primary">
          Add Classification
        </button>
        
        {#if error}
          <div class="message error">{error}</div>
        {/if}
        
        {#if success}
          <div class="message success">{success}</div>
        {/if}
      </div>

      <div class="classifications-list">
        <h3>Configured Classifications</h3>
        
        {#if addressClassifications.length === 0}
          <p class="no-data">No address classifications configured.</p>
        {:else}
          <div class="classifications-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Wallet Address</th>
                  <th>Contract Address</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each addressClassifications as classification}
                  <tr>
                    <td>{classification.name}</td>
                    <td>
                      <span class="class-badge class-{classification.transaction_class.toLowerCase()}">
                        {classification.transaction_class}
                      </span>
                    </td>
                    <td class="address-cell">
                      {classification.wallet_address || '-'}
                    </td>
                    <td class="address-cell">
                      {classification.contract_address || '-'}
                    </td>
                    <td>
                      <button 
                        onclick={() => removeAddressClassification(classification.id!)} 
                        class="btn btn-danger btn-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1000px;
    margin: 2rem auto;
    padding: 2rem;
  }
  
  .tabs {
    display: flex;
    border-bottom: 1px solid #ddd;
    margin-bottom: 2rem;
  }
  
  .tab {
    padding: 1rem 2rem;
    border: none;
    background: none;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.3s;
  }
  
  .tab:hover {
    background-color: #f8f9fa;
  }
  
  .tab.active {
    border-bottom-color: #007bff;
    color: #007bff;
    font-weight: bold;
  }
  
  .tab-content {
    animation: fadeIn 0.3s ease-in;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .api-status {
    background-color: #f8f9fa;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 2rem;
  }
  
  .status-item {
    margin-bottom: 0.5rem;
  }
  
  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
  }
  
  .status-badge.success {
    background-color: #d4edda;
    color: #155724;
  }
  
  .status-badge.error {
    background-color: #f8d7da;
    color: #721c24;
  }
  
  .form-group {
    margin-bottom: 1rem;
    flex: 1;
  }
  
  .form-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .form-control {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .form-text {
    font-size: 0.875rem;
    color: #6c757d;
    margin-top: 0.25rem;
  }
  
  .button-group {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .add-classification-form {
    background: #f8f9fa;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
  }
  
  .add-classification-form h3 {
    margin-top: 0;
  }
  
  .classifications-table {
    overflow-x: auto;
  }
  
  .classifications-table table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .classifications-table th,
  .classifications-table td {
    padding: 0.75rem;
    border: 1px solid #ddd;
    text-align: left;
  }
  
  .classifications-table th {
    background-color: #f8f9fa;
    font-weight: bold;
  }
  
  .address-cell {
    font-family: monospace;
    font-size: 0.9em;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .class-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
    text-transform: uppercase;
  }
  
  .class-emission { background-color: #e3f2fd; color: #1976d2; }
  .class-uploads { background-color: #f3e5f5; color: #7b1fa2; }
  .class-purchase { background-color: #e8f5e8; color: #388e3c; }
  .class-burn { background-color: #ffebee; color: #d32f2f; }
  .class-airdrop { background-color: #fff3e0; color: #f57c00; }
  .class-swap { background-color: #e0f2f1; color: #00796b; }
  .class-otherincome { background-color: #fce4ec; color: #c2185b; }
  .class-withdraw { background-color: #f1f8e9; color: #689f38; }
  
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .btn-primary {
    background-color: #007bff;
    color: white;
  }
  
  .btn-secondary {
    background-color: #6c757d;
    color: white;
  }
  
  .btn-danger {
    background-color: #dc3545;
    color: white;
  }
  
  .btn-sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
  }
  
  .message {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 4px;
  }
  
  .message.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }
  
  .message.success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }
  
  .no-data {
    text-align: center;
    color: #666;
    font-style: italic;
    padding: 2rem;
  }
  
  @media (max-width: 768px) {
    .form-row {
      flex-direction: column;
    }
    
    .button-group {
      flex-direction: column;
    }
    
    .tabs {
      flex-wrap: wrap;
    }
    
    .tab {
      flex: 1;
      min-width: 150px;
    }
  }
</style>