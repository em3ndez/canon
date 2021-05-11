import React, {Component, Fragment} from "react";
import {connect} from "react-redux";
import {nest} from "d3-collection";
import {hot} from "react-hot-loader/root";
import PropTypes from "prop-types";
import {Dialog} from "@blueprintjs/core";

import {strip} from "d3plus-text";
const filename = str => strip(str.replace(/<[^>]+>/g, ""))
  .replace(/^\-/g, "")
  .replace(/\-$/g, "");

import stripHTML from "../../utils/formatters/stripHTML";

import Viz from "../Viz/Viz";
import SourceGroup from "../Viz/SourceGroup";
import StatGroup from "../Viz/StatGroup";

import Button from "../fields/Button";

import PDFButton from "./components/PDFButton";
import Parse from "./components/Parse";
import ProfileSearch from "../fields/ProfileSearch";

import "./Section.css";
import "./Hero.css";

/** the profile hero, AKA header, AKA splash */
class Hero extends Component {

  constructor(props) {

    super(props);
    const {contents, profile} = props;

    /** Image Metadata
      * A profile is a set of one more slug/id pairs. In multi-variate profiles, these pairs are strictly
      * ordered, for example, /geo/mass/export/coal/import/cars. Each of these slug/id pairs may or may not
      * have image data associated with it, which makes up the backdrop of the Hero Section. If it does have
      * an image, then it also will have metadata. The `images` array that I create is a strictly ordered
      * array of image links and their data. This means, in the example above, if /export/coal is the only
      * one of the three that have an image, then this image array will be [null, {imageData}, null].
      */

    const {dims} = profile;
    const images = [];
    if (dims) {
      for (let i = 0; i < dims.length; i++) {
        if (profile.images[i]) {
          images.push({
            src: `/api/image?slug=${dims[i].slug}&memberSlug=${dims[i].memberSlug}&size=splash`,
            author: profile.images[i].author,
            meta: profile.images[i].meta,
            permalink: profile.images[i].url
          });
        }
      }
    }

    this.state = {
      contents,
      loading: false,
      selectors: {},
      sources: [],
      images,
      creditsVisible: false,
      clickedIndex: undefined
    };

    if (typeof window !== "undefined") window.titleClick = this.titleClick.bind(this);
  }

  titleClick(index) {
    this.setState({clickedIndex: index});
    setTimeout(() => {
      document.querySelector(".cp-hero-search .cp-input").focus();
    }, 300);
  }

  spanifyTitle(title) {
    const {profile} = this.props;
    const {variables} = profile;
    // stories don't have variables
    if (!variables) return title;
    const {name1, name2} = variables;
    // some titles have <> signs in them. encode them, so the span doesn't break.
    const fixHTML = d => d ? d.replace(/\</g, "&lt;").replace(/\>/g, "&gt;") : d;
    if (title) {
      return title
        .replace(name1, `<span class="cp-hero-heading-dimension" title=${fixHTML(name1)} onClick=titleClick(0)>${fixHTML(name1)}</span>`)
        .replace(name2, `<span class="cp-hero-heading-dimension" title=${fixHTML(name2)} onClick=titleClick(1)>${fixHTML(name2)}</span>`);
    }
    else {
      return title;
    }
  }

