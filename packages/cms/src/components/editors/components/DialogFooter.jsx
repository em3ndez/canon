import React, {Component} from "react";
import {hot} from "react-hot-loader/root";

import Button from "../../fields/Button";

import "./DialogFooter.css";

class DialogFooter extends Component {

  render() {
    const {children, onDelete, onSave, onSaveJump} = this.props;

    return (
      <div className="cms-dialog-footer">
        {children}

        {onDelete &&
          <Button
            className="cms-dialog-footer-button cms-dialog-footer-delete-button"
            onClick={onDelete}
            namespace="cms"
            fontSize="xs"
            icon="trash"
            iconPosition="left"
            key="d"
          >
            Delete
          </Button>
        }

        {onSaveJump && <Button
          className="cms-dialog-footer-button cms-dialog-footer-save-button"
          onClick={onSaveJump}
          namespace="cms"
          fontSize="xs"
          icon="document-open"
          iconPosition="left"
          key="j"
        >
          Save & Open Previous
        </Button>
        }

        <Button
          className="cms-dialog-footer-button cms-dialog-footer-save-button"
          onClick={onSave}
          namespace="cms"
          fontSize="xs"
          icon="tick-circle"
          iconPosition="left"
          key="s"
        >
          Save & close
        </Button>
      </div>
    );
  }
}

export default hot(DialogFooter);
