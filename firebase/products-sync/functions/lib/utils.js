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
