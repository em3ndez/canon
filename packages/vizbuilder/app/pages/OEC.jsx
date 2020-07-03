import React from "react";
import {hot} from "react-hot-loader/root";
import {Vizbuilder} from "../../src";
import * as params from "../params/oec";

const HotVizbuilder = hot(Vizbuilder);

const OEC = () =>
  <div className="oec">
    <HotVizbuilder {...params} />
  </div>;

export default OEC;
