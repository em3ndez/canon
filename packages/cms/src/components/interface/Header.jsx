import axios from "axios";
import React, {Component} from "react";
import {EditableText, Icon, Dialog} from "@blueprintjs/core";
import Button from "../fields/Button";
import FooterButtons from "../editors/components/FooterButtons";
import TextEditor from "../editors/TextEditor";
import stripHTML from "../../utils/formatters/stripHTML";
import varSwapRecursive from "../../utils/varSwapRecursive";
import LocaleName from "../cards/components/LocaleName";
import PropTypes from "prop-types";
import "./Header.css";

class Header extends Component {

  constructor(props) {
    super(props);
    this.state = {
      title: null,
      slug: null,
      rawSectionTitle: null,
      sectionTitleObject: {}
    };
  }

  componentDidMount() {
    this.populate.bind(this)();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.profileID !== this.props.profileID || prevProps.sectionID !== this.props.sectionID) {
      this.populate.bind(this)();  
    }
  }

  populate() {
    const {title, slug, rawSectionTitle, localeDefault, locale} = this.props;
    const sectionTitleObject = {content: [
      {lang: localeDefault, title: rawSectionTitle},
      {lang: locale, title: "test for now"}
    ]};
    this.setState({title, slug, rawSectionTitle, sectionTitleObject});
  }

  // Strip leading/trailing spaces and URL-breaking characters
  urlPrep(str) {
    return str.replace(/^\s+|\s+$/gm, "").replace(/[^a-zA-ZÀ-ž0-9-\ _]/g, "");
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
          if (this.props.reportSave) this.props.reportSave("profile", profileID, title, "label");
        }
      });
    }
  }

  renameSectionSlug() {
    const {sectionID} = this.props;
    const {slug} = this.state;
    if (sectionID) {
      const payload = {
        id: sectionID,
        slug
      };
      axios.post("/api/cms/section/update", payload).then(resp => {
        if (resp.status === 200) {
          if (this.props.reportSave) this.props.reportSave("section", sectionID, slug, "slug");
        }
      });
    }
  }

  renameSection() {
    console.log("button clicked");
  }

  save() {
    const {sectionTitleObject} = this.state;
    console.log(sectionTitleObject);
  }

  render() {
    const {
      parentTitle,
      dimensions,
      variables,
      query,
      selectors,
      localeDefault,
      locale
    } = this.props;

    const {
      title,
      slug,
      rawSectionTitle,
      isOpen,
      isDirty,
      alertObj,
      sectionTitleObject
    } = this.state;

    const formatters = this.context.formatters[localeDefault];

    let domain = this.props;
    if (typeof domain !== "undefined" && typeof window !== "undefined" && window.document.location.origin) {
      domain = window.document.location.origin;
    }
    else {
      if (typeof domain !== "undefined" && typeof window !== "undefined") {
        domain = `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}`;
      }
    }

    const prettyDomain = domain.replace("http://", "").replace("https://", "");

    // construct URL from domain and dimensions
    const previewURL = `${domain}/profile/${dimensions
      .map(dim => Object.values(dim)) // extract each dimension key & value into an array
      .reduce((acc, val) => acc.concat(val), []) // flatten arrays
      .join("/") // now it's a URL
    }${typeof slug !== "undefined" ? `#${slug}` : ""}`;

    let prettySectionTitle = "";
    if (rawSectionTitle) {
      prettySectionTitle = stripHTML(rawSectionTitle);
      const theseVariables = variables[localeDefault];
      if (theseVariables) prettySectionTitle = varSwapRecursive({prettySectionTitle, selectors}, formatters, theseVariables, query).prettySectionTitle;
    }

    return (
      <header className="cms-header">
        <h1 className="cms-header-title u-font-lg">
          {!parentTitle

            // profile
            ? <span className="cms-header-title-main">
              <EditableText
                value={title}
                onChange={title => this.setState({title})}
                selectAllOnFocus={true}
                confirmOnEnterKey={true}
                onConfirm={this.nicknameProfile.bind(this)}
              />
              <Icon icon="edit" />
            </span>

            // section
            : <React.Fragment>
              <Dialog
                isOpen={isOpen}
                /*onClose={this.maybeCloseEditorWithoutSaving.bind(this)}*/
                title="Section Title Editor"
                usePortal={false}
              >
                <div className="bp3-dialog-body">

                  <div className="cms-dialog-locale-group">
                    <div className="cms-dialog-locale-container">
                      {locale &&
                        <LocaleName locale={localeDefault} />
                      }
                      <TextEditor 
                        contentType="test" 
                        /* markAsDirty={this.markAsDirty.bind(this)} */
                        data={sectionTitleObject} 
                        locale={localeDefault} 
                        variables={variables} 
                        fields={["title"]} 
                      />
                    </div>

                    {locale &&
                      <div className="cms-dialog-locale-container">
                        <LocaleName locale={locale} />
                        <TextEditor 
                          contentType="test2" 
                          /* markAsDirty={this.markAsDirty.bind(this)} */
                          data={sectionTitleObject} 
                          locale={locale} 
                          variables={variables} 
                          fields={["title"]} />
                      </div>
                    }
                  </div>
                </div>

                <FooterButtons
                  onSave={this.save.bind(this)}
                />
              </Dialog>
              <span className="cms-header-title-parent">{parentTitle} </span>
              <span className="cms-header-title-main">
                {prettySectionTitle}
                <Button className="cms-header-title-button u-font-xs" context="cms" onClick={() => this.setState({isOpen: !this.state.isOpen})} icon="cog" iconOnly>
                  rename section
                </Button>
              </span>
            </React.Fragment>
          }
        </h1>

        <span className="cms-header-link-container">
          {dimensions && dimensions.length
            // proper URL can be constructed
            ? <a href={previewURL} className={`cms-header-link ${previewURL.length > 60 ? "u-font-xs" : ""}`}>
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
          {(slug || slug === "") && dimensions && dimensions.length
            ? <React.Fragment>#
              <span className="cms-header-link-slug">
                <EditableText
                  value={slug}
                  onChange={slug => this.setState({slug: this.urlPrep(slug)})}
                  selectAllOnFocus={true}
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

Header.contextTypes = {
  formatters: PropTypes.object
};

export default Header;
