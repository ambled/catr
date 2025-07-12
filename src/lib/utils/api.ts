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

  async getTokenBalances(address: string, pageKey?: string): Promise<AlchemyResponse> {
    const url = this.getDataApiUrl();
    
    console.log(`🔍 Fetching token balances for ${address}${pageKey ? ` (pageKey: ${pageKey})` : ''}`);
    console.log(`📡 Data API URL: ${url}`);
    
    try {
      // Build the request payload
      const requestBody: any = {
        addresses: [
          {
            address: address,
            networks: ["eth-mainnet", "arb-mainnet"]
          }
        ]
      };

      // Add pageKey if provided for pagination
      if (pageKey) {
        requestBody.pageKey = pageKey;
      }
      
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
      let nextPageKey = result.data?.pageKey;
      
      // Process the tokens array
      if (result.data?.tokens && Array.isArray(result.data.tokens)) {
        console.log(`📊 Processing ${result.data.tokens.length} tokens`);
        
        for (const token of result.data.tokens) {
          console.log(`🔍 Processing token:`, {
            address: token.address,
            network: token.network,
            tokenAddress: token.tokenAddress,
            balance: token.tokenBalance,
            symbol: token.tokenMetadata?.symbol,
            name: token.tokenMetadata?.name,
            decimals: token.tokenMetadata?.decimals,
            price: token.tokenPrices?.[0]?.value
          });

          // Handle native tokens (ETH) - these have tokenAddress as null
          if (token.tokenAddress === null) {
            const ethSymbol = token.network === 'eth-mainnet' ? 'MAINETH' : 'ARBETH';
            const ethName = token.network === 'eth-mainnet' ? 'Ethereum (Main)' : 'Ethereum (Arbitrum)';
            
            items.push({
              tokenAddress: '0x0000000000000000000000000000000000000000',
              tokenBalance: token.tokenBalance,
              tokenPrice: token.tokenPrices?.[0]?.value || '0',
              symbol: ethSymbol,
              name: ethName,
              network: token.network,
              decimals: 18
            });
          } else {
            // Handle ERC20 tokens
            const mappedSymbol = this.mapToOurSymbol(token.tokenAddress, token.tokenMetadata?.symbol, token.network);
            
            // Only include tokens we care about and have non-zero balance
            if (mappedSymbol && token.tokenBalance && token.tokenBalance !== '0x0' && token.tokenBalance !== '0x00000000000000000000000000000000000000000000000000000000000000') {
              items.push({
                tokenAddress: token.tokenAddress,
                tokenBalance: token.tokenBalance,
                tokenPrice: token.tokenPrices?.[0]?.value || '0',
                symbol: mappedSymbol,
                name: token.tokenMetadata?.name || mappedSymbol,
                network: token.network,
                decimals: token.tokenMetadata?.decimals || 18
              });
            }
          }
        }
      }

      console.log(`✅ Processed ${items.length} relevant tokens`);
      
      // If there's a pageKey, fetch the next page
      if (nextPageKey) {
        console.log(`🔄 Found pageKey: ${nextPageKey}, fetching next page...`);
        const nextPageResponse = await this.getTokenBalances(address, nextPageKey);
        items.push(...nextPageResponse.data.items);
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

  private mapToOurSymbol(contractAddress: string, originalSymbol: string | null, network: string): string | null {
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