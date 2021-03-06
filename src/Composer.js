import React from 'react';
import _ from 'lodash';
import classNames from 'classnames';
import shortid from 'shortid';
import update from 'immutability-helper';

import audioContext from './audioContext';
import AudioSequencer from './audio/Sequencer';
import { getCentsForNote, getNoteFromOffset, getStepFrequencies } from './noteHelpers';

// TODO: rename timeIndex => stepIndex
function buildSequences({ selectedSteps, frequencies, stepDuration }) {
  return Object.keys(selectedSteps)
    .map((offset) => {
      const selectedStepIndexes = Object.keys(selectedSteps[offset]).filter((timeIndex) => {
        return selectedSteps[offset][timeIndex];
      });
      const frequency = frequencies[offset % frequencies.length];
      return selectedStepIndexes.map((timeIndex) => {
        return [frequency, timeIndex * stepDuration, stepDuration];
      });
    })
    .filter((sequence) => {
      return sequence.length > 0;
    });
}

function Step(props) {
  const onClick = props.selected ? props.onDeselect : props.onSelect;
  // TODO: implement with onMouseDown instead? would change a flag on mouseDown so mouseEnter selects
  return (
    <div
      className={classNames('col sequence-item py-1', {
        'sequence-item-selected': props.selected,
        'sequence-item-current': props.current,
      })}
      draggable
      onClick={onClick}
      onDragEnter={props.onSelect}
      onDragStart={props.onSelect}
    />
  );
}

function ComposerSettings(props) {
  return (
    <div className="d-flex flex-row mb-3">
      <div className="flex-1">
        <div className="btn-group">
          <button className="btn btn-primary" onClick={props.onPlay}>
            Play
          </button>
          <button className="btn btn-secondary" onClick={props.onStop}>
            Stop
          </button>
        </div>
        <button className="ml-2 btn btn-outline-secondary" onClick={props.onClear}>
          Clear
        </button>
      </div>
      <div>
        <button className="btn btn-outline-secondary" onClick={props.onExport}>
          Export as JSON
        </button>
      </div>
    </div>
  );
}

class Composer extends React.Component {
  constructor(props) {
    super(props);

    const frequencies = getStepFrequencies(props.config);
    this.state = {
      // TODO: move out of state? create higher order component
      frequencies,
      selectedSteps: this.getInitialSelectedSteps(frequencies),
      currentStep: 0,
    };

    this.updateCurrentStepAtInterval = null;
    this.currentAudioSequencer = null;
  }

  componentDidMount() {
    if (this.props.shortID) {
      fetch(`/api/compositions/${this.props.shortID}`)
        .then((response) => response.json())
        .then(({ data }) => {
          // TODO: load scale config
          console.log('loaded composition', data);
        });
    }
  }

  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(this.props.config, nextProps.config)) {
      this.onStop();
      const frequencies = getStepFrequencies(nextProps.config);
      this.setState({
        frequencies,
        selectedSteps: this.getInitialSelectedSteps(frequencies),
      });
    }
  }

  onPlay = () => {
    this.onStop();
    const stepDuration = this.getStepDuration();
    const numSteps = this.getNumSteps();
    const sequences = buildSequences({
      selectedSteps: this.state.selectedSteps,
      frequencies: this.state.frequencies,
      stepDuration,
    });
    this.currentAudioSequencer = new AudioSequencer({
      audioContext: audioContext,
      sequences: sequences,
      totalDuration: numSteps * stepDuration,
      gain: this.props.gain,
    });
    this.currentAudioSequencer.play();

    this.updateCurrentStepAtInterval = setInterval(() => {
      this.setState({
        currentStep: (this.state.currentStep + 1) % numSteps,
      });
    }, stepDuration * 1000);
  };

  clearSelectedSteps = (frequencies) => {
    this.setState({
      selectedSteps: this.getInitialSelectedSteps(frequencies),
    });
  };

  onClear = () => {
    this.onStop();
    this.clearSelectedSteps(this.state.frequencies);
  };

  onStop = () => {
    this.setState({
      currentStep: 0,
    });
    clearInterval(this.updateCurrentStepAtInterval);

    if (this.currentAudioSequencer) {
      this.currentAudioSequencer.stop();
    }
  };

  onSelectItem = (offset, timeIndex, value) => {
    this.setState({
      selectedSteps: update(this.state.selectedSteps, {
        [offset]: {
          [timeIndex]: { $set: value },
        },
      }),
    });
  };

  onExport = () => {
    const steps = _.range(this.getNumSteps()).map((stepIndex) => {
      return Object.keys(this.state.selectedSteps)
        .map((offset) => {
          return this.state.selectedSteps[offset][stepIndex] ? offset : null;
        })
        .filter((offset) => offset);
    });

    fetch('/api/compositions', {
      method: 'post',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        short_id: shortid.generate(),
        title: 'untitled',
        json_value: {
          scaleConfig: this.props.config,
          bpm: this.getBeatsPerMinute(),
          // steps[0] contains an array of the notes at step 0
          steps: steps,
        },
      }),
    }).then((response) => {
      console.log('TODO handle composition creation');
    });
  };

  getNumNotes(frequencies) {
    return frequencies.length;
  }

  getNumSteps() {
    return 16;
  }

  getBeatsPerMinute() {
    return 300;
  }

  getStepDuration() {
    return 60 / this.getBeatsPerMinute();
  }

  getInitialSelectedSteps(frequencies) {
    const selectedSteps = {};
    _.range(this.getNumNotes(frequencies)).forEach((offset) => {
      selectedSteps[offset] = {};
      _.range(this.getNumSteps()).forEach((timeIndex) => {
        selectedSteps[offset][timeIndex] = false;
      });
    });
    return selectedSteps;
  }

  renderRow = (offset) => {
    const note = getNoteFromOffset(this.props.config, offset);
    const cents = getCentsForNote(this.props.config, note);
    return (
      <div className="row no-gutters" key={offset}>
        <div className="col-1">
          <div className="text-right pr-2 py-1 line-height-1">
            {note}
            <br />
            <small>{Math.round(cents)}</small>
          </div>
        </div>
        <div className="col">
          <div className="row no-gutters">{this.renderRowSteps(offset)}</div>
        </div>
      </div>
    );
  };

  renderRowSteps = (offset) => {
    return _.range(this.getNumSteps()).map((stepIndex) => {
      const isSelected = this.state.selectedSteps[offset][stepIndex];
      return (
        <Step
          selected={isSelected}
          current={stepIndex === this.state.currentStep}
          onSelect={this.onSelectItem.bind(this, offset, stepIndex, true)}
          onDeselect={this.onSelectItem.bind(this, offset, stepIndex, false)}
          key={stepIndex}
        />
      );
    });
  };

  render() {
    const descendingNoteOffsets = _.range(this.getNumNotes(this.state.frequencies) - 1, -1, -1);
    return (
      <div>
        <ComposerSettings
          onPlay={this.onPlay}
          onStop={this.onStop}
          onClear={this.onClear}
          onExport={this.onExport}
        />
        {descendingNoteOffsets.map((offset) => this.renderRow(offset))}
      </div>
    );
  }
}

export default Composer;
