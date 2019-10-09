import React, {Component} from "react";
import "./QuillWrapper.css";

let Quill;

if (typeof window !== "undefined") {
  Quill = require("react-quill");
  require("react-quill/dist/quill.snow.css");
}

class QuillWrapper extends Component {

  constructor(props) {
    super(props);
    this.state = {
      toolbarVisible: false
    };
  }

  toggleToolbar() {
    this.setState({toolbarVisible: !this.state.toolbarVisible});
  }

  render() {
    if (Quill) {
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
        }
      };
      return <div className={this.state.toolbarVisible ? "toolbar-visible" : "toolbar-hidden"}>
        <button onClick={this.toggleToolbar.bind(this)}>Button</button>
        <Quill
          theme="snow"
          modules={modules}
          onChangeSelection={range => range ? this.setState({currentRange: range}) : null}
          ref={c => this.quillRef = c}
          {...this.props}
        />
      </div>;
    }
    return null;
  }
}

export default QuillWrapper;
