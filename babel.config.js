// babel-preset-expo は expo パッケージに同梱されているため、expo 経由で解決する
const preset = require.resolve('babel-preset-expo', { paths: [require.resolve('expo')] });

module.exports = function (api) {
  api.cache(true);
  return { presets: [preset] };
};
