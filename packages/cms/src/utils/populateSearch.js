const Client = require("@datawheel/olap-client").Client;
const MondrianDataSource = require("@datawheel/olap-client").MondrianDataSource;

const d3Array = require("d3-array");
const yn = require("yn");
const {strip} = require("d3plus-text");

const envLoc = process.env.CANON_LANGUAGE_DEFAULT || "en";
const verbose = yn(process.env.CANON_CMS_LOGGING);
const LANGUAGES = process.env.CANON_LANGUAGES ? process.env.CANON_LANGUAGES.split(",") : [envLoc];
if (!LANGUAGES.includes(envLoc)) LANGUAGES.push(envLoc);
// Put the default language first in the array. This ensures that slugs that are generated
// in populateSearch will be made from the default language content.
LANGUAGES.sort(a => a === envLoc ? -1 : 1);

const {CANON_CMS_CUBES} = process.env;

/**
 * There is not a fully-featured way for olap-client to know the difference between a 
 * Tesseract and a Mondrian Client. Tesseract is more modern/nice in its HTTP codes/responses,
 * so attempt Tesseract first, and on failure, assume mondrian. 
 */
const client = new Client();
Client.dataSourceFromURL(CANON_CMS_CUBES).then(
  datasource => {
    if (verbose) console.log(`Initializing Tesseract at ${CANON_CMS_CUBES}`);
    client.setDataSource(datasource);
  },
  err => {
    const ds = new MondrianDataSource(CANON_CMS_CUBES);
    client.setDataSource(ds);
    if (verbose) console.error(`Tesseract not detected: ${err.message}`);
    if (verbose) console.log(`Initializing Mondrian at ${CANON_CMS_CUBES}`);
  }
);


const catcher = e => {
  if (verbose) {
    console.error("Error in populateSearch: ", e.message);
  }
  return [];
};

const formatter = (members, data, dimension, level) => {

  const newData = members.reduce((arr, d) => {
    const obj = {};
    obj.id = `${d.key}`;
    obj.name = d.caption || d.name;
    obj.zvalue = data[obj.id] || 0;
    obj.dimension = dimension;
    obj.hierarchy = level;
    obj.stem = -1;
    arr.push(obj);
    return arr;
  }, []);
  const st = d3Array.deviation(newData, d => d.zvalue);
  const average = d3Array.median(newData, d => d.zvalue);
  newData.forEach(d => d.zvalue = (d.zvalue - average) / st);
  return newData;
};

const populateSearch = async(profileData, db) => {

  const cubeName = profileData.cubeName;
  const measure = profileData.measure;
  const dimension = profileData.dimName || profileData.dimension;
  const dimLevels = profileData.levels;

  const cube = await client.getCube(cubeName).catch(catcher);

  const levels = [];

  for (const hierarchy of cube.dimensionsByName[dimension].hierarchies) {
    for (const level of hierarchy.levels) {
      if (!levels.map(d => d.name).includes(level.name) && level.name !== "(All)" && dimLevels.includes(level.name)) levels.push(level);
    }
  }

  if (verbose) console.log("INITIATING SEARCH INGEST...");  

  for (const locale of LANGUAGES) {

    if (verbose) console.log(`Starting ingest for locale: ${locale}...`);

    let fullList = [];
    
    for (let i = 0; i < levels.length; i++) {

      const level = levels[i];
      const members = await client.getMembers(level, {locale}).catch(catcher);

      let data = [];

      const drilldown = {
        dimension,
        hierarchy: level.hierarchy.name,
        level: level.name
      };

      data = await client.execQuery(cube.query
        .addDrilldown(drilldown)
        .addMeasure(measure))
        .then(resp => resp.data)
        .then(data => data.reduce((obj, d) => {
          obj[d[`ID ${level.name}`] ? d[`ID ${level.name}`] : d[`${level.name} ID`]] = d[measure];
          return obj;
        }, {})).catch(catcher);

      fullList = fullList.concat(formatter(members, data, dimension, level.name));

    }

    if (verbose) console.log(`Fetched ${fullList.length} members from the cube.`);

    if (fullList.length > 0) {

      const slugs = await db.search.findAll().catch(catcher);
      const usedSlugs = {};
      slugs.forEach(s => {
        if (s.slug) usedSlugs[s.slug] = true;
      });

      const slugify = str => strip(str).replace(/-{2,}/g, "-").toLowerCase();

      if (verbose) console.log("Generating slugs...");
      // Add a generated slug to the write payload
      const searchList = fullList.map(member => ({slug: slugify(member.name), ...member}));
      if (verbose) console.log("Deduping slugs...");
      searchList.forEach(member => {
        usedSlugs[member.slug] ? member.slug = `${member.slug}-${member.id}` : usedSlugs[member.slug] = true;
      });
      if (verbose) console.log("Slug generation complete.");

      const searchInsertKeys = Object.keys(searchList[0]).filter(d => d !== "name");
      // On conflict (update), do not attempt to change the slug
      const searchUpdateKeys = searchInsertKeys.filter(d => d !== "slug");

      let searchQuery = `INSERT INTO canon_cms_search (${searchInsertKeys.join(", ")})\nVALUES `;
      searchList.forEach((obj, i) => {
        searchQuery += `${i ? "," : ""}\n(${searchInsertKeys.map(key => `\'${`${obj[key]}`.replace(/\'/g, "''")}\'`)})`;
      });
      searchQuery += `\nON CONFLICT (id, dimension, hierarchy)\nDO UPDATE SET (${searchUpdateKeys.join(", ")}) = (${searchUpdateKeys.map(key => `EXCLUDED.${key}`).join(", ")})\nRETURNING *;`;

      if (verbose) console.log("Upserting search table...");
      const [searchRows] = await db.query(searchQuery).catch(catcher);
      if (verbose) console.log(`Upserted ${searchRows.length} rows.`);

      const searchLookup = searchList.reduce((obj, d) => {
        obj[`${d.id}-${d.dimension}-${d.hierarchy}`] = d;
        return obj;
      }, {});
      
      const contentList = searchRows.map(member => {
        const original = searchLookup[`${member.id}-${member.dimension}-${member.hierarchy}`];
        return {name: original.name, id: member.contentId, locale};
      });

      const contentKeys = ["id", "locale", "name"];

      let contentQuery = `INSERT INTO canon_cms_search_content (${contentKeys.join(", ")})\nVALUES `;
      contentList.forEach((obj, i) => {
        contentQuery += `${i ? "," : ""}\n(${contentKeys.map(key => `\'${`${obj[key]}`.replace(/\'/g, "''")}\'`)})`;
      });
      contentQuery += `\nON CONFLICT (id, locale)\nDO UPDATE SET (${contentKeys.join(", ")}) = (${contentKeys.map(key => `EXCLUDED.${key}`).join(", ")})\nRETURNING *;`;

      if (verbose) console.log(`Upserting content table for ${locale}...`);
      const [contentRows] = await db.query(contentQuery).catch(catcher);
      if (verbose) console.log(`Upserted ${contentRows.length} content rows for locale: ${locale}.`);
    }
  }
  if (verbose) console.log("SEARCH INGEST COMPLETE");  
};

module.exports = populateSearch;