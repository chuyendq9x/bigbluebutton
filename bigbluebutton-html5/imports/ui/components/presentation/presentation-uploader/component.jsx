import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { defineMessages, injectIntl, FormattedDate } from 'react-intl';
import Dropzone from 'react-dropzone';
import update from 'immutability-helper';
import cx from 'classnames';

import ModalFullscreen from '/imports/ui/components/modal/fullscreen/component';
import Icon from '/imports/ui/components/icon/component';
import ButtonBase from '/imports/ui/components/button/base/component';
import Checkbox from '/imports/ui/components/checkbox/component';
import styles from './styles.scss';

const DEFAULT_FILENAME = 'default.pdf';

const propTypes = {
  defaultFileName: PropTypes.string.isRequired,
  fileSizeMin: PropTypes.number.isRequired,
  fileSizeMax: PropTypes.number.isRequired,
  handleSave: PropTypes.func.isRequired,
  fileValidMimeTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  presentations: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    filename: PropTypes.string.isRequired,
    isCurrent: PropTypes.bool.isRequired,
    conversion: PropTypes.object,
    upload: PropTypes.object,
  })).isRequired,
};

const defaultProps = {
  defaultFileName: 'default.pdf',
};

const intlMessages = defineMessages({
  title: {
    id: 'app.presentationUploder.title',
    defaultMessage: 'Presentation',
  },
  message: {
    id: 'app.presentationUploder.message',
    defaultMessage: `As a presenter in BigBlueButton, you have the ability of
     uploading any office document or PDF file. We recommend for the best results,
     to please upload a PDF file.`,
  },
  confirmLabel: {
    id: 'app.presentationUploder.confirmLabel',
    defaultMessage: 'Start',
  },
  confirmDesc: {
    id: 'app.presentationUploder.confirmDesc',
    defaultMessage: 'Save your changes and start the presentation',
  },
  dismissLabel: {
    id: 'app.presentationUploder.dismissLabel',
    defaultMessage: 'Cancel',
  },
  dismissDesc: {
    id: 'app.presentationUploder.dismissDesc',
    defaultMessage: 'Closes and discarts your changes',
  },
  dropzoneLabel: {
    id: 'app.presentationUploder.dropzoneLabel',
    defaultMessage: 'Drag files here to upload',
  },
  browseFilesLabel: {
    id: 'app.presentationUploder.browseFilesLabel',
    defaultMessage: 'or browse for files',
  },
  fileToUpload: {
    id: 'app.presentationUploder.fileToUpload',
    defaultMessage: 'To be uploaded...',
  },
  uploadProcess: {
    id: 'app.presentationUploder.upload.progress',
    defaultMessage: 'Uploading ({progress}%)',
  },
  413: {
    id: 'app.presentationUploder.upload.413',
    defaultMessage: 'File is too large.',
  },
  conversionProcessingSlides: {
    id: 'app.presentationUploder.conversion.conversionProcessingSlides',
    defaultMessage: 'Processing page {current} of {total}',
  },
  genericConversionStatus: {
    id: 'app.presentationUploder.conversion.genericConversionStatus',
    defaultMessage: 'Converting file...',
  },
  GENERATING_THUMBNAIL: {
    id: 'app.presentationUploder.conversion.generatingThumbnail',
    defaultMessage: 'Generating thumbnails...',
  },
  GENERATED_SLIDE: {
    id: 'app.presentationUploder.conversion.generatedSlides',
    defaultMessage: 'Slides generated...',
  },
});

const isProcessingOrUploading = item => item && (!item.conversion.done || !item.upload.done);

function updateFileUploadState(id, state) {
  this.setState(({ presentations }) => {
    const fileIndex = presentations.findIndex(f => f.id === id);
    return {
      presentations: update(presentations, {
        [fileIndex]: { $apply: file =>
          update(file, {
            upload: { $apply: upload => update(upload, { $merge: state }) },
          }),
        },
      }),
    };
  });
}

