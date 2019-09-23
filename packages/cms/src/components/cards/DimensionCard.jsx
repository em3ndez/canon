import axios from "axios";
import React, {Component} from "react";
import Button from "../fields/Button";
import DefinitionList from "../variables/DefinitionList";
import PreviewSearch from "../fields/PreviewSearch";
import Card from "./Card";
import "./DimensionCard.css";

export default class DimensionCard extends Component {

  constructor(props) {
    super(props);
    this.state = {
      rebuilding: false,
      alertObj: false
    };
  }

  onSelectPreview(result) {
    // todo bivariate - should this slug come from preview or meta? once the user
    // is able to change slug, one of these will have to become the source of truth
    const {slug} = this.props.preview;
    const {id, name, slug: memberSlug} = result;
    const newPreview = {slug, id, name, memberSlug};
    if (this.props.onSelectPreview) this.props.onSelectPreview(newPreview);
  }

  rebuildSearch() {
    const {meta} = this.props;
    const {id} = meta;
    const url = "/api/cms/repopulateSearch/";
    this.setState({rebuilding: true});
    axios.post(url, {id}).then(() => {
      this.setState({rebuilding: false});
    });
  }

  maybeDelete() {
    const alertObj = {
      callback: this.delete.bind(this),
      message: "Are you sure you want to delete this Dimension?",
      confirm: "Delete"
    };
    this.setState({alertObj});
  }

  delete() {
    const {meta} = this.props;
    const {id} = meta;
    axios.delete("/api/cms/profile_meta/delete", {params: {id}}).then(resp => {
      if (resp.status === 200) {
        this.setState({alertObj: false});
        const profiles = resp.data;
        if (this.props.onDeleteDimension) this.props.onDeleteDimension(profiles);
      }
    });
  }

  render() {
    const {meta, preview} = this.props;
    const {rebuilding, alertObj} = this.state;

    if (!preview) return null;

    // define props for Card
    const cardProps = {
      cardClass: "dimension",
      title: meta.dimension,
      onDelete: this.maybeDelete.bind(this),
      onRefresh: this.rebuildSearch.bind(this),
      rebuilding,
      // onEdit: this.openEditor.bind(this),
      // onReorder: this.props.onMove ? this.props.onMove.bind(this) : null,
      // alert
      alertObj,
      onAlertCancel: () => this.setState({alertObj: false})
    };

    return (
      <Card {...cardProps}>

        <DefinitionList definitions={[
          {label: "slug", text: meta.slug},
          {label: "levels", text: meta.levels.join(", ")},
          {label: "measure", text: meta.measure},
          {label: "preview ID", text:
            <PreviewSearch
              label={preview.name || preview.id || "search profiles..."}
              previewing={preview.name || preview.id}
              fontSize="xxs"
              renderResults={d =>
                <Button
                  className="cms-search-result-button"
                  context="cms"
                  fontSize="xxs" onClick={this.onSelectPreview.bind(this, d)}
                >
                  {d.name}
                </Button>
              }
              dimension={meta.dimension}
              levels={meta.levels}
              limit={20}
            />
          }
        ]}/>

        {/* TODO: edit mode */}
      </Card>
    );
  }

}
