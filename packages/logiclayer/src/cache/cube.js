const {Client} = require("mondrian-rest-client"),
      PromiseThrottle = require("promise-throttle"),
      chalk = require("chalk"),
      d3Array = require("d3-array"),
      findYears = require("../utils/findYears"),
      readline = require("readline");

const throttle = new PromiseThrottle({
  requestsPerSecond: 10,
  promiseImplementation: Promise
});

const currentYear = new Date().getFullYear();

const {CANON_LOGICLAYER_CUBE} = process.env;

module.exports = async function() {

  if (!CANON_LOGICLAYER_CUBE) return {};

  const client = new Client(CANON_LOGICLAYER_CUBE);
  let count = 0, total = 0;

  /** */
  function memberQuery(cube) {

    const {preferred} = cube.yearDims;
    const levels = preferred.hierarchies[0].levels;

    return client.members(levels.find(d => d.name.includes("Year")))
      .then(members => {
        count++;
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        const years = members
          .map(d => (d.name = parseInt(d.name, 10), d))
          .filter(d => !isNaN(d.name))
          .sort((a, b) => a.name - b.name);
        const current = years.filter(d => d.name <= currentYear);
        const obj = {
          cube: cube.name,
          latest: current[current.length - 1].key,
          oldest: current[0].key,
          previous: current.length > 1 ? current[current.length - 2].key : current[current.length - 1].key,
          years: years.map(d => d.key)
        };
        process.stdout.write(`logiclayer: cube (${count} of ${total} year queries complete)`);
        return obj;
      })
      .catch(err => {
        console.error(chalk`{bold.red Error} {bold [logiclayer - year cache]} ${cube.name} {italic.green (${err.status ? `${err.status} - ` : ""}${err.message})}`);
        return false;
      });

  }

  const cubes = await client.cubes()
    .catch(err => {
      console.error(chalk`{bold.red Error} {bold [logiclayer - year cache]} client.cubes() {italic.green (${err.status ? `${err.status} - ` : ""}${err.message})}`);
      return [];
    });

  const measures = {};
  cubes.forEach(cube => {

    cube.measures.forEach(measure => {

      const name = measure.name
        .replace(/'/g, "\'");

      if (!measures[name]) measures[name] = {...measure, cubes: []};

      const dimensions = cube.dimensions
        .reduce((acc, d) => {
          let hierarchies = d.hierarchies
            .map(h => {
              const levels = h.levels
                .filter(d => d.name !== "(All)")
                .map(l => {
                  const parts = l.fullName
                    .split(".")
                    .map(p => p.replace(/^\[|\]$/g, ""));
                  if (parts.length === 2) parts.unshift(parts[0]);
                  return {
                    dimension: parts[0],
                    hierarchy: parts[1],
                    level: parts[2],
                    caption: l.caption !== parts[2] ? l.caption : null,
                    dimensionType: d.dimensionType,
                    properties: l.properties,
                    annotations: d.annotations
                  };
                });
              return levels;
            });
          hierarchies = Array.from(new Set(d3Array.merge(hierarchies)));
          acc[d.name] = hierarchies;
          return acc;
        }, {});

      measures[name].cubes.push({
        annotations: cube.annotations,
        dimensions,
        name: cube.name
      });

    });

  });

  const cubeQueries = cubes
    .filter(cube => {
      const dims = findYears(cube.dimensions);
      if (!dims) return false;
      cube.yearDims = dims;
      return cube;
    })
    .map(cube => throttle.add(memberQuery.bind(this, cube)));

  total = cubeQueries.length;

  return Promise.all(cubeQueries)
    .then(rawYears => {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      const years = rawYears.filter(d => d)
        .reduce((obj, d) => (obj[d.cube] = d, obj), {});

      return {client, measures, years};

    });

};