class PresentationUploader extends Component {
  constructor(props) {
    super(props);

    this.state = {
      presentations: props.presentations,
      preventClosing: false,
      disableActions: false,
    };

    this.handleConfirm = this.handleConfirm.bind(this);
    this.handleDismiss = this.handleDismiss.bind(this);
    this.handleFiledrop = this.handleFiledrop.bind(this);
    this.handleCurrentChange = this.handleCurrentChange.bind(this);
    this.handleRemove = this.handleRemove.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const presentationStateUpdated =
      this.state.presentations.map(p =>
        nextProps.presentations.find(_ => _.filename === p.filename));

    const stillBusy = presentationStateUpdated.some(isProcessingOrUploading);

    this.setState({
      presentations: presentationStateUpdated,
      preventClosing: stillBusy,
      disableActions: stillBusy,
    });
  }

  handleConfirm() {
    const { presentations } = this.state;

    this.setState({
      disableActions: true,
      preventClosing: true,
    });

    return this.props.handleSave(presentations);
  }

  handleDismiss() {
    return new Promise((resolve) => {
      this.setState({
        preventClosing: false,
        disableActions: false,
      }, resolve);
    });
  }

  handleFiledrop(files) {
    const presentationsToUpload = files.map(file => ({
      id: file.name,
      file,
      filename: file.name,
      isCurrent: false,
      conversion: { done: false, error: false },
      upload: { done: false, error: false, progress: 0 },
      onProgress: (event) => {
        if (!event.lengthComputable) return;

        updateFileUploadState.call(this, file.name, {
          progress: (event.loaded / event.total) * 100,
          done: event.loaded === event.total,
        });
      },
      onError: (error) => {
        updateFileUploadState.call(this, file.name, { error });
      },
    }));

    this.setState(({ presentations }) => ({
      presentations: presentations.concat(presentationsToUpload),
    }));
  }

  handleCurrentChange(item) {
    const { presentations } = this.state;
    const currentIndex = presentations.findIndex(p => p.isCurrent);
    const newCurrentIndex = presentations.indexOf(item);

    const commands = {};
    commands[currentIndex] = {
      $apply: (_) => {
        const p = _;
        p.isCurrent = false;
        return p;
      },
    };
    commands[newCurrentIndex] = {
      $apply: (_) => {
        const p = _;
        p.isCurrent = true;
        return p;
      },
    };

    const presentationsUpdated = update(presentations, commands);

    this.setState({
      presentations: presentationsUpdated,
    });
  }

  handleRemove(item) {
    const { presentations } = this.state;
    const toRemoveIndex = presentations.indexOf(item);
    const toRemove = presentations[toRemoveIndex];

    if (toRemove.isCurrent) {
      const defaultPresentation = presentations.find(_ => _.filename === DEFAULT_FILENAME);
      this.handleCurrentChange(defaultPresentation);
    }

    this.setState({
      presentations: update(presentations, {
        $splice: [[toRemoveIndex, 1]],
      }),
    });
  }

  renderPresentationList() {
    const { presentations } = this.state;

    const presentationsSorted = presentations
      .sort((a, b) => b.filename === DEFAULT_FILENAME);

    return (
      <div className={styles.fileList}>
        <table className={styles.table}>
          <tbody>
            { presentationsSorted.map(item => this.renderPresentationItem(item))}
          </tbody>
        </table>
      </div>
    );
  }

  renderPresentationItemStatus(item) {
    const { intl } = this.props;

    if (!item.upload.done && item.upload.progress === 0) {
      return intl.formatMessage(intlMessages.fileToUpload);
    }

    if (!item.upload.done && !item.upload.error) {
      return intl.formatMessage(intlMessages.uploadProcess, {
        progress: item.upload.progress,
      });
    }

    if (item.upload.done && item.upload.error) {
      const errorMessage = intlMessages[item.upload.error.code] || intlMessages.genericError;
      return intl.formatMessage(errorMessage);
    }

    if (!item.conversion.done && item.conversion.error) {
      const errorMessage = intlMessages[status] || intlMessages.genericError;
      return intl.formatMessage(errorMessage);
    }

    if (!item.conversion.done && !item.conversion.error) {
      if (item.conversion.pagesCompleted < item.conversion.numPages) {
        return intl.formatMessage(intlMessages.conversionProcessingSlides, {
          current: item.conversion.pagesCompleted,
          total: item.conversion.numPages,
        });
      }

      const conversionStatusMessage =
        intlMessages[item.conversion.status] || intlMessages.genericConversionStatus;
      return intl.formatMessage(conversionStatusMessage);
    }

    return null;
  }

