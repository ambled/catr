<!-- src/routes/process/+page.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { storage } from '$lib/stores/storage.js';
  import { transactionAPI, type ImportProgress } from '$lib/utils/transactionApi.js';
  import { shortenAddress } from '$lib/utils/crypto.js';
  import type { Wallet } from '$lib/types/index.js';

  let wallets = $state<Wallet[]>([]);
  let loading = $state(false);
  let processingWallet = $state<string | null>(null);
  let error = $state('');
  let success = $state('');
  let progress = $state<ImportProgress | null>(null);

  // Unique identifier for this session to prevent stale progress updates
  let sessionId = $state(Date.now().toString());
  
  onMount(() => {
    loadWallets();
    
    // Set up progress callback
    transactionAPI.setProgressCallback((progressData) => {
      // Only update if we're currently processing
      if (loading && processingWallet) {
        progress = progressData;
      }
    });
  });

  onDestroy(() => {
    // Clean up progress callback when leaving page
    transactionAPI.setProgressCallback(null);
  });

  function loadWallets() {
    wallets = storage.getWallets();
  }

  async function processAllWallets() {
    if (loading) return;
    
    loading = true;
    error = '';
    success = '';
    progress = null;
    sessionId = Date.now().toString(); // New session
    
    console.log('🚀 Starting bulk wallet processing');
    
    try {
      for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        processingWallet = wallet.address;
        
        console.log(`📊 Processing wallet ${i + 1}/${wallets.length}: ${wallet.address}`);
        
        await transactionAPI.importTransactionsForWallet(wallet.address, 'arb-mainnet');
        
        // Brief pause between wallets
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      success = `Successfully processed ${wallets.length} wallets`;
      loadWallets(); // Refresh to show updated sync times
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to process wallets';
    } finally {
      loading = false;
      processingWallet = null;
      progress = null;
    }
  }

  async function clearAllWallets() {
    if (!confirm('Are you sure you want to clear ALL transaction data for ALL wallets? This cannot be undone.')) {
      return;
    }
    
    loading = true;
    error = '';
    success = '';
    
    try {
      for (const wallet of wallets) {
        storage.clearAllWalletData(wallet.address);
      }
      
      success = `Cleared transaction data for ${wallets.length} wallets`;
      loadWallets();
      
    } catch (err) {
      error = 'Failed to clear wallet data';
    } finally {
      loading = false;
    }
  }

  async function importTransactions(walletAddress: string) {
    if (loading) return;
    
    loading = true;
    processingWallet = walletAddress;
    error = '';
    success = '';
    progress = null;
    sessionId = Date.now().toString(); // New session
    
    try {
      await transactionAPI.importTransactionsForWallet(walletAddress, 'arb-mainnet');
      success = `Successfully imported transactions for ${shortenAddress(walletAddress)}`;
      loadWallets();
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to import transactions';
    } finally {
      loading = false;
      processingWallet = null;
      progress = null;
    }
  }

  function clearTransactions(walletAddress: string) {
    if (!confirm(`Are you sure you want to clear transaction data for ${shortenAddress(walletAddress)}?`)) {
      return;
    }
    
    try {
      storage.clearAllWalletData(walletAddress);
      success = `Cleared transaction data for ${shortenAddress(walletAddress)}`;
      loadWallets();
      
    } catch (err) {
      error = 'Failed to clear transaction data';
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  }

  function getWalletStats(address: string) {
    return storage.getWalletStats(address);
  }

  function getProgressPercentage(): number {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  }

  function getStageDescription(stage: string): string {
    switch (stage) {
      case 'asset_transfers': return 'Importing Transactions';
      case 'gas_fees': return 'Fetching Gas Fees';
      case 'pricing': return 'Fetching Historical Prices';
      case 'complete': return 'Import Complete';
      default: return 'Processing';
    }
  }

  function getElapsedTime(): string {
    if (!progress) return '';
    const elapsed = Date.now() - progress.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  }

  // Database backup/restore functions
  function exportDatabase() {
    try {
      const data = {
        wallets: storage.getWallets(),
        token_balances: storage.getTokenBalances(),
        token_prices: storage.getTokenPrices(),
        address_classifications: storage.getAddressClassifications(),
        raw_transactions: storage.getRawTransactions(),
        gas_transactions: storage.getGasTransactions(),
        historical_prices: storage.getHistoricalPrices(),
        exported_at: new Date().toISOString(),
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `autonomi-transactions-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      success = 'Database exported successfully';
    } catch (err) {
      error = 'Failed to export database';
    }
  }

  function importDatabase() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          
          if (!confirm('This will replace ALL existing data. Are you sure?')) {
            return;
          }

          // Clear existing data
          localStorage.clear();
          
          // Import new data
          if (data.wallets) storage.setItem('wallets', data.wallets);
          if (data.token_balances) storage.setItem('token_balances', data.token_balances);
          if (data.token_prices) storage.setItem('token_prices', data.token_prices);
          if (data.address_classifications) storage.setItem('address_classifications', data.address_classifications);
          if (data.raw_transactions) storage.setItem('raw_transactions', data.raw_transactions);
          if (data.gas_transactions) storage.setItem('gas_transactions', data.gas_transactions);
          if (data.historical_prices) storage.setItem('historical_prices', data.historical_prices);
          
          loadWallets();
          success = `Database imported successfully (exported: ${data.exported_at})`;
          
        } catch (err) {
          error = 'Failed to import database - invalid file format';
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
</script>

<div class="container">
  <div class="header">
    <h1>Transaction Processing</h1>
    <div class="bulk-actions">
      <button onclick={exportDatabase} class="btn btn-secondary">
        Export Database
      </button>
      <button onclick={importDatabase} class="btn btn-secondary">
        Import Database
      </button>
      <button 
        onclick={processAllWallets} 
        disabled={loading || wallets.length === 0}
        class="btn btn-primary"
      >
        {loading ? 'Processing...' : 'Process All Wallets'}
      </button>
      <button 
        onclick={clearAllWallets} 
        disabled={loading || wallets.length === 0}
        class="btn btn-danger"
      >
        Clear All Wallets
      </button>
    </div>
  </div>

  {#if error}
    <div class="message error">
      <strong>Error:</strong> {error}
    </div>
  {/if}

  {#if success}
    <div class="message success">
      <strong>Success:</strong> {success}
    </div>
  {/if}

  {#if loading && processingWallet && progress}
    <div class="progress-container">
      <div class="progress-header">
        <h3>Processing: {shortenAddress(processingWallet)}</h3>
        <div class="progress-stats">
          <span class="stage">{getStageDescription(progress.stage)}</span>
          <span class="time">Elapsed: {getElapsedTime()}</span>
        </div>
      </div>
      
      <div class="progress-bar">
        <div class="progress-fill" style="width: {getProgressPercentage()}%"></div>
        <div class="progress-text">
          {progress.current} / {progress.total} ({getProgressPercentage()}%)
        </div>
      </div>
      
      <div class="progress-details">
        <div class="current-item">{progress.currentItem}</div>
        {#if progress.stage === 'pricing'}
          <div class="pricing-note">
            <small>⏱️ Historical pricing requests have rate limits and may take time</small>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if wallets.length === 0}
    <div class="no-wallets">
      <p>No wallets found. Please add wallets first.</p>
      <a href="/wallets" class="btn btn-primary">Add Wallets</a>
    </div>
  {:else}
    <div class="wallets-section">
      <h2>Wallet Processing Status</h2>
      
      <div class="table-container">
        <table class="wallets-table">
          <thead>
            <tr>
              <th>Wallet</th>
              <th>Last Sync</th>
              <th>Transactions</th>
              <th>Gas Records</th>
              <th>Token Balances</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each wallets as wallet}
              {@const stats = getWalletStats(wallet.address)}
              <tr class:processing={processingWallet === wallet.address}>
                <td class="wallet-cell">
                  {shortenAddress(wallet.address)}
                  {#if wallet.name}
                    <br><small class="wallet-name">{wallet.name}</small>
                  {/if}
                </td>
                <td class="sync-cell">
                  {formatDate(wallet.last_sync)}
                </td>
                <td class="count-cell">
                  {stats.transactionCount}
                </td>
                <td class="count-cell">
                  {stats.gasTransactionCount}
                </td>
                <td class="count-cell">
                  {stats.balanceCount}
                </td>
                <td class="actions-cell">
                  <button 
                    onclick={() => importTransactions(wallet.address)}
                    disabled={loading}
                    class="btn btn-sm btn-primary"
                  >
                    {processingWallet === wallet.address ? 'Processing...' : 'Import'}
                  </button>
                  <button 
                    onclick={() => clearTransactions(wallet.address)}
                    disabled={loading}
                    class="btn btn-sm btn-danger"
                  >
                    Clear
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <div class="info-section">
    <h3>📋 Transaction Processing Features</h3>
    <ul>
      <li><strong>Intelligent Resume:</strong> Continues from the last imported transaction</li>
      <li><strong>Rate Limit Handling:</strong> Automatically backs off on 429 errors</li>
      <li><strong>Price Caching:</strong> Avoids duplicate price requests within 5-minute windows</li>
      <li><strong>Progress Tracking:</strong> Shows real-time import progress with timestamps</li>
      <li><strong>Database Backup:</strong> Export/import your complete transaction database</li>
    </ul>
  </div>
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 2rem;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .bulk-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .progress-container {
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .progress-header h3 {
    margin: 0;
    color: #495057;
  }
  
  .progress-stats {
    display: flex;
    gap: 1rem;
    font-size: 0.9rem;
    color: #6c757d;
  }
  
  .progress-bar {
    position: relative;
    height: 30px;
    background-color: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 1rem;
  }
  
  .progress-fill {
    height: 100%;
    background-color: #007bff;
    transition: width 0.3s ease;
  }
  
  .progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-weight: bold;
    color: #212529;
    font-size: 0.9rem;
  }
  
  .progress-details {
    font-size: 0.9rem;
    color: #6c757d;
  }
  
  .current-item {
    font-weight: bold;
    margin-bottom: 0.5rem;
  }
  
  .pricing-note {
    color: #856404;
    background-color: #fff3cd;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #ffeaa7;
  }
  
  .message {
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
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
  
  .no-wallets {
    text-align: center;
    padding: 3rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    background-color: #f8f9fa;
  }
  
  .wallets-section {
    margin-bottom: 3rem;
  }
  
  .table-container {
    overflow-x: auto;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  
  .wallets-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  
  .wallets-table th,
  .wallets-table td {
    padding: 1rem;
    border-bottom: 1px solid #eee;
    text-align: left;
  }
  
  .wallets-table th {
    background-color: #f8f9fa;
    font-weight: bold;
    border-bottom: 2px solid #ddd;
  }
  
  .wallets-table tr:last-child td {
    border-bottom: none;
  }
  
  .wallets-table tr.processing {
    background-color: #fff3cd;
  }
  
  .wallet-cell {
    font-family: monospace;
    min-width: 120px;
  }
  
  .wallet-name {
    color: #666;
    font-family: sans-serif;
  }
  
  .sync-cell {
    min-width: 150px;
  }
  
  .count-cell {
    text-align: center;
    font-weight: bold;
  }
  
  .actions-cell {
    white-space: nowrap;
  }
  
  .actions-cell .btn {
    margin-right: 0.5rem;
  }
  
  .info-section {
    background-color: #f8f9fa;
    padding: 2rem;
    border-radius: 8px;
    border: 1px solid #dee2e6;
  }
  
  .info-section h3 {
    margin-top: 0;
  }
  
  .info-section ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }
  
  .info-section li {
    margin-bottom: 0.5rem;
  }
  
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    text-decoration: none;
    display: inline-block;
  }
  
  .btn-sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
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
  
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      align-items: stretch;
    }
    
    .bulk-actions {
      justify-content: center;
    }
    
    .progress-header {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }
    
    .progress-stats {
      justify-content: space-between;
    }
    
    .wallets-table {
      font-size: 0.8rem;
    }
    
    .wallets-table th,
    .wallets-table td {
      padding: 0.5rem;
    }
  }
</style>