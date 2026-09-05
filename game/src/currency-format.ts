const goldFormat = new Intl.NumberFormat('en-US');
/** Full, readable balances shared by the HUD and inventory. */
export const formatGold = (amount: number): string => goldFormat.format(Math.round(amount));
