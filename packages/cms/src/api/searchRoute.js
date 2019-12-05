const sequelize = require("sequelize");
const yn = require("yn");
const d3Array = require("d3-array");
const {strip} = require("d3plus-text");

const verbose = yn(process.env.CANON_CMS_LOGGING);
let Base58, flickr, sharp, storage;
if (process.env.FLICKR_API_KEY) {
  const Flickr = require("flickr-sdk");
  flickr = new Flickr(process.env.FLICKR_API_KEY);
  const {Storage} = require("@google-cloud/storage");
  storage = new Storage();
  sharp = require("sharp");
  Base58 = require("base58");
}
const axios = require("axios");

const validLicenses = ["4", "5", "7", "8", "9", "10"];
const validLicensesString = validLicenses.join();
const bucket = process.env.CANON_CONST_STORAGE_BUCKET;

const catcher = e => {
  if (verbose) {
    console.error("Error in searchRoute: ", e);
  }
  return [];
};

const splashWidth = Number(process.env.CANON_CONST_IMAGE_SPLASH_WIDTH) || 1400;
const thumbWidth = Number(process.env.CANON_CONST_IMAGE_THUMB_WIDTH) || 400;

module.exports = function(app) {

  const {db, cache} = app.settings;

  app.get("/api/isImageEnabled", async(req, res) => res.json(Boolean(flickr)));

  app.post("/api/image/update", async(req, res) => {
    if (!flickr) return res.json({error: "Flickr API Key not configured"});
    const {contentId} = req.body;
    let {id, shortid} = req.body;
    if (id && !shortid) shortid = Base58.int_to_base58(id);
    if (!id && shortid) id = Base58.base58_to_int(shortid);
    const url = `https://flic.kr/p/${shortid}`;
    const info = await flickr.photos.getInfo({photo_id: id}).then(resp => resp.body).catch(catcher);
    if (info) {
      if (validLicenses.includes(info.photo.license)) {
        const searchRow = await db.search.findOne({where: {contentId}}).catch(catcher);
        const imageRow = await db.image.findOne({where: {url}}).catch(catcher);
        if (searchRow) {
          if (imageRow) {
            await db.search.update({imageId: imageRow.id}, {where: {contentId}}).catch(catcher);
          }
          else {
            if (!bucket) {
              if (verbose) console.error("CANON_CONST_STORAGE_BUCKET not configured, failed to update image");
            }
            else {
              // To add a new image, first fetch the image data
              const sizeObj = await flickr.photos.getSizes({photo_id: id}).then(resp => resp.body).catch(catcher);
              let image = sizeObj.sizes.size.find(d => parseInt(d.width, 10) >= 1600);
              if (!image) image = sizeObj.sizes.size.find(d => parseInt(d.width, 10) >= 1000);
              if (!image) image = sizeObj.sizes.size.find(d => parseInt(d.width, 10) >= 500);
              if (!image || !image.source) {
                return res.json({error: "Flickr Source Error, try another image."});
              }
              const imageData = await axios.get(image.source, {responseType: "arraybuffer"}).then(d => d.data).catch(catcher);

              // Then add a row to the image table with the metadata.
              const payload = {
                url,
                author: info.photo.owner.realname || info.photo.owner.username,
                license: info.photo.license
              };
              const newImage = await db.image.create(payload).catch(catcher);
              await db.search.update({imageId: newImage.id}, {where: {contentId}}).catch(catcher);            
              
              // Finally, upload splash and thumb version to google cloud.
              const configs = [
                {type: "splash", res: splashWidth}, 
                {type: "thumb", res: thumbWidth}
              ];
              for (const config of configs) {
                const buffer = await sharp(imageData).resize(config.res).toBuffer().catch(catcher);
                const file = `/${config.type}/${newImage.id}.jpg`;
                const options = {metadata: {contentType: "image/jpeg"}};
                await storage.bucket(bucket).file(file).save(buffer, options).catch(catcher);
                await storage.bucket(bucket).file(file).makePublic().catch(catcher);
              }
            }
          }
          const newRow = await db.search.findOne({
            where: {contentId},
            include: [
              {model: db.image, include: [{association: "content"}]}, {association: "content"}
            ]
          }).catch(catcher);
          return res.json(newRow);
        }
        else {
          return res.json("Error updating Search");
        }
      }
      else {
        return res.json({error: "Bad License"});
      }
    }
    else {
      return res.json({error: "Malformed URL"});
    }
  });

  app.get("/api/cubeData", (req, res) => {
    res.json(cache.cubeData).end();
  });

  app.get("/api/flickr/search", async(req, res) => {
    if (!flickr) return res.json({error: "Flickr API Key not configured"});
    const {q} = req.query;
    const result = await flickr.photos.search({
      text: q, 
      license: validLicensesString,
      sort: "relevance"
    }).then(resp => resp.body).catch(catcher);
    const photos = result.photos.photo;
    const payload = [];
    for (const photo of photos) {
      const sizeObj = await flickr.photos.getSizes({photo_id: photo.id}).then(resp => resp.body).catch(catcher);
      const small = sizeObj.sizes.size.find(d => d.label === "Small 320");
      if (small) {
        payload.push({
          id: photo.id,
          source: small.source
        });  
      }
    }
    return res.json(payload);
  });

  app.post("/api/image_content/update", async(req, res) => {
    const {id, locale} = req.body;
    const defaults = req.body;
    const [row, created] = await db.image_content.findOrCreate({where: {id, locale}, defaults}).catch(catcher);
    if (created) {
      res.json(created);
    }
    else {
      row.updateAttributes(defaults).catch(catcher);
      res.json(row);
    }
  });

  app.post("/api/search/update", async(req, res) => {
    const {id, locale} = req.body;
    const update = await db.search_content.update(req.body, {where: {id, locale}}).catch(catcher);
    res.json(update);
  });

  app.get("/api/newsearch", async(req, res) => {

    let {limit = "10"} = req.query;
    limit = parseInt(limit, 10);

    const locale = req.query.locale || process.env.CANON_LANGUAGE_DEFAULT || "en";

    const index = app.settings.cache.searchIndex.index[locale];
    const rows = app.settings.cache.searchIndex.rows[locale];

    const {id, q, dimension, levels} = req.query;

    let results = [];

    if (id) {
      let data = d3Array.merge(id.split(",").map(x => Object.values(rows).filter(d => d.id === x)));
      if (dimension) data = data.filter(d => d.dimension === dimension);
      if (levels) data = data.filter(d => levels.split(",").includes(d.hierarchy));
      data = data.sort((a, b) => b.zvalue - a.zvalue);
      results = data.slice(0, limit);
    }
    else if (!q) {
      let data = Object.values(rows);
      if (dimension) data = data.filter(d => d.dimension === dimension);
      if (levels) data = data.filter(d => levels.split(",").includes(d.hierarchy));
      data = data.sort((a, b) => b.zvalue - a.zvalue);
      results = data.slice(0, limit);
    }
    else {
      const query = strip(q);
      let searchQuery = query
        .replace(/([A-z]{2,})/g, txt => `+${txt}`)
        .replace(/(.)$/g, txt => `${txt}*`);

      if (dimension) searchQuery = `${dimension.split(" ").map(d => `+dimension:${d}`).join(" ")} ${searchQuery}`;                    
      if (levels) {
        // TODO: this splitting of multiple hierarchies doesn't work
        levels.split(",").forEach(hierarchy => {
          searchQuery = `${hierarchy.split(" ").map(d => `+hierarchy:${d}`).join(" ")} ${searchQuery}`;
        });
      }

      const searchResults = index.search(searchQuery)
        .map(d => {

          const data = rows[d.ref];
          const keywords = data.keywords || [];
          const name = strip(data.name);
          const zvalue = data.zvalue;
          const zscore = zvalue * 0.15;

          let score = d.score;
          const diffMod = query.length / name.length;
          if (name === query || keywords.includes(query)) score = 1000000;
          else if (name.startsWith(query)) score *= 20 * diffMod;
          else if (query.startsWith(name.slice(0, 10))) score *= 10 * diffMod;
          else if (query.startsWith(name.slice(0, 5))) score *= 5 * diffMod;
          data.score = score * 7.5 + zscore * 3.1;
          return data;

        });

      results = searchResults.sort((a, b) => b.score - a.score).slice(0, limit);        
    }

    return res.json({
      results,
      query: {dimension, id, limit, q}
    });

  });

  app.get("/api/search", async(req, res) => {

    const where = {};

    let {limit = "10"} = req.query;
    limit = parseInt(limit, 10);

    const locale = req.query.locale || process.env.CANON_LANGUAGE_DEFAULT || "en";

    const {id, q, dimension, levels} = req.query;

    let rows = [];

    if (id) {
      where.id = id.includes(",") ? id.split(",") : id;
      if (dimension) where.dimension = dimension;
      if (levels) where.hierarchy = levels.split(",");
      rows = await db.search.findAll({
        where,
        include: [{model: db.image, include: [{association: "content"}]}, {association: "content"}]
      });
    } 
    else {
      const searchWhere = {};
      if (q) {
        if (locale === "all") {
          where[sequelize.Op.or] = [
            {name: {[sequelize.Op.iLike]: `%${q}%`}},
            {keywords: {[sequelize.Op.overlap]: [q]}}
            // Todo - search attr and imagecontent for query
          ];
        }
        else {
          where[sequelize.Op.or] = [
            {name: {[sequelize.Op.iLike]: `%${q}%`}},
            {keywords: {[sequelize.Op.overlap]: [q]}}
          ];
          where.locale = locale;
        }
        rows = await db.search_content.findAll({where}).catch(catcher);
        searchWhere.contentId = Array.from(new Set(rows.map(r => r.id)));
      }
      if (dimension) searchWhere.dimension = dimension;
      // In sequelize, the IN statement is implicit (hierarchy: ['Division', 'State'])
      if (levels) searchWhere.hierarchy = levels.split(",");
      rows = await db.search.findAll({
        include: [{model: db.image, include: [{association: "content"}]}, {association: "content"}],
        limit,
        order: [["zvalue", "DESC"]],
        where: searchWhere
      });
    }

    // MetaEditor.jsx makes use of this endpoint, but needs ALL locale content. If locale="all" is set,
    // Forget about the ensuing sanitazation/prep for front-end searches and just return the raw rows for manipulation in the CMS.
    if (locale === "all") {
      return res.json(rows);
    }

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

    const results = rows.map(d => {
      d = d.toJSON();
      const result = {
        dimension: d.dimension,
        hierarchy: d.hierarchy,
        id: d.id,
        image: d.image,
        profile: slugs[d.dimension],
        slug: d.slug,
        stem: d.stem === 1
      };
      const defCon = d.content.find(c => c.locale === locale);
      if (defCon) {
        result.name = defCon.name;
        result.keywords = defCon.keywords;
        result.attr = defCon.attr;
      }
      return result;
    });

    return res.json({
      results,
      query: {dimension, id, limit, q}
    });

  });

};
