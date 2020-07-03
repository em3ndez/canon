import React from "react";
import {hot} from "react-hot-loader/root";
import {Vizbuilder} from "../../src";
import * as params from "../params/datamexico";

const HotVizbuilder = hot(Vizbuilder);

/** @type {React.FC<{}>} */
const DataMexico = () =>
  <div className="datamexico">
    <HotVizbuilder
      {...params}
      titleArea={
        <img
          style={{maxWidth: "100%"}}
          src="https://placehold.co/300x50?text=titleArea"
        />
      }
      controlsArea={
        <img
          style={{maxWidth: "100%"}}
          src="https://placehold.co/300x50?text=controlsArea"
        />
      }
      sourcesArea={
        <img
          style={{maxWidth: "100%"}}
          src="https://placehold.co/300x50?text=sourcesArea"
        />
      }
      toolbarArea={
        <img
          style={{maxWidth: "100%"}}
          src="https://placehold.co/1200x50?text=toolbarArea"
        />
      }
    />
  </div>;

export default DataMexico;
