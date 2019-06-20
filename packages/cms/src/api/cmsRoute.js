const MondrianClient = require("mondrian-rest-client").Client;
const TesseractClient = require("@datawheel/tesseract-client").Client;
const collate = require("../utils/collate");
const d3Array = require("d3-array");
const sequelize = require("sequelize");
const shell = require("shelljs");
const yn = require("yn");
const path = require("path");
const Op = sequelize.Op;

const envLoc = process.env.CANON_LANGUAGE_DEFAULT || "en";
const verbose = yn(process.env.CANON_CMS_LOGGING);

const {CANON_CMS_CUBES} = process.env;

let isTesseract = false;
let client = new TesseractClient(CANON_CMS_CUBES);
client.checkStatus().then(resp => {
  if (resp && resp.status === "ok") {
    isTesseract = true;
    if (verbose) console.log(`Initializing Tesseract at ${CANON_CMS_CUBES}`);
  }
  else {
    if (verbose) console.log(`Initializing Mondrian at ${CANON_CMS_CUBES}`);
    client = new MondrianClient(CANON_CMS_CUBES);  
  }
}, e => {
  // On tesseract status failure, assume mondrian.
  if (verbose) console.error(`Tesseract Failed to connect with error: ${e}`);
  if (verbose) console.log(`Initializing Mondrian at ${CANON_CMS_CUBES}`);
  client = new MondrianClient(CANON_CMS_CUBES);  
}
);

const topicTypeDir = path.join(__dirname, "../components/topics/");

const cmsCheck = () => process.env.NODE_ENV === "development" || yn(process.env.CANON_CMS_ENABLE);

const isEnabled = (req, res, next) => {
  if (cmsCheck()) return next();
  return res.status(401).send("Not Authorized");
};

const catcher = e => {
  if (verbose) {
    console.error("Error in cmsRoute: ", e);
  }
  return [];
};

const profileReqTreeOnly = {
  attributes: ["id", "ordering"],
  include: [
    {association: "meta"},
    {   
      association: "topics", attributes: ["id", "slug", "ordering", "profile_id", "type"], 
      include: [
        {association: "content", attributes: ["id", "lang", "title"]}
      ]
    }
  ]
};

const storyReqTreeOnly = {
  attributes: ["id", "slug", "ordering"],
  include: [
    {association: "content", attributes: ["id", "lang", "title"]},
    {association: "storytopics", attributes: ["id", "slug", "ordering", "story_id", "type"],
      include: [{association: "content", attributes: ["id", "lang", "title"]}]
    }
  ]
};

const formatterReqTreeOnly = {
  attributes: ["id", "name"]
};

const profileReqProfileOnly = {
  include: [
    {association: "meta"},
    {association: "content"},
    {association: "generators", attributes: ["id", "name"]},
    {association: "materializers", attributes: ["id", "name", "ordering"]}
  ]
};

const profileReqToolbox = {
  include: [
    {association: "meta"},
    {association: "content"},
    {association: "generators", attributes: ["id", "name"]},
    {association: "materializers", attributes: ["id", "name", "ordering"]}
  ]
};

const storyReqStoryOnly = {
  include: [
    {association: "content"},
    {association: "authors", attributes: ["id", "ordering"]},
    {association: "descriptions", attributes: ["id", "ordering"]},
    {association: "footnotes", attributes: ["id", "ordering"]}
  ]
};

const topicReqTopicOnly = {
  include: [
    {association: "content"},
    {association: "subtitles", attributes: ["id", "ordering"]},
    {association: "descriptions", attributes: ["id", "ordering"]},
    {association: "visualizations", attributes: ["id", "ordering"]},
    {association: "stats", attributes: ["id", "ordering"]},
    {association: "selectors"}
  ]
};

const storyTopicReqStoryTopicOnly = {
  include: [
    {association: "content"},
    {association: "subtitles", attributes: ["id", "ordering"]},
    {association: "descriptions", attributes: ["id", "ordering"]},
    {association: "visualizations", attributes: ["id", "ordering"]},
    {association: "stats", attributes: ["id", "ordering"]}
  ]
};

