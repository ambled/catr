// src/lib/utils/crypto.ts
import BigNumber from 'bignumber.js';

BigNumber.config({
  DECIMAL_PLACES: 18,
  ROUNDING_MODE: BigNumber.ROUND_DOWN
});

export function formatBalance(balance: string, decimals: number = 6): string {
  try {
    let bn: BigNumber;
    
    // Handle different input formats
    if (typeof balance === 'string' && balance.startsWith('0x')) {
      // Hex value - convert from wei
      bn = new BigNumber(balance, 16);
      bn = bn.dividedBy(new BigNumber(10).pow(18));
    } else if (typeof balance === 'string' && balance.includes('.')) {
      // Already a decimal number
      bn = new BigNumber(balance);
    } else {
      // Integer string - assume it's in wei
      bn = new BigNumber(balance);
      bn = bn.dividedBy(new BigNumber(10).pow(18));
    }
    
    return bn.toFixed(decimals);
  } catch (error) {
    console.error('Error formatting balance:', error, 'Input:', balance);
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