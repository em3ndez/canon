import React, {Component, Fragment} from "react";
import {connect} from "react-redux";
import {Icon} from "@blueprintjs/core";

import deepClone from "../../utils/deepClone";
import upperCaseFirst from "../../utils/formatters/upperCaseFirst";

import LocaleName from "./components/LocaleName";
import Dialog from "../interface/Dialog";
import VariableEditor from "../editors/VariableEditor";
import VarTable from "../variables/VarTable";
import Card from "./Card";

import {deleteEntity, updateEntity, fetchVariables} from "../../actions/profiles";
import {setStatus} from "../../actions/status";

import "./VariableCard.css";

class VariableCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      minData: null,
      displayData: null,
      secondaryDisplayData: null,
      alertObj: false,
      isDirty: false,
      dupes: []
    };
  }

  componentDidMount() {
    const {minData, type} = this.props;
    const {forceType, forceID} = this.props.status;
    this.setState({minData: deepClone(minData)});
    this.formatDisplay.bind(this)();
    if (forceType === type && forceID === minData.id) this.openEditor.bind(this)();
  }

  componentDidUpdate(prevProps) {
    const {type, minData} = this.props;
    const {id} = minData;
    // If the props we receive from redux have changed, then an update action has occured.
    if (JSON.stringify(prevProps.minData) !== JSON.stringify(this.props.minData)) {
      // If a gen/mat was saved, re-run fetchvariables for just this one gen/mat.
      if (type === "generator" || type === "materializer") {
        const config = {type, ids: [minData.id]};
        this.props.fetchVariables(config);
      }
      // Clone the new object for manipulation in state.
      this.setState({minData: deepClone(this.props.minData)});
    }
    // If diffCounter incremented, it means a variables update completed, either from this card saving,
    // or from ANOTHER card saving. If it was this card, we need to update the front panel, if it was another card,
    // we may need to update whether this card contains a duplicate. Either way, format the display.
    if (type === "generator" || type === "materializer") {
      const variablesChanged = prevProps.status.diffCounter !== this.props.status.diffCounter;
      if (variablesChanged) this.formatDisplay.bind(this)();
    }

    if (this.props.status.forceType === type && !prevProps.status.forceID && this.props.status.forceID === id) {
      this.openEditor.bind(this)();
    }
  }

  formatDisplay() {
    const {type} = this.props;
    const {localeDefault, localeSecondary} = this.props.status;
    const variables = this.props.status.variables[localeDefault];
    const secondaryVariables = this.props.status.variables[localeSecondary];
    const {id} = this.props.minData;
    let displayData, secondaryDisplayData = {};
    let dupes = [];
    if (type === "generator") {
      displayData = variables._genStatus[id];
      if (localeSecondary) {
        secondaryDisplayData = secondaryVariables._genStatus[id];
      }
    }
    else if (type === "materializer") {
      displayData = variables._matStatus[id];
      if (localeSecondary) {
        secondaryDisplayData = secondaryVariables._matStatus[id];
      }
    }
    if (type === "generator" || type === "materializer") {
      const status = type === "generator" ? "_genStatus" : "_matStatus";
      const theseVars = variables[status][id];
      if (theseVars) {
        const otherGens = Object.keys(variables._genStatus).reduce((acc, _id) =>
          type === "materializer" || String(id) !== String(_id) ? Object.assign({}, acc, variables._genStatus[_id]) : acc, {});
        const otherMats = Object.keys(variables._matStatus).reduce((acc, _id) =>
          type === "generator" || String(id) !== String(_id) ? Object.assign({}, acc, variables._matStatus[_id]) : acc, {});
        const thoseVars = {...otherGens, ...otherMats};
        dupes = dupes.concat(Object.keys(theseVars).reduce((acc, k) => thoseVars[k] !== undefined ? acc.concat(k) : acc, []));
      }
    }
    this.setState({displayData, secondaryDisplayData, dupes});
  }

  maybeDelete() {
    const alertObj = {
      callback: this.delete.bind(this),
      title: `Delete ${this.props.type}?`,
      confirm: `Delete ${this.props.type}`
    };
    this.setState({alertObj});
  }

  delete() {
    const {type} = this.props;
    const {id} = this.props.minData;
    this.props.deleteEntity(type, {id});
  }

  save() {
    const {type} = this.props;
    const {minData} = this.state;
    this.props.updateEntity(type, minData);
    this.setState({isOpen: false});
  }

  openEditor() {
    const minData = deepClone(this.props.minData);
    const isOpen = true;
    this.props.setStatus({toolboxDialogOpen: true});
    this.setState({minData, isOpen});
  }

  maybeCloseEditorWithoutSaving() {
    const {isDirty} = this.state;
    if (isDirty) {
      const alertObj = {
        callback: this.closeEditorWithoutSaving.bind(this),
        title: `Close ${this.props.type} editor and revert changes?`,
        confirm: "Close editor",
        theme: "caution"
      };
      this.setState({alertObj});
    }
    else {
      this.closeEditorWithoutSaving.bind(this)();
    }
  }

  closeEditorWithoutSaving() {
    this.setState({isOpen: false, alertObj: false, isDirty: false});
    this.props.setStatus({toolboxDialogOpen: false, forceID: false, forceType: false, forceOpen: false});
  }

  markAsDirty() {
    const {isDirty} = this.state;
    if (!isDirty) this.setState({isDirty: true});
  }

  render() {
    const {attr, readOnly, minData, type, showReorderButton} = this.props;
    const {localeDefault, localeSecondary, variables} = this.props.status;
    const {displayData, secondaryDisplayData, isOpen, alertObj, dupes} = this.state;

    let description = "";
    let showDesc = false;
    if (minData && minData.description) {
      description = minData.description;
      if (description.toLowerCase() !== "") {
        showDesc = true;
      }
    }

    // define initial/loading props for Card
    const cardProps = {
      type,
      readOnly, // currently only used for attributes card
      localeSecondary,
      title: "•••" // placeholder
    };

    const dialogProps = {
      className: "cms-variable-editor-dialog",
      title: `${upperCaseFirst(type)} editor`,
      isOpen,
      onClose: this.maybeCloseEditorWithoutSaving.bind(this),
      onDelete: this.maybeDelete.bind(this),
      onSave: this.save.bind(this),
      usePortal: false,
      icon: false,
      portalProps: {namespace: "cms"}
    };

    const editorProps = {
      attr,
      type,
      data: this.state.minData,
      markAsDirty: this.markAsDirty.bind(this)
    };

    // add additional props once the data is available
    if (minData && variables) {
      Object.assign(cardProps, {
        title: minData.name, // overwrites placeholder
        onEdit: minData.locked ? null : this.openEditor.bind(this),
        onDelete: minData.locked ? null : this.maybeDelete.bind(this),
        // reorder
        reorderProps: showReorderButton ? {
          id: minData.id,
          type
        } : null,
        // alert
        alertObj,
        onAlertCancel: () => this.setState({alertObj: false})
      });
    }

    return (
      <Fragment>
        <Card {...cardProps} key="c">
          {showDesc &&
            <p className="cms-card-description" key="cd">{description}</p>
          }

          {/* show variables, but not for formatter cards */}
          {type !== "formatter" &&
            <div className="cms-card-locale-group" key="cl">
              <div className="cms-card-locale-container">
                {localeSecondary &&
                  <LocaleName>{localeDefault}</LocaleName>
                }
                <VarTable dataset={displayData} dupes={dupes}/>
              </div>

              {localeSecondary &&
                <div className="cms-card-locale-container" key="cls">
                  <LocaleName>{localeSecondary}</LocaleName>
                  <VarTable dataset={secondaryDisplayData} dupes={dupes} />
                </div>
              }
            </div>
          }

          {dupes.length > 0 &&
            <p className="cms-card-error u-font-xxs u-margin-top-xs">
              <Icon className="cms-card-error-icon" icon="warning-sign" /> Highlighted variables conflict with another generator or materializer
            </p>
          }
        </Card>

        {/* editor */}
        <Dialog {...dialogProps} key="d">
          <VariableEditor {...editorProps} />
        </Dialog>
      </Fragment>
    );
  }
}

const mapStateToProps = state => ({
  status: state.cms.status
});

const mapDispatchToProps = dispatch => ({
  updateEntity: (type, payload) => dispatch(updateEntity(type, payload)),
  deleteEntity: (type, payload) => dispatch(deleteEntity(type, payload)),
  fetchVariables: config => dispatch(fetchVariables(config)),
  setStatus: status => dispatch(setStatus(status))
});

export default connect(mapStateToProps, mapDispatchToProps)(VariableCard);