  render() {
    const {contents, loading, sources, profile} = this.props;
    const {images, creditsVisible, clickedIndex} = this.state;
    const {searchProps} = this.context;

    let title = this.spanifyTitle(profile.title);
    let paragraphs, sourceContent, statContent, subtitleContent;

    if (contents) {
      title = this.spanifyTitle(contents.title);
      // subtitles
      if (contents.subtitles.length) {
        subtitleContent = contents.subtitles.map((subhead, i) =>
          <Parse className="cp-section-subhead display cp-hero-subhead" key={`${subhead.subtitle}-subhead-${i}`}>
            {subhead.subtitle}
          </Parse>
        );
      }

      // stats
      if (contents.stats.length > 0) {
        const statGroups = nest().key(d => d.title).entries(contents.stats);

        statContent = <div className={`cp-stat-group-wrapper cp-hero-stat-group-wrapper${statGroups.length === 1 ? " single-stat" : ""}`}>
          {statGroups.map(({key, values}) => <StatGroup className="cp-hero-stat" key={key} title={key} stats={values} />)}
        </div>;
      }

      // descriptions
      if (contents.descriptions.length) {
        paragraphs = loading
          ? <p>Loading...</p>
          : contents.descriptions.map((content, i) =>
            <Parse className="cp-section-paragraph cp-hero-paragraph" key={`hero-paragraph-${i}`}>
              {content.description}
            </Parse>
          );
      }

      // sources
      sourceContent = <SourceGroup sources={sources} />;
    }

    // heading & subhead(s)
    const heading = <div className="cp-hero-heading-wrapper">
      <Parse El="h1" id={contents ? contents.slug : `${stripHTML(profile.title)}-hero`} className="cp-section-heading cp-hero-heading u-font-xxl">
        {title}
      </Parse>
      {subtitleContent}
    </div>;

    // custom images can be uploaded with no flickr source. Only show the "image credits" section
    // if at least one of the images has the flickr data to show
    const hasFlickrSource = images.some(d => !d.permalink.includes("custom-image"));

    return (
      <header className="cp-section cp-hero">
        <div className="cp-section-inner cp-hero-inner">
          <PDFButton className="cp-hero-pdf" filename={filename(profile.title)} />
          {/* caption */}
          <div className="cp-section-content cp-hero-caption">
            {heading}
            {statContent}
            {paragraphs}
            {sourceContent}
          </div>

          {/* print the first visualization */}
          {contents && contents.visualizations && contents.visualizations.length
            ? <div className="cp-hero-figure">
              {contents.visualizations.map((visualization, ii) => ii === 0
                ? <Viz
                  section={this}
                  config={visualization}
                  showTitle={false}
                  sectionTitle={title}
                  hideOptions
                  slug={contents.slug}
                  key={ii}
                />
                : ""
              )}
            </div> : ""
          }
        </div>

        {/* display image credits, and images */}
        {images.length
          ? <Fragment>
            {/* credits */}
            { hasFlickrSource &&
              <div className={`cp-hero-credits ${creditsVisible ? "is-open" : "is-closed"}`}>
                <Button
                  className="cp-hero-credits-button"
                  onClick={() => this.setState({creditsVisible: !creditsVisible})}
                  icon={creditsVisible ? "eye-off" : "eye-open"}
                  iconPosition="left"
                  fontSize="xxs"
                  active={creditsVisible}
                >
                  <span className="u-visually-hidden">
                    {creditsVisible ? "view " : "hide "}
                  </span>
                  image credits
                </Button>

                {creditsVisible
                  ? <ul className="cp-hero-credits-list">
                    {images.map((img, i) =>
                      <li className="cp-hero-credits-item" key={img.permalink}>
                        {images.length > 1
                          ? <h2 className="cp-hero-credits-item-heading u-font-md">
                            Image {i + 1}
                          </h2> : ""
                        }

                        {/* author */}
                        {img.author
                          ? <p className="cp-hero-credits-text">
                            Photograph by <span className="cp-hero-credits-name heading">
                              {img.author}
                            </span>
                          </p> : ""
                        }
                        {/* description */}
                        {img.meta ? <p className="cp-hero-credits-text">
                          {img.meta}
                        </p> : ""}
                        {/* flickr link */}
                        {img.permalink && !img.permalink.includes("custom-image") ? <p className="cp-hero-credits-text u-font-xs">
                          <span className="u-visually-hidden">Direct link: </span>
                          <a className="cp-hero-credits-link" href={img.permalink}>
                            {img.permalink.replace("https://", "")}
                          </a>
                        </p> : ""}
                      </li>
                    )}
                  </ul> : ""
                }
              </div>
            }

            {/* images */}
            <div className="cp-hero-img-outer">
              <div className="cp-hero-img-overlay" />
              <div className="cp-hero-img-grid">
                {images.map(img => img.src &&
                  <div className="cp-hero-img-wrapper" key={img.src}>
                    <img className="cp-hero-img" src={img.src} alt="" draggable="false" />
                  </div>
                )}
              </div>
            </div>
          </Fragment> : ""
        }
        <Dialog
          className="cp-hero-search"
          isOpen={clickedIndex !== undefined}
          onClose={() => this.setState({clickedIndex: undefined})}
        >
          <ProfileSearch
            defaultProfiles={`${profile.id}`}
            defaultQuery={stripHTML(contents.title)}
            filters={true}
            inputFontSize="lg"
            display="grid"
            {...searchProps}
          />
        </Dialog>

      </header>
    );
  }
}

Hero.contextTypes = {
  router: PropTypes.object,
  searchProps: PropTypes.object
};

export default connect(state => ({
  locale: state.i18n.locale
}))(hot(Hero));
