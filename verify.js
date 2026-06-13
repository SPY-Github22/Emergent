// Mock tf for testing
global.tf = {
    sequential: () => ({
        layers: [],
        add: function(layer) { this.layers.push(layer); },
        compile: function() {},
        predict: function(xs) {
            // mock returning probs
            return { dataSync: () => [0.1, 0.2, 0.5, 0.1, 0.1] };
        },
        fit: async function(xs, ys, opts) {
            console.log(`Fitted with batch size ${xs.shape[0]}, feature size ${xs.shape[1]}`);
            console.log(`Labels shape: ${ys.shape[0]}x${ys.shape[1]}`);
        }
    }),
    layers: {
        dense: (config) => config
    },
    tensor2d: (arr, shape) => {
        return { array: arr, shape: shape };
    },
    tidy: (fn) => fn(),
    loadLayersModel: async () => { throw new Error('Not found'); }
};

import { NN } from './js/nn.js';
import { Trainer } from './js/trainer.js';
import { events } from './js/events.js';

async function run() {
    const nn = new NN();
    console.log("NN Layers:", nn.model.layers);
    
    // Verify predict shapes
    const state = { position: { x: 400, y: 300 }, direction: { x: 1, y: 0 }, hunger: 50, social: 50, isDay: true, id: 1 };
    const prediction = nn.predict(state);
    console.log("Prediction output:", prediction);

    // Verify trainer logic
    const world = { isDay: true };
    const trainer = new Trainer(world, nn);
    
    // add samples
    trainer.samples = [
        { action: 'Feed', state: { ...state } },
        { action: 'InvalidAction', state: { ...state } },
        { action: 'Connect', state: { ...state } }
    ];
    
    // Override train to inspect what is passed
    const originalTrain = nn.train.bind(nn);
    nn.train = async (xTrain, yTrain) => {
        console.log(`xTrain length: ${xTrain.length}, yTrain length: ${yTrain.length}`);
        return originalTrain(xTrain, yTrain);
    };

    await trainer.trainTask();
}

run().catch(console.error);
