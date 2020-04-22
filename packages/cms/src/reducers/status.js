const deepClone = require("../utils/deepClone");

const extractEntity = s => s.split("_").slice(0, -1).join("_").toLowerCase();

export default (status = {}, action) => {
  
  const entity = extractEntity(action.type);
  const success = action && action.data && action.data.id ? {id: action.data.id, status: "SUCCESS"} : {};
  const error = action && action.data && action.data.id ? {id: action.data.id, status: "ERROR"} : {};

  // Basic assign
  if (action.type === "STATUS_SET") {
    return Object.assign({}, status, action.data);
  }
  // When an update attempt starts, clear the justUpdated variable, which will then be refilled with SUCCESS or ERROR.
  // This is to ensure that subsequent error messages freshly fire, even if they are the "same" error
  else if (action.type === "JUSTUPDATED_RESET") {
    return Object.assign({}, status, {justUpdated: false});
  }
  // Report loading completion of profilesLoaded, storiesLoaded, and formattersLoaded
  else if (action.type.includes("_GET")) {
    return Object.assign({}, status, {[`${entity}Loaded`]: true});
  }
  // Creation Detection
  else if (action.type.includes("_NEW") || action.type.includes("_DUPLICATE")) {
    if (["profile", "story"].includes(entity)) {
      return Object.assign({}, status, {justCreated: {type: entity, id: action.data.id}});
    }
    else if (["section"].includes(entity)) {
      return Object.assign({}, status, {justCreated: {type: entity, id: action.data.id, profile_id: action.data.profile_id}});  
    }
    else if (["storysection"].includes(entity)) {
      return Object.assign({}, status, {justCreated: {type: entity, id: action.data.id, story_id: action.data.story_id}});  
    }
    // Auto-open new entities
    else if (["generator", "materializer", "selector", "formatter", "section_subtitle", "section_stat", "section_description", "section_visualization"].includes(entity)) {
      return Object.assign({}, status, {dialogOpen: {type: entity, id: action.data.id, force: true}});
    }
    else return status;
  }
  else if (action.type.includes("_UPDATE")) {
    if (["generator", "materializer", "selector"].includes(entity)) {
      return Object.assign({}, status, {dialogOpen: false, justUpdated: {type: entity, ...success}});
    }
    else if (["formatter"].includes(entity)) {
      return Object.assign({}, status, {dialogOpen: false, diffCounter: action.diffCounter, justUpdated: {type: entity, ...success}});
    }
    // Updating sections could mean the title was updated. Bump a "diffcounter" that the Navbar tree can listen for to jigger a render
    else if (["section"].includes(entity)) {
      return Object.assign({}, status, {diffCounter: action.diffCounter, justUpdated: {type: entity, ...success}});
    }
    else if (["profile"].includes(entity)) {
      return Object.assign({}, status, {justUpdated: {type: entity, ...success}});
    }
    else if (["section_subtitle", "section_stat", "section_description", "section_visualization"].includes(entity)) {
      return Object.assign({}, status, {dialogOpen: false, justUpdated: {type: entity, ...success}});
    }
    else return status;
  }
  else if (action.type.includes("_DELETE")) {
    if (["selector"].includes(entity)) {
      return Object.assign({}, status, {dialogOpen: false});
    }
    // Updating a formatter means that some formatter logic changed. Bump the diffcounter.
    else if (["formatter"].includes(entity)) {
      return Object.assign({}, status, {dialogOpen: false, diffCounter: action.diffCounter});
    }
    else if (["dimension"].includes(entity)) {
      return Object.assign({}, status, {diffCounter: action.diffCounter});
    }
    // Deleting a profile requires resetting currentNode/Pid. It will be reset when the jsx picks a new node automatically
    // We need to set justDeleted so that the NavBar can listen for disappearing nodes, and automatically open a new one.
    else if (["profile"].includes(entity)) {
      return Object.assign({}, status, {justDeleted: {type: entity, id: action.data.id}, currentPid: false});
    }
    else if (["section"].includes(entity)) {
      return Object.assign({}, status, {justDeleted: {type: entity, id: action.data.id, parent_id: action.data.parent_id}});
    }
    else if (["generator", "materializer"].includes(entity)) {
      return Object.assign({}, status, {dialogOpen: false, justDeleted: {type: entity, id: action.data.id, parent_id: action.data.parent_id}});
    }
    else if (["story"].includes(entity)) {
      return Object.assign({}, status, {justDeleted: {type: entity, id: action.data.id}, currentStoryPid: false});
    }
    else if (["storysection"].includes(entity)) {
      return Object.assign({}, status, {justDeleted: {type: entity, id: action.data.id, parent_id: action.data.parent_id}});
    }
    // Clear force/toolbox states on delete
    else if (["section_subtitle", "section_stat", "section_description", "section_visualization"].includes(entity)) {
      return Object.assign({}, status, {dialogOpen: false});
    }
    else return status;
  }
  else if (action.type.includes("_ERROR")) {
    return Object.assign({}, status, {justUpdated: {type: entity, ...error}});
  }
  else if (action.type === "VARIABLES_FETCH") {
    return Object.assign({}, status, {fetchingVariables: action.data});
  }
  else if (action.type === "VARIABLES_FETCHED") {
    return Object.assign({}, status, {fetchingVariables: false});
  }
  // Updating variables or saving a section or meta means that anything that depends on variables, such as TextCards 
  // Or the tree, needs to know something changed. Instead of running an expensive stringify on variables,
  // Just increment a counter that the various cards can subscribe to.
  else if (action.type === "VARIABLES_SET") {
    const newStatus = {variables: deepClone(action.data.variables)};
    if (action.data.diffCounter) newStatus.diffCounter = action.data.diffCounter;
    return Object.assign({}, status, newStatus);
  }
  // When the user adds a new dimension, set a status that we are waiting for members to finish populating
  else if (action.type === "SEARCH_LOADING") {
    return Object.assign({}, status, {searchLoading: true});
  }
  else if (action.type === "DIMENSION_MODIFY") {
    return Object.assign({}, status, {diffCounter: action.diffCounter, searchLoading: false});
  }
  else if (action.type === "SECTION_PREVIEW_FETCH") {
    return Object.assign({}, status, {fetchingSectionPreview: true});
  }
  else if (action.type === "SECTION_PREVIEW_SET") {
    return Object.assign({}, status, {sectionPreview: action.data, fetchingSectionPreview: false});
  }
  else {
    return status;
  }
};
