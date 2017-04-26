import React, {Component} from "react";
import {connect} from "react-redux";

class CanonComponent extends Component {

  getChildContext() {
    return {
      d3plus: this.props.d3plus || {},
      data: this.props.data || {}
    };
  }

  render() {
    const {children, loading, loadingComponent} = this.props;
    return loading ? loadingComponent : children;
  }

}

CanonComponent.childContextTypes = {
  data: React.PropTypes.object,
  d3plus: React.PropTypes.object
};

CanonComponent.defaultProps = {
  loadingComponent: <div>Loading...</div>
};

CanonComponent = connect(state => ({
  loading: state.loading
}))(CanonComponent);

export {CanonComponent};
