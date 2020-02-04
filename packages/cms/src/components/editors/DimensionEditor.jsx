import React, {Component, Fragment} from "react";
import {connect} from "react-redux";
import PropTypes from "prop-types";
import {Icon} from "@blueprintjs/core";

import Button from "../fields/Button";
import Select from "../fields/Select";
import TextInput from "../fields/TextInput";

import {modifyDimension} from "../../actions/profiles";
import {getCubeData} from "../../actions/cubeData";

import "./DimensionEditor.css";

class DimensionEditor extends Component {

  constructor(props) {
    super(props);
    this.state = {
      profileData: {
        slug: "",
        cubeName: "",
        dimName: "",
        dimension: "",
        hierarchies: [],
        levels: []
      },
      selectedDimension: {},
      mode: "add",
      fieldsChanged: false
    };
  }

  componentDidMount() {
    const {cubeData} = this.props;
    if (!cubeData) {
      this.props.getCubeData();
    } 
    else {
      this.populate.bind(this)();
    } 
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.cubeData && this.props.cubeData) {
      this.populate.bind(this)();
    }
  }

  populate() {
    const {meta, cubeData} = this.props;
    if (meta) {
      const selectedDimension = cubeData.find(d => d.cubeName === meta.cubeName && d.dimName === meta.dimension);
      const profileData = {
        id: meta.id,
        slug: meta.slug,
        cubeName: meta.cubeName,
        dimName: meta.dimension,
        dimension: selectedDimension ? selectedDimension.name : "",
        hierarchies: selectedDimension ? selectedDimension.hierarchies : "",
        levels: meta.levels,
        measure: meta.measure
      };
      const mode = "edit";
      this.setState({selectedDimension, profileData, mode});
    }
  }

  changeField(field, e) {
    const {profileData} = this.state;
    profileData[field] = e.target.value;
    this.setState({profileData, fieldsChanged: true});
  }

  chooseDimension(e) {
    const {cubeData} = this.props;
    const {profileData} = this.state;
    const selectedDimension = cubeData.find(d => d.name === e.target.value);
    profileData.cubeName = selectedDimension.cubeName;
    profileData.dimension = e.target.value;
    profileData.dimName = selectedDimension.dimName;
    profileData.hierarchies = selectedDimension.hierarchies;
    profileData.levels = selectedDimension.hierarchies.map(h => h.level);
    this.setState({
      profileData,
      selectedDimension
    });

  }

  addLevel(level) {
    const {profileData, selectedDimension} = this.state;
    profileData.levels.push(level);
    profileData.hierarchies = [];
    profileData.levels.forEach(level => {
      profileData.hierarchies.push(selectedDimension.hierarchies.find(h => h.level === level));
    });
    this.setState({profileData});
  }

  removeLevel(level) {
    const {profileData, selectedDimension} = this.state;
    profileData.levels = profileData.levels.filter(l => l !== level);
    profileData.hierarchies = [];
    profileData.levels.forEach(level => {
      profileData.hierarchies.push(selectedDimension.hierarchies.find(h => h.level === level));
    });
    this.setState({profileData});
  }

  toggleLevel(level, e) {
    const {checked} = e.target;
    checked ? this.addLevel.bind(this)(level) : this.removeLevel.bind(this)(level);
  }

  saveProfile() {
    const {profileData, mode} = this.state;
    const {meta} = this.props;
    const {profiles} = this.props;
    const {currentPid} = this.props.status;
    let takenSlugs = profiles.map(p => p.meta).reduce((acc, d) => acc.concat(d.map(m => m.slug)), []);
    // If editing, then the user provided seed data via "meta". Do not include the given
    // slug as a taken slug - otherwise we will not be able to save due to a faulty collision.
    if (mode === "edit") takenSlugs = takenSlugs.filter(slug => slug !== meta.slug);
    const Toast = this.context.toast.current;
    if (takenSlugs.includes(profileData.slug)) {
      Toast.show({
        intent: "danger",
        message: "Slug already taken. Please choose a different slug.",
        timeout: 2000
      });
    }
    else {
      this.props.modifyDimension(Object.assign({}, profileData, {profile_id: currentPid}));
      if (this.props.onComplete) this.props.onComplete();
    }
  }

  render() {
    const {fieldsChanged, profileData, mode} = this.state;
    const {cubeData} = this.props;

    if (!cubeData) return null;

    const dimOptions = cubeData.map(d => <option key={d.name} value={d.name}>{d.name}</option>);
    const levelList = profileData.dimension ? cubeData
      .find(c => c.name === profileData.dimension).hierarchies
      .map(h => h.level) : [];
    const measureOptions = profileData.dimension ? cubeData
      .find(c => c.name === profileData.dimension).measures
      .map(m => <option key={m} value={m}>{m}</option>) : [];

    let canSaveChanges = false;
    if (profileData.dimension && profileData.levels.length > 0 && profileData.measure && profileData.measure !== "default" && fieldsChanged) canSaveChanges = true;

    return (
      <Fragment>
        {mode === "edit" &&
          <p className="cms-dimension-editor-warning u-font-xs u-margin-bottom-md" key="a">
            <Icon icon="warning-sign" /> <strong>Warning</strong>: Modifying dimensions can break the site. Proceed with caution.
          </p>
        }

        <TextInput
          label="Slug"
          inline
          namespace="cms"
          value={profileData.slug}
          onChange={this.changeField.bind(this, "slug")}
        />

        <Select
          label="Dimension"
          inline
          namespace="cms"
          value={profileData.dimension}
          onChange={this.chooseDimension.bind(this)}
        >
          <option value="default">Choose a Dimension</option>
          {dimOptions}
        </Select>

        {profileData.dimension &&
          <div className="cms-field-container">
            <fieldset className="cms-fieldset">
              <legend className="cms-fieldset-legend u-font-sm">Subdimensions:</legend>
              {levelList.map(level =>
                <label className="cms-checkbox-label u-font-xs" key={level}>
                  <input
                    className="cms-checkbox"
                    type="checkbox"
                    checked={profileData.levels.includes(level)}
                    onChange={this.toggleLevel.bind(this, level)}
                  /> {level}
                </label>
              )}
            </fieldset>
          </div>
        }

        {profileData.dimension && profileData.levels.length > 0 &&
          <Select
            label="Measure"
            inline
            namespace="cms"
            value={profileData.measure}
            onChange={this.changeField.bind(this, "measure")}
          >
            <option value="default">Choose a measure</option>
            {measureOptions}
          </Select>
        }

        <div className="cms-field-container">
          <Button
            onClick={canSaveChanges ? this.saveProfile.bind(this) : null}
            namespace="cms"
            icon={mode === "edit" ? "tick-circle" : "plus"}
            disabled={!canSaveChanges}
          >
            {`${mode === "edit" ? "Modify" : "Add"} dimension`}
          </Button>
        </div>
      </Fragment>
    );
  }
}

DimensionEditor.contextTypes = {
  toast: PropTypes.object
};

const mapStateToProps = state => ({
  cubeData: state.cms.cubeData,
  profiles: state.cms.profiles,
  status: state.cms.status
});

const mapDispatchToProps = dispatch => ({
  modifyDimension: payload => dispatch(modifyDimension(payload)),
  getCubeData: () => dispatch(getCubeData())
});

export default connect(mapStateToProps, mapDispatchToProps)(DimensionEditor);
