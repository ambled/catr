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
    }>;
  };
}