const DEPOSIT_CATEGORIES = ["REGULATED_TRUST_ACCOUNTS", "TERM_DEPOSITS",
  "TRANS_AND_SAVINGS_ACCOUNTS", "TRAVEL_CARDS"];
const FREQUENCIES = [
  {label: "P1Y", value: 1},
  {label: "P12M", value: 1},
  {label: "P1M", value: 12},
  {label: "P3M", value: 4},
  {label: "P4M", value: 3},
  {label: "P2M", value: 6},
  {label: "P6M", value: 2},
];

/**
 * Determine whether a given category is of a "Lending" or "Deposit" type
 * @param {string} category
 * @return {string} "Lending" or "Deposit"
 */
exports.parseCategoryType = (category) =>
  DEPOSIT_CATEGORIES.findIndex((c) => c === category) >= 0 ?
    "Deposit" : "Lending";

/**
 * Calculates the estimated annual cost of the product based on the fee structure
 * @param {Array} fees Product fees
 * @return {Array} The estimated annual cost, and any warning found during calculation
 */
exports.getTotalPeriodicFee = (fees) => {
  let totalPeriodicFee = 0;
  const warnings = [];
  const countedFeeNames = [];

  (fees || []).forEach((fee) => {
    const feeAmount = parseFloat(fee.amount || "0");

    if (fee.feeType === "PERIODIC") {
      const frequency = FREQUENCIES.filter((fq) => fq.label === fee.additionalValue);

      if (frequency.length > 0) {
        const hasNotCounted = countedFeeNames.indexOf(fee.name) < 0;

        if (hasNotCounted) {
          if (fee.amount) {
            totalPeriodicFee += feeAmount * frequency[0].value;
            countedFeeNames.push(fee.name);
          } else {
            const rateType = fee.balanceRate ? "balance" : fee.transactionRate ? "trasaction" : fee.accruedRate ? "accrued" : "unspecified";
            warnings.push(`${fee.name} is not a fixed amount and it is depending on ${rateType} rate`);
          }
        }
      } else {
        if (feeAmount > 0) {
          warnings.push(`Unable to infer the periodic fee value of ${fee.name}`);
        }
      }
    }
  });

  return [totalPeriodicFee, warnings];
};