/**
 * API paths are dynamically generated by folding over this list in the get/post methods that follow.
 * IMPORTANT: When new tables are added to the CMS, adding their exact tablename to this list will
 * automatically generate Create, Update, and Delete Routes (as specified later in the get/post methods)
 */
const cmsTables = [
  "author", "formatter", "generator", "materializer", "profile", "profile_meta",
  "selector", "story", "story_description", "story_footnote", "storytopic",
  "storytopic_description", "storytopic_stat", "storytopic_subtitle", "storytopic_visualization",
  "topic", "topic_description", "topic_stat", "topic_subtitle", "topic_visualization"
];

/**
 * Some tables are translated to different languages using a corresponding "content" table, like "profile_content".
 * As such, some of the following functions need to take compound actions, e.g., insert a metadata record into 
 * profile, THEN insert the "real" data into "profile_content." This list (subset of cmsTables) represents those
 * tables that need corresponding _content updates.
 */

const contentTables = [
  "author", "profile", "story", "story_description", "story_footnote", "storytopic", "storytopic_description", 
  "storytopic_stat", "storytopic_subtitle", "topic", "topic_description", "topic_stat", "topic_subtitle"
];

const sorter = (a, b) => a.ordering - b.ordering;

/**
 * Due to yet-unreproducible edge cases, sometimes elements lose their ordering. 
 * This function sorts an array, then checks if the "ordering" property lines up 
 * with the element's place in the array. If not, "patch" the element and send it back
 * to the client, and asynchronously send an update to the db to match it.
 */
const flatSort = (conn, array) => {
  if (!array) return [];
  array.sort(sorter).map((o, i) => {
    if (o.ordering !== i) {
      o.ordering = i;
      conn.update({ordering: i}, {where: {id: o.id}});
    }
    return o;
  });
  return array;
};


// Using nested ORDER BY in the massive includes is incredibly difficult so do it manually here. todo: move it up to the query.
const sortProfileTree = (db, profiles) => {
  profiles = profiles.map(p => p.toJSON());
  profiles = flatSort(db.profile, profiles);
  profiles.forEach(p => {
    p.meta = flatSort(db.profile_meta, p.meta);
    p.topics = flatSort(db.topic, p.topics);
  });
  return profiles;
};

const sortStoryTree = (db, stories) => {
  stories = stories.map(s => s.toJSON());
  stories = flatSort(db.story, stories);
  stories.forEach(s => {
    s.storytopics = flatSort(db.storytopic, s.storytopics);
  });
  return stories;
};

const sortProfile = (db, profile) => {
  profile.meta = flatSort(db.profile_meta, profile.meta);
  profile.materializers = flatSort(db.materializer, profile.materializers);
  return profile;
};

const sortStory = (db, story) => {
  story = story.toJSON();
  story.descriptions = flatSort(db.story_description, story.descriptions);
  story.footnotes = flatSort(db.story_footnote, story.footnotes);
  story.authors = flatSort(db.author, story.authors);
  return story;
};

const sortTopic = (db, topic) => {
  topic = topic.toJSON();
  topic.subtitles = flatSort(db.topic_subtitle, topic.subtitles);
  topic.visualizations = flatSort(db.topic_visualization, topic.visualizations);
  topic.stats = flatSort(db.topic_stat, topic.stats);
  topic.descriptions = flatSort(db.topic_description, topic.descriptions);
  topic.selectors = flatSort(db.selector, topic.selectors);
  return topic;
};

const sortStoryTopic = (db, storytopic) => {
  storytopic = storytopic.toJSON();
  storytopic.subtitles = flatSort(db.storytopic_subtitle, storytopic.subtitles);
  storytopic.visualizations = flatSort(db.storytopic_visualization, storytopic.visualizations);
  storytopic.stats = flatSort(db.storytopic_stat, storytopic.stats);
  storytopic.descriptions = flatSort(db.storytopic_description, storytopic.descriptions);
  return storytopic;
};

