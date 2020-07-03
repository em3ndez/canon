import React, {Component} from "react";
import {hot} from "react-hot-loader/root";
import {Vizbuilder} from "../../src/index";
import * as params from "../params/datausa/viz";

const HotVizbuilder = hot(Vizbuilder);

class DataUSAViz extends Component {
  state = {
    intro: this.props.location.search.length < 2
  };

  activate = () => {
    // this.props.router.push("/visualize");
    this.setState({intro: false});
  };

  componentDidMount() {
    console.log("Visualize", "mount");
  }

  componentWillUnmount() {
    console.log("Visualize", "unmount");
  }

  render() {
    return <div className="visualize">
      { this.state.intro
        ? <button onClick={this.activate}>Activate</button>
        : <HotVizbuilder {...params} />}
    </div>;
  }
}

export default DataUSAViz;
