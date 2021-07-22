const DEPOSIT_CATEGORIES = ["REGULATED_TRUST_ACCOUNTS", "TERM_DEPOSITS",
  "TRANS_AND_SAVINGS_ACCOUNTS", "TRAVEL_CARDS"];

/**
 * Determine whether a given category is of a "Lending" or "Deposit" type
 * @param {string} category
 * @return {string} "Lending" or "Deposit"
 */
exports.parseCategoryType = (category) =>
  DEPOSIT_CATEGORIES.findIndex((c) => c === category) >= 0 ?
    "Deposit" : "Lending";
