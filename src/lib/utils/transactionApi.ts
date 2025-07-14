// src/lib/utils/transactionApi.ts
import { settings } from '$lib/stores/settings.svelte.js';
import { storage } from '$lib/stores/storage.js';
import BigNumber from 'bignumber.js';
import type { RawTransaction, GasTransaction, HistoricalPrice, AddressClassification } from '$lib/types/index.js';

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

  async importTransactionsForWallet(walletAddress: string, network: string = 'arb-mainnet'): Promise<void> {
    console.log(`🔄 Starting transaction import for ${walletAddress} on ${network}`);
    
    try {
      // Step 1: Get asset transfers with pagination
      await this.importAssetTransfers(walletAddress, network);
      
      // Step 2: Get gas fees for unique transaction hashes
      await this.importGasFees(walletAddress, network);
      
      // Step 3: Import historical prices for transactions
      await this.importHistoricalPrices(walletAddress, network);
      
      // Step 4: Update wallet sync timestamp
      storage.updateWalletSync(walletAddress);
      
      console.log(`✅ Transaction import completed for ${walletAddress}`);
      
    } catch (error) {
      console.error(`❌ Transaction import failed for ${walletAddress}:`, error);
      throw error;
    }
  }

  private async importAssetTransfers(walletAddress: string, network: string): Promise<void> {
    console.log(`📥 Importing asset transfers for ${walletAddress}`);
    
    let pageKey: string | undefined;
    let totalTransactions = 0;
    
    do {
      const response = await this.getAssetTransfers(walletAddress, network, undefined, pageKey);
      
      if (response.result?.transfers) {
        const rawTransactions: RawTransaction[] = response.result.transfers.map((transfer: any) => {
          const transactionClass = this.classifyTransaction(transfer, walletAddress);
          
          return {
            id: `${transfer.blockNum}_${transfer.uniqueId}`,
            wallet_address: walletAddress,
            block_num: transfer.blockNum,
            unique_id: transfer.uniqueId,
            hash: transfer.hash,
            from_address: transfer.from,
            to_address: transfer.to,
            value: transfer.value?.toString() || '0',
            asset: transfer.asset,
            category: transfer.category,
            contract_address: transfer.rawContract?.address,
            decimals: transfer.rawContract?.decimal ? parseInt(transfer.rawContract.decimal, 16) : 18,
            timestamp: transfer.metadata?.blockTimestamp || new Date().toISOString(),
            transaction_class: transactionClass,
            created_at: new Date().toISOString()
          };
        });
        
        storage.addRawTransactions(rawTransactions);
        totalTransactions += rawTransactions.length;
        
        console.log(`📊 Imported ${rawTransactions.length} transactions (total: ${totalTransactions})`);
      }
      
      pageKey = response.result?.pageKey;
      
    } while (pageKey);
    
    console.log(`✅ Asset transfer import completed: ${totalTransactions} transactions`);
  }

  private async importGasFees(walletAddress: string, network: string): Promise<void> {
    console.log(`⛽ Importing gas fees for ${walletAddress}`);
    
    const transactions = storage.getRawTransactionsByWallet(walletAddress);
    const uniqueHashes = [...new Set(transactions.map(tx => tx.hash))];
    
    const gasTransactions: GasTransaction[] = [];
    
    for (const hash of uniqueHashes) {
      try {
        const receipt = await this.getTransactionReceipt(hash, network);
        
        if (receipt.result) {
          const gasUsed = receipt.result.gasUsed;
          const effectiveGasPrice = receipt.result.effectiveGasPrice;
          const blockNumber = receipt.result.blockNumber;
          
          // Find timestamp from one of the transactions with this hash
          const relatedTx = transactions.find(tx => tx.hash === hash);
          const timestamp = relatedTx?.timestamp || new Date().toISOString();
          
          // Get ETH price for gas cost calculation
          const ethPrice = await this.getEthPriceAtTime(timestamp);
          const gasCost = this.calculateGasCost(gasUsed, effectiveGasPrice, ethPrice);
          
          gasTransactions.push({
            id: `${hash}_gas`,
            wallet_address: walletAddress,
            hash,
            block_num: blockNumber,
            gas_used: gasUsed,
            gas_price: effectiveGasPrice,
            gas_cost_eth: gasCost.ethCost,
            gas_cost_usd: gasCost.usdCost,
            timestamp,
            created_at: new Date().toISOString()
          });
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`⚠️ Failed to get receipt for ${hash}:`, error);
      }
    }
    
    storage.addGasTransactions(gasTransactions);
    console.log(`✅ Gas fee import completed: ${gasTransactions.length} gas transactions`);
  }

  private async importHistoricalPrices(walletAddress: string, network: string): Promise<void> {
    console.log(`💰 Importing historical prices for ${walletAddress}`);
    
    const transactions = storage.getRawTransactionsByWallet(walletAddress);
    const uniqueAssets = [...new Set(transactions.map(tx => ({ asset: tx.asset, contract: tx.contract_address })))];
    
    for (const { asset, contract } of uniqueAssets) {
      const assetTransactions = transactions.filter(tx => tx.asset === asset && tx.contract_address === contract);
      
      for (const tx of assetTransactions) {
        try {
          const timestamp = new Date(tx.timestamp);
          const startTime = new Date(timestamp.getTime() - 2 * 60 * 1000).toISOString(); // 2 minutes before
          const endTime = new Date(timestamp.getTime() + 20 * 60 * 1000).toISOString(); // 20 minutes after
          
          const priceData = await this.getHistoricalPrices(asset, contract, network, startTime, endTime);
          
          if (priceData.data && priceData.data.length > 0) {
            const historicalPrices: HistoricalPrice[] = priceData.data.map((price: any) => ({
              symbol: asset,
              contract_address: contract,
              network: network,
              price: price.value,
              currency: priceData.currency || 'usd',
              timestamp: price.timestamp,
              source: 'alchemy_historical' as const,
              created_at: new Date().toISOString()
            }));
            
            storage.addHistoricalPrices(historicalPrices);
          }
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.warn(`⚠️ Failed to get historical price for ${asset}:`, error);
        }
      }
    }
    
    console.log(`✅ Historical price import completed`);
  }

  private async getEthPriceAtTime(timestamp: string): Promise<string> {
    try {
      const time = new Date(timestamp);
      const startTime = new Date(time.getTime() - 5 * 60 * 1000).toISOString();
      const endTime = new Date(time.getTime() + 5 * 60 * 1000).toISOString();
      
      const priceData = await this.getHistoricalPrices('ETH', null, 'eth-mainnet', startTime, endTime);
      
      if (priceData.data && priceData.data.length > 0) {
        return priceData.data[0].value;
      }
    } catch (error) {
      console.warn('Failed to get ETH price, using default:', error);
    }
    
    return '2000'; // Default ETH price
  }

  private classifyTransaction(transfer: any, walletAddress: string): string {
    const classifications = storage.getAddressClassifications();
    
    // Check if from_address or to_address matches any classification
    const fromClassification = classifications.find(c => 
      c.wallet_address?.toLowerCase() === transfer.from?.toLowerCase() ||
      c.contract_address?.toLowerCase() === transfer.rawContract?.address?.toLowerCase()
    );
    
    const toClassification = classifications.find(c => 
      c.wallet_address?.toLowerCase() === transfer.to?.toLowerCase() ||
      c.contract_address?.toLowerCase() === transfer.rawContract?.address?.toLowerCase()
    );
    
    // Prioritize the classification based on transaction direction
    if (transfer.to?.toLowerCase() === walletAddress.toLowerCase()) {
      // Incoming transaction - use from classification
      return fromClassification?.transaction_class || 'OtherIncome';
    } else {
      // Outgoing transaction - use to classification
      return toClassification?.transaction_class || 'Withdraw';
    }
  }

  async getAssetTransfers(address: string, network: string, fromBlock?: string, pageKey?: string): Promise<any> {
    const url = this.getJsonRpcUrl(network);
    
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

    const requestBody = {
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [params]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Asset transfers request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`Asset transfers error: ${result.error.message}`);
    }

    return result;
  }

  async getTransactionReceipt(hash: string, network: string): Promise<any> {
    const url = this.getJsonRpcUrl(network);

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
      throw new Error(`Transaction receipt request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`Transaction receipt error: ${result.error.message}`);
    }

    return result;
  }

  async getHistoricalPrices(symbol: string, contractAddress: string | null, network: string, startTime: string, endTime: string): Promise<any> {
    const url = this.getPriceApiUrl();

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

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.warn(`Historical prices request failed for ${symbol}: ${response.status}`);
      return { data: [] };
    }

    const result = await response.json();
    return result;
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