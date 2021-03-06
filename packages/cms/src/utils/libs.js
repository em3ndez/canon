const d3Array = require("d3-array"),
      d3Collection = require("d3-collection"),
      d3Format = require("d3-format"),
      d3TimeFormat = require("d3-time-format"),
      {formatAbbreviate} = require("d3plus-format"),
      {date} = require("d3plus-axis"),
      {assign, closest, merge} = require("d3plus-common"),
      {strip, titleCase} = require("d3plus-text"),
      stats = require("./stats");


module.exports = {
  d3: Object.assign({}, d3Array, d3Collection, d3Format, d3TimeFormat),
  d3plus: {assign, closest, date, formatAbbreviate, merge, strip, titleCase},
  stats
};
