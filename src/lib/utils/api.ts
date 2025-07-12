// src/lib/utils/api.ts
import { settings } from '$lib/stores/settings.svelte.js';
import type { AlchemyResponse } from '$lib/types/index.js';

export class AlchemyAPI {
  private getDataApiUrl(): string {
    return `https://api.g.alchemy.com/data/v1/${settings.apiKey}/assets/tokens/by-address`;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async getTokenBalances(address: string, network?: string): Promise<AlchemyResponse> {
    const url = this.getDataApiUrl();
    
    console.log(`🔍 Fetching token balances for ${address}`);
    console.log(`📡 Data API URL: ${url}`);
    
    try {
      // Use the correct payload structure
      const requestBody = {
        addresses: [
          {
            address: address,
            networks: ["eth-mainnet", "arb-mainnet"]
          }
        ]
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

      // Transform the response to match our expected format
      const items = [];
      
      // Process the response data
      if (result.data && Array.isArray(result.data)) {
        console.log(`📊 Processing ${result.data.length} address responses`);
        
        for (const addressData of result.data) {
          console.log(`🔍 Processing address data:`, addressData);
          
          if (addressData.networks) {
            for (const networkData of addressData.networks) {
              console.log(`🌐 Processing network: ${networkData.network}`);
              
              if (networkData.tokens && Array.isArray(networkData.tokens)) {
                for (const token of networkData.tokens) {
                  console.log(`🪙 Processing token:`, {
                    symbol: token.symbol,
                    name: token.name,
                    address: token.contractAddress,
                    balance: token.balance,
                    price: token.price,
                    network: networkData.network
                  });
                  
                  // Map to our desired symbols
                  const mappedSymbol = this.mapToOurSymbol(token.contractAddress, token.symbol, networkData.network);
                  
                  if (mappedSymbol && token.balance && token.balance !== '0') {
                    items.push({
                      tokenAddress: token.contractAddress,
                      tokenBalance: token.balance,
                      tokenPrice: token.price || '0',
                      symbol: mappedSymbol,
                      name: token.name || mappedSymbol,
                      network: networkData.network
                    });
                  }
                }
              }
              
              // Add ETH balance if available
              if (networkData.nativeToken) {
                const ethSymbol = networkData.network === 'eth-mainnet' ? 'MAINETH' : 'ARBETH';
                console.log(`💰 Adding ETH balance for ${networkData.network}:`, networkData.nativeToken);
                
                items.push({
                  tokenAddress: '0x0000000000000000000000000000000000000000',
                  tokenBalance: networkData.nativeToken.balance,
                  tokenPrice: networkData.nativeToken.price || '0',
                  symbol: ethSymbol,
                  name: networkData.network === 'eth-mainnet' ? 'Ethereum (Main)' : 'Ethereum (Arbitrum)',
                  network: networkData.network
                });
              }
            }
          }
        }
      }

      console.log(`✅ Final items array (${items.length} items):`, items);

      return {
        data: { items }
      };
    } catch (error) {
      console.error(`❌ API Error for ${address}:`, error);
      throw error;
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

  async getAssetTransfers(address: string, network: string, fromBlock?: string) {
    // This will be implemented later when we work on the transactions feature
    console.log(`🔄 Asset transfers not yet implemented for ${address} on ${network}`);
    return { result: { transfers: [] } };
  }
}

export const alchemyAPI = new AlchemyAPI();