// src/lib/types/index.ts
export interface Wallet {
  id?: number;
  address: string;
  name?: string;
  created_at?: string;
  last_sync?: string;
}

export interface TokenBalance {
  wallet_address: string;
  symbol: string;
  name?: string;
  balance: string;
  price: string;
  value: string;
  network: string;
  decimals?: number;
  updated_at: string;
}

export interface TokenPrice {
  symbol: string;
  price: string;
  updated_at: string;
}

export interface Transaction {
  id: string; // blockNum + uniqueId
  timestamp: string;
  blockNum: string;
  uniqueId: string;
  hashNum: string;
  fromWallet: string;
  toWallet: string;
  symbol: string;
  value: string;
  wallet_address: string;
}

export interface AlchemyResponse {
  data: {
    items: Array<{
      tokenAddress: string;
      tokenBalance: string;
      tokenPrice: string;
      symbol: string;
      name?: string;
      network?: string;
      decimals?: number;
    }>;
  };
}

// src/lib/types/index.ts - Add these new types
export interface AddressClassification {
  id?: number;
  name: string;
  wallet_address?: string;
  contract_address?: string;
  transaction_class: 'Emission' | 'Uploads' | 'Purchase' | 'Burn' | 'AirDrop' | 'Swap' | 'OtherIncome' | 'Withdraw';
  created_at?: string;
}

export interface RawTransaction {
  id: string; // blockNum + uniqueId
  wallet_address: string;
  block_num: string;
  unique_id: string;
  hash: string;
  from_address: string;
  to_address: string;
  value: string;
  asset: string;
  category: string;
  contract_address?: string;
  decimals?: number;
  timestamp: string;
  transaction_class?: string;
  gas_used?: string;
  gas_price?: string;
  created_at?: string;
}

export interface GasTransaction {
  id: string; // hash + '_gas'
  wallet_address: string;
  hash: string;
  block_num: string;
  gas_used: string;
  gas_price: string;
  gas_cost_eth: string;
  gas_cost_usd: string;
  timestamp: string;
  created_at?: string;
}

export interface HistoricalPrice {
  id?: number;
  symbol?: string;
  contract_address?: string;
  network?: string;
  price: string;
  currency: string;
  timestamp: string;
  source: 'alchemy_balance' | 'alchemy_historical' | 'manual';
  created_at?: string;
}