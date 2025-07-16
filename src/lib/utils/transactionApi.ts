// src/lib/utils/transactionApi.ts
import { settings } from '$lib/stores/settings.svelte.js';
import { storage } from '$lib/stores/storage.js';
import BigNumber from 'bignumber.js';
import type { RawTransaction, GasTransaction, HistoricalPrice, AddressClassification } from '$lib/types/index.js';

export interface ImportProgress {
  stage: 'asset_transfers' | 'gas_fees' | 'pricing' | 'complete';
  current: number;
  total: number;
  currentItem: string;
  startTime: number;
  stageStartTime: number;
}

export class TransactionAPI {
  private rateLimitDelay = 100; // Start with 100ms
  private maxRetries = 3;
  private progressCallback: ((progress: ImportProgress) => void) | null = null;
  private requestTimeout = 30000; // 30 second timeout
  
  setProgressCallback(callback: ((progress: ImportProgress) => void) | null) {
    this.progressCallback = callback;
  }
  
  private updateProgress(progress: Partial<ImportProgress>) {
    if (this.progressCallback) {
      this.progressCallback(progress as ImportProgress);
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async makeRequestWithTimeout(url: string, body: any, timeoutMs: number = this.requestTimeout): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    context: string,
    retryCount: number = 0
  ): Promise<T> {
    const startTime = Date.now();
    console.log(`🔄 Attempting ${context} (attempt ${retryCount + 1}/${this.maxRetries + 1})`);
    
    try {
      const result = await operation();
      
      const elapsed = Date.now() - startTime;
      console.log(`✅ ${context} completed in ${elapsed}ms`);
      
      // Reset delay on success
      if (this.rateLimitDelay > 100) {
        this.rateLimitDelay = Math.max(100, this.rateLimitDelay * 0.9);
        console.log(`📉 Rate limit delay reduced to ${this.rateLimitDelay}ms`);
      }
      
      return result;
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ ${context} failed after ${elapsed}ms:`, error.message);
      
      const isRateLimit = error.message?.includes('429') || error.status === 429;
      const isTimeout = error.message?.includes('timeout') || error.message?.includes('AbortError');
      
      if ((isRateLimit || isTimeout) && retryCount < this.maxRetries) {
        // Exponential backoff for rate limits and timeouts
        this.rateLimitDelay = Math.min(10000, this.rateLimitDelay * 2);
        const waitTime = this.rateLimitDelay + (retryCount * 2000);
        
        console.warn(`⏳ ${context} retry ${retryCount + 1}: waiting ${waitTime}ms (${isRateLimit ? 'rate limit' : 'timeout'})`);
        await this.sleep(waitTime);
        
        return this.retryWithBackoff(operation, context, retryCount + 1);
      }
      
      throw error;
    }
  }

  private async makeRequest(url: string, body: any, context: string): Promise<any> {
    console.log(`📤 Making request: ${context}`);
    console.log(`🔗 URL: ${url}`);
    console.log(`📋 Body:`, JSON.stringify(body, null, 2));
    
    await this.sleep(this.rateLimitDelay);
    
    return this.retryWithBackoff(async () => {
      const response = await this.makeRequestWithTimeout(url, body);
      
      console.log(`📥 Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Error response body:`, errorText);
        throw new Error(`${context} request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`📦 Response data:`, JSON.stringify(result, null, 2));
      
      if (result.error) {
        console.error(`❌ API error in response:`, result.error);
        throw new Error(`${context} API error: ${result.error.message} (Code: ${result.error.code})`);
      }

      return result;
    }, context);
  }

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
    const startTime = Date.now();
    console.log(`🔄 Starting transaction import for ${walletAddress} on ${network}`);
    
    // Validate API key
    if (!settings.apiKey) {
      throw new Error('API key is not configured');
    }
    
    try {
      // Find the most recent transaction to continue from
      const existingTransactions = storage.getRawTransactionsByWallet(walletAddress);
      const latestBlockNum = existingTransactions.length > 0 
        ? Math.max(...existingTransactions.map(tx => parseInt(tx.block_num, 16)))
        : 0;
      
      const fromBlock = latestBlockNum > 0 ? `0x${latestBlockNum.toString(16)}` : undefined;
      console.log(`📍 Starting from block: ${fromBlock || 'genesis'} (${existingTransactions.length} existing transactions)`);
      
      // Step 1: Get asset transfers with pagination
      this.updateProgress({
        stage: 'asset_transfers',
        current: 0,
        total: 0,
        currentItem: 'Initializing asset transfer import...',
        startTime,
        stageStartTime: Date.now()
      });
      
      await this.importAssetTransfers(walletAddress, network, fromBlock);
      
      // Step 2: Get gas fees for new transactions
      this.updateProgress({
        stage: 'gas_fees',
        current: 0,
        total: 0,
        currentItem: 'Preparing gas fee import...',
        startTime,
        stageStartTime: Date.now()
      });
      
      await this.importGasFees(walletAddress, network);
      
      // Step 3: Import historical prices for new transactions
      this.updateProgress({
        stage: 'pricing',
        current: 0,
        total: 0,
        currentItem: 'Preparing price import...',
        startTime,
        stageStartTime: Date.now()
      });
      
      await this.importHistoricalPrices(walletAddress, network);
      
      // Step 4: Update wallet sync timestamp
      storage.updateWalletSync(walletAddress);
      
      this.updateProgress({
        stage: 'complete',
        current: 100,
        total: 100,
        currentItem: 'Import completed successfully',
        startTime,
        stageStartTime: Date.now()
      });
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ Transaction import completed for ${walletAddress} in ${totalTime}ms`);
      
    } catch (error) {
      console.error(`❌ Transaction import failed for ${walletAddress}:`, error);
      this.updateProgress({
        stage: 'complete',
        current: 0,
        total: 100,
        currentItem: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        startTime,
        stageStartTime: Date.now()
      });
      throw error;
    }
  }

  private async importAssetTransfers(walletAddress: string, network: string, fromBlock?: string): Promise<void> {
    console.log(`📥 Importing asset transfers for ${walletAddress}`);
    
    let pageKey: string | undefined;
    let totalTransactions = 0;
    let pageCount = 0;
    
    try {
      do {
        pageCount++;
        console.log(`📄 Processing page ${pageCount}${pageKey ? ` (pageKey: ${pageKey.slice(0, 20)}...)` : ''}`);
        
        this.updateProgress({
          stage: 'asset_transfers',
          current: pageCount,
          total: pageCount + (pageKey ? 1 : 0),
          currentItem: `Fetching asset transfers page ${pageCount}...`,
          startTime: Date.now(),
          stageStartTime: Date.now()
        });
        
        const response = await this.getAssetTransfers(walletAddress, network, fromBlock, pageKey);
        
        if (response.result?.transfers) {
          console.log(`📊 Received ${response.result.transfers.length} transfers on page ${pageCount}`);
          
          const rawTransactions: RawTransaction[] = response.result.transfers
            .filter((transfer: any) => {
              // Skip if we already have this transaction
              const txId = `${transfer.blockNum}_${transfer.uniqueId}`;
              return !storage.getRawTransactions().find(tx => tx.id === txId);
            })
            .map((transfer: any) => {
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
          
          if (rawTransactions.length > 0) {
            storage.addRawTransactions(rawTransactions);
            totalTransactions += rawTransactions.length;
            
            console.log(`💾 Stored ${rawTransactions.length} new transactions (total new: ${totalTransactions})`);
          } else {
            console.log(`⏭️ No new transactions on page ${pageCount} (all already exist)`);
          }
        } else {
          console.log(`📭 No transfers found on page ${pageCount}`);
        }
        
        pageKey = response.result?.pageKey;
        console.log(`🔄 Page ${pageCount} complete. Next pageKey: ${pageKey ? pageKey.slice(0, 20) + '...' : 'none'}`);
        
      } while (pageKey);
      
      console.log(`✅ Asset transfer import completed: ${totalTransactions} new transactions across ${pageCount} pages`);
      
    } catch (error) {
      console.error(`❌ Asset transfer import failed on page ${pageCount}:`, error);
      throw error;
    }
  }

  private async importGasFees(walletAddress: string, network: string): Promise<void> {
    console.log(`⛽ Importing gas fees for ${walletAddress}`);
    
    const transactions = storage.getRawTransactionsByWallet(walletAddress);
    const existingGasTransactions = storage.getGasTransactions();
    
    // Only get gas for transactions we don't already have
    const uniqueHashes = [...new Set(transactions.map(tx => tx.hash))]
      .filter(hash => !existingGasTransactions.find(gas => gas.hash === hash));
    
    console.log(`⛽ Need to fetch gas data for ${uniqueHashes.length} unique transactions`);
    
    if (uniqueHashes.length === 0) {
      console.log(`⏭️ No new gas transactions needed`);
      return;
    }
    
    const gasTransactions: GasTransaction[] = [];
    
    for (let i = 0; i < uniqueHashes.length; i++) {
      const hash = uniqueHashes[i];
      
      this.updateProgress({
        stage: 'gas_fees',
        current: i + 1,
        total: uniqueHashes.length,
        currentItem: `Fetching gas for tx ${i + 1}/${uniqueHashes.length}: ${hash.slice(0, 12)}...`,
        startTime: Date.now(),
        stageStartTime: Date.now()
      });
      
      try {
        console.log(`⛽ Fetching gas receipt ${i + 1}/${uniqueHashes.length}: ${hash}`);
        
        const receipt = await this.getTransactionReceipt(hash, network);
        
        if (receipt.result) {
          const gasUsed = receipt.result.gasUsed;
          const effectiveGasPrice = receipt.result.effectiveGasPrice;
          const blockNumber = receipt.result.blockNumber;
          
          console.log(`⛽ Gas data: used=${gasUsed}, price=${effectiveGasPrice}, block=${blockNumber}`);
          
          // Find timestamp from one of the transactions with this hash
          const relatedTx = transactions.find(tx => tx.hash === hash);
          const timestamp = relatedTx?.timestamp || new Date().toISOString();
          
          // Get ETH price for gas cost calculation
          const ethPrice = await this.getEthPriceAtTime(timestamp);
          const gasCost = this.calculateGasCost(gasUsed, effectiveGasPrice, ethPrice);
          
          console.log(`⛽ Gas cost: ${gasCost.ethCost} ETH ($${gasCost.usdCost})`);
          
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
        } else {
          console.warn(`⚠️ No receipt result for ${hash}`);
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to get gas receipt for ${hash}:`, error);
      }
    }
    
    if (gasTransactions.length > 0) {
      storage.addGasTransactions(gasTransactions);
      console.log(`✅ Gas fee import completed: ${gasTransactions.length} gas transactions stored`);
    } else {
      console.log(`⚠️ No gas transactions were successfully imported`);
    }
  }

  private async importHistoricalPrices(walletAddress: string, network: string): Promise<void> {
    console.log(`💰 Importing historical prices for ${walletAddress}`);
    
    const transactions = storage.getRawTransactionsByWallet(walletAddress);
    const uniqueAssets = [...new Set(transactions.map(tx => ({ asset: tx.asset, contract: tx.contract_address })))];
    
    console.log(`💰 Found ${uniqueAssets.length} unique assets to price`);
    
    let processedCount = 0;
    let skippedCount = 0;
    const totalEstimate = transactions.length;
    
    for (const { asset, contract } of uniqueAssets) {
      const assetTransactions = transactions.filter(tx => tx.asset === asset && tx.contract_address === contract);
      console.log(`💰 Processing ${assetTransactions.length} transactions for ${asset}`);
      
      for (const tx of assetTransactions) {
        processedCount++;
        
        this.updateProgress({
          stage: 'pricing',
          current: processedCount,
          total: totalEstimate,
          currentItem: `Checking ${asset} price for ${new Date(tx.timestamp).toLocaleDateString()}... (${processedCount}/${totalEstimate})`,
          startTime: Date.now(),
          stageStartTime: Date.now()
        });
        
        try {
          const timestamp = new Date(tx.timestamp);
          
          // Check if we already have pricing data within 5 minutes
          const existingPrice = this.findExistingPrice(asset, contract, network, timestamp);
          
          if (existingPrice) {
            skippedCount++;
            console.log(`💾 Using existing price for ${asset} at ${timestamp.toISOString()}`);
            continue;
          }
          
          const startTime = new Date(timestamp.getTime() - 2 * 60 * 1000).toISOString(); // 2 minutes before
          const endTime = new Date(timestamp.getTime() + 20 * 60 * 1000).toISOString(); // 20 minutes after
          
          console.log(`💰 Fetching price for ${asset} from ${startTime} to ${endTime}`);
          
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
            console.log(`💰 Added ${historicalPrices.length} price points for ${asset}`);
          } else {
            console.log(`📭 No price data returned for ${asset}`);
          }
          
        } catch (error) {
          console.warn(`⚠️ Failed to get historical price for ${asset}:`, error);
        }
      }
    }
    
    console.log(`✅ Historical price import completed: processed ${processedCount}, skipped ${skippedCount}`);
  }

  private findExistingPrice(asset: string, contractAddress: string | undefined, network: string, timestamp: Date): HistoricalPrice | null {
    const existingPrices = storage.getHistoricalPrices();
    const fiveMinutesMs = 5 * 60 * 1000;
    
    return existingPrices.find(price => {
      const priceTime = new Date(price.timestamp).getTime();
      const timeDiff = Math.abs(priceTime - timestamp.getTime());
      
      return (price.symbol === asset || price.contract_address === contractAddress) &&
             price.network === network &&
             timeDiff <= fiveMinutesMs;
    }) || null;
  }

  private async getEthPriceAtTime(timestamp: string): Promise<string> {
    try {
      const time = new Date(timestamp);
      
      // Check existing prices first
      const existingPrice = this.findExistingPrice('ETH', null, 'eth-mainnet', time);
      if (existingPrice) {
        return existingPrice.price;
      }
      
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

    return this.makeRequest(url, requestBody, 'Asset transfers');
  }

  async getTransactionReceipt(hash: string, network: string): Promise<any> {
    const url = this.getJsonRpcUrl(network);

    const requestBody = {
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_getTransactionReceipt',
      params: [hash]
    };
    
    return this.makeRequest(url, requestBody, 'Transaction receipt');
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

    return this.makeRequest(url, requestBody, 'Historical prices');
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