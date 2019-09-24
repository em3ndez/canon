const axios = require("axios");
const sequelize = require("sequelize");
const yn = require("yn");

const verbose = yn(process.env.CANON_CMS_LOGGING);
const envLoc = process.env.CANON_LANGUAGE_DEFAULT || "en";

const catcher = e => {
  if (verbose) {
    console.error("Error in searchRoute: ", e);
  }
  return [];
};

module.exports = function(app) {

  const {db} = app.settings;
  
  app.get("/api/image", async(req, res) => {
    const {slug, id, type, t} = req.query;
    let {dimension} = req.query;
    const size = req.query.size || "splash";
    const locale = req.query.locale || envLoc;
    const jsonError = () => res.json({error: "Not Found"});
    const imageError = () => res.sendFile(`${process.cwd()}/static/images/transparent.png`);
    if (!dimension) {
      const meta = await db.profile_meta.findOne({where: {slug}}).catch(catcher);
      if (!meta) return type === "json" ? jsonError() : imageError();  
      dimension = meta.dimension;
    }
    let member = await db.search.findOne({
      where: {dimension, [sequelize.Op.or]: {id, slug: id}},
      include: {model: db.image, include: [{association: "content"}]}
    }).catch(catcher);
    if (!member) return type === "json" ? jsonError() : imageError();
    member = member.toJSON();
    if (type === "json") {
      if (member.image && member.image.content) {
        const content = member.image.content.find(d => d.locale === locale);
        if (content) {
          member.image.meta = content.meta;
          delete member.image.content;
        }
      }
      return res.json(member);
    }
    else {
      const {imageId} = member;
      const bucket = process.env.CANON_CONST_STORAGE_BUCKET;
      if (imageId && bucket && ["splash", "thumb"].includes(size)) {
        let url = `https://storage.googleapis.com/${bucket}/${size}/${imageId}.jpg`;
        if (t) url += `?t=${t}`;
        const imgData = await axios.get(url, {responseType: "arraybuffer"}).then(resp => resp.data).catch(catcher);
        res.writeHead(200,  {"Content-Type": "image/jpeg"});
        return res.end(imgData, "binary");
      }
      else {
        return imageError();
      }
    }
  });

};
