// eslint-disable-next-line no-unused-vars
import React, {useState} from "react";
import mortarEval from "../utils/mortarEval";
import prepareProfile from "../utils/prepareProfile";
import {useRouter} from "next/router";

const splitComparisonKeys = obj => {
  const split = {
    profile: {},
    comparison: {}
  };
  Object.keys(obj).forEach(k => {
    split[k.startsWith("compare_") ? "comparison" : "profile"][k.replace("compare_", "")] = obj[k];
  });
  return split;
};

const useOnSetVariables = (profileState, selectors) => {
  const {locale} = useRouter();
  const {profile, comparison, formatterFunctions, setProfile, setComparison} = profileState;
  const [varsLoading, setVarsLoading] = useState();
  const {variables} = profile;

  /**
   * Visualizations have the ability to "break out" and override a variable in the variables object.
   * This requires re-running materializers, because the user may have changed a variable
   * that would affect the "allowed" status of a given section.
   */
  const onSetVariables = (newVariables, forceMats, isComparison) => {
    const compVars = comparison.variables;

    // Users should ONLY call setVariables in a callback - never in the main execution, as this
    // would cause an infinite loop. However, should they do so anyway, try and prevent the infinite
    // loop by checking if the vars are in there already, only updating if they are not yet set.
    // const alreadySet = Object.keys(newVariables).every(key => variables[key] === newVariables[key]);
    // *** removed alreadySet due to a bug with clicking the same country twice. TODO: revisit loop protection
    if (!setVarsLoading) {
      // If forceMats is true, this function has been called by the componentDidMount, and we must run materializers
      // so that variables like `isLoggedIn` can resolve to true.
      if (forceMats) {
        const combinedVariables = {...variables, ...newVariables};
        const matVars = variables._rawProfile.allMaterializers.reduce((acc, m) => {
          const evalResults = mortarEval("variables", acc, m.logic, formatterFunctions, locale);
          if (typeof evalResults.vars !== "object") evalResults.vars = {};
          return {...acc, ...evalResults.vars};
        }, combinedVariables);
        const newProfile = prepareProfile(variables._rawProfile, matVars, formatterFunctions, locale, selectors);
        setProfile({...profile, ...newProfile});
      }
      else {
        // If forceMats is not true, no materializers required. Using the locally stored _rawProfile and the now-combined
        // old and new variables, you have all that you need to make the profile update.
        const split = splitComparisonKeys(selectors);
        if (isComparison) {
          const newComparison = prepareProfile(
            compVars._rawProfile,
            {...compVars, ...newVariables},
            formatterFunctions,
            locale,
            split.comparison
          );
          setComparison({...comparison, ...newComparison});
        }
        else {
          const newProfile = prepareProfile(
            variables._rawProfile,
            {...variables, ...newVariables},
            formatterFunctions,
            locale,
            split.profile
          );
          setProfile({...profile, ...newProfile});
        }
      }
    }
  };
  return {varsLoading, onSetVariables};
};

export default useOnSetVariables;
