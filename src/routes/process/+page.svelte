<!-- src/routes/process/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { storage } from '$lib/stores/storage.js';
  import { transactionAPI } from '$lib/utils/transactionApi.js';
  import { shortenAddress } from '$lib/utils/crypto.js';
  import type { Wallet } from '$lib/types/index.js';

  let wallets = $state<Wallet[]>([]);
  let loading = $state(false);
  let processingWallet = $state<string | null>(null);
  let error = $state('');
  let success = $state('');

  onMount(() => {
    loadWallets();
  });

  function loadWallets() {
    wallets = storage.getWallets();
  }

  async function processAllWallets() {
    if (loading) return;
    
    loading = true;
    error = '';
    success = '';
    
    console.log('🚀 Starting bulk wallet processing');
    
    try {
      for (const wallet of wallets) {
        processingWallet = wallet.address;
        console.log(`📊 Processing wallet: ${wallet.address}`);
        
        await transactionAPI.importTransactionsForWallet(wallet.address, 'arb-mainnet');
        
        // Add delay between wallets to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      success = `Successfully processed ${wallets.length} wallets`;
      loadWallets(); // Refresh to show updated sync times
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to process wallets';
    } finally {
      loading = false;
      processingWallet = null;
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
    
    try {
      await transactionAPI.importTransactionsForWallet(walletAddress, 'arb-mainnet');
      success = `Successfully imported transactions for ${shortenAddress(walletAddress)}`;
      loadWallets();
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to import transactions';
    } finally {
      loading = false;
      processingWallet = null;
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
</script>

<div class="container">
  <div class="header">
    <h1>Transaction Processing</h1>
    <div class="bulk-actions">
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

  {#if loading && processingWallet}
    <div class="processing-status">
      <div class="spinner"></div>
      <span>Processing: {shortenAddress(processingWallet)}</span>
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
    <h3>📋 Transaction Processing Steps</h3>
    <ol>
      <li><strong>Import Raw Transactions:</strong> Fetches asset transfers using alchemy_getAssetTransfers API with pagination</li>
      <li><strong>Import Gas Fees:</strong> Retrieves transaction receipts to calculate gas costs in ETH and USD</li>
      <li><strong>Import Token Prices:</strong> Fetches historical pricing data with 5-minute resolution around transaction timestamps</li>
      <li><strong>Classify Transactions:</strong> Applies address classifications to categorize transaction types</li>
    </ol>
    
    <div class="processing-notes">
      <h4>⚠️ Important Notes:</h4>
      <ul>
        <li>Processing can take several minutes per wallet due to API rate limits</li>
        <li>Historical price data is fetched 2 minutes before to 20 minutes after each transaction</li>
        <li>Gas fees are calculated using ETH prices at transaction time</li>
        <li>Transactions are automatically classified based on configured address rules</li>
        <li>ANT token pricing may not be available through Alchemy's historical API</li>
      </ul>
    </div>
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
  
  .processing-status {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background-color: #e3f2fd;
    border: 1px solid #2196f3;
    border-radius: 4px;
    margin-bottom: 1rem;
  }
  
  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #2196f3;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
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
  
  .info-section h3,
  .info-section h4 {
    margin-top: 0;
  }
  
  .info-section ol,
  .info-section ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }
  
  .info-section li {
    margin-bottom: 0.5rem;
  }
  
  .processing-notes {
    margin-top: 2rem;
    padding: 1rem;
    background-color: #fff;
    border-radius: 4px;
    border: 1px solid #ffc107;
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
    
    .wallets-table {
      font-size: 0.8rem;
    }
    
    .wallets-table th,
    .wallets-table td {
      padding: 0.5rem;
    }
  }
</style>