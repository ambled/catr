<!-- src/routes/transactions/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { storage } from '$lib/stores/storage.js';
  import { shortenAddress, shortenNumber } from '$lib/utils/crypto.js';
  import type { RawTransaction, GasTransaction } from '$lib/types/index.js';

  let transactions = $state<RawTransaction[]>([]);
  let gasTransactions = $state<GasTransaction[]>([]);
  let filteredTransactions = $state<RawTransaction[]>([]);
  
  // Pagination
  let currentPage = $state(1);
  let pageSize = $state(100);
  let totalPages = $state(1);
  
  // Filters
  let selectedWallet = $state('');
  let selectedClass = $state('');
  let selectedAsset = $state('');
  let dateFrom = $state('');
  let dateTo = $state('');
  
  let wallets = $state<string[]>([]);
  let transactionClasses = $state<string[]>([]);
  let assets = $state<string[]>([]);

  // Calculate summary statistics using $derived
  const summaryStats = $derived({
    totalTransactions: filteredTransactions.length,
    totalValue: filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.value || '0'), 0),
    uniqueWallets: new Set(filteredTransactions.map(tx => tx.wallet_address)).size,
    dateRange: filteredTransactions.length > 0 ? {
      earliest: new Date(Math.min(...filteredTransactions.map(tx => new Date(tx.timestamp).getTime()))),
      latest: new Date(Math.max(...filteredTransactions.map(tx => new Date(tx.timestamp).getTime())))
    } : null
  });

  onMount(() => {
    loadTransactions();
  });

  function loadTransactions() {
    transactions = storage.getRawTransactions().sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    gasTransactions = storage.getGasTransactions();
    
    // Extract unique values for filters
    wallets = [...new Set(transactions.map(tx => tx.wallet_address))];
    transactionClasses = [...new Set(transactions.map(tx => tx.transaction_class).filter(Boolean))];
    assets = [...new Set(transactions.map(tx => tx.asset))];
    
    applyFilters();
  }

  function applyFilters() {
    let filtered = [...transactions];
    
    if (selectedWallet) {
      filtered = filtered.filter(tx => tx.wallet_address === selectedWallet);
    }
    
    if (selectedClass) {
      filtered = filtered.filter(tx => tx.transaction_class === selectedClass);
    }
    
    if (selectedAsset) {
      filtered = filtered.filter(tx => tx.asset === selectedAsset);
    }
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(tx => new Date(tx.timestamp) >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(tx => new Date(tx.timestamp) <= toDate);
    }
    
    filteredTransactions = filtered;
    totalPages = Math.ceil(filteredTransactions.length / pageSize);
    currentPage = 1;
  }

  function getPaginatedTransactions(): RawTransaction[] {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTransactions.slice(startIndex, endIndex);
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  function clearFilters() {
    selectedWallet = '';
    selectedClass = '';
    selectedAsset = '';
    dateFrom = '';
    dateTo = '';
    applyFilters();
  }

  function getGasTransaction(hash: string): GasTransaction | null {
    return gasTransactions.find(gas => gas.hash === hash) || null;
  }

  function formatTimestamp(timestamp: string): string {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  }

  function formatValue(value: string, decimals: number = 18): string {
    try {
      const num = parseFloat(value);
      if (num === 0) return '0';
      if (num < 0.000001) return num.toExponential(3);
      return num.toFixed(6);
    } catch {
      return shortenNumber(value);
    }
  }

  function getClassColor(transactionClass: string): string {
    const colors: { [key: string]: string } = {
      'Emission': '#1976d2',
      'Uploads': '#7b1fa2',
      'Purchase': '#388e3c',
      'Burn': '#d32f2f',
      'AirDrop': '#f57c00',
      'Swap': '#00796b',
      'OtherIncome': '#c2185b',
      'Withdraw': '#689f38'
    };
    return colors[transactionClass] || '#666';
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }
</script>

<div class="container">
  <div class="header">
    <h1>Transaction History</h1>
    <div class="summary">
      <span class="stat">
        <strong>{summaryStats.totalTransactions.toLocaleString()}</strong> transactions
      </span>
      <span class="stat">
        <strong>{summaryStats.uniqueWallets}</strong> wallets
      </span>
      {#if summaryStats.dateRange}
        <span class="stat">
          {summaryStats.dateRange.earliest.toLocaleDateString()} - {summaryStats.dateRange.latest.toLocaleDateString()}
        </span>
      {/if}
    </div>
  </div>

  <!-- Filters -->
  <div class="filters">
    <div class="filter-row">
      <div class="filter-group">
        <label for="walletFilter">Wallet:</label>
        <select id="walletFilter" bind:value={selectedWallet} onchange={applyFilters}>
          <option value="">All Wallets</option>
          {#each wallets as wallet}
            <option value={wallet}>{shortenAddress(wallet)}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="classFilter">Class:</label>
        <select id="classFilter" bind:value={selectedClass} onchange={applyFilters}>
          <option value="">All Classes</option>
          {#each transactionClasses as txClass}
            <option value={txClass}>{txClass}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="assetFilter">Asset:</label>
        <select id="assetFilter" bind:value={selectedAsset} onchange={applyFilters}>
          <option value="">All Assets</option>
          {#each assets as asset}
            <option value={asset}>{asset}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="dateFrom">From:</label>
        <input 
          id="dateFrom" 
          type="date" 
          bind:value={dateFrom} 
          onchange={applyFilters}
        />
      </div>

      <div class="filter-group">
        <label for="dateTo">To:</label>
        <input 
          id="dateTo" 
          type="date" 
          bind:value={dateTo} 
          onchange={applyFilters}
        />
      </div>

      <button onclick={clearFilters} class="btn btn-secondary">Clear Filters</button>
    </div>
  </div>

  <!-- Pagination Controls -->
  {#if totalPages > 1}
    <div class="pagination">
      <button 
        onclick={() => goToPage(currentPage - 1)} 
        disabled={currentPage === 1}
        class="btn btn-sm"
      >
        Previous
      </button>
      
      <span class="page-info">
        Page {currentPage} of {totalPages} 
        ({((currentPage - 1) * pageSize + 1).toLocaleString()}-{Math.min(currentPage * pageSize, filteredTransactions.length).toLocaleString()} of {filteredTransactions.length.toLocaleString()})
      </span>
      
      <button 
        onclick={() => goToPage(currentPage + 1)} 
        disabled={currentPage === totalPages}
        class="btn btn-sm"
      >
        Next
      </button>
    </div>
  {/if}

  <!-- Transactions Table -->
  {#if filteredTransactions.length === 0}
    <div class="no-transactions">
      <p>No transactions found. Try adjusting your filters or import transaction data first.</p>
      <a href="/process" class="btn btn-primary">Import Transactions</a>
    </div>
  {:else}
    <div class="table-container">
      <table class="transactions-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Wallet</th>
            <th>Hash</th>
            <th>From → To</th>
            <th>Asset</th>
            <th>Value</th>
            <th>Class</th>
            <th>Gas</th>
          </tr>
        </thead>
        <tbody>
          {#each getPaginatedTransactions() as tx}
            {@const gasData = getGasTransaction(tx.hash)}
            <tr>
              <td 
                class="timestamp-cell"
                title={formatTimestamp(tx.timestamp)}
              >
                {shortenNumber(formatTimestamp(tx.timestamp), 16)}
              </td>
              
              <td 
                class="wallet-cell clickable"
                title={tx.wallet_address}
                onclick={() => copyToClipboard(tx.wallet_address)}
              >
                {shortenAddress(tx.wallet_address)}
              </td>
              
              <td 
                class="hash-cell clickable"
                title={tx.hash}
                onclick={() => copyToClipboard(tx.hash)}
              >
                {shortenNumber(tx.hash, 12)}
              </td>
              
              <td class="address-flow">
                <div class="from-to">
                  <span 
                    class="address clickable" 
                    title={tx.from_address}
                    onclick={() => copyToClipboard(tx.from_address)}
                  >
                    {shortenAddress(tx.from_address)}
                  </span>
                  <span class="arrow">→</span>
                  <span 
                    class="address clickable" 
                    title={tx.to_address}
                    onclick={() => copyToClipboard(tx.to_address)}
                  >
                    {shortenAddress(tx.to_address)}
                  </span>
                </div>
              </td>
              
              <td class="asset-cell">
                <span class="asset-badge">{tx.asset}</span>
              </td>
              
              <td 
                class="value-cell"
                title={tx.value}
              >
                {formatValue(tx.value, tx.decimals)}
              </td>
              
              <td class="class-cell">
                {#if tx.transaction_class}
                  <span 
                    class="class-badge" 
                    style="background-color: {getClassColor(tx.transaction_class)}20; color: {getClassColor(tx.transaction_class)}"
                  >
                    {tx.transaction_class}
                  </span>
                {/if}
              </td>
              
              <td class="gas-cell">
                {#if gasData}
                  <div class="gas-info">
                    <div title="ETH cost">{formatValue(gasData.gas_cost_eth)} ETH</div>
                    <div title="USD cost">${gasData.gas_cost_usd}</div>
                  </div>
                {:else}
                  <span class="no-gas">-</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Bottom Pagination -->
  {#if totalPages > 1}
    <div class="pagination">
      <button 
        onclick={() => goToPage(1)} 
        disabled={currentPage === 1}
        class="btn btn-sm"
      >
        First
      </button>
      <button 
        onclick={() => goToPage(currentPage - 1)} 
        disabled={currentPage === 1}
        class="btn btn-sm"
      >
        Previous
      </button>
      
      <!-- Page numbers -->
      {#each Array.from({length: Math.min(5, totalPages)}, (_, i) => {
        const start = Math.max(1, currentPage - 2);
        return start + i;
      }).filter(p => p <= totalPages) as page}
        <button 
          onclick={() => goToPage(page)}
          class="btn btn-sm"
          class:active={page === currentPage}
        >
          {page}
        </button>
      {/each}
      
      <button 
        onclick={() => goToPage(currentPage + 1)} 
        disabled={currentPage === totalPages}
        class="btn btn-sm"
      >
        Next
      </button>
      <button 
        onclick={() => goToPage(totalPages)} 
        disabled={currentPage === totalPages}
        class="btn btn-sm"
      >
        Last
      </button>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1400px;
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
  
  .summary {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
  }
  
  .stat {
    font-size: 0.9rem;
    color: #666;
  }
  
  .filters {
    background-color: #f8f9fa;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
  }
  
  .filter-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: end;
  }
  
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .filter-group label {
    font-size: 0.9rem;
    font-weight: bold;
    color: #555;
  }
  
  .filter-group select,
  .filter-group input {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
  }
  
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin: 1rem 0;
  }
  
  .page-info {
    margin: 0 1rem;
    font-size: 0.9rem;
    color: #666;
  }
  
  .no-transactions {
    text-align: center;
    padding: 3rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    background-color: #f8f9fa;
  }
  
  .table-container {
    overflow-x: auto;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  
  .transactions-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  
  .transactions-table th,
  .transactions-table td {
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid #eee;
    text-align: left;
  }
  
  .transactions-table th {
    background-color: #f8f9fa;
    font-weight: bold;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  
  .transactions-table tr:last-child td {
    border-bottom: none;
  }
  
  .transactions-table tr:hover {
    background-color: #f8f9fa;
  }
  
  .clickable {
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .clickable:hover {
    background-color: #e3f2fd !important;
  }
  
  .timestamp-cell {
    min-width: 120px;
    font-family: monospace;
  }
  
  .wallet-cell,
  .hash-cell {
    font-family: monospace;
    color: #1976d2;
  }
  
  .address-flow {
    min-width: 200px;
  }
  
  .from-to {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .address {
    font-family: monospace;
    color: #1976d2;
    font-size: 0.8rem;
  }
  
  .arrow {
    color: #666;
    font-weight: bold;
  }
  
  .asset-cell {
    text-align: center;
  }
  
  .asset-badge {
    background-color: #e3f2fd;
    color: #1976d2;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
  }
  
  .value-cell {
    text-align: right;
    font-family: monospace;
    font-weight: bold;
  }
  
  .class-cell {
    text-align: center;
  }
  
  .class-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
    border: 1px solid currentColor;
  }
  
  .gas-cell {
    text-align: right;
    min-width: 80px;
  }
  
  .gas-info {
    font-family: monospace;
    font-size: 0.8rem;
  }
  
  .gas-info div {
    line-height: 1.2;
  }
  
  .no-gas {
    color: #999;
  }
  
  .btn {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    background-color: white;
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
    border-color: #007bff;
  }
  
  .btn-secondary {
    background-color: #6c757d;
    color: white;
    border-color: #6c757d;
  }
  
  .btn:hover:not(:disabled) {
    background-color: #f8f9fa;
  }
  
  .btn-primary:hover:not(:disabled) {
    background-color: #0056b3;
  }
  
  .btn-secondary:hover:not(:disabled) {
    background-color: #545b62;
  }
  
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn.active {
    background-color: #007bff;
    color: white;
    border-color: #007bff;
  }
  
  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      align-items: stretch;
    }
    
    .summary {
      justify-content: center;
    }
    
    .filter-row {
      flex-direction: column;
      align-items: stretch;
    }
    
    .transactions-table {
      font-size: 0.75rem;
    }
    
    .transactions-table th,
    .transactions-table td {
      padding: 0.5rem 0.25rem;
    }
  }
</style>