const DEPOSIT_CATEGORIES = ["REGULATED_TRUST_ACCOUNTS", "TERM_DEPOSITS",
  "TRANS_AND_SAVINGS_ACCOUNTS", "TRAVEL_CARDS"];

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
 * Fetch the dictionary collection from the firestore database
 * @param {FirebaseFirestore.Firestore} db Firestore database
 */
exports.fetchDictionary = async (db) => {
  const dictionaryQuerySnapshot = await db.collection("_dictionary").get();
  const dictionary = dictionaryQuerySnapshot.docs.map((x) => x.data());
  return dictionary;
};
