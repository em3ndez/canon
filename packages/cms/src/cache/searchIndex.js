const lunr = require("lunr");
const {strip} = require("d3plus-text");
const yn = require("yn");

const verbose = yn(process.env.CANON_CMS_LOGGING);

const abbreviations = {
  en: [
    ["ft", "fort"],
    ["jct", "junction"],
    ["mdw", "meadow"],
    ["mt", "mount"],
    ["mtn", "mountain"],
    ["pt", "point"],
    ["st", "saint"]
  ],
  es: []
};

const catcher = e => {
  if (verbose) console.error("Error in searchIndex.js: ", e);
  return [];
};

const localeDefault = process.env.CANON_LANGUAGE_DEFAULT || "en";
const LOCALES = process.env.CANON_LANGUAGES ? process.env.CANON_LANGUAGES.split(",") : [localeDefault];
if (!LOCALES.includes(localeDefault)) LOCALES.push(localeDefault);

module.exports = async function(app) {

  const {db} = app;

  const cache = {
    rows: {},
    index: {}
  };

  for (const locale of LOCALES) {

    let rows = await db.search.findAll({include: [{model: db.image, include: [{association: "content"}]}, {association: "content"}]}).catch(catcher);
    rows = rows.map(row => {
      row = row.toJSON();
      // Bubble up content to top-level object.
      const content = row.content.find(c => c.locale === locale);
      if (content) {
        row.name = content.name;
        row.keywords = content.keywords;
        row.attr = content.attr;
      }  
      delete row.content;
      return row;
    });
    
    /**
     * Note: The purpose of this slugs lookup object is so that in traditional, 1:1 cms sites,
     * We can translate a Dimension found in search results (like "Geography") into a slug 
     * (like "geo"). This is then passed along in the search result under the key "profile"
     * so that the search bar (in DataUSA, for example) can create a link out of it like
     * /profile/geo/Massachusetts. However, This will be insufficient for bivariate profiles, where
     * there will no longer be ONE single profile to which a search result pertains - a search
     * for "mass" could apply to both a geo and a geo_jobs (or wherever a geo Dimension is invoked)
     * Longer term, the "results" row below may need some new keys to more accurately depict the 
     * profiles to which each particular result may apply.
     */
    let meta = await db.profile_meta.findAll();
    meta = meta.map(m => m.toJSON());
    const slugs = {};
    meta.forEach(m => {
      if (!slugs[m.dimension]) slugs[m.dimension] = m.slug;
    });

    const results = rows
      .map(d => {

        const name = strip(d.name);

        const alts = name.split("-");
        abbreviations[locale].forEach(abbr => {
          if (alts.includes(abbr[0])) alts.push(abbr[1]);
          else if (alts.includes(abbr[1])) alts.push(abbr[0]);
        });

        return {
          alts,
          dimension: d.dimension,
          hierarchy: d.hierarchy,
          id: d.id,
          image: d.image,
          key: `${d.dimension}-${d.hierarchy}-${d.id}`,
          // search table unique multipart primary key
          keywords: d.keywords,
          name: d.name,
          profile: slugs[d.dimension],
          slug: d.slug,
          stem: d.stem === 1,
          zvalue: d.zvalue
        };
      });

    cache.rows[locale] = results.reduce((obj, d) => (obj[d.key] = d, obj), {})
    cache.index[locale] = lunr(function() {

      this.ref("key");
      this.field("keywords", {boost: 3});
      this.field("alts", {boost: 2});
      this.field("dimension");
      this.field("hierarchy");

      this.pipeline.reset();
      this.searchPipeline.reset();

      results.forEach(result => this.add(result, {boost: result.zvalue}));

    });
  }

  return cache;

};
