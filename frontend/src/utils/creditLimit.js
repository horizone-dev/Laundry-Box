export const checkCreditLimit = async (customerId, netIncrease, settings) => {
  if (!customerId || customerId === 'Walk-in') return { blocked: false };
  if (!settings.enableCreditLimitProtection) return { blocked: false };

  let currentOutstanding = 0;
  let creditLimit = settings.defaultCreditLimit ?? 500;
  let customerName = 'Customer';

  if (window.electronAPI?.dbQuery) {
    const custRes = await window.electronAPI.dbQuery(
      'SELECT name, balance, creditLimit FROM customers WHERE id = ?',
      [customerId]
    );
    if (custRes.success && custRes.data.length > 0) {
      customerName = custRes.data[0].name;
      currentOutstanding = custRes.data[0].balance || 0;
      if (custRes.data[0].creditLimit !== undefined && custRes.data[0].creditLimit !== null && custRes.data[0].creditLimit !== 0) {
        creditLimit = custRes.data[0].creditLimit;
      }
    }
  }

  const newOutstanding = currentOutstanding + netIncrease;

  if (newOutstanding > creditLimit) {
    const exceededAmount = newOutstanding - creditLimit;
    return {
      blocked: true,
      details: {
        customerId,
        customerName,
        creditLimit,
        currentOutstanding,
        orderAmount: netIncrease,
        newOutstanding,
        exceededAmount: Math.max(0, exceededAmount),
        overrideAllowed: true
      }
    };
  }

  return { blocked: false };
};
