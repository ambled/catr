// src/lib/stores/storage.ts
import { browser } from '$app/environment';
import type { Wallet, TokenBalance, TokenPrice, Transaction, AddressClassification, RawTransaction, GasTransaction, HistoricalPrice } from '$lib/types/index.js';

class StorageService {
  private getItem<T>(key: string): T[] {
    if (!browser) return [];
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  }

  private setItem<T>(key: string, data: T[]): void {
    if (!browser) return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  // Wallets
  getWallets(): Wallet[] {
    return this.getItem<Wallet>('wallets');
  }

  addWallet(wallet: Omit<Wallet, 'id'>): void {
    const wallets = this.getWallets();
    const newWallet: Wallet = {
      ...wallet,
      id: Date.now(),
      created_at: new Date().toISOString()
    };
    wallets.push(newWallet);
    this.setItem('wallets', wallets);
  }

  removeWallet(id: number): void {
    const wallets = this.getWallets().filter(w => w.id !== id);
    this.setItem('wallets', wallets);
  }

  updateWalletSync(address: string): void {
    const wallets = this.getWallets();
    const wallet = wallets.find(w => w.address === address);
    if (wallet) {
      wallet.last_sync = new Date().toISOString();
      this.setItem('wallets', wallets);
    }
  }

  // Token Balances
  getTokenBalances(): TokenBalance[] {
    return this.getItem<TokenBalance>('token_balances');
  }

  setTokenBalances(balances: TokenBalance[]): void {
    this.setItem('token_balances', balances);
  }

  // Clear all token balances (useful when switching to real API)
  clearTokenBalances(): void {
    this.setItem('token_balances', []);
  }

  // Clear balances for specific wallet
  clearWalletBalances(walletAddress: string): void {
    const balances = this.getTokenBalances().filter(b => b.wallet_address !== walletAddress);
    this.setItem('token_balances', balances);
  }

  upsertTokenBalance(balance: TokenBalance): void {
    const balances = this.getTokenBalances();
    const index = balances.findIndex(b => 
      b.wallet_address === balance.wallet_address && 
      b.symbol === balance.symbol && 
      b.network === balance.network
    );
    
    if (index >= 0) {
      balances[index] = balance;
    } else {
      balances.push(balance);
    }
    
    this.setItem('token_balances', balances);
  }

  // Token Prices
  getTokenPrices(): TokenPrice[] {
    return this.getItem<TokenPrice>('token_prices');
  }

  upsertTokenPrice(price: TokenPrice): void {
    const prices = this.getTokenPrices();
    const index = prices.findIndex(p => p.symbol === price.symbol);
    
    if (index >= 0) {
      prices[index] = price;
    } else {
      prices.push(price);
    }
    
    this.setItem('token_prices', prices);
  }

  // Transactions (Legacy - keeping for compatibility)
  getTransactions(): Transaction[] {
    return this.getItem<Transaction>('transactions');
  }

  addTransactions(transactions: Transaction[]): void {
    const existing = this.getTransactions();
    const combined = [...existing];
    
    transactions.forEach(tx => {
      if (!combined.find(t => t.id === tx.id)) {
        combined.push(tx);
      }
    });
    
    this.setItem('transactions', combined);
  }

  getTransactionsByWallet(address: string): Transaction[] {
    return this.getTransactions().filter(tx => tx.wallet_address === address);
  }

  getTransactionCount(address: string): number {
    return this.getTransactionsByWallet(address).length;
  }

  // Address Classifications
  getAddressClassifications(): AddressClassification[] {
    return this.getItem<AddressClassification>('address_classifications');
  }

  addAddressClassification(classification: Omit<AddressClassification, 'id'>): void {
    const classifications = this.getAddressClassifications();
    const newClassification: AddressClassification = {
      ...classification,
      id: Date.now(),
      created_at: new Date().toISOString()
    };
    classifications.push(newClassification);
    this.setItem('address_classifications', classifications);
  }

  removeAddressClassification(id: number): void {
    const classifications = this.getAddressClassifications().filter(c => c.id !== id);
    this.setItem('address_classifications', classifications);
  }

  // Raw Transactions
  getRawTransactions(): RawTransaction[] {
    return this.getItem<RawTransaction>('raw_transactions');
  }

  addRawTransactions(transactions: RawTransaction[]): void {
    const existing = this.getRawTransactions();
    const combined = [...existing];
    
    transactions.forEach(tx => {
      if (!combined.find(t => t.id === tx.id)) {
        combined.push(tx);
      }
    });
    
    this.setItem('raw_transactions', combined);
  }

  clearWalletTransactions(walletAddress: string): void {
    const transactions = this.getRawTransactions().filter(t => t.wallet_address !== walletAddress);
    this.setItem('raw_transactions', transactions);
  }

  getRawTransactionsByWallet(walletAddress: string): RawTransaction[] {
    return this.getRawTransactions().filter(t => t.wallet_address === walletAddress);
  }

  getRawTransactionCount(walletAddress: string): number {
    return this.getRawTransactionsByWallet(walletAddress).length;
  }

  // Gas Transactions
  getGasTransactions(): GasTransaction[] {
    return this.getItem<GasTransaction>('gas_transactions');
  }

  addGasTransactions(gasTransactions: GasTransaction[]): void {
    const existing = this.getGasTransactions();
    const combined = [...existing];
    
    gasTransactions.forEach(gas => {
      if (!combined.find(g => g.id === gas.id)) {
        combined.push(gas);
      }
    });
    
    this.setItem('gas_transactions', combined);
  }

  clearWalletGasTransactions(walletAddress: string): void {
    const gasTransactions = this.getGasTransactions().filter(g => g.wallet_address !== walletAddress);
    this.setItem('gas_transactions', gasTransactions);
  }

  // Historical Prices
  getHistoricalPrices(): HistoricalPrice[] {
    return this.getItem<HistoricalPrice>('historical_prices');
  }

  addHistoricalPrices(prices: HistoricalPrice[]): void {
    const existing = this.getHistoricalPrices();
    const combined = [...existing];
    
    prices.forEach(price => {
      const existingIndex = combined.findIndex(p => 
        (p.symbol === price.symbol || p.contract_address === price.contract_address) &&
        p.network === price.network &&
        p.timestamp === price.timestamp
      );
      
      if (existingIndex >= 0) {
        combined[existingIndex] = price;
      } else {
        combined.push(price);
      }
    });
    
    this.setItem('historical_prices', combined);
  }

  findClosestPrice(symbol: string, contractAddress: string | undefined, network: string, timestamp: string): HistoricalPrice | null {
    const targetTime = new Date(timestamp).getTime();
    
    const prices = this.getHistoricalPrices().filter(p => 
      (p.symbol === symbol || p.contract_address === contractAddress) &&
      p.network === network &&
      new Date(p.timestamp).getTime() <= targetTime
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return prices[0] || null;
  }

  // Clear all transaction-related data for a wallet
  clearAllWalletData(walletAddress: string): void {
    this.clearWalletTransactions(walletAddress);
    this.clearWalletGasTransactions(walletAddress);
    this.clearWalletBalances(walletAddress);
  }

  // Get statistics
  getWalletStats(walletAddress: string): {
    transactionCount: number;
    gasTransactionCount: number;
    balanceCount: number;
    lastSync: string | null;
  } {
    const wallet = this.getWallets().find(w => w.address === walletAddress);
    
    return {
      transactionCount: this.getRawTransactionCount(walletAddress),
      gasTransactionCount: this.getGasTransactions().filter(g => g.wallet_address === walletAddress).length,
      balanceCount: this.getTokenBalances().filter(b => b.wallet_address === walletAddress).length,
      lastSync: wallet?.last_sync || null
    };
  }
}

export const storage = new StorageService();