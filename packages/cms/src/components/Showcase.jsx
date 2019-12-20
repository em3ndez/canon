import React, {Component, Fragment} from "react";
import {hot} from "react-hot-loader/root";

import {AnchorLink} from "@datawheel/canon-core";

import toKebabCase from "../utils/formatters/toKebabCase";
import styles from "style.yml";

import Button from "./fields/Button";
import ButtonGroup from "./fields/ButtonGroup";
import Select from "./fields/Select";
import TextInput from "./fields/TextInput";
import TextButtonGroup from "./fields/TextButtonGroup";
import FilterSearch from "./fields/FilterSearch";

import "./Showcase.css";

const baseDir = "https://github.com/Datawheel/canon/blob/master/packages/cms/src/components";

class Showcase extends Component {
  constructor(props) {
    super(props);
    this.state = {
      namespace: "cms"
    };
  }

  render() {
    const {namespace} = this.state;

    const components = [
      {
        name: "Fields",
        components: [
          {
            name: "Button",
            Component: Button,
            link: `${baseDir}/fields/Button.jsx`,
            props: {
              children: "children as button text",
              icon: "tick",
              iconPosition: "left",
              onClick: () => alert("`onClick` triggered")
            }
          },
          {
            name: "ButtonGroup",
            Component: ButtonGroup,
            link: `${baseDir}/fields/ButtonGroup.jsx`,
            props: {
              buttons: [
                {
                  namespace,
                  active: namespace === "cms",
                  onClick: () => this.setState({namespace: "cms"}),
                  children: "cms"
                },
                {
                  namespace,
                  active: namespace === "cp",
                  onClick: () => this.setState({namespace: "cp"}),
                  children: "cp"
                }
              ]
            }
          },
          {
            name: "TextInput",
            Component: TextInput,
            link: `${baseDir}/fields/TextInput.jsx`,
            props: {
              label: "What's ur password?",
              inline: true,
              type: "password",
              onChange: () => console.log("`onChange` triggered")
            }
          },
          {
            name: "TextButtonGroup",
            Component: TextButtonGroup,
            link: `${baseDir}/fields/TextButtonGroup.jsx`,
            props: {
              inputProps: {
                label: "TextInput + Button in a form",
                placeholder: "focus me & hit enter",
                inline: true,
                namespace
              },
              buttonProps: {
                children: "I don't really do anything",
                icon: "star",
                iconOnly: true,
                onClick: () => alert("`buttonProps.onClick` triggered"),
                namespace
              }
            }
          },
          {
            name: "Select",
            Component: Select,
            link: `${baseDir}/fields/Select.jsx`,
            props: {
              label: "label",
              inline: true,
              onChange: () => console.log("`onChange` triggered"),
              options: [
                "options generated from array passed to `options` prop",
                "or pass options as children",
                "or both if you want"
              ]
            }
          },
          {
            name: "FilterSearch",
            Component: FilterSearch,
            link: `${baseDir}/fields/FilterSearch.jsx`,
            props: {
              label: "Label is also placeholder text",
              onChange: () => console.log("`onChange` triggered"),
              onReset: e => e.target.value = ""
            }
          }
        ]
      }
    ];

    // console.log(this);

    return (
      <div className={`showcase ${namespace}`}>

        {/* header */}
        <header className="showcase-header">
          <h1 className="showcase-header-heading u-margin-top-off">All the components</h1>

          {/* list of links */}
          <nav className="showcase-nav">
            {components.map(group =>
              <Fragment key={`${group.name}-nav-group`}>
                {/* group title */}
                <h2 className="u-font-xs display" key={`${group.name}-nav-title`}>
                  {group.name}
                </h2>
                {/* group components */}
                <ul className="showcase-nav-list">
                  {group.components.map(c =>
                    <li className="showcase-nav-item" key={`${c.name}-nav-nav`}>
                      <AnchorLink className="showcase-nav-link u-font-xs" to={toKebabCase(c.name)}>
                        {c.name}
                      </AnchorLink>
                    </li>
                  )}
                </ul>
              </Fragment>
            )}
          </nav>
        </header>

        {/* list of components */}
        <ul className="showcase-list">
          {components.map(group =>
            <Fragment key={`${group.name}-group`}>
              {/* group title */}
              <h2 className="u-font-md u-margin-top-xs" key={`${group.name}-title`}>
                {group.name}
              </h2>
              {/* group components */}
              <ul className="showcase-nested-list" key={`${group.name}-list`}>
                {group.components.map(c =>
                  <li className="showcase-item" id={toKebabCase(c.name)} key={c.name}>
                    <h3 className="showcase-item-heading u-font-xxs u-margin-top-off u-margin-bottom-xs">
                      <a className="showcase-item-heading-link" href={c.link}>
                        {c.name}
                      </a>
                    </h3>
                    <c.Component namespace={namespace} {...c.props} />
                  </li>
                )}
              </ul>
            </Fragment>
          )}
        </ul>
      </div>
    );
  }
}

export default hot(Showcase);