  renderPresentationItem(item) {
    const { disableActions } = this.state;

    const itemClassName = {};

    itemClassName[styles.tableItemNew] = item.id === item.filename;
    itemClassName[styles.tableItemUploading] = !item.upload.done;
    itemClassName[styles.tableItemProcessing] = !item.conversion.done;
    itemClassName[styles.tableItemError] = item.conversion.error || item.upload.error;
    itemClassName[styles.tableItemAnimated] =
      !item.conversion.done && (!item.upload.done && item.upload.progress > 0);

    const hideRemove = (item.isCurrent && item.upload.done) || item.filename === DEFAULT_FILENAME;

    return (
      <tr
        key={item.id}
        className={cx(itemClassName)}
      >
        <td className={styles.tableItemIcon}>
          <Icon iconName={'file'} />
        </td>
        <th className={styles.tableItemName}>
          <span>{item.filename}</span>
        </th>
        <td className={styles.tableItemStatus}>
          {this.renderPresentationItemStatus(item)}
        </td>
        <td className={styles.tableItemActions}>
          <Checkbox
            disabled={disableActions}
            ariaLabel={'Set as current presentation'}
            className={styles.itemAction}
            checked={item.isCurrent}
            onChange={() => this.handleCurrentChange(item)}
          />
          { hideRemove ? null : (
            <ButtonBase
              disabled={disableActions}
              className={cx(styles.itemAction, styles.itemActionRemove)}
              label={'Remove presentation'}
              onClick={() => this.handleRemove(item)}
            >
              <Icon iconName={'delete'} />
            </ButtonBase>
          )}
        </td>
      </tr>
    );
  }

  renderDropzone() {
    const {
      intl,
      fileSizeMin,
      fileSizeMax,
      fileValidMimeTypes,
    } = this.props;

    const { disableActions } = this.state;

    const hasSomeFileNotUploaded = this.state.presentations.some(_ => !_.upload.done);

    if (hasSomeFileNotUploaded || disableActions) return null;

    return (
      <Dropzone
        multiple
        className={styles.dropzone}
        activeClassName={styles.dropzoneActive}
        rejectClassName={styles.dropzoneReject}
        accept={fileValidMimeTypes.join()}
        minSize={fileSizeMin}
        maxSize={fileSizeMax}
        disablePreview
        onDrop={this.handleFiledrop}
      >
        <Icon className={styles.dropzoneIcon} iconName={'upload'} />
        <p className={styles.dropzoneMessage}>
          {intl.formatMessage(intlMessages.dropzoneLabel)}&nbsp;
          <span className={styles.dropzoneLink}>
            {intl.formatMessage(intlMessages.browseFilesLabel)}
          </span>
        </p>
      </Dropzone>
    );
  }

  render() {
    const { intl } = this.props;
    const { preventClosing, disableActions } = this.state;

    return (
      <ModalFullscreen
        title={intl.formatMessage(intlMessages.title)}
        preventClosing={preventClosing}
        confirm={{
          callback: this.handleConfirm,
          label: intl.formatMessage(intlMessages.confirmLabel),
          description: intl.formatMessage(intlMessages.confirmDesc),
          disabled: disableActions,
        }}
        dismiss={{
          callback: this.handleDismiss,
          label: intl.formatMessage(intlMessages.dismissLabel),
          description: intl.formatMessage(intlMessages.dismissDesc),
          disabled: disableActions,
        }}
      >
        <p>{intl.formatMessage(intlMessages.message)}</p>
        {this.renderPresentationList()}
        {this.renderDropzone()}
      </ModalFullscreen>
    );
  }
}

export default injectIntl(PresentationUploader);
