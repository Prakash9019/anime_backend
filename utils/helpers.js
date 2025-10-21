// utils/helpers.js
module.exports = {
  parseSeason(dateStr) {
    const month = new Date(dateStr).getMonth() + 1;
    if (month <= 3) return 'WINTER';
    if (month <= 6) return 'SPRING';
    if (month <= 9) return 'SUMMER';
    return 'FALL';
  },
};
