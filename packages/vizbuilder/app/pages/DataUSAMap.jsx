import React from "react";
import {hot} from "react-hot-loader/root";
import {Vizbuilder} from "../../src";
import * as params from "../params/datausa/map";

const HotVizbuilder = hot(Vizbuilder);

/** @type {React.FC<{}>} */
const DataUSAMap = () =>
  <div className="datausa datausa-map">
    <HotVizbuilder {...params} />
  </div>;

export default DataUSAMap;
