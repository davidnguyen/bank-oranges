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

exports.group = (array, groupBy, valueReducer, seedValue, tagSelector) => {
  return array.reduce((accumulator, current) => {
    const groupName = current[groupBy];
    return accumulator.groups.findIndex((g) => g.name === groupName) >= 0 ?
      {groups: accumulator.groups.map((g) => g.name === groupName ? {...g, value: valueReducer(g.value, current)} : g)} :
      {groups: [...accumulator.groups, {name: groupName, value: valueReducer(seedValue, current), tag: tagSelector ? tagSelector(current) : ""}]};
  }, {groups: []}).groups;
};

/**
 * Determine whether a given category is of a "Lending" or "Deposit" type
 * @param {string} category
 * @return {string} "Lending" or "Deposit"
 */
exports.parseCategoryType = (category) =>
  DEPOSIT_CATEGORIES.findIndex((c) => c === category) >= 0 ?
    "Deposit" : "Lending";

/**
 * Calculates the indicative annual fee of the product based on the fee structure
 * @param {Array} fees Product fees
 * @return {Array} The indicative annual fee, and any warning found during calculation
 */
exports.calculateIndicativePeriodicFee = (fees) => {
  const factoringFees = (fees || [])
    .filter((f) => f.feeType === "PERIODIC")
    .filter((f) => parseFloat(f.amount || "0") > 0)
    .filter((f) => FREQUENCIES.findIndex((fr) => fr.label === f.additionalValue) >= 0);

  const factoringFeeGroups = this.group(
    factoringFees,
    "name",
    (accumulator, current) => Math.min(accumulator, parseFloat(current.amount || "0")),
    Number.MAX_VALUE,
    (current) => current.additionalValue,
  );

  const frequencyMultiplier = (frequency) => FREQUENCIES.find((fr) => fr.label === frequency).value;

  return [
    factoringFeeGroups.reduce((accumulator, current) => accumulator + current.value * frequencyMultiplier(current.tag), 0),
    factoringFeeGroups.map((group) => group.name),
  ];
};

/**
 * Calculates the inticative upfront fee of the product based on the fee structure
 * @param {Array} fees Product fees
 * @return {Array} The indicative upfront fee, and any warning found during calculation
 */
exports.calculateIndicativeUpfrontFee = (fees) => {
  const factoringFees = (fees || [])
    .filter((f) => f.feeType === "UPFRONT")
    .filter((f) => parseFloat(f.amount || "0") > 0);

  const factoringFeeGroups = this.group(
    factoringFees,
    "name",
    (accumulator, current) => Math.min(accumulator, parseFloat(current.amount || "0")),
    Number.MAX_VALUE,
  );

  return [
    factoringFeeGroups.reduce((accumulator, current) => accumulator + current.value, 0),
    factoringFeeGroups.map((group) => group.name),
  ];
};

/**
 * Calculates the inticative exit fee of the product based on the fee structure
 * @param {Array} fees Product fees
 * @return {Array} The indicative exit fee, and any warning found during calculation
 */
exports.calculateIndicativeExitFee = (fees) => {
  const factoringFees = (fees || [])
    .filter((f) => f.feeType === "EXIT")
    .filter((f) => parseFloat(f.amount || "0") > 0);

  const factoringFeeGroups = this.group(
    factoringFees,
    "name",
    (accumulator, current) => Math.min(accumulator, parseFloat(current.amount || "0")),
    Number.MAX_VALUE,
  );

  return [
    factoringFeeGroups.reduce((accumulator, current) => accumulator + current.value, 0),
    factoringFeeGroups.map((group) => group.name),
  ];
};