const formatter = (members, data, dimension, level) => {

  const newData = members.reduce((arr, d) => {
    const obj = {};
    obj.id = `${d.key}`;
    obj.name = d.name;
    obj.display = d.caption || d.name;
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

const pruneSearch = async(dimension, levels, db) => {
  const currentMeta = await db.profile_meta.findAll().catch(catcher);
  const currentDimensions = currentMeta.map(m => m.dimension);
  // To be on the safe side, only clear the search table of dimensions that NO remaining
  // profiles are currently making use of.
  // Don't need to prune levels - they will be filtered automatically in searches.
  // If it gets unwieldy in size however, an optimization could be made here
  if (!currentDimensions.includes(dimension)) {
    const resp = await db.search.destroy({where: {dimension}}).catch(catcher);
    if (verbose) console.log(`Cleaned up search data. Rows affected: ${resp}`);
  }
  else {
    if (verbose) console.log(`Skipped search cleanup - ${dimension} is still in use`);
  }
};

const populateSearch = async(profileData, db) => {

  const cubeName = profileData.cubeName;
  const measure = profileData.measure;
  const dimension = profileData.dimName || profileData.dimension;
  const dimLevels = profileData.levels;

  const cube = await client.cube(cubeName).catch(catcher);

  const levels = cube.dimensionsByName[dimension].hierarchies[0].levels
    .filter(l => l.name !== "(All)" && dimLevels.includes(l.name));

  let fullList = [];
  for (let i = 0; i < levels.length; i++) {

    const level = levels[i];
    const members = await client.members(level).catch(catcher);

    let data = [];

    if (isTesseract) {
      data = await client.execQuery(cube.query
        .addDrilldown(`${dimension}.${level.hierarchy.name}.${level.name}`)
        .addMeasure(measure), "jsonrecords")
        .then(resp => resp.data)
        .then(data => data.reduce((obj, d) => {
          obj[d[`${level.name} ID`]] = d[measure];
          return obj;
        }, {})).catch(catcher);
    }
    else {
      data = await client.query(cube.query
        .drilldown(dimension, level.hierarchy.name, level.name)
        .measure(measure), "jsonrecords")
        .then(resp => resp.data.data)
        .then(data => data.reduce((obj, d) => {
          obj[d[`ID ${level.name}`]] = d[measure];
          return obj;
        }, {})).catch(catcher);
    }

    fullList = fullList.concat(formatter(members, data, dimension, level.name));

  }

  for (let i = 0; i < fullList.length; i++) {
    const obj = fullList[i];
    const {id, dimension, hierarchy} = obj;
    const [row, created] = await db.search.findOrCreate({
      where: {id, dimension, hierarchy},
      defaults: obj
    }).catch(catcher);
    if (verbose && created) console.log(`Created: ${row.id} ${row.display}`);
    else {
      await row.updateAttributes(obj).catch(catcher);
      if (verbose) console.log(`Updated: ${row.id} ${row.display}`);
    }
  }

};

module.exports = function(app) {

  const {db} = app.settings;

  app.get("/api/cms", (req, res) => res.json(cmsCheck()));

  /* GETS */

  app.get("/api/cms/tree", async(req, res) => {
    let profiles = await db.profile.findAll(profileReqTreeOnly).catch(catcher);
    profiles = sortProfileTree(db, profiles);
    return res.json(profiles);
  });

  app.get("/api/cms/toolbox/:id", async(req, res) => {
    const {id} = req.params;
    const reqObj = Object.assign({}, profileReqToolbox, {where: {id}});
    let profile = await db.profile.findOne(reqObj).catch(catcher);
    profile = profile.toJSON();
    profile.formatters = await db.formatter.findAll(formatterReqTreeOnly);
    res.json(profile);
  });

  app.get("/api/cms/storytree", async(req, res) => {
    let stories = await db.story.findAll(storyReqTreeOnly).catch(catcher);
    stories = sortStoryTree(db, stories);
    return res.json(stories);
  });

  app.get("/api/cms/profile/get/:id", async(req, res) => {
    const {id} = req.params;
    const dims = collate(req.query);
    const reqObj = Object.assign({}, profileReqProfileOnly, {where: {id}});
    let profile = await db.profile.findOne(reqObj).catch(catcher);
    profile = profile.toJSON();
    // Create a lookup object of the search rows, of the
    // pattern (id/id1),id2,id3, so that unary profiles can access it without an integer.
    let attr = {};
    for (let i = 0; i < dims.length; i++) {
      const dim = dims[i];
      const thisSlug = profile.meta.find(d => d.slug === dim.slug);
      const levels = thisSlug ? thisSlug.levels : [];
      let thisAttr = await db.search.findOne({where: {[sequelize.Op.and]: [{id: dim.id}, {hierarchy: {[sequelize.Op.in]: levels}}]}}).catch(catcher);
      thisAttr = thisAttr ? thisAttr.toJSON() : {};
      if (i === 0) attr = Object.assign(attr, thisAttr);
      Object.keys(thisAttr).forEach(key => {
        attr[`${key}${i + 1}`] = thisAttr[key];
      });
    }
    profile.attr = attr;
    return res.json(sortProfile(db, profile));
  });

  app.get("/api/cms/story/get/:id", async(req, res) => {
    const {id} = req.params;
    const reqObj = Object.assign({}, storyReqStoryOnly, {where: {id}});
    const story = await db.story.findOne(reqObj).catch(catcher);
    return res.json(sortStory(db, story));
  });

  app.get("/api/cms/topic/get/:id", async(req, res) => {
    const {id} = req.params;
    const reqObj = Object.assign({}, topicReqTopicOnly, {where: {id}});
    let topic = await db.topic.findOne(reqObj).catch(catcher);
    const topicTypes = [];
    shell.ls(`${topicTypeDir}*.jsx`).forEach(file => {
      // In Windows, the shell.ls command returns forward-slash separated directories,
      // but the node "path" command returns backslash separated directories. Flip the slashes
      // so the ensuing replace operation works (this should be a no-op for *nix/osx systems)
      const topicTypeDirFixed = topicTypeDir.replace(/\\/g, "/");
      const compName = file.replace(topicTypeDirFixed, "").replace(".jsx", "");
      topicTypes.push(compName);
    });
    topic = sortTopic(db, topic);
    topic.types = topicTypes;
    return res.json(topic);
  });

  app.get("/api/cms/storytopic/get/:id", async(req, res) => {
    const {id} = req.params;
    const reqObj = Object.assign({}, storyTopicReqStoryTopicOnly, {where: {id}});
    let storytopic = await db.storytopic.findOne(reqObj).catch(catcher);
    const topicTypes = [];
    shell.ls(`${topicTypeDir}*.jsx`).forEach(file => {
      const compName = file.replace(topicTypeDir, "").replace(".jsx", "");
      topicTypes.push(compName);
    });
    storytopic = sortStoryTopic(db, storytopic);
    storytopic.types = topicTypes;
    return res.json(storytopic);
  });

  // Top-level tables have their own special gets, so exclude them from the "simple" gets
  const getList = cmsTables.filter(tableName =>
    !["profile", "topic", "story", "storytopic"].includes(tableName)
  );

  getList.forEach(ref => {
    app.get(`/api/cms/${ref}/get/:id`, async(req, res) => {
      if (contentTables.includes(ref)) {
        const u = await db[ref].findOne({where: {id: req.params.id}, include: {association: "content"}}).catch(catcher);
        return res.json(u);
      }
      else {
        const u = await db[ref].findOne({where: {id: req.params.id}}).catch(catcher);
        return res.json(u);
      }
    });
  });

  /* INSERTS */
  // For now, all "create" commands are identical, and don't need a filter (as gets do above), so we may use the whole list.
  const newList = cmsTables;
  newList.forEach(ref => {
    app.post(`/api/cms/${ref}/new`, isEnabled, async(req, res) => {
      // First, create the metadata object in the top-level table
      const newObj = await db[ref].create(req.body).catch(catcher);
      // For a certain subset of translated tables, we need to also insert a new, corresponding english content row.
      if (contentTables.includes(ref)) {
        const payload = Object.assign({}, req.body, {id: newObj.id, lang: envLoc});
        await db[`${ref}_content`].create(payload).catch(catcher);
        const fullObj = await db[ref].findOne({where: {id: newObj.id}, include: [{association: "content"}]}).catch(catcher);
        return res.json(fullObj);
      }
      else {
        return res.json(newObj);
      }
    });
  });

  app.post("/api/cms/profile/newScaffold", isEnabled, async(req, res) => {
    const profile = await db.profile.create(req.body).catch(catcher);
    await db.profile_content.create({id: profile.id, lang: envLoc}).catch(catcher);
    const topic = await db.topic.create({ordering: 0, profile_id: profile.id});
    await db.topic_content.create({id: topic.id, lang: envLoc}).catch(catcher);
    let profiles = await db.profile.findAll(profileReqTreeOnly).catch(catcher);
    profiles = sortProfileTree(db, profiles);
    return res.json(profiles);
  });

  app.post("/api/cms/profile/addDimension", isEnabled, async(req, res) => {
    const profileData = req.body;
    profileData.dimension = profileData.dimName;
    await db.profile_meta.create(profileData);
    let profiles = await db.profile.findAll(profileReqTreeOnly).catch(catcher);
    profiles = sortProfileTree(db, profiles);
    populateSearch(profileData, db);
    return res.json(profiles);
  });

  app.post("/api/cms/repopulateSearch", isEnabled, async(req, res) => {
    const {id} = req.body;
    let profileData = await db.profile_meta.findOne({where: {id}});
    profileData = profileData.toJSON();
    await populateSearch(profileData, db);
    return res.json({});
  });



  /* UPDATES */
  // For now, all "update" commands are identical, and don't need a filter (as gets do above), so we may use the whole list.
  const updateList = cmsTables;
  updateList.forEach(ref => {
    app.post(`/api/cms/${ref}/update`, isEnabled, async(req, res) => {
      const o = await db[ref].update(req.body, {where: {id: req.body.id}}).catch(catcher);
      if (contentTables.includes(ref) && req.body.content) {
        req.body.content.forEach(async content => {
          await db[`${ref}_content`].upsert(content, {where: {id: req.body.id, lang: content.lang}}).catch(catcher);
        });
      }
      return res.json(o);
    });
  });

  /* DELETES */
  /**
   * To streamline deletes, this list contains objects with two properties. "elements" refers to the tables to be modified,
   * and "parent" refers to the foreign key that need be referenced in the associated where clause.
   */
  const deleteList = [
    {elements: ["author", "story_description", "story_footnote"], parent: "story_id"},
    {elements: ["topic_subtitle", "topic_description", "topic_stat", "topic_visualization"], parent: "topic_id"},
    {elements: ["storytopic_subtitle", "storytopic_description", "storytopic_stat", "storytopic_visualization"], parent: "storytopic_id"}
  ];

  deleteList.forEach(list => {
    list.elements.forEach(ref => {
      app.delete(`/api/cms/${ref}/delete`, isEnabled, async(req, res) => {
        const row = await db[ref].findOne({where: {id: req.query.id}}).catch(catcher);
        // Construct a where clause that looks someting like: {profile_id: row.profile_id, ordering: {[Op.gt]: row.ordering}}
        // except "profile_id" is the "parent" in the array above
        const where1 = {ordering: {[Op.gt]: row.ordering}};
        where1[list.parent] = row[list.parent];
        await db[ref].update({ordering: sequelize.literal("ordering -1")}, {where: where1}).catch(catcher);
        await db[ref].destroy({where: {id: req.query.id}}).catch(catcher);
        const where2 = {};
        where2[list.parent] = row[list.parent];
        const rows = await db[ref].findAll({where: where2, attributes: ["id", "ordering"], order: [["ordering", "ASC"]]}).catch(catcher);
        return res.json(rows);
      });      
    });
  });

  // Other (More Complex) Elements
  app.delete("/api/cms/generator/delete", isEnabled, async(req, res) => {
    const row = await db.generator.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.generator.destroy({where: {id: req.query.id}});
    const rows = await db.generator.findAll({where: {profile_id: row.profile_id}, attributes: ["id", "name"]}).catch(catcher);
    return res.json(rows);
  });

  app.delete("/api/cms/materializer/delete", isEnabled, async(req, res) => {
    const row = await db.materializer.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.materializer.update({ordering: sequelize.literal("ordering -1")}, {where: {profile_id: row.profile_id, ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.materializer.destroy({where: {id: req.query.id}}).catch(catcher);
    const rows = await db.materializer.findAll({where: {profile_id: row.profile_id}, attributes: ["id", "ordering", "name"], order: [["ordering", "ASC"]]}).catch(catcher);
    return res.json(rows);
  });

  app.delete("/api/cms/profile/delete", isEnabled, async(req, res) => {
    const row = await db.profile.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.profile.update({ordering: sequelize.literal("ordering -1")}, {where: {ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.profile.destroy({where: {id: req.query.id}}).catch(catcher);
    pruneSearch(row.dimension, row.levels, db);
    let profiles = await db.profile.findAll(profileReqTreeOnly).catch(catcher);
    profiles = sortProfileTree(db, profiles);
    return res.json(profiles);
  });

  app.delete("/api/cms/profile_meta/delete", isEnabled, async(req, res) => {
    const row = await db.profile_meta.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.profile_meta.update({ordering: sequelize.literal("ordering -1")}, {where: {ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.profile_meta.destroy({where: {id: req.query.id}}).catch(catcher);
    pruneSearch(row.dimension, row.levels, db);
    let profiles = await db.profile.findAll(profileReqTreeOnly).catch(catcher);
    profiles = sortProfileTree(db, profiles);
    return res.json(profiles);
  });

  app.delete("/api/cms/story/delete", isEnabled, async(req, res) => {
    const row = await db.story.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.story.update({ordering: sequelize.literal("ordering -1")}, {where: {ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.story.destroy({where: {id: req.query.id}}).catch(catcher);
    let stories = await db.story.findAll(storyReqTreeOnly).catch(catcher);
    stories = sortStoryTree(db, stories);
    return res.json(stories);
  });

  app.delete("/api/cms/formatter/delete", isEnabled, async(req, res) => {
    await db.formatter.destroy({where: {id: req.query.id}}).catch(catcher);
    const rows = await db.formatter.findAll({attributes: ["id", "name", "description"]}).catch(catcher);
    return res.json(rows);
  });

  app.delete("/api/cms/topic/delete", isEnabled, async(req, res) => {
    const row = await db.topic.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.topic.update({ordering: sequelize.literal("ordering -1")}, {where: {profile_id: row.profile_id, ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.topic.destroy({where: {id: req.query.id}}).catch(catcher);
    const rows = await db.topic.findAll({
      where: {profile_id: row.profile_id}, 
      attributes: ["id", "slug", "ordering", "profile_id", "type"], 
      include: [
        {association: "content", attributes: ["id", "lang", "title"]}
      ],
      order: [["ordering", "ASC"]]
    }).catch(catcher);
    return res.json(rows);
  });

  app.delete("/api/cms/storytopic/delete", isEnabled, async(req, res) => {
    const row = await db.storytopic.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.storytopic.update({ordering: sequelize.literal("ordering -1")}, {where: {story_id: row.story_id, ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.storytopic.destroy({where: {id: req.query.id}}).catch(catcher);
    const rows = await db.storytopic.findAll({
      where: {story_id: row.story_id}, 
      attributes: ["id", "slug", "ordering", "story_id", "type"], 
      include: [
        {association: "content", attributes: ["id", "lang", "title"]}
      ],
      order: [["ordering", "ASC"]]
    }).catch(catcher);
    return res.json(rows);
  });

  app.delete("/api/cms/selector/delete", isEnabled, async(req, res) => {
    const row = await db.selector.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.selector.update({ordering: sequelize.literal("ordering -1")}, {where: {topic_id: row.topic_id, ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.selector.destroy({where: {id: req.query.id}}).catch(catcher);
    const rows = await db.selector.findAll({where: {topic_id: row.topic_id}, order: [["ordering", "ASC"]]}).catch(catcher);
    return res.json(rows);
  });

};
