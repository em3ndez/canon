import axios from "axios";
import React, {Component} from "react";
import {connect} from "react-redux";
import ReactTable from "react-table";
import Select from "../components/fields/Select";
import {Dialog} from "@blueprintjs/core";
import FooterButtons from "../components/editors/components/FooterButtons";
import PropTypes from "prop-types";

import "./MemberBuilder.css";

class MemberBuilder extends Component {

  constructor(props) {
    super(props);
    this.state = {
      sourceData: [],
      data: [],
      columns: [],
      dimensions: [],
      dimension: "all",
      hierarchies: [],
      hierarchy: "all",
      isOpen: false,
      currentRow: {}
    };
  }

  componentDidMount() {
    this.hitDB.bind(this)();
  }

  clickCell(cell) {
    const currentRow = cell.original;
    const url = currentRow.image && currentRow.image.url ? currentRow.image.url : "";
    const isOpen = true;
    this.setState({url, isOpen, currentRow});
  }

  prepData() {
    const {sourceData} = this.state;
    sourceData.sort((a, b) => {
      if (a.dimension === b.dimension) {
        return b.zvalue - a.zvalue;
      }
      return a.dimension < b.dimension ? 1 : -1;
    });
    const data = sourceData;
    const skip = ["stem", "content", "imageId", "contentId"];
    const fields = Object.keys(data[0]).filter(d => !skip.includes(d));
    const columns = fields.map(field => {
      if (field === "image") {
        return {
          id: "image",
          Header: "image",
          accessor: d => d.image ? d.image.url : null,
          Cell: cell => <span onClick={this.clickCell.bind(this, cell)} className="cp-table-cell-inner">
            {cell.value ? cell.value : "+ Add Image"}
          </span>
        };
      }
      else {
        return {
          Header: field,
          accessor: field
        };
      }
    });
    this.setState({sourceData, data, columns});
  }

  hitDB() {
    axios.get("/api/search/all").then(resp => {
      if (resp.status === 200 && resp.data && resp.data[0]) {
        const sourceData = resp.data;
        const dimensions = ["all"].concat([... new Set(sourceData.map(d => d.dimension))]);
        const hierarchies = ["all"].concat([... new Set(sourceData.map(d => d.hierarchy))]);
        this.setState({dimensions, hierarchies, sourceData}, this.prepData.bind(this));
      } 
      else {
        console.log("Fetch Error in MemberBuilder.jsx");
      }
    });  
  }

  save(currentRow) {
    const {url} = this.state;
    const {contentId} = currentRow;
    const Toast = this.context.toast.current;
    const payload = {url, contentId};
    axios.post("/api/image/update", payload).then(resp => {
      if (resp.data) {
        if (resp.data.error) {
          Toast.show({
            intent: "danger",
            message: `Invalid Flickr Link - ${resp.data.error}`,
            timeout: 2000
          });
        }
        else {
          const row = resp.data;
          const sourceData = this.state.sourceData.map(d => row.contentId === d.contentId ? row : d);
          const isOpen = false;
          this.setState({isOpen, sourceData}, this.prepData.bind(this));
          Toast.show({
            intent: "success",
            message: "Success!",
            timeout: 2000
          });
        }
      }
    });
    
    /*

    const {url} = this.state;
    const {contentId} = currentRow;
    const payload = {contentId, url};
    axios.post("/api/search/update", payload).then(resp => {
      const row = resp.data;
      const sourceData = this.state.sourceData.map(d => row.contentId === d.contentId ? row : d);
      const isOpen = false;
      this.setState({isOpen, sourceData}, this.prepData.bind(this));
    });
    */
  }

  onChange(field, e) {
    const data = this.state.sourceData.filter(d => d[field] === e.target.value || e.target.value === "all");
    this.setState({data, [field]: e.target.value});
  }

  maybeCloseEditorWithoutSaving() {

  }

  closeEditor() {
    this.setState({url: "", isOpen: false});
  }

  render() {

    const {data, columns, dimensions, dimension, hierarchies, hierarchy, isOpen, url, currentRow} = this.state;

    return (
      <React.Fragment>
        <Dialog
          isOpen={isOpen}
          onClose={this.closeEditor.bind(this)}
          title="Choose Image URL"
          usePortal={false}
        >
          <div className="bp3-dialog-body">
            <h3>Instructions</h3>
            <ul>
              <li>Go To Flickr.com</li>
              <li>Search for an image</li>
              <li>Change the License to <strong>Commercial use & mods allowed</strong></li>
              <li>Choose and image and click it</li>
              <li>Click the Share Button on the bottom right</li>
              <li>Paste the URL below.</li>
            </ul>
            Enter a Flickr URL
            <input className="cms-flickr-input" value={url} onChange={e => this.setState({url: e.target.value})}/>
          </div>
          <FooterButtons onSave={this.save.bind(this, currentRow)} />
        </Dialog>
        <div className="cms-panel member-panel">
          <h3>Filters</h3>
          <div className="cms-member-filter-container">
            <Select
              label="Dimension"
              inline
              context="cms"
              value={dimension}
              onChange={this.onChange.bind(this, "dimension")}
            >
              {dimensions.map(dim =>
                <option key={dim} value={dim}>{dim}</option>
              )}
            </Select>
            <Select
              label="Hierarchy"
              inline
              context="cms"
              value={hierarchy}
              onChange={this.onChange.bind(this, "hierarchy")}
            >
              {hierarchies.map(hier =>
                <option key={hier} value={hier}>{hier}</option>
              )}
            </Select>
          </div>
          <h3>Members</h3>
          <ReactTable
            className="cms-member-table"
            data={data}
            columns={columns}
          />
        </div>
      </React.Fragment>
    );
  }
}

MemberBuilder.contextTypes = {
  toast: PropTypes.object
};

const mapStateToProps = state => ({
  env: state.env
});

export default connect(mapStateToProps)(MemberBuilder);
