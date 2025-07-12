// src/lib/utils/api.ts
import { settings } from '$lib/stores/settings.svelte.js';
import type { AlchemyResponse } from '$lib/types/index.js';

export class AlchemyAPI {
  private getDataApiUrl(): string {
    return `https://api.g.alchemy.com/data/v1/${settings.apiKey}/assets/tokens/by-address`;
  }

  private getJsonRpcUrl(network: string): string {
    const baseUrls: { [key: string]: string } = {
      'eth-mainnet': 'https://eth-mainnet.g.alchemy.com/v2/',
      'arb-mainnet': 'https://arb-mainnet.g.alchemy.com/v2/'
    };
    
    return `${baseUrls[network]}${settings.apiKey}`;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async getTokenBalances(address: string, network: string): Promise<AlchemyResponse> {
    const url = this.getDataApiUrl();
    
    console.log(`🔍 Fetching token balances for ${address} on ${network}`);
    console.log(`📡 Data API URL: ${url}`);
    
    try {
      const requestBody = {
        addresses: [address], // Changed from 'address' to 'addresses' array
        network: network
      };
      
      console.log(`📤 Request body:`, JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      });

      console.log(`📥 Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error Response:`, errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
      }

      const result = await response.json();
      console.log(`📦 Raw Data API Response:`, JSON.stringify(result, null, 2));
      
      if (result.error) {
        console.error(`❌ Alchemy Data API Error:`, result.error);
        throw new Error(`Alchemy Data API error: ${result.error.message}`);
      }

      // Get ETH balance separately using JSON-RPC
      const ethBalance = await this.getEthBalance(address, network);
      console.log(`💰 ETH Balance: ${ethBalance}`);
      
      // Transform the response to match our expected format
      const items = [];
      
      // Add ETH balance first
      const ethSymbol = network === 'eth-mainnet' ? 'MAINETH' : 'ARBETH';
      const ethPrice = await this.getEthPrice(); // Get ETH price
      
      items.push({
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenBalance: ethBalance,
        tokenPrice: ethPrice,
        symbol: ethSymbol,
        name: network === 'eth-mainnet' ? 'Ethereum (Main)' : 'Ethereum (Arbitrum)'
      });

      // Process the response - the structure might be different
      let tokenData = result.data;
      
      // Handle different possible response structures
      if (result.data && result.data[address]) {
        tokenData = result.data[address];
      } else if (result.data && Array.isArray(result.data)) {
        tokenData = result.data;
      } else if (result.data && result.data.tokens) {
        tokenData = result.data.tokens;
      }

      if (tokenData && Array.isArray(tokenData)) {
        console.log(`🪙 Found ${tokenData.length} tokens in data response`);
        
        for (const item of tokenData) {
          console.log(`🔍 Processing token:`, {
            symbol: item.symbol,
            name: item.name,
            address: item.contractAddress || item.address,
            balance: item.balance,
            price: item.price,
            network: network
          });
          
          const contractAddress = item.contractAddress || item.address;
          const mappedSymbol = this.mapToOurSymbol(contractAddress, item.symbol, network);
          
          if (mappedSymbol && item.balance && item.balance !== '0') {
            items.push({
              tokenAddress: contractAddress,
              tokenBalance: item.balance,
              tokenPrice: item.price || '0',
              symbol: mappedSymbol,
              name: item.name || mappedSymbol
            });
          }
        }
      } else {
        console.log(`⚠️ Unexpected data structure:`, tokenData);
      }

      console.log(`✅ Final items array:`, items);

      return {
        data: { items }
      };
    } catch (error) {
      console.error(`❌ API Error for ${address} on ${network}:`, error);
      throw error;
    }
  }

  private async getEthPrice(): Promise<string> {
    try {
      // Simple price fetch - you could use a different API for this
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      return data.ethereum?.usd?.toString() || '2000';
    } catch (error) {
      console.warn('Failed to fetch ETH price, using default:', error);
      return '2000'; // Default ETH price
    }
  }

  private mapToOurSymbol(contractAddress: string, originalSymbol: string, network: string): string | null {
    const address = contractAddress.toLowerCase();
    
    // Your specific token mappings
    const tokenMap: { [key: string]: { [key: string]: string } } = {
      'eth-mainnet': {
        '0x329c6e459ffa7475718838145e5e85802db2a303': 'MAINEMAID',
        '0x0000000000000000000000000000000000000000': 'MAINETH', // ETH
      },
      'arb-mainnet': {
        '0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684': 'ARBANT',
        '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'ARBUSDC',
        '0x0000000000000000000000000000000000000000': 'ARBETH', // ETH
      }
    };

    const mappedSymbol = tokenMap[network]?.[address];
    
    if (mappedSymbol) {
      console.log(`✅ Mapped ${contractAddress} (${originalSymbol}) to ${mappedSymbol} on ${network}`);
      return mappedSymbol;
    }
    
    console.log(`⚠️ Unknown token: ${contractAddress} (${originalSymbol}) on ${network}`);
    return null; // Don't include unknown tokens
  }

