import axios from "axios";
import React, {Component} from "react";
import {EditableText, Icon} from "@blueprintjs/core";
import Button from "../fields/Button";
import "./Header.css";

export default class Header extends Component {

  constructor(props) {
    super(props);
    this.state = {
      title: null,
      slug: null
    };
  }

  componentDidMount() {
    const {title, slug} = this.props;
    this.setState({title, slug});
  }

  componentDidUpdate(prevProps) {
    if (prevProps.profileID !== this.props.profileID) {
      const {title, slug} = this.props;
      this.setState({title, slug});   
    }
  }

  nicknameProfile() {
    const {profileID, localeDefault} = this.props;
    const {title} = this.state;
    if (profileID) {
      const payload = {
        id: profileID,
        content: [{
          id: profileID,
          lang: localeDefault,
          label: title
        }]
      };
      axios.post("/api/cms/profile/update", payload).then(resp => {
        if (resp.status === 200) {
          console.log("yeah");
        }
      });
    }
  }

  renameSectionSlug(value) {
    console.log(value);
  }

  renameSection() {
    console.log("button clicked");
  }

  render() {
    const {
      parentTitle,
      dimensions
    } = this.props;

    const {
      title,
      slug
    } = this.state;

    let domain = this.props;
    if (typeof domain !== "undefined" && typeof window !== "undefined") {
      domain = window.document.location.origin;
    }

    const prettyDomain = domain.replace("http://", "").replace("https://", "");

    // construct URL from domain and dimensions
    const previewURL = `${domain}/profile/${
      dimensions.map(dim => Object.values(dim)).flat().join("/")
    }${slug && `#${slug}`}`;

    return (
      <header className="cms-header">
        <h1 className="cms-header-title font-lg">
          {!parentTitle

            // profile
            ? <span className="cms-header-title-main">
              <EditableText
                value={title}
                onChange={title => this.setState({title})}
                confirmOnEnterKey={true}
                onConfirm={this.nicknameProfile.bind(this)}
              />
              <Icon icon="edit" />
            </span>

            // section
            : <React.Fragment>
              <span className="cms-header-title-parent">{parentTitle} </span>
              <span className="cms-header-title-main">
                {title}
                <Button className="cms-header-title-button font-xs" onClick={this.renameSection.bind(this)} icon="cog" iconOnly>
                  rename section
                </Button>
              </span>
            </React.Fragment>
          }
        </h1>

        <span className="cms-header-link-container">
          {dimensions && dimensions.length
            // proper URL can be constructed
            ? <a href={previewURL} className={`cms-header-link ${previewURL.length > 60 ? "font-xs" : ""}`}>
              {/* dimensions & ids */}
              {prettyDomain}/profile{dimensions && dimensions.map(dim =>
                <React.Fragment key={dim.slug}>/
                  <span className="cms-header-link-dimension">{dim.slug}</span>/
                  <span className="cms-header-link-id">{dim.id}</span>
                </React.Fragment>
              )}
            </a>
            // show the domain, but that's it
            : `${prettyDomain}/profile/`
          }

          {/* edit slug button can't be part of link */}
          {slug && dimensions && dimensions.length
            ? <React.Fragment>#
              <span className="cms-header-link-slug">
                <EditableText
                  value={slug}
                  confirmOnEnterKey={true}
                  onConfirm={this.renameSectionSlug.bind(this)}
                />
                <Icon icon="edit" />
              </span>
            </React.Fragment> : ""
          }
        </span>
      </header>
    );
  }
}
