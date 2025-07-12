// src/lib/utils/crypto.ts
import BigNumber from 'bignumber.js';

BigNumber.config({
  DECIMAL_PLACES: 18,
  ROUNDING_MODE: BigNumber.ROUND_DOWN
});

export function formatBalance(balance: string, decimals: number = 18, displayDecimals: number = 6): string {
  try {
    let bn: BigNumber;
    
    // Handle hex input
    if (typeof balance === 'string' && balance.startsWith('0x')) {
      bn = new BigNumber(balance, 16);
    } else {
      bn = new BigNumber(balance);
    }
    
    // Convert from token's native decimals to human readable
    const divisor = new BigNumber(10).pow(decimals);
    const result = bn.dividedBy(divisor);
    
    return result.toFixed(displayDecimals);
  } catch (error) {
    console.error('Error formatting balance:', error, 'Input:', balance, 'Decimals:', decimals);
    return '0.000000';
  }
}

export function calculateValue(balance: string, price: string): string {
  try {
    const balanceBN = new BigNumber(balance);
    const priceBN = new BigNumber(price);
    return balanceBN.multipliedBy(priceBN).toFixed(5);
  } catch (error) {
    console.error('Error calculating value:', error);
    return '0.00000';
  }
}

export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function shortenNumber(num: string, maxLength: number = 6): string {
  if (num.length <= maxLength) return num;
  return num.slice(0, maxLength) + '...';
}