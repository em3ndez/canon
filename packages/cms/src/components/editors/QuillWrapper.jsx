import React, {Component} from "react";

let Quill;

if (typeof window !== "undefined") {
  Quill = require("react-quill");
  require("react-quill/dist/quill.snow.css");
  require("quill-mention");
  require("quill-mention/dist/quill.mention.css");
}

class QuillWrapper extends Component {

  constructor(props) {
    super(props);
    this.state = {
      modules: {}
    };
  }

  componentDidMount() {
    const variables = Object.keys(this.props.variables)
      .filter(d => typeof d === "string")
      .filter(d => d !== "_genStatus" && d !== "_matStatus")
      .map(d => ({id: d, value: d}));

    const modules = {
      toolbar: [
        ["bold", "italic", "underline", "code", "blockquote", "code-block", "link"],
        [{list: "ordered"}, {list: "bullet"}],
        ["clean"]
      ],
      clipboard: {
        matchVisual: false
      },
      keyboard: {
        bindings: {
          tab: false
        }
      },
      mention: {
        allowedChars: /^[a-zA-Z0-9_]*$/,
        mentionDenotationChars: ["@", "#"],
        showDenotationChar: false,
        source: (searchTerm, renderList, mentionChar) => {
          let values;

          if (mentionChar === "@") {
            values = variables;
          } 
          else {
            values = hashValues;
          }

          if (searchTerm.length === 0) {
            renderList(values, searchTerm);
          } 
          else {
            const matches = [];
            for (let i = 0; i < values.length; i++) {
              if (~values[i].value.toLowerCase().indexOf(searchTerm.toLowerCase())) matches.push(values[i]);
            }
            renderList(matches, searchTerm);
          }
        }
      }
    };
    this.setState({modules});
  }

  render() {
    if (Quill) {
      return <Quill
        theme="snow"
        modules={this.state.modules}
        // onChangeSelection={range => range ? this.setState({currentRange: range}) : null}
        ref={c => this.quillRef = c}
        {...this.props}
      />;
    }
    return null;
  }
}

export default QuillWrapper;
