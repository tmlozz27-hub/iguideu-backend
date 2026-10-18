export const AIRWALLEX_BENEFICIARY_UNIQUE_INDEX = {
  key: { "airwallex.beneficiaryId": 1 },
  options: {
    unique: true,
    partialFilterExpression: {
      "airwallex.beneficiaryId": { $type: "string" }
    },
    name: "airwallex_beneficiaryId_unique"
  }
};
