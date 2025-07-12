<!-- src/routes/balances/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { storage } from '$lib/stores/storage.js';
  import { alchemyAPI } from '$lib/utils/api.js';
  import { formatBalance, calculateValue, shortenAddress } from '$lib/utils/crypto.js';
  import type { Wallet, TokenBalance } from '$lib/types/index.js';

  let wallets = $state<Wallet[]>([]);
  let balances = $state<TokenBalance[]>([]);
  let loading = $state(false);
  let error = $state('');
  let useRealAPI = $state(false);

  const tokenSymbols = ['ARBANT', 'ARBETH', 'ARBUSDC', 'MAINETH', 'MAINEMAID'];

  onMount(() => {
    loadWallets();
    loadBalances();
  });

  function loadWallets() {
    wallets = storage.getWallets();
  }

  function loadBalances() {
    balances = storage.getTokenBalances();
  }

  async function refreshBalances() {
    loading = true;
    error = '';

    // Clear console for fresh logs
    if (useRealAPI) {
      console.clear();
      console.log('🚀 Starting balance refresh with Data API v1');
    }

    try {
      if (useRealAPI) {
        await refreshRealBalances();
      } else {
        await refreshDummyBalances();
      }
      
      loadBalances();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to refresh balances';
      console.error('💥 Balance refresh error:', err);
    } finally {
      loading = false;
    }
  }

  async function refreshDummyBalances() {
    // Generate dummy data for testing
    const dummyBalances: TokenBalance[] = [];
    
    for (const wallet of wallets) {
      for (const symbol of tokenSymbols) {
        const balance = (Math.random() * 100).toFixed(6);
        const price = symbol.includes('ETH') ? '2000.00' : 
                     symbol.includes('USDC') ? '1.00' : 
                     (Math.random() * 10 + 1).toFixed(2);
        dummyBalances.push({
          wallet_address: wallet.address,
          symbol,
          name: symbol,
          balance,
          price,
          value: calculateValue(balance, price),
          network: symbol.startsWith('ARB') ? 'arb-mainnet' : 'eth-mainnet',
          updated_at: new Date().toISOString()
        });
      }
    }

    storage.setTokenBalances(dummyBalances);
  }

  async function refreshRealBalances() {
    const allFoundTokens = new Set<string>();
    let totalTokensFound = 0;
    
    for (const wallet of wallets) {
      console.log(`\n🔍 Processing wallet: ${wallet.address}`);
      
      try {
        console.log(`\n📡 Fetching from both networks...`);
        
        // The new API fetches from both networks in one call
        const response = await alchemyAPI.getTokenBalances(wallet.address);
        
        console.log(`✅ Got ${response.data.items.length} items total`);
        
        for (const item of response.data.items) {
          console.log(`\n🪙 Processing token:`, {
            symbol: item.symbol,
            name: item.name,
            address: item.tokenAddress,
            balance: item.tokenBalance,
            price: item.tokenPrice,
            network: item.network
          });
          
          allFoundTokens.add(`${item.symbol} (${item.name || 'Unknown'}) on ${item.network} - ${item.tokenPrice ? '$' + item.tokenPrice : 'No price'}`);
          totalTokensFound++;
          
          // Format balance and calculate value
          const balance = formatBalance(item.tokenBalance);
          const price = item.tokenPrice || '0';
          const value = calculateValue(balance, price);

          console.log(`💰 Formatted: Balance=${balance}, Price=${price}, Value=${value}`);

          // Store balance
          storage.upsertTokenBalance({
            wallet_address: wallet.address,
            symbol: item.symbol,
            name: item.name,
            balance,
            price,
            value,
            network: item.network || 'unknown',
            updated_at: new Date().toISOString()
          });

          // Store price
          storage.upsertTokenPrice({
            symbol: item.symbol,
            price,
            updated_at: new Date().toISOString()
          });
        }
      } catch (walletError) {
        console.error(`❌ Failed to fetch balances for ${wallet.address}:`, walletError);
        error += `\nFailed for ${shortenAddress(wallet.address)}: ${walletError instanceof Error ? walletError.message : 'Unknown error'}`;
      }
    }

    // Show summary
    console.log('\n📊 SUMMARY OF ALL FOUND TOKENS:');
    Array.from(allFoundTokens).forEach(token => {
      console.log(`  • ${token}`);
    });

    if (totalTokensFound > 0) {
      error = `Successfully processed ${totalTokensFound} tokens across ${wallets.length} wallets using Data API v1. Check console for details.`;
    } else {
      error = error || 'No tokens found. Check console for API response details.';
    }
  }

  function getBalanceForWalletAndToken(walletAddress: string, symbol: string): TokenBalance | null {
    return balances.find(b => b.wallet_address === walletAddress && b.symbol === symbol) || null;
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
    <h1>Token Balances</h1>
    <div class="controls">
      <div class="toggle-container">
        <span class="toggle-label">Use Real API</span>
        <label class="switch">
          <input type="checkbox" bind:checked={useRealAPI} />
          <span class="slider"></span>
        </label>
      </div>
      <button onclick={refreshBalances} disabled={loading} class="btn btn-primary">
        {loading ? 'Loading...' : 'Refresh Balances'}
      </button>
    </div>
  </div>

  {#if error}
    <div class="info">
      <strong>Info:</strong> 
      <pre>{error}</pre>
      <small>Using Alchemy Data API v1 with proper payload structure. Check console for detailed logs.</small>
    </div>
  {/if}

  {#if wallets.length === 0}
    <div class="no-wallets">
      <p>No wallets found. Please add wallets first.</p>
      <a href="/wallets" class="btn btn-primary">Add Wallets</a>
    </div>
  {:else}
    <div class="table-container">
      <table class="balance-table">
        <thead>
          <tr>
            <th>Wallet</th>
            {#each tokenSymbols as symbol}
              <th>{symbol}</th>
              <th>${symbol}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each wallets as wallet}
            <tr>
              <td 
                class="wallet-cell"
                title={wallet.address}
                onclick={() => copyToClipboard(wallet.address)}
              >
                {shortenAddress(wallet.address)}
                {#if wallet.name}
                  <br><small>{wallet.name}</small>
                {/if}
              </td>
              {#each tokenSymbols as symbol}
                {@const balance = getBalanceForWalletAndToken(wallet.address, symbol)}
                <td title={balance ? `${balance.name || balance.symbol}: ${balance.balance}` : '0'}>
                  {balance?.balance || '0.000000'}
                </td>
                <td title={balance ? `Value: $${balance.value} (${balance.balance} × $${balance.price})` : '$0'}>
                  ${balance?.value || '0.00000'}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <div class="payload-info">
    <h3>📋 API Payload Structure:</h3>
    <pre><code>{JSON.stringify({
      addresses: [
        {
          address: "0x77Cf50945Db7A93DE3CAb535220570E2dCe7f91E",
          networks: ["eth-mainnet", "arb-mainnet"]
        }
      ]
    }, null, 2)}</code></pre>
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
  
  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .toggle-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .toggle-label {
    font-size: 0.9rem;
    color: #666;
    white-space: nowrap;
  }
  
  .switch {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 24px;
    flex-shrink: 0;
  }
  
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: .4s;
    border-radius: 24px;
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }
  
  input:checked + .slider {
    background-color: #2196F3;
  }
  
  input:checked + .slider:before {
    transform: translateX(26px);
  }
  
  .info {
    margin-bottom: 1rem;
    padding: 1rem;
    border-radius: 4px;
    border: 1px solid #bee5eb;
    background-color: #d1ecf1;
    color: #0c5460;
  }
  
  .info pre {
    margin: 0.5rem 0;
    font-size: 0.9rem;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  
  .payload-info {
    margin-top: 2rem;
    padding: 1rem;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    background-color: #f8f9fa;
  }
  
  .payload-info h3 {
    margin-top: 0;
    margin-bottom: 1rem;
  }
  
  .payload-info pre {
    background-color: #ffffff;
    padding: 1rem;
    border-radius: 4px;
    border: 1px solid #ddd;
    overflow-x: auto;
  }
  
  .payload-info code {
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
  }
  
  .no-wallets {
    text-align: center;
    padding: 2rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: #f8f9fa;
  }
  
  .table-container {
    overflow-x: auto;
  }
  
  .balance-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
  }
  
  .balance-table th,
  .balance-table td {
    padding: 0.5rem;
    border: 1px solid #ddd;
    text-align: right;
  }
  
  .balance-table th {
    background-color: #f8f9fa;
    font-weight: bold;
  }
  
  .wallet-cell {
    cursor: pointer;
    text-align: left !important;
    font-family: monospace;
    min-width: 120px;
  }
  
  .wallet-cell:hover {
    background-color: #e9ecef;
  }
  
  .wallet-cell small {
    color: #666;
    font-family: sans-serif;
  }
  
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    white-space: nowrap;
  }
  
  .btn-primary {
    background-color: #007bff;
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
    
    .controls {
      justify-content: center;
    }
  }
</style>