  async getEthBalance(address: string, network: string): Promise<string> {
    const url = this.getJsonRpcUrl(network);
    
    console.log(`💰 Fetching ETH balance for ${address} on ${network}`);
    
    try {
      const requestBody = {
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest']
      };
      
      console.log(`📤 ETH Balance Request:`, JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`ETH balance request failed: ${response.status}`);
      }

      const result = await response.json();
      console.log(`📦 ETH Balance Response:`, JSON.stringify(result, null, 2));
      
      if (result.error) {
        throw new Error(`ETH balance error: ${result.error.message}`);
      }

      return result.result || '0x0';
    } catch (error) {
      console.warn(`⚠️ Failed to get ETH balance for ${address}:`, error);
      return '0x0';
    }
  }

  // Alternative method using JSON-RPC if Data API continues to have issues
  async getTokenBalancesJsonRpc(address: string, network: string): Promise<AlchemyResponse> {
    const url = this.getJsonRpcUrl(network);
    
    console.log(`🔍 Fetching token balances via JSON-RPC for ${address} on ${network}`);
    console.log(`📡 JSON-RPC URL: ${url}`);
    
    try {
      const requestBody = {
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getTokenBalances',
        params: [address, 'latest']
      };
      
      console.log(`📤 JSON-RPC Request body:`, JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      });

      console.log(`📥 JSON-RPC Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ JSON-RPC API Error Response:`, errorText);
        throw new Error(`JSON-RPC API request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
      }

      const result = await response.json();
      console.log(`📦 Raw JSON-RPC Response:`, JSON.stringify(result, null, 2));
      
      if (result.error) {
        console.error(`❌ Alchemy JSON-RPC Error:`, result.error);
        throw new Error(`Alchemy JSON-RPC error: ${result.error.message} (Code: ${result.error.code})`);
      }

      // Get ETH balance separately
      const ethBalance = await this.getEthBalance(address, network);
      console.log(`💰 ETH Balance: ${ethBalance}`);
      
      // Transform the response to match our expected format
      const items = [];
      
      // Add ETH balance first
      const ethSymbol = network === 'eth-mainnet' ? 'MAINETH' : 'ARBETH';
      const ethPrice = await this.getEthPrice();
      
      items.push({
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenBalance: ethBalance,
        tokenPrice: ethPrice,
        symbol: ethSymbol,
        name: network === 'eth-mainnet' ? 'Ethereum (Main)' : 'Ethereum (Arbitrum)'
      });

      // Add token balances from JSON-RPC response
      if (result.result?.tokenBalances) {
        console.log(`🪙 Found ${result.result.tokenBalances.length} token balances`);
        
        for (const balance of result.result.tokenBalances) {
          console.log(`🔍 Token: ${balance.contractAddress} = ${balance.tokenBalance}`);
          
          // Only include tokens with non-zero balance
          if (balance.tokenBalance && balance.tokenBalance !== '0x0' && balance.tokenBalance !== '0x') {
            const symbol = this.mapToOurSymbol(balance.contractAddress, 'UNKNOWN', network);
            console.log(`📝 Mapped ${balance.contractAddress} to symbol: ${symbol}`);
            
            if (symbol) {
              items.push({
                tokenAddress: balance.contractAddress,
                tokenBalance: balance.tokenBalance,
                tokenPrice: '0', // No price in JSON-RPC response
                symbol: symbol,
                name: symbol
              });
            }
          }
        }
      }

      console.log(`✅ Final items array:`, items);

      return {
        data: { items }
      };
    } catch (error) {
      console.error(`❌ JSON-RPC API Error for ${address} on ${network}:`, error);
      throw error;
    }
  }

  async getAssetTransfers(address: string, network: string, fromBlock?: string) {
    const url = this.getJsonRpcUrl(network);
    
    console.log(`🔄 Fetching asset transfers for ${address} on ${network}`);

    const params: any = {
      fromAddress: address,
      toAddress: address,
      category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: 1000
    };

    if (fromBlock) {
      params.fromBlock = fromBlock;
    }

    try {
      const requestBody = {
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [params]
      };
      
      console.log(`📤 Asset Transfers Request:`, JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Asset Transfers Error:`, errorText);
        throw new Error(`Asset transfers request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
      }

      const result = await response.json();
      console.log(`📦 Asset Transfers Response:`, JSON.stringify(result, null, 2));
      
      if (result.error) {
        throw new Error(`Asset transfers error: ${result.error.message} (Code: ${result.error.code})`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Asset transfers error for ${address} on ${network}:`, error);
      throw error;
    }
  }
}

export const alchemyAPI = new AlchemyAPI();