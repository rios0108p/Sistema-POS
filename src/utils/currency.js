export const CURRENCY_SYMBOL = "$";

export const CURRENCY_CONFIG = {
  locale: "es-MX",
  currency: "MXN",
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat(
    CURRENCY_CONFIG.locale,
    {
      style: "currency",
      currency: CURRENCY_CONFIG.currency,
      minimumFractionDigits: 2,
    }
  ).format(amount);
};
