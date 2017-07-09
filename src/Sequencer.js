import React, { Component } from 'react';
import _ from 'lodash';
import classNames from 'classnames';
import update from 'immutability-helper';
import AudioSequencer from './audio/Sequencer';

class Sequencer extends Component {
  constructor(props) {
    super(props);

    this.state = {
      sequences: this.getInitialSequences(),
    };

    this.onClickPlay = this.onClickPlay.bind(this);
    this.onClickReset = this.onClickReset.bind(this);
    this.onClickSequenceItem = this.onClickSequenceItem.bind(this);
  }

  onClickPlay() {
    console.log('onClickPlay', this.state.sequences);

    const normalizedSequences = Object.keys(this.state.sequences).map((offset) => {
      const activeTimeIndexes = Object.keys(this.state.sequences[offset]).filter((timeIndex) => {
        return this.state.sequences[offset][timeIndex];
      });

      return activeTimeIndexes.map((timeIndex) => {
        return [440 + 20 * offset, timeIndex * 0.5, 0.5];
      });
    }).filter((sequence) => {
      return sequence.length > 0
    });

    console.log(normalizedSequences);
    const audioSequencer = new AudioSequencer(new window.AudioContext(), normalizedSequences);
    audioSequencer.play();
  }

  onClickReset() {
    this.setState({
      sequences: this.getInitialSequences(),
    });
  }

  onClickSequenceItem(offset, timeIndex) {
    console.log('onClickSequenceItem', offset, timeIndex);

    const currentlyActive = this.state.sequences[offset][timeIndex];

    this.setState({
      sequences: update(this.state.sequences, {
        [offset]: {
          [timeIndex]: { $set: !currentlyActive }
        }
      }),
    }, () => console.log(this.state));
  }

  getNumDisplaySteps() {
    return (this.props.numSteps * 2) + 1;
  }

  getNumSequenceItems() {
    return 16;
  }

  getInitialSequences() {
    const sequences = {};
    _.range(this.getNumDisplaySteps()).forEach((offset) => {
      sequences[offset] = {};
      _.range(this.getNumSequenceItems()).forEach((timeIndex) => {
        sequences[offset][timeIndex] = false;
      });
    });
    return sequences;
  }

  render() {
    return (
      <div>
        <button className="btn btn-secondary" onClick={this.onClickPlay}>Play</button>
        <button className="btn btn-secondary" onClick={this.onClickReset}>Reset</button>

        {
          _.range(this.getNumDisplaySteps() - 1, -1, -1).map((offset) => {
            return (
              <div className="row no-gutters" key={offset}>
                <div className="col-1">
                  <div className="text-right pr-2">{offset}</div>
                </div>
                <div className="col">
                  <div className="row no-gutters">
                    {
                      _.range(this.getNumSequenceItems()).map((timeIndex) => {
                        return (
                          <div
                            className={classNames('col', 'sequence-item', { 'sequence-item-active': this.state.sequences[offset][timeIndex] })}
                            key={timeIndex}
                            onClick={this.onClickSequenceItem.bind(this, offset, timeIndex)}
                          >
                            <div className="text-center text-muted">{timeIndex}</div>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              </div>
            );
          })
        }
      </div>
    );
  }
}

export default Sequencer;
