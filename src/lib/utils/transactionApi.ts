// src/lib/utils/transactionApi.ts
import { settings } from '$lib/stores/settings.svelte.js';
import BigNumber from 'bignumber.js';

export class TransactionAPI {
  private getJsonRpcUrl(network: string): string {
    const baseUrls: { [key: string]: string } = {
      'eth-mainnet': 'https://eth-mainnet.g.alchemy.com/v2/',
      'arb-mainnet': 'https://arb-mainnet.g.alchemy.com/v2/'
    };
    
    return `${baseUrls[network]}${settings.apiKey}`;
  }

  private getPriceApiUrl(): string {
    return `https://api.g.alchemy.com/prices/v1/${settings.apiKey}/tokens/historical`;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async getAssetTransfers(address: string, network: string, fromBlock?: string, pageKey?: string): Promise<any> {
    const url = this.getJsonRpcUrl(network);
    
    console.log(`🔄 Fetching asset transfers for ${address} on ${network}`);

    const params: any = {
      toAddress: address,
      category: ['external', 'erc20'],
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: '0x64', // 100 transactions
      contractAddresses: [
        '0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684', // ARBANT
        '0xaf88d065e77c8cc2239327c5edb3a432268e5831'  // ARBUSDC
      ]
    };

    if (fromBlock) {
      params.fromBlock = fromBlock;
    }

    if (pageKey) {
      params.pageKey = pageKey;
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

  async getTransactionReceipt(hash: string, network: string): Promise<any> {
    const url = this.getJsonRpcUrl(network);
    
    console.log(`🧾 Fetching transaction receipt for ${hash} on ${network}`);

    try {
      const requestBody = {
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [hash]
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transaction receipt request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
      }

      const result = await response.json();
      console.log(`📦 Transaction Receipt Response:`, JSON.stringify(result, null, 2));
      
      if (result.error) {
        throw new Error(`Transaction receipt error: ${result.error.message} (Code: ${result.error.code})`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Transaction receipt error for ${hash} on ${network}:`, error);
      throw error;
    }
  }

  async getHistoricalPrices(symbol: string, contractAddress: string | null, network: string, startTime: string, endTime: string): Promise<any> {
    const url = this.getPriceApiUrl();
    
    console.log(`💰 Fetching historical prices for ${symbol} from ${startTime} to ${endTime}`);

    try {
      const requestBody: any = {
        startTime,
        endTime,
        interval: '5m'
      };

      if (symbol === 'ETH') {
        requestBody.symbol = 'ETH';
      } else if (contractAddress) {
        requestBody.network = network;
        requestBody.address = contractAddress;
      } else {
        throw new Error(`Cannot fetch prices for ${symbol} without contract address`);
      }
      
      console.log(`📤 Historical Prices Request:`, JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ Historical prices request failed for ${symbol}: ${response.status} ${response.statusText}`);
        return { data: [] }; // Return empty data instead of throwing
      }

      const result = await response.json();
      console.log(`📦 Historical Prices Response:`, JSON.stringify(result, null, 2));
      
      return result;
    } catch (error) {
      console.warn(`⚠️ Historical prices error for ${symbol}:`, error);
      return { data: [] }; // Return empty data instead of throwing
    }
  }

  calculateGasCost(gasUsed: string, gasPrice: string, ethPrice: string): { ethCost: string, usdCost: string } {
    try {
      const gasUsedBN = new BigNumber(gasUsed, 16);
      const gasPriceBN = new BigNumber(gasPrice, 16);
      const ethPriceBN = new BigNumber(ethPrice);
      
      // Calculate ETH cost (gas used * gas price / 10^18)
      const ethCost = gasUsedBN.multipliedBy(gasPriceBN).dividedBy(new BigNumber(10).pow(18));
      
      // Calculate USD cost
      const usdCost = ethCost.multipliedBy(ethPriceBN);
      
      return {
        ethCost: ethCost.toFixed(18),
        usdCost: usdCost.toFixed(2)
      };
    } catch (error) {
      console.error('Error calculating gas cost:', error);
      return { ethCost: '0', usdCost: '0' };
    }
  }
}

export const transactionAPI = new TransactionAPI();