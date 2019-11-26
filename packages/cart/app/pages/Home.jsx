import React, {Component} from "react";
import {Menu, MenuItem, Position, Popover, Button, Card} from "@blueprintjs/core";

import {AddToCartControl, clearCartAction} from "../../src/";

import {connect} from "react-redux";

import "./Home.css";

class Home extends Component {

  constructor(props) {
    super(props);
    this.state = {
      source: null,
      selectedQuery: false
    };

    this.changeSource = this.changeSource.bind(this);
    this.changeExampleVisBuilder = this.changeExampleVisBuilder.bind(this);
  }

  exampleList = {
    "DataChile": {
      engine: "mondrian",
      list: [
        {title: "Crimes by Crime Group in Region Metropolitana", query: "https://chilecube.datachile.io/cubes/crimes/aggregate.json?drilldown%5B%5D=%5BGeography%5D.%5BRegion%5D&drilldown%5B%5D=%5BCrime%5D.%5BCrime+Group%5D&cut%5B%5D=%5BGeography%5D.%5BGeography%5D.%5BRegion%5D.%26%5B13%5D&measures%5B%5D=Cases&nonempty=true&distinct=false&parents=false&debug=true&sparse=true", tooltip: true},
        {title: "Number of Visas in Region Valparaiso", query: "https://chilecube.datachile.io/cubes/immigration/aggregate.jsonrecords?drilldown%5B%5D=%5BGeography%5D.%5BRegion%5D&cut%5B%5D=%5BGeography%5D.%5BGeography%5D.%5BRegion%5D.%26%5B5%5D&measures%5B%5D=Number+of+visas&nonempty=true&distinct=false&parents=false&debug=true&sparse=true", tooltip: false},
        {title: "Income by Region", query: "https://chilecube.datachile.io/cubes/nesi_income/aggregate.json?drilldown%5B%5D=%5BGeography%5D.%5BRegion%5D&measures%5B%5D=Income&measures%5B%5D=Median+Income&nonempty=true&distinct=false&parents=false&debug=true&sparse=true", tooltip: true}
      ]
    },
    "DataMexico 1": {
      engine: "logiclayer",
      list: [
        {title: "Products imports Aguascalientes", query: "https://api.datamexico.org/tesseract/data?State=1&cube=economy_foreign_trade_ent&drilldowns=HS4&measures=Trade+Value&parents=true&sparse=false&locale=undefined&Year=2018&Flow=1", tooltip: false},
        {title: "Markets imports Aguascalientes", query: "https://api.datamexico.org/tesseract/data?State=1&cube=economy_foreign_trade_ent&drilldowns=Country&measures=Trade+Value&parents=true&sparse=false&locale=undefined&Year=2018&Flow=1", tooltip: true}
      ]
    },
    "DataMexico 2": {
      engine: "tesseract",
      list: [
        {title: "Households by Home Type and State", query: "https://api.datamexico.org/tesseract/cubes/inegi_housing/aggregate.jsonrecords?drilldowns%5B%5D=Geography.State&drilldowns%5B%5D=Home+Type.Home+Type&measures%5B%5D=Households&parents=false&sparse=false", tooltip: true},
        {title: "Population by Job Situation and State", query: "https://api.datamexico.org/tesseract/cubes/inegi_population/aggregate.jsonrecords?drilldowns%5B%5D=Geography.State&drilldowns%5B%5D=JobSituation.JobSituation&measures%5B%5D=Population&parents=false&sparse=false", tooltip: false}
      ]
    },
    "OEC World": {
      engine: "tesseract",
      list: [
        {title: "Trade value by continent", query: "https://api.oec.world/tesseract/cubes/oec_trade_i_comtrade_m_hs/aggregate.jsonrecords?drilldowns%5B%5D=Reporter.Geography.Continent&measures%5B%5D=Trade+Value&parents=false&sparse=false", tooltip: true},
        {title: "Qty trade by continent", query: "https://api.oec.world/tesseract/cubes/oec_trade_i_baci_a_92/aggregate.jsonrecords?drilldowns%5B%5D=Exporter.Geography.Continent&measures%5B%5D=Quantity&parents=false&sparse=false", tooltip: false}
      ]
    }
  };

  changeSource = source => {
    this.props.dispatch(clearCartAction());
    this.setState({source, selectedQuery: this.exampleList[source].list[0]});
  }

  changeExampleVisBuilder = item => {
    this.setState({selectedQuery: item});
  }

  render() {
    const {source, selectedQuery} = this.state;
    let queryList = [];
    if (this.exampleList[source]) {
      queryList = this.exampleList[source].list;
    }
    const sources = Object.keys(this.exampleList);

    const exampleMenu = <Menu>
      {sources.map((s, ix) =>
        <MenuItem key={ix} text={`${s} [${this.exampleList[s].engine}]`} active={source === s} onClick={() => this.changeSource(s)} />
      )}
    </Menu>;

    return (
      <div id="home">
        <div className="content">
          <div className="row">
            <div className="col-full">
              <Popover content={exampleMenu} position={Position.RIGHT_TOP}>
                <Button icon="multi-select" text={`${source ? `${source} examples [${this.exampleList[source].engine}]` : "Choose a real world example site"}`} />
              </Popover>
            </div>
          </div>
          <div className="row">
            <div className="col-half">
              {this.exampleList[source] && <div>
                <h2>Multiple instances of AddToCartControl like a profile has embeded in charts</h2>
                {queryList.map((q, ix) =>
                  <Card key={ix}>
                    <h3>{q.title}</h3>
                    <p><small>(tooltip: {q.tooltip ? "true" : "false"})</small></p>
                    <AddToCartControl query={q.query} tooltip={q.tooltip} />
                  </Card>
                )}
              </div>}
            </div>
            <div className="col-half">
              {this.exampleList[source] && <div>
                <h2>Single instance of AddToCartControl and change the query prop like VisBuilder do</h2>
                <Card>
                  {queryList.map((q, ix) =>
                    <Button key={ix} text={q.title} active={selectedQuery.query === q.query} onClick={() => this.changeExampleVisBuilder(q)} />
                  )}
                  <h3>{selectedQuery.title}</h3>
                  <p><small>(tooltip: {selectedQuery.tooltip ? "true" : "false"})</small></p>
                  <AddToCartControl query={selectedQuery.query} tooltip={selectedQuery.tooltip} />
                </Card>
              </div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

}

export default connect()(Home);
