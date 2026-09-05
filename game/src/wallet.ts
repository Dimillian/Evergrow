/** Missing balance means an empty wallet. Amounts are always whole, safe integers. */
export interface GoldWallet { gold?: number; }
export const validGold = (amount: unknown): amount is number =>
  typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0;
export const goldBalance = (wallet: GoldWallet): number => wallet.gold ?? 0;
export function canAfford(wallet: GoldWallet, amount: number): boolean {
  return validGold(amount) && validGold(goldBalance(wallet)) && goldBalance(wallet) >= amount;
}
/** Atomic operations shared by pickups and future shops. Failure never changes the wallet. */
export function creditGold(wallet: GoldWallet, amount: number): boolean {
  const balance = goldBalance(wallet);
  if (!validGold(amount) || !validGold(balance) || !validGold(balance + amount)) return false;
  wallet.gold = balance + amount;
  return true;
}
export function spendGold(wallet: GoldWallet, amount: number): boolean {
  if (!canAfford(wallet, amount)) return false;
  wallet.gold = goldBalance(wallet) - amount;
  return true;
}
