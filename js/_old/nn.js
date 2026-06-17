/* nn.js — TensorFlow.js neural network with proper architecture and influence ramp */
'use strict';

class NN {
  constructor() {
    this.model       = null;
    this.isTraining  = false;
    this.totalSamples= 0;
    this.totalEpochs = 0;
    this.lastLoss    = null;
    this._saveEvery  = 5;
    this._saveCounter= 0;

    this._build();
  }

  _build() {
    this.model = tf.sequential();
    this.model.add(tf.layers.dense({ inputShape: [C.NN_FEATURES], units: 48, activation: 'relu' }));
    this.model.add(tf.layers.dropout({ rate: 0.15 }));
    this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    this.model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    this.model.add(tf.layers.dense({ units: C.NN_ACTIONS, activation: 'softmax' }));
    this.model.compile({
      optimizer: tf.train.adam(0.0025),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
  }

  async load() {
    try {
      const m = await tf.loadLayersModel('indexeddb://emergent-nn-v4');
      m.compile({ optimizer: tf.train.adam(0.0025), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
      this.model = m;
      console.log('NN: model loaded');
      return true;
    } catch {
      console.log('NN: fresh model');
      return false;
    }
  }

  async save() {
    try { await this.model.save('indexeddb://emergent-nn-v4'); }
    catch (e) { console.warn('NN: save failed', e); }
  }

  async train(xArr, yArr) {
    if (this.isTraining || xArr.length < 8) return;
    this.isTraining = true;
    let xs, ys;
    try {
      xs = tf.tensor2d(xArr, [xArr.length, C.NN_FEATURES]);
      ys = tf.tensor2d(yArr, [yArr.length, C.NN_ACTIONS]);

      const res = await this.model.fit(xs, ys, {
        epochs: 18,
        batchSize: Math.min(32, xArr.length),
        shuffle: true,
        callbacks: { onEpochEnd: async (_, logs) => {
          this.lastLoss = logs.loss;
          await tf.nextFrame();
        }},
      });
      this.totalEpochs += 18;

      this._saveCounter++;
      if (this._saveCounter % this._saveEvery === 0) await this.save();

      events.emit('NN_TRAINED', { loss: this.lastLoss, epochs: this.totalEpochs, samples: this.totalSamples });
    } catch (e) { console.error('NN train error', e); }
    finally {
      xs?.dispose();
      ys?.dispose();
      this.isTraining = false;
    }
  }

  predict(features) {
    if (!this.model || !features) return null;
    return tf.tidy(() => {
      const xs   = tf.tensor2d([features], [1, C.NN_FEATURES]);
      const pred = this.model.predict(xs);
      const prob = Array.from(pred.dataSync());
      const best = prob.indexOf(Math.max(...prob));
      return { actionIdx: best, action: C.ACTIONS[best], confidence: prob[best], probs: prob };
    });
  }

  /** 0→1 ramp: how much autonomous influence the NN has */
  get influence() {
    return Math.min(1, this.totalSamples / C.NN_INFLUENCE_RAMP);
  }
}
