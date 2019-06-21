import React, {Component} from "react";
import {Icon} from "@blueprintjs/core";
import "./FilterSearch.css";

export default class FilterSearch extends Component {
  render() {
    const {label, value, onChange, onReset} = this.props;

    return (
      <label className="cms-filter-search">
        <span className="u-visually-hidden cms-filter-search-text">{label}</span>
        <input
          className="cms-filter-search-input"
          type="search"
          placeholder={label}
          value={value}
          onChange={onChange}
          ref={this.input}
        />

        {/* search icon */}
        <Icon className="cms-filter-search-icon" icon="filter" />

        {/* close button */}
        <button className="cms-filter-search-close-button" tabIndex={ value && value.length ? 0 : -1 } onClick={onReset}>
          <span className="u-visually-hidden">reset search</span>
          <Icon className="cms-filter-search-close-button-icon" icon="cross" />
        </button>
      </label>
    );
  }
}