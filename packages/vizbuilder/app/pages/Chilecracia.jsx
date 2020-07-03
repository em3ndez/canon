import React from "react";
import {hot} from "react-hot-loader/root";
import {Vizbuilder} from "../../src";
import * as params from "../params/chilecracia";

const HotVizbuilder = hot(Vizbuilder);

const Chilecracia = () =>
  <div className="chilecracia">
    <HotVizbuilder
      {...params}
    />
  </div>;

export default Chilecracia;
