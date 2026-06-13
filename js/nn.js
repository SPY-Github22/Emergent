

class NN {
    constructor() {
        this.model = null;
        this.actions = ['Feed', 'Connect', 'Guide', 'Approve', 'Correct'];
        this.threshold = 0.8;
        this.isTraining = false;
        this.buildModel();
    }

    buildModel() {
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [7] }));
        this.model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
        this.model.add(tf.layers.dense({ units: 5, activation: 'softmax' }));

        this.model.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy'
        });
    }

    async load() {
        try {
            this.model = await tf.loadLayersModel('indexeddb://emergent-nn-model');
            this.model.compile({
                optimizer: 'adam',
                loss: 'categoricalCrossentropy'
            });
            console.log("NN: Model loaded from IndexedDB.");
        } catch (e) {
            console.log("NN: No saved model found in IndexedDB. Using fresh model.");
        }
    }

    async save() {
        if (this.model) {
            try {
                await this.model.save('indexeddb://emergent-nn-model');
            } catch (e) {
                console.error("NN: Failed to save model", e);
            }
        }
    }

    async train(xTrain, yTrain) {
        if (this.isTraining) return;
        this.isTraining = true;
        let xs, ys;
        try {
            xs = tf.tensor2d(xTrain, [xTrain.length, 7]);
            ys = tf.tensor2d(yTrain, [yTrain.length, 5]);

            await this.model.fit(xs, ys, {
                epochs: 10,
                batchSize: 32,
                shuffle: true,
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        // Yield to the main thread to avoid freezing the UI
                        await tf.nextFrame();
                    }
                }
            });

            await this.save();
        } catch (e) {
            console.error("NN: Training error", e);
        } finally {
            if (xs) xs.dispose();
            if (ys) ys.dispose();
            this.isTraining = false;
        }
    }

    predict(state) {
        if (!this.model) return { action: null, confidence: 0 };

        return tf.tidy(() => {
            const input = [
                (state.position?.x ?? 0) / 800,
                (state.position?.y ?? 0) / 600,
                (state.direction?.x ?? 0),
                (state.direction?.y ?? 0),
                (state.hunger ?? 0) / 100,
                (state.social ?? 0) / 100,
                state.isDay ? 1 : 0
            ];
            
            const xs = tf.tensor2d([input], [1, 7]);
            const prediction = this.model.predict(xs);
            const probs = prediction.dataSync();
            
            let maxProb = -1;
            let bestActionIdx = -1;
            for (let i = 0; i < probs.length; i++) {
                if (probs[i] > maxProb) {
                    maxProb = probs[i];
                    bestActionIdx = i;
                }
            }

            const action = this.actions[bestActionIdx];
            const confidence = maxProb;

            if (confidence > this.threshold) {
                events.emit('NN_DECISION', { action: action, targetId: state.id });
            }

            return { action, confidence };
        });
    }
}
